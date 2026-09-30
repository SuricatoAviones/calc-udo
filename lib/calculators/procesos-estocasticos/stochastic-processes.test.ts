import { describe, expect, it } from 'vitest';
import { mm1k } from '../teoria-de-colas/mm1k';
import { randomWalk } from './caminata-aleatoria';
import { stateClassification } from './clasificacion-de-estados';
import { birthDeath } from './nacimiento-y-muerte';
import { poissonProcess } from './proceso-de-poisson';
import { simulation } from './simulacion';

// Fuentes consultadas: Taha, Investigación de Operaciones, 10.ª ed. en inglés (Pearson, 2017),
// caps. 17 a 19; Hillier & Lieberman, Introduction to Operations Research, 7.ª ed. (2001),
// cap. 16.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('clasificación de estados', () => {
  const classify = (P: number[][]) => ok(stateClassification.solve({ P })).value;

  // Taha, ejemplo 17.3-1: el jardinero sin fertilizante. «States 1 and 2 are transient … State
  // 3 is absorbing.»
  it('Taha 17.3-1: estados transitorios y absorbente', () => {
    const value = classify([
      [0.2, 0.5, 0.3],
      [0, 0.5, 0.5],
      [0, 0, 1],
    ]);
    expect(value.states.map((s) => s.kind)).toEqual(['transitorio', 'transitorio', 'absorbente']);
    expect(value.ergodic).toBe(false);
  });

  // Taha, sec. 17.3: en P = [[0,1,0,0],[0,0,1,0],[0,0,.3,.7],[0,0,.4,.6]] los estados 1 y 2 son
  // transitorios y 3 y 4 forman una clase cerrada.
  it('Taha 17.3: clase cerrada {3, 4}', () => {
    const value = classify([
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0.3, 0.7],
      [0, 0, 0.4, 0.6],
    ]);
    expect(value.states.map((s) => s.kind)).toEqual([
      'transitorio',
      'transitorio',
      'recurrente',
      'recurrente',
    ]);
    expect(value.classes.find((c) => c.closed)!.states).toEqual([3, 4]);
    expect(value.classes.find((c) => c.closed)!.period).toBe(1);
  });

  // Taha, ejemplo 17.3-2: «each of states 1 and 3 has period t = 2».
  it('Taha 17.3-2: estados periódicos', () => {
    const value = classify([
      [0, 0.6, 0.4],
      [0, 1, 0],
      [0.6, 0.4, 0],
    ]);
    expect(value.states[0]!.period).toBe(2);
    expect(value.states[2]!.period).toBe(2);
    expect(value.states[1]!.kind).toBe('absorbente');
  });

  // Hillier, secs. 16.2 y 16.4 (juego con $0 a $3): tres clases, {0}, {1, 2} y {3}; los estados 1
  // y 2 tienen período 2. Aquí los estados 0 … 3 son 1 … 4.
  it('Hillier 16.4: el juego tiene tres clases y período 2', () => {
    const value = classify([
      [1, 0, 0, 0],
      [0.5, 0, 0.5, 0],
      [0, 0.5, 0, 0.5],
      [0, 0, 0, 1],
    ]);
    expect(value.classes.map((c) => c.states)).toEqual([[1], [2, 3], [4]]);
    expect(value.states[1]!.period).toBe(2);
    expect(value.states[1]!.kind).toBe('transitorio');
  });

  // Taha, ejemplo 17.3/17.4: el jardinero con fertilizante es ergódico.
  it('cadena ergódica', () => {
    const value = classify([
      [0.3, 0.6, 0.1],
      [0.1, 0.6, 0.3],
      [0.05, 0.4, 0.55],
    ]);
    expect(value.irreducible).toBe(true);
    expect(value.ergodic).toBe(true);
    expect(value.absorption).toBeNull();
  });

  // Taha, ejemplo 17.6-1: (I − N)⁻¹ tiene primera fila 1.07, 1.02, .98, .93 y
  // (I − N)⁻¹A = [[.16, .84], [.12, .88], [.08, .92], [.04, .96]] (J y G).
  it('Taha 17.6-1: matriz fundamental y probabilidades de absorción', () => {
    const { absorption } = ok(stateClassification.solve(stateClassification.example)).value;
    [1.07, 1.02, 0.98, 0.93].forEach((v, j) =>
      expect(absorption!.fundamental[0]![j]).toBeCloseTo(v, 2),
    );
    const expected = [
      [0.16, 0.84],
      [0.12, 0.88],
      [0.08, 0.92],
      [0.04, 0.96],
    ];
    expected.forEach((row, i) =>
      row.forEach((v, j) => expect(absorption!.probabilities[i]![j]).toBeCloseTo(v, 2)),
    );
  });
});

describe('proceso de Poisson', () => {
  // Taha, ejemplo 18.4-1: un nacimiento cada 12 minutos (λ = 5/h).
  // (c) 50 actas en 3 h sabiendo que hubo 40 en las 2 primeras = 10 nacimientos en 1 h: .01813.
  it('Taha 18.4-1(c): incrementos independientes', () => {
    const { value } = ok(poissonProcess.solve(poissonProcess.example));
    expect(value.remaining).toBe(10);
    expect(value.mean).toBeCloseTo(5, 12);
    expect(value.probability).toBeCloseTo(0.01813, 5);
  });

  // (a) 120 × 365 = 43,800 nacimientos por año; (b) P{ningún nacimiento en un día} = e^{−120} ≈ 0.
  it('Taha 18.4-1(a)(b): media anual y ningún nacimiento en un día', () => {
    const year = ok(poissonProcess.solve({ lambda: 120, t: 365, n: 0, query: 'igual' })).value;
    expect(year.mean).toBeCloseTo(43800, 6);
    const day = ok(poissonProcess.solve({ lambda: 120, t: 1, n: 0, query: 'igual' })).value;
    expect(day.probability).toBeCloseTo(Math.exp(-120), 60);
  });

  // Taha, «Excel Moment» del mismo ejemplo: con λt = 2.5, P{n = 10} = .000216 y P{n ≤ 10} =
  // .9999382; con 2.5 y .3, la probabilidad exponencial es .527633. El valor exacto de la
  // acumulada es 0.99993837 (el libro trunca el séptimo decimal), así que se compara a 6.
  it('Taha, Excel Moment: Poisson acumulada y exponencial', () => {
    const exact = ok(poissonProcess.solve({ lambda: 5, t: 0.5, n: 10, query: 'igual' })).value;
    expect(exact.probability).toBeCloseTo(0.000216, 6);
    const atMost = ok(
      poissonProcess.solve({ lambda: 5, t: 0.5, n: 10, query: 'a-lo-sumo', waitingTime: 0.3 }),
    ).value;
    expect(atMost.probability).toBeCloseTo(0.9999382, 6);
    const wait = ok(
      poissonProcess.solve({ lambda: 2.5, t: 1, n: 1, query: 'igual', waitingTime: 0.3 }),
    ).value;
    expect(wait.interarrival!.atMost).toBeCloseTo(0.527633, 6);
  });

  // Caso borde analítico: P{N ≥ n} = 1 − P{N ≤ n − 1} y P{N ≥ 0} = 1.
  it('al menos n eventos', () => {
    const atLeast = ok(poissonProcess.solve({ lambda: 5, t: 0.5, n: 11, query: 'al-menos' })).value;
    expect(atLeast.probability).toBeCloseTo(1 - 0.9999382, 6);
    const trivial = ok(poissonProcess.solve({ lambda: 5, t: 1, n: 0, query: 'al-menos' })).value;
    expect(trivial.probability).toBe(1);
  });

  it('valida lo ya observado', () => {
    const schema = poissonProcess.inputSchema;
    const base = { lambda: 5, t: 3, n: 50, query: 'igual' as const };
    expect(schema.safeParse({ ...base, observedTime: 2 }).success).toBe(false);
    expect(schema.safeParse({ ...base, observedTime: 3, observedCount: 1 }).success).toBe(false);
  });
});

describe('caminata aleatoria', () => {
  // Hillier, sec. 16.7: A tiene $2 de un total de $4 y gana cada apuesta con probabilidad 1/3.
  // Resolviendo el sistema del libro, la probabilidad de que B quede en bancarrota (A llega a 4)
  // es f₂₄ = 1/5 y la de que A pierda todo, f₂₀ = 4/5.
  it('Hillier 16.7: ruina del jugador', () => {
    const { value } = ok(randomWalk.solve(randomWalk.example));
    expect(value.absorption!.top).toBeCloseTo(0.2, 12);
    expect(value.absorption!.bottom).toBeCloseTo(0.8, 12);
  });

  // La misma cadena en la clasificación de estados (estados 0 … 4 → 1 … 5) da la misma
  // probabilidad de absorción.
  it('coincide con la matriz fundamental de la cadena', () => {
    const P = [
      [1, 0, 0, 0, 0],
      [2 / 3, 0, 1 / 3, 0, 0],
      [0, 2 / 3, 0, 1 / 3, 0],
      [0, 0, 2 / 3, 0, 1 / 3],
      [0, 0, 0, 0, 1],
    ];
    const { absorption } = ok(stateClassification.solve({ P })).value;
    // Fila del estado 2 (transitorio 1, 2, 3 → índice 1), columna del estado 4 (recurrentes 0, 4).
    expect(absorption!.probabilities[1]![1]).toBeCloseTo(0.2, 12);
    expect(absorption!.stepsToAbsorption[1]).toBeCloseTo(3.6, 12);
  });

  // Caso analítico (análisis del primer paso): D₂ = 1 + D₃/3 + 2D₁/3 con D₁ = 1 + D₂/3 y
  // D₃ = 1 + 2D₂/3 da D₂ = 3.6. Con muchos pasos, la masa en las barreras tiende a 4/5 y 1/5.
  it('pasos esperados y distribución a largo plazo', () => {
    const { value } = ok(randomWalk.solve({ ...randomWalk.example, steps: 200 }));
    expect(value.absorption!.expectedSteps).toBeCloseTo(3.6, 12);
    const at = (k: number) => value.distribution.find((d) => d.position === k)?.probability ?? 0;
    expect(at(4)).toBeCloseTo(0.2, 10);
    expect(at(0)).toBeCloseTo(0.8, 10);
  });

  // Caso analítico: sin barreras, con p = q = 1/2 y n = 4 desde 0, P{X = 0} = C(4, 2)/16 = 0.375,
  // P{X = 2} = 4/16, P{X = 4} = 1/16; E = 0 y Var = 4.
  it('sin barreras: distribución binomial', () => {
    const { value } = ok(
      randomWalk.solve({ p: '1/2', q: '0.5', start: 0, steps: 4, barriers: 'ninguna' }),
    );
    const at = (k: number) => value.distribution.find((d) => d.position === k)!.probability;
    expect(at(0)).toBeCloseTo(0.375, 12);
    expect(at(2)).toBeCloseTo(0.25, 12);
    expect(at(-4)).toBeCloseTo(0.0625, 12);
    expect(value.mean).toBeCloseTo(0, 12);
    expect(value.variance).toBeCloseTo(4, 12);
  });

  // Caso analítico: con p = q la probabilidad de llegar a N es i/N; quedarse (r > 0) no cambia
  // a dónde se llega, pero duplica los pasos esperados si r = 1/2.
  it('p = q y pasos en los que no se mueve', () => {
    const walk = (p: string, q: string) =>
      ok(randomWalk.solve({ p, q, start: 1, steps: 5, barriers: 'absorbentes', upper: 4 })).value
        .absorption!;
    expect(walk('1/2', '1/2').top).toBeCloseTo(0.25, 12);
    expect(walk('1/2', '1/2').expectedSteps).toBeCloseTo(3, 12);
    expect(walk('1/4', '1/4').top).toBeCloseTo(0.25, 12);
    expect(walk('1/4', '1/4').expectedSteps).toBeCloseTo(6, 12);
  });

  it('validaciones', () => {
    const schema = randomWalk.inputSchema;
    const base = { start: 2, steps: 3, barriers: 'absorbentes' as const, upper: 4 };
    expect(schema.safeParse({ ...base, p: '0.7', q: '0.5' }).success).toBe(false);
    expect(schema.safeParse({ ...base, p: '0', q: '0' }).success).toBe(false);
    expect(schema.safeParse({ ...base, p: '0.5', q: '0.5', start: 6 }).success).toBe(false);
    expect(schema.safeParse({ ...base, p: 'x', q: '0.5' }).success).toBe(false);
  });
});

describe('nacimiento y muerte', () => {
  // Taha, ejemplo 18.5-1 (B&K Groceries): p₀ = 1/55 y P{a lo sumo 3 clientes} = 15/55 = .273.
  it('Taha 18.5-1: B&K Groceries', () => {
    const { value } = ok(birthDeath.solve(birthDeath.example));
    expect(value.p0).toBeCloseTo(1 / 55, 12);
    const p = value.probabilities;
    expect(p[0]! + p[1]! + p[2]! + p[3]!).toBeCloseTo(15 / 55, 12);
    // p₁ = 2p₀, p₂ = 4p₀, p₃ … p₆ = 8p₀, p₇ = 8(2/3)p₀.
    expect(p[1]! / p[0]!).toBeCloseTo(2, 12);
    expect(p[6]! / p[0]!).toBeCloseTo(8, 12);
    expect(p[7]! / p[0]!).toBeCloseTo(16 / 3, 12);
  });

  // Caso analítico: tasas constantes = M/M/1 (Taha, ejemplo 18.6-2: λ = 4, μ = 6 → p₀ = 1/3,
  // L = 2, W = 0.5).
  it('tasas constantes: M/M/1', () => {
    const { value } = ok(birthDeath.solve({ segments: [{ from: 0, lambda: 4, mu: 6 }] }));
    expect(value.p0).toBeCloseTo(1 / 3, 12);
    expect(value.L).toBeCloseTo(2, 10);
    expect(value.W).toBeCloseTo(0.5, 10);
  });

  // Caso analítico: con capacidad K coincide con el M/M/1/K ya verificado (Taha 17.6-4 de la
  // 7.ª ed.): λ_ef = 3.80752 y L = 1.42256.
  it('con capacidad: M/M/1/K', () => {
    const { value } = ok(
      birthDeath.solve({ segments: [{ from: 0, lambda: 4, mu: 6 }], capacity: 5 }),
    );
    const reference = ok(mm1k.solve(mm1k.example)).value;
    expect(value.p0).toBeCloseTo(reference.p0, 12);
    expect(value.L).toBeCloseTo(reference.L, 12);
    expect(value.lambdaBar).toBeCloseTo(reference.lambdaEff, 12);
  });

  it('sin estado estable y validaciones', () => {
    const unstable = birthDeath.solve({ segments: [{ from: 0, lambda: 6, mu: 6 }] });
    expect(!unstable.ok && unstable.error.code).toBe('no-steady-state');
    const dead = birthDeath.solve({
      segments: [
        { from: 0, lambda: 1, mu: 2 },
        { from: 2, lambda: 1, mu: 0 },
      ],
      capacity: 4,
    });
    expect(!dead.ok && dead.error.code).toBe('dead-state');
    const schema = birthDeath.inputSchema;
    expect(schema.safeParse({ segments: [{ from: 1, lambda: 1, mu: 2 }] }).success).toBe(false);
  });
});

describe('simulación', () => {
  // Taha, ejemplo 19.5-1 (barbería HairKare) con la columna 1 de la tabla 19.1. El libro redondea
  // cada tiempo a 2 decimales antes de seguir, así que se compara a 1 decimal:
  //   llegadas 0, 42.48, 53.49, 60.81, 61.83; salidas 13.37, 57.22, 70.19, 81.08, 92.82;
  //   esperas 0, 0, 3.73, 9.38, 19.25; cola promedio .349; utilización .686; Wq = 6.47 min.
  it('reproduce la simulación manual de la barbería', () => {
    const { value } = ok(simulation.solve(simulation.example));
    [0, 42.48, 53.49, 60.81, 61.83].forEach((t, i) =>
      expect(value.customers[i]!.arrival).toBeCloseTo(t, 1),
    );
    [13.37, 57.22, 70.19, 81.08, 92.82].forEach((t, i) =>
      expect(value.customers[i]!.departure).toBeCloseTo(t, 1),
    );
    [0, 0, 3.73, 9.38, 19.25].forEach((w, i) => expect(value.customers[i]!.wait).toBeCloseTo(w, 1));
    expect(value.averageQueue).toBeCloseTo(0.349, 2);
    expect(value.utilization).toBeCloseTo(0.686, 2);
    expect(value.averageWait).toBeCloseTo(6.47, 1);
    // Se usan los 9 primeros números en el orden de los eventos.
    expect(value.randomNumbers).toEqual([
      0.0589, 0.6733, 0.4799, 0.9486, 0.6139, 0.5933, 0.9341, 0.1782, 0.3473,
    ]);
  });

  // Taha, ejemplo 19.4-1: b = 9, c = 5, m = 12, u₀ = 11 → R = .6667, .4167, .1667; el ciclo
  // tiene longitud 4.
  it('generador congruencial del ejemplo 19.4-1', () => {
    const result = ok(
      simulation.solve({ ...simulation.example, source: 'congruencial', customers: 2 }),
    );
    expect(result.value.supply.slice(0, 3).map((r) => Number(r.toFixed(4)))).toEqual([
      0.6667, 0.4167, 0.1667,
    ]);
    expect(result.steps[0]!.result).toContain('4');
  });

  // Caso analítico: llegadas cada 10 y servicio constante de 5 → nadie espera; el último de los 5
  // clientes sale en T = 45 y el servidor estuvo ocupado 25, así que la utilización es 25/45.
  it('tiempos constantes sin números aleatorios', () => {
    const { value } = ok(
      simulation.solve({
        ...simulation.example,
        arrivalDistribution: 'constante',
        arrivalA: 10,
        serviceDistribution: 'constante',
        serviceA: 5,
      }),
    );
    expect(value.randomNumbers).toHaveLength(0);
    expect(value.averageWait).toBe(0);
    expect(value.totalTime).toBeCloseTo(45, 12);
    expect(value.utilization).toBeCloseTo(25 / 45, 12);
  });

  it('pocos números → not-enough-numbers con la traza', () => {
    const result = simulation.solve({ ...simulation.example, numbers: '0.5 0.5 0.5' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('not-enough-numbers');
      expect(result.steps.length).toBeGreaterThan(0);
    }
  });

  it('validaciones', () => {
    const schema = simulation.inputSchema;
    expect(schema.safeParse({ ...simulation.example, numbers: '0.5 1.2' }).success).toBe(false);
    expect(schema.safeParse({ ...simulation.example, serviceB: 5 }).success).toBe(false);
    expect(
      schema.safeParse({ ...simulation.example, source: 'congruencial', seed: 20 }).success,
    ).toBe(false);
  });
});
