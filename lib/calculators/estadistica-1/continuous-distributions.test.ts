import { describe, expect, it } from 'vitest';
import { beta } from './distribucion-beta';
import { exponential } from './distribucion-exponencial';
import { gamma } from './distribucion-gamma';
import { uniform } from './distribucion-uniforme';
import { weibull } from './distribucion-weibull';

// Walpole, Myers, Myers y Ye, Probabilidad y estadística para ingeniería y ciencias, 9.ª ed. en
// español (Pearson, 2012), capítulo 6. Los resultados del libro vienen redondeados o de tablas.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('Distribución uniforme', () => {
  // Ejemplo 6.1 (pp. 171-172): conferencia uniforme en [0, 4]; P(X ≥ 3) = 1/4. Teorema 6.1:
  // μ = (0 + 4)/2 = 2 y σ² = (4 − 0)²/12 = 4/3.
  it('Walpole, ejemplo 6.1 y teorema 6.1', () => {
    const { value } = ok(uniform.solve(uniform.example));
    expect(value.probability).toBeCloseTo(0.25, 12);
    expect(value.mean).toBe(2);
    expect(value.variance).toBeCloseTo(4 / 3, 12);
  });

  // Casos borde, analíticos: fuera del soporte no hay área (o está toda).
  it('fuera de [A, B]', () => {
    const solve = (query: 'menor' | 'mayor' | 'entre', x: number, x2?: number) =>
      ok(uniform.solve({ lower: 0, upper: 4, query, x, x2 })).value.probability;
    expect(solve('menor', -1)).toBe(0);
    expect(solve('menor', 5)).toBe(1);
    expect(solve('entre', -3, 1)).toBeCloseTo(0.25, 12);
  });

  it('B debe ser mayor que A', () => {
    expect(
      uniform.inputSchema.safeParse({ lower: 4, upper: 4, query: 'menor', x: 1 }).success,
    ).toBe(false);
  });
});

describe('Distribución exponencial', () => {
  // Ejemplo 6.21 (pp. 199-200): lavadora con β = 4 años; P(Y > 6) = e^{−6/4} = 0.2231 y
  // P(Y < 1) = 1 − e^{−1/4} = 0.221. Corolario 6.1 (p. 196): μ = β, σ² = β².
  it('Walpole, ejemplo 6.21 y corolario 6.1', () => {
    const { value } = ok(exponential.solve(exponential.example));
    expect(value.probability).toBeCloseTo(0.2231, 4);
    const early = exponential.solve({ parameter: 'media', value: 4, query: 'menor', x: 1 });
    expect(ok(early).value.probability).toBeCloseTo(0.221, 3);
    expect(value.mean).toBe(4);
    expect(value.variance).toBe(16);
  });

  // Ejemplo 6.17 (p. 197): β = 5; P(T > 8) = ∫₈^∞ (1/5)e^{−t/5} dt = e^{−8/5} ≈ 0.2.
  it('Walpole, ejemplo 6.17', () => {
    const result = exponential.solve({ parameter: 'media', value: 5, query: 'mayor', x: 8 });
    expect(ok(result).value.probability).toBeCloseTo(Math.exp(-8 / 5), 12);
    expect(ok(result).value.probability).toBeCloseTo(0.2, 1);
  });

  // Sec. 6.6 (p. 197): con la tasa λ = 1/β la densidad es λe^{−λx}; λ = 0.25 equivale a β = 4.
  it('con la tasa λ = 1/β da lo mismo', () => {
    const byRate = exponential.solve({ parameter: 'tasa', value: 0.25, query: 'mayor', x: 6 });
    expect(ok(byRate).value.probability).toBeCloseTo(0.2231, 4);
    expect(ok(byRate).value.mean).toBe(4);
  });
});

describe('Distribución gamma', () => {
  // Ejemplo 6.19 (pp. 198-199): α = 5, β = 10; P(X < 60) = F(6; 5) = 0.715 (tabla A.23).
  // Teorema 6.4 (p. 196): μ = αβ = 50, σ² = αβ² = 500.
  it('Walpole, ejemplo 6.19 y teorema 6.4', () => {
    const { value } = ok(gamma.solve(gamma.example));
    expect(value.probability).toBeCloseTo(0.715, 3);
    expect(value.mean).toBe(50);
    expect(value.variance).toBe(500);
  });

  // Ejemplo 6.18 (p. 198): 5 llamadas por minuto, tiempo hasta 2 llamadas: α = 2, β = 1/5;
  // P(X < 1) = 1 − e^{−5}(1 + 5) = 0.96.
  it('Walpole, ejemplo 6.18', () => {
    const result = gamma.solve({ alpha: 2, beta: 0.2, query: 'menor', x: 1 });
    expect(ok(result).value.probability).toBeCloseTo(1 - 6 * Math.exp(-5), 12);
    expect(ok(result).value.probability).toBeCloseTo(0.96, 2);
  });

  // Ejemplo 6.20 (p. 199): α = 2, β = 4; P(X > 20) = 1 − F(5; 2) = 1 − 0.96 = 0.04.
  it('Walpole, ejemplo 6.20', () => {
    const result = gamma.solve({ alpha: 2, beta: 4, query: 'mayor', x: 20 });
    expect(ok(result).value.probability).toBeCloseTo(0.04, 2);
  });

  // α no entero: la chi cuadrada con ν = 1 es gamma(1/2, 2) (sec. 6.7) y χ²₀.₀₅ = 3.841
  // (tabla A.5), así que P(X > 3.841) ≈ 0.05.
  it('α no entero: chi cuadrada con 1 grado de libertad', () => {
    const result = gamma.solve({ alpha: 0.5, beta: 2, query: 'mayor', x: 3.841 });
    expect(ok(result).value.probability).toBeCloseTo(0.05, 3);
  });
});

describe('Distribución beta', () => {
  // Ejercicio 6.50 (p. 206): proporción beta(2, 2); P(X ≥ 0.8). Verificado analíticamente: la
  // densidad es 6x(1 − x) y F(x) = 3x² − 2x³, así que P = 1 − (1.92 − 1.024) = 0.104.
  it('Walpole, ejercicio 6.50', () => {
    expect(ok(beta.solve(beta.example)).value.probability).toBeCloseTo(0.104, 12);
  });

  // Ejercicio 6.49 (p. 206): beta(1, 2). Teorema 6.6: μ = 1/3, σ² = 2/(9 · 4) = 1/18. Verificado
  // analíticamente: la densidad es 2(1 − x), así que P(X > 1/3) = (2/3)² = 4/9.
  it('Walpole, ejercicio 6.49 y teorema 6.6', () => {
    const { value } = ok(beta.solve({ alpha: 1, beta: 2, query: 'mayor', x: 1 / 3 }));
    expect(value.probability).toBeCloseTo(4 / 9, 12);
    expect(value.mean).toBeCloseTo(1 / 3, 12);
    expect(value.variance).toBeCloseTo(1 / 18, 12);
  });

  // Sec. 6.8 (p. 201): la beta(1, 1) es la uniforme en (0, 1), con μ = 1/2 y σ² = 1/12.
  it('beta(1, 1) es la uniforme', () => {
    const { value } = ok(beta.solve({ alpha: 1, beta: 1, query: 'entre', x: 0.2, x2: 0.7 }));
    expect(value.probability).toBeCloseTo(0.5, 12);
    expect(value.mean).toBeCloseTo(0.5, 12);
    expect(value.variance).toBeCloseTo(1 / 12, 12);
  });

  // Caso borde: con α < 1 la densidad no está acotada en 0; la probabilidad sigue siendo finita.
  // Iₓ(1/2, 1) = √x (identidad analítica).
  it('α < 1', () => {
    const result = beta.solve({ alpha: 0.5, beta: 1, query: 'menor', x: 0.25 });
    expect(ok(result).value.probability).toBeCloseTo(0.5, 12);
  });
});

describe('Distribución de Weibull', () => {
  // Ejemplo 6.24 (p. 204): α = 0.01, β = 2; P(X < 8) = 1 − e^{−0.01(8)²} = 1 − 0.527 = 0.473.
  it('Walpole, ejemplo 6.24', () => {
    expect(ok(weibull.solve(weibull.example)).value.probability).toBeCloseTo(0.473, 3);
  });

  // Teorema 6.8 (p. 203) con los datos del ejemplo 6.24: μ = 0.01^{−1/2} Γ(3/2) = 10(√π/2) y
  // σ² = 0.01^{−1}[Γ(2) − Γ(3/2)²] = 100(1 − π/4) (verificado con Γ(3/2) = √π/2).
  it('teorema 6.8: media y varianza', () => {
    const { value } = ok(weibull.solve(weibull.example));
    expect(value.mean).toBeCloseTo(5 * Math.sqrt(Math.PI), 10);
    expect(value.variance).toBeCloseTo(100 * (1 - Math.PI / 4), 10);
  });

  // Sec. 6.10 (p. 203): con β = 1 es la exponencial de media 1/α. Con α = 1/4 debe dar lo mismo
  // que el ejemplo 6.21 (β = 4): P(X > 6) = 0.2231.
  it('con β = 1 es la exponencial', () => {
    const { value } = ok(weibull.solve({ alpha: 0.25, beta: 1, query: 'mayor', x: 6 }));
    expect(value.probability).toBeCloseTo(0.2231, 4);
    expect(value.mean).toBeCloseTo(4, 10);
  });
});
