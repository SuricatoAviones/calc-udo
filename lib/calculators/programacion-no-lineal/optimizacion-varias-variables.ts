/**
 * Optimización no restringida de varias variables (Taha, secs. 20.1.1 y 20.1.2; Hillier &
 * Lieberman, sec. 13.5):
 *
 * - Condición necesaria: ∇f(X₀) = 0. Los puntos que la cumplen son estacionarios.
 * - Condición suficiente (Taha, teorema 20.1-2): si la hessiana H(X₀) es definida positiva, X₀ es
 *   un mínimo; si es definida negativa, un máximo; si es indefinida, un punto de silla. Se decide
 *   por los menores principales dominantes Δ₁, …, Δₙ (todos positivos: definida positiva;
 *   alternados empezando negativo: definida negativa).
 *
 * El sistema ∇f = 0 se resuelve con el método de Newton-Raphson de Taha (sec. 20.1.2):
 * X_{k+1} = X_k − H(X_k)⁻¹ ∇f(X_k), que llega en un paso si f es cuadrática.
 */
import { z } from 'zod';
import { formatNumber, toLatexMatrix, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
} from '../types';
import {
  classifyMatrix,
  clean,
  evaluateAt,
  evaluateMatrix,
  evaluateVector,
  expressionMatrixTex,
  expressionVectorTex,
  gradientOf,
  hessianOf,
  leadingMinors,
  newtonSystem,
  NLP_VARIABLES,
  parseNlpExpression,
  parsePoint,
  pointTex,
  pointText,
  type Definiteness,
} from './nlp';

export const multiVariableInputSchema = z
  .object({
    expression: z
      .string()
      .trim()
      .min(1, 'Escribe la función f(x1, x2, …).')
      .max(300, 'La expresión es demasiado larga.'),
    start: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    const parsed = parseNlpExpression(v.expression);
    if (!parsed.ok) {
      ctx.addIssue({ code: 'custom', path: ['expression'], message: parsed.message });
      return;
    }
    if (parsed.maxIndex < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['expression'],
        message:
          'La función debe depender de al menos x1 y x2 (para una variable usa la otra calculadora).',
      });
      return;
    }
    if (v.start) {
      const point = parsePoint(v.start, parsed.maxIndex);
      if (typeof point === 'string') {
        ctx.addIssue({ code: 'custom', path: ['start'], message: `El punto inicial: ${point}.` });
      }
    }
  });

export type MultiVariableInput = z.infer<typeof multiVariableInputSchema>;

export type MultiVariableKind =
  'mínimo local' | 'máximo local' | 'punto de silla' | 'no concluyente';

export interface MultiVariableValue {
  point: number[];
  value: number;
  gradientNorm: number;
  hessian: number[][];
  minors: number[];
  definiteness: Definiteness;
  kind: MultiVariableKind;
  iterations: number;
}

export type MultiVariableErrorCode = 'invalid-expression' | 'no-convergence';

type Result = CalculatorResult<MultiVariableValue, MultiVariableErrorCode>;

const n = toLatexNumber;

const KIND: Record<Definiteness, MultiVariableKind> = {
  'definida positiva': 'mínimo local',
  'definida negativa': 'máximo local',
  indefinida: 'punto de silla',
  'semidefinida positiva': 'no concluyente',
  'semidefinida negativa': 'no concluyente',
  nula: 'no concluyente',
};

export function solveMultiVariable({ expression, start }: MultiVariableInput): Result {
  const parsed = parseNlpExpression(expression);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: parsed.message },
      ...emptyTrace(),
    };
  }
  const f = parsed.expr;
  const size = Math.max(parsed.maxIndex, 2);
  const gradient = gradientOf(f, size);
  const hessian = hessianOf(f, size);
  if (!gradient || !hessian) {
    return {
      ok: false,
      error: {
        code: 'invalid-expression',
        message: 'No se pudo derivar la función simbólicamente.',
      },
      ...emptyTrace(),
    };
  }
  const names = NLP_VARIABLES.slice(0, size);
  const steps: Step[] = [
    {
      title: 'Gradiente (condición necesaria)',
      explanation: 'En un extremo todas las derivadas parciales se anulan: ∇f(X₀) = 0.',
      formula: `\\nabla f = \\left(${names.map((_, j) => `\\frac{\\partial f}{\\partial x_{${j + 1}}}`).join(',\\ ')}\\right)`,
      result: `\\nabla f = ${expressionVectorTex(gradient)} = \\mathbf{0}`,
    },
    {
      title: 'Matriz hessiana',
      formula: 'H = \\left[\\frac{\\partial^2 f}{\\partial x_i \\partial x_j}\\right]',
      result: `H = ${expressionMatrixTex(hessian)}`,
    },
  ];

  const x0 = start ? (parsePoint(start, size) as number[]) : new Array<number>(size).fill(0);
  const newton = newtonSystem(
    (x) => evaluateVector(gradient, x),
    (x) => evaluateMatrix(hessian, x),
    x0,
  );
  steps.push({
    title: 'Resolver ∇f = 0 (Newton-Raphson)',
    explanation:
      'Se parte del punto inicial y se aplica X_{k+1} = X_k − H(X_k)⁻¹∇f(X_k). Si f es cuadrática, ∇f es lineal y basta un paso.',
    formula: 'X_{k+1} = X_k - H(X_k)^{-1}\\,\\nabla f(X_k)',
    substitution: `X_0 = ${pointTex(x0)}`,
    children: newton.iterations.slice(0, 15).map((it, k) => ({
      title: `Iteración ${k + 1}`,
      result: `X_{${k + 1}} = ${pointTex(it.point, 8)}, \\quad \\lVert \\nabla f \\rVert = ${n(it.residual, 4)}`,
    })),
  });
  if (!newton.converged) {
    return {
      ok: false,
      error: {
        code: 'no-convergence',
        message:
          newton.failure === 'singular'
            ? `La hessiana es singular en ${pointText(newton.point)}: Newton no puede continuar. Prueba otro punto inicial.`
            : 'Newton no encontró un punto con ∇f = 0 desde este punto inicial. Prueba otro punto inicial más cerca del extremo.',
      },
      ...emptyTrace(),
      steps,
    };
  }

  const point = newton.point.map(clean);
  const value = evaluateAt(f, point);
  const gradientNorm = Math.hypot(...evaluateVector(gradient, point));
  const H = evaluateMatrix(hessian, point).map((row) => row.map(clean));
  const minors = leadingMinors(H).map(clean);
  const definiteness = classifyMatrix(H);
  const kind = KIND[definiteness];

  steps.push(
    {
      title: 'Punto estacionario',
      result: `X_0 = ${pointTex(point, 8)}, \\qquad f(X_0) = ${n(value)}`,
    },
    {
      title: 'Hessiana en el punto y menores principales',
      explanation:
        'Δₖ es el determinante de la submatriz formada por las primeras k filas y columnas de H(X₀).',
      formula: '\\Delta_k = \\det\\left[h_{ij}\\right]_{i,j \\le k}',
      substitution: `H(X_0) = ${toLatexMatrix(H)}`,
      result: minors.map((d, k) => `\\Delta_{${k + 1}} = ${n(d, 8)}`).join(',\\ '),
    },
    {
      title: 'Condición suficiente',
      explanation:
        definiteness === 'definida positiva'
          ? 'Todos los menores dominantes son positivos: H es definida positiva y X₀ es un mínimo.'
          : definiteness === 'definida negativa'
            ? 'Los menores dominantes alternan de signo empezando negativo: H es definida negativa y X₀ es un máximo.'
            : definiteness === 'indefinida'
              ? 'H es indefinida (no es semidefinida positiva ni negativa): X₀ es un punto de silla.'
              : `H es ${definiteness}: el criterio de la segunda derivada no concluye; habría que estudiar términos de orden superior.`,
      result: `\\text{${kind}}`,
    },
  );

  const series: Series[] = [];
  if (newton.iterations.length > 0) {
    series.push({
      id: 'convergencia',
      title: 'Norma del gradiente en cada iteración',
      xLabel: 'Iteración',
      yLabel: '‖∇f‖',
      yScale: 'log',
      points: newton.iterations
        .map((it, k) => ({ x: k + 1, y: it.residual }))
        .filter((p) => p.y > 0),
    });
  }

  return {
    ok: true,
    value: {
      point,
      value,
      gradientNorm,
      hessian: H,
      minors,
      definiteness,
      kind,
      iterations: newton.iterations.length,
    },
    summary: [
      { label: 'Punto estacionario', value: `X_0 = ${pointTex(point, 8)}`, emphasis: true },
      { label: 'Tipo', value: `\\text{${kind}}` },
      { label: 'Valor de la función', value: `f(X_0) = ${n(value, 8)}` },
      { label: 'Hessiana', value: `\\text{${definiteness}}` },
    ],
    ...emptyTrace(),
    steps,
    series,
    notices: [
      {
        level: 'info',
        message: `Newton encuentra el punto estacionario más cercano al punto inicial ${pointText(x0)}; si la función tiene varios, prueba otros puntos iniciales. ${formatNumber(newton.iterations.length)} iteración(es).`,
      },
    ],
  };
}

export const multiVariable: Calculator<
  MultiVariableInput,
  MultiVariableValue,
  MultiVariableErrorCode
> = {
  meta: {
    id: 'optimizacion-varias-variables',
    title: 'Optimización no restringida de varias variables',
    summary: 'Gradiente, matriz hessiana y clasificación del punto estacionario.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Secs. 20.1.1 y 20.1.2, teorema 20.1-2 y Ejemplo 20.1-1 (10.ª ed.)',
      },
      { sourceId: 'hillier-lieberman-2002', locator: 'Sec. 13.5 (7.ª ed.)' },
      { sourceId: 'rao-1999' },
    ],
  },
  inputSchema: multiVariableInputSchema,
  // Taha, ejemplo 20.1-1.
  example: { expression: 'x1 + 2x3 + x2*x3 - x1^2 - x2^2 - x3^2', start: '0, 0, 0' },
  solve: solveMultiVariable,
};
