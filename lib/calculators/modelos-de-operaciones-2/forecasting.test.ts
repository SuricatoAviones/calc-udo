import { describe, expect, it } from 'vitest';
import { movingAverage } from './promedio-movil';
import { exponentialSmoothing } from './suavizamiento-exponencial';

// Anderson, Sweeney y Williams, capítulo de pronósticos: ventas semanales de gasolina (miles de
// galones) 17, 21, 19, 23, 18, 16, 20, 18, 22, 20, 15, 22. El pensum cita la edición de 1993 en
// español, que no se pudo consultar; los valores del libro se contrastaron con ediciones
// recientes en inglés (Statistics for Business and Economics y Modern Business Statistics,
// tabla 17.1) y con soluciones publicadas de sus ejercicios: promedio móvil de 3 semanas con
// pronósticos 19, 21, 20, 19, 18, 18, 20, 20, 19, pronóstico de la semana 13 = 19 y MSE = 92/9
// = 10.22; MAE = 2.67 y MAPE = 14.36 %. Suavizamiento exponencial con α = 0.2 y F₂ = Y₁:
// F₁₃ = 0.2Y₁₂ + 0.8F₁₂ = 19.18 y MSE = 98.80/11 = 8.98. Estos dos últimos valores se tomaron del
// texto y se confirmaron recalculando la tabla completa a mano.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('Promedio móvil', () => {
  const { value, tables } = ok(movingAverage.solve(movingAverage.example));

  it('pronósticos del promedio móvil de 3 semanas', () => {
    expect(value.forecasts.map((p) => p.forecast)).toEqual([
      19, 21, 20, 19, 18, 18, 20, 20, 19, 19,
    ]);
    expect(value.nextPeriod).toBe(13);
    expect(value.next).toBeCloseTo(19, 12);
  });

  it('medidas de exactitud: MSE = 10.22, MAE = 2.67, MAPE = 14.36 %', () => {
    expect(value.count).toBe(9);
    expect(value.mse).toBeCloseTo(92 / 9, 12);
    expect(value.mse).toBeCloseTo(10.22, 2);
    expect(value.mad).toBeCloseTo(2.67, 2);
    expect(value.mape!).toBeCloseTo(14.36, 2);
  });

  it('la tabla incluye las 12 semanas y la semana 13 sin dato real', () => {
    const rows = tables[0]!.rows;
    expect(rows).toHaveLength(13);
    expect(rows[0]).toMatchObject({ t: 1, actual: 17, forecast: null });
    expect(rows[3]).toMatchObject({ t: 4, actual: 23, forecast: 19, error: 4, sq: 16 });
    expect(rows[12]).toMatchObject({ t: 13, actual: null, forecast: 19 });
  });

  // Anderson, promedio móvil ponderado con pesos 3/6 (semana más reciente), 2/6 y 1/6:
  // pronóstico de la semana 4 = (3·19 + 2·21 + 1·17)/6 = 19.33.
  it('promedio ponderado 3-2-1: el pronóstico de la semana 4 es 19.33', () => {
    const { value: w } = ok(movingAverage.solve({ ...movingAverage.example, type: 'ponderado' }));
    expect(w.forecasts[0]!.period).toBe(4);
    expect(w.forecasts[0]!.forecast).toBeCloseTo(19.33, 2);
  });

  // Caso borde analítico: pesos iguales dan el promedio simple.
  it('pesos iguales equivalen al promedio simple', () => {
    const { value: w } = ok(
      movingAverage.solve({ ...movingAverage.example, type: 'ponderado', weights: '1 1 1' }),
    );
    expect(w.mse).toBeCloseTo(value.mse, 12);
  });

  it('validaciones', () => {
    const parse = (patch: object) =>
      movingAverage.inputSchema.safeParse({ ...movingAverage.example, ...patch }).success;
    expect(parse({ periods: 12 })).toBe(false);
    expect(parse({ type: 'ponderado', weights: '3 2' })).toBe(false);
    expect(parse({ type: 'ponderado', weights: '3 -2 1' })).toBe(false);
    expect(parse({ data: '1 2' })).toBe(false);
    expect(parse({ data: '1 2 x' })).toBe(false);
  });

  // Caso borde: un dato real igual a 0 deja el MAPE sin definir.
  it('MAPE no definido si hay un dato real igual a 0', () => {
    const result = ok(movingAverage.solve({ ...movingAverage.example, data: '4 5 6 0 3' }));
    expect(result.value.mape).toBeNull();
    expect(result.notices.some((n) => /MAPE no está definido/.test(n.message))).toBe(true);
  });
});

describe('Suavizamiento exponencial', () => {
  const { value } = ok(exponentialSmoothing.solve(exponentialSmoothing.example));

  it('α = 0.2: F₁₃ = 19.18 y MSE = 8.98', () => {
    expect(value.forecasts[0]).toMatchObject({ period: 2, forecast: 17 });
    expect(value.forecasts[1]!.forecast).toBeCloseTo(17.8, 12);
    expect(value.nextPeriod).toBe(13);
    expect(value.next).toBeCloseTo(19.18, 2);
    expect(value.count).toBe(11);
    expect(value.mse * 11).toBeCloseTo(98.8, 1);
    expect(value.mse).toBeCloseTo(8.98, 2);
  });

  // Caso borde analítico: con α = 1 el pronóstico es el último dato (pronóstico ingenuo).
  it('α = 1 da el pronóstico ingenuo F_{t+1} = Y_t', () => {
    const { value: naive } = ok(
      exponentialSmoothing.solve({ ...exponentialSmoothing.example, alpha: 1 }),
    );
    expect(naive.forecasts.map((p) => p.forecast)).toEqual([
      17, 21, 19, 23, 18, 16, 20, 18, 22, 20, 15, 22,
    ]);
  });

  // Caso borde analítico: con un pronóstico inicial F₁ el primer error es el del periodo 1.
  it('usa el pronóstico inicial dado', () => {
    const { value: v } = ok(
      exponentialSmoothing.solve({ data: '10 20 30', alpha: 0.5, initialForecast: 10 }),
    );
    expect(v.forecasts.map((p) => p.forecast)).toEqual([10, 10, 15, 22.5]);
    expect(v.count).toBe(3);
  });

  it('α debe estar en (0, 1]', () => {
    const parse = (alpha: number) =>
      exponentialSmoothing.inputSchema.safeParse({ ...exponentialSmoothing.example, alpha })
        .success;
    expect(parse(0)).toBe(false);
    expect(parse(1.2)).toBe(false);
    expect(parse(1)).toBe(true);
  });
});
