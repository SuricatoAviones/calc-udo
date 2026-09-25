/**
 * Reglas de Simpson (Chapra & Canale, sec. 21.2):
 *
 *   1/3 (n par):   I ≅ (b − a)[f(x₀) + 4 Σ_{impares} f(x_i) + 2 Σ_{pares} f(x_j) + f(x_n)] / (3n)   (ec. 21.18)
 *   3/8 (n = 3):   I ≅ (b − a)[f(x₀) + 3f(x₁) + 3f(x₂) + f(x₃)] / 8                             (ec. 21.20)
 *   n impar ≥ 5:   1/3 en los primeros n − 3 segmentos y 3/8 en los últimos 3 (sec. 21.2.4,
 *                  figura 21.13d).
 */
import { z } from 'zod';
import { toLatexNumber, toLatexOperand } from '@/lib/math/format';
import type { Calculator, Step } from '../types';
import {
  integrationShape,
  intervalError,
  intervalIsValid,
  listOrSum,
  solveIntegration,
  type IntegrationErrorCode,
  type IntegrationNode,
  type IntegrationRule,
  type IntegrationValue,
} from './integration';

export const simpsonInputSchema = z.object(integrationShape).refine(intervalIsValid, intervalError);
export type SimpsonInput = z.infer<typeof simpsonInputSchema>;

const n = toLatexNumber;

/** Simpson 1/3 de aplicación múltiple sobre `nodes` (número par de segmentos). */
function oneThird(nodes: IntegrationNode[], title: string): { integral: number; steps: Step[] } {
  const m = nodes.length - 1;
  const x0 = nodes[0]!.x;
  const xm = nodes.at(-1)!.x;
  const f0 = nodes[0]!.fx;
  const fm = nodes.at(-1)!.fx;
  const odd = nodes.filter((_, k) => k % 2 === 1 && k < m).map((node) => node.fx);
  const even = nodes.filter((_, k) => k % 2 === 0 && k > 0 && k < m).map((node) => node.fx);
  const sumOdd = odd.reduce((s, v) => s + v, 0);
  const sumEven = even.reduce((s, v) => s + v, 0);
  const integral = ((xm - x0) * (f0 + 4 * sumOdd + 2 * sumEven + fm)) / (3 * m);
  const width = `(${n(xm)} - ${toLatexOperand(x0)})`;
  return {
    integral,
    steps: [
      {
        title: `${title}: sumas de los nodos impares y pares`,
        explanation:
          'Los nodos de índice impar son los puntos medios de cada par de segmentos (peso 4); los pares interiores unen dos parábolas (peso 2).',
        formula: '\\sum_{\\text{impares}} f(x_i), \\qquad \\sum_{\\text{pares}} f(x_j)',
        substitution: `\\sum_{\\text{impares}} = ${listOrSum(odd)}, \\qquad \\sum_{\\text{pares}} = ${listOrSum(even)}`,
        result: `\\sum_{\\text{impares}} = ${n(sumOdd)}, \\qquad \\sum_{\\text{pares}} = ${n(sumEven)}`,
      },
      {
        title: `${title}: aplicar la fórmula`,
        formula:
          m === 2
            ? 'I \\cong (b - a)\\,\\frac{f(x_0) + 4f(x_1) + f(x_2)}{6}'
            : 'I \\cong (b - a)\\,\\frac{f(x_0) + 4\\sum_{\\text{impares}} f(x_i) + 2\\sum_{\\text{pares}} f(x_j) + f(x_n)}{3n}',
        substitution: `I \\cong ${width}\\,\\frac{${n(f0)} + 4(${n(sumOdd)}) + 2(${n(sumEven)}) + ${n(fm)}}{3(${m})}`,
        result: `I \\cong ${n(integral)}`,
      },
    ],
  };
}

/** Simpson 3/8 sobre exactamente 4 nodos (3 segmentos). */
function threeEighths(
  nodes: IntegrationNode[],
  title: string,
): { integral: number; steps: Step[] } {
  const [p0, p1, p2, p3] = nodes as [
    IntegrationNode,
    IntegrationNode,
    IntegrationNode,
    IntegrationNode,
  ];
  const integral = ((p3.x - p0.x) * (p0.fx + 3 * p1.fx + 3 * p2.fx + p3.fx)) / 8;
  return {
    integral,
    steps: [
      {
        title: `${title}: aplicar la fórmula`,
        explanation: 'Se ajusta un polinomio cúbico a cuatro puntos equidistantes.',
        formula: 'I \\cong (b - a)\\,\\frac{f(x_0) + 3f(x_1) + 3f(x_2) + f(x_3)}{8}',
        substitution: `I \\cong (${n(p3.x)} - ${toLatexOperand(p0.x)})\\,\\frac{${n(p0.fx)} + 3(${n(p1.fx)}) + 3(${n(p2.fx)}) + ${n(p3.fx)}}{8}`,
        result: `I \\cong ${n(integral)}`,
      },
    ],
  };
}

const rule: IntegrationRule<SimpsonInput> = {
  validate: (input) =>
    input.n < 2
      ? 'La regla de Simpson necesita al menos 2 segmentos (3 puntos) para ajustar una parábola.'
      : null,
  nodesExplanation: (input) =>
    `Se usan los ${input.n + 1} puntos x_i = a + i·h. ${
      input.n % 2 === 0
        ? `Como n = ${input.n} es par, se aplica Simpson 1/3 en todos los segmentos.`
        : input.n === 3
          ? 'Como n = 3, se aplica Simpson 3/8.'
          : `Como n = ${input.n} es impar, se aplica Simpson 1/3 en los primeros ${input.n - 3} segmentos y Simpson 3/8 en los últimos 3.`
    }`,
  nodes: (input, h) => Array.from({ length: input.n + 1 }, (_, i) => input.a + i * h),
  apply: (input, _h, nodes) => {
    if (input.n % 2 === 0) return oneThird(nodes, 'Simpson 1/3');
    if (input.n === 3) return threeEighths(nodes, 'Simpson 3/8');
    const split = input.n - 3;
    const first = oneThird(nodes.slice(0, split + 1), `Simpson 1/3 en [x₀, x_${split}]`);
    const last = threeEighths(nodes.slice(split), `Simpson 3/8 en [x_${split}, x_${input.n}]`);
    const integral = first.integral + last.integral;
    return {
      integral,
      steps: [
        ...first.steps,
        ...last.steps,
        {
          title: 'Sumar las dos partes',
          formula: 'I = I_{1/3} + I_{3/8}',
          substitution: `I = ${n(first.integral)} + ${toLatexOperand(last.integral)}`,
          result: `I \\cong ${n(integral)}`,
        },
      ],
    };
  },
};

export const simpsonRule: Calculator<SimpsonInput, IntegrationValue, IntegrationErrorCode> = {
  meta: {
    id: 'regla-de-simpson',
    title: 'Regla de Simpson',
    summary: 'Aproxima una integral definida con parábolas (1/3) o cúbicas (3/8).',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 21, sección 21.2, Ejemplos 21.4, 21.5 y 21.6 (pp. 633–638 de la 5.ª ed. en español)',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: simpsonInputSchema,
  // Chapra & Canale, ejemplo 21.5: Simpson 1/3 con n = 4 en [0, 0.8]; exacto 1.640533.
  example: {
    expression: '0.2 + 25x - 200x^2 + 675x^3 - 900x^4 + 400x^5',
    a: 0,
    b: 0.8,
    n: 4,
    exact: 1.640533,
  },
  solve: (input) => solveIntegration(input, rule),
};
