import { describe, expect, it } from 'vitest';
import { modelChange, type ModelChangeInput } from './cambios-en-el-modelo';

// Fuente: Taha, Operations Research: An Introduction, 10.ª ed. en inglés (Pearson, 2017),
// sec. 4.5 "Post-optimal analysis", ejemplos 4.5-1 a 4.5-4 con el modelo TOYCO (pp. 186-192).
// La 9.ª ed. tiene los mismos ejemplos con los mismos datos (R Textbook Companion de FOSSEE,
// «Exa 4.5.1» a «Exa 4.5.4»).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fails<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

// TOYCO: máx z = 3x1 + 2x2 + 5x3; óptimo x = (0, 100, 230), z = 1350, y = (1, 2, 0).
const toyco = {
  sense: 'max' as const,
  objective: '3x1 + 2x2 + 5x3',
  constraints: 'x1 + 2x2 + x3 <= 430\n3x1 + 2x3 <= 460\nx1 + 4x2 <= 420',
};

const solve = (change: Omit<ModelChangeInput, 'sense' | 'objective' | 'constraints'>) =>
  modelChange.solve({ ...toyco, ...change });

describe('Cambios en el modelo (análisis post-óptimo)', () => {
  // Ejemplo 4.5-1, situación 1: capacidades 600, 640 y 590; x2 = 140, x3 = 320, x6 = 30 (la
  // holgura s3) y z = 1880. Situación 2: 450, 460 y 400 da x6 = −40; el dual simplex saca x6,
  // mete x4 (s1) y la solución vuelve a x2 = 100, x3 = 230 con z = 1350 y x4 = 20.
  it('Taha 4.5-1: cambios en el lado derecho', () => {
    const feasible = ok(solve({ change: 'lado-derecho', rhs: '600 640 590' }));
    expect(feasible.value.status).toBe('nuevos-valores');
    expect(feasible.value.z).toBe(1880);
    expect(feasible.value.variables).toEqual({ x1: 0, x2: 140, x3: 320 });
    const shifted = ok(solve({ change: 'lado-derecho', rhs: '450 460 400' }));
    expect(shifted.value.status).toBe('nueva-base');
    expect(shifted.value.iterations).toBe(1);
    expect(shifted.value.z).toBe(1350);
    expect(shifted.value.variables).toEqual({ x1: 0, x2: 100, x3: 230 });
    const final = shifted.tables.find((t) => t.id === 'cambio-final')!;
    expect(final.rows.find((r) => r.basic === 's_{1}')?.rhs).toBe('20');
  });

  // Ejemplo 4.5-2: 3x1 + x2 + x3 ≤ 500 es redundante (la solución da 330). 3x1 + 3x2 + x3 ≤ 500 no
  // se cumple (x7 = −30 tras hacerla consistente); con el dual simplex, x = (0, 90, 230), z = 1330.
  it('Taha 4.5-2: nueva restricción', () => {
    const redundant = ok(
      solve({ change: 'nueva-restriccion', constraint: '3x1 + x2 + x3 <= 500' }),
    );
    expect(redundant.value.status).toBe('sin-cambios');
    expect(redundant.value.z).toBe(1350);
    const binding = ok(modelChange.solve(modelChange.example));
    expect(binding.value.status).toBe('nueva-base');
    expect(binding.value.z).toBe(1330);
    expect(binding.value.variables).toEqual({ x1: 0, x2: 90, x3: 230 });
    const added = binding.steps.find((s) => s.title === 'Agregar la restricción a la tabla')!;
    expect(added.result).toBe('s_{4} = -30');
  });

  // Ejemplo 4.5-3, situación 1: z = 2x1 + 3x2 + 4x3; y = (3/2, 5/4, 0), costos reducidos 13/4,
  // 3/2 y 5/4: la solución sigue siendo óptima con z = 1220. Situación 2: z = 6x1 + 3x2 + 4x3; el
  // costo reducido de x1 es −3/4, entra x1 y sale x6: x = (10, 102.5, 215), z = 1227.50.
  it('Taha 4.5-3: cambios en la función objetivo', () => {
    const same = ok(solve({ change: 'objetivo', newObjective: '2x1 + 3x2 + 4x3' }));
    expect(same.value.status).toBe('nuevos-valores');
    expect(same.value.z).toBe(1220);
    const duals = same.steps.find((s) => s.title === 'Nuevos precios duales')!;
    expect(duals.result).toBe('y = \\left(1.5,\\ 1.25,\\ 0\\right)');
    const reduced = same.steps.find((s) => s.title === 'Costos reducidos de las no básicas')!;
    expect(reduced.substitution).toContain('- 2 = 3.25'); // 13/4
    const moved = ok(solve({ change: 'objetivo', newObjective: '6x1 + 3x2 + 4x3' }));
    expect(moved.value.status).toBe('nueva-base');
    expect(moved.value.variables).toEqual({ x1: 10, x2: 102.5, x3: 215 });
    expect(moved.value.z).toBe(1227.5);
  });

  // Ejemplo 4.5-4: carro de bomberos con ingreso 4 y tiempos 1, 1 y 2. Costo reducido
  // 1 + 2 + 0 − 4 = −1: conviene. Su columna es B⁻¹a = (1/4, 1/2, 1) y la nueva solución es
  // x3 = 125, x7 = 210 (aquí x4, la siguiente variable), z = 1465.
  it('Taha 4.5-4: nueva variable', () => {
    const result = ok(solve({ change: 'nueva-variable', column: '1 1 2', cost: '4' }));
    expect(result.value.status).toBe('nueva-base');
    expect(result.value.z).toBe(1465);
    expect(result.value.variables).toEqual({ x1: 0, x2: 0, x3: 125, x4: 210 });
    const reduced = result.steps.find((s) => s.title === 'Costo reducido de x4')!;
    expect(reduced.result).toContain('= -1');
    const entries = result.steps.find((s) => s.title === 'Columna de x4 en la tabla óptima')!;
    expect(entries.substitution).toContain('\\begin{bmatrix} 0.25 \\\\ 0.5 \\\\ 1 \\end{bmatrix}');
  });

  // Coeficientes tecnológicos de una variable no básica: si los trenes (x1, no básica) pasan a
  // usar 1, 1 y 2 minutos con ingreso 4, es el mismo cálculo del ejemplo 4.5-4 (la nota 2 de la
  // p. 191 dice que x1 podría eliminarse): x1 = 210, x3 = 125, z = 1465. Con su columna original
  // (1, 3, 1) y c1 = 3, el costo reducido es 4 (la fila z de la tabla óptima): no cambia nada.
  it('coeficientes tecnológicos de una variable no básica', () => {
    const replaced = ok(
      solve({ change: 'coeficientes-tecnologicos', variable: 'x1', column: '1 1 2', cost: '4' }),
    );
    expect(replaced.value.variables).toEqual({ x1: 210, x2: 0, x3: 125 });
    expect(replaced.value.z).toBe(1465);
    const unchanged = ok(
      solve({ change: 'coeficientes-tecnologicos', variable: 'x1', column: '1 3 1' }),
    );
    expect(unchanged.value.status).toBe('sin-cambios');
    expect(unchanged.steps.find((s) => s.title === 'Costo reducido de x1')?.result).toContain(
      '= 4',
    );
  });

  // Variable básica: cambia B y se resuelve de nuevo (observación final de la sec. 4.5). Caso
  // verificado a mano con el método gráfico: en Reddy Mikks (Taha 3.3-1), si el coeficiente de
  // x1 en la primera restricción pasa de 6 a 4 (4x1 + 4x2 ≤ 24), el óptimo pasa de (3, 1.5) con
  // z = 21 al vértice (6, 0) con z = 30 (los otros vértices dan 0, 4, 13 y 18).
  it('coeficientes tecnológicos de una variable básica', () => {
    const result = ok(
      modelChange.solve({
        sense: 'max',
        objective: '5x1 + 4x2',
        constraints: '6x1 + 4x2 <= 24\nx1 + 2x2 <= 6\n-x1 + x2 <= 1\nx2 <= 2',
        change: 'coeficientes-tecnologicos',
        variable: 'x1',
        column: '4 1 -1 0',
      }),
    );
    expect(result.steps.some((s) => s.title === 'x1 es básica: se resuelve de nuevo')).toBe(true);
    expect(result.value.variables).toEqual({ x1: 6, x2: 0 });
    expect(result.value.z).toBe(30);
  });

  it('validaciones y modelos que no sirven', () => {
    const schema = modelChange.inputSchema;
    const base = { ...toyco, change: 'lado-derecho' as const };
    expect(schema.safeParse({ ...base, rhs: '600 640' }).success).toBe(false);
    expect(
      schema.safeParse({ ...toyco, change: 'objetivo', newObjective: '2x1 + 3x5' }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...toyco, change: 'nueva-restriccion', constraint: 'x1 + x2 = 5' })
        .success,
    ).toBe(false);
    expect(schema.safeParse({ ...toyco, change: 'nueva-variable', column: '1 1 2' }).success).toBe(
      false,
    );
    const artificial = modelChange.solve({
      sense: 'min',
      objective: 'x1 + x2',
      constraints: 'x1 + x2 >= 2',
      change: 'lado-derecho',
      rhs: '3',
    });
    expect(fails(artificial).error.code).toBe('needs-artificial');
  });
});
