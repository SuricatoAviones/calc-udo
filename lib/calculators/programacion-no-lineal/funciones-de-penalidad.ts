/**
 * Funciones de penalidad: técnica de minimización no restringida secuencial, SUMT (Hillier &
 * Lieberman, sec. 13.9; Taha, sec. 21.2.5). El problema restringido se reemplaza por una sucesión
 * de problemas sin restricciones con una función barrera B(x) que crece sin límite al acercarse a
 * la frontera de la región factible:
 *
 *   maximizar:  P(x; r) = f(x) − r·B(x)        minimizar:  P(x; r) = f(x) + r·B(x)
 *   B(x) = Σ_i 1/(b_i − g_i(x))  [restricciones ≤]  +  Σ_i 1/(g_i(x) − b_i)  [≥]  +  Σ_j 1/x_j  [x ≥ 0]
 *
 * y, para cada igualdad g_i(x) = b_i, el término [b_i − g_i(x)]²/√r (Hillier). Se parte de un
 * punto interior, se optimiza P para r, se reduce r ← θr (0 < θ < 1) y se repite desde el último
 * punto; cuando r → 0, los óptimos de P convergen a un óptimo del problema original. Si el
 * problema es convexo, r·B(x) acota el error en el valor de f.
 *
 * Cada problema sin restricciones se resuelve con Newton amortiguado: dirección −H⁻¹∇P (o el
 * gradiente si H no tiene la curvatura adecuada) y búsqueda en línea que no sale de la región.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { ParsedExpression } from '@/lib/math/expression';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
} from '../types';
import {
  clean,
  evaluateAt,
  evaluateMatrix,
  evaluateVector,
  gradientOf,
  hessianOf,
  parseConstraintList,
  parseNlpExpression,
  parsePoint,
  pointTex,
  solveDense,
  type NlpConstraint,
} from './nlp';

export const penaltyInputSchema = z
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
    nonNegative: z.enum(['si', 'no'], { error: 'Indica si las variables son no negativas.' }),
    start: z.string().trim().min(1, 'Escribe un punto inicial interior.'),
    r0: z
      .number({ error: 'Ingresa el valor inicial de r.' })
      .refine((v) => Number.isFinite(v) && v > 0, 'r debe ser mayor que 0.'),
    theta: z
      .number({ error: 'Ingresa el factor θ.' })
      .refine((v) => v > 0 && v < 1, 'θ debe estar entre 0 y 1.'),
    rounds: z
      .number({ error: 'Ingresa el número de valores de r.' })
      .int('Debe ser un número entero.')
      .min(1, 'Al menos 1.')
      .max(10, 'El máximo es 10.'),
  })
  .superRefine((v, ctx) => {
    const f = parseNlpExpression(v.objective);
    if (!f.ok) {
      ctx.addIssue({ code: 'custom', path: ['objective'], message: f.message });
      return;
    }
    const constraints = parseConstraintList(v.constraints);
    if (typeof constraints === 'string') {
      ctx.addIssue({ code: 'custom', path: ['constraints'], message: constraints });
      return;
    }
    const size = Math.max(f.maxIndex, ...constraints.map((c) => c.maxIndex), 1);
    const point = parsePoint(v.start, size);
    if (typeof point === 'string') {
      ctx.addIssue({ code: 'custom', path: ['start'], message: `El punto inicial: ${point}.` });
    }
  });

export type PenaltyInput = z.infer<typeof penaltyInputSchema>;

export interface PenaltyRound {
  r: number;
  point: number[];
  objective: number;
  barrier: number;
  iterations: number;
}

export interface PenaltyValue {
  rounds: PenaltyRound[];
  point: number[];
  objective: number;
}

export type PenaltyErrorCode = 'invalid-expression' | 'not-interior' | 'no-convergence';

type Result = CalculatorResult<PenaltyValue, PenaltyErrorCode>;

const n = toLatexNumber;

/** Distancias a la frontera: b − g (≤), g − b (≥) y x_j; todas deben ser > 0. */
function slacks(constraints: NlpConstraint[], x: number[], nonNegative: boolean): number[] {
  const values: number[] = [];
  for (const c of constraints) {
    const g = evaluateAt(c.g, x);
    if (c.relation === '<=') values.push(-g);
    else if (c.relation === '>=') values.push(g);
  }
  if (nonNegative) values.push(...x);
  return values;
}

interface Barrier {
  P: ParsedExpression;
  gradient: ParsedExpression[];
  hessian: ParsedExpression[][];
}

/** P(x; r) como expresión de mathjs, con su gradiente y hessiana simbólicos. */
function buildBarrier(
  sense: 'max' | 'min',
  objective: string,
  constraints: NlpConstraint[],
  nonNegative: boolean,
  r: number,
  size: number,
): Barrier | null {
  const terms: string[] = [];
  for (const c of constraints) {
    const g = c.g.node.toString();
    if (c.relation === '<=') terms.push(`1 / (-(${g}))`);
    else if (c.relation === '>=') terms.push(`1 / (${g})`);
  }
  if (nonNegative) for (let j = 1; j <= size; j++) terms.push(`1 / x${j}`);
  const equalities = constraints
    .filter((c) => c.relation === '=')
    .map((c) => `(${c.g.node.toString()})^2 / ${Math.sqrt(r)}`);
  const sign = sense === 'max' ? '-' : '+';
  const barrier = terms.length > 0 ? ` ${sign} ${r} * (${terms.join(' + ')})` : '';
  const penalty = equalities.length > 0 ? ` ${sign} (${equalities.join(' + ')})` : '';
  // Las derivadas de `log` salen como log(...): se reconstruye el texto con ln para el lector.
  const text = `(${objective})${barrier}${penalty}`.replace(/\blog\(/g, 'ln(');
  const parsed = parseNlpExpression(text);
  if (!parsed.ok) return null;
  const gradient = gradientOf(parsed.expr, size);
  const hessian = hessianOf(parsed.expr, size);
  if (!gradient || !hessian) return null;
  return { P: parsed.expr, gradient, hessian };
}

/** Optimiza P desde x (Newton amortiguado con búsqueda en línea que respeta la región). */
function optimize(
  barrier: Barrier,
  sense: 'max' | 'min',
  x0: number[],
  interior: (x: number[]) => boolean,
): { point: number[]; iterations: number; converged: boolean } {
  const better = (a: number, b: number) => (sense === 'max' ? a > b : a < b);
  let x = [...x0];
  let value = evaluateAt(barrier.P, x);
  for (let k = 0; k < 200; k++) {
    const grad = evaluateVector(barrier.gradient, x);
    const gnorm = Math.hypot(...grad);
    if (gnorm < 1e-10 * Math.max(1, Math.abs(value)))
      return { point: x, iterations: k, converged: true };
    const H = evaluateMatrix(barrier.hessian, x);
    let direction = solveDense(
      H,
      grad.map((g) => -g),
    );
    // La dirección de Newton debe mejorar P; si no, se usa el gradiente.
    const slope = direction ? direction.reduce((acc, d, j) => acc + d * grad[j]!, 0) : 0;
    if (!direction || (sense === 'max' ? slope <= 0 : slope >= 0)) {
      direction = sense === 'max' ? grad : grad.map((g) => -g);
    }
    let t = 1;
    let improved = false;
    for (let s = 0; s < 60; s++) {
      const candidate = x.map((v, j) => v + t * direction[j]!);
      if (interior(candidate)) {
        const candidateValue = evaluateAt(barrier.P, candidate);
        if (Number.isFinite(candidateValue) && better(candidateValue, value)) {
          const change = Math.hypot(...candidate.map((v, j) => v - x[j]!));
          x = candidate;
          value = candidateValue;
          improved = true;
          if (change < 1e-13 * Math.max(1, Math.hypot(...x))) {
            return { point: x, iterations: k + 1, converged: true };
          }
          break;
        }
      }
      t /= 2;
    }
    if (!improved) return { point: x, iterations: k, converged: gnorm < 1e-6 };
  }
  return { point: x, iterations: 200, converged: false };
}

export function solvePenalty(input: PenaltyInput): Result {
  const { sense, objective, r0, theta, rounds: count } = input;
  const nonNegative = input.nonNegative === 'si';
  const parsedF = parseNlpExpression(objective);
  const parsedG = parseConstraintList(input.constraints);
  if (!parsedF.ok || typeof parsedG === 'string') {
    return {
      ok: false,
      error: {
        code: 'invalid-expression',
        message: parsedF.ok ? String(parsedG) : parsedF.message,
      },
      ...emptyTrace(),
    };
  }
  const constraints = parsedG;
  const size = Math.max(parsedF.maxIndex, ...constraints.map((c) => c.maxIndex), 1);
  const start = parsePoint(input.start, size) as number[];
  const interior = (x: number[]) => slacks(constraints, x, nonNegative).every((s) => s > 0);

  const barrierTerms = [
    ...constraints.flatMap((c) =>
      c.relation === '<='
        ? [`\\frac{1}{-\\left(${c.g.tex}\\right)}`]
        : c.relation === '>='
          ? [`\\frac{1}{${c.g.tex}}`]
          : [],
    ),
    ...(nonNegative ? Array.from({ length: size }, (_, j) => `\\frac{1}{x_{${j + 1}}}`) : []),
  ];
  const equalityTerms = constraints
    .filter((c) => c.relation === '=')
    .map((c) => `\\frac{\\left(${c.g.tex}\\right)^2}{\\sqrt{r}}`);
  const sign = sense === 'max' ? '-' : '+';
  const steps: Step[] = [
    {
      title: 'Función barrera',
      explanation:
        'Cada término crece sin límite cuando el punto se acerca a la frontera de una restricción (o a xⱼ = 0), así que la búsqueda nunca sale de la región factible.',
      formula: `P(x; r) = f(x) ${sign} r\\,B(x)`,
      result: `P(x; r) = ${parsedF.expr.tex} ${barrierTerms.length > 0 ? `${sign} r\\left(${barrierTerms.join(' + ')}\\right)` : ''}${equalityTerms.length > 0 ? ` ${sign} ${equalityTerms.join(` ${sign} `)}` : ''}`,
    },
  ];

  if (!interior(start)) {
    steps.push({
      title: 'Punto inicial',
      explanation:
        'El punto inicial debe ser interior: cumplir las desigualdades en forma estricta (y xⱼ > 0 si las variables son no negativas).',
      result: `X_0 = ${pointTex(start)} \\ \\text{no es interior}`,
    });
    return {
      ok: false,
      error: {
        code: 'not-interior',
        message:
          'El punto inicial no es interior: debe cumplir las desigualdades en forma estricta.',
      },
      ...emptyTrace(),
      steps,
    };
  }

  const history: PenaltyRound[] = [];
  let x = start;
  let r = r0;
  for (let k = 0; k < count; k++) {
    const barrier = buildBarrier(sense, objective, constraints, nonNegative, r, size);
    if (!barrier) {
      return {
        ok: false,
        error: { code: 'invalid-expression', message: 'No se pudo derivar la función barrera.' },
        ...emptyTrace(),
        steps,
      };
    }
    const result = optimize(barrier, sense, x, interior);
    if (!result.converged) {
      steps.push({
        title: `r = ${formatNumber(r)}`,
        explanation: 'La búsqueda no convergió para este valor de r.',
        result: `x = ${pointTex(result.point, 8)}`,
      });
      return {
        ok: false,
        error: {
          code: 'no-convergence',
          message: `No se encontró el óptimo de P(x; r) con r = ${formatNumber(r)}. Prueba otro punto inicial o un r inicial mayor.`,
        },
        ...emptyTrace(),
        steps,
      };
    }
    x = result.point;
    const barrierValue = slacks(constraints, x, nonNegative).reduce((acc, s) => acc + 1 / s, 0);
    const fx = evaluateAt(parsedF.expr, x);
    history.push({
      r,
      point: x,
      objective: fx,
      barrier: barrierValue,
      iterations: result.iterations,
    });
    steps.push({
      title: `Iteración ${k + 1}: r = ${formatNumber(r)}`,
      explanation: `Se ${sense === 'max' ? 'maximiza' : 'minimiza'} P(x; ${formatNumber(r)}) partiendo del punto anterior (${result.iterations} pasos de Newton).`,
      result: `x^{(${k + 1})} = ${pointTex(x, 6)}, \\quad f = ${n(fx, 8)}, \\quad r\\,B(x) = ${n(r * barrierValue, 6)}`,
    });
    r *= theta;
  }

  const last = history.at(-1)!;
  steps.push({
    title: 'Estimación del óptimo',
    explanation:
      'Al reducir r, P(x; r) se acerca a f(x) y la sucesión de puntos converge a un óptimo del problema. Si el problema es convexo, r·B(x) acota el error en el valor de f.',
    result: `x^* \\approx ${pointTex(last.point, 6)}, \\qquad f(x^*) \\approx ${n(last.objective, 8)}`,
  });

  const series: Series[] =
    size >= 1
      ? [
          {
            id: 'trayectoria',
            title: 'Valor de f en cada iteración',
            xLabel: 'Iteración',
            yLabel: 'f(x)',
            points: history.map((h, k) => ({ x: k + 1, y: h.objective })),
          },
        ]
      : [];

  return {
    ok: true,
    value: { rounds: history, point: last.point.map(clean), objective: last.objective },
    summary: [
      {
        label: 'Óptimo aproximado',
        value: `x^* \\approx ${pointTex(last.point, 6)}`,
        emphasis: true,
      },
      { label: 'Valor de la función', value: `f(x^*) \\approx ${n(last.objective, 8)}` },
      { label: 'Último r', value: `r = ${n(last.r)}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'iteraciones',
        title: 'Sucesión de problemas sin restricciones',
        columns: [
          { key: 'k', header: 'k' },
          { key: 'r', header: 'r' },
          ...Array.from({ length: size }, (_, j) => ({ key: `x${j}`, header: `x_{${j + 1}}` })),
          { key: 'f', header: 'f(x)' },
          { key: 'bound', header: 'r\\,B(x)' },
        ],
        rows: history.map((h, k) => ({
          k: k + 1,
          r: h.r,
          ...Object.fromEntries(h.point.map((v, j) => [`x${j}`, v])),
          f: h.objective,
          bound: h.r * h.barrier,
        })),
      },
    ],
    series,
  };
}

export const penalty: Calculator<PenaltyInput, PenaltyValue, PenaltyErrorCode> = {
  meta: {
    id: 'funciones-de-penalidad',
    title: 'Funciones de penalidad',
    summary:
      'Convierte un problema restringido en una sucesión de problemas sin restricciones (SUMT).',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 13.9, SUMT, ejemplo de la tabla 13.6 (7.ª ed.)',
      },
      { sourceId: 'taha', locator: 'Sec. 21.2.5, algoritmo SUMT (10.ª ed.)' },
      { sourceId: 'rao-1999' },
    ],
  },
  inputSchema: penaltyInputSchema,
  // Hillier, sec. 13.9: maximizar x1 x2 con x1² + x2 ≤ 3, x ≥ 0, desde (1, 1), r = 1 y θ = 0.01.
  example: {
    sense: 'max',
    objective: 'x1*x2',
    constraints: 'x1^2 + x2 <= 3',
    nonNegative: 'si',
    start: '1, 1',
    r0: 1,
    theta: 0.01,
    rounds: 3,
  },
  solve: solvePenalty,
};
