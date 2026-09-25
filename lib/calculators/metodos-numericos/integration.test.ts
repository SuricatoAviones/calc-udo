import { describe, expect, it } from 'vitest';
import { rectangleRule } from './rectangle-rule';
import { simpsonRule } from './simpson-rule';
import { trapezoidalRule } from './trapezoidal-rule';

// Chapra & Canale, Métodos Numéricos para Ingenieros, cap. 21 (5.ª ed. en español, McGraw-Hill
// 2007; el pensum cita la 3.ª ed.). Todos los ejemplos integran
//   f(x) = 0.2 + 25x − 200x² + 675x³ − 900x⁴ + 400x⁵  en [0, 0.8], valor exacto 1.640533.
const POLY = '0.2 + 25x - 200x^2 + 675x^3 - 900x^4 + 400x^5';
const EXACT = 1.640533;
const base = { expression: POLY, a: 0, b: 0.8, exact: EXACT };

function value<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return (
    result as T & { value: { integral: number; trueError: number; trueRelativeError: number } }
  ).value;
}

describe('Regla del trapecio', () => {
  // Ejemplo 21.1 (p. 624): f(0) = 0.2, f(0.8) = 0.232 → I ≅ 0.1728; Et = 1.467733; εt = 89.5 %.
  it('Chapra, ejemplo 21.1: aplicación simple', () => {
    const v = value(trapezoidalRule.solve({ ...base, n: 1 }));
    expect(v.integral).toBeCloseTo(0.1728, 10);
    expect(v.trueError).toBeCloseTo(1.467733, 6);
    expect(v.trueRelativeError).toBeCloseTo(89.5, 1);
  });

  // Ejemplo 21.2 (p. 628): n = 2 (h = 0.4), f(0.4) = 2.456 → I = 1.0688; Et = 0.57173; εt = 34.9 %.
  it('Chapra, ejemplo 21.2: aplicación múltiple con n = 2', () => {
    const result = trapezoidalRule.solve({ ...base, n: 2 });
    const v = value(result);
    expect(v.integral).toBeCloseTo(1.0688, 10);
    expect(v.trueError).toBeCloseTo(0.57173, 5);
    expect(v.trueRelativeError).toBeCloseTo(34.9, 1);
    expect(result.tables[0]?.rows[1]).toMatchObject({ x: 0.4 });
    expect(result.tables[0]?.rows[1]?.fx).toBeCloseTo(2.456, 10);
  });

  it('sin valor exacto no reporta errores', () => {
    const v = value(trapezoidalRule.solve({ expression: POLY, a: 0, b: 0.8, n: 2 }));
    expect(v.trueError).toBeNull();
  });
});

describe('Regla de Simpson', () => {
  // Ejemplo 21.4 (p. 633): Simpson 1/3 simple → I ≅ 1.367467.
  it('Chapra, ejemplo 21.4: 1/3 simple (n = 2)', () => {
    expect(value(simpsonRule.solve({ ...base, n: 2 })).integral).toBeCloseTo(1.367467, 6);
  });

  // Ejemplo 21.5 (p. 635): n = 4, f(0.2) = 1.288, f(0.6) = 3.464 → I = 1.623467; Et = 0.017067;
  // εt = 1.04 %.
  it('Chapra, ejemplo 21.5: 1/3 de aplicación múltiple (n = 4)', () => {
    const v = value(simpsonRule.solve({ ...base, n: 4 }));
    expect(v.integral).toBeCloseTo(1.623467, 6);
    // El libro calcula Et con I ya redondeado a 1.623467, así que coincide a 5 decimales.
    expect(v.trueError).toBeCloseTo(0.017067, 5);
    expect(v.trueRelativeError).toBeCloseTo(1.04, 2);
  });

  // Ejemplo 21.6a (p. 637): Simpson 3/8 simple → I ≅ 1.519170; εt = 7.4 %.
  it('Chapra, ejemplo 21.6a: 3/8 (n = 3)', () => {
    const v = value(simpsonRule.solve({ ...base, n: 3 }));
    expect(v.integral).toBeCloseTo(1.51917, 6);
    expect(v.trueRelativeError).toBeCloseTo(7.4, 1);
  });

  // Ejemplo 21.6b (p. 638): n = 5 → 1/3 en los dos primeros segmentos (0.3803237) + 3/8 en los
  // tres últimos (1.264754) = 1.645077; εt = −0.28 %.
  it('Chapra, ejemplo 21.6b: 1/3 + 3/8 con n = 5', () => {
    const result = simpsonRule.solve({ ...base, n: 5 });
    const v = value(result);
    expect(v.integral).toBeCloseTo(1.645077, 6);
    expect(v.trueRelativeError).toBeCloseTo(-0.28, 2);
    const partial = result.steps.find((s) => s.title === 'Sumar las dos partes');
    expect(partial?.substitution).toContain('0.3803237');
    // El libro imprime esta parte como 1.264754 y, al sumar, como 1.264753.
    expect(partial?.substitution).toContain('1.26475');
  });

  it('n = 1 → invalid-segments', () => {
    const result = simpsonRule.solve({ ...base, n: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-segments');
  });
});

describe('Regla rectangular', () => {
  // OpenStax, Cálculo vol. 1, ejemplo 5.4: f(x) = x² en [0, 2] con n = 4:
  // aproximación por la izquierda L₄ = 1.75 y por la derecha R₄ = 3.75.
  // (Fuente de verificación externa a la bibliografía del pensum; ver ADR-011.)
  it('OpenStax, ejemplo 5.4: extremos izquierdo y derecho', () => {
    const input = { expression: 'x^2', a: 0, b: 2, n: 4 };
    expect(value(rectangleRule.solve({ ...input, variant: 'izquierda' })).integral).toBeCloseTo(
      1.75,
      12,
    );
    expect(value(rectangleRule.solve({ ...input, variant: 'derecha' })).integral).toBeCloseTo(
      3.75,
      12,
    );
  });

  // OpenStax, Cálculo vol. 2, ejemplo 3.39: ∫₀¹ x² dx con la regla del punto medio y n = 4:
  // M₄ = 21/64; error |1/3 − 21/64| = 1/192.
  it('OpenStax, ejemplo 3.39: punto medio', () => {
    const v = value(rectangleRule.solve(rectangleRule.example));
    expect(v.integral).toBeCloseTo(21 / 64, 12);
    expect(Math.abs(v.trueError)).toBeCloseTo(1 / 192, 12);
  });

  it('numera los extremos derechos desde x₁', () => {
    const result = rectangleRule.solve({ expression: 'x', a: 0, b: 1, n: 2, variant: 'derecha' });
    expect(result.tables[0]?.rows.map((r) => r.i)).toEqual([1, 2]);
  });
});

describe('validación común', () => {
  it('rechaza a ≥ b', () => {
    expect(trapezoidalRule.inputSchema.safeParse({ ...base, a: 1, b: 0, n: 2 }).success).toBe(
      false,
    );
  });

  // 1/x en [−1, 1] con n = 2: el nodo central es x = 0.
  it('un nodo donde f no está definida → non-finite', () => {
    const result = trapezoidalRule.solve({ expression: '1/x', a: -1, b: 1, n: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('non-finite');
  });
});
