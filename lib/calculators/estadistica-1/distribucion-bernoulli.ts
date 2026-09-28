/**
 * Distribución de Bernoulli: un solo ensayo con dos resultados, éxito (X = 1) con probabilidad p
 * o fracaso (X = 0) con probabilidad q = 1 − p. Es la binomial con n = 1 (Walpole, Myers, Myers
 * y Ye, sec. 5.2, "proceso de Bernoulli"; Meyer; Canavos):
 *
 *   f(x; p) = pˣ q¹⁻ˣ,   x = 0, 1,   μ = p,   σ² = pq
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator } from '../types';
import {
  betweenError,
  betweenIsValid,
  discreteQueryShape,
  solveDiscrete,
  type DiscreteErrorCode,
  type DiscreteModel,
  type DiscreteValue,
} from './discrete';

export const bernoulliInputSchema = z
  .object({
    p: z
      .number({ error: 'Ingresa la probabilidad de éxito p.' })
      .min(0, 'p es una probabilidad: debe estar entre 0 y 1.')
      .max(1, 'p es una probabilidad: debe estar entre 0 y 1.'),
    ...discreteQueryShape,
  })
  .refine(betweenIsValid, betweenError)
  .refine((v) => v.k <= 1 && (v.k2 === undefined || v.k2 <= 1), {
    message: 'X solo toma los valores 0 (fracaso) y 1 (éxito).',
    path: ['k'],
  });

export type BernoulliInput = z.infer<typeof bernoulliInputSchema>;

const n = toLatexNumber;

function bernoulliModel(p: number): DiscreteModel {
  const q = 1 - p;
  return {
    name: 'de Bernoulli',
    max: 1,
    pmf: (x) => (x === 1 ? p : x === 0 ? q : 0),
    notation: (x) => `f(${x};\\ ${n(p)})`,
    pmfFormula: 'p^x q^{1-x}, \\quad x = 0, 1',
    pmfSubstitution: (x) => `(${n(p)})^{${x}} (${n(q)})^{${1 - x}}`,
    mean: p,
    variance: p * q,
    meanFormula: `p = ${n(p)}`,
    varianceFormula: `pq = (${n(p)})(${n(q)})`,
    explanation: `Un solo ensayo: X = 1 si hay éxito (probabilidad p = ${formatNumber(p)}) y X = 0 si hay fracaso (q = 1 − p = ${formatNumber(q)}). Es la binomial con n = 1.`,
  };
}

export const bernoulli: Calculator<BernoulliInput, DiscreteValue, DiscreteErrorCode> = {
  meta: {
    id: 'distribucion-bernoulli',
    title: 'Distribución de Bernoulli',
    summary: 'Probabilidades, media y varianza de un ensayo con dos resultados.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 5.2, proceso de Bernoulli y teorema 5.1 con n = 1 (9.ª ed. en español)',
      },
      { sourceId: 'meyer-1998' },
      { sourceId: 'canavos-1995' },
    ],
  },
  inputSchema: bernoulliInputSchema,
  // Walpole, ejemplo 5.1: un componente sobrevive a una prueba de choque con probabilidad 3/4.
  example: { p: 0.75, query: 'igual', k: 1 },
  solve: ({ p, ...query }) => solveDiscrete(query, bernoulliModel(p)),
};
