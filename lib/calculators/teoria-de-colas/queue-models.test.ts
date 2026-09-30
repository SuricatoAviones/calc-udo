import { describe, expect, it } from 'vitest';
import { mg1 } from './cola-mg1';
import { priorityQueue } from './colas-con-prioridad';
import { seriesQueue } from './colas-en-serie';
import { queueCost } from './costos-de-colas';
import { erlangLoss } from './perdida-de-erlang';
import { finitePopulation } from './poblacion-finita';
import { mm1 } from './mm1';
import { jackson } from './redes-de-jackson';

// Fuentes consultadas: Taha, Investigación de Operaciones, 10.ª ed. en inglés (Pearson, 2017),
// cap. 18; Anderson, Sweeney, Williams, Camm y Martin, An Introduction to Management Science,
// 13.ª ed. (2012), cap. 11; Hillier & Lieberman, Introduction to Operations Research, 7.ª ed.
// (2001), cap. 17; Winston, Operations Research: Applications and Algorithms, 4.ª ed. (2004),
// cap. 20.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('población finita', () => {
  // Anderson, sec. 11.9 (Kolkmeyer): 6 máquinas, λ = 0.05, μ = 0.5, un técnico →
  // P0 = 0.4845, Lq = 0.3297, L = 0.8451, Wq = 1.279 h, W = 3.279 h, Pw = 0.5155.
  it('reproduce el ejemplo de Kolkmeyer con un técnico', () => {
    const { value } = ok(finitePopulation.solve(finitePopulation.example));
    expect(value.p0).toBeCloseTo(0.4845, 4);
    expect(value.Lq).toBeCloseTo(0.3297, 4);
    expect(value.L).toBeCloseTo(0.8451, 4);
    expect(value.Wq).toBeCloseTo(1.279, 3);
    expect(value.W).toBeCloseTo(3.279, 3);
    expect(value.waitProbability).toBeCloseTo(0.5155, 4);
  });

  // Anderson, figura 11.5: con dos técnicos, Wq = 0.0834 h y Pw = 0.1036.
  it('con dos técnicos: Wq = 0.0834 y Pw = 0.1036', () => {
    const { value } = ok(
      finitePopulation.solve({ lambda: 0.05, mu: 0.5, servers: 2, population: 6 }),
    );
    expect(value.Wq).toBeCloseTo(0.0834, 4);
    expect(value.waitProbability).toBeCloseTo(0.1036, 4);
  });

  // Taha, ejemplo 18.6-8 (Toolco), figura 18.9 (salida de TORA) y tabla de productividad:
  //   R  λ_ef    p0      Ls       Lq       Ws      Wq      productividad
  //   1  4.9980  0.0004  12.0040  11.0044  2.4018  2.2018  45.44
  //   2  8.8161  0.0564  4.3677   2.6045   0.4954  0.2954  80.15
  //   3  9.7670  0.1078  2.4660   0.5128   0.2525  0.0525  88.79
  //   4  9.9500  0.1199  2.1001   0.1102   0.2111  0.0111  90.45
  // TORA trunca el cuarto decimal en algunos casos (Ls = 2.46608 aparece como 2.4660), así que se
  // compara con 3 decimales.
  it.each([
    [1, 4.998, 0.0004, 12.004, 11.0044, 2.4018, 2.2018, 45.44],
    [2, 8.8161, 0.0564, 4.3677, 2.6045, 0.4954, 0.2954, 80.15],
    [3, 9.767, 0.1078, 2.466, 0.5128, 0.2525, 0.0525, 88.79],
    [4, 9.95, 0.1199, 2.1001, 0.1102, 0.2111, 0.0111, 90.45],
  ])('Toolco con R = %i reparadores', (R, lambdaEff, p0, L, Lq, W, Wq, productivity) => {
    const { value } = ok(
      finitePopulation.solve({ lambda: 0.5, mu: 5, servers: R, population: 22 }),
    );
    expect(value.lambdaEff).toBeCloseTo(lambdaEff, 3);
    expect(value.p0).toBeCloseTo(p0, 3);
    expect(value.L).toBeCloseTo(L, 3);
    expect(value.Lq).toBeCloseTo(Lq, 3);
    expect(value.W).toBeCloseTo(W, 3);
    expect(value.Wq).toBeCloseTo(Wq, 3);
    expect(value.productivity).toBeCloseTo(productivity, 2);
  });

  it('las probabilidades suman 1 y llegan hasta n = K', () => {
    const { value } = ok(finitePopulation.solve(finitePopulation.example));
    expect(value.probabilities).toHaveLength(7);
    expect(value.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('no admite más servidores que clientes', () => {
    const parsed = finitePopulation.inputSchema.safeParse({
      lambda: 1,
      mu: 1,
      servers: 5,
      population: 3,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('análisis de costos', () => {
  // Taha, ejemplo 18.9-2: λ = 17.5, μ = 10, C1 = 12, C2 = 50.
  //   c  Ls(c)  ETC(c)
  //   2  7.467  397.35
  //   3  2.217  146.85
  //   4  1.842  140.10
  //   5  1.769  148.45
  //   6  1.754  159.70     → óptimo c = 4
  it('reproduce la tabla del ejemplo 18.9-2', () => {
    const { value } = ok(queueCost.solve(queueCost.example));
    expect(value.minimumServers).toBe(2);
    const expected = [
      [7.467, 397.35],
      [2.217, 146.85],
      [1.842, 140.1],
      [1.769, 148.45],
      [1.754, 159.7],
    ];
    expected.forEach(([L, cost], i) => {
      // TORA trunca el tercer decimal (L(5) = 1.76962 aparece como 1.769).
      expect(Math.abs(value.rows[i]!.customers - L!)).toBeLessThan(1e-3);
      // El libro calcula ETC con L redondeado a 3 decimales: ±0.05.
      expect(Math.abs(value.rows[i]!.totalCost - cost!)).toBeLessThan(0.05);
    });
    expect(value.optimalServers).toBe(4);
  });

  // Anderson, sec. 11.5 (Burger Dome): λ = 0.75, μ = 1 por minuto; cw = $10/h, cs = $7/h.
  // Un canal: L = 3, CT = $37.00; dos canales: L = 0.8727, CT = $22.73.
  it('reproduce Burger Dome', () => {
    const { value } = ok(
      queueCost.solve({
        lambda: 0.75,
        mu: 1,
        serviceCost: 7,
        waitingCost: 10,
        basis: 'sistema',
        maxServers: 2,
      }),
    );
    expect(value.rows[0]!.customers).toBeCloseTo(3, 10);
    expect(value.rows[0]!.totalCost).toBeCloseTo(37, 10);
    expect(value.rows[1]!.customers).toBeCloseTo(0.8727, 4);
    expect(value.rows[1]!.totalCost).toBeCloseTo(22.73, 2);
    expect(value.optimalServers).toBe(2);
  });

  // Caso borde analítico: con la base «cola», un servidor de M/M/1 cuesta C_w·Lq = C_w·ρ²/(1−ρ).
  it('con la base «cola» usa Lq', () => {
    const { value } = ok(
      queueCost.solve({
        lambda: 0.75,
        mu: 1,
        serviceCost: 7,
        waitingCost: 10,
        basis: 'cola',
        maxServers: 1,
      }),
    );
    expect(value.rows[0]!.customers).toBeCloseTo(2.25, 10);
  });

  it('sin opciones estables → no-stable-option', () => {
    const result = queueCost.solve({ ...queueCost.example, maxServers: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('no-stable-option');
  });
});

describe('pérdida de Erlang', () => {
  // Anderson, sec. 11.8 (Microdata): λ = 12, μ = 6. Con 3 líneas P3 = 0.2105; con 4 líneas
  // P4 = 0.0952 y L = 1.8095; tabla 11.6: 0.1429, 0.2857, 0.2857, 0.1905, 0.0952.
  it('reproduce la tabla 11.6 con cuatro líneas', () => {
    const { value } = ok(erlangLoss.solve(erlangLoss.example));
    [0.1429, 0.2857, 0.2857, 0.1905, 0.0952].forEach((p, j) =>
      expect(value.probabilities[j]).toBeCloseTo(p, 4),
    );
    expect(value.blocking).toBeCloseTo(0.0952, 4);
    expect(value.L).toBeCloseTo(1.8095, 4);
    // «8(12)(0.0952) = 9.1 llamadas bloqueadas» en un día de 8 horas.
    expect(8 * value.lost).toBeCloseTo(9.1, 1);
  });

  it('con tres líneas se bloquea el 21 % y hacen falta 4 para la meta del 90 %', () => {
    const { value } = ok(erlangLoss.solve({ lambda: 12, mu: 6, servers: 3, maxBlocking: 0.1 }));
    expect(value.blocking).toBeCloseTo(0.2105, 4);
    expect(value.requiredServers).toBe(4);
  });

  // Caso borde analítico: con un servidor, B = r/(1 + r).
  it('con un servidor B = r/(1 + r)', () => {
    const { value } = ok(erlangLoss.solve({ lambda: 3, mu: 1, servers: 1 }));
    expect(value.blocking).toBeCloseTo(0.75, 12);
    expect(value.requiredServers).toBeNull();
  });

  it('meta inalcanzable → target-unreachable', () => {
    const result = erlangLoss.solve({ lambda: 500, mu: 1, servers: 1, maxBlocking: 0.01 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('target-unreachable');
  });
});

describe('M/G/1', () => {
  // Anderson, sec. 11.7 (Hartlage's): λ = 0.35, μ = 0.5, σ = 1.2 min →
  // P0 = 0.30, Lq = 1.1107, L = 1.8107, Wq = 3.1733, W = 5.1733, Pw = 0.70.
  it('reproduce el ejemplo de Hartlage', () => {
    const { value } = ok(mg1.solve(mg1.example));
    expect(value.p0).toBeCloseTo(0.3, 10);
    expect(value.Lq).toBeCloseTo(1.1107, 4);
    expect(value.L).toBeCloseTo(1.8107, 4);
    expect(value.Wq).toBeCloseTo(3.1733, 4);
    expect(value.W).toBeCloseTo(5.1733, 4);
  });

  // Taha, ejemplo 18.7-1: servicio constante de 10 min (μ = 6/h), λ = 4/h →
  // Ls = 1.333, Lq = .667, Ws = .333 h, Wq = .167 h.
  it('servicio constante (M/D/1) del lavado de autos', () => {
    const { value } = ok(mg1.solve({ lambda: 4, mu: 6, sigma: 0 }));
    expect(value.L).toBeCloseTo(1.333, 3);
    expect(value.Lq).toBeCloseTo(0.667, 3);
    expect(value.W).toBeCloseTo(0.333, 3);
    expect(value.Wq).toBeCloseTo(0.167, 3);
  });

  // Caso borde analítico: con σ = 1/μ, P-K da las medidas del M/M/1.
  it('con σ = 1/μ coincide con M/M/1', () => {
    const general = ok(mg1.solve({ lambda: 4, mu: 6, sigma: 1 / 6 })).value;
    const exponential = ok(mm1.solve({ lambda: 4, mu: 6 })).value;
    expect(general.L).toBeCloseTo(exponential.L, 12);
    expect(general.Wq).toBeCloseTo(exponential.Wq, 12);
  });

  it('ρ ≥ 1 → unstable', () => {
    const result = mg1.solve({ lambda: 6, mu: 6, sigma: 0.1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unstable');
  });
});

describe('colas con prioridad', () => {
  // Hillier, sec. 17.8, tabla 17.4 (hospital del condado): λ = 2 (0.2, 0.6, 1.2), μ = 3.
  //                 Con interrupción              Sin interrupción
  //                 s = 1        s = 2            s = 1       s = 2
  //   A             —            —                4.5         36
  //   B1, B2, B3    0.933, 0.733, 0.333           (s = 2: 0.967, 0.867, 0.667)
  //   W1 − 1/μ      0.024 h      0.00037 h        0.238 h     0.029 h
  //   W2 − 1/μ      0.154 h      0.00793 h        0.325 h     0.033 h
  //   W3 − 1/μ      1.033 h      0.06542 h        0.889 h     0.048 h
  //
  // Para la clase 3 con un médico el libro imprime 1.033 y 0.889, que no cumplen la ley de
  // conservación: con μ igual para todas las clases, el promedio ponderado Σ (λ_k/λ) W_{q,k} debe
  // ser el W_q = 2/3 del M/M/1 con λ = 2 (y Σ (λ_k/λ) W_k su W = 1). Con las clases 1 y 2 del
  // libro eso exige W₃ − 1/μ = 1.030 (con interrupción) y 0.909 (sin interrupción), que es lo que
  // dan las fórmulas del propio libro; se verifican esos valores.
  const waits = (servers: number, discipline: 'apropiativa' | 'no-apropiativa') =>
    ok(priorityQueue.solve({ rates: '0.2, 0.6, 1.2', mu: 3, servers, discipline })).value;

  it('con interrupción y dos médicos (procedimiento iterativo del libro)', () => {
    const value = waits(2, 'apropiativa');
    // Pasos intermedios del libro: W1 = 0.33370, W2 = 0.34126, W3 = 0.39875. El libro calcula
    // W2 y W3 con W̄ redondeados a 5 decimales (W2 exacto = 0.341254, W3 = 0.398756), así que
    // se comparan a 4 decimales.
    expect(value.classes[0]!.W).toBeCloseTo(0.3337, 5);
    expect(value.classes[1]!.W).toBeCloseTo(0.34126, 4);
    expect(value.classes[2]!.W).toBeCloseTo(0.39875, 4);
    expect(value.classes[0]!.Wq).toBeCloseTo(0.00037, 5);
    expect(value.classes[1]!.Wq).toBeCloseTo(0.00793, 4);
    expect(value.classes[2]!.Wq).toBeCloseTo(0.06542, 5);
  });

  it('con interrupción y un médico', () => {
    const value = waits(1, 'apropiativa');
    expect(value.classes[0]!.Wq).toBeCloseTo(0.024, 3);
    expect(value.classes[1]!.Wq).toBeCloseTo(0.154, 3);
    expect(value.classes[2]!.Wq).toBeCloseTo(1.03, 3);
    expect(value.B.slice(1).map((b) => Number(b.toFixed(3)))).toEqual([0.933, 0.733, 0.333]);
    const averageW = value.classes.reduce((sum, c) => sum + (c.lambda / 2) * c.W!, 0);
    expect(averageW).toBeCloseTo(1, 12);
  });

  it('sin interrupción, uno y dos médicos', () => {
    const one = waits(1, 'no-apropiativa');
    expect(one.A).toBeCloseTo(4.5, 10);
    expect(one.classes[0]!.Wq).toBeCloseTo(0.238, 3);
    expect(one.classes[1]!.Wq).toBeCloseTo(0.325, 3);
    expect(one.classes[2]!.Wq).toBeCloseTo(0.909, 3);
    const averageWq = one.classes.reduce((sum, c) => sum + (c.lambda / 2) * c.Wq!, 0);
    expect(averageWq).toBeCloseTo(2 / 3, 12);
    const two = waits(2, 'no-apropiativa');
    expect(two.A).toBeCloseTo(36, 10);
    [0.029, 0.033, 0.048].forEach((w, k) => expect(two.classes[k]!.Wq).toBeCloseTo(w, 3));
  });

  // Caso borde analítico: una sola clase es un M/M/s cualquiera sea la disciplina.
  it('con una sola clase coincide con M/M/1', () => {
    const value = ok(
      priorityQueue.solve({ rates: '2', mu: 3, servers: 1, discipline: 'no-apropiativa' }),
    ).value;
    expect(value.classes[0]!.W).toBeCloseTo(1, 12);
  });

  // Caso borde: con interrupción, las clases que caben siguen teniendo estado estable.
  it('clases de menor prioridad sin estado estable', () => {
    const result = ok(
      priorityQueue.solve({ rates: '1, 1.5, 2', mu: 3, servers: 1, discipline: 'apropiativa' }),
    );
    expect(result.value.classes[2]!.W).toBeNull();
    expect(result.notices.some((n) => n.level === 'warning')).toBe(true);
  });

  it('errores: sin interrupción y λ ≥ sμ, datos inválidos', () => {
    const unstable = priorityQueue.solve({
      rates: '1, 1.5, 2',
      mu: 3,
      servers: 1,
      discipline: 'no-apropiativa',
    });
    expect(!unstable.ok && unstable.error.code).toBe('unstable');
    const invalid = priorityQueue.solve({
      rates: 'a',
      mu: 3,
      servers: 1,
      discipline: 'apropiativa',
    });
    expect(!invalid.ok && invalid.error.code).toBe('invalid-data');
  });
});

describe('colas en serie', () => {
  // Winston, sec. 20.10, ejemplo 13: λ = 54; motor (s = 1, μ = 60): ρ = .90, Lq = 8.1 autos,
  // Wq = 0.15 h. Neumáticos (s = 3, μ = 20): ρ = .90, P(j ≥ 3) = .83 leído de la tabla 6, Lq =
  // .83(.90)/(1 − .90) = 7.47 y Wq = 0.138 h; espera total 0.288 h. El valor exacto de
  // P(j ≥ 3) es 0.8171, que da Lq = 7.354 y Wq = 0.1362: la diferencia es el redondeo de la
  // tabla, así que para la estación 2 se verifica la relación del libro y P(j ≥ 3) a 1 decimal.
  it('reproduce el ejemplo del ensamblaje de autos', () => {
    const { value } = ok(seriesQueue.solve(seriesQueue.example));
    const [engine, tires] = value.stations;
    expect(engine!.rho).toBeCloseTo(0.9, 12);
    expect(engine!.Lq).toBeCloseTo(8.1, 10);
    expect(engine!.Wq).toBeCloseTo(0.15, 10);
    expect(tires!.rho).toBeCloseTo(0.9, 12);
    expect(tires!.waitProbability).toBeCloseTo(0.83, 1);
    expect(tires!.Lq).toBeCloseTo((tires!.waitProbability * 0.9) / 0.1, 10);
    expect(value.Wq).toBeCloseTo(0.288, 2);
  });

  it('una estación sin capacidad → unstable', () => {
    const result = seriesQueue.solve({ lambda: 54, stations: [{ servers: 2, mu: 20 }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unstable');
  });
});

describe('redes de Jackson', () => {
  // Hillier, sec. 17.9, tabla 17.5. Las ecuaciones del libro son λ1 = 1 + 0.1λ2 + 0.4λ3,
  // λ2 = 4 + 0.6λ1 + 0.4λ3, λ3 = 3 + 0.3λ1 + 0.3λ2, con solución λ1 = 5, λ2 = 10, λ3 = 7½;
  // L1 = 1, L2 = 4/3, L3 = 3; L = 5⅓ y W = L/8 = 2/3.
  it('reproduce el ejemplo de la tabla 17.5', () => {
    const { value } = ok(jackson.solve(jackson.example));
    expect(value.lambdas[0]).toBeCloseTo(5, 10);
    expect(value.lambdas[1]).toBeCloseTo(10, 10);
    expect(value.lambdas[2]).toBeCloseTo(7.5, 10);
    expect(value.stations[0]!.L).toBeCloseTo(1, 10);
    expect(value.stations[1]!.L).toBeCloseTo(4 / 3, 10);
    expect(value.stations[2]!.L).toBeCloseTo(3, 10);
    expect(value.L).toBeCloseTo(16 / 3, 10);
    expect(value.W).toBeCloseTo(2 / 3, 10);
  });

  // Winston, sec. 20.10, ejemplo 14: r1 = 8, r2 = 17, μ1 = 20, μ2 = 30, p12 = .5, p21 = .25 →
  // λ1 = 14, λ2 = 24; el servidor 1 está libre el 30 % del tiempo; L1 = 7/3, L2 = 4,
  // L = 19/3, W = 19/75 h. Con μ2 = 20 no hay estado estable.
  it('reproduce el ejemplo 14 de Winston', () => {
    const input = {
      stations: [
        { servers: 1, mu: 20, external: 8 },
        { servers: 1, mu: 30, external: 17 },
      ],
      routing: [
        [0, 0.5],
        [0.25, 0],
      ],
    };
    const { value } = ok(jackson.solve(input));
    expect(value.lambdas[0]).toBeCloseTo(14, 10);
    expect(value.lambdas[1]).toBeCloseTo(24, 10);
    expect(value.stations[0]!.p0).toBeCloseTo(0.3, 10);
    expect(value.stations[0]!.L).toBeCloseTo(7 / 3, 10);
    expect(value.stations[1]!.L).toBeCloseTo(4, 10);
    expect(value.W).toBeCloseTo(19 / 75, 10);

    const slower = jackson.solve({
      ...input,
      stations: [input.stations[0]!, { servers: 1, mu: 20, external: 17 }],
    });
    expect(!slower.ok && slower.error.code).toBe('unstable');
  });

  // Caso borde: dos estaciones que se envían todos sus clientes entre sí nunca los liberan.
  it('rutas que retienen a los clientes → singular', () => {
    const result = jackson.solve({
      stations: [
        { servers: 1, mu: 10, external: 1 },
        { servers: 1, mu: 10, external: 0 },
      ],
      routing: [
        [0, 1],
        [1, 0],
      ],
    });
    expect(!result.ok && result.error.code).toBe('singular');
  });

  it('valida el tamaño de la matriz y las filas', () => {
    const base = jackson.example;
    expect(jackson.inputSchema.safeParse({ ...base, routing: [[0]] }).success).toBe(false);
    expect(
      jackson.inputSchema.safeParse({
        ...base,
        routing: [
          [0, 0.8, 0.4],
          [0.6, 0, 0.4],
          [0.3, 0.3, 0],
        ],
      }).success,
    ).toBe(false);
  });
});
