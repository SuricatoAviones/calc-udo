/**
 * Programación cuadrática por el método de Wolfe (Taha, sec. 21.2.2; Hillier & Lieberman,
 * sec. 13.7):
 *
 *   maximizar z = CX + XᵀDX   sujeto a   AX ≤ b,  X ≥ 0     (D simétrica y semidefinida negativa)
 *
 * Como z es cóncava y la región es convexa, las condiciones KKT son necesarias y suficientes. Con
 * λ (multiplicadores de AX ≤ b), μ (de −X ≤ 0) y las holguras S = b − AX, se reducen a
 *
 *   −2DX + Aᵀλ − μ = Cᵀ,     AX + S = b,     μ_j x_j = 0 = λ_i S_i,     X, λ, μ, S ≥ 0
 *
 * Las ecuaciones son lineales: se resuelven con la fase I del método de dos fases (artificiales R
 * en las primeras n filas, minimizando r = ΣR) y la base restringida: x_j no puede entrar si μ_j es
 * básica, ni λ_i si S_i es básica (y viceversa). Minimizar z equivale a maximizar −z.
 */
import { z } from 'zod';
import { Rational } from '@/lib/math/rational';
import { formatNumber, toLatexMatrix, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import { parseConstraintLine } from '../optimizacion-de-operaciones/lp-model';
import {
  MValue,
  priceOut,
  type Column,
  type Tableau,
} from '../optimizacion-de-operaciones/tableau';
import {
  classifyMatrix,
  evaluateAt,
  evaluateMatrix,
  evaluateVector,
  gradientOf,
  hessianOf,
  NLP_VARIABLES,
  parseNlpExpression,
} from './nlp';
import {
  basicValues,
  restrictedTrace,
  runRestrictedSimplex,
  toRational,
  type Admissibility,
} from './restricted-simplex';

export const wolfeInputSchema = z
  .object({
    sense: z.enum(['max', 'min'], { error: 'Elige si se maximiza o se minimiza.' }),
    objective: z
      .string()
      .trim()
      .min(1, 'Escribe la función objetivo cuadrática.')
      .max(300, 'La expresión es demasiado larga.'),
    constraints: z
      .string()
      .trim()
      .min(1, 'Escribe al menos una restricción.')
      .max(1500, 'Las restricciones son demasiado largas.'),
  })
  .superRefine((v, ctx) => {
    const model = readModel(v);
    if (typeof model === 'string') {
      const path =
        model.startsWith('Restricción') || model.startsWith('Las restricciones')
          ? 'constraints'
          : 'objective';
      ctx.addIssue({ code: 'custom', path: [path], message: model });
    }
  });

export type WolfeInput = z.infer<typeof wolfeInputSchema>;

interface QuadraticModel {
  n: number;
  names: string[];
  /** Para maximizar (si se minimiza, ya multiplicados por −1). */
  C: number[];
  D: number[][];
  A: Rational[][];
  b: Rational[];
}

const MAX_CONSTRAINTS = 8;

/** Lee el modelo: C y D de la función objetivo, A y b de las restricciones lineales. */
function readModel(v: {
  sense: 'max' | 'min';
  objective: string;
  constraints: string;
}): QuadraticModel | string {
  const parsed = parseNlpExpression(v.objective.replace(/^\s*(max|min)?\s*z\s*=/i, ''));
  if (!parsed.ok) return parsed.message;
  const lines = v.constraints
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !/^x\d(\s*,\s*x\d)*\s*>=\s*0$/.test(l.replace(/\s+/g, ' ')));
  if (lines.length === 0) return 'Las restricciones: escribe al menos una además de X ≥ 0.';
  if (lines.length > MAX_CONSTRAINTS) return `Las restricciones: el máximo es ${MAX_CONSTRAINTS}.`;
  let n = Math.max(parsed.maxIndex, 1);
  for (const line of lines) {
    const matches = [...line.matchAll(/x(\d)/g)].map((m) => Number(m[1]));
    n = Math.max(n, ...matches);
  }
  const names = NLP_VARIABLES.slice(0, n);
  const f = parsed.expr;
  const gradient = gradientOf(f, n);
  const hessian = hessianOf(f, n);
  if (!gradient || !hessian) return 'No se pudo derivar la función objetivo.';
  const zero = new Array<number>(n).fill(0);
  const probe = names.map((_, j) => 0.37 + 0.61 * j);
  const H0 = evaluateMatrix(hessian, zero);
  const H1 = evaluateMatrix(hessian, probe);
  if (
    H0.flat().some((v) => !Number.isFinite(v)) ||
    H0.some((row, i) => row.some((val, j) => Math.abs(val - H1[i]![j]!) > 1e-9))
  ) {
    return 'La función objetivo debe ser cuadrática: términos constantes, lineales y de grado 2.';
  }
  const sign = v.sense === 'max' ? 1 : -1;
  const C = evaluateVector(gradient, zero).map((c) => sign * c);
  const D = H0.map((row) => row.map((h) => (sign * h) / 2));
  if (!['definida negativa', 'semidefinida negativa', 'nula'].includes(classifyMatrix(D))) {
    return v.sense === 'max'
      ? 'La función objetivo debe ser cóncava (D semidefinida negativa) para que las condiciones KKT sean suficientes.'
      : 'La función objetivo debe ser convexa para minimizarla con este método.';
  }
  const A: Rational[][] = [];
  const b: Rational[] = [];
  for (const [index, line] of lines.entries()) {
    const constraint = parseConstraintLine(line, names);
    if (typeof constraint === 'string') return `Restricción ${index + 1}: ${constraint}.`;
    let coefficients = constraint.coefficients;
    let rhs = constraint.rhs;
    if (constraint.relation === '=') {
      return `Restricción ${index + 1}: el método de Wolfe usa restricciones AX ≤ b.`;
    }
    if (constraint.relation === '>=') {
      coefficients = coefficients.map((c) => c.neg());
      rhs = rhs.neg();
    }
    if (rhs.sign() < 0) {
      return `Restricción ${index + 1}: escríbela como AX ≤ b con b ≥ 0 (así las holguras forman la base inicial).`;
    }
    A.push(coefficients);
    b.push(rhs);
  }
  return { n, names, C, D, A, b };
}

export interface WolfeValue {
  x: number[];
  lambda: number[];
  mu: number[];
  z: number;
  iterations: number;
}

export type WolfeErrorCode = 'invalid-model' | 'infeasible' | 'max-iterations';

type Result = CalculatorResult<WolfeValue, WolfeErrorCode>;

const n = toLatexNumber;

export function solveWolfe(input: WolfeInput): Result {
  const model = readModel(input);
  if (typeof model === 'string') {
    return { ok: false, error: { code: 'invalid-model', message: model }, ...emptyTrace() };
  }
  const { n: size, C, D, A, b } = model;
  const m = A.length;
  const Cr = C.map(toRational);
  const minus2D = D.map((row) => row.map((d) => toRational(-2 * d)));

  const steps: Step[] = [
    {
      title: 'Forma matricial',
      explanation:
        input.sense === 'max'
          ? 'Se identifican C (coeficientes lineales) y D (la parte cuadrática, simétrica) de z = CX + XᵀDX.'
          : 'Minimizar z equivale a maximizar −z; C y D son los de −z.',
      formula: 'z = CX + X^{T} D X, \\qquad AX \\le b, \\qquad X \\ge 0',
      result: `C = ${toLatexMatrix([C])}, \\quad D = ${toLatexMatrix(D)}, \\quad A = ${toLatexMatrix(
        A.map((row) => row.map((a) => a.toNumber())),
      )}, \\quad b = ${toLatexMatrix(b.map((v) => [v.toNumber()]))}`,
    },
    {
      title: 'Condiciones KKT',
      explanation:
        'Como z es cóncava y las restricciones lineales, las condiciones KKT son suficientes. Son lineales salvo las de holgura complementaria.',
      formula:
        '\\begin{bmatrix} -2D & A^{T} & -I & 0 \\\\ A & 0 & 0 & I \\end{bmatrix} \\begin{bmatrix} X \\\\ \\lambda \\\\ \\mu \\\\ S \\end{bmatrix} = \\begin{bmatrix} C^{T} \\\\ b \\end{bmatrix}, \\qquad \\mu_j x_j = 0 = \\lambda_i S_i',
    },
  ];

  // Columnas: x, λ, μ, R, S.
  const columns: Column[] = [
    ...model.names.map((_, j) => ({
      name: `x${j + 1}`,
      latex: `x_{${j + 1}}`,
      kind: 'decision' as const,
    })),
    ...A.map((_, i) => ({
      name: `l${i + 1}`,
      latex: `\\lambda_{${i + 1}}`,
      kind: 'decision' as const,
    })),
    ...model.names.map((_, j) => ({
      name: `m${j + 1}`,
      latex: `\\mu_{${j + 1}}`,
      kind: 'surplus' as const,
    })),
    ...model.names.map((_, j) => ({
      name: `R${j + 1}`,
      latex: `R_{${j + 1}}`,
      kind: 'artificial' as const,
    })),
    ...A.map((_, i) => ({ name: `s${i + 1}`, latex: `S_{${i + 1}}`, kind: 'slack' as const })),
  ];
  const width = columns.length;
  const xCol = (j: number) => j;
  const lambdaCol = (i: number) => size + i;
  const muCol = (j: number) => size + m + j;
  const rCol = (j: number) => size + m + size + j;
  const sCol = (i: number) => size + m + 2 * size + i;

  const rows: Rational[][] = [];
  const rhs: Rational[] = [];
  for (let j = 0; j < size; j++) {
    const row = new Array<Rational>(width).fill(Rational.ZERO);
    const flip = Cr[j]!.sign() < 0 ? Rational.of(-1) : Rational.ONE;
    for (let k = 0; k < size; k++) row[xCol(k)] = minus2D[j]![k]!.mul(flip);
    for (let i = 0; i < m; i++) row[lambdaCol(i)] = A[i]![j]!.mul(flip);
    row[muCol(j)] = Rational.of(-1).mul(flip);
    row[rCol(j)] = Rational.ONE;
    rows.push(row);
    rhs.push(Cr[j]!.mul(flip));
  }
  for (let i = 0; i < m; i++) {
    const row = new Array<Rational>(width).fill(Rational.ZERO);
    for (let j = 0; j < size; j++) row[xCol(j)] = A[i]![j]!;
    row[sCol(i)] = Rational.ONE;
    rows.push(row);
    rhs.push(b[i]!);
  }
  const basis = [...model.names.map((_, j) => rCol(j)), ...A.map((_, i) => sCol(i))];
  const zRow = columns.map(
    (c) => new MValue(c.kind === 'artificial' ? Rational.of(-1) : Rational.ZERO),
  );
  const initial: Tableau = {
    columns,
    rows,
    rhs,
    basis,
    z: zRow,
    zRhs: MValue.ZERO,
    sense: 'min',
    objective: 'r',
  };
  const { tableau: start, operations } = priceOut(initial);
  steps.push({
    title: 'Tabla inicial de la fase I',
    explanation:
      'Se agrega una artificial R_j a cada una de las n primeras ecuaciones (si C_j < 0, antes se multiplica la fila por −1) y las holguras S_i son básicas en las restricciones. Se minimiza r = ΣR_j; la fila r se hace consistente con la base.',
    formula: '\\min r = \\sum_j R_j',
    substitution: operations.join(' \\\\ '),
  });

  const complement = (col: number): number | null => {
    if (col < size) return muCol(col);
    if (col < size + m) return sCol(col - size);
    if (col < size + m + size) return xCol(col - size - m);
    if (col >= size + m + 2 * size) return lambdaCol(col - size - m - 2 * size);
    return null;
  };
  const admissible: Admissibility = (t, e, leavingRow) => {
    const other = complement(e);
    if (other === null) return null;
    const row = t.basis.indexOf(other);
    if (row === -1 || row === leavingRow) return null;
    return `\\text{su complementaria } ${columns[other]!.latex} \\text{ está en la base}`;
  };
  const run = runRestrictedSimplex(start, admissible);
  const trace = restrictedTrace(run, 'wolfe');
  steps.push(...trace.steps);

  const final = run.final;
  const values = basicValues(final);
  const artificialLeft = final.zRhs.a;
  if (run.status !== 'optimal' || artificialLeft.sign() !== 0) {
    return {
      ok: false,
      error: {
        code: run.status === 'max-iterations' ? 'max-iterations' : 'infeasible',
        message:
          'La fase I terminó con artificiales positivas: no hay solución que cumpla las condiciones KKT (la región factible puede estar vacía).',
      },
      ...emptyTrace(),
      steps,
      tables: trace.tables,
    };
  }

  const x = model.names.map((_, j) => values[xCol(j)]!.toNumber());
  const lambda = A.map((_, i) => values[lambdaCol(i)]!.toNumber());
  const mu = model.names.map((_, j) => values[muCol(j)]!.toNumber());
  const objective = parseNlpExpression(input.objective.replace(/^\s*(max|min)?\s*z\s*=/i, ''));
  const zValue = objective.ok ? evaluateAt(objective.expr, x) : Number.NaN;
  steps.push({
    title: 'Solución óptima',
    explanation:
      'La fase I terminó con r = 0: la solución cumple todas las condiciones KKT, que aquí son suficientes.',
    result: `${model.names.map((_, j) => `x_{${j + 1}} = ${values[xCol(j)]!.toLatex()}`).join(',\\ ')}, \\qquad z = ${n(zValue)}`,
  });

  return {
    ok: true,
    value: { x, lambda, mu, z: zValue, iterations: run.iterations.length },
    summary: [
      {
        label: 'Solución óptima',
        value: model.names
          .map((_, j) => `x_{${j + 1}} = ${values[xCol(j)]!.toLatex()}`)
          .join(',\\ '),
        emphasis: true,
      },
      { label: 'Valor óptimo', value: `z = ${n(zValue, 8)}` },
      {
        label: 'Multiplicadores',
        value: A.map((_, i) => `\\lambda_{${i + 1}} = ${values[lambdaCol(i)]!.toLatex()}`).join(
          ',\\ ',
        ),
      },
    ],
    ...emptyTrace(),
    steps,
    tables: trace.tables,
    notices: [
      {
        level: 'info',
        message: `La fase I usó ${formatNumber(run.iterations.filter((it) => it.entering >= 0).length)} iteraciones con la regla de la base restringida.`,
      },
    ],
  };
}

export const wolfe: Calculator<WolfeInput, WolfeValue, WolfeErrorCode> = {
  meta: {
    id: 'metodo-de-wolfe',
    title: 'Método de Wolfe',
    summary: 'Resuelve programas cuadráticos con la fase I del simplex y base restringida.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 21.2.2, Ejemplo 21.2-3 (10.ª ed.)' },
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 13.7, método simplex modificado (7.ª ed.)',
      },
      { sourceId: 'bazaraa-1993' },
    ],
  },
  inputSchema: wolfeInputSchema,
  // Taha, ejemplo 21.2-3.
  example: {
    sense: 'max',
    objective: '4x1 + 6x2 - 2x1^2 - 2x1*x2 - 2x2^2',
    constraints: 'x1 + 2x2 <= 2',
  },
  solve: solveWolfe,
};
