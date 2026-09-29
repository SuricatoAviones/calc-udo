import { describe, expect, it } from 'vitest';
import { normalDensity } from './normal';
import { integrate } from './quadrature';

// Integrales con valor analítico conocido (verificadas a mano con la antiderivada).

describe('integrate', () => {
  it('polinomios y funciones suaves en intervalos finitos', () => {
    expect(integrate((x) => x * x, 0, 1).value).toBeCloseTo(1 / 3, 13);
    expect(integrate(Math.sin, 0, Math.PI).value).toBeCloseTo(2, 13);
    // Walpole, ejemplo 4.10: E(X) = ∫₁² 2x(x − 1) dx = 5/3.
    expect(integrate((x) => 2 * x * (x - 1), 1, 2).value).toBeCloseTo(5 / 3, 13);
  });

  it('límites infinitos', () => {
    expect(integrate((x) => Math.exp(-x), 0, Infinity).value).toBeCloseTo(1, 12);
    expect(integrate((x) => normalDensity(x, 3, 2), -Infinity, Infinity).value).toBeCloseTo(1, 11);
    expect(integrate((x) => Math.exp(x), -Infinity, 0).value).toBeCloseTo(1, 12);
    // Walpole, ejemplo 4.3: ∫₁₀₀^∞ x · 20000/x³ dx = 200.
    expect(integrate((x) => 20000 / x ** 2, 100, Infinity).value).toBeCloseTo(200, 9);
  });

  it('singularidades integrables en un extremo', () => {
    const result = integrate((x) => 1 / Math.sqrt(x), 0, 1);
    expect(result.converged).toBe(true);
    expect(result.value).toBeCloseTo(2, 8);
  });

  it('detecta integrales divergentes', () => {
    expect(integrate((x) => 1 / x, 1, Infinity).converged).toBe(false);
    expect(integrate((x) => 20000 / x, 100, Infinity).converged).toBe(false);
  });

  it('orden de los límites y resultados no finitos', () => {
    expect(integrate((x) => x, 2, 0).value).toBeCloseTo(-2, 13);
    expect(integrate(() => 1, 3, 3).value).toBe(0);
    expect(integrate(() => Number.NaN, 0, 1).converged).toBe(false);
  });
});
