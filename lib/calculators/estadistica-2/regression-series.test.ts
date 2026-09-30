import { describe, expect, it } from 'vitest';
import { correlation } from './coeficiente-de-correlacion';
import { seriesComponents } from './componentes-de-series-de-tiempo';
import { seriesForecast } from './pronostico-de-series-de-tiempo';
import { linearRegression, POLLUTION_X, POLLUTION_Y } from './regresion-lineal';

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fail<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

// Walpole, Myers, Myers y Ye, 9.ª ed., cap. 11: tabla 11.1 (reducción de sólidos x y de la demanda
// química de oxígeno y, en %, n = 33). El libro usa t₀.₀₂₅ = 2.045 de su tabla; con 31 grados de
// libertad el valor exacto es 2.0395, así que los extremos de los intervalos difieren en la
// segunda o tercera cifra decimal.
describe('Regresión lineal simple', () => {
  const { value } = ok(linearRegression.solve(linearRegression.example));

  // Ejemplo 11.1: b₀ = 3.829633 y b₁ = 0.903643 (ŷ = 3.8296 + 0.9036x).
  it('Walpole, ejemplo 11.1: la recta', () => {
    expect(value.b0).toBeCloseTo(3.829633, 6);
    expect(value.b1).toBeCloseTo(0.903643, 6);
  });

  // Sec. 11.4 y 11.5: Sxx = 4152.18, Sxy = 3752.09, Syy = 3713.88, s² = 10.4299, s = 3.2295 y
  // R² = 0.913.
  it('sumas de cuadrados, s y R²', () => {
    expect(value.sxx).toBeCloseTo(4152.18, 2);
    expect(value.sxy).toBeCloseTo(3752.09, 2);
    expect(value.syy).toBeCloseTo(3713.88, 2);
    expect(value.s ** 2).toBeCloseTo(10.4299, 4);
    expect(value.s).toBeCloseTo(3.2295, 4);
    expect(value.r2).toBeCloseTo(0.913, 3);
  });

  // Ejemplo 11.2: IC de 95 % para β₁: 0.8012 < β₁ < 1.0061 (con t = 2.045).
  // Sec. 11.5: IC de 95 % para β₀: 0.2132 < β₀ < 7.4461.
  it('Walpole: intervalos para β₁ y β₀', () => {
    expect(value.slopeInterval[0]).toBeCloseTo(0.8012, 3);
    expect(value.slopeInterval[1]).toBeCloseTo(1.0061, 3);
    expect(value.interceptInterval[0]).toBeCloseTo(0.2132, 1);
    expect(value.interceptInterval[1]).toBeCloseTo(7.4461, 1);
    // Con el t del libro, el intervalo coincide con el impreso.
    const seSlope = (value.slopeInterval[1] - value.slopeInterval[0]) / 2 / value.tCritical;
    expect(value.b1 - 2.045 * seSlope).toBeCloseTo(0.8012, 3);
  });

  // Ejemplos 11.6 y 11.7: en x₀ = 20 %, ŷ₀ = 21.9025; IC de 95 % para la media
  // 20.1076 < μ_{Y|20} < 23.6975 y de predicción 15.0585 < y₀ < 28.7465.
  it('Walpole: respuesta media y predicción en x₀ = 20', () => {
    const p = value.prediction!;
    expect(p.y0).toBeCloseTo(21.9025, 4);
    expect(p.meanInterval[0]).toBeCloseTo(20.1076, 1);
    expect(p.meanInterval[1]).toBeCloseTo(23.6975, 1);
    expect(p.predictionInterval[0]).toBeCloseTo(15.0585, 1);
    expect(p.predictionInterval[1]).toBeCloseTo(28.7465, 1);
  });

  it('la pendiente es significativa', () => {
    expect(value.slopeTest.reject).toBe(true);
    expect(value.slopeTest.t).toBeCloseTo(18.03, 2);
  });

  // Caso analítico: puntos sobre una recta (y = 2x + 1) → SSE = 0 y R² = 1.
  it('ajuste perfecto', () => {
    const { value: exact } = ok(
      linearRegression.solve({ x: '1 2 3 4', y: '3 5 7 9', alpha: 0.05 }),
    );
    expect(exact.b1).toBeCloseTo(2, 12);
    expect(exact.b0).toBeCloseTo(1, 12);
    expect(exact.r2).toBeCloseTo(1, 12);
  });

  it('el schema exige al menos 3 pares con x distintos', () => {
    expect(
      linearRegression.inputSchema.safeParse({ x: '1 2', y: '1 2', alpha: 0.05 }).success,
    ).toBe(false);
    expect(
      linearRegression.inputSchema.safeParse({ x: '1 1 1', y: '1 2 3', alpha: 0.05 }).success,
    ).toBe(false);
  });
});

describe('Coeficiente de correlación', () => {
  // Sec. 11.12: 29 probetas de madera con r = 0.9435. Prueba de ρ = 0.9 contra ρ > 0.9 con
  // α = 0.05: z = 1.51, P = 0.0655; no se rechaza H₀. Prueba de ρ = 0: t = 14.79, P < 0.0001.
  it('Walpole: probetas de madera', () => {
    const { value } = ok(correlation.solve(correlation.example));
    expect(value.kind).toBe('z');
    expect(value.statistic).toBeCloseTo(1.51, 2);
    expect(value.pValue).toBeCloseTo(0.0655, 3);
    expect(value.reject).toBe(false);
    const zero = ok(
      correlation.solve({ ...correlation.example, rho0: 0, alternative: 'distinto' }),
    ).value;
    expect(zero.statistic).toBeCloseTo(14.79, 2);
    expect(zero.pValue).toBeLessThan(0.0001);
  });

  // Con los datos de la tabla 11.1, r² = R² = 0.913 (r = 0.9555).
  it('Pearson con los datos de la tabla 11.1', () => {
    const { value } = ok(
      correlation.solve({
        ...correlation.example,
        source: 'datos',
        x: POLLUTION_X,
        y: POLLUTION_Y,
        rho0: 0,
        alternative: 'distinto',
      }),
    );
    expect(value.r).toBeCloseTo(0.9555, 4);
    expect(value.r ** 2).toBeCloseTo(0.913, 3);
    expect(value.reject).toBe(true);
  });

  // Caso analítico (Spearman sin empates): x = 1…5, y = 2, 1, 4, 3, 5 → d = −1, 1, −1, 1, 0,
  // Σd² = 4 y r_s = 1 − 6(4)/(5·24) = 0.8.
  it('Spearman', () => {
    const { value } = ok(
      correlation.solve({
        ...correlation.example,
        source: 'datos',
        method: 'spearman',
        x: '1 2 3 4 5',
        y: '2 1 4 3 5',
        rho0: 0,
        alternative: 'distinto',
      }),
    );
    expect(value.r).toBeCloseTo(0.8, 12);
  });

  // Caso analítico con empates: los rangos promedio de 1, 2, 2, 3 son 1, 2.5, 2.5, 4; con y
  // creciente la correlación de rangos no es 1 exacto pero sí positiva y alta.
  it('Spearman con empates y variable constante', () => {
    const tied = ok(
      correlation.solve({
        ...correlation.example,
        source: 'datos',
        method: 'spearman',
        x: '1 2 2 3',
        y: '1 2 3 4',
        rho0: 0,
        alternative: 'distinto',
      }),
    ).value;
    expect(tied.r).toBeCloseTo(0.9486833, 6);
    const constant = fail(
      correlation.solve({
        ...correlation.example,
        source: 'datos',
        x: '1 2 3 4',
        y: '5 5 5 5',
        rho0: 0,
        alternative: 'distinto',
      }),
    );
    expect(constant.error.code).toBe('undefined-correlation');
  });
});

// Anderson, Sweeney y Williams, capítulo de series de tiempo y pronósticos. El pensum cita la
// edición de 1993 en español, que no se pudo consultar; los ejemplos se contrastaron con las
// ediciones recientes en inglés (Statistics for Business and Economics y Quantitative Methods for
// Business), cuyos resultados publicados reproduce la calculadora:
// - Ventas de bicicletas (10 años): 21.6, 22.9, 25.5, 21.9, 23.9, 27.5, 31.5, 29.7, 28.6, 31.4;
//   Tₜ = 20.4 + 1.1t y T₁₁ = 32.5.
// - Ventas trimestrales de televisores (4 años): índices estacionales 0.93, 0.84, 1.09, 1.14;
//   primer promedio móvil centrado 5.475; tendencia de la serie desestacionalizada
//   Tₜ = 5.10 + 0.148t; pronósticos del año 5: 7.1, 6.5, 8.6 y 9.2.
describe('Series de tiempo', () => {
  const TV = '4.8 4.1 6.0 6.5 5.8 5.2 6.8 7.4 6.0 5.6 7.5 7.8 6.3 5.9 8.0 8.4';
  const BIKES = '21.6 22.9 25.5 21.9 23.9 27.5 31.5 29.7 28.6 31.4';

  it('televisores: índices estacionales y tendencia', () => {
    const { value } = ok(seriesComponents.solve({ data: TV, season: 4 }));
    expect(value.cma[2]).toBeCloseTo(5.475, 12);
    [0.93, 0.84, 1.09, 1.14].forEach((v, j) => expect(value.indices[j]).toBeCloseTo(v, 2));
    expect(value.indices.reduce((s, v) => s + v, 0)).toBeCloseTo(4, 12);
    expect(value.b0).toBeCloseTo(5.1, 1);
    expect(value.b1).toBeCloseTo(0.148, 2);
  });

  it('televisores: pronósticos del año 5', () => {
    const { value } = ok(seriesForecast.solve({ data: TV, season: 4, horizon: 4 }));
    [7.1, 6.5, 8.6, 9.2].forEach((v, h) => expect(value.forecasts[h]!.value).toBeCloseTo(v, 1));
  });

  it('bicicletas: tendencia sin estacionalidad', () => {
    const components = ok(seriesComponents.solve({ data: BIKES, season: 0 })).value;
    expect(components.b0).toBeCloseTo(20.4, 12);
    expect(components.b1).toBeCloseTo(1.1, 12);
    const forecast = ok(seriesForecast.solve({ data: BIKES, season: 0, horizon: 1 })).value;
    expect(forecast.forecasts[0]!.value).toBeCloseTo(32.5, 12);
  });

  // Caso analítico: una serie sin tendencia con índices exactos 0.8, 1.2, 0.8, 1.2, … (L = 2) y
  // nivel 10: los promedios móviles centrados valen 10 y los índices se recuperan exactos.
  it('recupera índices estacionales exactos', () => {
    const { value } = ok(seriesComponents.solve({ data: '8 12 8 12 8 12 8 12', season: 2 }));
    expect(value.indices[0]).toBeCloseTo(0.8, 12);
    expect(value.indices[1]).toBeCloseTo(1.2, 12);
    expect(value.b1).toBeCloseTo(0, 12);
  });

  it('el schema valida la serie', () => {
    const parse = (data: string, season: number) =>
      seriesComponents.inputSchema.safeParse({ data, season }).success;
    expect(parse('1 2 3 4 5 6 7', 4)).toBe(false);
    expect(parse('1 2 3', 1)).toBe(false);
    expect(parse('1 -2 3 4', 2)).toBe(false);
    expect(parse('1 2 3', 0)).toBe(true);
  });
});
