/**
 * Distribución gamma con parámetros α (forma) y β (escala) (Walpole, Myers, Myers y Ye,
 * sec. 6.6):
 *
 *   f(x; α, β) = x^{α−1} e^{−x/β} / [β^α Γ(α)],   x > 0,   μ = αβ,   σ² = αβ²   (teorema 6.4)
 *
 * F(x) = F(x/β; α), la función gamma incompleta de la tabla A.23. Si α es entero, X es el tiempo
 * hasta el α-ésimo evento de un proceso de Poisson con media β entre eventos, y
 * F(y; α) = 1 − Σₖ₌₀^{α−1} e^{−y} yᵏ/k!.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { gammaFunction, lnGamma, regularizedGammaP } from '@/lib/math/special';
import type { Calculator, Latex } from '../types';
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

/** Con α entero hasta este valor se muestra la suma de Poisson término a término. */
const MAX_POISSON_TERMS = 8;

export const gammaInputSchema = z
  .object({
    alpha: positiveNumber('α').refine((v) => v <= 1000, 'El máximo permitido es α = 1000.'),
    beta: positiveNumber('β'),
    ...continuousQueryShape,
  })
  .refine(continuousBetweenIsValid, continuousBetweenError);

export type GammaInput = z.infer<typeof gammaInputSchema>;

const n = toLatexNumber;

/** 1 − e^{−y}(1 + y + y²/2! + …) con los números de y. */
function poissonSum(y: number, alpha: number): Latex {
  const yTex = toLatexOperand(y);
  const power = (k: number) =>
    Number.isInteger(y) && y >= 0 ? `${n(y)}^{${k}}` : `(${n(y)})^{${k}}`;
  const terms = Array.from({ length: alpha }, (_, k) =>
    k === 0 ? '1' : k === 1 ? yTex : `\\frac{${power(k)}}{${k}!}`,
  );
  return `1 - e^{-${yTex}}\\left(${terms.join(' + ')}\\right)`;
}

function gammaModel(alpha: number, beta: number): ContinuousModel {
  const integer = Number.isInteger(alpha);
  const lnNormalizer = alpha * Math.log(beta) + lnGamma(alpha);
  return {
    name: 'gamma',
    support: [0, Infinity],
    pdf: (x) => {
      if (x < 0) return 0;
      if (x === 0) return alpha < 1 ? Infinity : alpha === 1 ? 1 / beta : 0;
      return Math.exp((alpha - 1) * Math.log(x) - x / beta - lnNormalizer);
    },
    cdf: (x) => regularizedGammaP(alpha, x / beta),
    pdfFormula: `\\frac{1}{\\beta^{\\alpha}\\Gamma(\\alpha)} x^{\\alpha-1} e^{-x/\\beta} = \\frac{1}{(${n(beta)})^{${n(alpha)}}\\,\\Gamma(${n(alpha)})} x^{${n(alpha - 1)}} e^{-x/${n(beta)}}, \\quad x > 0`,
    cdfFormula:
      integer && alpha <= MAX_POISSON_TERMS
        ? 'F\\left(\\tfrac{x}{\\beta};\\ \\alpha\\right) = 1 - \\sum_{k=0}^{\\alpha-1} \\frac{e^{-x/\\beta} (x/\\beta)^k}{k!}'
        : 'F\\left(\\tfrac{x}{\\beta};\\ \\alpha\\right) = \\int_0^{x/\\beta} \\frac{y^{\\alpha-1} e^{-y}}{\\Gamma(\\alpha)}\\,dy',
    cdfExplanation:
      integer && alpha <= MAX_POISSON_TERMS
        ? 'Con y = x/β, F(x) es la función gamma incompleta F(y; α) de la tabla A.23 de Walpole. Como α es entero, X es el tiempo hasta el α-ésimo evento de Poisson: X ≤ x si hay al menos α eventos antes de x, de ahí la suma de Poisson.'
        : 'Con y = x/β, F(x) es la función gamma incompleta F(y; α) de la tabla A.23 de Walpole. Aquí se calcula numéricamente; con la tabla se lee con y redondeado.',
    cdfSubstitution: (x) => {
      const y = x / beta;
      const head = `F\\left(\\tfrac{${n(x)}}{${n(beta)}};\\ ${n(alpha)}\\right) = F(${n(y)};\\ ${n(alpha)})`;
      return integer && alpha <= MAX_POISSON_TERMS ? `${head} = ${poissonSum(y, alpha)}` : head;
    },
    mean: alpha * beta,
    variance: alpha * beta ** 2,
    meanFormula: `\\alpha\\beta = (${n(alpha)})(${n(beta)})`,
    varianceFormula: `\\alpha\\beta^2 = (${n(alpha)})(${n(beta)})^2`,
    explanation: `α = ${formatNumber(alpha)} da la forma y β = ${formatNumber(beta)} la escala. ${
      integer
        ? `Con α entero, X es el tiempo hasta que ocurren α eventos de Poisson, con un tiempo medio β entre eventos (β = 1/λ si te dan la tasa λ).`
        : 'La familia gamma incluye a la exponencial (α = 1) y a la chi cuadrada (α = ν/2, β = 2).'
    }${alpha < 1 ? ' Con α < 1 la densidad no está acotada cerca de 0.' : ''} Γ(${formatNumber(alpha)}) = ${formatNumber(gammaFunction(alpha), 8)}.`,
  };
}

export const gamma: Calculator<GammaInput, ContinuousValue, ContinuousErrorCode> = {
  meta: {
    id: 'distribucion-gamma',
    title: 'Distribución gamma',
    summary: 'Probabilidades para la distribución gamma(α, β), con la función gamma incompleta.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 6.6, Ejemplos 6.18 a 6.20; teorema 6.4; tabla A.23 (9.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: gammaInputSchema,
  // Walpole, ejemplo 6.19: tiempo de supervivencia de ratas gamma con α = 5 y β = 10 semanas;
  // ¿P(X < 60)?
  example: { alpha: 5, beta: 10, query: 'menor', x: 60 },
  solve: ({ alpha, beta, ...query }) => solveContinuous(query, gammaModel(alpha, beta)),
};
