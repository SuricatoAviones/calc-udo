import { describe, expect, it } from 'vitest';
import { normalDensity, standardNormalCdf, standardNormalQuantile } from './normal';

// Valores de la tabla de la normal estándar: Hillier & Lieberman, Introducción a la
// Investigación de Operaciones, 7.ª ed. (2001), apéndice 5 (tabla A5.1), tal como se usan en los
// ejemplos de PERT (P(Z ≤ 1) = 1 − 0.1587, cap. 22 de la 8.ª ed.) y de stock de seguridad
// (K₀.₀₅ = 1.645, sec. 19.5). La tabla trae 4 decimales; z_α, 3.

describe('Φ(z)', () => {
  it('reproduce la tabla', () => {
    expect(standardNormalCdf(0)).toBeCloseTo(0.5, 12);
    expect(standardNormalCdf(1)).toBeCloseTo(1 - 0.1587, 4);
    expect(standardNormalCdf(1.645)).toBeCloseTo(0.95, 4);
    expect(standardNormalCdf(-1.96)).toBeCloseTo(0.025, 4);
  });
});

describe('Φ⁻¹(p)', () => {
  it('reproduce los valores críticos de la tabla', () => {
    expect(standardNormalQuantile(0.95)).toBeCloseTo(1.645, 3);
    expect(standardNormalQuantile(0.975)).toBeCloseTo(1.96, 3);
    expect(standardNormalQuantile(0.8413)).toBeCloseTo(1, 3);
    expect(standardNormalQuantile(0.5)).toBe(0);
  });

  // Caso borde analítico: Φ⁻¹ es la inversa de Φ, también en las colas (región p < 0.02425 de la
  // aproximación de Acklam) y es antisimétrica.
  it('es la inversa de Φ en todo el rango, colas incluidas', () => {
    for (const p of [1e-8, 0.001, 0.02, 0.3, 0.69444, 0.99, 0.999999]) {
      expect(standardNormalCdf(standardNormalQuantile(p))).toBeCloseTo(p, 12);
      expect(standardNormalQuantile(1 - p)).toBeCloseTo(-standardNormalQuantile(p), 8);
    }
  });

  it('extremos y valores fuera de rango', () => {
    expect(standardNormalQuantile(0)).toBe(-Infinity);
    expect(standardNormalQuantile(1)).toBe(Infinity);
    expect(standardNormalQuantile(1.2)).toBeNaN();
  });
});

describe('densidad normal', () => {
  // Caso analítico: el máximo de N(μ, σ) es 1/(σ√(2π)).
  it('vale 1/(σ√(2π)) en la media', () => {
    expect(normalDensity(44, 44, 3)).toBeCloseTo(1 / (3 * Math.sqrt(2 * Math.PI)), 12);
  });
});
