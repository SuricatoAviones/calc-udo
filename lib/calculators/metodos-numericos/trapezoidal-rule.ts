/**
 * Regla del trapecio, simple (n = 1) y de aplicación múltiple (Chapra & Canale, sec. 21.1):
 *
 *   I ≅ (b − a) [f(x₀) + 2 Σ_{i=1}^{n−1} f(x_i) + f(x_n)] / (2n)      (ec. 21.9)
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import type { Calculator } from '../types';
import {
  integrationShape,
  intervalError,
  intervalIsValid,
  listOrSum,
  solveIntegration,
  type IntegrationErrorCode,
  type IntegrationRule,
  type IntegrationValue,
} from './integration';

export const trapezoidalInputSchema = z
  .object(integrationShape)
  .refine(intervalIsValid, intervalError);
export type TrapezoidalInput = z.infer<typeof trapezoidalInputSchema>;

const n = toLatexNumber;

const rule: IntegrationRule<TrapezoidalInput> = {
  nodesExplanation: (input) =>
    `La regla usa los ${input.n + 1} puntos x_i = a + i·h, desde x₀ = a hasta x_${input.n} = b.`,
  nodes: (input, h) => Array.from({ length: input.n + 1 }, (_, i) => input.a + i * h),
  apply: (input, _h, nodes) => {
    const { a, b } = input;
    const f0 = nodes[0]!.fx;
    const fn = nodes.at(-1)!.fx;
    const interior = nodes.slice(1, -1).map((node) => node.fx);
    const sumInterior = interior.reduce((s, v) => s + v, 0);
    const integral = ((b - a) * (f0 + 2 * sumInterior + fn)) / (2 * input.n);

    if (input.n === 1) {
      return {
        integral,
        steps: [
          {
            title: 'Aplicar la regla del trapecio',
            explanation:
              'Se aproxima el área bajo f con un solo trapecio que une (a, f(a)) y (b, f(b)).',
            formula: 'I \\cong (b - a)\\,\\frac{f(a) + f(b)}{2}',
            substitution: `I \\cong (${n(b)} - ${n(a)})\\,\\frac{${n(f0)} + ${n(fn)}}{2}`,
            result: `I \\cong ${n(integral)}`,
          },
        ],
      };
    }
    return {
      integral,
      steps: [
        {
          title: 'Sumar los valores interiores',
          explanation: `Los ${interior.length} nodos interiores (x₁ a x_${input.n - 1}) pertenecen a dos trapecios cada uno, por eso se cuentan dos veces.`,
          formula: '\\sum_{i=1}^{n-1} f(x_i)',
          substitution: `\\sum_{i=1}^{${input.n - 1}} f(x_i) = ${listOrSum(interior)}`,
          result: `\\sum_{i=1}^{${input.n - 1}} f(x_i) = ${n(sumInterior)}`,
        },
        {
          title: 'Aplicar la regla del trapecio de aplicación múltiple',
          formula: 'I \\cong (b - a)\\,\\frac{f(x_0) + 2\\sum_{i=1}^{n-1} f(x_i) + f(x_n)}{2n}',
          substitution: `I \\cong (${n(b)} - ${n(a)})\\,\\frac{${n(f0)} + 2(${n(sumInterior)}) + ${n(fn)}}{2(${input.n})}`,
          result: `I \\cong ${n(integral)}`,
        },
      ],
    };
  },
};

export const trapezoidalRule: Calculator<TrapezoidalInput, IntegrationValue, IntegrationErrorCode> =
  {
    meta: {
      id: 'regla-trapezoidal',
      title: 'Regla trapezoidal',
      summary: 'Aproxima una integral definida con trapecios.',
      citations: [
        {
          sourceId: 'chapra-canale-2000',
          locator:
            'Cap. 21, sección 21.1, Ejemplos 21.1 y 21.2 (pp. 624–628 de la 5.ª ed. en español)',
        },
        { sourceId: 'nakamura-1994' },
        { sourceId: 'ledanois-2000' },
      ],
    },
    inputSchema: trapezoidalInputSchema,
    // Chapra & Canale, ejemplo 21.2: polinomio de grado 5 en [0, 0.8], n = 2; exacto 1.640533.
    example: {
      expression: '0.2 + 25x - 200x^2 + 675x^3 - 900x^4 + 400x^5',
      a: 0,
      b: 0.8,
      n: 2,
      exact: 1.640533,
    },
    solve: (input) => solveIntegration(input, rule),
  };
