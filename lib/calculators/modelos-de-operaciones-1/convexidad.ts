/**
 * Convexidad y concavidad de una función (Hillier & Lieberman, apéndice 2; Taha, sec. 20.2.2,
 * tabla 20.2). Si f tiene segundas derivadas:
 *
 * - una variable: f es convexa si f″(x) ≥ 0 para todo x (estrictamente si f″ > 0) y cóncava si
 *   f″(x) ≤ 0;
 * - varias variables: f es convexa si su hessiana es semidefinida positiva en todo punto
 *   (estrictamente convexa si es definida positiva) y cóncava si es semidefinida negativa. Con dos
 *   variables, el criterio de la tabla A2.1 de Hillier mira f₁₁f₂₂ − f₁₂², f₁₁ y f₂₂.
 *
 * Si la hessiana es constante (funciones cuadráticas o lineales), la clasificación es exacta. Si
 * no, se evalúa en una malla de puntos de la región indicada: el resultado vale para esa región y
 * se informa un punto que lo contradiga si lo hay.
 */
import { z } from 'zod';
import { parseFunction, type ParsedExpression } from '@/lib/math/expression';
import { formatNumber, toLatexMatrix, toLatexNumber, TEX } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Step,
} from '../types';
import {
  classifyMatrix,
  evaluateMatrix,
  expressionMatrixTex,
  hessianOf,
  leadingMinors,
  NLP_HINT,
  parseNlpExpression,
  pointTex,
  type Definiteness,
} from '../programacion-no-lineal/nlp';

const MAX_VARIABLES = 4;

/** Lee f(x) (una variable) o f(x1, …, x4). Devuelve la expresión y el número de variables. */
function readFunction(
  text: string,
): { expr: ParsedExpression; size: number; single: boolean } | string {
  const single = parseFunction(text, 'x');
  if (single.ok) {
    // Se reescribe en x1 para usar el mismo núcleo.
    const asX1 = parseNlpExpression(text.replace(/\bx\b/g, 'x1'));
    if (!asX1.ok) return asX1.message;
    return { expr: asX1.expr, size: 1, single: true };
  }
  const multi = parseNlpExpression(text);
  if (!multi.ok) return `${multi.message} ${NLP_HINT}`;
  if (multi.maxIndex > MAX_VARIABLES) return `El máximo es ${MAX_VARIABLES} variables.`;
  return { expr: multi.expr, size: Math.max(1, multi.maxIndex), single: false };
}

export const convexityInputSchema = z
  .object({
    expression: z
      .string()
      .trim()
      .min(1, 'Escribe la función.')
      .max(300, 'La expresión es demasiado larga.')
      .superRefine((text, ctx) => {
        const parsed = readFunction(text);
        if (typeof parsed === 'string') ctx.addIssue({ code: 'custom', message: parsed });
      }),
    lower: z
      .number({ error: 'Ingresa el límite inferior de la región.' })
      .refine(Number.isFinite, 'El límite debe ser un número finito.'),
    upper: z
      .number({ error: 'Ingresa el límite superior de la región.' })
      .refine(Number.isFinite, 'El límite debe ser un número finito.'),
  })
  .refine((v) => v.upper > v.lower, {
    message: 'El límite superior debe ser mayor que el inferior.',
    path: ['upper'],
  });

export type ConvexityInput = z.infer<typeof convexityInputSchema>;

export type ConvexityClass =
  | 'estrictamente convexa'
  | 'convexa'
  | 'estrictamente cóncava'
  | 'cóncava'
  | 'convexa y cóncava (lineal)'
  | 'ni convexa ni cóncava';

export interface ConvexityValue {
  classification: ConvexityClass;
  /** `true` si la hessiana es constante y el resultado vale en todo el dominio. */
  exact: boolean;
  /** Punto que contradice la convexidad o la concavidad, si lo hay. */
  counterexample: number[] | null;
  pointsChecked: number;
}

export type ConvexityErrorCode = 'invalid-expression' | 'non-finite';

type Result = CalculatorResult<ConvexityValue, ConvexityErrorCode>;

const n = toLatexNumber;

function combine(classes: Definiteness[]): ConvexityClass {
  const all = (allowed: Definiteness[]) => classes.every((c) => allowed.includes(c));
  if (all(['nula'])) return 'convexa y cóncava (lineal)';
  if (all(['definida positiva'])) return 'estrictamente convexa';
  if (all(['definida negativa'])) return 'estrictamente cóncava';
  if (all(['definida positiva', 'semidefinida positiva', 'nula'])) return 'convexa';
  if (all(['definida negativa', 'semidefinida negativa', 'nula'])) return 'cóncava';
  return 'ni convexa ni cóncava';
}

/** Región [lower, upper]^size donde se verifica la curvatura. */
interface Region {
  lower: number;
  upper: number;
  size: number;
  single: boolean;
}

/** «[0, 2]» o «[0, 2]^3». */
function regionText({ lower, upper, size }: Region): string {
  const power = size > 1 ? `^${size}` : '';
  return `[${formatNumber(lower)}, ${formatNumber(upper)}]${power}`;
}

function regionTex({ lower, upper, size }: Region): string {
  const power = size > 1 ? `^{${size}}` : '';
  return String.raw`\text{en } [${n(lower)}, ${n(upper)}]${power}`;
}

/** Puntos por eje de la malla: más finos con menos variables. */
function pointsPerAxis(size: number): number {
  if (size === 1) return 401;
  if (size === 2) return 41;
  return size === 3 ? 15 : 9;
}

/** Hessiana constante: se clasifica una sola vez y vale en todo el dominio. */
function constantCase(
  H: number[][],
  single: boolean,
): { classification: ConvexityClass; step: Step } {
  const definiteness = classifyMatrix(H);
  const classification = combine([definiteness]);
  const minors = leadingMinors(H)
    .map((d, k) => String.raw`\Delta_{${k + 1}} = ${n(d)}`)
    .join(TEX.listSep);
  return {
    classification,
    step: {
      title: 'La hessiana es constante',
      explanation:
        'La función es cuadrática (o lineal): la hessiana es la misma en todo punto, así que basta clasificarla una vez y el resultado vale en todo el dominio.',
      substitution: single
        ? `f''(x) = ${n(H[0]![0]!)}`
        : String.raw`H = ${toLatexMatrix(H)}, \quad ${minors}`,
      result: String.raw`H \text{ es ${definiteness}} \ \Rightarrow\ f \text{ es ${classification}}`,
    },
  };
}

interface GridScan {
  classes: Definiteness[];
  /** Primer punto con curvatura positiva (o indefinida) y primero con negativa. */
  positiveWitness: number[] | null;
  negativeWitness: number[] | null;
}

/** Clasifica la hessiana en cada punto de la malla de la región. */
function scanGrid(hessian: ParsedExpression[][], region: Region): GridScan {
  const { lower, upper, size } = region;
  const perAxis = pointsPerAxis(size);
  const axis = Array.from(
    { length: perAxis },
    (_, k) => lower + ((upper - lower) * k) / (perAxis - 1),
  );
  const scan: GridScan = { classes: [], positiveWitness: null, negativeWitness: null };
  const visit = (point: number[]) => {
    const H = evaluateMatrix(hessian, point);
    if (!H.flat().every(Number.isFinite)) return;
    const definiteness = classifyMatrix(H);
    scan.classes.push(definiteness);
    const indefinite = definiteness === 'indefinida';
    if (indefinite || definiteness.includes('positiva')) scan.positiveWitness ??= point;
    if (indefinite || definiteness.includes('negativa')) scan.negativeWitness ??= point;
  };
  const recurse = (prefix: number[]) => {
    if (prefix.length === size) {
      visit(prefix);
      return;
    }
    for (const v of axis) recurse([...prefix, v]);
  };
  recurse([]);
  return scan;
}

/** La curvatura cambia de signo: se muestran un punto de cada signo. */
function signChangeStep(hessian: ParsedExpression[][], region: Region, scan: GridScan): Step {
  const { single } = region;
  return {
    title: 'Curvatura en la región',
    explanation: `Se evaluó la ${single ? 'segunda derivada' : 'hessiana'} en ${scan.classes.length} puntos de ${regionText(region)}: cambia de signo, así que la función no es convexa ni cóncava en la región.`,
    substitution: [scan.positiveWitness, scan.negativeWitness]
      .filter((p): p is number[] => p !== null)
      .map((p) => {
        const H = evaluateMatrix(hessian, p);
        return single
          ? `f''(${n(p[0]!, 6)}) = ${n(H[0]![0]!, 6)}`
          : String.raw`H${pointTex(p, 4)} = ${toLatexMatrix(H, 4)} \ (\text{${classifyMatrix(H)}})`;
      })
      .join(String.raw` \\ `),
  };
}

/** La hessiana en los extremos y el centro de la región, para la tabla. */
function sampleRows(hessian: ParsedExpression[][], region: Region): Record<string, CellValue>[] {
  const { lower, upper, size } = region;
  const sample = [
    Array.from({ length: size }, () => lower),
    Array.from({ length: size }, () => (lower + upper) / 2),
    Array.from({ length: size }, () => upper),
  ];
  const rows: Record<string, CellValue>[] = [];
  for (const p of sample) {
    const H = evaluateMatrix(hessian, p);
    if (!H.flat().every(Number.isFinite)) continue;
    rows.push({
      point: p.map((v) => formatNumber(v, 6)).join(', '),
      minors: leadingMinors(H)
        .map((d) => formatNumber(d, 6))
        .join('; '),
      definiteness: classifyMatrix(H),
    });
  }
  return rows;
}

/** f″(x) con una variable o la hessiana con varias, y el criterio de convexidad. */
function hessianStep(hessian: ParsedExpression[][], single: boolean): Step {
  if (single) {
    return {
      title: 'Segunda derivada',
      explanation: 'f es convexa si f″(x) ≥ 0 en todo punto y cóncava si f″(x) ≤ 0.',
      formula: String.raw`f''(x) = \frac{d^2 f}{dx^2}`,
      result: `f''(x) = ${hessian[0]![0]!.tex}`.replaceAll('x_{1}', 'x'),
    };
  }
  return {
    title: 'Matriz hessiana',
    explanation:
      'f es convexa si la hessiana es semidefinida positiva en todo punto y cóncava si es semidefinida negativa.',
    formula: String.raw`H = \left[\frac{\partial^2 f}{\partial x_{1}\,\partial x_{2}}\right]`,
    result: `H = ${expressionMatrixTex(hessian)}`,
  };
}

/** Las matrices son finitas e iguales entre sí (hasta 1e-9). */
function isConstantMatrix(matrices: number[][][]): boolean {
  const first = matrices[0]!;
  return (
    matrices.every((H) => H.flat().every(Number.isFinite)) &&
    matrices.every((H) =>
      H.every((row, i) => row.every((v, j) => Math.abs(v - first[i]![j]!) < 1e-9)),
    )
  );
}

export function solveConvexity({ expression, lower, upper }: ConvexityInput): Result {
  const parsed = readFunction(expression);
  if (typeof parsed === 'string') {
    return { ok: false, error: { code: 'invalid-expression', message: parsed }, ...emptyTrace() };
  }
  const { expr, size, single } = parsed;
  const hessian = hessianOf(expr, size);
  if (!hessian) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: 'No se pudo derivar la función.' },
      ...emptyTrace(),
    };
  }
  const steps: Step[] = [hessianStep(hessian, single)];

  // ¿Hessiana constante? Se compara en varios puntos.
  const probes = [0, 0.37, -1.3, 2.9].map((v) =>
    Array.from({ length: size }, (_, j) => v + 0.41 * j),
  );
  const evaluated = probes.map((p) => evaluateMatrix(hessian, p));
  const constant = isConstantMatrix(evaluated);

  let classification: ConvexityClass;
  let counterexample: number[] | null = null;
  let pointsChecked = 1;
  let rows: Record<string, CellValue>[] = [];

  if (constant) {
    const fixed = constantCase(evaluated[0]!, single);
    classification = fixed.classification;
    steps.push(fixed.step);
  } else {
    const region = { lower, upper, size, single };
    const scan = scanGrid(hessian, region);
    pointsChecked = scan.classes.length;
    if (scan.classes.length === 0) {
      return {
        ok: false,
        error: {
          code: 'non-finite',
          message: 'La segunda derivada no es un número real en la región indicada.',
        },
        ...emptyTrace(),
        steps,
      };
    }
    classification = combine(scan.classes);
    if (classification === 'ni convexa ni cóncava') {
      // Un punto donde la curvatura es positiva y otro donde es negativa (o uno indefinido).
      counterexample = scan.positiveWitness;
      steps.push(signChangeStep(hessian, region, scan));
    } else {
      steps.push({
        title: 'Curvatura en la región',
        explanation: `La ${single ? 'segunda derivada' : 'hessiana'} no es constante. Se evaluó en una malla de ${scan.classes.length} puntos de ${regionText(region)} y en todos tiene el mismo signo: la función es ${classification} en esa región (verificación numérica).`,
        result: String.raw`f \text{ es ${classification} en la región}`,
      });
    }
    rows = sampleRows(hessian, region);
  }

  return {
    ok: true,
    value: { classification, exact: constant, counterexample, pointsChecked },
    summary: [
      {
        label: 'Clasificación',
        value: String.raw`\text{${classification}}`,
        emphasis: true,
      },
      {
        label: 'Alcance',
        value: constant
          ? String.raw`\text{en todo el dominio (hessiana constante)}`
          : regionTex({ lower, upper, size, single }),
      },
    ],
    ...emptyTrace(),
    steps,
    tables:
      rows.length > 0
        ? [
            {
              id: 'muestra',
              title: 'Hessiana en algunos puntos de la región',
              columns: [
                { key: 'point', header: String.raw`\text{Punto}`, format: 'text' },
                { key: 'minors', header: String.raw`\Delta_1;\ \Delta_2;\ \ldots`, format: 'text' },
                { key: 'definiteness', header: String.raw`\text{Hessiana}`, format: 'text' },
              ],
              rows,
            },
          ]
        : [],
    notices: constant
      ? []
      : [
          {
            level: 'info',
            message:
              'La hessiana depende del punto: la clasificación se verificó numéricamente en la región indicada. Amplía la región si te interesa otro dominio.',
          },
        ],
  };
}

export const convexity: Calculator<ConvexityInput, ConvexityValue, ConvexityErrorCode> = {
  meta: {
    id: 'convexidad',
    title: 'Convexidad y concavidad de una función',
    summary: 'Clasifica una función a partir de su segunda derivada o su matriz hessiana.',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Apéndice 2, convexidad, tabla A2.1 (7.ª ed.)',
      },
      { sourceId: 'taha', locator: 'Sec. 20.2.2, tabla 20.2 (10.ª ed.)' },
      { sourceId: 'bazaraa-1993' },
    ],
  },
  inputSchema: convexityInputSchema,
  // Hillier, apéndice 2: f(x1, x2) = x1⁴ + 3x1² − 5x1 + 2x1x2 + x2², suma de dos convexas.
  example: { expression: 'x1^4 + 3x1^2 - 5x1 + 2x1*x2 + x2^2', lower: -10, upper: 10 },
  solve: solveConvexity,
};
