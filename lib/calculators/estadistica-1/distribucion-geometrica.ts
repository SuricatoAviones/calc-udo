/**
 * Distribución geométrica: número X del ensayo en el que ocurre el primer éxito (Walpole, Myers,
 * Myers y Ye, sec. 5.4):
 *
 *   g(x; p) = p qˣ⁻¹,   x = 1, 2, 3, …,   μ = 1/p,   σ² = (1 − p)/p²   (teorema 5.3)
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

export const geometricInputSchema = z
  .object({
    p: z
      .number({ error: 'Ingresa la probabilidad de éxito p.' })
      .refine((v) => v > 0, 'p debe ser mayor que 0: si nunca hay éxito, no hay primer éxito.')
      .refine((v) => v <= 1, 'p es una probabilidad: no puede pasar de 1.'),
    ...discreteQueryShape,
  })
  .refine(betweenIsValid, betweenError);

export type GeometricInput = z.infer<typeof geometricInputSchema>;

const n = toLatexNumber;

function geometricModel(p: number): DiscreteModel {
  const q = 1 - p;
  return {
    name: 'geométrica',
    min: 1,
    max: Infinity,
    pmf: (x) => (x < 1 ? 0 : p * q ** (x - 1)),
    notation: (x) => `g(${x};\\ ${n(p)})`,
    pmfFormula: 'p\\,q^{x-1}',
    pmfSubstitution: (x) => `(${n(p)})(${n(q)})^{${x - 1}}`,
    mean: 1 / p,
    variance: q / p ** 2,
    meanFormula: `\\frac{1}{p} = \\frac{1}{${n(p)}}`,
    varianceFormula: `\\frac{1-p}{p^2} = \\frac{${n(q)}}{(${n(p)})^2}`,
    explanation: `X es el número del ensayo en el que ocurre el primer éxito, con ensayos independientes y probabilidad de éxito p = ${formatNumber(p)} en cada uno. Antes del éxito hay x − 1 fracasos, cada uno con probabilidad q = 1 − p = ${formatNumber(q)}.`,
  };
}

export const geometric: Calculator<GeometricInput, DiscreteValue, DiscreteErrorCode> = {
  meta: {
    id: 'distribucion-geometrica',
    title: 'Distribución geométrica',
    summary: 'Probabilidad de que el primer éxito ocurra en el ensayo x.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 5.4, Ejemplos 5.15 y 5.16; teorema 5.3 (9.ª ed. en español)',
      },
      { sourceId: 'meyer-1998' },
      { sourceId: 'canavos-1995' },
    ],
  },
  inputSchema: geometricInputSchema,
  // Walpole, ejemplo 5.15: 1 de cada 100 artículos es defectuoso; ¿el quinto inspeccionado es el
  // primer defectuoso?
  example: { p: 0.01, query: 'igual', k: 5 },
  solve: ({ p, ...query }) => solveDiscrete(query, geometricModel(p)),
};
