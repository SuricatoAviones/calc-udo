/**
 * Programación geométrica (Rao, cap. de programación geométrica; Hillier & Lieberman, sec. 13.3):
 *
 *   minimizar g₀(x) = Σ_{i∈I₀} c_i Π_j x_j^{a_ij}   sujeto a   g_k(x) = Σ_{i∈I_k} c_i Π_j x_j^{a_ij} ≤ 1,
 *
 * con x > 0 y c_i > 0 (posinomios). El problema dual maximiza
 *
 *   v(δ) = Π_i (c_i/δ_i)^{δ_i} · Π_k λ_k^{λ_k},   λ_k = Σ_{i∈I_k} δ_i
 *
 * sujeto a la normalidad Σ_{i∈I₀} δ_i = 1, la ortogonalidad Σ_i a_ij δ_i = 0 (j = 1, …, n) y
 * δ ≥ 0. En el óptimo g₀(x*) = v(δ*). El grado de dificultad es D = T − (n + 1) (T términos): si
 * D = 0, las ecuaciones determinan δ*; si D > 0, se maximiza ln v sobre sus soluciones (es cóncava).
 * Después se recupera x* de
 *
 *   c_i Π_j x_j^{a_ij} = δ_i* · v*   (términos del objetivo),   = δ_i* / λ_k*   (restricción k).
 */
import { z } from 'zod';
import { Rational } from '@/lib/math/rational';
import { formatNumber, toLatexNumber, TEX } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Step,
} from '../types';
import { solveLpSilently } from '../optimizacion-de-operaciones/lp-solve';
import type { LinearProgram } from '../optimizacion-de-operaciones/lp-model';
import { solveDense } from './nlp';
import { toRational } from './restricted-simplex';

const MAX_TERMS = 12;

const exponent = z
  .number({ error: 'El exponente debe ser un número.' })
  .refine(Number.isFinite, 'El exponente debe ser un número finito.')
  .optional();

export const geometricInputSchema = z
  .object({
    terms: z
      .array(
        z.object({
          fn: z
            .number({ error: 'Indica la función del término (0 = objetivo).' })
            .int('La función se indica con un número entero.')
            .min(0, 'Usa 0 para el objetivo y 1, 2, … para las restricciones.')
            .max(6, 'El máximo es 6 restricciones.'),
          c: z
            .number({ error: 'Ingresa el coeficiente c.' })
            .refine(
              (v) => Number.isFinite(v) && v > 0,
              'Los coeficientes de un posinomio son positivos.',
            ),
          a1: exponent,
          a2: exponent,
          a3: exponent,
          a4: exponent,
        }),
      )
      .min(2, 'Agrega al menos dos términos.')
      .max(MAX_TERMS, `El máximo es ${MAX_TERMS} términos.`),
  })
  .superRefine((v, ctx) => {
    if (!v.terms.some((t) => t.fn === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['terms'],
        message: 'El objetivo (función 0) necesita al menos un término.',
      });
      return;
    }
    const used = [...new Set(v.terms.map((t) => t.fn).filter((k) => k > 0))].sort((a, b) => a - b);
    if (used.some((k, i) => k !== i + 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['terms'],
        message: 'Numera las restricciones 1, 2, 3, … sin saltos.',
      });
    }
    const exponents = v.terms.map((t) => [t.a1 ?? 0, t.a2 ?? 0, t.a3 ?? 0, t.a4 ?? 0]);
    if (exponents.every((row) => row.every((a) => a === 0))) {
      ctx.addIssue({
        code: 'custom',
        path: ['terms'],
        message: 'Algún término debe depender de las variables.',
      });
    }
  });

export type GeometricInput = z.infer<typeof geometricInputSchema>;

export interface GeometricValue {
  degreeOfDifficulty: number;
  delta: number[];
  lambda: number[];
  dualValue: number;
  x: number[];
  primalValue: number;
}

export type GeometricErrorCode = 'no-dual-solution' | 'inconsistent' | 'no-convergence';

type Result = CalculatorResult<GeometricValue, GeometricErrorCode>;

const n = toLatexNumber;

/** Resuelve M δ = e con racionales (M cuadrada); `null` si es singular. */
function solveRational(M: Rational[][], e: Rational[]): Rational[] | null {
  const size = M.length;
  const A = M.map((row, i) => [...row, e[i]!]);
  for (let k = 0; k < size; k++) {
    const pivot = A.findIndex((row, i) => i >= k && !row[k]!.isZero());
    if (pivot === -1) return null;
    [A[k], A[pivot]] = [A[pivot]!, A[k]!];
    for (let i = 0; i < size; i++) {
      if (i === k || A[i]![k]!.isZero()) continue;
      const factor = A[i]![k]!.div(A[k]![k]!);
      A[i] = A[i]!.map((v, j) => v.sub(factor.mul(A[k]![j]!)));
    }
  }
  return A.map((row, i) => row[size]!.div(row[i]!));
}

/** Base del espacio nulo de M (filas × columnas) por forma escalonada reducida. */
function nullSpace(M: number[][]): number[][] {
  const rows = M.length;
  const cols = M[0]!.length;
  const A = M.map((row) => [...row]);
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let best = r;
    for (let i = r + 1; i < rows; i++) if (Math.abs(A[i]![c]!) > Math.abs(A[best]![c]!)) best = i;
    if (Math.abs(A[best]![c]!) < 1e-10) continue;
    [A[r], A[best]] = [A[best]!, A[r]!];
    const p = A[r]![c]!;
    A[r] = A[r]!.map((v) => v / p);
    for (let i = 0; i < rows; i++) {
      if (i === r) continue;
      const factor = A[i]![c]!;
      A[i] = A[i]!.map((v, j) => v - factor * A[r]![j]!);
    }
    pivots.push(c);
    r++;
  }
  const free = Array.from({ length: cols }, (_, c) => c).filter((c) => !pivots.includes(c));
  return free.map((f) => {
    const v = new Array<number>(cols).fill(0);
    v[f] = 1;
    pivots.forEach((p, i) => {
      v[p] = -A[i]![f]!;
    });
    return v;
  });
}

const xlogx = (v: number) => (v > 0 ? v * Math.log(v) : 0);

type Term = GeometricInput['terms'][number];

function failure(code: GeometricErrorCode, message: string, steps: Step[]): Result {
  return { ok: false, error: { code, message }, ...emptyTrace(), steps };
}

/** Suma de los pesos de la función k (λ_k en las restricciones; 1 en el objetivo). */
function weightOf(terms: readonly Term[], d: readonly number[], k: number): number {
  return d.reduce((acc, di, i) => (terms[i]!.fn === k ? acc + di : acc), 0);
}

function weightsByFunction(terms: readonly Term[], d: readonly number[], K: number): number[] {
  return Array.from({ length: K + 1 }, (_, k) => weightOf(terms, d, k));
}

/** ln v(δ) = Σ δ_i ln(c_i/δ_i) + Σ_k λ_k ln λ_k. */
function dualLog(terms: readonly Term[], K: number, d: readonly number[]): number {
  let value = 0;
  d.forEach((di, i) => {
    value += di * Math.log(terms[i]!.c) - xlogx(di);
  });
  for (let k = 1; k <= K; k++) value += xlogx(weightOf(terms, d, k));
  return value;
}

function dualGradient(terms: readonly Term[], K: number, d: readonly number[]): number[] {
  const lambdas = weightsByFunction(terms, d, K);
  return d.map((di, i) => {
    const k = terms[i]!.fn;
    const base = Math.log(terms[i]!.c) - Math.log(di) - 1;
    return k === 0 ? base : base + Math.log(lambdas[k]!) + 1;
  });
}

function dualHessian(terms: readonly Term[], K: number, d: readonly number[]): number[][] {
  const lambdas = weightsByFunction(terms, d, K);
  return d.map((di, i) =>
    d.map((_, j) => {
      let h = i === j ? -1 / di : 0;
      const k = terms[i]!.fn;
      if (k > 0 && terms[j]!.fn === k) h += 1 / lambdas[k]!;
      return h;
    }),
  );
}

/** Paso de Newton en el espacio nulo; si no es de ascenso, el gradiente proyectado. */
function newtonDirection(basis: number[][], H: number[][], gt: number[]): number[] {
  const Ht = basis.map((u) =>
    basis.map((v) =>
      u.reduce((acc, ui, i) => acc + ui * v.reduce((s, vj, j) => s + H[i]![j]! * vj, 0), 0),
    ),
  );
  const step = solveDense(
    Ht,
    gt.map((v) => -v),
  );
  if (!step || step.reduce((acc, s, i) => acc + s * gt[i]!, 0) <= 0) return gt;
  return step;
}

/** Retrocede t = 1, 1/2, 1/4, … hasta un punto con pesos positivos que no empeore ln v. */
function backtrack(
  objective: (d: number[]) => number,
  current: number[],
  basis: number[][],
  step: number[],
): number[] | null {
  const base = objective(current);
  let t = 1;
  for (let s = 0; s < 80; s++) {
    const candidate = current.map(
      (di, i) => di + t * basis.reduce((acc, v, q) => acc + v[i]! * step[q]!, 0),
    );
    if (candidate.every((di) => di > 0) && objective(candidate) >= base - 1e-15) return candidate;
    t /= 2;
  }
  return null;
}

/** Máximo de ln v(δ) sobre δ = δ₀ + N t (Newton con retroceso); `null` si no converge. */
function maximizeDual(
  terms: readonly Term[],
  K: number,
  start: number[],
  basis: number[][],
): number[] | null {
  if (basis.length === 0) return start;
  const objective = (d: number[]) => dualLog(terms, K, d);
  let current = start;
  for (let iter = 0; iter < 200; iter++) {
    const g = dualGradient(terms, K, current);
    const gt = basis.map((v) => v.reduce((acc, vi, i) => acc + vi * g[i]!, 0));
    if (Math.hypot(...gt) < 1e-12) return current;
    const step = newtonDirection(basis, dualHessian(terms, K, current), gt);
    const next = backtrack(objective, current, basis, step);
    if (!next) return Math.hypot(...gt) < 1e-7 ? current : null;
    current = next;
  }
  return null;
}

/** Coeficiente de δ_i − s ≥ 0 en la columna j (la última columna es s). */
function interiorCoefficient(i: number, j: number, T: number): Rational {
  if (j === i) return Rational.ONE;
  return j === T ? Rational.of(-1) : Rational.ZERO;
}

/** Punto interior del dual: max s con M δ = e, δ_i ≥ s y s ≤ 1; `null` sin pesos positivos. */
function interiorPoint(M: number[][], e: number[], T: number): number[] | null {
  const variables = [...Array.from({ length: T }, (_, i) => `d${i + 1}`), 's'];
  const lp: LinearProgram = {
    sense: 'max',
    variables,
    objective: variables.map((v) => (v === 's' ? Rational.ONE : Rational.ZERO)),
    constraints: [
      ...M.map((row, r) => ({
        coefficients: [...row.map(toRational), Rational.ZERO],
        relation: '=' as const,
        rhs: toRational(e[r]!),
      })),
      ...Array.from({ length: T }, (_, i) => ({
        coefficients: variables.map((_, j) => interiorCoefficient(i, j, T)),
        relation: '>=' as const,
        rhs: Rational.ZERO,
      })),
      {
        coefficients: variables.map((_, j) => (j === T ? Rational.ONE : Rational.ZERO)),
        relation: '<=' as const,
        rhs: Rational.ONE,
      },
    ],
  };
  const result = solveLpSilently(lp);
  if (result.status !== 'optimal' || result.x[T]!.sign() <= 0) return null;
  return result.x.slice(0, T).map((v) => v.toNumber());
}

type DualWeights =
  { delta: number[]; exact: string[] | null } | { code: GeometricErrorCode; message: string };

/** Pesos óptimos: con D = 0, la solución exacta del sistema; si no, el máximo de la dual. */
function dualWeights(
  terms: readonly Term[],
  M: number[][],
  e: number[],
  D: number,
  K: number,
): DualWeights {
  if (D === 0) {
    const exact = solveRational(
      M.map((row) => row.map(toRational)),
      e.map(toRational),
    );
    if (exact) {
      return { delta: exact.map((d) => d.toNumber()), exact: exact.map((d) => d.toLatex()) };
    }
  }
  const start = interiorPoint(M, e, terms.length);
  if (!start) {
    return {
      code: 'no-dual-solution',
      message:
        'Las ecuaciones del dual no tienen una solución con todos los pesos positivos: revisa los exponentes (el problema primal puede no tener mínimo).',
    };
  }
  const delta = maximizeDual(terms, K, start, nullSpace(M));
  if (!delta) return { code: 'no-convergence', message: 'No se pudo maximizar la función dual.' };
  return { delta, exact: null };
}

const deltaTex = (i: number) => String.raw`\delta_{${i + 1}}`;

/** c_i·x₁^{a₁}·x₂^{a₂}… de un término. */
function termTex(c: number, row: readonly number[]): string {
  const factors = row.flatMap((a, j) => {
    if (a === 0) return [];
    const x = `x_{${j + 1}}`;
    return [a === 1 ? x : `${x}^{${n(a)}}`];
  });
  const product = factors.length > 0 ? String.raw`\,${factors.join(TEX.thinSpace)}` : '';
  return `${n(c)}${product}`;
}

/** Coeficiente delante de δ_i: se omite el 1 y del −1 queda el signo. */
function coefficientTex(a: number): string {
  if (a === 1) return '';
  return a === -1 ? '-' : n(a);
}

function equationTex(row: readonly number[], rhs: number): string {
  const parts = row.flatMap((a, i) => (a === 0 ? [] : [`${coefficientTex(a)}${deltaTex(i)}`]));
  return `${parts.join(' + ').replaceAll('+ -', '- ')} = ${rhs}`;
}

function difficultyText(D: number): string {
  if (D === 0) {
    return 'Hay tantos términos como ecuaciones del dual (normalidad y ortogonalidad): las ecuaciones determinan los pesos δ.';
  }
  if (D > 0) {
    return `Sobran ${D} grado(s) de libertad: se maximiza la función dual sobre las soluciones de las ecuaciones.`;
  }
  return 'Hay menos términos que ecuaciones: el sistema del dual puede no tener solución positiva.';
}

/** δ_i escrito: la fracción exacta si se tiene; si no, el decimal. */
function weightTex(
  delta: readonly number[],
  exact: readonly string[] | null,
  i: number,
  digits: number,
): string {
  return exact?.[i] ?? n(delta[i]!, digits);
}

function weightsResultTex(
  delta: readonly number[],
  exact: readonly string[] | null,
  lambda: readonly number[],
): string {
  const weights = delta
    .map((_, i) => `${deltaTex(i)} = ${weightTex(delta, exact, i, 8)}`)
    .join(String.raw`,\ `);
  if (lambda.length === 0) return weights;
  const lambdas = lambda
    .map((l, k) => String.raw`\lambda_{${k + 1}} = ${n(l, 8)}`)
    .join(TEX.listSep);
  return String.raw`${weights}, \quad ${lambdas}`;
}

function dualValueTex(
  terms: readonly Term[],
  delta: readonly number[],
  exact: readonly string[] | null,
  lambda: readonly number[],
): string {
  const factors = delta.flatMap((d, i) => {
    if (d === 0) return [];
    const w = weightTex(delta, exact, i, 6);
    return [String.raw`\left(\frac{${n(terms[i]!.c)}}{${w}}\right)^{${w}}`];
  });
  const lambdaFactors = lambda.map((l) => (l > 0 ? String.raw`\,(${n(l, 6)})^{${n(l, 6)}}` : ''));
  return `v = ${factors.join('')}${lambdaFactors.join('')}`;
}

/** Lado derecho de la ecuación de recuperación: δ_i v* (objetivo) o δ_i/λ_k (restricción k). */
function recoveryTargetTex(i: number, k: number): string {
  return k === 0
    ? String.raw`${deltaTex(i)}\,v^*`
    : String.raw`\frac{${deltaTex(i)}}{\lambda_{${k}}}`;
}

/** Mínimos cuadrados de las ecuaciones en ln x: AᵀA z = Aᵀb. */
function solveLogs(rows: number[][], rhs: number[], size: number): number[] | null {
  const AtA = Array.from({ length: size }, (_, a) =>
    Array.from({ length: size }, (_, b) => rows.reduce((acc, row) => acc + row[a]! * row[b]!, 0)),
  );
  const Atb = Array.from({ length: size }, (_, a) =>
    rows.reduce((acc, row, r) => acc + row[a]! * rhs[r]!, 0),
  );
  return solveDense(AtA, Atb);
}

function termValue(c: number, row: readonly number[], x: readonly number[]): number {
  return c * row.reduce((p, a, j) => p * x[j]! ** a, 1);
}

/** Avisos si el valor primal no coincide con el dual o alguna restricción no se cumple. */
function consistencyNotices(
  primalValue: number,
  dualValue: number,
  K: number,
  value: (k: number) => number,
): Result['notices'] {
  const notices: Result['notices'] = [];
  if (Math.abs(primalValue - dualValue) > 1e-6 * Math.max(1, dualValue)) {
    notices.push({
      level: 'warning',
      message: `El valor primal (${formatNumber(primalValue, 8)}) no coincide con el dual (${formatNumber(dualValue, 8)}): revisa los datos.`,
    });
  }
  for (let k = 1; k <= K; k++) {
    const g = value(k);
    if (g > 1 + 1e-6) {
      notices.push({
        level: 'warning',
        message: `La restricción ${k} vale ${formatNumber(g, 6)} > 1 en el punto recuperado.`,
      });
    }
  }
  return notices;
}

export function solveGeometric({ terms }: GeometricInput): Result {
  const T = terms.length;
  const exponents = terms.map((t) => [t.a1 ?? 0, t.a2 ?? 0, t.a3 ?? 0, t.a4 ?? 0]);
  const used = exponents.flatMap((row) => row.flatMap((a, j) => (a === 0 ? [] : [j + 1])));
  const size = Math.max(1, ...used);
  const K = Math.max(0, ...terms.map((t) => t.fn));
  const D = T - (size + 1);
  const powers = exponents.map((row) => row.slice(0, size));

  const termOf = (i: number) => termTex(terms[i]!.c, powers[i]!);
  const functionTex = (k: number) =>
    terms
      .map((t, i) => (t.fn === k ? termOf(i) : null))
      .filter(Boolean)
      .join(' + ');

  const steps: Step[] = [
    {
      title: 'Problema primal',
      explanation:
        'Cada término es un coeficiente positivo por un producto de potencias de las variables (posinomio).',
      substitution: [
        String.raw`\min g_0 = ${functionTex(0)}`,
        ...Array.from(
          { length: K },
          (_, k) => String.raw`g_{${k + 1}} = ${functionTex(k + 1)} \le 1`,
        ),
      ].join(String.raw` \\ `),
    },
    {
      title: 'Grado de dificultad',
      explanation: difficultyText(D),
      formula: 'D = T - (n + 1)',
      substitution: `D = ${T} - (${size} + 1)`,
      result: `D = ${D}`,
    },
  ];

  // Ecuaciones del dual: M δ = e.
  const M = [
    terms.map((t) => (t.fn === 0 ? 1 : 0)),
    ...Array.from({ length: size }, (_, j) => exponents.map((row) => row[j]!)),
  ];
  const e = [1, ...new Array<number>(size).fill(0)];
  steps.push({
    title: 'Ecuaciones del dual',
    explanation:
      'Normalidad: los pesos del objetivo suman 1. Ortogonalidad: para cada variable, la suma de sus exponentes por los pesos es 0.',
    substitution: [
      String.raw`\text{Normalidad: } ${equationTex(M[0]!, 1)}`,
      ...M.slice(1).map(
        (row, j) => String.raw`\text{Ortogonalidad } x_{${j + 1}}: ${equationTex(row, 0)}`,
      ),
    ].join(String.raw` \\ `),
  });

  const weights = dualWeights(terms, M, e, D, K);
  if ('code' in weights) return failure(weights.code, weights.message, steps);
  if (weights.delta.some((d) => d < -1e-12)) {
    return failure(
      'no-dual-solution',
      'La solución de las ecuaciones del dual tiene pesos negativos: el problema no tiene mínimo con x > 0.',
      steps,
    );
  }
  const { exact } = weights;
  const delta = weights.delta.map((d) => (Math.abs(d) < 1e-14 ? 0 : d));
  const lambda = Array.from({ length: K }, (_, k) => weightOf(terms, delta, k + 1));
  const logDual =
    delta.reduce((acc, d, i) => acc + d * Math.log(terms[i]!.c) - xlogx(d), 0) +
    lambda.reduce((acc, l) => acc + xlogx(l), 0);
  const dualValue = Math.exp(logDual);

  steps.push(
    {
      title:
        D === 0
          ? 'Pesos óptimos (solución del sistema)'
          : 'Pesos óptimos (máximo de la función dual)',
      explanation:
        D === 0
          ? 'Con D = 0 el sistema tiene solución única.'
          : 'Se maximiza ln v(δ), que es cóncava, sobre las soluciones de las ecuaciones (método de Newton); se parte de una solución con todos los pesos positivos.',
      result: weightsResultTex(delta, exact, lambda),
    },
    {
      title: 'Valor óptimo (función dual)',
      formula: String.raw`v(\delta) = \prod_i \left(\frac{c_i}{\delta_i}\right)^{\delta_i} \prod_k \lambda_k^{\lambda_k}`,
      substitution: dualValueTex(terms, delta, exact, lambda),
      result: String.raw`g_0(x^*) = v(\delta^*) = ${n(dualValue)}`,
    },
  );

  // Recuperar x*: Σ_j a_ij ln x_j = ln(δ_i v* / c_i) (objetivo) o ln(δ_i / (λ_k c_i)).
  const rows: number[][] = [];
  const rhs: number[] = [];
  const recoveryLines: string[] = [];
  delta.forEach((d, i) => {
    if (d <= 0) return;
    const k = terms[i]!.fn;
    if (k > 0 && lambda[k - 1]! <= 0) return;
    const target = k === 0 ? d * dualValue : d / lambda[k - 1]!;
    rows.push(powers[i]!);
    rhs.push(Math.log(target / terms[i]!.c));
    recoveryLines.push(`${termOf(i)} = ${recoveryTargetTex(i, k)} = ${n(target, 8)}`);
  });
  const logs = solveLogs(rows, rhs, size);
  if (!logs) {
    return failure(
      'inconsistent',
      'No se pudieron recuperar las variables primales a partir de los pesos óptimos.',
      steps,
    );
  }
  const x = logs.map((v) => Number(Math.exp(v).toPrecision(12)));
  const value = (k: number) =>
    terms.reduce((acc, t, i) => (t.fn === k ? acc + termValue(t.c, powers[i]!, x) : acc), 0);
  const primalValue = value(0);
  steps.push({
    title: 'Recuperar las variables',
    explanation:
      'En el óptimo, cada término del objetivo vale δ_i·v* y cada término de la restricción k vale δ_i/λ_k. Tomando logaritmos quedan ecuaciones lineales en ln x_j.',
    substitution: recoveryLines.join(String.raw` \\ `),
    result: String.raw`x^* = \left(${x.map((v) => n(v, 8)).join(TEX.listSep)}\right), \qquad g_0(x^*) = ${n(primalValue)}`,
  });

  const notices = consistencyNotices(primalValue, dualValue, K, value);

  const table = terms.map((t, i): Record<string, CellValue> => ({
    term: i + 1,
    fn: t.fn === 0 ? 'objetivo' : `restricción ${t.fn}`,
    c: t.c,
    delta: delta[i]!,
    value: termValue(t.c, powers[i]!, x),
  }));

  return {
    ok: true,
    value: { degreeOfDifficulty: D, delta, lambda, dualValue, x, primalValue },
    summary: [
      { label: 'Valor mínimo', value: `g_0(x^*) = ${n(dualValue, 8)}`, emphasis: true },
      {
        label: 'Solución',
        value: String.raw`x^* = \left(${x.map((v) => n(v, 6)).join(TEX.listSep)}\right)`,
      },
      { label: 'Grado de dificultad', value: `D = ${D}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'terminos',
        title: 'Pesos y valor de cada término en el óptimo',
        columns: [
          { key: 'term', header: 'i' },
          { key: 'fn', header: String.raw`\text{Función}`, format: 'text' },
          { key: 'c', header: 'c_i' },
          { key: 'delta', header: String.raw`\delta_i^*` },
          { key: 'value', header: String.raw`\text{Término en } x^*` },
        ],
        rows: table,
      },
    ],
    notices,
  };
}

export const geometric: Calculator<GeometricInput, GeometricValue, GeometricErrorCode> = {
  meta: {
    id: 'programacion-geometrica',
    title: 'Programación geométrica',
    summary: 'Optimiza posinomios mediante el problema dual (sin y con restricciones).',
    citations: [
      { sourceId: 'rao-1999', locator: 'Cap. de programación geométrica' },
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 13.3, programación geométrica (7.ª ed.)',
      },
      { sourceId: 'cooper-1998' },
    ],
  },
  inputSchema: geometricInputSchema,
  // Duffin, Peterson y Zener: 400 yd³ de grava en una caja abierta de x1 × x2 × x3; costo de los
  // viajes 40/(x1 x2 x3) y de la caja 40 x2 x3 + 20 x1 x3 + 10 x1 x2.
  example: {
    terms: [
      { fn: 0, c: 40, a1: -1, a2: -1, a3: -1 },
      { fn: 0, c: 40, a1: 0, a2: 1, a3: 1 },
      { fn: 0, c: 20, a1: 1, a2: 0, a3: 1 },
      { fn: 0, c: 10, a1: 1, a2: 1, a3: 0 },
    ],
  },
  solve: solveGeometric,
};
