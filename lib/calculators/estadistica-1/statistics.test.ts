import { describe, expect, it } from 'vitest';
import { binomial } from './binomial';
import { descriptiveMeasures } from './descriptive-measures';
import { combinations } from './discrete';
import { normal } from './normal';
import { poisson } from './poisson';

// Walpole, Myers y Myers, Probabilidad y Estadística para Ingeniería y Ciencias, 8.ª ed. en
// español (Pearson, 2007). El pensum cita la 6.ª ed.; se indica la numeración de la 8.ª. Los
// resultados del libro vienen de tablas con 4 decimales.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('Medidas descriptivas', () => {
  // Ejemplo 8.2: truchas atrapadas 3, 4, 5, 6, 6, 7 → Σx = 31, Σx² = 171, n = 6,
  // s² = [6(171) − 31²]/[6(5)] = 13/6 y s = √(13/6) = 1.47.
  it('Walpole, ejemplo 8.2', () => {
    const { value } = ok(descriptiveMeasures.solve(descriptiveMeasures.example));
    expect(value.sum).toBe(31);
    expect(value.sumOfSquares).toBe(171);
    expect(value.variance).toBeCloseTo(13 / 6, 12);
    expect(value.standardDeviation).toBeCloseTo(1.47, 2);
    // Media, mediana y moda de los mismos datos (verificadas a mano: 31/6, (5 + 6)/2 y 6).
    expect(value.mean).toBeCloseTo(31 / 6, 12);
    expect(value.median).toBe(5.5);
    expect(value.modes).toEqual([6]);
  });

  // Sección 1.4 y tabla 1.1 (ejemplo 1.2): pesos de tallos de plantones de roble.
  //   Sin nitrógeno: x̄ = 0.399 g, x̃ = (0.38 + 0.42)/2 = 0.400 g
  //   Con nitrógeno: x̄ = 0.565 g, x̃ = (0.49 + 0.52)/2 = 0.505 g
  it('Walpole, sección 1.4: plantones con y sin nitrógeno', () => {
    const sin = ok(
      descriptiveMeasures.solve({ data: '0.32 0.53 0.28 0.37 0.47 0.43 0.36 0.42 0.38 0.43' }),
    ).value;
    expect(sin.mean).toBeCloseTo(0.399, 10);
    expect(sin.median).toBeCloseTo(0.4, 10);
    const con = ok(
      descriptiveMeasures.solve({ data: '0.26 0.43 0.47 0.49 0.52 0.75 0.79 0.86 0.62 0.46' }),
    ).value;
    expect(con.mean).toBeCloseTo(0.565, 10);
    expect(con.median).toBeCloseTo(0.505, 10);
  });

  it('sin valores repetidos no hay moda', () => {
    expect(ok(descriptiveMeasures.solve({ data: '1 2 3' })).value.modes).toEqual([]);
  });

  it('valida los datos con mensajes claros', () => {
    const schema = descriptiveMeasures.inputSchema;
    const bad = schema.safeParse({ data: '3 abc 5' });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0]?.message).toContain('«abc»');
    expect(schema.safeParse({ data: '5' }).success).toBe(false);
  });
});

describe('Distribución binomial', () => {
  // Ejemplo 5.5 (p. 146): n = 15, p = 0.4 (pacientes que se recuperan).
  //   a) P(X ≥ 10) = 1 − P(X ≤ 9) = 1 − 0.9662 = 0.0338
  //   b) P(3 ≤ X ≤ 8) = 0.9050 − 0.0271 = 0.8779
  //   c) P(X = 5) = 0.4032 − 0.2173 = 0.1859
  const solve = (query: Parameters<typeof binomial.solve>[0]['query'], k: number, k2?: number) =>
    ok(binomial.solve({ n: 15, p: 0.4, query, k, k2 })).value.probability;

  it('Walpole, ejemplo 5.5', () => {
    expect(solve('mayor-igual', 10)).toBeCloseTo(0.0338, 4);
    // El libro resta acumuladas ya redondeadas a 4 decimales (0.9050 − 0.0271); el valor exacto
    // es 0.87784, así que coincide a 3 decimales.
    expect(solve('entre', 3, 8)).toBeCloseTo(0.8779, 3);
    expect(solve('igual', 5)).toBeCloseTo(0.1859, 4);
  });

  it('valores acumulados de la tabla A.1 usados en el ejemplo', () => {
    expect(solve('menor-igual', 9)).toBeCloseTo(0.9662, 4);
    expect(solve('menor-igual', 8)).toBeCloseTo(0.905, 4);
    expect(solve('menor-igual', 2)).toBeCloseTo(0.0271, 4);
    expect(solve('menor', 3)).toBeCloseTo(0.0271, 4);
    expect(solve('mayor', 9)).toBeCloseTo(0.0338, 4);
  });

  // Ejemplo 5.7: para el mismo experimento μ = (15)(0.4) = 6, σ² = (15)(0.4)(0.6) = 3.6, σ = 1.897.
  it('Walpole, ejemplo 5.7: media y varianza', () => {
    const { value } = ok(binomial.solve(binomial.example));
    expect(value.mean).toBeCloseTo(6, 12);
    expect(value.variance).toBeCloseTo(3.6, 12);
    expect(value.standardDeviation).toBeCloseTo(1.897, 3);
  });

  it('P(X < 0) = 0 sin iterar', () => {
    expect(solve('menor', 0)).toBe(0);
  });

  it('p = 0 y p = 1 son degeneradas', () => {
    expect(ok(binomial.solve({ n: 5, p: 0, query: 'igual', k: 0 })).value.probability).toBe(1);
    expect(ok(binomial.solve({ n: 5, p: 1, query: 'igual', k: 5 })).value.probability).toBe(1);
  });

  it('C(n, k) es exacto', () => {
    expect(combinations(15, 5)).toBe(3003);
    expect(combinations(52, 5)).toBe(2598960);
  });
});

describe('Distribución de Poisson', () => {
  // Ejemplo 5.20: λt = 4 partículas; P(X = 6) = 0.8893 − 0.7851 = 0.1042.
  it('Walpole, ejemplo 5.20', () => {
    const { value } = ok(poisson.solve(poisson.example));
    expect(value.probability).toBeCloseTo(0.1042, 4);
    expect(
      ok(poisson.solve({ lambda: 4, query: 'menor-igual', k: 6 })).value.probability,
    ).toBeCloseTo(0.8893, 4);
    expect(
      ok(poisson.solve({ lambda: 4, query: 'menor-igual', k: 5 })).value.probability,
    ).toBeCloseTo(0.7851, 4);
  });

  // Ejemplo 5.21: λ = 10 camiones por día; P(X > 15) = 1 − P(X ≤ 15) = 1 − 0.9513 = 0.0487.
  it('Walpole, ejemplo 5.21: usa el complemento', () => {
    const result = ok(poisson.solve({ lambda: 10, query: 'mayor', k: 15 }));
    expect(result.value.probability).toBeCloseTo(0.0487, 4);
    expect(result.steps[1]?.formula).toContain('1 -');
  });

  // Regresión: con soporte infinito, P(X ≤ k) no puede calcularse por complemento.
  it('P(X ≤ k) suma directa aunque tenga más términos que el "complemento"', () => {
    expect(
      ok(poisson.solve({ lambda: 2, query: 'menor-igual', k: 30 })).value.probability,
    ).toBeCloseTo(1, 10);
    expect(
      ok(poisson.solve({ lambda: 4, query: 'menor-igual', k: 0 })).value.probability,
    ).toBeCloseTo(Math.exp(-4), 12);
  });

  it('media y varianza son λ', () => {
    const { value } = ok(poisson.solve(poisson.example));
    expect(value.mean).toBe(4);
    expect(value.variance).toBe(4);
  });
});

describe('Distribución normal', () => {
  // Ejemplo 6.4: μ = 50, σ = 10; z₁ = −0.5, z₂ = 1.2; P(45 < X < 62) = 0.8849 − 0.3085 = 0.5764.
  it('Walpole, ejemplo 6.4', () => {
    const { value } = ok(normal.solve(normal.example));
    expect(value.z).toEqual([-0.5, 1.2]);
    expect(value.probability).toBeCloseTo(0.5764, 4);
  });

  // Ejemplo 6.5: μ = 300, σ = 50; P(X > 362) = P(Z > 1.24) = 1 − 0.8925 = 0.1075.
  it('Walpole, ejemplo 6.5', () => {
    const { value } = ok(normal.solve({ mean: 300, sd: 50, query: 'mayor', x: 362 }));
    expect(value.z[0]).toBeCloseTo(1.24, 12);
    expect(value.probability).toBeCloseTo(0.1075, 4);
  });

  // Ejemplo 6.7: baterías con μ = 3.0 y σ = 0.5 años; P(X < 2.3) = P(Z < −1.4) = 0.0808.
  it('Walpole, ejemplo 6.7', () => {
    const { value } = ok(normal.solve({ mean: 3, sd: 0.5, query: 'menor', x: 2.3 }));
    expect(value.z[0]).toBeCloseTo(-1.4, 12);
    expect(value.probability).toBeCloseTo(0.0808, 4);
  });

  it('valida σ > 0 y el orden de los límites', () => {
    expect(normal.inputSchema.safeParse({ ...normal.example, sd: 0 }).success).toBe(false);
    expect(normal.inputSchema.safeParse({ ...normal.example, x2: 40 }).success).toBe(false);
  });
});
