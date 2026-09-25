import { describe, expect, it } from 'vitest';
import { parsePredecessors } from './network';
import { pert } from './pert';
import { criticalPath } from './ruta-critica';

// Hillier & Lieberman, Introduction to Operations Research, 8.ª ed. en inglés (2005), cap. 22
// «Project Management with PERT/CPM» (cap. 10 en la 7.ª ed. que cita el pensum): proyecto de
// Reliable Construction Co. Tabla 22.1 (actividades), figuras 22.3–22.5 (ES, EF, LS, LF),
// tabla 22.2 (rutas), tabla 22.3 (holguras), tablas 22.4 y 22.6 (PERT).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('Ruta crítica (CPM)', () => {
  const { value } = ok(criticalPath.solve(criticalPath.example));
  const byName = new Map(value.activities.map((a) => [a.name, a]));

  it('duración del proyecto y ruta crítica (tabla 22.2: 44 semanas)', () => {
    expect(value.duration).toBe(44);
    expect(value.criticalPaths).toEqual([['A', 'B', 'C', 'E', 'F', 'J', 'L', 'N']]);
  });

  // Figuras 22.2–22.3: ES/EF de A, B, C, D, E, I, F, G y H (ES_H = máx{29, 20} = 29).
  it('tiempos más próximos del recorrido hacia adelante', () => {
    const expected: Record<string, [number, number]> = {
      A: [0, 2],
      B: [2, 6],
      C: [6, 16],
      D: [16, 22],
      E: [16, 20],
      F: [20, 25],
      G: [22, 29],
      H: [29, 38],
      I: [16, 23],
      M: [38, 40],
      N: [38, 44],
    };
    for (const [name, [es, ef]] of Object.entries(expected)) {
      expect(byName.get(name)!.es, name).toBe(es);
      expect(byName.get(name)!.ef, name).toBe(ef);
    }
  });

  // Sec. 22.3, recorrido hacia atrás: LF_M = 44, LS_M = 42; LF_H = 42, LS_H = 33;
  // LS_D = 20, LS_E = 16, LS_I = 18 → LF_C = 16.
  it('tiempos más lejanos del recorrido hacia atrás', () => {
    expect(byName.get('M')!.lf).toBe(44);
    expect(byName.get('M')!.ls).toBe(42);
    expect(byName.get('H')!.lf).toBe(42);
    expect(byName.get('H')!.ls).toBe(33);
    expect(byName.get('D')!.ls).toBe(20);
    expect(byName.get('E')!.ls).toBe(16);
    expect(byName.get('I')!.ls).toBe(18);
    expect(byName.get('C')!.lf).toBe(16);
  });

  it('holguras de la tabla 22.3', () => {
    const slack = {
      A: 0,
      B: 0,
      C: 0,
      D: 4,
      E: 0,
      F: 0,
      G: 4,
      H: 4,
      I: 2,
      J: 0,
      K: 1,
      L: 0,
      M: 4,
      N: 0,
    };
    for (const [name, s] of Object.entries(slack)) {
      expect(byName.get(name)!.totalSlack, name).toBe(s);
      expect(byName.get(name)!.critical, name).toBe(s === 0);
    }
  });

  // Holgura libre: no está en Hillier; se verifica con la definición (Taha): mín{ES de las
  // sucesoras} − EF. D: ES_G − EF_D = 22 − 22 = 0; G: ES_H − EF_G = 29 − 29 = 0;
  // M: T − EF_M = 44 − 40 = 4; I: ES_J − EF_I = 25 − 23 = 2; K: ES_N − EF_K = 38 − 37 = 1.
  it('holguras libres por definición', () => {
    expect(byName.get('D')!.freeSlack).toBe(0);
    expect(byName.get('G')!.freeSlack).toBe(0);
    expect(byName.get('M')!.freeSlack).toBe(4);
    expect(byName.get('I')!.freeSlack).toBe(2);
    expect(byName.get('K')!.freeSlack).toBe(1);
  });

  it('la traza tiene un paso por actividad en cada recorrido', () => {
    const { steps } = ok(criticalPath.solve(criticalPath.example));
    const forward = steps.find((s) => s.title.startsWith('Recorrido hacia adelante'))!;
    const backward = steps.find((s) => s.title.startsWith('Recorrido hacia atrás'))!;
    expect(forward.children).toHaveLength(14);
    expect(backward.children).toHaveLength(14);
  });

  // Casos borde (no vienen del libro): dos rutas empatadas; nombres en minúscula; ficticias.
  it('detecta varias rutas críticas empatadas', () => {
    const { value: tie, notices } = ok(
      criticalPath.solve({
        activities: [
          { name: 'A', predecessors: '-', duration: 3 },
          { name: 'B', predecessors: '', duration: 3 },
          { name: 'C', predecessors: 'a b', duration: 2 },
        ],
      }),
    );
    expect(tie.duration).toBe(5);
    expect(tie.criticalPaths).toEqual([
      ['A', 'C'],
      ['B', 'C'],
    ]);
    expect(notices.some((n) => /2 rutas críticas/.test(n.message))).toBe(true);
  });

  it('avisa de las actividades de duración 0 (ficticias)', () => {
    const { notices } = ok(
      criticalPath.solve({
        activities: [
          { name: 'A', predecessors: '', duration: 2 },
          { name: 'X', predecessors: 'A', duration: 0 },
          { name: 'B', predecessors: 'X', duration: 1 },
        ],
      }),
    );
    expect(notices.some((n) => /ficticias/.test(n.message))).toBe(true);
  });

  it('errores: nombre repetido, predecesora desconocida y ciclo', () => {
    const duplicate = criticalPath.solve({
      activities: [
        { name: 'A', predecessors: '', duration: 1 },
        { name: 'a', predecessors: '', duration: 1 },
      ],
    });
    expect(!duplicate.ok && duplicate.error.code).toBe('duplicate-activity');

    const unknown = criticalPath.solve({
      activities: [{ name: 'A', predecessors: 'Z', duration: 1 }],
    });
    expect(!unknown.ok && unknown.error.code).toBe('unknown-predecessor');

    const cycle = criticalPath.solve({
      activities: [
        { name: 'A', predecessors: 'C', duration: 1 },
        { name: 'B', predecessors: 'A', duration: 1 },
        { name: 'C', predecessors: 'B', duration: 1 },
      ],
    });
    expect(!cycle.ok && cycle.error.code).toBe('cycle');
    expect(!cycle.ok && cycle.error.message).toMatch(/«A», «B», «C»/);

    const self = criticalPath.solve({
      activities: [{ name: 'A', predecessors: 'A', duration: 1 }],
    });
    expect(!self.ok && self.error.code).toBe('cycle');
  });

  it('valida los nombres y las duraciones en el formulario', () => {
    const bad = (activity: object) =>
      criticalPath.inputSchema.safeParse({ activities: [activity] }).success;
    expect(bad({ name: 'A B', predecessors: '', duration: 1 })).toBe(false);
    expect(bad({ name: 'A', predecessors: '', duration: -1 })).toBe(false);
    expect(bad({ name: '', predecessors: '', duration: 1 })).toBe(false);
  });
});

describe('parsePredecessors', () => {
  it('acepta comas, espacios, punto y coma y guiones para «ninguna»', () => {
    expect(parsePredecessors('E, G')).toEqual(['E', 'G']);
    expect(parsePredecessors('E;G  H')).toEqual(['E', 'G', 'H']);
    expect(parsePredecessors(' - ')).toEqual([]);
    expect(parsePredecessors('')).toEqual([]);
  });
});

describe('PERT', () => {
  const result = ok(pert.solve(pert.example));
  const { value } = result;
  const byName = new Map(value.activities.map((a) => [a.name, a]));

  // Tabla 22.4: todas las medias coinciden con las duraciones de la tabla 22.1; varianzas
  // A = M = 1/9, E = N = 4/9, C = H = 4, K = 0 y las demás 1.
  it('media y varianza de cada actividad (tabla 22.4)', () => {
    const expected: Record<string, [number, number]> = {
      A: [2, 1 / 9],
      B: [4, 1],
      C: [10, 4],
      D: [6, 1],
      E: [4, 4 / 9],
      F: [5, 1],
      G: [7, 1],
      H: [9, 4],
      I: [7, 1],
      J: [8, 1],
      K: [4, 0],
      L: [5, 1],
      M: [2, 1 / 9],
      N: [6, 4 / 9],
    };
    for (const [name, [mean, variance]] of Object.entries(expected)) {
      expect(byName.get(name)!.duration, name).toBeCloseTo(mean, 12);
      expect(byName.get(name)!.variance, name).toBeCloseTo(variance, 12);
    }
  });

  // Tabla 22.6: μ_p = 44, σ_p² = 9; P(T ≤ 47) = 1 − 0.1587 ≈ 0.84 (tabla A5.1 con K = 1).
  it('probabilidad de cumplir el plazo de 47 semanas', () => {
    expect(value.criticalPath).toEqual(['A', 'B', 'C', 'E', 'F', 'J', 'L', 'N']);
    expect(value.mean).toBeCloseTo(44, 12);
    expect(value.variance).toBeCloseTo(9, 12);
    expect(value.sd).toBeCloseTo(3, 12);
    expect(value.z).toBeCloseTo(1, 12);
    expect(value.probability).toBeCloseTo(0.8413, 4);
  });

  it('incluye la curva normal con el área hasta el plazo', () => {
    expect(result.series[0]!.highlight!.to).toBe(47);
  });

  it('valida a ≤ m ≤ b', () => {
    const activity = { name: 'A', predecessors: '', optimistic: 5, mostLikely: 4, pessimistic: 6 };
    expect(pert.inputSchema.safeParse({ activities: [activity], deadline: 5 }).success).toBe(false);
  });

  // Caso borde analítico: sin incertidumbre (a = m = b) la duración es exacta y P es 0 o 1.
  it('σ_p = 0 → probabilidad 0 o 1, con aviso', () => {
    const certain = (deadline: number) =>
      ok(
        pert.solve({
          activities: [
            { name: 'A', predecessors: '', optimistic: 3, mostLikely: 3, pessimistic: 3 },
            { name: 'B', predecessors: 'A', optimistic: 2, mostLikely: 2, pessimistic: 2 },
          ],
          deadline,
        }),
      );
    expect(certain(5).value.probability).toBe(1);
    expect(certain(4.9).value.probability).toBe(0);
    expect(certain(5).value.z).toBeNull();
    expect(certain(5).notices.some((n) => n.level === 'warning')).toBe(true);
  });

  // Caso borde: dos rutas medias empatadas; se usa la de mayor varianza. Verificado a mano:
  // A (μ = 4, σ² = 1) y B (μ = 4, σ² = 1/9) → σ_p² = 1.
  it('con rutas empatadas usa la de mayor varianza', () => {
    const { value: tie } = ok(
      pert.solve({
        activities: [
          { name: 'A', predecessors: '', optimistic: 1, mostLikely: 4, pessimistic: 7 },
          { name: 'B', predecessors: '', optimistic: 3, mostLikely: 4, pessimistic: 5 },
        ],
        deadline: 4,
      }),
    );
    expect(tie.criticalPath).toEqual(['A']);
    expect(tie.variance).toBeCloseTo(1, 12);
    expect(tie.probability).toBeCloseTo(0.5, 12);
  });

  it('propaga los errores de la red con la traza de las estimaciones', () => {
    const result = pert.solve({
      activities: [{ name: 'A', predecessors: 'X', optimistic: 1, mostLikely: 2, pessimistic: 3 }],
      deadline: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unknown-predecessor');
    expect(result.steps).toHaveLength(1);
  });
});
