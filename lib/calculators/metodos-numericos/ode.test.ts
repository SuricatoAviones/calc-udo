import { describe, expect, it } from 'vitest';
import { euler, modifiedEuler, rungeKutta } from './ode-methods';

// Chapra & Canale, Métodos Numéricos para Ingenieros, cap. 25 (5.ª ed. en español, McGraw-Hill
// 2007; el pensum cita la 3.ª ed.).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('Euler', () => {
  // Ejemplo 25.1 y tabla 25.1 (pp. 720-721): dy/dx = −2x³ + 12x² − 20x + 8.5, y(0) = 1, h = 0.5,
  // hasta x = 4. Solución exacta y = −0.5x⁴ + 4x³ − 10x² + 8.5x + 1.
  //   x    y verdadero  y Euler  |εt global| (%)
  //   0.5  3.21875      5.25000  63.1
  //   1.0  3.00000      5.87500  95.8
  //   1.5  2.21875      5.12500  131.0
  //   2.0  2.00000      4.50000  125.0
  //   2.5  2.71875      4.75000  74.7
  //   3.0  4.00000      5.87500  46.9
  //   3.5  4.71875      7.12500  51.0
  //   4.0  3.00000      7.00000  133.3
  const result = ok(euler.solve(euler.example));

  it('reproduce la columna "y Euler" de la tabla 25.1', () => {
    expect(result.value.ys).toEqual([1, 5.25, 5.875, 5.125, 4.5, 4.75, 5.875, 7.125, 7]);
  });

  it('reproduce el valor verdadero y el error global del libro', () => {
    const expectedTrue = [1, 3.21875, 3, 2.21875, 2, 2.71875, 4, 4.71875, 3];
    expectedTrue.forEach((v, i) => expect(result.value.trueValues![i]).toBeCloseTo(v, 10));
    const expectedEt = [63.1, 95.8, 131.0, 125.0, 74.7, 46.9, 51.0, 133.3];
    expectedEt.forEach((v, i) =>
      expect(Math.abs(result.value.trueRelativeErrors![i + 1]!)).toBeCloseTo(v, 1),
    );
  });

  // Ejemplo 25.1: "la pendiente estimada en x = 0 es f(0, 1) = 8.5 … y(0.5) = 1.0 + 8.5(0.5) = 5.25".
  it('la primera pendiente es 8.5', () => {
    expect(result.tables[0]?.rows[0]?.k).toBe(8.5);
  });
});

describe('Euler modificado (Heun sin iterar)', () => {
  // Ejemplo 25.5 y tabla 25.2, columna "1 iteración" (pp. 734-735): y' = 4e^{0.8x} − 0.5y,
  // y(0) = 2, h = 1, hasta x = 4.
  //   x  y verdadero  y Heun      |εt| (%)
  //   1  6.1946314    6.7010819   8.18
  //   2  14.8439219   16.3197819  9.94
  //   3  33.6771718   37.1992489  10.46
  //   4  75.3389626   83.3377674  10.62
  // Primer paso del texto: y'₀ = 3, predictor y⁰₁ = 5, y'₁ = 6.402164, promedio 4.701082.
  const result = ok(modifiedEuler.solve(modifiedEuler.example));

  it('reproduce el primer paso del ejemplo', () => {
    const row = result.tables[0]!.rows[0]!;
    expect(row.k1).toBeCloseTo(3, 12);
    expect(row.predictor).toBeCloseTo(5, 12);
    expect(row.k2).toBeCloseTo(6.402164, 6);
  });

  it('reproduce la tabla 25.2', () => {
    const expected = [2, 6.7010819, 16.3197819, 37.1992489, 83.3377674];
    expected.forEach((v, i) => expect(result.value.ys[i]).toBeCloseTo(v, 6));
    const expectedTrue = [2, 6.1946314, 14.8439219, 33.6771718, 75.3389626];
    expectedTrue.forEach((v, i) => expect(result.value.trueValues![i]).toBeCloseTo(v, 6));
    const expectedEt = [8.18, 9.94, 10.46, 10.62];
    expectedEt.forEach((v, i) =>
      expect(Math.abs(result.value.trueRelativeErrors![i + 1]!)).toBeCloseTo(v, 2),
    );
  });
});

describe('Runge-Kutta de cuarto orden', () => {
  // Ejemplo 25.7a (p. 747): la misma EDO polinomial del ejemplo 25.1 con h = 0.5:
  // k₁ = 8.5, k₂ = 4.21875, k₃ = 4.21875, k₄ = 1.25 → y(0.5) = 3.21875, que es exacta.
  it('Chapra, ejemplo 25.7a: exacto para la EDO polinomial', () => {
    const result = ok(rungeKutta.solve({ ...euler.example, xf: 0.5 }));
    expect(result.tables[0]?.rows[0]).toMatchObject({
      k1: 8.5,
      k2: 4.21875,
      k3: 4.21875,
      k4: 1.25,
    });
    expect(result.value.yFinal).toBeCloseTo(3.21875, 12);
  });

  // Ejemplo 25.7b (p. 748): y' = 4e^{0.8x} − 0.5y, y(0) = 2, h = 0.5:
  // k₁ = 3, k₂ = 3.510611, k₃ = 3.446785, k₄ = 4.105603, φ = 3.503399 → y(0.5) = 3.751669;
  // la solución verdadera es 3.751521.
  // ERRATA del libro: con su propio φ, y(0.5) = 2 + 3.503399(0.5) = 3.7516995; el "3.751669"
  // impreso tiene dos dígitos transpuestos (en la misma página también se lee "3.071785" donde
  // debería decir k₃ = 3.446785). Por eso se verifica y(0.5) contra 2 + 0.5φ con el φ del libro.
  it('Chapra, ejemplo 25.7b: EDO exponencial', () => {
    const result = ok(rungeKutta.solve({ ...rungeKutta.example, xf: 0.5 }));
    const row = result.tables[0]!.rows[0]!;
    expect(row.k1).toBeCloseTo(3, 12);
    expect(row.k2).toBeCloseTo(3.510611, 6);
    expect(row.k3).toBeCloseTo(3.446785, 6);
    expect(row.k4).toBeCloseTo(4.105603, 6);
    const bookPhi = 3.503399;
    expect(result.value.yFinal).toBeCloseTo(2 + 0.5 * bookPhi, 6);
    expect(result.value.trueValues![1]).toBeCloseTo(3.751521, 6);
  });
});

describe('validación y fallos', () => {
  it('h debe dividir el intervalo en pasos enteros', () => {
    expect(euler.inputSchema.safeParse({ ...euler.example, h: 0.3 }).success).toBe(false);
    expect(euler.inputSchema.safeParse({ ...euler.example, h: 0.25 }).success).toBe(true);
  });

  it('x_f debe ser mayor que x₀', () => {
    expect(euler.inputSchema.safeParse({ ...euler.example, xf: 0 }).success).toBe(false);
  });

  it('f(x, y) puede usar x e y; otra variable es un error', () => {
    const result = euler.solve({ ...euler.example, expression: 'x + z' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-expression');
  });

  it('un error en la solución exacta se señala como tal', () => {
    const result = euler.solve({ ...euler.example, exact: 'x +' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/^Solución exacta/);
  });

  // y' = 1/(x − 1) desde x = 0 con h = 0.5: en x = 1 la pendiente es infinita (paso 3).
  it('una pendiente no finita → non-finite con la traza previa', () => {
    const result = euler.solve({ expression: '1/(x - 1)', x0: 0, y0: 0, h: 0.5, xf: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('non-finite');
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('sin solución exacta no hay columna de error ni serie de referencia', () => {
    const result = ok(euler.solve({ ...euler.example, exact: undefined }));
    expect(result.value.trueValues).toBeNull();
    expect(result.series[0]?.reference).toBeUndefined();
  });
});
