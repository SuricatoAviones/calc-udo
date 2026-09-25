/**
 * Distribución de Poisson: número de eventos en un intervalo cuando ocurren en promedio λ (= λt)
 * de forma independiente (Walpole, Myers y Myers, sec. 5.5):
 *
 *   p(x; λ) = e^{−λ} λˣ / x!,   μ = σ² = λ   (teorema 5.5)
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import type { Calculator } from '../types';
import {
  betweenError,
  betweenIsValid,
  discreteQueryShape,
  lnFactorial,
  solveDiscrete,
  type DiscreteErrorCode,
  type DiscreteModel,
  type DiscreteValue,
} from './discrete';

export const poissonInputSchema = z
  .object({
    lambda: z
      .number({ error: 'Ingresa la media λ.' })
      .refine(Number.isFinite, 'λ debe ser un número finito.')
      .refine((v) => v > 0, 'λ debe ser mayor que 0.')
      .refine((v) => v <= 500, 'El máximo permitido es λ = 500.'),
    ...discreteQueryShape,
  })
  .refine(betweenIsValid, betweenError);

export type PoissonInput = z.infer<typeof poissonInputSchema>;

const n = toLatexNumber;

function poissonModel(lambda: number): DiscreteModel {
  return {
    name: 'de Poisson',
    max: Infinity,
    pmf: (x) => (x < 0 ? 0 : Math.exp(-lambda + x * Math.log(lambda) - lnFactorial(x))),
    notation: (x) => `p(${x};\\ ${n(lambda)})`,
    pmfFormula: '\\frac{e^{-\\lambda} \\lambda^x}{x!}',
    pmfSubstitution: (x) => `\\frac{e^{-${n(lambda)}}\\,(${n(lambda)})^{${x}}}{${x}!}`,
    mean: lambda,
    variance: lambda,
    meanFormula: `\\lambda = ${n(lambda)}`,
    varianceFormula: `\\lambda = ${n(lambda)}`,
    explanation: `X cuenta los eventos en un intervalo en el que ocurren, en promedio, λ = ${n(lambda)} de forma independiente. Si te dan una tasa por unidad de tiempo, λ = tasa × duración del intervalo.`,
  };
}

export const poisson: Calculator<PoissonInput, DiscreteValue, DiscreteErrorCode> = {
  meta: {
    id: 'distribucion-de-poisson',
    title: 'Distribución de Poisson',
    summary: 'Probabilidad de k eventos en un intervalo con media λ.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 5.5, Ejemplos 5.20 y 5.21 (numeración de la 8.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: poissonInputSchema,
  // Walpole, ejemplo 5.20: en promedio 4 partículas por milisegundo; ¿P(X = 6)?
  example: { lambda: 4, query: 'igual', k: 6 },
  solve: ({ lambda, ...query }) => solveDiscrete(query, poissonModel(lambda)),
};
