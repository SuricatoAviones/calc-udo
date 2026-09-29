/**
 * Distribución beta en (0, 1), para proporciones (Walpole, Myers, Myers y Ye, sec. 6.8):
 *
 *   f(x; α, β) = x^{α−1} (1 − x)^{β−1} / B(α, β),   0 < x < 1,   B(α, β) = Γ(α)Γ(β)/Γ(α + β)
 *   μ = α/(α + β),   σ² = αβ / [(α + β)²(α + β + 1)]   (teorema 6.6)
 *
 * F(x) = Iₓ(α, β), la función beta incompleta regularizada. Con α = β = 1 es la uniforme en (0, 1).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { lnGamma, regularizedBeta } from '@/lib/math/special';
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

const parameter = (label: string) =>
  positiveNumber(label).refine((v) => v <= 1000, `El máximo permitido es ${label} = 1000.`);

export const betaInputSchema = z
  .object({
    alpha: parameter('α'),
    beta: parameter('β'),
    ...continuousQueryShape,
  })
  .refine(continuousBetweenIsValid, continuousBetweenError);

export type BetaInput = z.infer<typeof betaInputSchema>;

const n = toLatexNumber;

function betaModel(alpha: number, beta: number): ContinuousModel {
  const lnB = lnGamma(alpha) + lnGamma(beta) - lnGamma(alpha + beta);
  const B = Math.exp(lnB);
  const total = alpha + beta;
  return {
    name: 'beta',
    support: [0, 1],
    pdf: (x) => {
      if (x < 0 || x > 1) return 0;
      if (x === 0 || x === 1) return (x ** (alpha - 1) * (1 - x) ** (beta - 1)) / B;
      return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - lnB);
    },
    cdf: (x) => regularizedBeta(x, alpha, beta),
    pdfFormula: `\\frac{x^{\\alpha-1}(1-x)^{\\beta-1}}{B(\\alpha, \\beta)} = \\frac{x^{${n(alpha - 1)}}(1-x)^{${n(beta - 1)}}}{${n(B)}}, \\quad 0 < x < 1`,
    cdfFormula:
      'I_x(\\alpha, \\beta) = \\frac{1}{B(\\alpha, \\beta)} \\int_0^x t^{\\alpha-1}(1-t)^{\\beta-1}\\,dt',
    cdfExplanation:
      'F(x) es la función beta incompleta regularizada. Si α y β son enteros, la integral es un polinomio (con α = β = 2, F(x) = 3x² − 2x³); en general se calcula numéricamente.',
    cdfSubstitution: (x) =>
      `I_{${n(x)}}(${n(alpha)}, ${n(beta)}) = \\frac{1}{${n(B)}} \\int_0^{${n(x)}} t^{${n(alpha - 1)}}(1-t)^{${n(beta - 1)}}\\,dt`,
    mean: alpha / total,
    variance: (alpha * beta) / (total ** 2 * (total + 1)),
    meanFormula: `\\frac{\\alpha}{\\alpha + \\beta} = \\frac{${n(alpha)}}{${n(total)}}`,
    varianceFormula: `\\frac{\\alpha\\beta}{(\\alpha + \\beta)^2(\\alpha + \\beta + 1)} = \\frac{(${n(alpha)})(${n(beta)})}{(${n(total)})^2(${n(total + 1)})}`,
    explanation: `X es una proporción entre 0 y 1 (p. ej. la fracción de un lote o de una capacidad). B(α, β) = Γ(α)Γ(β)/Γ(α + β) = ${formatNumber(B, 8)} hace que el área total sea 1.`,
  };
}

export const beta: Calculator<BetaInput, ContinuousValue, ContinuousErrorCode> = {
  meta: {
    id: 'distribucion-beta',
    title: 'Distribución beta',
    summary: 'Probabilidades para una proporción con distribución beta(α, β) en (0, 1).',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator:
          'Sec. 6.8, definición 6.3 y teorema 6.6; ejercicios 6.49 y 6.50 (9.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
    ],
  },
  inputSchema: betaInputSchema,
  // Walpole, ejercicio 6.50: la proporción de televisores que requieren servicio es beta(2, 2);
  // ¿probabilidad de que al menos el 80 % lo requiera?
  example: { alpha: 2, beta: 2, query: 'mayor', x: 0.8 },
  solve: ({ alpha, beta: b, ...query }) => solveContinuous(query, betaModel(alpha, b)),
};
