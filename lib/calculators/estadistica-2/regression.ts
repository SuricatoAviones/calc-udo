/**
 * Sumas y estimadores de la regresión lineal simple (Walpole, Myers, Myers y Ye, sec. 11.3 y
 * 11.5; Canavos, cap. 13):
 *
 *   Sxx = Σ(xᵢ − x̄)²,   Sxy = Σ(xᵢ − x̄)(yᵢ − ȳ),   Syy = Σ(yᵢ − ȳ)²
 *   b₁ = Sxy / Sxx,     b₀ = ȳ − b₁x̄
 *   SSE = Syy − b₁Sxy,  s² = SSE / (n − 2),   R² = 1 − SSE/Syy,   r = Sxy / √(Sxx Syy)
 */
import { z } from 'zod';
import { parsePoints } from '../metodos-numericos/differences';

export const MAX_PAIRS = 1000;

export interface RegressionSums {
  n: number;
  sumX: number;
  sumY: number;
  sumXY: number;
  sumX2: number;
  sumY2: number;
  meanX: number;
  meanY: number;
  sxx: number;
  sxy: number;
  syy: number;
}

export function regressionSums(x: number[], y: number[]): RegressionSums {
  const n = x.length;
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * y[i]!, 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  const sumY2 = y.reduce((s, v) => s + v * v, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  // Con desviaciones respecto de la media (más estable que Σx² − (Σx)²/n).
  const sxx = x.reduce((s, v) => s + (v - meanX) ** 2, 0);
  const syy = y.reduce((s, v) => s + (v - meanY) ** 2, 0);
  const sxy = x.reduce((s, v, i) => s + (v - meanX) * (y[i]! - meanY), 0);
  return { n, sumX, sumY, sumXY, sumX2, sumY2, meanX, meanY, sxx, sxy, syy };
}

/** Valida las listas x, y para una regresión: al menos 3 pares y x no todos iguales. */
export function refinePairs(
  v: { x: string; y: string },
  ctx: z.RefinementCtx,
  min = 3,
): { x: number[]; y: number[] } | null {
  const parsed = parsePoints(v.x, v.y, { min, max: MAX_PAIRS, distinct: false });
  if ('message' in parsed) {
    ctx.addIssue({ code: 'custom', path: [parsed.field], message: parsed.message });
    return null;
  }
  if (new Set(parsed.x).size < 2) {
    ctx.addIssue({
      code: 'custom',
      path: ['x'],
      message: 'Los valores de x no pueden ser todos iguales.',
    });
    return null;
  }
  return parsed;
}

export function readPairs(xText: string, yText: string): { x: number[]; y: number[] } {
  return parsePoints(xText, yText, { max: MAX_PAIRS, distinct: false }) as {
    x: number[];
    y: number[];
  };
}
