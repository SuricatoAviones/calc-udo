import { describe, expect, it } from 'vitest';
import { Rational } from '@/lib/math/rational';
import { parseLinearProgram } from './lp-model';
import { solveLpSilently } from './lp-solve';
import { bigM } from './metodo-m-grande';
import { twoPhase } from './metodo-dos-fases';
import { simplexTabular } from './simplex';

// Fuentes: Taha, Operations Research: An Introduction, 9.ª ed. en inglés (2011). Los datos de los
// ejemplos se verificaron con el «R Textbook Companion» de esa edición (FOSSEE, 2020):
// 2.2-1 y 3.3-1 (Reddy Mikks), 2.2-2 (dieta), 3.2-1, 3.4-1 y 3.4-2 (M grande y dos fases),
// 3.5-1 a 3.5-4 (degeneración, óptimos alternativos, no acotado, infactible).

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

describe('parser del modelo', () => {
  it('lee coeficientes, signos, coma decimal y variables en ambos lados', () => {
    const parsed = parseLinearProgram('min', 'z = 0,3x1 + 0.9 x2', '0.21x1 <= 0.30x2\nx1+x2>=800');
    if (!parsed.ok) throw new Error(parsed.message);
    expect(parsed.lp.variables).toEqual(['x1', 'x2']);
    expect(parsed.lp.objective.map((c) => c.toString())).toEqual(['3/10', '9/10']);
    const [c1, c2] = parsed.lp.constraints;
    expect(c1!.coefficients.map((c) => c.toString())).toEqual(['21/100', '-3/10']);
    expect(c1!.relation).toBe('<=');
    expect(c2!.relation).toBe('>=');
    expect(c2!.rhs.toString()).toBe('800');
  });

  it('ordena las variables de forma natural y omite la no negatividad', () => {
    const parsed = parseLinearProgram(
      'max',
      'x10 + x2 + x1',
      'x1 + x2 + x10 <= 5\nx1, x2, x10 >= 0\nx2 >= 0',
    );
    if (!parsed.ok) throw new Error(parsed.message);
    expect(parsed.lp.variables).toEqual(['x1', 'x2', 'x10']);
    expect(parsed.lp.constraints).toHaveLength(1);
    expect(parsed.notices.length).toBeGreaterThan(0);
  });

  it('pasa las constantes al lado derecho', () => {
    const parsed = parseLinearProgram('max', 'x', 'x + 3 <= 10 − 2');
    if (!parsed.ok) throw new Error(parsed.message);
    expect(parsed.lp.constraints[0]!.rhs.eq(Rational.of(5))).toBe(true);
  });

  it('errores con la línea', () => {
    const message = (objective: string, constraints: string) => {
      const parsed = parseLinearProgram('max', objective, constraints);
      return parsed.ok ? 'ok' : parsed.message;
    };
    expect(message('3x1 +', 'x1 <= 4')).toMatch(/Función objetivo/);
    expect(message('3x1', 'x1 + x2')).toMatch(/Línea 1: falta el signo/);
    expect(message('3x1', 'x1 <= 4\n2 <= 5')).toMatch(/Línea 2: la restricción no tiene variables/);
    expect(message('3s1', 's1 <= 4')).toMatch(/se reserva/);
    expect(message('3x1', 'x1 <= 4 <= 5')).toMatch(/un solo signo/);
  });
});

describe('Simplex tabular', () => {
  // Taha, ejemplo 3.3-1 (Reddy Mikks): entra x1 (−5) y sale s1 (razón 24/6 = 4); luego entra x2
  // (−2/3) y sale s2 (razón 2/(4/3) = 1.5). Óptimo: x1 = 3, x2 = 1.5, z = 21, con coeficientes
  // 3/4 y 1/2 de s1 y s2 en la fila z final.
  const result = ok(simplexTabular.solve(simplexTabular.example));

  it('Reddy Mikks: z = 21 en (3, 1.5) con dos iteraciones', () => {
    expect(result.value.z).toBe(21);
    expect(result.value.exact).toEqual({ x1: '3', x2: '1.5' });
    expect(result.value.iterations).toBe(2);
  });

  it('reproduce las tablas del libro', () => {
    const [initial, second, final] = result.tables;
    expect(initial!.rows[0]).toMatchObject({ basic: 'z', c0: '-5', c1: '-4', rhs: '0' });
    expect(initial!.rows[1]).toMatchObject({ basic: 's_{1}', ratio: String.raw`4\ \leftarrow` });
    expect(second!.rows[0]).toMatchObject({
      c1: String.raw`-\frac{2}{3}`,
      c2: String.raw`\frac{5}{6}`,
      rhs: '20',
    });
    expect(second!.rows[2]).toMatchObject({ basic: 's_{2}', ratio: String.raw`1.5\ \leftarrow` });
    expect(final!.rows[0]).toMatchObject({ c2: '0.75', c3: '0.5', rhs: '21' });
  });

  // Taha, ejemplo 3.2-1: max 2x1 + 3x2 con 2x1 + x2 ≤ 4 y x1 + 2x2 ≤ 5 → (1, 2), z = 8.
  it('Taha 3.2-1: z = 8 en (1, 2)', () => {
    const { value } = ok(
      simplexTabular.solve(lp('max', '2x1 + 3x2', ['2x1 + x2 <= 4', 'x1 + 2x2 <= 5'])),
    );
    expect(value.z).toBe(8);
    expect(value.variables).toEqual({ x1: 1, x2: 2 });
  });

  // Taha, ejemplo 3.5-1: empate en la razón mínima → solución degenerada; x2 = 2, z = 18.
  it('Taha 3.5-1: solución degenerada', () => {
    const r = ok(simplexTabular.solve(lp('max', '3x1 + 9x2', ['x1 + 4x2 <= 8', 'x1 + 2x2 <= 4'])));
    expect(r.value.z).toBe(18);
    expect(r.value.variables).toEqual({ x1: 0, x2: 2 });
    expect(r.value.degenerate).toBe(true);
  });

  // Taha, ejemplo 3.5-2: la función objetivo es paralela a una restricción → óptimos alternativos
  // con z = 10.
  it('Taha 3.5-2: óptimos alternativos', () => {
    const r = ok(simplexTabular.solve(lp('max', '2x1 + 4x2', ['x1 + 2x2 <= 5', 'x1 + x2 <= 4'])));
    expect(r.value.z).toBe(10);
    expect(r.value.alternativeOptima).toBe(true);
    expect(r.notices.some((n) => /Óptimos alternativos/.test(n.message))).toBe(true);
  });

  // Taha, ejemplo 3.5-3: max 2x1 + x2 con x1 − x2 ≤ 10 y 2x1 ≤ 40 no es acotado.
  it('Taha 3.5-3: no acotado', () => {
    const r = fails(simplexTabular.solve(lp('max', '2x1 + x2', ['x1 - x2 <= 10', '2x1 <= 40'])));
    expect(r.error.code).toBe('unbounded');
    expect(r.steps.some((s) => s.title.startsWith('Iteración'))).toBe(true);
  });

  it('pide M grande o dos fases si hay restricciones ≥ o =', () => {
    const r = fails(simplexTabular.solve(bigM.example));
    expect(r.error.code).toBe('needs-artificial');
  });

  // Hillier & Lieberman, Wyndor Glass Co.: max 3x1 + 5x2, x1 ≤ 4, 2x2 ≤ 12, 3x1 + 2x2 ≤ 18 →
  // (2, 6) con Z = 36 en dos iteraciones.
  it('Hillier, Wyndor Glass: Z = 36 en (2, 6)', () => {
    const r = ok(
      simplexTabular.solve(lp('max', '3x1 + 5x2', ['x1 <= 4', '2x2 <= 12', '3x1 + 2x2 <= 18'])),
    );
    expect(r.value.z).toBe(36);
    expect(r.value.variables).toEqual({ x1: 2, x2: 6 });
    expect(r.value.iterations).toBe(2);
  });
});

describe('M grande y dos fases', () => {
  // Taha, ejemplos 3.4-1 y 3.4-2: min 4x1 + x2 → x1 = 2/5, x2 = 9/5, z = 17/5.
  it('Taha 3.4-1 (M grande): z = 17/5 en (2/5, 9/5)', () => {
    const r = ok(bigM.solve(bigM.example));
    expect(r.value.zExact).toBe('3.4'); // 17/5
    expect(r.value.exact).toEqual({ x1: '0.4', x2: '1.8' });
    // La fila z inicial se hace consistente con las artificiales R1 y R2.
    expect(r.steps.some((s) => s.title === 'Hacer consistente la fila z')).toBe(true);
    expect(r.tables[0]!.rows[0]).toMatchObject({ c0: '-4 + 7M', c1: '-1 + 4M', c2: '-M' });
  });

  it('Taha 3.4-2 (dos fases): el mismo óptimo, con r* = 0 al final de la fase I', () => {
    const r = ok(twoPhase.solve(twoPhase.example));
    expect(r.value.zExact).toBe('3.4'); // 17/5
    expect(r.value.exact).toEqual({ x1: '0.4', x2: '1.8' });
    const end = r.steps.find((s) => s.title === 'Fin de la fase I')!;
    expect(end.result).toBe('r^* = 0');
    expect(r.tables.some((t) => t.title.startsWith('Fase II'))).toBe(true);
  });

  // Taha, ejemplo 3.5-4: 2x1 + x2 ≤ 2 y 3x1 + 4x2 ≥ 12 no tienen solución común.
  it('Taha 3.5-4: infactible con ambos métodos', () => {
    const model = lp('max', '3x1 + 2x2', ['2x1 + x2 <= 2', '3x1 + 4x2 >= 12']);
    expect(fails(bigM.solve(model)).error.code).toBe('infeasible');
    expect(fails(twoPhase.solve(model)).error.code).toBe('infeasible');
  });

  // Taha, ejemplo 2.2-2 (dieta): x1 = 470.6, x2 = 329.4, z = 437.64.
  it('Taha 2.2-2 (dieta): z ≈ 437.64', () => {
    const model = lp('min', '0.3x1 + 0.9x2', [
      'x1 + x2 >= 800',
      '0.21x1 - 0.30x2 <= 0',
      '0.03x1 - 0.01x2 >= 0',
    ]);
    const r = ok(twoPhase.solve(model));
    expect(r.value.z).toBeCloseTo(437.64, 1);
    expect(r.value.variables.x1).toBeCloseTo(470.6, 1);
    expect(r.value.variables.x2).toBeCloseTo(329.4, 1);
    expect(ok(bigM.solve(model)).value.z).toBeCloseTo(r.value.z, 12);
  });

  // Caso borde: un lado derecho negativo se multiplica por −1 (−x1 − x2 ≤ −2 → x1 + x2 ≥ 2).
  it('lado derecho negativo', () => {
    const r = ok(bigM.solve(lp('min', 'x1 + 2x2', ['-x1 - x2 <= -2', 'x1 <= 5'])));
    expect(r.value.z).toBe(2);
    expect(r.steps.find((s) => s.title === 'Forma estándar')!.explanation).toMatch(
      /multiplican por −1/,
    );
  });

  it('el solucionador sin traza coincide', () => {
    const parsed = parseLinearProgram(
      'min',
      '4x1 + x2',
      '3x1 + x2 = 3\n4x1 + 3x2 >= 6\nx1 + 2x2 <= 4',
    );
    if (!parsed.ok) throw new Error();
    const r = solveLpSilently(parsed.lp);
    expect(r.status).toBe('optimal');
    if (r.status === 'optimal') expect(r.z.toString()).toBe('17/5');
  });
});
