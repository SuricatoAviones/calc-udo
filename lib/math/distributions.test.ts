import { describe, expect, it } from 'vitest';
import {
  chiSquareCdf,
  chiSquareDensity,
  chiSquareQuantile,
  fCdf,
  fDensity,
  fQuantile,
  studentTCdf,
  studentTDensity,
  studentTQuantile,
} from './distributions';
import { integrate } from './quadrature';

// Valores críticos de las tablas de Walpole, Myers, Myers y Ye (9.ª ed. en español): tabla A.4
// (t), A.5 (ji-cuadrada) y A.6 (F). Las tablas los dan con 3 decimales (2 para F).

describe('t de Student', () => {
  it('valores críticos de la tabla A.4', () => {
    expect(studentTQuantile(1 - 0.025, 10)).toBeCloseTo(2.228, 3);
    expect(studentTQuantile(1 - 0.05, 11)).toBeCloseTo(1.796, 3);
    expect(studentTQuantile(1 - 0.01, 5)).toBeCloseTo(3.365, 3);
    expect(studentTQuantile(1 - 0.005, 20)).toBeCloseTo(2.845, 3);
    expect(studentTQuantile(1 - 0.025, 30)).toBeCloseTo(2.042, 3);
  });

  it('simetría y límites', () => {
    expect(studentTCdf(0, 7)).toBeCloseTo(0.5, 14);
    expect(studentTCdf(-2, 7)).toBeCloseTo(1 - studentTCdf(2, 7), 14);
    expect(studentTQuantile(0.025, 10)).toBeCloseTo(-2.228, 3);
    // Con muchos grados de libertad se aproxima a la normal: t_{0.025} → 1.96.
    expect(studentTQuantile(0.975, 100000)).toBeCloseTo(1.96, 2);
  });

  it('la densidad integra 1', () => {
    expect(integrate((t) => studentTDensity(t, 4), -Infinity, Infinity).value).toBeCloseTo(1, 8);
  });
});

describe('Ji-cuadrada', () => {
  it('valores críticos de la tabla A.5', () => {
    expect(chiSquareQuantile(1 - 0.05, 1)).toBeCloseTo(3.841, 3);
    expect(chiSquareQuantile(1 - 0.05, 2)).toBeCloseTo(5.991, 3);
    expect(chiSquareQuantile(1 - 0.05, 5)).toBeCloseTo(11.07, 3);
    expect(chiSquareQuantile(1 - 0.05, 9)).toBeCloseTo(16.919, 3);
    expect(chiSquareQuantile(1 - 0.95, 9)).toBeCloseTo(3.325, 3);
    expect(chiSquareQuantile(1 - 0.025, 10)).toBeCloseTo(20.483, 3);
    expect(chiSquareQuantile(1 - 0.975, 10)).toBeCloseTo(3.247, 3);
  });

  // Con 2 grados de libertad la ji-cuadrada es exponencial con media 2: F(x) = 1 − e^{−x/2}.
  it('caso analítico con 2 grados de libertad', () => {
    expect(chiSquareCdf(3, 2)).toBeCloseTo(1 - Math.exp(-1.5), 14);
    expect(chiSquareDensity(3, 2)).toBeCloseTo(0.5 * Math.exp(-1.5), 14);
  });

  it('la densidad integra 1', () => {
    expect(integrate((x) => chiSquareDensity(x, 6), 0, Infinity).value).toBeCloseTo(1, 8);
  });
});

describe('F de Fisher', () => {
  it('valores críticos de la tabla A.6', () => {
    expect(fQuantile(1 - 0.05, 10, 10)).toBeCloseTo(2.98, 2);
    expect(fQuantile(1 - 0.05, 9, 11)).toBeCloseTo(2.9, 2);
    expect(fQuantile(1 - 0.05, 12, 9)).toBeCloseTo(3.07, 2);
    expect(fQuantile(1 - 0.05, 5, 10)).toBeCloseTo(3.33, 2);
    expect(fQuantile(1 - 0.01, 5, 10)).toBeCloseTo(5.64, 2);
  });

  // f_{1−α}(ν₁, ν₂) = 1 / f_α(ν₂, ν₁) (teorema 8.7 de Walpole).
  it('relación entre las colas', () => {
    expect(fQuantile(0.05, 11, 9)).toBeCloseTo(1 / fQuantile(0.95, 9, 11), 10);
    expect(fCdf(1, 7, 7)).toBeCloseTo(0.5, 12);
  });

  it('la densidad integra 1', () => {
    expect(integrate((x) => fDensity(x, 5, 10), 0, Infinity).value).toBeCloseTo(1, 8);
  });
});
