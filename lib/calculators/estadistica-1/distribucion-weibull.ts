/**
 * Distribución de Weibull para tiempos de falla (Walpole, Myers, Myers y Ye, sec. 6.10; Meyer y
 * Miller y Freund usan la misma parametrización):
 *
 *   f(x; α, β) = αβ x^{β−1} e^{−αx^β},   x > 0,   F(x) = 1 − e^{−αx^β}
 *   μ = α^{−1/β} Γ(1 + 1/β),   σ² = α^{−2/β} {Γ(1 + 2/β) − [Γ(1 + 1/β)]²}   (teorema 6.8)
 *
 * Con β = 1 se reduce a la exponencial con media 1/α.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { gammaFunction } from '@/lib/math/special';
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

export const weibullInputSchema = z
  .object({
    alpha: positiveNumber('α'),
    beta: positiveNumber('β').refine(
      (v) => v >= 0.1,
      'Con β < 0.1 la media y la varianza son astronómicas; el mínimo es β = 0.1.',
    ),
    ...continuousQueryShape,
  })
  .refine(continuousBetweenIsValid, continuousBetweenError);

export type WeibullInput = z.infer<typeof weibullInputSchema>;

const n = toLatexNumber;

function weibullModel(alpha: number, beta: number): ContinuousModel {
  const g1 = gammaFunction(1 + 1 / beta);
  const g2 = gammaFunction(1 + 2 / beta);
  return {
    name: 'de Weibull',
    support: [0, Infinity],
    pdf: (x) => (x < 0 ? 0 : alpha * beta * x ** (beta - 1) * Math.exp(-alpha * x ** beta)),
    cdf: (x) => (x <= 0 ? 0 : 1 - Math.exp(-alpha * x ** beta)),
    pdfFormula: `\\alpha\\beta x^{\\beta-1} e^{-\\alpha x^{\\beta}} = (${n(alpha)})(${n(beta)})\\,x^{${n(beta - 1)}} e^{-${n(alpha)}x^{${n(beta)}}}, \\quad x > 0`,
    cdfFormula: '1 - e^{-\\alpha x^{\\beta}}',
    cdfExplanation:
      'A diferencia de la gamma, la función de distribución de Weibull tiene forma cerrada: se integra la densidad con el cambio u = αx^β.',
    cdfSubstitution: (x) => `1 - e^{-(${n(alpha)})(${n(x)})^{${n(beta)}}}`,
    mean: alpha ** (-1 / beta) * g1,
    variance: alpha ** (-2 / beta) * (g2 - g1 ** 2),
    meanFormula: `\\alpha^{-1/\\beta}\\,\\Gamma\\left(1 + \\tfrac{1}{\\beta}\\right) = (${n(alpha)})^{-1/${n(beta)}}\\,\\Gamma(${n(1 + 1 / beta)})`,
    varianceFormula: `\\alpha^{-2/\\beta}\\left\\{\\Gamma\\left(1 + \\tfrac{2}{\\beta}\\right) - \\left[\\Gamma\\left(1 + \\tfrac{1}{\\beta}\\right)\\right]^2\\right\\} = (${n(alpha)})^{-2/${n(beta)}}\\left[\\Gamma(${n(1 + 2 / beta)}) - \\Gamma(${n(1 + 1 / beta)})^2\\right]`,
    explanation: `X es el tiempo hasta la falla de un componente. β = ${formatNumber(beta)} da la forma: ${
      beta < 1
        ? 'con β < 1 la tasa de fallas disminuye con el tiempo (fallas tempranas).'
        : beta === 1
          ? 'con β = 1 la tasa de fallas es constante y la distribución es la exponencial con media 1/α.'
          : 'con β > 1 la tasa de fallas aumenta con el tiempo (desgaste).'
    }`,
  };
}

export const weibull: Calculator<WeibullInput, ContinuousValue, ContinuousErrorCode> = {
  meta: {
    id: 'distribucion-weibull',
    title: 'Distribución de Weibull',
    summary: 'Probabilidades de falla con la distribución de Weibull(α, β).',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 6.10, Ejemplo 6.24; teorema 6.8 (9.ª ed. en español)',
      },
      { sourceId: 'meyer-1998' },
      { sourceId: 'johnson-1997' },
    ],
  },
  inputSchema: weibullInputSchema,
  // Walpole, ejemplo 6.24: vida de un artículo Weibull con α = 0.01 y β = 2; ¿P(X < 8)?
  example: { alpha: 0.01, beta: 2, query: 'menor', x: 8 },
  solve: ({ alpha, beta, ...query }) => solveContinuous(query, weibullModel(alpha, beta)),
};
