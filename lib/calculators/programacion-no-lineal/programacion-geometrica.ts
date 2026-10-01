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
import { formatNumber, toLatexNumber } from '@/lib/math/format';
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

export function solveGeometric({ terms }: GeometricInput): Result {
  const T = terms.length;
  const exponents = terms.map((t) => [t.a1 ?? 0, t.a2 ?? 0, t.a3 ?? 0, t.a4 ?? 0]);
  let size = 0;
  exponents.forEach((row) => row.forEach((a, j) => a !== 0 && (size = Math.max(size, j + 1))));
  size = Math.max(size, 1);
  const K = Math.max(0, ...terms.map((t) => t.fn));
  const D = T - (size + 1);

  const termTex = (i: number) => {
    const t = terms[i]!;
    const factors = exponents[i]!.slice(0, size).flatMap((a, j) =>
      a === 0 ? [] : [a === 1 ? `x_{${j + 1}}` : `x_{${j + 1}}^{${n(a)}}`],
    );
    return `${n(t.c)}${factors.length > 0 ? `\\,${factors.join('\\,')}` : ''}`;
  };
  const functionTex = (k: number) =>
    terms
      .map((t, i) => (t.fn === k ? termTex(i) : null))
      .filter(Boolean)
      .join(' + ');

  const steps: Step[] = [
    {
      title: 'Problema primal',
      explanation:
        'Cada término es un coeficiente positivo por un producto de potencias de las variables (posinomio).',
      substitution: [
        `\\min g_0 = ${functionTex(0)}`,
        ...Array.from({ length: K }, (_, k) => `g_{${k + 1}} = ${functionTex(k + 1)} \\le 1`),
      ].join(' \\\\ '),
    },
    {
      title: 'Grado de dificultad',
      explanation:
        D === 0
          ? 'Hay tantos términos como ecuaciones del dual (normalidad y ortogonalidad): las ecuaciones determinan los pesos δ.'
          : D > 0
            ? `Sobran ${D} grado(s) de libertad: se maximiza la función dual sobre las soluciones de las ecuaciones.`
            : 'Hay menos términos que ecuaciones: el sistema del dual puede no tener solución positiva.',
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
  const deltaTex = (i: number) => `\\delta_{${i + 1}}`;
  const equationTex = (row: number[], rhs: number) => {
    const parts = row.flatMap((a, i) =>
      a === 0 ? [] : [`${a === 1 ? '' : a === -1 ? '-' : n(a)}${deltaTex(i)}`],
    );
    return `${parts.join(' + ').replace(/\+ -/g, '- ')} = ${rhs}`;
  };
  steps.push({
    title: 'Ecuaciones del dual',
    explanation:
      'Normalidad: los pesos del objetivo suman 1. Ortogonalidad: para cada variable, la suma de sus exponentes por los pesos es 0.',
    substitution: [
      `\\text{Normalidad: } ${equationTex(M[0]!, 1)}`,
      ...M.slice(1).map((row, j) => `\\text{Ortogonalidad } x_{${j + 1}}: ${equationTex(row, 0)}`),
    ].join(' \\\\ '),
  });

  let delta: number[] | null = null;
  let deltaLatex: string[] | null = null;
  if (D === 0) {
    const exact = solveRational(
      M.map((row) => row.map(toRational)),
      e.map(toRational),
    );
    if (exact) {
      delta = exact.map((d) => d.toNumber());
      deltaLatex = exact.map((d) => d.toLatex());
    }
  }
  if (!delta) {
    // Punto interior: max s con M δ = e, δ_i ≥ s.
    const variables = [...terms.map((_, i) => `d${i + 1}`), 's'];
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
        ...terms.map((_, i) => ({
          coefficients: variables.map((_, j) =>
            j === i ? Rational.ONE : j === T ? Rational.of(-1) : Rational.ZERO,
          ),
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
    const lpResult = solveLpSilently(lp);
    if (lpResult.status !== 'optimal' || lpResult.x[T]!.sign() <= 0) {
      return {
        ok: false,
        error: {
          code: 'no-dual-solution',
          message:
            'Las ecuaciones del dual no tienen una solución con todos los pesos positivos: revisa los exponentes (el problema primal puede no tener mínimo).',
        },
        ...emptyTrace(),
        steps,
      };
    }
    let current = lpResult.x.slice(0, T).map((v) => v.toNumber());
    const basis = nullSpace(M);
    // Máximo de ln v(δ) = Σ δ_i ln(c_i/δ_i) + Σ_k λ_k ln λ_k sobre δ = δ₀ + N t.
    const objectiveOf = (d: number[]) => {
      let value = 0;
      d.forEach((di, i) => {
        value += di * Math.log(terms[i]!.c) - xlogx(di);
      });
      for (let k = 1; k <= K; k++) {
        value += xlogx(d.reduce((acc, di, i) => (terms[i]!.fn === k ? acc + di : acc), 0));
      }
      return value;
    };
    const gradientOf = (d: number[]) => {
      const lambdas = Array.from({ length: K + 1 }, (_, k) =>
        d.reduce((acc, di, i) => (terms[i]!.fn === k ? acc + di : acc), 0),
      );
      return d.map((di, i) => {
        const k = terms[i]!.fn;
        const base = Math.log(terms[i]!.c) - Math.log(di) - 1;
        return k === 0 ? base : base + Math.log(lambdas[k]!) + 1;
      });
    };
    const hessianOf = (d: number[]) => {
      const lambdas = Array.from({ length: K + 1 }, (_, k) =>
        d.reduce((acc, di, i) => (terms[i]!.fn === k ? acc + di : acc), 0),
      );
      return d.map((di, i) =>
        d.map((_, j) => {
          let h = i === j ? -1 / di : 0;
          const k = terms[i]!.fn;
          if (k > 0 && terms[j]!.fn === k) h += 1 / lambdas[k]!;
          return h;
        }),
      );
    };
    let converged = basis.length === 0;
    for (let iter = 0; iter < 200 && !converged; iter++) {
      const g = gradientOf(current);
      const H = hessianOf(current);
      const gt = basis.map((v) => v.reduce((acc, vi, i) => acc + vi * g[i]!, 0));
      if (Math.hypot(...gt) < 1e-12) {
        converged = true;
        break;
      }
      const Ht = basis.map((u) =>
        basis.map((v) =>
          u.reduce((acc, ui, i) => acc + ui * v.reduce((s, vj, j) => s + H[i]![j]! * vj, 0), 0),
        ),
      );
      let step = solveDense(
        Ht,
        gt.map((v) => -v),
      );
      if (!step || step.reduce((acc, s, i) => acc + s * gt[i]!, 0) <= 0) step = gt;
      const base = objectiveOf(current);
      let t = 1;
      let moved = false;
      for (let s = 0; s < 80; s++) {
        const candidate = current.map(
          (di, i) => di + t * basis.reduce((acc, v, q) => acc + v[i]! * step![q]!, 0),
        );
        if (candidate.every((di) => di > 0) && objectiveOf(candidate) >= base - 1e-15) {
          current = candidate;
          moved = true;
          break;
        }
        t /= 2;
      }
      if (!moved) {
        converged = Math.hypot(...gt) < 1e-7;
        break;
      }
    }
    if (!converged) {
      return {
        ok: false,
        error: { code: 'no-convergence', message: 'No se pudo maximizar la función dual.' },
        ...emptyTrace(),
        steps,
      };
    }
    delta = current;
  }

  if (delta.some((d) => d < -1e-12)) {
    return {
      ok: false,
      error: {
        code: 'no-dual-solution',
        message:
          'La solución de las ecuaciones del dual tiene pesos negativos: el problema no tiene mínimo con x > 0.',
      },
      ...emptyTrace(),
      steps,
    };
  }
  delta = delta.map((d) => (Math.abs(d) < 1e-14 ? 0 : d));
  const lambda = Array.from({ length: K }, (_, k) =>
    delta!.reduce((acc, d, i) => (terms[i]!.fn === k + 1 ? acc + d : acc), 0),
  );
  const logDual =
    delta.reduce((acc, d, i) => acc + d * Math.log(terms[i]!.c) - xlogx(d), 0) +
    lambda.reduce((acc, l) => acc + xlogx(l), 0);
  const dualValue = Math.exp(logDual);

  steps.push({
    title:
      D === 0
        ? 'Pesos óptimos (solución del sistema)'
        : 'Pesos óptimos (máximo de la función dual)',
    explanation:
      D === 0
        ? 'Con D = 0 el sistema tiene solución única.'
        : 'Se maximiza ln v(δ), que es cóncava, sobre las soluciones de las ecuaciones (método de Newton); se parte de una solución con todos los pesos positivos.',
    result: delta
      .map((d, i) => `${deltaTex(i)} = ${deltaLatex ? deltaLatex[i] : n(d, 8)}`)
      .join(',\\ ')
      .concat(
        lambda.length > 0
          ? `, \\quad ${lambda.map((l, k) => `\\lambda_{${k + 1}} = ${n(l, 8)}`).join(',\\ ')}`
          : '',
      ),
  });
  steps.push({
    title: 'Valor óptimo (función dual)',
    formula:
      'v(\\delta) = \\prod_i \\left(\\frac{c_i}{\\delta_i}\\right)^{\\delta_i} \\prod_k \\lambda_k^{\\lambda_k}',
    substitution: `v = ${delta
      .map((d, i) =>
        d === 0
          ? null
          : `\\left(\\frac{${n(terms[i]!.c)}}{${deltaLatex ? deltaLatex[i] : n(d, 6)}}\\right)^{${deltaLatex ? deltaLatex[i] : n(d, 6)}}`,
      )
      .filter(Boolean)
      .join('')}${lambda.map((l) => (l > 0 ? `\\,(${n(l, 6)})^{${n(l, 6)}}` : '')).join('')}`,
    result: `g_0(x^*) = v(\\delta^*) = ${n(dualValue)}`,
  });

  // Recuperar x*: Σ_j a_ij ln x_j = ln(δ_i v* / c_i) (objetivo) o ln(δ_i / (λ_k c_i)).
  const rows: number[][] = [];
  const rhs: number[] = [];
  const recoveryLines: string[] = [];
  delta.forEach((d, i) => {
    if (d <= 0) return;
    const k = terms[i]!.fn;
    if (k > 0 && lambda[k - 1]! <= 0) return;
    const target = k === 0 ? d * dualValue : d / lambda[k - 1]!;
    rows.push(exponents[i]!.slice(0, size));
    rhs.push(Math.log(target / terms[i]!.c));
    recoveryLines.push(
      `${termTex(i)} = ${k === 0 ? `${deltaTex(i)}\\,v^*` : `\\frac{${deltaTex(i)}}{\\lambda_{${k}}}`} = ${n(target, 8)}`,
    );
  });
  const AtA = Array.from({ length: size }, (_, a) =>
    Array.from({ length: size }, (_, b) => rows.reduce((acc, row) => acc + row[a]! * row[b]!, 0)),
  );
  const Atb = Array.from({ length: size }, (_, a) =>
    rows.reduce((acc, row, r) => acc + row[a]! * rhs[r]!, 0),
  );
  const logs = solveDense(AtA, Atb);
  if (!logs) {
    return {
      ok: false,
      error: {
        code: 'inconsistent',
        message: 'No se pudieron recuperar las variables primales a partir de los pesos óptimos.',
      },
      ...emptyTrace(),
      steps,
    };
  }
  const x = logs.map((v) => Number(Math.exp(v).toPrecision(12)));
  const value = (k: number) =>
    terms.reduce(
      (acc, t, i) =>
        t.fn === k
          ? acc + t.c * exponents[i]!.slice(0, size).reduce((p, a, j) => p * x[j]! ** a, 1)
          : acc,
      0,
    );
  const primalValue = value(0);
  steps.push({
    title: 'Recuperar las variables',
    explanation:
      'En el óptimo, cada término del objetivo vale δ_i·v* y cada término de la restricción k vale δ_i/λ_k. Tomando logaritmos quedan ecuaciones lineales en ln x_j.',
    substitution: recoveryLines.join(' \\\\ '),
    result: `x^* = \\left(${x.map((v) => n(v, 8)).join(',\\ ')}\\right), \\qquad g_0(x^*) = ${n(primalValue)}`,
  });

  const notices: Result['notices'] = [];
  if (Math.abs(primalValue - dualValue) > 1e-6 * Math.max(1, dualValue)) {
    notices.push({
      level: 'warning',
      message: `El valor primal (${formatNumber(primalValue, 8)}) no coincide con el dual (${formatNumber(dualValue, 8)}): revisa los datos.`,
    });
  }
  for (let k = 1; k <= K; k++) {
    if (value(k) > 1 + 1e-6) {
      notices.push({
        level: 'warning',
        message: `La restricción ${k} vale ${formatNumber(value(k), 6)} > 1 en el punto recuperado.`,
      });
    }
  }

  const table = terms.map((t, i): Record<string, CellValue> => ({
    term: i + 1,
    fn: t.fn === 0 ? 'objetivo' : `restricción ${t.fn}`,
    c: t.c,
    delta: delta![i]!,
    value: t.c * exponents[i]!.slice(0, size).reduce((p, a, j) => p * x[j]! ** a, 1),
  }));

  return {
    ok: true,
    value: { degreeOfDifficulty: D, delta, lambda, dualValue, x, primalValue },
    summary: [
      { label: 'Valor mínimo', value: `g_0(x^*) = ${n(dualValue, 8)}`, emphasis: true },
      { label: 'Solución', value: `x^* = \\left(${x.map((v) => n(v, 6)).join(',\\ ')}\\right)` },
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
          { key: 'fn', header: '\\text{Función}', format: 'text' },
          { key: 'c', header: 'c_i' },
          { key: 'delta', header: '\\delta_i^*' },
          { key: 'value', header: '\\text{Término en } x^*' },
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
