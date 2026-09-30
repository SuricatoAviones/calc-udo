import { describe, expect, it } from 'vitest';
import { steepestDescent } from './descenso-mas-rapido';
import { newtonSystem } from './newton-varias-variables';

// Chapra & Canale, Métodos Numéricos para Ingenieros (5.ª ed. en español, McGraw-Hill 2007; el
// pensum cita la 3.ª ed.).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fail<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

describe('Descenso (ascenso) más rápido', () => {
  // Ejemplo 14.4 (ascenso de máxima inclinación con paso óptimo): maximizar
  // f(x, y) = 2xy + 2x − x² − 2y² desde (−1, 1). Iteración 1: ∂f/∂x = 6, ∂f/∂y = −6,
  // g(h) = −180h² + 72h − 7, h* = 0.2, nuevo punto (0.2, −0.2). Iteración 2: ∇f = (1.2, 1.2),
  // g(h) = −1.44h² + 2.88h + 0.2, h* = 1, nuevo punto (1.4, 1). Converge al máximo (2, 1), f = 2.
  const result = ok(steepestDescent.solve(steepestDescent.example));
  const rows = result.tables[0]!.rows;

  it('primera iteración del libro', () => {
    expect(rows[0]).toMatchObject({ gx: 6, gy: -6 });
    expect(rows[0]!.h as number).toBeCloseTo(0.2, 12);
    expect(rows[0]!.x as number).toBeCloseTo(0.2, 12);
    expect(rows[0]!.y as number).toBeCloseTo(-0.2, 12);
    const line = result.steps[1]!.children![1]!;
    expect(line.result).toMatch(/180.*h\^\{?2\}?.*72.*h.*7/);
  });

  it('segunda iteración del libro', () => {
    expect(rows[1]!.gx as number).toBeCloseTo(1.2, 12);
    expect(rows[1]!.gy as number).toBeCloseTo(1.2, 12);
    expect(rows[1]!.h as number).toBeCloseTo(1, 12);
    expect(rows[1]!.x as number).toBeCloseTo(1.4, 12);
    expect(rows[1]!.y as number).toBeCloseTo(1, 12);
  });

  it('converge al máximo (2, 1) con f = 2', () => {
    expect(result.value.x).toBeCloseTo(2, 3);
    expect(result.value.y).toBeCloseTo(1, 3);
    expect(result.value.f).toBeCloseTo(2, 6);
  });

  // Caso analítico: minimizar f = (x − 1)² + 4(y + 2)², cuyo mínimo es (1, −2).
  it('minimizar una función cuadrática', () => {
    const { value } = ok(
      steepestDescent.solve({
        expression: '(x - 1)^2 + 4(y + 2)^2',
        goal: 'minimizar',
        x0: 3,
        y0: 1,
        tolerance: 0.0001,
        maxIterations: 100,
      }),
    );
    expect(value.x).toBeCloseTo(1, 4);
    expect(value.y).toBeCloseTo(-2, 4);
  });

  // Caso analítico: f = e^(−x² − y²) no es polinomial en h; el paso se obtiene numéricamente y
  // el máximo es (0, 0)… que el método alcanza en una iteración desde (1, 1) (la dirección apunta
  // al origen). Se parte de (1, 2) y se verifica que f aumenta en cada iteración.
  it('función no polinomial', () => {
    const { value } = ok(
      steepestDescent.solve({
        expression: 'e^(-x^2 - y^2)',
        goal: 'maximizar',
        x0: 1,
        y0: 2,
        tolerance: 0.01,
        maxIterations: 50,
      }),
    );
    expect(value.f).toBeCloseTo(1, 6);
    for (let i = 1; i < value.path.length; i++) {
      expect(value.path[i]!.f).toBeGreaterThanOrEqual(value.path[i - 1]!.f);
    }
  });

  it('errores', () => {
    expect(
      fail(steepestDescent.solve({ ...steepestDescent.example, expression: 'x + z' })).error.code,
    ).toBe('invalid-expression');
    // Minimizar x + y: no hay mínimo, ningún paso finito es óptimo.
    expect(
      fail(
        steepestDescent.solve({
          ...steepestDescent.example,
          expression: 'x + y',
          goal: 'minimizar',
        }),
      ).error.code,
    ).toBe('no-step');
    expect(
      fail(steepestDescent.solve({ ...steepestDescent.example, maxIterations: 1 })).error.code,
    ).toBe('max-iterations');
  });
});

describe('Newton-Raphson para sistemas no lineales', () => {
  // Sec. 6.6.2, ejemplo 6.11: u(x, y) = x² + xy − 10 = 0, v(x, y) = y + 3xy² − 57 = 0 desde x = 1.5, y = 3.5.
  // ∂u/∂x = 6.5, ∂u/∂y = 1.5, ∂v/∂x = 36.75, ∂v/∂y = 32.5; det J = 156.125; u₀ = −2.5,
  // v₀ = 1.625; x₁ = 2.03603, y₁ = 2.84388. Converge a la raíz x = 2, y = 3.
  const result = ok(newtonSystem.solve(newtonSystem.example));

  it('primera iteración del libro', () => {
    const first = result.steps[1]!.children!;
    expect(first[0]!.result).toBe('f_{1}(1.5,\\ 3.5) = -2.5,\\quad f_{2}(1.5,\\ 3.5) = 1.625');
    expect(first[2]!.result).toBe('\\det J = 156.125');
    const row = result.tables[0]!.rows[1]!;
    expect(row.x as number).toBeCloseTo(2.03603, 5);
    expect(row.y as number).toBeCloseTo(2.84388, 5);
  });

  it('converge a (2, 3)', () => {
    expect(result.value.solution[0]).toBeCloseTo(2, 8);
    expect(result.value.solution[1]).toBeCloseTo(3, 8);
  });

  // Caso analítico con tres ecuaciones: x + y + z = 6, xy = 2 y xz = 3 tienen la solución
  // (1, 2, 3) (1 + 2 + 3 = 6, 1·2 = 2, 1·3 = 3).
  it('sistema de tres ecuaciones', () => {
    const { value } = ok(
      newtonSystem.solve({
        size: '3',
        f1: 'x + y + z - 6',
        f2: 'x*y - 2',
        f3: 'x*z - 3',
        x0: 1.2,
        y0: 1.8,
        z0: 2.9,
        tolerance: 0.0001,
        maxIterations: 50,
      }),
    );
    expect(value.solution[0]).toBeCloseTo(1, 6);
    expect(value.solution[1]).toBeCloseTo(2, 6);
    expect(value.solution[2]).toBeCloseTo(3, 6);
  });

  // Caso borde: en (0, 0) la jacobiana de x² + y² − 1, x − y es [[0, 0], [1, −1]], singular.
  it('jacobiana singular', () => {
    const result = fail(
      newtonSystem.solve({
        ...newtonSystem.example,
        f1: 'x^2 + y^2 - 1',
        f2: 'x - y',
        x0: 0,
        y0: 0,
      }),
    );
    expect(result.error.code).toBe('singular-jacobian');
  });

  it('el schema pide la tercera ecuación', () => {
    expect(newtonSystem.inputSchema.safeParse({ ...newtonSystem.example, size: '3' }).success).toBe(
      false,
    );
  });
});
