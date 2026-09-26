import { describe, expect, it } from 'vitest';
import { sensitivity } from './analisis-de-sensibilidad';
import { dualSimplex } from './dual-simplex';
import { dualProblem } from './problema-dual';
import { branchAndBound } from './ramificacion-y-acotamiento';

// Fuentes: Taha, Operations Research: An Introduction, 9.ª ed. en inglés (2011). Datos
// verificados con su «R Textbook Companion» (FOSSEE, 2020): ejemplos 3.6-1 (JOBCO), 3.6-3 y
// 4.5-1 a 4.5-4 (TOYCO: B⁻¹ óptima y precios duales (1, 2, 0)), 4.2-1 a 4.2-3 (dual con una
// igualdad: y = (29/5, −2/5)), 4.3-1 (Reddy Mikks), 4.4-1 (dual simplex) y 8.2-1 (ramificación).
// Los valores que el script no imprime se calcularon a mano a partir de esos datos, y así se
// indica en cada caso.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fails<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

const lp = (sense: 'max' | 'min', objective: string, constraints: string[]) => ({
  sense,
  objective,
  constraints: constraints.join('\n'),
});

describe('Problema dual', () => {
  // Taha 4.2-1: dual mín w = 10y1 + 8y2 con y1 + 2y2 ≥ 5, 2y1 − y2 ≥ 12, y1 + 3y2 ≥ 4,
  // y1 ≥ 0 y y2 libre. Taha 4.2-3 da los valores duales óptimos y1 = 29/5, y2 = −2/5; con ellos
  // w = 58 − 16/5 = 274/5 = 54.8, que coincide con z* (verificado a mano: x = (26/5, 12/5, 0)).
  it('Taha 4.2-1: y₂ libre por la igualdad y z* = w* = 54.8', () => {
    const { value, summary } = ok(dualProblem.solve(dualProblem.example));
    expect(value.signs).toEqual(['>=0', 'libre']);
    expect(value.primal.z).toBeCloseTo(54.8, 12);
    expect(value.dual.w).toBeCloseTo(54.8, 12);
    expect(value.dual.y.y1).toBeCloseTo(29 / 5, 12);
    expect(value.dual.y.y2).toBeCloseTo(-2 / 5, 12);
    expect(value.primal.x).toEqual({ x1: 5.2, x2: 2.4, x3: 0 });
    expect(summary[0]!.value).toContain('y_{1} + 2y_{2} &\\ge 5');
    expect(summary[0]!.value).toContain('y_{2}\\ \\text{libre}');
  });

  // Taha 4.3-1: precios duales de Reddy Mikks y = (0.75, 0.5, 0, 0), w = 21.
  it('Reddy Mikks: y = (0.75, 0.5, 0, 0)', () => {
    const { value } = ok(
      dualProblem.solve(
        lp('max', '5x1 + 4x2', ['6x1 + 4x2 <= 24', 'x1 + 2x2 <= 6', '-x1 + x2 <= 1', 'x2 <= 2']),
      ),
    );
    expect(value.dual.y).toEqual({ y1: 0.75, y2: 0.5, y3: 0, y4: 0 });
    expect(value.dual.w).toBe(21);
  });

  // Caso borde analítico: primal mín con ≥ → dual máx con y ≥ 0; primal no acotado → dual
  // infactible (Taha 3.5-3 como primal).
  it('estados cuando el primal no tiene óptimo', () => {
    const { value } = ok(dualProblem.solve(lp('max', '2x1 + x2', ['x1 - x2 <= 10', '2x1 <= 40'])));
    expect(value.primal.status).toBe('unbounded');
    expect(value.dual.status).toBe('infeasible');
  });
});

describe('Dual simplex', () => {
  // Taha 4.4-1. Verificado a mano con la regla del libro: sale s2 (−6) y entra x2 (razón 2/3);
  // luego sale s1 (−1) y entra x3 (razón 1/2). Óptimo x = (0, 3/2, 3/2), z = 9/2.
  it('Taha 4.4-1: z = 9/2 en (0, 3/2, 3/2)', () => {
    const r = ok(dualSimplex.solve(dualSimplex.example));
    expect(r.value.zExact).toBe('4.5');
    expect(r.value.exact).toEqual({ x1: '0', x2: '1.5', x3: '1.5' });
    expect(r.value.iterations).toBe(2);
    const first = r.steps.find((s) => s.title === 'Iteración 1')!;
    expect(first.children![0]!.result).toContain('s_{2} = -6');
    expect(first.children![1]!.result).toContain('x_{2}');
  });

  // Hillier & Lieberman: el dual de Wyndor (mín 4y1 + 12y2 + 18y3) tiene óptimo (0, 3/2, 1) con
  // W = 36, el mismo valor que Wyndor (dualidad fuerte).
  it('dual de Wyndor: W = 36', () => {
    const r = ok(
      dualSimplex.solve(lp('min', '4y1 + 12y2 + 18y3', ['y1 + 3y3 >= 3', '2y2 + 2y3 >= 5'])),
    );
    expect(r.value.z).toBe(36);
    expect(r.value.variables).toEqual({ y1: 0, y2: 1.5, y3: 1 });
  });

  it('la tabla inicial debe ser óptima', () => {
    const r = fails(dualSimplex.solve(lp('max', '3x1 + 2x2', ['x1 + x2 <= 4'])));
    expect(r.error.code).toBe('not-dual-feasible');
  });

  // Caso borde analítico: x1 + x2 ≤ 1 y x1 + x2 ≥ 3 no tienen solución común.
  it('detecta infactibilidad', () => {
    const r = fails(dualSimplex.solve(lp('min', 'x1 + x2', ['x1 + x2 <= 1', 'x1 + x2 >= 3'])));
    expect(r.error.code).toBe('infeasible');
  });
});

describe('Análisis de sensibilidad', () => {
  // Taha 3.6-1 (JOBCO): óptimo x1 = 3.2, x2 = 1.6, z = 128. Verificado a mano con
  // B⁻¹ = (1/5)[[3, −1], [−1, 2]]: precios duales (14, 2); 2.67 ≤ b1 ≤ 16 y 4 ≤ b2 ≤ 24;
  // 6.67 ≤ c1 ≤ 40 y 15 ≤ c2 ≤ 90 (la razón c1/c2 debe estar entre 1/3 y 2).
  it('JOBCO: precios duales y rangos', () => {
    const { value } = ok(sensitivity.solve(sensitivity.example));
    expect(value.z).toBe(128);
    expect(value.dualPrices).toEqual([14, 2]);
    expect(value.rhsRanges[0]!.min).toBeCloseTo(8 / 3, 12);
    expect(value.rhsRanges[0]!.max).toBe(16);
    expect(value.rhsRanges[1]).toEqual({ min: 4, max: 24 });
    expect(value.costRanges[0]!.min).toBeCloseTo(20 / 3, 12);
    expect(value.costRanges[0]!.max).toBe(40);
    expect(value.costRanges[1]).toEqual({ min: 15, max: 90 });
  });

  // Taha, modelo TOYCO: óptimo (0, 100, 230) con z = 1350 y precios duales (1, 2, 0); con la B⁻¹
  // del ejemplo 4.5-1 los rangos son −200 ≤ D1 ≤ 10, −20 ≤ D2 ≤ 400 y D3 ≥ −20, es decir
  // 230 ≤ b1 ≤ 440, 440 ≤ b2 ≤ 860 y b3 ≥ 400.
  it('TOYCO: precios duales (1, 2, 0) y rangos de los recursos', () => {
    const { value } = ok(
      sensitivity.solve(
        lp('max', '3x1 + 2x2 + 5x3', [
          'x1 + 2x2 + x3 <= 430',
          '3x1 + 2x3 <= 460',
          'x1 + 4x2 <= 420',
        ]),
      ),
    );
    expect(value.z).toBe(1350);
    expect(value.dualPrices).toEqual([1, 2, 0]);
    expect(value.rhsRanges).toEqual([
      { min: 230, max: 440 },
      { min: 440, max: 860 },
      { min: 400, max: null },
    ]);
    // x1 no es básica: su coeficiente puede subir hasta c1 + (costo reducido) = 3 + 4 = 7.
    expect(value.costRanges[0]).toEqual({ min: null, max: 7 });
  });

  it('necesita restricciones ≤', () => {
    const r = fails(sensitivity.solve(lp('min', 'x1 + x2', ['x1 + x2 >= 2'])));
    expect(r.error.code).toBe('needs-artificial');
  });
});

describe('Ramificación y acotamiento', () => {
  // Taha 8.2-1: relajación (3.75, 1.25) con z = 23.75; óptimo entero (3, 2) con z = 23.
  // Verificado a mano: la rama x1 ≥ 4 da (4, 5/6) con z = 70/3 ≈ 23.33 > 23, y al ramificar en x2
  // la rama x2 ≤ 0 da (4.5, 0) con z = 22.5 (se poda) y x2 ≥ 1 es infactible.
  it('Taha 8.2-1: óptimo entero z = 23 en (3, 2)', () => {
    const { value } = ok(branchAndBound.solve(branchAndBound.example));
    expect(value.relaxation).toBe(23.75);
    expect(value.z).toBe(23);
    expect(value.variables).toEqual({ x1: 3, x2: 2 });
    const [root, n1, n2, n3, n4] = value.nodes;
    expect(root!.x).toEqual([3.75, 1.25]);
    expect(n1).toMatchObject({ outcome: 'entera', z: 23, x: [3, 2] });
    expect(n2!.outcome).toBe('ramificado');
    expect(n2!.z).toBeCloseTo(70 / 3, 12);
    expect(n3).toMatchObject({ outcome: 'podado', z: 22.5 });
    expect(n4!.outcome).toBe('infactible');
    expect(value.nodes).toHaveLength(5);
  });

  // Caso borde analítico: si solo x1 es entera (mixta), la rama x1 ≥ 4 con x2 = 5/6 es óptima.
  it('programación entera mixta', () => {
    const { value } = ok(branchAndBound.solve({ ...branchAndBound.example, integers: 'x1' }));
    expect(value.z).toBeCloseTo(70 / 3, 12);
    expect(value.variables.x1).toBe(4);
    expect(value.variables.x2).toBeCloseTo(5 / 6, 12);
  });

  it('valida los nombres de las variables enteras', () => {
    expect(
      branchAndBound.inputSchema.safeParse({ ...branchAndBound.example, integers: 'x9' }).success,
    ).toBe(false);
  });
});
