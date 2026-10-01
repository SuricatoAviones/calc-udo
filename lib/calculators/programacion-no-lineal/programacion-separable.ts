/**
 * Programación separable por aproximación lineal por tramos (Taha, sec. 21.2.1; Hillier &
 * Lieberman, sec. 13.8). Si la función objetivo y las restricciones son sumas de funciones de una
 * sola variable,
 *
 *   max (o min) z = Σ_j f_j(x_j)   sujeto a   Σ_j g_ij(x_j) ≤ b_i,   x ≥ 0,
 *
 * cada función no lineal de x_j se aproxima con puntos de quiebre a_j1 < … < a_jK:
 *
 *   f_j(x_j) ≈ Σ_k f_j(a_jk) w_jk,   x_j = Σ_k a_jk w_jk,   Σ_k w_jk = 1,   w_jk ≥ 0
 *
 * y el modelo lineal resultante se resuelve con el simplex de base restringida: a lo sumo dos
 * pesos w_jk positivos por variable, y deben ser adyacentes. Las variables que ya aparecen en forma
 * lineal no se aproximan. El resultado es un óptimo local del problema aproximado.
 */
import { z } from 'zod';
import { Rational } from '@/lib/math/rational';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { ParsedExpression } from '@/lib/math/expression';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Step,
} from '../types';
import {
  MValue,
  pivotTableau,
  priceOut,
  type Column,
  type Tableau,
} from '../optimizacion-de-operaciones/tableau';
import { evaluateAt, parseConstraintList, parseNlpExpression, type NlpConstraint } from './nlp';
import {
  basicValues,
  restrictedTrace,
  runRestrictedSimplex,
  toRational,
  type Admissibility,
} from './restricted-simplex';

const MAX_BREAKPOINTS = 12;

/** «x2: 0, 1, 2, 3» (una línea por variable aproximada). */
function parseBreakpoints(text: string): Map<number, number[]> | string {
  const result = new Map<number, number[]>();
  const lines = text
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
  for (const [index, line] of lines.entries()) {
    const match = /^x(\d)\s*[:=]\s*(.+)$/i.exec(line);
    if (!match) return `Línea ${index + 1}: escribe «x2: 0, 1, 2, 3».`;
    const values = match[2]!
      .split(/[\s;]+|,(?=\s)/)
      .map((t) => t.trim().replace(',', '.'))
      .filter((t) => t !== '')
      .map(Number);
    if (values.some((v) => !Number.isFinite(v)))
      return `Línea ${index + 1}: hay valores que no son números.`;
    if (values.length < 2) return `Línea ${index + 1}: hacen falta al menos 2 puntos de quiebre.`;
    if (values.length > MAX_BREAKPOINTS)
      return `Línea ${index + 1}: el máximo es ${MAX_BREAKPOINTS} puntos.`;
    if (values.some((v, i) => i > 0 && v <= values[i - 1]!)) {
      return `Línea ${index + 1}: los puntos de quiebre deben ir en orden creciente.`;
    }
    if (values[0]! < 0)
      return `Línea ${index + 1}: las variables son no negativas; empieza en 0 o más.`;
    result.set(Number(match[1]) - 1, values);
  }
  return result;
}

export const separableInputSchema = z
  .object({
    sense: z.enum(['max', 'min'], { error: 'Elige si se maximiza o se minimiza.' }),
    objective: z
      .string()
      .trim()
      .min(1, 'Escribe la función objetivo.')
      .max(300, 'La expresión es demasiado larga.'),
    constraints: z
      .string()
      .trim()
      .min(1, 'Escribe al menos una restricción.')
      .max(1500, 'Las restricciones son demasiado largas.'),
    breakpoints: z.string().trim().min(1, 'Escribe los puntos de quiebre.'),
  })
  .superRefine((v, ctx) => {
    const model = readModel(v);
    if (typeof model === 'string') {
      const path = model.startsWith('Puntos')
        ? 'breakpoints'
        : model.startsWith('Restricción')
          ? 'constraints'
          : 'objective';
      ctx.addIssue({ code: 'custom', path: [path], message: model });
    }
  });

export type SeparableInput = z.infer<typeof separableInputSchema>;

interface SeparableModel {
  n: number;
  f: ParsedExpression;
  constraints: NlpConstraint[];
  /** Pieza de f y de cada g_i que depende solo de x_j: h(t) = F(t e_j) − F(0). */
  fPart: (j: number, t: number) => number;
  gPart: (i: number, j: number, t: number) => number;
  /** Constante de cada restricción: g_i(0). */
  gZero: number[];
  /** Variables lineales en todas las funciones (no se aproximan). */
  linear: boolean[];
  breakpoints: Map<number, number[]>;
}

const TEST_POINTS = [0.5, 1, 2, 3.7];

function readModel(v: {
  objective: string;
  constraints: string;
  breakpoints: string;
}): SeparableModel | string {
  const f = parseNlpExpression(v.objective.replace(/^\s*(max|min)?\s*z\s*=/i, ''));
  if (!f.ok) return f.message;
  const constraints = parseConstraintList(
    v.constraints
      .split(/\r?\n/)
      .filter((l) => !/^\s*x\d(\s*,\s*x\d)*\s*>=\s*0\s*$/.test(l))
      .join('\n'),
  );
  if (typeof constraints === 'string') return constraints;
  if (constraints.length === 0) return 'Restricción: escribe al menos una además de x ≥ 0.';
  if (constraints.some((c) => c.relation === '=')) {
    return 'Restricción: usa restricciones ≤ (o ≥, que se convierten).';
  }
  const n = Math.max(f.maxIndex, ...constraints.map((c) => c.maxIndex), 1);
  const breakpoints = parseBreakpoints(v.breakpoints);
  if (typeof breakpoints === 'string') return `Puntos de quiebre: ${breakpoints}`;

  const at = (expr: ParsedExpression, j: number, t: number) => {
    const x = new Array<number>(n).fill(0);
    x[j] = t;
    return evaluateAt(expr, x);
  };
  const f0 = at(f.expr, 0, 0);
  const fPart = (j: number, t: number) => at(f.expr, j, t) - f0;
  const gZero = constraints.map((c) => at(c.g, 0, 0));
  const gPart = (i: number, j: number, t: number) => at(constraints[i]!.g, j, t) - gZero[i]!;

  // Separabilidad: F(x) = F(0) + Σ_j h_j(x_j) en un punto de prueba con todas las variables ≠ 0.
  const probe = Array.from({ length: n }, (_, j) => 0.7 + 0.45 * j);
  const separable = (
    expr: ParsedExpression,
    part: (j: number, t: number) => number,
    zero: number,
  ) => {
    const direct = evaluateAt(expr, probe);
    const sum = zero + probe.reduce((acc, t, j) => acc + part(j, t), 0);
    return (
      Number.isFinite(direct) && Math.abs(direct - sum) <= 1e-8 * Math.max(1, Math.abs(direct))
    );
  };
  if (!separable(f.expr, fPart, f0)) {
    return 'La función objetivo no es separable: no se puede escribir como suma de funciones de una variable (p. ej. x1*x2 no lo es).';
  }
  for (let i = 0; i < constraints.length; i++) {
    if (!separable(constraints[i]!.g, (j, t) => gPart(i, j, t), gZero[i]!)) {
      return `Restricción ${i + 1}: no es separable.`;
    }
  }
  const isLinear = (part: (t: number) => number) => {
    const slope = part(1);
    return TEST_POINTS.every(
      (t) => Math.abs(part(t) - slope * t) <= 1e-9 * Math.max(1, Math.abs(slope * t)),
    );
  };
  const linear = Array.from(
    { length: n },
    (_, j) =>
      isLinear((t) => fPart(j, t)) && constraints.every((_, i) => isLinear((t) => gPart(i, j, t))),
  );
  for (let j = 0; j < n; j++) {
    if (!linear[j] && !breakpoints.has(j)) {
      return `Puntos de quiebre: x${j + 1} aparece en forma no lineal; indica sus puntos de quiebre.`;
    }
  }
  return { n, f: f.expr, constraints, fPart, gPart, gZero, linear, breakpoints };
}

export interface SeparableValue {
  x: number[];
  weights: { variable: number; breakpoint: number; weight: number }[];
  approximateObjective: number;
  trueObjective: number;
}

export type SeparableErrorCode =
  'invalid-model' | 'infeasible-start' | 'unbounded' | 'max-iterations';

type Result = CalculatorResult<SeparableValue, SeparableErrorCode>;

const n = toLatexNumber;

export function solveSeparable(input: SeparableInput): Result {
  const model = readModel(input);
  if (typeof model === 'string') {
    return { ok: false, error: { code: 'invalid-model', message: model }, ...emptyTrace() };
  }
  const { n: size, constraints, linear, breakpoints } = model;
  const m = constraints.length;
  const sign = input.sense === 'max' ? 1 : -1;

  // Columnas: x_j lineales, w_jk de las aproximadas, holguras.
  const columns: Column[] = [];
  const meta: (
    { kind: 'x'; j: number } | { kind: 'w'; j: number; k: number } | { kind: 's'; i: number }
  )[] = [];
  for (let j = 0; j < size; j++) {
    if (linear[j]) {
      columns.push({ name: `x${j + 1}`, latex: `x_{${j + 1}}`, kind: 'decision' });
      meta.push({ kind: 'x', j });
    } else {
      breakpoints.get(j)!.forEach((_, k) => {
        columns.push({
          name: `w${j + 1}${k + 1}`,
          latex: `w_{${j + 1}${k + 1}}`,
          kind: 'decision',
        });
        meta.push({ kind: 'w', j, k });
      });
    }
  }
  constraints.forEach((_, i) => {
    columns.push({ name: `s${i + 1}`, latex: `s_{${i + 1}}`, kind: 'slack' });
    meta.push({ kind: 's', i });
  });

  // Coeficientes de cada columna en el objetivo y en las restricciones (forma ≤).
  const objectiveCoef = meta.map((c) => {
    if (c.kind === 'x') return model.fPart(c.j, 1);
    if (c.kind === 'w') return model.fPart(c.j, breakpoints.get(c.j)![c.k]!);
    return 0;
  });
  const rowSign = constraints.map((c) => (c.relation === '>=' ? -1 : 1));
  const constraintRows = constraints.map((_, i) =>
    meta.map((c) => {
      if (c.kind === 'x') return rowSign[i]! * model.gPart(i, c.j, 1);
      if (c.kind === 'w') return rowSign[i]! * model.gPart(i, c.j, breakpoints.get(c.j)![c.k]!);
      return c.i === i ? 1 : 0;
    }),
  );
  const constraintRhs = constraints.map((_, i) => -rowSign[i]! * model.gZero[i]!);

  // Tabla: restricciones + filas de convexidad Σ_k w_jk = 1 (con w_j1 básica).
  const approximated = [...breakpoints.keys()].filter((j) => !linear[j]).sort((a, b) => a - b);
  const rows: Rational[][] = constraintRows.map((row) => row.map(toRational));
  const rhs: Rational[] = constraintRhs.map(toRational);
  const basis: number[] = constraints.map((_, i) =>
    meta.findIndex((c) => c.kind === 's' && c.i === i),
  );
  for (const j of approximated) {
    rows.push(meta.map((c) => (c.kind === 'w' && c.j === j ? Rational.ONE : Rational.ZERO)));
    rhs.push(Rational.ONE);
    basis.push(meta.findIndex((c) => c.kind === 'w' && c.j === j && c.k === 0));
  }
  // w_j1 básica: se elimina de las filas de restricciones.
  const convexityStart = m;
  approximated.forEach((_, q) => {
    const col = basis[convexityStart + q]!;
    for (let i = 0; i < m; i++) {
      const factor = rows[i]![col]!;
      if (factor.isZero()) continue;
      rows[i] = rows[i]!.map((v, c) => v.sub(factor.mul(rows[convexityStart + q]![c]!)));
      rhs[i] = rhs[i]!.sub(factor);
    }
  });

  const steps: Step[] = [];
  const modelLines = [
    `\\text{Objetivo: } z = ${
      meta
        .flatMap((c, col) =>
          c.kind === 's' || objectiveCoef[col] === 0
            ? []
            : [`${n(objectiveCoef[col]!)}\\,${columns[col]!.latex}`],
        )
        .join(' + ') || '0'
    }`,
    ...constraintRows.map(
      (row, i) =>
        `${row
          .flatMap((v, col) =>
            meta[col]!.kind === 's' || v === 0 ? [] : [`${n(v)}\\,${columns[col]!.latex}`],
          )
          .join(' + ')} \\le ${n(constraintRhs[i]!)}`,
    ),
    ...approximated.map(
      (j) =>
        `${breakpoints
          .get(j)!
          .map((_, k) => `w_{${j + 1}${k + 1}}`)
          .join(' + ')} = 1`,
    ),
  ];
  steps.push(
    ...approximated.map((j) => {
      const points = breakpoints.get(j)!;
      return {
        title: `Aproximación de x${j + 1} por tramos`,
        explanation: `Se usan los puntos de quiebre ${points.map((p) => formatNumber(p)).join(', ')}: x${j + 1} = Σ a·w y cada función de x${j + 1} se reemplaza por Σ f(a)·w.`,
        formula: `x_{${j + 1}} = \\sum_k a_{${j + 1}k}\\,w_{${j + 1}k}, \\qquad f_{${j + 1}}(x_{${j + 1}}) \\approx \\sum_k f_{${j + 1}}(a_{${j + 1}k})\\,w_{${j + 1}k}`,
        substitution: points
          .map(
            (a, k) =>
              `a_{${j + 1}${k + 1}} = ${n(a)}:\\ f = ${n(model.fPart(j, a))}${constraints
                .map((_, i) => `,\\ g_{${i + 1}} = ${n(model.gPart(i, j, a))}`)
                .join('')}`,
          )
          .join(' \\\\ '),
      };
    }),
    {
      title: 'Modelo lineal aproximado',
      explanation:
        'Las variables lineales se conservan; las aproximadas se reemplazan por sus pesos, que deben sumar 1.',
      substitution: modelLines.join(' \\\\ '),
    },
  );

  if (rhs.slice(0, m).some((v) => v.sign() < 0)) {
    return {
      ok: false,
      error: {
        code: 'infeasible-start',
        message:
          'Con el primer punto de quiebre de cada variable no se cumple alguna restricción: la solución inicial no es factible. Empieza los puntos de quiebre en un valor que cumpla las restricciones (normalmente 0).',
      },
      ...emptyTrace(),
      steps,
    };
  }

  const zRow = objectiveCoef.map((c) => new MValue(toRational(-sign * c)));
  const initial: Tableau = {
    columns,
    rows,
    rhs,
    basis,
    z: zRow,
    zRhs: MValue.ZERO,
    sense: 'max',
    objective: 'z',
  };
  const { tableau: start } = priceOut(initial);

  const admissible: Admissibility = (t, e, leavingRow) => {
    const entering = meta[e]!;
    if (entering.kind !== 'w') return null;
    const { tableau: after } = pivotTableau(t, leavingRow, e);
    const values = basicValues(after);
    const positive = after.basis
      .filter((b) => {
        const c = meta[b]!;
        return c.kind === 'w' && c.j === entering.j && (values[b]!.sign() > 0 || b === e);
      })
      .map((b) => (meta[b] as { k: number }).k)
      .sort((a, b) => a - b);
    const adjacent =
      positive.length <= 1 || (positive.length === 2 && positive[1]! - positive[0]! === 1);
    if (adjacent) return null;
    return `\\text{quedarían positivos } ${positive.map((k) => `w_{${entering.j + 1}${k + 1}}`).join(',\\ ')} \\text{, que no son adyacentes}`;
  };
  const run = runRestrictedSimplex(start, admissible);
  const trace = restrictedTrace(run, 'separable');
  steps.push(...trace.steps);
  if (run.status === 'unbounded') {
    return {
      ok: false,
      error: { code: 'unbounded', message: 'El modelo aproximado no está acotado.' },
      ...emptyTrace(),
      steps,
      tables: trace.tables,
    };
  }
  if (run.status === 'max-iterations') {
    return {
      ok: false,
      error: { code: 'max-iterations', message: 'Se alcanzó el máximo de iteraciones.' },
      ...emptyTrace(),
      steps,
      tables: trace.tables,
    };
  }

  const values = basicValues(run.final);
  const x = Array.from({ length: size }, (_, j) => {
    if (linear[j]) {
      const col = meta.findIndex((c) => c.kind === 'x' && c.j === j);
      return values[col]!.toNumber();
    }
    return breakpoints
      .get(j)!
      .reduce(
        (acc, a, k) =>
          acc +
          a * values[meta.findIndex((c) => c.kind === 'w' && c.j === j && c.k === k)]!.toNumber(),
        0,
      );
  });
  const approximateObjective =
    sign * run.final.zRhs.a.toNumber() + evaluateAt(model.f, new Array<number>(size).fill(0));
  const trueObjective = evaluateAt(model.f, x);
  const weights = approximated.flatMap((j) =>
    breakpoints.get(j)!.map((a, k) => ({
      variable: j + 1,
      breakpoint: a,
      weight: values[meta.findIndex((c) => c.kind === 'w' && c.j === j && c.k === k)]!.toNumber(),
    })),
  );

  steps.push({
    title: 'Solución aproximada',
    explanation:
      'Cada variable aproximada se recupera con x_j = Σ a_jk w_jk. El valor de la función original en ese punto puede diferir del objetivo aproximado; con más puntos de quiebre la aproximación mejora.',
    substitution: approximated
      .map(
        (j) =>
          `x_{${j + 1}} = ${breakpoints
            .get(j)!
            .map((a, k) => ({
              a,
              w: values[meta.findIndex((c) => c.kind === 'w' && c.j === j && c.k === k)]!,
            }))
            .filter(({ w }) => !w.isZero())
            .map(({ a, w }) => `${n(a)}(${w.toLatex()})`)
            .join(' + ')}`,
      )
      .join(' \\\\ '),
    result: `X \\approx \\left(${x.map((v) => n(v, 8)).join(',\\ ')}\\right), \\quad z_{\\text{aprox}} = ${n(approximateObjective, 8)}, \\quad f(X) = ${n(trueObjective, 8)}`,
  });

  return {
    ok: true,
    value: { x, weights, approximateObjective, trueObjective },
    summary: [
      {
        label: 'Solución aproximada',
        value: `X \\approx \\left(${x.map((v) => n(v, 6)).join(',\\ ')}\\right)`,
        emphasis: true,
      },
      { label: 'Objetivo aproximado', value: `z_{\\text{aprox}} = ${n(approximateObjective, 8)}` },
      { label: 'Función original en X', value: `f(X) = ${n(trueObjective, 8)}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      ...trace.tables,
      {
        id: 'pesos',
        title: 'Pesos de los puntos de quiebre',
        columns: [
          { key: 'variable', header: 'j' },
          { key: 'breakpoint', header: 'a_{jk}' },
          { key: 'weight', header: 'w_{jk}' },
        ],
        rows: weights.map((w): Record<string, CellValue> => ({ ...w })),
      },
    ],
    notices: [
      {
        level: 'info',
        message:
          'La base restringida garantiza solo un óptimo local del problema aproximado; si la función objetivo es cóncava (al maximizar) y las restricciones convexas, es global.',
      },
    ],
  };
}

export const separable: Calculator<SeparableInput, SeparableValue, SeparableErrorCode> = {
  meta: {
    id: 'programacion-separable',
    title: 'Programación separable',
    summary: 'Aproxima funciones separables por tramos lineales y resuelve con base restringida.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 21.2.1, Ejemplo 21.2-1 (10.ª ed.)' },
      { sourceId: 'hillier-lieberman-2002', locator: 'Sec. 13.8 (7.ª ed.)' },
      { sourceId: 'hadley-2000' },
    ],
  },
  inputSchema: separableInputSchema,
  // Taha, ejemplo 21.2-1: max z = x1 + x2⁴, 3x1 + 2x2² ≤ 9, con puntos de quiebre 0, 1, 2, 3.
  example: {
    sense: 'max',
    objective: 'x1 + x2^4',
    constraints: '3x1 + 2x2^2 <= 9',
    breakpoints: 'x2: 0, 1, 2, 3',
  },
  solve: solveSeparable,
};
