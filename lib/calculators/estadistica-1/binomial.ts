/**
 * Distribución binomial: número de éxitos en n ensayos independientes de Bernoulli con
 * probabilidad de éxito p (Walpole, Myers y Myers, sec. 5.2):
 *
 *   b(x; n, p) = C(n, x) pˣ qⁿ⁻ˣ,   q = 1 − p,   μ = np,   σ² = npq   (teorema 5.1)
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator } from '../types';
import {
  betweenError,
  betweenIsValid,
  combinations,
  discreteQueryShape,
  lnFactorial,
  solveDiscrete,
  type DiscreteErrorCode,
  type DiscreteModel,
  type DiscreteValue,
} from './discrete';

export const binomialInputSchema = z
  .object({
    n: z
      .number({ error: 'Ingresa el número de ensayos n.' })
      .int('n debe ser un número entero.')
      .min(1, 'n debe ser al menos 1.')
      .max(1000, 'El máximo permitido es n = 1000.'),
    p: z
      .number({ error: 'Ingresa la probabilidad de éxito p.' })
      .min(0, 'p es una probabilidad: debe estar entre 0 y 1.')
      .max(1, 'p es una probabilidad: debe estar entre 0 y 1.'),
    ...discreteQueryShape,
  })
  .refine(betweenIsValid, betweenError)
  .refine((v) => v.k <= v.n && (v.k2 === undefined || v.k2 <= v.n), {
    message: 'Los valores de X van de 0 a n.',
    path: ['k'],
  });

export type BinomialInput = z.infer<typeof binomialInputSchema>;

const n = toLatexNumber;

function binomialModel(trials: number, p: number): DiscreteModel {
  const q = 1 - p;
  const pmf = (x: number) => {
    if (x < 0 || x > trials) return 0;
    if (p === 0) return x === 0 ? 1 : 0;
    if (p === 1) return x === trials ? 1 : 0;
    // En logaritmos para evitar desbordes con n grande.
    const lnC = lnFactorial(trials) - lnFactorial(x) - lnFactorial(trials - x);
    return Math.exp(lnC + x * Math.log(p) + (trials - x) * Math.log(q));
  };
  return {
    name: 'binomial',
    max: trials,
    pmf,
    notation: (x) => `b(${x};\\ ${trials}, ${n(p)})`,
    pmfFormula: '\\binom{n}{x} p^x q^{\\,n-x}',
    pmfSubstitution: (x) =>
      `\\binom{${trials}}{${x}} (${n(p)})^{${x}} (${n(q)})^{${trials - x}} = ${formatNumber(combinations(trials, x))}\\,(${n(p ** x)})(${n(q ** (trials - x))})`,
    mean: trials * p,
    variance: trials * p * q,
    meanFormula: `np = ${trials}(${n(p)})`,
    varianceFormula: `npq = ${trials}(${n(p)})(${n(q)})`,
    explanation: `X cuenta los éxitos en n = ${trials} ensayos independientes, cada uno con probabilidad de éxito p = ${formatNumber(p)} (q = 1 − p = ${formatNumber(q)}).`,
  };
}

export const binomial: Calculator<BinomialInput, DiscreteValue, DiscreteErrorCode> = {
  meta: {
    id: 'distribucion-binomial',
    title: 'Distribución binomial',
    summary: 'Probabilidad de k éxitos en n ensayos independientes.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 5.2, Ejemplos 5.5 y 5.7 (numeración de la 8.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: binomialInputSchema,
  // Walpole, ejemplo 5.5: 15 pacientes, p = 0.4; ¿probabilidad de que sobrevivan al menos 10?
  example: { n: 15, p: 0.4, query: 'mayor-igual', k: 10 },
  solve: ({ n: trials, p, ...query }) => solveDiscrete(query, binomialModel(trials, p)),
};
