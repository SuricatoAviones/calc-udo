import { describe, expect, it } from 'vitest';
import { samplingDistributions } from './distribuciones-muestrales';
import { frequencyTable } from './tabla-de-frecuencias';
import { centralLimit } from './teorema-del-limite-central';

// Walpole, Myers, Myers y Ye, Probabilidad y estadística para ingeniería y ciencias, 9.ª ed. en
// español (Pearson, 2012), capítulos 1 y 8; Spiegel, Probabilidad y estadística (Schaum).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

const batteries = frequencyTable.example.data;

describe('Tabla de frecuencias', () => {
  // Tablas 1.4 y 1.7 (pp. 21-23): vida de 40 baterías, clases 1.5-1.9, …, 4.5-4.9 con marcas
  // 1.7, …, 4.7, frecuencias 2, 1, 4, 15, 10, 5, 3 y frecuencias relativas 0.050, 0.025, 0.100,
  // 0.375, 0.250, 0.125, 0.075.
  it('Walpole, tabla 1.7', () => {
    const { value } = ok(frequencyTable.solve(frequencyTable.example));
    expect(value.classes.map((c) => [c.lower, c.upper])).toEqual([
      [1.5, 1.9],
      [2, 2.4],
      [2.5, 2.9],
      [3, 3.4],
      [3.5, 3.9],
      [4, 4.4],
      [4.5, 4.9],
    ]);
    expect(value.classes.map((c) => c.midpoint)).toEqual([1.7, 2.2, 2.7, 3.2, 3.7, 4.2, 4.7]);
    expect(value.classes.map((c) => c.frequency)).toEqual([2, 1, 4, 15, 10, 5, 3]);
    const relative = [0.05, 0.025, 0.1, 0.375, 0.25, 0.125, 0.075];
    value.classes.forEach((c, i) => expect(c.relative).toBeCloseTo(relative[i]!, 12));
    expect(value.classes.at(-1)?.cumulative).toBe(40);
  });

  // Sec. 1.6 (p. 22): con los tallos de la tabla 1.5, las clases 1.0-1.9, 2.0-2.9, 3.0-3.9 y
  // 4.0-4.9 tienen 2, 5, 25 y 8 observaciones.
  it('Walpole, clases de la tabla 1.5', () => {
    const { value } = ok(frequencyTable.solve({ data: batteries, classes: 4, start: 1, width: 1 }));
    expect(value.classes.map((c) => c.frequency)).toEqual([2, 5, 25, 8]);
  });

  // Media de datos agrupados con la tabla 1.7 (verificada a mano): Σfm = 2(1.7) + 2.2 + 4(2.7) +
  // 15(3.2) + 10(3.7) + 5(4.2) + 3(4.7) = 136.5, así que x̄ ≈ 136.5/40 = 3.4125. Con los datos de
  // la tabla 1.4 las filas suman 26.8 + 26.7 + 27.0 + 27.1 + 28.9 = 136.5: aquí coinciden.
  // Σfm² = 484.75 y s² ≈ (484.75 − 136.5²/40)/39.
  it('media y varianza de datos agrupados', () => {
    const { value } = ok(frequencyTable.solve(frequencyTable.example));
    expect(value.groupedMean).toBeCloseTo(3.4125, 12);
    expect(value.mean).toBeCloseTo(3.4125, 12);
    expect(value.groupedVariance).toBeCloseTo((484.75 - 136.5 ** 2 / 40) / 39, 10);
  });

  // Sin fijar clases (verificado a mano): Sturges da k = ⌈1 + 3.322 log₁₀ 40⌉ = ⌈6.32⌉ = 7; el
  // rango es 4.7 − 1.6 = 3.1 y c = 0.5 (el menor múltiplo de 0.1 con 7c > 3.1). Desde 1.6 las
  // clases 1.6-2.0, 2.1-2.5, …, 4.6-5.0 tienen 2, 2, 5, 15, 8, 6 y 2 datos (contados en la
  // tabla 1.4).
  it('regla de Sturges y ancho automático', () => {
    const { value } = ok(frequencyTable.solve({ data: batteries }));
    expect(value.classes).toHaveLength(7);
    expect(value.width).toBe(0.5);
    expect(value.classes[0]).toMatchObject({ lower: 1.6, upper: 2 });
    expect(value.classes.map((c) => c.frequency)).toEqual([2, 2, 5, 15, 8, 6, 2]);
  });

  it('avisa si las clases no cubren los datos', () => {
    const outside = frequencyTable.solve({ data: batteries, classes: 3, start: 1.5, width: 0.5 });
    expect(!outside.ok && outside.error.code).toBe('data-outside');
    const late = frequencyTable.solve({ data: batteries, start: 2 });
    expect(!late.ok && late.error.code).toBe('data-outside');
    expect(frequencyTable.inputSchema.safeParse({ data: '1 2 x' }).success).toBe(false);
  });
});

describe('Teorema del límite central', () => {
  // Ejemplo 8.4 (pp. 234-235): μ = 800, σ = 40, n = 16; σ_X̄ = 10, z = −2.5 y
  // P(X̄ < 775) = 0.0062.
  it('Walpole, ejemplo 8.4', () => {
    const { value } = ok(centralLimit.solve(centralLimit.example));
    expect(value.standardError).toBe(10);
    expect(value.z[0]).toBeCloseTo(-2.5, 12);
    expect(value.probability).toBeCloseTo(0.0062, 4);
  });

  // Ejemplo 8.5 (p. 237): μ = 28, σ = 5, n = 40; con la corrección del libro, x̄ > 30.5:
  // z = 3.16 y P = 0.0008.
  it('Walpole, ejemplo 8.5', () => {
    const { value } = ok(centralLimit.solve({ mean: 28, sd: 5, n: 40, query: 'mayor', x: 30.5 }));
    expect(value.z[0]).toBeCloseTo(3.16, 2);
    expect(value.probability).toBeCloseTo(0.0008, 4);
  });

  // Estudio de caso 8.1 (pp. 235-237): μ = 5.0, σ = 0.1, n = 100; P(X̄ > 5.027) = P(Z > 2.7) =
  // 0.0035, y P(|X̄ − 5| > 0.027) = 2(0.0035) = 0.007.
  it('Walpole, estudio de caso 8.1', () => {
    const tail = ok(centralLimit.solve({ mean: 5, sd: 0.1, n: 100, query: 'mayor', x: 5.027 }));
    expect(tail.value.probability).toBeCloseTo(0.0035, 4);
    const inside = ok(
      centralLimit.solve({ mean: 5, sd: 0.1, n: 100, query: 'entre', x: 4.973, x2: 5.027 }),
    );
    expect(1 - inside.value.probability).toBeCloseTo(0.007, 3);
  });

  it('advierte con n < 30', () => {
    const small = ok(centralLimit.solve(centralLimit.example));
    expect(small.notices.some((n) => n.level === 'warning')).toBe(true);
    const large = ok(centralLimit.solve({ mean: 28, sd: 5, n: 40, query: 'mayor', x: 30.5 }));
    expect(large.notices.some((n) => n.level === 'warning')).toBe(false);
  });
});

describe('Distribuciones muestrales', () => {
  // Spiegel (Schaum), teoría del muestreo: población 2, 3, 6, 8, 11 y muestras de tamaño 2.
  // μ = 6.0, σ² = 10.8, σ = 3.29.
  //   Con reemplazo: 25 muestras, μ_X̄ = 6.0, σ²_X̄ = 5.40, σ_X̄ = 2.32 (= σ/√2).
  //   Sin reemplazo: 10 muestras, μ_X̄ = 6.0, σ²_X̄ = 4.05, σ_X̄ = 2.01 (= σ/√2 · √(3/4)).
  // Los valores de la población y las 25 muestras se confirmaron en la transcripción del problema;
  // los errores estándar, además, con las fórmulas σ/√n y el factor de corrección (N − n)/(N − 1).
  it('Spiegel: con reemplazo', () => {
    const { value } = ok(samplingDistributions.solve(samplingDistributions.example));
    expect(value.populationMean).toBe(6);
    expect(value.populationVariance).toBeCloseTo(10.8, 12);
    expect(Math.sqrt(value.populationVariance)).toBeCloseTo(3.29, 2);
    expect(value.samples).toBe(25);
    expect(value.meanOfMeans).toBeCloseTo(6, 12);
    expect(value.varianceOfMeans).toBeCloseTo(5.4, 12);
    expect(value.standardError).toBeCloseTo(2.32, 2);
  });

  it('Spiegel: sin reemplazo', () => {
    const { value } = ok(
      samplingDistributions.solve({ population: '2 3 6 8 11', n: 2, replacement: 'sin' }),
    );
    expect(value.samples).toBe(10);
    expect(value.meanOfMeans).toBeCloseTo(6, 12);
    expect(value.varianceOfMeans).toBeCloseTo(4.05, 12);
    expect(value.standardError).toBeCloseTo(2.01, 2);
  });

  // Caso borde (analítico): con n = N sin reemplazo hay una sola muestra, la población entera, y
  // la varianza de x̄ es 0 (el factor de corrección vale 0).
  it('muestra igual a la población', () => {
    const { value } = ok(
      samplingDistributions.solve({ population: '2 3 6 8 11', n: 5, replacement: 'sin' }),
    );
    expect(value.samples).toBe(1);
    expect(value.varianceOfMeans).toBe(0);
  });

  it('limita el número de muestras', () => {
    const schema = samplingDistributions.inputSchema;
    expect(schema.safeParse({ population: '1 2 3', n: 4, replacement: 'sin' }).success).toBe(false);
    expect(
      schema.safeParse({ population: '1 2 3 4 5 6 7 8 9 10', n: 6, replacement: 'con' }).success,
    ).toBe(false);
  });
});
