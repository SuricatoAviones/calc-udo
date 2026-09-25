import { describe, expect, it } from 'vitest';
import { secant, type SecantInput } from './secant';

function solve(input: Partial<SecantInput>) {
  return secant.solve({ ...secant.example, ...input });
}

function approximations(result: ReturnType<typeof solve>): number[] {
  const table = result.tables.find((t) => t.id === 'iteraciones');
  return (table?.rows ?? []).map((row) => row.xNext as number);
}

describe('Secante', () => {
  // Chapra & Canale, Métodos Numéricos para Ingenieros, ejemplo 6.6 (p. 155 de la 5.ª ed. en
  // español; el pensum cita la 3.ª ed.): f(x) = e^{-x} − x con x₋₁ = 0 y x₀ = 1.0.
  //   1.ª: f(x₋₁) = 1.00000, f(x₀) = −0.63212, x₁ = 0.61270  (εt = 8.0 %)
  //   2.ª: f(x₁) = −0.07081, x₂ = 0.56384                     (εt = 0.58 %)
  //   3.ª: f(x₂) = 0.00518,  x₃ = 0.56717                     (εt = 0.0048 %)
  // Raíz verdadera: 0.56714329.
  describe('Chapra, ejemplo 6.6: f(x) = e^{-x} − x, x₋₁ = 0, x₀ = 1', () => {
    const result = solve({});

    it('reproduce las tres iteraciones del libro', () => {
      const [x1, x2, x3] = approximations(result);
      expect(x1).toBeCloseTo(0.6127, 5);
      expect(x2).toBeCloseTo(0.56384, 5);
      expect(x3).toBeCloseTo(0.56717, 5);
    });

    it('reproduce los valores de f del libro', () => {
      const rows = result.tables[0]?.rows ?? [];
      expect(rows[0]?.fPrev).toBeCloseTo(1, 5);
      expect(rows[0]?.fCurr).toBeCloseTo(-0.63212, 5);
      expect(rows[1]?.fCurr).toBeCloseTo(-0.07081, 5);
      expect(rows[2]?.fCurr).toBeCloseTo(0.00518, 5);
    });

    it('los errores verdaderos coinciden con el libro', () => {
      const et = approximations(result).map((x) => (Math.abs(0.56714329 - x) / 0.56714329) * 100);
      expect(et[0]).toBeCloseTo(8.0, 1);
      expect(et[1]).toBeCloseTo(0.58, 2);
      expect(et[2]).toBeCloseTo(0.0048, 4);
    });

    it('converge a la raíz verdadera', () => {
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.root).toBeCloseTo(0.56714329, 7);
    });
  });

  // Chapra & Canale, ejemplo 6.7 (p. 156): f(x) = ln x con x₋₁ = 0.5 y x₀ = 5.0.
  //   Iter  x_{i−1}  x_i     x_{i+1}
  //   1     0.5      5.0     1.8546
  //   2     5.0      1.8546  −0.10438
  // "Como se ve en la figura 6.8d, el método diverge": ln de un negativo no es real.
  describe('Chapra, ejemplo 6.7: f(x) = ln x diverge con la secante', () => {
    const result = solve({ expression: 'ln(x)', xPrev: 0.5, x0: 5 });

    it('reproduce las dos iteraciones del libro', () => {
      const [x1, x2] = approximations(result);
      expect(x1).toBeCloseTo(1.8546, 4);
      expect(x2).toBeCloseTo(-0.10438, 5);
    });

    it('se detiene con non-finite y conserva la traza', () => {
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('non-finite');
      expect(result.steps.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('casos borde (verificados analíticamente)', () => {
    // f(x) = x^2 − 4 con x₋₁ = −3 y x₀ = 3: f(−3) = f(3) = 5, la secante es horizontal.
    it('f(x_{i−1}) = f(x_i) → zero-denominator', () => {
      const result = solve({ expression: 'x^2 - 4', xPrev: -3, x0: 3 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('zero-denominator');
    });

    // f(x) = 2x − 4 es lineal: la secante coincide con la función y da x₁ = 2 exacto.
    it('una función lineal se resuelve en una iteración', () => {
      const result = solve({ expression: '2x - 4', xPrev: 0, x0: 10, tolerance: 1e-9 });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.root).toBe(2);
    });

    it('los dos valores iniciales deben ser distintos', () => {
      expect(secant.inputSchema.safeParse({ ...secant.example, xPrev: 1, x0: 1 }).success).toBe(
        false,
      );
    });

    it('max-iterations', () => {
      const result = solve({ tolerance: 1e-12, maxIterations: 2 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('max-iterations');
    });
  });
});
