/**
 * Funciones especiales para las distribuciones continuas: Γ(x), ln Γ(x), la función gamma
 * incompleta regularizada P(a, x) y la función beta incompleta regularizada Iₓ(a, b).
 *
 * Los libros leen P(a, x) y Iₓ(a, b) de tablas (Walpole, tabla A.23: "función gamma incompleta");
 * aquí se calculan con la serie y la fracción continua de Numerical Recipes (Press et al., cap. 6),
 * con error relativo del orden de 10⁻¹⁴.
 */
import { gamma as mathGamma } from 'mathjs';

const EPSILON = 1e-15;
const TINY = 1e-300;
const MAX_ITERATIONS = 10_000;

// Coeficientes de Lanczos con g = 7 y 9 términos (error relativo ~10⁻¹⁵). La `lgamma` de mathjs
// tiene errores de ~10⁻¹², que se notan en la beta incompleta.
const LANCZOS_G = 7;
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
] as const;

/** Γ(x). */
export function gammaFunction(x: number): number {
  return mathGamma(x);
}

/** ln |Γ(x)|, con la aproximación de Lanczos (y la fórmula de reflexión para x < 1/2). */
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  const z = x - 1;
  const t = z + LANCZOS_G + 0.5;
  let series: number = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) series += LANCZOS[i]! / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(series);
}

/**
 * P(a, x) = [1/Γ(a)] ∫₀ˣ tᵃ⁻¹ e⁻ᵗ dt, la función de distribución de una gamma(a, 1). Es la
 * F(x; α) de la tabla A.23 de Walpole. Serie para x < a + 1; fracción continua para Q = 1 − P en
 * otro caso.
 */
export function regularizedGammaP(a: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(a) || a <= 0) return Number.NaN;
  if (x <= 0) return 0;
  if (x === Infinity) return 1;
  const front = Math.exp(-x + a * Math.log(x) - lnGamma(a));
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < MAX_ITERATIONS; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * EPSILON) break;
    }
    return Math.min(1, sum * front);
  }
  // Fracción continua de Q(a, x) por el método de Lentz modificado.
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < MAX_ITERATIONS; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return Math.max(0, 1 - front * h);
}

/** Fracción continua de la beta incompleta (Numerical Recipes, betacf). */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < MAX_ITERATIONS; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return h;
}

/**
 * Iₓ(a, b) = [1/B(a, b)] ∫₀ˣ tᵃ⁻¹ (1 − t)ᵇ⁻¹ dt, la función de distribución de una beta(a, b).
 * Usa la simetría Iₓ(a, b) = 1 − I₁₋ₓ(b, a) para que la fracción continua converja rápido.
 */
export function regularizedBeta(x: number, a: number, b: number): number {
  if ([x, a, b].some(Number.isNaN) || a <= 0 || b <= 0) return Number.NaN;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnFront = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  if (x < (a + 1) / (a + b + 2)) {
    return (Math.exp(lnFront) * betaContinuedFraction(x, a, b)) / a;
  }
  return 1 - (Math.exp(lnFront) * betaContinuedFraction(1 - x, b, a)) / b;
}
