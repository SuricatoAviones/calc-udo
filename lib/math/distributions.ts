/**
 * Distribuciones de muestreo para pruebas de hipótesis e intervalos de confianza: t de Student,
 * ji-cuadrada y F de Fisher. Densidad, función de distribución y cuantiles.
 *
 * Los libros leen los valores críticos de tablas (Walpole, tablas A.4, A.5 y A.6). Aquí se
 * calculan con las funciones gamma y beta incompletas de special.ts (Numerical Recipes, sec. 6.4):
 *
 *   t:   P(T ≤ t) = 1 − ½ I_{ν/(ν+t²)}(ν/2, ½)            (t ≥ 0; simétrica)
 *   χ²:  P(X ≤ x) = P(ν/2, x/2)                         (gamma incompleta regularizada)
 *   F:   P(F ≤ f) = I_{ν₁f/(ν₁f+ν₂)}(ν₁/2, ν₂/2)
 *
 * Los cuantiles se obtienen invirtiendo la función de distribución por bisección.
 */
import { lnGamma, regularizedBeta, regularizedGammaP } from './special';

// ─── t de Student ───────────────────────────────────────────────────────────

export function studentTCdf(t: number, df: number): number {
  if (Number.isNaN(t) || !(df > 0)) return Number.NaN;
  if (t === Infinity) return 1;
  if (t === -Infinity) return 0;
  const tail = 0.5 * regularizedBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

export function studentTDensity(t: number, df: number): number {
  const lnC = lnGamma((df + 1) / 2) - lnGamma(df / 2) - 0.5 * Math.log(df * Math.PI);
  return Math.exp(lnC - ((df + 1) / 2) * Math.log(1 + (t * t) / df));
}

// ─── Ji-cuadrada ────────────────────────────────────────────────────────────

export function chiSquareCdf(x: number, df: number): number {
  if (Number.isNaN(x) || !(df > 0)) return Number.NaN;
  if (x <= 0) return 0;
  return regularizedGammaP(df / 2, x / 2);
}

export function chiSquareDensity(x: number, df: number): number {
  if (x < 0) return 0;
  if (x === 0) return df === 2 ? 0.5 : df < 2 ? Infinity : 0;
  const k = df / 2;
  return Math.exp((k - 1) * Math.log(x) - x / 2 - k * Math.LN2 - lnGamma(k));
}

// ─── F de Fisher ────────────────────────────────────────────────────────────

export function fCdf(x: number, df1: number, df2: number): number {
  if (Number.isNaN(x) || !(df1 > 0) || !(df2 > 0)) return Number.NaN;
  if (x <= 0) return 0;
  if (x === Infinity) return 1;
  return regularizedBeta((df1 * x) / (df1 * x + df2), df1 / 2, df2 / 2);
}

export function fDensity(x: number, df1: number, df2: number): number {
  if (x < 0) return 0;
  if (x === 0) return df1 === 2 ? 1 : df1 < 2 ? Infinity : 0;
  const lnB = lnGamma(df1 / 2) + lnGamma(df2 / 2) - lnGamma((df1 + df2) / 2);
  const lnNum =
    (df1 / 2) * Math.log(df1 / df2) +
    (df1 / 2 - 1) * Math.log(x) -
    ((df1 + df2) / 2) * Math.log(1 + (df1 * x) / df2);
  return Math.exp(lnNum - lnB);
}

// ─── Cuantiles ──────────────────────────────────────────────────────────────

/**
 * x tal que cdf(x) = p, para una función creciente, buscando en [lo, ∞): se amplía el intervalo y
 * luego se biseca hasta la precisión de la máquina.
 */
function invert(cdf: (x: number) => number, p: number, lo: number, start: number): number {
  if (Number.isNaN(p) || p < 0 || p > 1) return Number.NaN;
  if (p === 0) return lo === -Infinity ? -Infinity : lo;
  if (p === 1) return Infinity;
  let low = lo === -Infinity ? -start : lo;
  let high = start;
  while (cdf(high) < p) high *= 2;
  while (lo === -Infinity && cdf(low) > p) low *= 2;
  for (let i = 0; i < 300; i++) {
    const mid = (low + high) / 2;
    if (cdf(mid) < p) low = mid;
    else high = mid;
    if (high - low <= 1e-14 * Math.max(1, Math.abs(mid))) break;
  }
  return (low + high) / 2;
}

/** t tal que P(T ≤ t) = p. */
export function studentTQuantile(p: number, df: number): number {
  return invert((t) => studentTCdf(t, df), p, -Infinity, 1);
}

/** x tal que P(χ² ≤ x) = p. */
export function chiSquareQuantile(p: number, df: number): number {
  return invert((x) => chiSquareCdf(x, df), p, 0, Math.max(1, df));
}

/** f tal que P(F ≤ f) = p. */
export function fQuantile(p: number, df1: number, df2: number): number {
  return invert((x) => fCdf(x, df1, df2), p, 0, 1);
}
