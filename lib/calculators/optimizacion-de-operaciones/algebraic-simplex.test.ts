import { describe, expect, it } from 'vitest';
import { simplexTabular } from './simplex';
import { algebraicSimplex } from './simplex-algebraico';

// Fuente: Taha, Operations Research: An Introduction, 10.ª ed. en inglés (Pearson, 2017),
// sec. 3.2 y 3.3.1, ejemplo 3.2-1 (pp. 101-104). El mismo ejemplo tiene ese número en la 9.ª ed.
// (lp.test.ts).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fails<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

describe('Método simplex algebraico', () => {
  // Ejemplo 3.2-1: máx z = 2x1 + 3x2, 2x1 + x2 ≤ 4, x1 + 2x2 ≤ 5. Tabla de la p. 103: seis
  // soluciones básicas, cuatro factibles: (s1, s2) = (4, 5) con z = 0; (x2, s1) = (2.5, 1.5) con
  // z = 7.5; (x1, s2) = (2, 3) con z = 4; (x1, x2) = (1, 2) con z = 8 (óptimo); infactibles
  // (x2, s2) = (4, −3) y (x1, s1) = (5, −6).
  it('Taha 3.2-1: soluciones básicas', () => {
    const { tables } = ok(algebraicSimplex.solve(algebraicSimplex.example));
    const table = tables.find((t) => t.id === 'soluciones-basicas')!;
    expect(table.rows).toHaveLength(6);
    expect(table.rows.filter((r) => r.feasible === 'Sí')).toHaveLength(4);
    const zs = table.rows.filter((r) => r.feasible === 'Sí').map((r) => r.z);
    expect(zs.sort()).toEqual(['0', '4', '7.5', '8']);
    const infeasible = table.rows.filter((r) => r.feasible === 'No').map((r) => r.basic);
    expect(infeasible).toContain('x_{2} = 4,\\ s_{2} = -3');
    expect(infeasible).toContain('x_{1} = 5,\\ s_{1} = -6');
  });

  // Sec. 3.3.1 (pp. 103-104): el simplex parte de A (origen), aumenta primero x2 (tasa 3 > 2)
  // hasta B y luego x1 hasta C: x1 = 1, x2 = 2, z = 8. En B, x2 = 2.5 y s1 = 1.5 (tabla de la
  // p. 103), así que z = 7.5.
  it('Taha 3.3.1: recorrido A → B → C', () => {
    const { value, tables, steps } = ok(algebraicSimplex.solve(algebraicSimplex.example));
    expect(value.z).toBe(8);
    expect(value.variables).toEqual({ x1: 1, x2: 2 });
    expect(value.iterations).toBe(2);
    const path = tables.find((t) => t.id === 'recorrido')!.rows.map((r) => r.z);
    expect(path).toEqual(['0', '7.5', '8']);
    const first = steps.find((s) => s.title === 'Iteración 1')!;
    expect(first.children?.[2]?.result).toContain('x_{2} \\ \\text{entra (tasa } 3');
    expect(first.children?.[3]?.result).toContain('s_{2} \\ \\text{sale;}\\ x_{2} = 2.5');
    const simplex = tables.find((t) => t.id === 'soluciones-basicas')!.rows;
    expect(
      simplex
        .filter((r) => r.simplex !== '')
        .map((r) => r.simplex)
        .sort(),
    ).toEqual(['Inicio', 'Iteración 1', 'Iteración 2']);
  });

  // Taha 3.3-1 (Reddy Mikks): el algebraico y el tabular siguen las mismas reglas, así que llegan a
  // la misma solución (x1 = 3, x2 = 1.5, z = 21) con las mismas iteraciones.
  it('coincide con el simplex tabular (Reddy Mikks)', () => {
    const algebraic = ok(algebraicSimplex.solve(simplexTabular.example)).value;
    const tabular = ok(simplexTabular.solve(simplexTabular.example)).value;
    expect(algebraic).toEqual(tabular);
    expect(algebraic.z).toBe(21);
  });

  // Casos especiales (Taha sec. 3.5): solución no acotada (3.5-3) y modelos que necesitan
  // variables artificiales.
  it('no acotado y restricciones ≥', () => {
    const unbounded = algebraicSimplex.solve({
      sense: 'max',
      objective: '2x1 + x2',
      constraints: 'x1 - x2 <= 10\n2x1 <= 40',
    });
    expect(fails(unbounded).error.code).toBe('unbounded');
    const needsArtificial = algebraicSimplex.solve({
      sense: 'min',
      objective: '4x1 + x2',
      constraints: '3x1 + x2 = 3\n4x1 + 3x2 >= 6\nx1 + 2x2 <= 4',
    });
    expect(fails(needsArtificial).error.code).toBe('needs-artificial');
  });
});
