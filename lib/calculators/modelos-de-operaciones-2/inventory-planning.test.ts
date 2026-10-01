import { describe, expect, it } from 'vitest';
import { abc } from './clasificacion-abc';
import { productionLot } from './lote-economico-de-produccion';
import { mrp } from './mrp';
import { periodicReview } from './revision-periodica';
import { forecastSelection } from './seleccion-de-metodo-de-pronostico';

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('comparación de métodos de pronóstico', () => {
  // Anderson, Sweeney, Williams, Camm y Martin, An Introduction to Management Science, 13.ª ed.
  // (2012), secs. 15.2 y 15.3, serie de la gasolina:
  //   ingenuo: MAE 3.73, MSE 16.27, MAPE 19.24 %; promedio de los datos anteriores: MAE 2.44,
  //   MSE 8.10, MAPE 12.85 %; promedio móvil de 3 semanas: MAE 2.67, MSE 10.22, MAPE 14.36 %;
  //   «the minimum value of MSE corresponds to a moving average of order k = 6 with MSE = 6.79»;
  //   suavizamiento exponencial con α = 0.2: MSE = 98.80/11 = 8.98.
  it('reproduce las medidas de exactitud del libro', () => {
    const { value } = ok(forecastSelection.solve(forecastSelection.example));
    const by = (name: string) => value.methods.find((m) => m.method.startsWith(name))!.accuracy;
    expect(by('Ingenuo').mad).toBeCloseTo(3.73, 2);
    expect(by('Ingenuo').mse).toBeCloseTo(16.27, 2);
    expect(by('Ingenuo').mape).toBeCloseTo(19.24, 2);
    expect(by('Promedio de los datos').mad).toBeCloseTo(2.44, 2);
    expect(by('Promedio de los datos').mse).toBeCloseTo(8.1, 2);
    expect(by('Promedio de los datos').mape).toBeCloseTo(12.85, 2);
    expect(by('Promedio móvil de 3').mse).toBeCloseTo(10.22, 2);
    expect(by('Promedio móvil de 3').mape).toBeCloseTo(14.36, 2);
    expect(by('Promedio móvil de 6').mse).toBeCloseTo(6.79, 2);
    expect(by('Suavizamiento').mse).toBeCloseTo(8.98, 2);
    expect(value.best).toBe('Promedio móvil de 6 periodos');
  });

  it('elige según el criterio y valida los parámetros', () => {
    const byMad = ok(forecastSelection.solve({ ...forecastSelection.example, criterion: 'mad' }));
    expect(byMad.value.methods.find((m) => m.method === byMad.value.best)).toBeDefined();
    const schema = forecastSelection.inputSchema;
    expect(schema.safeParse({ ...forecastSelection.example, alphas: '1.5' }).success).toBe(false);
    expect(schema.safeParse({ ...forecastSelection.example, orders: '12' }).success).toBe(false);
  });

  // Caso analítico: en una serie lineal exacta la tendencia no tiene error.
  it('tendencia lineal', () => {
    const { value } = ok(
      forecastSelection.solve({ data: '2, 4, 6, 8, 10', trend: 'si', criterion: 'mse' }),
    );
    expect(value.best).toBe('Proyección de tendencia lineal');
    expect(value.methods.at(-1)!.next).toBeCloseTo(12, 10);
  });
});

describe('lote económico de producción', () => {
  // Anderson, 13.ª ed., sec. 10.2 (Beauty Bar Soap): Q* = 3387, costo total $2073, punto de
  // reorden (26 000/250)(5) = 520 cajas y ciclo T = 250Q*/D ≈ 33 días hábiles.
  it('reproduce el ejemplo de Beauty Bar Soap', () => {
    const { value } = ok(productionLot.solve(productionLot.example));
    expect(Math.round(value.quantity)).toBe(3387);
    expect(Math.round(value.totalCost)).toBe(2073);
    expect(value.reorderPoint).toBeCloseTo(520, 10);
    expect(Math.round(value.cycleDays!)).toBe(33);
    expect(value.holdingCost).toBeCloseTo(value.setupCost, 8);
  });

  // Caso analítico: con P muy grande se aproxima al EOQ √(2DCo/Ch).
  it('con producción muy rápida tiende al EOQ', () => {
    const { value } = ok(
      productionLot.solve({ demand: 1000, production: 1e12, setupCost: 50, holdingCost: 4 }),
    );
    expect(value.quantity).toBeCloseTo(Math.sqrt((2 * 1000 * 50) / 4), 4);
    expect(value.cycleDays).toBeNull();
  });

  it('la producción debe superar a la demanda', () => {
    expect(
      productionLot.inputSchema.safeParse({ ...productionLot.example, production: 20000 }).success,
    ).toBe(false);
  });
});

describe('revisión periódica', () => {
  // Chase, Jacobs y Aquilano, 12.ª ed. en español (2009), ejemplo 17.5 (ejemplo 20.5 en la 15.ª):
  // σ_{T+L} = √((30 + 14)·3²) = 19.90; «el valor z para P = 0.98 es 2.05» (de la tabla; el valor
  // exacto es 2.0537); q = 10(44) + 2.05(19.90) − 150 = 331 unidades.
  it('reproduce el ejemplo del libro', () => {
    const { value } = ok(periodicReview.solve(periodicReview.example));
    expect(value.sigmaTL).toBeCloseTo(19.9, 2);
    expect(value.z).toBeCloseTo(2.05, 2);
    expect(value.roundedQuantity).toBe(331);
    expect(value.orderQuantity).toBeCloseTo(440 + 2.0537 * 19.8997 - 150, 2);
  });

  // Chase, ejemplo 17.7 (20.7 en la 15.ª): con demanda semanal 50, revisión cada 3 semanas e
  // inventario de seguridad 30, el inventario promedio es 50(3)/2 + 30 = 105. Aquí el
  // inventario de seguridad sale de z y σ, así que se verifica la fórmula con un σ que lo produce.
  it('inventario promedio', () => {
    const z = 2.0537489106; // Φ⁻¹(0.98)
    const sigma = 30 / (z * Math.sqrt(3 + 1));
    const { value } = ok(
      periodicReview.solve({
        demand: 50,
        sigma,
        review: 3,
        leadTime: 1,
        serviceLevel: 0.98,
        onHand: 0,
      }),
    );
    expect(value.safetyStock).toBeCloseTo(30, 6);
    expect(value.averageInventory).toBeCloseTo(105, 6);
  });
});

describe('clasificación ABC', () => {
  // Chase, Jacobs y Aquilano, 12.ª ed., ilustraciones 17.12 y 17.13 (20.11 de la 15.ª): con A =
  // 20 % de las piezas, B = 30 % y C = 50 %: A = 22, 68 ($170 000, 72.8 %); B = 27, 03, 82
  // ($53 000, 22.7 %); C = 54, 36, 19, 23, 41 ($10 450, 4.5 %); total $233 450. La 12.ª imprime
  // 72.9 % y 4.4 %, pero 170 000/233 450 = 72.82 % y 10 450/233 450 = 4.48 % (la 15.ª los corrige).
  it('reproduce el agrupamiento del libro', () => {
    const { value } = ok(abc.solve(abc.example));
    expect(value.total).toBe(233450);
    const [A, B, C] = value.groups;
    expect(A!.names).toEqual(['22', '68']);
    expect(B!.names).toEqual(['27', '03', '82']);
    expect(C!.names).toEqual(['54', '36', '19', '23', '41']);
    expect(A!.value).toBe(170000);
    expect(B!.value).toBe(53000);
    expect(C!.value).toBe(10450);
    expect(A!.percent).toBeCloseTo(72.8, 1);
    expect(B!.percent).toBeCloseTo(22.7, 1);
    expect(C!.percent).toBeCloseTo(4.5, 1);
    expect(value.items[0]!.percent).toBeCloseTo(40.69, 2);
  });

  // Caso analítico: con el criterio de valor acumulado 80 % / 95 %, 22 (40.7 %) y 68 (72.8 %)
  // quedan en A; 27 (83.5 %) y 03 (90.0 %) en B; 82 (95.5 %) ya pasa a C.
  it('criterio por valor acumulado', () => {
    const { value } = ok(abc.solve({ ...abc.example, criterion: 'valor', cutA: 80, cutB: 95 }));
    expect(value.groups[0]!.names).toEqual(['22', '68']);
    expect(value.groups[1]!.names).toEqual(['27', '03']);
  });

  it('usa demanda por costo unitario', () => {
    const { value } = ok(
      abc.solve({
        items: [
          { name: 'x', quantity: 10, unitCost: 100 },
          { name: 'y', quantity: 1000, unitCost: 2 },
          { name: 'z', quantity: 5, unitCost: 1 },
        ],
        criterion: 'valor',
        cutA: 60,
        cutB: 90,
      }),
    );
    expect(value.items.map((i) => i.name)).toEqual(['y', 'x', 'z']);
  });
});

describe('MRP', () => {
  // Chase, Jacobs y Aquilano, 12.ª ed., ilustración 18.14 (21.12 en la 15.ª), medidores A y B:
  //   A: necesidad neta 1200 en la semana 9, expedición en la 7.
  //   B: saldos 60, …, 70 desde la semana 5 (entrada programada de 10); neta 400 en la 9,
  //      expedición en la 7.
  //   C: brutas 1600 en la 7 (1200 + 400); saldo 35 (40 − 5); neta 1565; entrada de 2000 en la 7,
  //      expedición en la 6; saldo 435 en las semanas 7 a 9.
  //   D: brutas 4000 en la 6 (2 × 2000), 1200 en la 7 y 270 en la 9; saldo 280 en las semanas 4 y
  //      5 (200 + 100 − 20); neta 3720 en la 6 → entrada de 5000, saldo 1280; 80 en las 7 y 8;
  //      neta 190 en la 9 → otra entrada de 5000, saldo 4810. Expediciones de 5000 en las 5 y 8.
  it('reproduce la explosión de los medidores', () => {
    const { value } = ok(mrp.solve(mrp.example));
    const record = (item: string) => value.records.find((r) => r.item === item)!;
    const A = record('A');
    expect(A.net[8]).toBe(1200);
    expect(A.plannedReleases[6]).toBe(1200);
    const B = record('B');
    expect(B.projected.slice(3, 8)).toEqual([60, 70, 70, 70, 70]);
    expect(B.net[8]).toBe(400);
    expect(B.plannedReleases[6]).toBe(400);
    const C = record('C');
    expect(C.gross[6]).toBe(1600);
    expect(C.net[6]).toBe(1565);
    expect(C.plannedReceipts[6]).toBe(2000);
    expect(C.plannedReleases[5]).toBe(2000);
    expect(C.projected).toEqual([35, 35, 35, 35, 35, 35, 435, 435, 435]);
    const D = record('D');
    expect(D.gross[5]).toBe(4000);
    expect(D.gross[6]).toBe(1200);
    expect(D.gross[8]).toBe(270);
    expect(D.projected).toEqual([180, 180, 180, 280, 280, 1280, 80, 80, 4810]);
    expect(D.net[5]).toBe(3720);
    expect(D.net[8]).toBe(190);
    expect(D.plannedReleases[4]).toBe(5000);
    expect(D.plannedReleases[7]).toBe(5000);
  });

  // Caso borde: una necesidad dentro del tiempo de entrega deja un pedido atrasado.
  it('avisa los pedidos atrasados', () => {
    const result = ok(
      mrp.solve({
        periods: 3,
        items: [{ code: 'X', leadTime: 2, onHand: 0 }],
        bom: [],
        demand: [{ item: 'X', period: 1, quantity: 5 }],
        receipts: [],
      }),
    );
    expect(result.value.records[0]!.pastDue).toEqual([{ period: -1, quantity: 5 }]);
    expect(result.notices.some((n) => n.level === 'warning')).toBe(true);
  });

  it('detecta ciclos y referencias desconocidas', () => {
    const cyclic = mrp.solve({
      ...mrp.example,
      bom: [...mrp.example.bom, { parent: 'D', child: 'A', quantity: 1 }],
    });
    expect(!cyclic.ok && cyclic.error.code).toBe('cycle');
    const schema = mrp.inputSchema;
    expect(
      schema.safeParse({ ...mrp.example, demand: [{ item: 'Z', period: 1, quantity: 1 }] }).success,
    ).toBe(false);
  });
});
