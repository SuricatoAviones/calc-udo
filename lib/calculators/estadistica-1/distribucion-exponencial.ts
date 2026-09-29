/**
 * Distribución exponencial: tiempo hasta el primer evento de un proceso de Poisson (Walpole,
 * Myers, Myers y Ye, sec. 6.6). Walpole la escribe con la media β; otros textos (y la teoría de
 * colas) con la tasa λ = 1/β:
 *
 *   f(x) = (1/β) e^{−x/β} = λ e^{−λx},   x > 0,   F(x) = 1 − e^{−x/β}
 *   μ = β = 1/λ,   σ² = β² = 1/λ²   (corolario 6.1)
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator } from '../types';
import {
  continuousBetweenError,
  continuousBetweenIsValid,
  continuousQueryShape,
  positiveNumber,
  solveContinuous,
  type ContinuousErrorCode,
  type ContinuousModel,
  type ContinuousValue,
} from './continuous';

export const exponentialParameters = ['media', 'tasa'] as const;

export const exponentialInputSchema = z
  .object({
    parameter: z.enum(exponentialParameters, { error: 'Elige cómo das el parámetro.' }),
    value: positiveNumber('el parámetro'),
    ...continuousQueryShape,
  })
  .refine(continuousBetweenIsValid, continuousBetweenError);

export type ExponentialInput = z.infer<typeof exponentialInputSchema>;

const n = toLatexNumber;

function exponentialModel(
  parameter: ExponentialInput['parameter'],
  value: number,
): ContinuousModel {
  const beta = parameter === 'media' ? value : 1 / value;
  const byRate = parameter === 'tasa';
  return {
    name: 'exponencial',
    support: [0, Infinity],
    pdf: (x) => (x < 0 ? 0 : Math.exp(-x / beta) / beta),
    cdf: (x) => (x <= 0 ? 0 : 1 - Math.exp(-x / beta)),
    pdfFormula: byRate
      ? `\\lambda e^{-\\lambda x} = ${n(value)}\\,e^{-${n(value)}x}, \\quad x > 0`
      : `\\frac{1}{\\beta} e^{-x/\\beta} = \\frac{1}{${n(beta)}} e^{-x/${n(beta)}}, \\quad x > 0`,
    cdfFormula: byRate ? '1 - e^{-\\lambda x}' : '1 - e^{-x/\\beta}',
    cdfExplanation:
      'Integrando la densidad desde 0 hasta x. Su complemento, P(X > x), es la probabilidad de que no ocurra ningún evento de Poisson antes de x.',
    cdfSubstitution: (x) =>
      byRate ? `1 - e^{-(${n(value)})(${n(x)})}` : `1 - e^{-${n(x)}/${n(beta)}}`,
    mean: beta,
    variance: beta ** 2,
    meanFormula: byRate ? `\\frac{1}{\\lambda} = \\frac{1}{${n(value)}}` : `\\beta = ${n(beta)}`,
    varianceFormula: byRate
      ? `\\frac{1}{\\lambda^2} = \\frac{1}{(${n(value)})^2}`
      : `\\beta^2 = (${n(beta)})^2`,
    explanation: byRate
      ? `X es el tiempo (o espacio) hasta el primer evento cuando ocurren en promedio λ = ${formatNumber(value)} eventos por unidad. Su media es 1/λ = ${formatNumber(beta)}.`
      : `X es el tiempo (o espacio) hasta el primer evento, con media β = ${formatNumber(beta)}. Equivale a una tasa de λ = 1/β = ${formatNumber(1 / beta)} eventos por unidad.`,
  };
}

export const exponential: Calculator<ExponentialInput, ContinuousValue, ContinuousErrorCode> = {
  meta: {
    id: 'distribucion-exponencial',
    title: 'Distribución exponencial',
    summary: 'Probabilidades para el tiempo hasta un evento, con media β o tasa λ.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 6.6, Ejemplos 6.17 y 6.21; corolario 6.1 (9.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: exponentialInputSchema,
  // Walpole, ejemplo 6.21: una lavadora necesita una reparación mayor en promedio a los β = 4
  // años; ¿P(Y > 6)?
  example: { parameter: 'media', value: 4, query: 'mayor', x: 6 },
  solve: ({ parameter, value, ...query }) =>
    solveContinuous(query, exponentialModel(parameter, value)),
};
