import { describe, expect, it } from 'vitest';
import { standardForm } from './forma-estandar';
import { graphical } from './metodo-grafico';

// Fuentes: Taha, Operations Research: An Introduction, 9.ª ed. en inglés (2011), verificado con
// el «R Textbook Companion» (FOSSEE, 2020): ejemplo 2.2-1 (Reddy Mikks, vértices (0, 1), (1, 2),
// (2, 2), (3, 1.5), (4, 0) y el origen; óptimo z = 21 en (3, 1.5)), 2.2-2 (dieta, óptimo
// x1 = 470.6, x2 = 329.4, z = 437.64), 3.4-1 y los casos especiales 3.5-2 a 3.5-4.

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

describe('Método gráfico', () => {
  it('Reddy Mikks: seis vértices y óptimo z = 21 en (3, 1.5)', () => {
    const { value, series } = ok(graphical.solve(graphical.example));
    expect(value.vertices.map((v) => v.exact)).toEqual([
      ['0', '0'],
      ['4', '0'],
      ['3', '1.5'],
      ['2', '2'],
      ['1', '2'],
      ['0', '1'],
    ]);
    expect(value.vertices.map((v) => v.label)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(value.z).toBe(21);
    expect([value.x, value.y]).toEqual([3, 1.5]);
    expect(value.multiple).toBe(false);
    // Región factible sombreada y una recta por restricción.
    expect(series[0]!.region!.points.length).toBeGreaterThan(2);
    expect(series[0]!.others).toHaveLength(4);
  });

  it('Taha 2.2-2 (dieta): mínimo en una región no acotada', () => {
    const { value } = ok(
      graphical.solve(
        lp('min', '0.3x1 + 0.9x2', [
          'x1 + x2 >= 800',
          '0.21x1 - 0.30x2 <= 0',
          '0.03x1 - 0.01x2 >= 0',
        ]),
      ),
    );
    expect(value.z).toBeCloseTo(437.64, 1);
    expect(value.x).toBeCloseTo(470.6, 1);
    expect(value.y).toBeCloseTo(329.4, 1);
  });

  it('Taha 3.5-2: óptimos múltiples entre (3, 1) y (0, 2.5)', () => {
    const { value } = ok(
      graphical.solve(lp('max', '2x1 + 4x2', ['x1 + 2x2 <= 5', 'x1 + x2 <= 4'])),
    );
    expect(value.z).toBe(10);
    expect(value.multiple).toBe(true);
    expect(value.vertices.filter((v) => v.z === 10).map((v) => v.exact)).toEqual([
      ['3', '1'],
      ['0', '2.5'],
    ]);
  });

  it('Taha 3.5-3: no acotado, con la región en la gráfica', () => {
    const r = fails(graphical.solve(lp('max', '2x1 + x2', ['x1 - x2 <= 10', '2x1 <= 40'])));
    expect(r.error.code).toBe('unbounded');
    expect(r.series[0]!.region).toBeDefined();
  });

  it('Taha 3.5-4: infactible', () => {
    const r = fails(graphical.solve(lp('max', '3x1 + 2x2', ['2x1 + x2 <= 2', '3x1 + 4x2 >= 12'])));
    expect(r.error.code).toBe('infeasible');
  });

  it('pide exactamente dos variables', () => {
    const r = fails(graphical.solve(lp('max', 'x1 + x2 + x3', ['x1 + x2 + x3 <= 4'])));
    expect(r.error.code).toBe('not-two-variables');
  });

  // Caso borde analítico: una restricción vertical (x1 ≤ 4, Wyndor) se dibuja y cuenta como recta.
  it('Wyndor: restricción vertical x1 ≤ 4', () => {
    const { value, series } = ok(
      graphical.solve(lp('max', '3x1 + 5x2', ['x1 <= 4', '2x2 <= 12', '3x1 + 2x2 <= 18'])),
    );
    expect(value.z).toBe(36);
    expect([value.x, value.y]).toEqual([2, 6]);
    expect(series[0]!.others![0]!.points).toHaveLength(2);
  });
});

describe('Forma canónica y estándar', () => {
  // Taha, ejemplo 3.4-1: 3x1 + x2 = 3, 4x1 + 3x2 ≥ 6, x1 + 2x2 ≤ 4. En forma estándar:
  // 4x1 + 3x2 − e2 = 6 y x1 + 2x2 + s3 = 4; dos restricciones (la = y la ≥) necesitan artificial.
  it('Taha 3.4-1: holgura, exceso y restricciones sin base inicial', () => {
    const { value } = ok(standardForm.solve(standardForm.example));
    expect(value.slacks).toBe(1);
    expect(value.surpluses).toBe(1);
    expect(value.needArtificial).toBe(2);
    expect(value.standard).toContain('4x_{1} + 3x_{2} - e_{2} &= 6');
    expect(value.standard).toContain('x_{1} + 2x_{2} + s_{3} &= 4');
    // Forma canónica de un min: todas ≥ (la ≤ se multiplica por −1; la = se divide en dos).
    expect(value.canonical).toContain('-x_{1} - 2x_{2} &\\ge -4');
    expect(value.canonical).toContain('3x_{1} + x_{2} &\\ge 3');
    expect(value.canonical).toContain('-3x_{1} - x_{2} &\\ge -3');
  });

  it('Reddy Mikks: cuatro holguras forman la base inicial', () => {
    const { value } = ok(
      standardForm.solve({
        sense: 'max',
        objective: '5x1 + 4x2',
        constraints: '6x1 + 4x2 <= 24\nx1 + 2x2 <= 6\n-x1 + x2 <= 1\nx2 <= 2',
      }),
    );
    expect(value.slacks).toBe(4);
    expect(value.needArtificial).toBe(0);
  });

  // Caso borde analítico: lado derecho negativo (−x1 + x2 ≤ −2 → x1 − x2 ≥ 2).
  it('lado derecho negativo', () => {
    const { value } = ok(standardForm.solve(lp('max', 'x1 + x2', ['-x1 + x2 <= -2', 'x1 <= 6'])));
    expect(value.standard).toContain('x_{1} - x_{2} - e_{1} &= 2');
  });
});
