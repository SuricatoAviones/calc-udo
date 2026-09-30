/**
 * Método de Taylor de orden n para dy/dx = f(x, y) (Chapra & Canale, sec. 25.1.1; Nakamura, cap.
 * de EDO):
 *
 *   y_{i+1} = y_i + f(x_i, y_i) h + f'(x_i, y_i) h²/2! + ⋯ + f⁽ⁿ⁻¹⁾(x_i, y_i) hⁿ/n!
 *
 * donde las derivadas de f son derivadas totales respecto de x (regla de la cadena, ec. 25.9):
 *
 *   f' = ∂f/∂x + (∂f/∂y) f,    f'' = ∂f'/∂x + (∂f'/∂y) f,  …
 *
 * El método de Euler es el de orden 1. El error de truncamiento local es O(h^{n+1}): el primer
 * término de la serie que no se incluye (ejemplo 25.2).
 */
import { derivative, OperatorNode, simplify, type MathNode } from 'mathjs';
import { z } from 'zod';
import type { ParsedExpression } from '@/lib/math/expression';
import { latexLines, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import type { Calculator, Step } from '../types';
import {
  odeShape,
  refineOde,
  solveOde,
  slopeStep,
  type OdeErrorCode,
  type OdeRuleFactory,
  type OdeValue,
} from './ode';

export const taylorOdeInputSchema = z
  .object({
    ...odeShape,
    order: z
      .number({ error: 'Ingresa el orden del método.' })
      .int('El orden debe ser un número entero.')
      .min(1, 'El orden mínimo es 1 (Euler).')
      .max(4, 'El orden máximo es 4.'),
  })
  .superRefine(refineOde);

export type TaylorOdeInput = z.infer<typeof taylorOdeInputSchema>;

const n = toLatexNumber;
const op = toLatexOperand;

const FACTORIALS = [1, 1, 2, 6, 24];

/** Nombre de la derivada k-ésima de y: y', y'', y''', y⁽⁴⁾. */
function yDerivative(k: number): string {
  return k <= 3 ? `y${"'".repeat(k)}` : `y^{(${k})}`;
}

/** f, f', f'' … como funciones de (x, y), con su LaTeX. */
function totalDerivatives(
  f: ParsedExpression,
  count: number,
): { tex: string; at: (x: number, y: number) => number }[] | string {
  const nodes: MathNode[] = [f.node];
  try {
    for (let k = 1; k < count; k++) {
      const prev = nodes[k - 1]!;
      const total = new OperatorNode('+', 'add', [
        derivative(prev, 'x'),
        new OperatorNode('*', 'multiply', [derivative(prev, 'y'), f.node]),
      ]);
      nodes.push(simplify(total));
    }
  } catch {
    return 'No se pudieron calcular las derivadas de f(x, y) simbólicamente.';
  }
  return nodes.map((node) => {
    const compiled = node.compile();
    return {
      tex: node.toTex({ implicit: 'show' }),
      at: (x: number, y: number) => {
        try {
          const value: unknown = compiled.evaluate({ x, y });
          return typeof value === 'number' ? value : Number.NaN;
        } catch {
          return Number.NaN;
        }
      },
    };
  });
}

function taylorRule(order: number): OdeRuleFactory {
  return (f) => {
    const derivatives = totalDerivatives(f, order);
    if (typeof derivatives === 'string') return derivatives;
    const introSteps: Step[] = [
      {
        title: `Derivadas de y hasta el orden ${order}`,
        explanation:
          order === 1
            ? 'Con orden 1 solo se usa y′ = f(x, y): es el método de Euler.'
            : 'Cada derivada es la derivada total de la anterior respecto de x: se deriva respecto de x y se suma la derivada respecto de y multiplicada por y′ = f (regla de la cadena).',
        formula:
          order === 1
            ? undefined
            : "y'' = \\frac{\\partial f}{\\partial x} + \\frac{\\partial f}{\\partial y}\\,f",
        result: latexLines(derivatives.map((d, k) => `${yDerivative(k + 1)} = ${d.tex}`)),
      },
    ];
    const terms = Array.from({ length: order }, (_, k) =>
      k === 0 ? "y'_i\\,h" : `\\frac{${yDerivative(k + 1)}_i}{${k + 1}!}h^{${k + 1}}`,
    );
    return {
      introSteps,
      slopeColumns: derivatives.map((_, k) => ({
        key: `d${k + 1}`,
        header: `${yDerivative(k + 1)}_i`,
      })),
      advance(_f, i, x, y, h) {
        const values = derivatives.map((d) => d.at(x, y));
        const yNext = values.reduce((s, v, k) => s + (v * h ** (k + 1)) / FACTORIALS[k + 1]!, y);
        return {
          yNext,
          slopes: values.map((v, k) => ({
            key: `d${k + 1}`,
            value: v,
            step: slopeStep(
              k === 0 ? 'Pendiente' : `Derivada de orden ${k + 1}`,
              `${yDerivative(k + 1)}_{${i}}`,
              x,
              y,
              v,
            ),
          })),
          update: {
            title: 'Avanzar con la serie de Taylor',
            formula: `y_{i+1} = y_i + ${terms.join(' + ')}`,
            substitution: `y_{${i + 1}} = ${n(y)} + ${values
              .map((v, k) =>
                k === 0
                  ? `${op(v)}(${n(h)})`
                  : `\\frac{${n(v)}}{${FACTORIALS[k + 1]}}(${n(h)})^{${k + 1}}`,
              )
              .join(' + ')}`,
            result: `y_{${i + 1}} = ${n(yNext)}`,
          },
        };
      },
    };
  };
}

export const taylorOde: Calculator<TaylorOdeInput, OdeValue, OdeErrorCode> = {
  meta: {
    id: 'metodo-de-taylor',
    title: 'Método de Taylor',
    summary:
      'Resuelve un problema de valor inicial con la serie de Taylor de orden 1 a 4 y derivadas totales de f.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 25, sec. 25.1.1 (análisis del error del método de Euler con la serie de Taylor, ejemplo 25.2), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: taylorOdeInputSchema,
  example: {
    expression: '-2x^3 + 12x^2 - 20x + 8.5',
    x0: 0,
    y0: 1,
    h: 0.5,
    xf: 4,
    exact: '-0.5x^4 + 4x^3 - 10x^2 + 8.5x + 1',
    order: 2,
  },
  solve: (input) => solveOde(input, taylorRule(input.order)),
};
