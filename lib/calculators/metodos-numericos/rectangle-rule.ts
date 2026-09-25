/**
 * Regla rectangular (sumas de Riemann con n rectángulos de ancho h):
 *
 *   I ≅ h Σ f(x_i*)
 *
 * donde x_i* es el extremo izquierdo, el derecho o el punto medio de cada segmento. La del punto
 * medio es la más exacta de las tres (error del mismo orden que el trapecio, con la mitad de
 * magnitud y signo opuesto).
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

export const rectangleVariants = ['izquierda', 'derecha', 'punto-medio'] as const;
export type RectangleVariant = (typeof rectangleVariants)[number];

export const rectangleInputSchema = z
  .object({
    ...integrationShape,
    variant: z.enum(rectangleVariants, { error: 'Elige dónde evaluar la altura.' }),
  })
  .refine(intervalIsValid, intervalError);
export type RectangleInput = z.infer<typeof rectangleInputSchema>;

const n = toLatexNumber;

const DESCRIPTION: Record<RectangleVariant, { where: string; label: string }> = {
  izquierda: { where: 'el extremo izquierdo', label: 'x' },
  derecha: { where: 'el extremo derecho', label: 'x' },
  'punto-medio': { where: 'el punto medio', label: '\\bar{x}' },
};

const rule: IntegrationRule<RectangleInput> = {
  firstIndex: (input) => (input.variant === 'derecha' ? 1 : 0),
  nodesExplanation: (input) => {
    const { where } = DESCRIPTION[input.variant];
    const formula =
      input.variant === 'punto-medio'
        ? 'x̄_i = a + (i + ½)·h, con i = 0 … n − 1'
        : input.variant === 'izquierda'
          ? 'x_i = a + i·h, con i = 0 … n − 1'
          : 'x_i = a + i·h, con i = 1 … n';
    return `La altura de cada rectángulo es f evaluada en ${where} del segmento: ${formula}.`;
  },
  nodes: (input, h) =>
    Array.from({ length: input.n }, (_, i) => {
      if (input.variant === 'izquierda') return input.a + i * h;
      if (input.variant === 'derecha') return input.a + (i + 1) * h;
      return input.a + (i + 0.5) * h;
    }),
  apply: (input, h, nodes) => {
    const values = nodes.map((node) => node.fx);
    const sum = values.reduce((s, v) => s + v, 0);
    const integral = h * sum;
    const label = DESCRIPTION[input.variant].label;
    return {
      integral,
      steps: [
        {
          title: 'Sumar las alturas',
          formula: `\\sum f(${label}_i)`,
          substitution: `\\sum f(${label}_i) = ${listOrSum(values)}`,
          result: `\\sum f(${label}_i) = ${n(sum)}`,
        },
        {
          title: 'Multiplicar por el ancho',
          explanation:
            'Todos los rectángulos tienen el mismo ancho h, así que el área total es h por la suma de las alturas.',
          formula: `I \\cong h \\sum f(${label}_i)`,
          substitution: `I \\cong ${n(h)}\\,(${n(sum)})`,
          result: `I \\cong ${n(integral)}`,
        },
      ],
    };
  },
};

export const rectangleRule: Calculator<RectangleInput, IntegrationValue, IntegrationErrorCode> = {
  meta: {
    id: 'regla-rectangular',
    title: 'Regla rectangular',
    summary: 'Aproxima una integral definida con rectángulos (izquierda, derecha o punto medio).',
    citations: [{ sourceId: 'nakamura-1994' }, { sourceId: 'ledanois-2000' }],
  },
  inputSchema: rectangleInputSchema,
  // Mismo ejemplo que el punto medio de OpenStax Cálculo, vol. 2, ejemplo 3.39: ∫₀¹ x² dx, n = 4.
  example: { expression: 'x^2', a: 0, b: 1, n: 4, exact: 1 / 3, variant: 'punto-medio' },
  solve: (input) => solveIntegration(input, rule),
};
