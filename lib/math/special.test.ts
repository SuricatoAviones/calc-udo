import { describe, expect, it } from 'vitest';
import { gammaFunction, lnGamma, regularizedBeta, regularizedGammaP } from './special';

// Los valores esperados son identidades analíticas o valores de las tablas de Walpole, Myers,
// Myers y Ye, 9.ª ed. en español (Pearson, 2012).

describe('gammaFunction y lnGamma', () => {
  // Γ(n) = (n − 1)! para enteros; Γ(1/2) = √π (Walpole, ejercicio 6.39, p. 206).
  it('coincide con el factorial y con Γ(1/2) = √π', () => {
    expect(gammaFunction(5)).toBeCloseTo(24, 10);
    expect(gammaFunction(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 12);
    expect(gammaFunction(1.5)).toBeCloseTo(Math.sqrt(Math.PI) / 2, 12);
    expect(lnGamma(10)).toBeCloseTo(Math.log(362880), 10);
    // x < 1/2 usa la fórmula de reflexión Γ(x)Γ(1 − x) = π / sen(πx).
    expect(lnGamma(0.25) + lnGamma(0.75)).toBeCloseTo(
      Math.log(Math.PI / Math.sin(Math.PI / 4)),
      13,
    );
    expect(lnGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 14);
  });
});

describe('regularizedGammaP', () => {
  // Con a = 1 es la exponencial: P(1, x) = 1 − e⁻ˣ.
  it('P(1, x) = 1 − e^{−x}', () => {
    for (const x of [0.1, 1, 2.5, 10])
      expect(regularizedGammaP(1, x)).toBeCloseTo(1 - Math.exp(-x), 13);
  });

  // Con a entero, P(a, x) = 1 − Σₖ₌₀^{a−1} e⁻ˣ xᵏ/k! (relación con Poisson, Walpole sec. 6.6).
  // Tabla A.23: F(6; 5) = 0.715 (ejemplo 6.19) y F(5; 2) = 0.96 (ejemplo 6.20).
  it('valores de la tabla A.23 y la suma de Poisson', () => {
    expect(regularizedGammaP(5, 6)).toBeCloseTo(0.715, 3);
    expect(regularizedGammaP(5, 6)).toBeCloseTo(1 - 115 * Math.exp(-6), 13);
    expect(regularizedGammaP(2, 5)).toBeCloseTo(0.96, 2);
    expect(regularizedGammaP(2, 5)).toBeCloseTo(1 - 6 * Math.exp(-5), 13);
  });

  // Caso borde: la función cambia de la serie a la fracción continua en x = a + 1; los dos lados
  // deben coincidir. P(3, 4) = 1 − e⁻⁴(1 + 4 + 8).
  it('es continua donde cambia de método', () => {
    expect(regularizedGammaP(3, 4)).toBeCloseTo(1 - 13 * Math.exp(-4), 13);
    expect(regularizedGammaP(3, 4 - 1e-9)).toBeCloseTo(regularizedGammaP(3, 4 + 1e-9), 8);
  });

  // Con a = 1/2, P(1/2, x) = erf(√x): la chi cuadrada con 1 grado de libertad es gamma(1/2, 2)
  // (sec. 6.7) y χ²₀.₀₅ = 3.841 (tabla A.5), así que P(1/2, 3.841/2) ≈ 0.95.
  it('a no entero: chi cuadrada con 1 grado de libertad', () => {
    expect(regularizedGammaP(0.5, 3.841 / 2)).toBeCloseTo(0.95, 3);
  });

  it('bordes', () => {
    expect(regularizedGammaP(2, 0)).toBe(0);
    expect(regularizedGammaP(2, -1)).toBe(0);
    expect(regularizedGammaP(2, Infinity)).toBe(1);
    expect(regularizedGammaP(0, 1)).toBeNaN();
  });
});

describe('regularizedBeta', () => {
  // Identidades analíticas: Iₓ(a, 1) = xᵃ, Iₓ(1, b) = 1 − (1 − x)ᵇ, I_{1/2}(a, a) = 1/2 y
  // Iₓ(2, 2) = 3x² − 2x³ (la densidad de la beta(2, 2) es 6x(1 − x)).
  it('identidades analíticas', () => {
    expect(regularizedBeta(0.3, 2.5, 1)).toBeCloseTo(0.3 ** 2.5, 13);
    expect(regularizedBeta(0.3, 1, 4)).toBeCloseTo(1 - 0.7 ** 4, 13);
    expect(regularizedBeta(0.5, 7.3, 7.3)).toBeCloseTo(0.5, 13);
    expect(regularizedBeta(0.8, 2, 2)).toBeCloseTo(3 * 0.64 - 2 * 0.512, 13);
    expect(regularizedBeta(0.2, 2, 2)).toBeCloseTo(3 * 0.04 - 2 * 0.008, 13);
  });

  it('simetría Iₓ(a, b) = 1 − I₁₋ₓ(b, a)', () => {
    expect(regularizedBeta(0.35, 3.2, 1.7)).toBeCloseTo(1 - regularizedBeta(0.65, 1.7, 3.2), 13);
  });

  it('bordes', () => {
    expect(regularizedBeta(0, 2, 3)).toBe(0);
    expect(regularizedBeta(1, 2, 3)).toBe(1);
    expect(regularizedBeta(0.5, 0, 3)).toBeNaN();
  });
});
