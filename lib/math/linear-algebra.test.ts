import { describe, expect, it } from 'vitest';
import { identity, multiply, solveLinearSystem, vectorTimesMatrix } from './linear-algebra';

describe('solveLinearSystem', () => {
  // Chapra & Canale, ejemplo 9.5 (p. 258 de la 5.ª ed. en español): el sistema
  //   3x₁ − 0.1x₂ − 0.2x₃ = 7.85
  //   0.1x₁ + 7x₂ − 0.3x₃ = −19.3
  //   0.3x₁ − 0.2x₂ + 10x₃ = 71.4
  // tiene solución exacta x = (3, −2.5, 7) (el libro, con 6 cifras, obtiene x₃ = 7.00003).
  it('Chapra, ejemplo 9.5', () => {
    const x = solveLinearSystem(
      [
        [3, -0.1, -0.2],
        [0.1, 7, -0.3],
        [0.3, -0.2, 10],
      ],
      [7.85, -19.3, 71.4],
    );
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(3, 10);
    expect(x![1]).toBeCloseTo(-2.5, 10);
    expect(x![2]).toBeCloseTo(7, 10);
  });

  // Caso que exige pivoteo: el primer pivote es 0. x + y = 3, 2x = 2 → x = 1, y = 2.
  it('usa pivoteo cuando el primer pivote es cero', () => {
    const x = solveLinearSystem(
      [
        [0, 1],
        [2, 0],
      ],
      [2, 2],
    );
    expect(x).toEqual([1, 2]);
  });

  it('devuelve null si el sistema es singular', () => {
    expect(
      solveLinearSystem(
        [
          [1, 2],
          [2, 4],
        ],
        [3, 6],
      ),
    ).toBeNull();
  });

  it('no modifica los argumentos', () => {
    const a = [
      [0, 1],
      [2, 0],
    ];
    const b = [2, 2];
    solveLinearSystem(a, b);
    expect(a).toEqual([
      [0, 1],
      [2, 0],
    ]);
    expect(b).toEqual([2, 2]);
  });
});

describe('producto de matrices', () => {
  // Taha, ejemplo 19.5-1 (7.ª ed. en español): P = [[0.2, 0.8], [0.6, 0.4]] → P² = [[0.52, 0.48],
  // [0.36, 0.64]].
  it('Taha, ejemplo 19.5-1: P²', () => {
    const p = [
      [0.2, 0.8],
      [0.6, 0.4],
    ];
    const p2 = multiply(p, p);
    expect(p2[0]![0]).toBeCloseTo(0.52, 12);
    expect(p2[0]![1]).toBeCloseTo(0.48, 12);
    expect(p2[1]![0]).toBeCloseTo(0.36, 12);
    expect(p2[1]![1]).toBeCloseTo(0.64, 12);
    expect(multiply(p, identity(2))).toEqual(p);
  });

  // Mismo ejemplo: a⁽⁰⁾ = (0.7, 0.3) → a⁽¹⁾ = a⁽⁰⁾P = (0.32, 0.68).
  it('Taha, ejemplo 19.5-1: vector por matriz', () => {
    const a1 = vectorTimesMatrix(
      [0.7, 0.3],
      [
        [0.2, 0.8],
        [0.6, 0.4],
      ],
    );
    expect(a1[0]).toBeCloseTo(0.32, 12);
    expect(a1[1]).toBeCloseTo(0.68, 12);
  });
});
