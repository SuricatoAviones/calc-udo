/**
 * Distribución uniforme continua en [A, B]: todos los intervalos de la misma longitud dentro de
 * [A, B] tienen la misma probabilidad (Walpole, Myers, Myers y Ye, sec. 6.1):
 *
 *   f(x; A, B) = 1/(B − A),   A ≤ x ≤ B,   F(x) = (x − A)/(B − A)
 *   μ = (A + B)/2,   σ² = (B − A)²/12   (teorema 6.1)
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import type { Calculator } from '../types';
import {
  continuousBetweenError,
  continuousBetweenIsValid,
  continuousQueryShape,
  finiteNumber,
  solveContinuous,
  type ContinuousErrorCode,
  type ContinuousModel,
  type ContinuousValue,
} from './continuous';

export const uniformInputSchema = z
  .object({
    lower: finiteNumber('el límite inferior A'),
    upper: finiteNumber('el límite superior B'),
    ...continuousQueryShape,
  })
  .refine((v) => v.upper > v.lower, {
    message: 'B debe ser mayor que A.',
    path: ['upper'],
  })
  .refine(continuousBetweenIsValid, continuousBetweenError);

export type UniformInput = z.infer<typeof uniformInputSchema>;

const n = toLatexNumber;

function uniformModel(a: number, b: number): ContinuousModel {
  const width = b - a;
  return {
    name: 'uniforme',
    support: [a, b],
    pdf: (x) => (x < a || x > b ? 0 : 1 / width),
    cdf: (x) => (x <= a ? 0 : x >= b ? 1 : (x - a) / width),
    pdfFormula: `\\frac{1}{B - A} = \\frac{1}{${n(b)} - ${toLatexOperand(a)}}, \\quad ${n(a)} \\le x \\le ${n(b)}`,
    cdfFormula: '\\frac{x - A}{B - A}',
    cdfExplanation:
      'La densidad es un rectángulo de altura 1/(B − A), así que el área a la izquierda de x es la base (x − A) por la altura.',
    cdfSubstitution: (x) =>
      `\\frac{${n(x)} - ${toLatexOperand(a)}}{${n(b)} - ${toLatexOperand(a)}}`,
    mean: (a + b) / 2,
    variance: width ** 2 / 12,
    meanFormula: `\\frac{A + B}{2} = \\frac{${n(a)} + ${toLatexOperand(b)}}{2}`,
    varianceFormula: `\\frac{(B - A)^2}{12} = \\frac{(${n(width)})^2}{12}`,
    explanation: `X es igualmente probable en todo el intervalo [${formatNumber(a)}, ${formatNumber(b)}]: la probabilidad de caer en un subintervalo solo depende de su longitud.`,
  };
}

export const uniform: Calculator<UniformInput, ContinuousValue, ContinuousErrorCode> = {
  meta: {
    id: 'distribucion-uniforme',
    title: 'Distribución uniforme',
    summary: 'Probabilidades para una variable equiprobable en [A, B].',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 6.1, Ejemplo 6.1; teorema 6.1 (9.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: uniformInputSchema,
  // Walpole, ejemplo 6.1: una conferencia dura entre 0 y 4 horas; ¿P(X ≥ 3)?
  example: { lower: 0, upper: 4, query: 'mayor', x: 3 },
  solve: ({ lower, upper, ...query }) => solveContinuous(query, uniformModel(lower, upper)),
};
