/**
 * Distribución de Pascal o binomial negativa: número X del ensayo en el que ocurre el k-ésimo
 * éxito (Walpole, Myers, Myers y Ye, sec. 5.4; Meyer la llama distribución de Pascal):
 *
 *   b*(x; k, p) = C(x − 1, k − 1) pᵏ qˣ⁻ᵏ,   x = k, k + 1, …,   μ = k/p,   σ² = kq/p²
 *
 * X es la suma de k variables geométricas independientes (el número de ensayos hasta cada éxito),
 * de ahí su media y su varianza (teorema 5.3 multiplicado por k).
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

export const pascalInputSchema = z
  .object({
    successes: z
      .number({ error: 'Ingresa el número de éxitos k.' })
      .int('k debe ser un número entero.')
      .min(1, 'k debe ser al menos 1.')
      .max(100, 'El máximo permitido es k = 100.'),
    p: z
      .number({ error: 'Ingresa la probabilidad de éxito p.' })
      .refine((v) => v > 0, 'p debe ser mayor que 0: sin éxitos nunca se llega al k-ésimo.')
      .refine((v) => v <= 1, 'p es una probabilidad: no puede pasar de 1.'),
    ...discreteQueryShape,
  })
  .refine(betweenIsValid, betweenError);

export type PascalInput = z.infer<typeof pascalInputSchema>;

const n = toLatexNumber;

function pascalModel(k: number, p: number): DiscreteModel {
  const q = 1 - p;
  const pmf = (x: number) => {
    if (x < k) return 0;
    if (q === 0) return x === k ? 1 : 0;
    // En logaritmos para evitar desbordes con x grande.
    const lnC = lnFactorial(x - 1) - lnFactorial(k - 1) - lnFactorial(x - k);
    return Math.exp(lnC + k * Math.log(p) + (x - k) * Math.log(q));
  };
  return {
    name: 'de Pascal (binomial negativa)',
    min: k,
    max: Infinity,
    pmf,
    notation: (x) => `b^*(${x};\\ ${k}, ${n(p)})`,
    pmfFormula: '\\binom{x-1}{k-1} p^k q^{\\,x-k}',
    pmfSubstitution: (x) =>
      `\\binom{${x - 1}}{${k - 1}} (${n(p)})^{${k}} (${n(q)})^{${x - k}} = ${formatNumber(combinations(x - 1, k - 1))}\\,(${n(p ** k)})(${n(q ** (x - k))})`,
    mean: k / p,
    variance: (k * q) / p ** 2,
    meanFormula: `\\frac{k}{p} = \\frac{${k}}{${n(p)}}`,
    varianceFormula: `\\frac{kq}{p^2} = \\frac{${k}(${n(q)})}{(${n(p)})^2}`,
    explanation: `X es el número del ensayo en el que ocurre el éxito número k = ${k}, con ensayos independientes y probabilidad de éxito p = ${formatNumber(p)}. El último ensayo es un éxito, y en los x − 1 anteriores hay k − 1 éxitos en cualquier orden: de ahí el coeficiente C(x − 1, k − 1).`,
  };
}

export const pascal: Calculator<PascalInput, DiscreteValue, DiscreteErrorCode> = {
  meta: {
    id: 'distribucion-de-pascal',
    title: 'Distribución de Pascal',
    summary: 'Probabilidad de que el k-ésimo éxito ocurra en el ensayo x (binomial negativa).',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 5.4, Ejemplo 5.14 (9.ª ed. en español)',
      },
      { sourceId: 'meyer-1998', locator: 'Distribución de Pascal' },
      { sourceId: 'canavos-1995' },
    ],
  },
  inputSchema: pascalInputSchema,
  // Walpole, ejemplo 5.14: gana la serie quien gane 4 juegos; A gana cada juego con p = 0.55.
  // ¿Probabilidad de que A gane la serie en 6 juegos?
  example: { successes: 4, p: 0.55, query: 'igual', k: 6 },
  solve: ({ successes, p, ...query }) => solveDiscrete(query, pascalModel(successes, p)),
};
