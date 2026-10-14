import { describe, expect, it } from 'vitest';
import {
  dividePoly,
  mulPoly,
  polyFromRoots,
  polyRoots,
  taylorCoefficients,
  type PolyRoot,
} from './polynomials';

/**
 * Casos verificados a mano (factores conocidos) y con los denominadores de los ejemplos de
 * Dorf & Svoboda, 9.ª ed., sec. 14.4: (s + 2)(s + 5), (s² + 6s + 10)(s + 2) y (s + 1)²(s + 2).
 */
function sorted(roots: PolyRoot[]) {
  return roots.map((r) => [r.value.re, r.value.im, r.multiplicity]);
}

describe('polyRoots', () => {
  it('raíces reales simples: s² + 7s + 10 = (s + 2)(s + 5)', () => {
    expect(sorted(polyRoots([1, 7, 10]))).toEqual([
      [-2, 0, 1],
      [-5, 0, 1],
    ]);
  });

  it('par complejo y raíz real: (s² + 6s + 10)(s + 2)', () => {
    const roots = polyRoots(mulPoly([1, 6, 10], [1, 2]));
    expect(sorted(roots)).toEqual([
      [-2, 0, 1],
      [-3, 1, 1],
      [-3, -1, 1],
    ]);
  });

  it('raíz doble exacta: (s + 1)²(s + 2)', () => {
    const roots = polyRoots(mulPoly([1, 2, 1], [1, 2]));
    expect(sorted(roots)).toEqual([
      [-1, 0, 2],
      [-2, 0, 1],
    ]);
  });

  it('raíz en el origen con multiplicidad: s³(s + 4)', () => {
    expect(sorted(polyRoots([1, 4, 0, 0, 0]))).toEqual([
      [0, 0, 3],
      [-4, 0, 1],
    ]);
  });

  it('raíz triple con coeficientes con ruido de coma flotante', () => {
    // (s + 0.1)³ con coeficientes calculados en coma flotante.
    const p = polyFromRoots([
      { re: -0.1, im: 0 },
      { re: -0.1, im: 0 },
      { re: -0.1, im: 0 },
    ]).map((c) => c * (1 + 1e-17));
    const roots = polyRoots(p);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.multiplicity).toBe(3);
    expect(roots[0]!.value.re).toBeCloseTo(-0.1, 6);
  });

  it('polinomio de grado alto con raíces conocidas', () => {
    const expected = [-1, -2, -3, -4, -5, -6];
    const p = polyFromRoots(expected.map((re) => ({ re, im: 0 })));
    const roots = polyRoots(p).map((r) => r.value.re);
    expected.forEach((r, i) => expect(roots[i]).toBeCloseTo(r, 9));
  });
});

describe('aritmética', () => {
  it('división larga: (4s³ + 15s² + s − 30)/(s² + 5s + 6) = 4s − 5 con residuo 2s', () => {
    // Dorf & Svoboda, 9.ª ed., ejemplo 14.4-4 (con el numerador corregido; ver la prueba de la
    // transformada inversa).
    const { quotient, remainder } = dividePoly([4, 15, 1, -30], [1, 5, 6]);
    expect(quotient).toEqual([4, -5]);
    expect(remainder).toEqual([2, 0]);
  });

  it('coeficientes de Taylor: P(x) = x³ alrededor de 1 → 1 + 3h + 3h² + h³', () => {
    const c = taylorCoefficients([1, 0, 0, 0], { re: 1, im: 0 }, 3);
    expect(c.map((z) => z.re)).toEqual([1, 3, 3, 1]);
  });
});
