/**
 * Distribución hipergeométrica: número X de éxitos en una muestra de tamaño n tomada SIN
 * reemplazo de un lote de N artículos, k de ellos éxitos (Walpole, Myers, Myers y Ye, sec. 5.3):
 *
 *   h(x; N, n, k) = C(k, x) C(N − k, n − x) / C(N, n),   máx{0, n − (N − k)} ≤ x ≤ mín{n, k}
 *   μ = nk/N,   σ² = [(N − n)/(N − 1)] · n · (k/N)(1 − k/N)   (teorema 5.2)
 */
import { z } from 'zod';
import { formatNumber } from '@/lib/math/format';
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

/** Con N ≤ 1000, C(N, n) cabe en un double y se puede mostrar en la sustitución. */
const MAX_LOT = 1000;

const count = (label: string, min: number) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .int(`${label} debe ser un número entero.`)
    .min(min, `${label} debe ser al menos ${min}.`)
    .max(MAX_LOT, `El máximo permitido es ${MAX_LOT}.`);

export const hypergeometricInputSchema = z
  .object({
    lotSize: count('el tamaño del lote N', 1),
    successes: count('el número de éxitos del lote k', 0),
    sampleSize: count('el tamaño de la muestra n', 1),
    ...discreteQueryShape,
  })
  .refine((v) => v.successes <= v.lotSize, {
    message: 'El lote no puede tener más éxitos (k) que artículos (N).',
    path: ['successes'],
  })
  .refine((v) => v.sampleSize <= v.lotSize, {
    message: 'Sin reemplazo, la muestra (n) no puede ser mayor que el lote (N).',
    path: ['sampleSize'],
  })
  .refine(betweenIsValid, betweenError)
  .refine((v) => v.k <= v.sampleSize && (v.k2 === undefined || v.k2 <= v.sampleSize), {
    message: 'La muestra no puede tener más éxitos que artículos: x va de 0 a n.',
    path: ['k'],
  });

export type HypergeometricInput = z.infer<typeof hypergeometricInputSchema>;

/** ln C(a, b) sin desbordes. */
const lnCombinations = (a: number, b: number) =>
  lnFactorial(a) - lnFactorial(b) - lnFactorial(a - b);

function hypergeometricModel(lot: number, k: number, size: number): DiscreteModel {
  const min = Math.max(0, size - (lot - k));
  const max = Math.min(size, k);
  const lnTotal = lnCombinations(lot, size);
  const pmf = (x: number) =>
    x < min || x > max
      ? 0
      : Math.exp(lnCombinations(k, x) + lnCombinations(lot - k, size - x) - lnTotal);
  const ratio = k / lot;
  const finite = lot === 1 ? 0 : (lot - size) / (lot - 1);
  const C = (a: number, b: number) => formatNumber(combinations(a, b));
  return {
    name: 'hipergeométrica',
    min,
    max,
    pmf,
    notation: (x) => `h(${x};\\ ${lot}, ${size}, ${k})`,
    pmfFormula: '\\frac{\\binom{k}{x}\\binom{N-k}{n-x}}{\\binom{N}{n}}',
    pmfSubstitution: (x) =>
      `\\frac{\\binom{${k}}{${x}}\\binom{${lot - k}}{${size - x}}}{\\binom{${lot}}{${size}}} = \\frac{(${C(k, x)})(${C(lot - k, size - x)})}{${C(lot, size)}}`,
    mean: size * ratio,
    variance: finite * size * ratio * (1 - ratio),
    meanFormula: `\\frac{nk}{N} = \\frac{(${size})(${k})}{${lot}}`,
    varianceFormula: `\\frac{N-n}{N-1} \\cdot n \\cdot \\frac{k}{N}\\left(1 - \\frac{k}{N}\\right) = \\frac{${lot - size}}{${lot - 1}} \\cdot ${size} \\cdot \\frac{${k}}{${lot}}\\left(1 - \\frac{${k}}{${lot}}\\right)`,
    explanation: `Se toman n = ${size} artículos sin reemplazo de un lote de N = ${lot}, de los cuales k = ${k} son éxitos. Todas las muestras de tamaño n son igualmente probables: se cuentan las que tienen x éxitos (de los k) y n − x fracasos (de los N − k) y se dividen entre el total. X va de ${min} a ${max}.`,
  };
}

export const hypergeometric: Calculator<HypergeometricInput, DiscreteValue, DiscreteErrorCode> = {
  meta: {
    id: 'distribucion-hipergeometrica',
    title: 'Distribución hipergeométrica',
    summary: 'Probabilidad de x éxitos en una muestra tomada sin reemplazo.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 5.3, Ejemplos 5.8, 5.9 y 5.11; teorema 5.2 (9.ª ed. en español)',
      },
      { sourceId: 'meyer-1998' },
      { sourceId: 'canavos-1995' },
    ],
  },
  inputSchema: hypergeometricInputSchema,
  // Walpole, ejemplo 5.9: lote de 40 componentes con 3 defectuosos; se revisan 5. ¿P(X = 1)?
  example: { lotSize: 40, successes: 3, sampleSize: 5, query: 'igual', k: 1 },
  solve: ({ lotSize, successes, sampleSize, ...query }) =>
    solveDiscrete(query, hypergeometricModel(lotSize, successes, sampleSize)),
};
