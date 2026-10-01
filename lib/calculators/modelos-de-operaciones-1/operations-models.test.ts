import { describe, expect, it } from 'vitest';
import { convexity } from './convexidad';
import { crashing } from './pert-costos';
import { replacement } from './reemplazo-de-equipo';

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('PERT-Costos', () => {
  // Hillier & Lieberman, 7.ª ed. (2001), sec. 10.5, tablas 10.7 a 10.9 (Reliable Construction, en
  // miles de dólares): de 44 a 40 semanas se comprime J dos veces ($30 c/u) y F dos veces ($40
  // c/u), con costo total de compresión $140 000. Costo normal $4.55 millones. Las rutas quedan
  // ABCDGHM = 40, ABCEHM = 31, ABCEFJKN = 39, ABCEFJLN = 40, ABCIJKN = 39, ABCIJLN = 40.
  it('reproduce el análisis de costo marginal de Hillier', () => {
    const { value, tables } = ok(crashing.solve(crashing.example));
    expect(value.normalDuration).toBe(44);
    expect(value.finalDuration).toBe(40);
    expect(value.normalCost).toBeCloseTo(4550, 10);
    expect(value.crashingCost).toBeCloseTo(140, 10);
    expect(value.steps.map((s) => s.crashed.join())).toEqual(['J', 'J', 'F', 'F']);
    expect(value.steps.map((s) => s.stepCost)).toEqual([30, 30, 40, 40]);
    expect(value.durations.J).toBe(6);
    expect(value.durations.F).toBe(3);
    const paths = tables.find((t) => t.id === 'rutas')!;
    const last = paths.rows.at(-1)!;
    const lengths = paths.columns.slice(2).map((c) => last[c.key]);
    expect(lengths.sort()).toEqual([31, 39, 39, 40, 40, 40]);
  });

  // Hillier: «If all the activities were to be fully crashed … this duration would be reduced to
  // only 28 weeks». Con una meta inalcanzable, la compresión se detiene en 28.
  it('no baja de la duración con todo comprimido', () => {
    const { value, notices } = ok(crashing.solve({ ...crashing.example, target: 20 }));
    expect(value.finalDuration).toBe(28);
    expect(value.reachedTarget).toBe(false);
    expect(notices.some((n) => n.level === 'warning')).toBe(true);
  });

  // Caso analítico: dos actividades en serie, A (4 → 2, $10 por semana) y B (3 → 2, $5). Con
  // costo indirecto $8 por semana conviene comprimir B (5 < 8) pero no A (10 > 8): T* = 6.
  it('duración de costo total mínimo con costo indirecto', () => {
    const { value } = ok(
      crashing.solve({
        activities: [
          {
            name: 'A',
            predecessors: '',
            normalTime: 4,
            crashTime: 2,
            normalCost: 100,
            crashCost: 120,
          },
          {
            name: 'B',
            predecessors: 'A',
            normalTime: 3,
            crashTime: 2,
            normalCost: 50,
            crashCost: 55,
          },
        ],
        indirectCost: 8,
      }),
    );
    expect(value.optimalDuration).toBe(6);
    expect(value.finalDuration).toBe(4);
    expect(value.steps[0]!.crashed).toEqual(['B']);
  });

  it('validaciones', () => {
    const base = crashing.example.activities[0]!;
    const bad = (activity: Partial<typeof base>) =>
      crashing.inputSchema.safeParse({ activities: [{ ...base, ...activity }] }).success;
    expect(bad({ crashTime: 3 })).toBe(false);
    expect(bad({ crashCost: 100 })).toBe(false);
    expect(bad({ normalTime: 2.5 })).toBe(false);
  });
});

describe('reemplazo de equipo', () => {
  // Taha, 10.ª ed. en inglés (2017), ejemplo 12.3-3 (en miles de dólares):
  //   etapa 4: f4(1) = 79.8 (R), f4(2) = 67.3 (K), f4(3) = 49.8 (R), f4(6) = 4.8 (R)
  //   etapa 3: f3(1) = 85.7 (K), f3(2) = 67.1 (K), f3(5) = 17.0
  //   etapa 2: f2(1) = 85.5 (K o R), f2(4) = 35.5 (R)
  //   etapa 1: f1(3) = 55.3 (R); políticas (R, K, K, R) y (R, R, K, K).
  // En la etapa 3 el libro anota la decisión «R» para t = 5, pero conservar (17.0) supera a
  // reemplazar (9.6) y el propio f3(5) = 17.0 corresponde a conservar.
  it('reproduce las tablas del ejemplo 12.3-3', () => {
    const { value } = ok(replacement.solve(replacement.example));
    const [s1, s2, s3, s4] = value.stages;
    expect(s4![1]).toBeCloseTo(79.8, 10);
    expect(s4![2]).toBeCloseTo(67.3, 10);
    expect(s4![3]).toBeCloseTo(49.8, 10);
    expect(s4![6]).toBeCloseTo(4.8, 10);
    expect(s3![1]).toBeCloseTo(85.7, 10);
    expect(s3![2]).toBeCloseTo(67.1, 10);
    expect(s3![5]).toBeCloseTo(17, 10);
    expect(s2![1]).toBeCloseTo(85.5, 10);
    expect(s2![4]).toBeCloseTo(35.5, 10);
    expect(s1![3]).toBeCloseTo(55.3, 10);
    expect(value.total).toBeCloseTo(55.3, 10);
    expect(value.policies.map((p) => p.join(''))).toEqual(['RKKR', 'RRKK']);
  });

  // Caso analítico: con un año de horizonte se compara conservar r(t) − c(t) + s(t+1) con
  // reemplazar r(0) + s(t) + s(1) − c(0) − I.
  it('horizonte de un año', () => {
    const { value } = ok(replacement.solve({ ...replacement.example, years: 1 }));
    expect(value.total).toBeCloseTo(Math.max(17.2 - 1.5 + 30, 20 + 50 + 80 - 0.2 - 100), 10);
  });

  it('validaciones', () => {
    const schema = replacement.inputSchema;
    expect(schema.safeParse({ ...replacement.example, initialAge: 9 }).success).toBe(false);
    const data = replacement.example.data.map((d, t) =>
      t === 2 ? { ...d, salvage: undefined } : d,
    );
    expect(schema.safeParse({ ...replacement.example, data }).success).toBe(false);
  });
});

describe('convexidad', () => {
  // Hillier, 7.ª ed., apéndice 2: (x1 − x2)² es convexa pero no estrictamente (el primer criterio
  // de la tabla A2.1 da 0); su negativo es cóncava; x1⁴ + 3x1² − 5x1 + 2x1x2 + x2², suma de dos
  // funciones convexas, es convexa (su hessiana [[12x1² + 6, 2], [2, 2]] es definida positiva).
  it('ejemplos del apéndice 2 de Hillier', () => {
    const square = ok(convexity.solve({ expression: '(x1 - x2)^2', lower: -10, upper: 10 })).value;
    expect(square.classification).toBe('convexa');
    expect(square.exact).toBe(true);
    const negative = ok(
      convexity.solve({ expression: '-(x1 - x2)^2', lower: -10, upper: 10 }),
    ).value;
    expect(negative.classification).toBe('cóncava');
    const sum = ok(convexity.solve(convexity.example)).value;
    expect(sum.classification).toBe('estrictamente convexa');
    expect(sum.exact).toBe(false);
  });

  // Hillier, apéndice 2: una función lineal es convexa y cóncava a la vez; x² es estrictamente
  // convexa (f″ = 2 > 0).
  it('una variable y funciones lineales', () => {
    expect(
      ok(convexity.solve({ expression: 'x^2', lower: -5, upper: 5 })).value.classification,
    ).toBe('estrictamente convexa');
    expect(
      ok(convexity.solve({ expression: '3x1 - 2x2', lower: -5, upper: 5 })).value.classification,
    ).toBe('convexa y cóncava (lineal)');
  });

  // Caso analítico: x³ no es convexa ni cóncava en [−1, 1] (f″ = 6x cambia de signo), pero es
  // convexa en [0, 2]; x1·x2 tiene hessiana indefinida.
  it('cambio de curvatura según la región', () => {
    expect(
      ok(convexity.solve({ expression: 'x^3', lower: -1, upper: 1 })).value.classification,
    ).toBe('ni convexa ni cóncava');
    expect(
      ok(convexity.solve({ expression: 'x^3', lower: 0, upper: 2 })).value.classification,
    ).toBe('convexa');
    expect(
      ok(convexity.solve({ expression: 'x1*x2', lower: -1, upper: 1 })).value.classification,
    ).toBe('ni convexa ni cóncava');
  });
});
