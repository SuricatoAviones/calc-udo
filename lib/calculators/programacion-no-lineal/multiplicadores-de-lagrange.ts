/**
 * Método de los multiplicadores de Lagrange para restricciones de igualdad (Taha, sec. 20.2.1;
 * Hillier & Lieberman, apéndice 3). Con las restricciones escritas como g_i(X) = 0 (lado
 * izquierdo − lado derecho), la función de Lagrange de Taha es
 *
 *   L(X, λ) = f(X) − Σ λ_i g_i(X)
 *
 * y los puntos estacionarios cumplen ∂L/∂x_j = 0 y ∂L/∂λ_i = −g_i = 0. Los multiplicadores son
 * los coeficientes de sensibilidad ∂f/∂g_i: cuánto cambia el óptimo si el lado derecho aumenta.
 *
 * Condición suficiente con la hessiana orlada H^B = [[0, ∇g], [∇gᵀ, ∇²L]] (m restricciones, n
 * variables): de los menores principales dominantes de orden 2m + 1, …, m + n, el punto es un
 * mínimo si todos tienen el signo de (−1)^m y un máximo si alternan empezando por (−1)^{m+1}.
 */
import { z } from 'zod';
import { toLatexMatrix, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import {
  clean,
  determinant,
  evaluateAt,
  evaluateMatrix,
  evaluateVector,
  gradientOf,
  hessianOf,
  newtonSystem,
  parseConstraintList,
  parseNlpExpression,
  parsePoint,
  pointTex,
  pointText,
  type NlpConstraint,
} from './nlp';

export const lagrangeInputSchema = z
  .object({
    objective: z
      .string()
      .trim()
      .min(1, 'Escribe la función objetivo f(x1, x2, …).')
      .max(300, 'La expresión es demasiado larga.'),
    constraints: z
      .string()
      .trim()
      .min(1, 'Escribe al menos una restricción de igualdad.')
      .max(1000, 'Las restricciones son demasiado largas.'),
    start: z.string().trim().optional(),
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
    if (constraints.some((c) => c.relation !== '=')) {
      ctx.addIssue({
        code: 'custom',
        path: ['constraints'],
        message:
          'Este método es para restricciones de igualdad (=). Para desigualdades usa las condiciones KKT.',
      });
      return;
    }
    const size = Math.max(f.maxIndex, ...constraints.map((c) => c.maxIndex));
    if (constraints.length >= size) {
      ctx.addIssue({
        code: 'custom',
        path: ['constraints'],
        message: 'Debe haber menos restricciones que variables.',
      });
    }
    if (v.start) {
      const point = parsePoint(v.start, size);
      if (typeof point === 'string') {
        ctx.addIssue({ code: 'custom', path: ['start'], message: `El punto inicial: ${point}.` });
      }
    }
  });

export type LagrangeInput = z.infer<typeof lagrangeInputSchema>;

export type LagrangeKind = 'mínimo local' | 'máximo local' | 'no concluyente';

export interface LagrangeValue {
  point: number[];
  multipliers: number[];
  value: number;
  borderedMinors: number[];
  kind: LagrangeKind;
}

export type LagrangeErrorCode = 'invalid-expression' | 'no-convergence';

type Result = CalculatorResult<LagrangeValue, LagrangeErrorCode>;

const n = toLatexNumber;

export function solveLagrange({ objective, constraints: text, start }: LagrangeInput): Result {
  const parsedF = parseNlpExpression(objective);
  const parsedG = parseConstraintList(text);
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
  const f = parsedF.expr;
  const constraints: NlpConstraint[] = parsedG;
  const size = Math.max(parsedF.maxIndex, ...constraints.map((c) => c.maxIndex));
  const m = constraints.length;
  const gradF = gradientOf(f, size);
  const hessF = hessianOf(f, size);
  const gradG = constraints.map((c) => gradientOf(c.g, size));
  const hessG = constraints.map((c) => hessianOf(c.g, size));
  if (!gradF || !hessF || gradG.some((g) => !g) || hessG.some((h) => !h)) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: 'No se pudieron derivar las funciones.' },
      ...emptyTrace(),
    };
  }

  const lambdaTex = (i: number) => `\\lambda_{${i + 1}}`;
  const gTex = constraints.map((c, i) => `g_{${i + 1}}(X) = ${c.g.tex}`);
  const steps: Step[] = [
    {
      title: 'Función de Lagrange',
      explanation:
        'Cada restricción se escribe como g_i(X) = 0 (lado izquierdo menos lado derecho). Se resta cada una multiplicada por su multiplicador λ_i.',
      formula: 'L(X, \\lambda) = f(X) - \\sum_i \\lambda_i\\,g_i(X)',
      substitution: `${gTex.join(',\\quad ')}`,
      result: `L = ${f.tex} ${constraints.map((c, i) => `- ${lambdaTex(i)}\\left(${c.g.tex}\\right)`).join(' ')}`,
    },
    {
      title: 'Condiciones necesarias',
      explanation: `Se igualan a cero las ${size} derivadas respecto de las variables y las ${m} respecto de los multiplicadores (que devuelven las restricciones).`,
      formula:
        '\\frac{\\partial L}{\\partial x_j} = \\frac{\\partial f}{\\partial x_j} - \\sum_i \\lambda_i \\frac{\\partial g_i}{\\partial x_j} = 0, \\qquad \\frac{\\partial L}{\\partial \\lambda_i} = -g_i(X) = 0',
      substitution: `\\begin{aligned} ${gradF
        .map(
          (df, j) =>
            `${df.tex} ${constraints.map((_, i) => `- ${lambdaTex(i)}\\left(${gradG[i]![j]!.tex}\\right)`).join(' ')} &= 0`,
        )
        .join(
          ' \\\\ ',
        )} \\\\ ${constraints.map((c) => `${c.g.tex} &= 0`).join(' \\\\ ')} \\end{aligned}`,
    },
  ];

  // Sistema F(z) = 0 con z = (x, λ).
  const F = (z: number[]) => {
    const x = z.slice(0, size);
    const lambda = z.slice(size);
    const df = evaluateVector(gradF, x);
    const dg = gradG.map((g) => evaluateVector(g!, x));
    return [
      ...df.map((v, j) => v - lambda.reduce((acc, l, i) => acc + l * dg[i]![j]!, 0)),
      ...constraints.map((c) => -evaluateAt(c.g, x)),
    ];
  };
  const J = (z: number[]) => {
    const x = z.slice(0, size);
    const lambda = z.slice(size);
    const hf = evaluateMatrix(hessF, x);
    const hg = hessG.map((h) => evaluateMatrix(h!, x));
    const dg = gradG.map((g) => evaluateVector(g!, x));
    const top = hf.map((row, j) => [
      ...row.map((v, k) => v - lambda.reduce((acc, l, i) => acc + l * hg[i]![j]![k]!, 0)),
      ...dg.map((g) => -g[j]!),
    ]);
    const bottom = dg.map((g) => [...g.map((v) => -v), ...new Array<number>(m).fill(0)]);
    return [...top, ...bottom];
  };
  const x0 = start ? (parsePoint(start, size) as number[]) : new Array<number>(size).fill(0);
  const newton = newtonSystem(F, J, [...x0, ...new Array<number>(m).fill(0)]);
  steps.push({
    title: 'Resolver el sistema (Newton-Raphson)',
    explanation:
      'Las condiciones forman un sistema de n + m ecuaciones; se resuelve con Newton desde el punto inicial y λ = 0. Si f es cuadrática y las restricciones lineales, el sistema es lineal y basta un paso.',
    substitution: `X_0 = ${pointTex(x0)}`,
    children: newton.iterations.slice(0, 15).map((it, k) => ({
      title: `Iteración ${k + 1}`,
      result: `(X, \\lambda) = ${pointTex(it.point, 8)}, \\quad \\lVert \\nabla L \\rVert = ${n(it.residual, 4)}`,
    })),
  });
  if (!newton.converged) {
    return {
      ok: false,
      error: {
        code: 'no-convergence',
        message:
          'No se encontró un punto que cumpla las condiciones desde este punto inicial. Prueba otro punto inicial o revisa que las restricciones sean compatibles.',
      },
      ...emptyTrace(),
      steps,
    };
  }

  const point = newton.point.slice(0, size).map(clean);
  const multipliers = newton.point.slice(size).map(clean);
  const value = evaluateAt(f, point);

  // Hessiana orlada.
  const dg = gradG.map((g) => evaluateVector(g!, point).map(clean));
  const hf = evaluateMatrix(hessF, point);
  const hg = hessG.map((h) => evaluateMatrix(h!, point));
  const hessL = hf.map((row, j) =>
    row.map((v, k) => clean(v - multipliers.reduce((acc, l, i) => acc + l * hg[i]![j]![k]!, 0))),
  );
  const bordered = [
    ...dg.map((g) => [...new Array<number>(m).fill(0), ...g]),
    ...hessL.map((row, j) => [...dg.map((g) => g[j]!), ...row]),
  ];
  const orders = Array.from({ length: size - m }, (_, k) => 2 * m + 1 + k);
  const borderedMinors = orders.map((order) =>
    clean(determinant(bordered.slice(0, order).map((row) => row.slice(0, order)))),
  );
  const minSign = m % 2 === 0 ? 1 : -1;
  const isMin = borderedMinors.every((d) => Math.sign(d) === minSign);
  const isMax = borderedMinors.every((d, k) => Math.sign(d) === ((m + 1 + k) % 2 === 0 ? 1 : -1));
  const kind: LagrangeKind = isMin ? 'mínimo local' : isMax ? 'máximo local' : 'no concluyente';

  steps.push(
    {
      title: 'Punto estacionario y multiplicadores',
      result: `X_0 = ${pointTex(point, 8)}, \\quad \\lambda = ${pointTex(multipliers, 8)}, \\quad f(X_0) = ${n(value)}`,
    },
    {
      title: 'Hessiana orlada',
      explanation: `Se borda la hessiana de L con los gradientes de las restricciones. Se revisan los menores principales dominantes de orden 2m + 1 = ${2 * m + 1} a m + n = ${m + size}.`,
      formula:
        'H^B = \\begin{bmatrix} 0 & \\nabla g \\\\ \\nabla g^{T} & \\nabla^2 L \\end{bmatrix}',
      substitution: `H^B = ${toLatexMatrix(bordered)}`,
      result: borderedMinors.map((d, k) => `\\Delta_{${orders[k]}} = ${n(d, 8)}`).join(',\\ '),
    },
    {
      title: 'Condición suficiente',
      explanation: isMin
        ? `Todos los menores tienen el signo de (−1)^m = ${minSign > 0 ? '+' : '−'}: es un mínimo.`
        : isMax
          ? 'Los menores alternan de signo empezando por (−1)^{m+1}: es un máximo.'
          : 'Los signos no siguen ninguno de los dos patrones: la condición suficiente no concluye.',
      result: `\\text{${kind}}`,
    },
    {
      title: 'Interpretación de los multiplicadores',
      explanation:
        'λ_i ≈ ∂f/∂b_i: si el lado derecho de la restricción i aumenta en una unidad, el valor óptimo de f cambia aproximadamente en λ_i.',
      result: multipliers
        .map((l, i) => `\\frac{\\partial f}{\\partial b_{${i + 1}}} \\approx ${n(l, 6)}`)
        .join(',\\ '),
    },
  );

  return {
    ok: true,
    value: { point, multipliers, value, borderedMinors, kind },
    summary: [
      { label: 'Punto estacionario', value: `X_0 = ${pointTex(point, 8)}`, emphasis: true },
      {
        label: 'Multiplicadores',
        value: multipliers.map((l, i) => `${lambdaTex(i)} = ${n(l, 6)}`).join(',\\ '),
      },
      { label: 'Valor de la función', value: `f(X_0) = ${n(value, 8)}` },
      { label: 'Tipo', value: `\\text{${kind}}` },
    ],
    ...emptyTrace(),
    steps,
    notices: [
      {
        level: 'info',
        message: `Newton converge al punto estacionario más cercano a ${pointText(x0)}; si hay varios, prueba otros puntos iniciales.`,
      },
    ],
  };
}

export const lagrange: Calculator<LagrangeInput, LagrangeValue, LagrangeErrorCode> = {
  meta: {
    id: 'multiplicadores-de-lagrange',
    title: 'Multiplicadores de Lagrange',
    summary: 'Extremos con restricciones de igualdad y su clasificación con la hessiana orlada.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 20.2.1, método de Lagrange, Ejemplos 20.2-3 y 20.2-4 (10.ª ed.)',
      },
      { sourceId: 'hillier-lieberman-2002', locator: 'Apéndice 3 (7.ª ed.)' },
      { sourceId: 'rao-1999' },
    ],
  },
  inputSchema: lagrangeInputSchema,
  // Taha, ejemplo 20.2-4: minimizar x1² + x2² + x3² con x1 + x2 + 3x3 = 2 y 5x1 + 2x2 + x3 = 5.
  example: {
    objective: 'x1^2 + x2^2 + x3^2',
    constraints: 'x1 + x2 + 3x3 = 2\n5x1 + 2x2 + x3 = 5',
    start: '0, 0, 0',
  },
  solve: solveLagrange,
};
