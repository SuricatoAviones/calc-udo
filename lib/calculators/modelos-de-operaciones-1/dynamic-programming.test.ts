import { describe, expect, it } from 'vitest';
import { workforce } from './fuerza-de-trabajo';
import { knapsack } from './mochila';
import { shortestRoute, type ShortestRouteInput } from './ruta-mas-corta-pd';

// Fuentes:
// - Hillier & Lieberman, Introduction to Operations Research, 9.ª ed. en inglés (2010), sec. 10.1:
//   problema de la diligencia (figura 10.1 y tablas de las etapas n = 4, 3, 2, 1).
// - Taha, Operations Research: An Introduction, 8.ª ed. en inglés (2007), cap. 10: ejemplo 10.1-1
//   (ruta más corta en avance), 10.2-1 (la misma red en reversa), 10.3-1 (carga de un barco) y
//   10.3-2 (tamaño de la fuerza de trabajo).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('Ruta más corta por programación dinámica', () => {
  // Hillier: f4*(H) = 3, f4*(I) = 4; f3*(E) = 4, f3*(F) = 7, f3*(G) = 6;
  // f2*(B) = 11 (E o F), f2*(C) = 7 (E), f2*(D) = 8 (E o F); f1*(A) = 11 (C o D).
  // Rutas óptimas: A→C→E→H→J, A→D→E→H→J y A→D→F→I→J, todas de costo 11.
  it('Hillier, problema de la diligencia (en reversa)', () => {
    const { value, tables, notices } = ok(shortestRoute.solve(shortestRoute.example));
    expect(value.distance).toBe(11);
    expect(value.f).toMatchObject({ H: 3, I: 4, E: 4, F: 7, G: 6, B: 11, C: 7, D: 8, A: 11 });
    expect(value.routes).toEqual([
      ['A', 'C', 'E', 'H', 'J'],
      ['A', 'D', 'E', 'H', 'J'],
      ['A', 'D', 'F', 'I', 'J'],
    ]);
    expect(value.stages).toBe(4);
    // Tabla n = 2 del libro: B → 11 11 12, C → 7 9 10, D → 8 8 11.
    const stage2 = tables.find((t) => t.id === 'etapa-2')!;
    expect(stage2.rows.map((r) => [r['d:E'], r['d:F'], r['d:G'], r.arg])).toEqual([
      [11, 11, 12, 'E o F'],
      [7, 9, 10, 'E'],
      [8, 8, 11, 'E o F'],
    ]);
    expect(notices.some((n) => /3 rutas óptimas/.test(n.message))).toBe(true);
  });

  const taha: ShortestRouteInput = {
    arcs: [
      { from: '1', to: '2', distance: 7 },
      { from: '1', to: '3', distance: 8 },
      { from: '1', to: '4', distance: 5 },
      { from: '2', to: '5', distance: 12 },
      { from: '3', to: '5', distance: 8 },
      { from: '3', to: '6', distance: 9 },
      { from: '4', to: '5', distance: 7 },
      { from: '4', to: '6', distance: 13 },
      { from: '5', to: '7', distance: 9 },
      { from: '6', to: '7', distance: 6 },
    ],
    origin: '1',
    destination: '7',
    recursion: 'avance',
  };

  // Taha, ejemplo 10.1-1: etapa 1 → 7, 8, 5; etapa 2 → nodo 5: mín{19, 16, 12} = 12 (desde 4),
  // nodo 6: mín{17, 18} = 17 (desde 3); etapa 3 → nodo 7: mín{21, 23} = 21 (desde 5).
  it('Taha, ejemplo 10.1-1 (en avance): 21 millas por 1 → 4 → 5 → 7', () => {
    const { value, tables } = ok(shortestRoute.solve(taha));
    expect(value.f).toMatchObject({ '2': 7, '3': 8, '4': 5, '5': 12, '6': 17, '7': 21 });
    expect(value.distance).toBe(21);
    expect(value.routes).toEqual([['1', '4', '5', '7']]);
    const stage2 = tables.find((t) => t.id === 'etapa-2')!;
    expect(stage2.rows[0]).toMatchObject({ 'd:2': 19, 'd:3': 16, 'd:4': 12, arg: '4' });
  });

  // Taha, ejemplo 10.2-1: etapa 3 → f(5) = 9, f(6) = 6; etapa 2 → f(2) = 21 (5), f(3) = 15 (6),
  // f(4) = 16 (5); etapa 1 → mín{28, 23, 21} = 21 (4).
  it('Taha, ejemplo 10.2-1 (en reversa): la misma ruta', () => {
    const { value, tables } = ok(shortestRoute.solve({ ...taha, recursion: 'reversa' }));
    expect(value.f).toMatchObject({ '5': 9, '6': 6, '2': 21, '3': 15, '4': 16, '1': 21 });
    expect(value.routes).toEqual([['1', '4', '5', '7']]);
    const stage1 = tables.find((t) => t.id === 'etapa-1')!;
    expect(stage1.rows[0]).toMatchObject({ 'd:2': 28, 'd:3': 23, 'd:4': 21, arg: '4' });
  });

  // Casos borde (analíticos): arcos que saltan etapas y nodos fuera de toda ruta.
  it('admite arcos que saltan etapas e ignora nodos que no llevan al destino', () => {
    const { value, notices } = ok(
      shortestRoute.solve({
        arcs: [
          { from: 'a', to: 'B', distance: 1 },
          { from: 'B', to: 'C', distance: 1 },
          { from: 'A', to: 'C', distance: 5 },
          { from: 'B', to: 'X', distance: 1 },
        ],
        origin: 'A',
        destination: 'c',
        recursion: 'reversa',
      }),
    );
    expect(value.distance).toBe(2);
    expect(value.routes).toEqual([['a', 'B', 'C']]);
    expect(notices.some((n) => /Se ignora el nodo X/.test(n.message))).toBe(true);
  });

  it('errores de la red', () => {
    const base = { origin: 'A', destination: 'B', recursion: 'reversa' as const };
    const code = (input: Omit<ShortestRouteInput, 'recursion'> & { recursion?: 'reversa' }) => {
      const result = shortestRoute.solve({ ...base, ...input });
      return result.ok ? 'ok' : result.error.code;
    };
    expect(code({ ...base, arcs: [{ from: 'A', to: 'A', distance: 1 }] })).toBe('self-loop');
    expect(
      code({
        ...base,
        arcs: [
          { from: 'A', to: 'B', distance: 1 },
          { from: 'a', to: 'b', distance: 2 },
        ],
      }),
    ).toBe('duplicate-arc');
    expect(code({ ...base, arcs: [{ from: 'A', to: 'C', distance: 1 }] })).toBe('unknown-node');
    expect(code({ ...base, destination: 'a', arcs: [{ from: 'A', to: 'B', distance: 1 }] })).toBe(
      'same-node',
    );
    expect(code({ ...base, arcs: [{ from: 'B', to: 'A', distance: 1 }] })).toBe('no-route');
    expect(
      code({
        ...base,
        arcs: [
          { from: 'A', to: 'C', distance: 1 },
          { from: 'C', to: 'D', distance: 1 },
          { from: 'D', to: 'C', distance: 1 },
          { from: 'D', to: 'B', distance: 1 },
        ],
      }),
    ).toBe('cycle');
  });
});

describe('Modelo del tamaño de la fuerza de trabajo', () => {
  // Taha, ejemplo 10.3-2 (costos en cientos de dólares en el libro; aquí en dólares):
  // etapa 5 → f5(4) = 8, f5(5) = 6, f5(6) = 0; etapa 4 → f4(8) = mín{8, 9, 6} = 6 (x4 = 6);
  // etapa 3 → f3(7) = 12, f3(8) = 6; etapa 2 → f2(5) = 19, f2(6) = 17, f2(7) = 12, f2(8) = 9;
  // etapa 1 → f1(0) = 33 con x1 = 5. Plan 5, 8, 8, 6, 6 y costo total $3300.
  const { value, tables } = ok(workforce.solve(workforce.example));

  it('valores de cada etapa', () => {
    const [s1, s2, s3, s4, s5] = value.stages;
    expect(s5).toEqual({ 4: 800, 5: 600, 6: 0 });
    expect(s4).toEqual({ 8: 600 });
    expect(s3).toEqual({ 7: 1200, 8: 600 });
    expect(s2).toEqual({ 5: 1900, 6: 1700, 7: 1200, 8: 900 });
    expect(s1).toEqual({ 0: 3300 });
  });

  // En la tabla de la etapa 1, el libro imprime «3(2) + 4 + 2(8) + 9 = 35» para x1 = 8; con
  // x1 − b1 = 3 el término es 3(3) y el total 38. El óptimo (33 con x1 = 5) no cambia.
  it('tabla de la etapa 1 (con la errata del libro corregida)', () => {
    const stage1 = tables.find((t) => t.id === 'etapa-1')!;
    expect(stage1.rows[0]).toMatchObject({ 'd:5': 3300, 'd:6': 3600, 'd:7': 3600, 'd:8': 3800 });
  });

  it('plan óptimo: contratar 5, contratar 3, sin cambios, despedir 2, sin cambios', () => {
    expect(value.totalCost).toBe(3300);
    expect(value.plan.map((p) => p.workers)).toEqual([5, 8, 8, 6, 6]);
    expect(value.plan.map((p) => p.change)).toEqual([5, 3, 0, -2, 0]);
    // Costo por semana del libro: 14, 13, 0, 6, 0 (cientos de dólares).
    expect(value.plan.map((p) => p.excessCost + p.hiringCost)).toEqual([1400, 1300, 0, 600, 0]);
  });

  // Caso borde analítico: sin costo de exceso conviene contratar una sola vez el máximo.
  it('sin costo de exceso contrata una vez el máximo requerido', () => {
    const { value: v } = ok(
      workforce.solve({ ...workforce.example, excessCost: 0, hiringVariableCost: 0 }),
    );
    expect(v.plan.map((p) => p.workers)).toEqual([8, 8, 8, 6, 6]);
    expect(v.totalCost).toBe(400);
  });

  it('valida los requerimientos', () => {
    const parse = (requirements: string) =>
      workforce.inputSchema.safeParse({ ...workforce.example, requirements }).success;
    expect(parse('5 7 x')).toBe(false);
    expect(parse('5 7.5')).toBe(false);
    expect(parse('')).toBe(false);
    expect(parse('5; 7; 8')).toBe(true);
  });
});

describe('Modelo de la mochila', () => {
  // Taha, ejemplo 10.3-1: etapa 3 → f3(x) = 14x; etapa 2 → f2 = 0, 14, 28, 47, 61 con
  // m2* = 0, 0, 0, 1, 1; etapa 1 → f1(2) = 31 (m1 = 1), f1(3) = 47 (m1 = 0) y f1(4) = 62 con
  // m1* = 2. Óptimo: (m1, m2, m3) = (2, 0, 0) con $62,000.
  const { value } = ok(knapsack.solve(knapsack.example));

  it('tablas de las etapas', () => {
    expect(value.stages[2]).toEqual([0, 14, 28, 42, 56]);
    expect(value.stages[1]).toEqual([0, 14, 28, 47, 61]);
    expect(value.decisions[1]).toEqual([0, 0, 0, 1, 1]);
    expect(value.stages[0]).toEqual([0, 14, 31, 47, 62]);
    expect(value.decisions[0]!.slice(2)).toEqual([1, 0, 2]);
  });

  it('solución óptima: 2 unidades del artículo 1', () => {
    expect(value.totalValue).toBe(62);
    expect(value.units).toEqual([2, 0, 0]);
    expect(value.usedCapacity).toBe(4);
  });

  // Taha, análisis de sensibilidad del mismo ejemplo: con 3 toneladas el óptimo es (0, 1, 0)
  // con $47,000.
  it('con capacidad 3 el óptimo es (0, 1, 0) con 47', () => {
    const { value: v } = ok(knapsack.solve({ ...knapsack.example, capacity: 3 }));
    expect(v.units).toEqual([0, 1, 0]);
    expect(v.totalValue).toBe(47);
  });

  // Caso borde analítico: con a lo sumo una unidad por artículo (mochila 0-1) ya no se pueden
  // cargar dos unidades del artículo 1; lo mejor es 2 + 3 (47 + 14 = 61).
  it('respeta el máximo de unidades por artículo', () => {
    const { value: v } = ok(
      knapsack.solve({
        ...knapsack.example,
        items: knapsack.example.items.map((item) => ({ ...item, maxUnits: 1 })),
      }),
    );
    expect(v.units).toEqual([0, 1, 1]);
    expect(v.totalValue).toBe(61);
  });

  it('valida pesos enteros positivos', () => {
    const bad = { ...knapsack.example, items: [{ name: 'X', weight: 1.5, value: 3 }] };
    expect(knapsack.inputSchema.safeParse(bad).success).toBe(false);
  });
});
