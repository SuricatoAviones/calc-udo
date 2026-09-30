/**
 * Probabilidades binomiales y de Poisson para las pruebas de Estadísticas II (sumas exactas de la
 * función de probabilidad, como las tablas A.1 y A.2 de Walpole).
 */
import { lnFactorial } from '../estadistica-1/discrete';

export function binomialPmf(x: number, trials: number, p: number): number {
  if (x < 0 || x > trials || !Number.isInteger(x)) return 0;
  if (p === 0) return x === 0 ? 1 : 0;
  if (p === 1) return x === trials ? 1 : 0;
  const lnC = lnFactorial(trials) - lnFactorial(x) - lnFactorial(trials - x);
  return Math.exp(lnC + x * Math.log(p) + (trials - x) * Math.log(1 - p));
}

/** P(X ≤ x) para X ~ binomial(trials, p). */
export function binomialCdf(x: number, trials: number, p: number): number {
  if (x < 0) return 0;
  if (x >= trials) return 1;
  let sum = 0;
  for (let k = 0; k <= Math.floor(x); k++) sum += binomialPmf(k, trials, p);
  return Math.min(1, sum);
}

export function poissonPmf(x: number, lambda: number): number {
  if (x < 0 || !Number.isInteger(x)) return 0;
  if (lambda === 0) return x === 0 ? 1 : 0;
  return Math.exp(-lambda + x * Math.log(lambda) - lnFactorial(x));
}

/** P(X ≤ x) para X ~ Poisson(λ). */
export function poissonCdf(x: number, lambda: number): number {
  if (x < 0) return 0;
  let sum = 0;
  for (let k = 0; k <= Math.floor(x); k++) sum += poissonPmf(k, lambda);
  return Math.min(1, sum);
}
