import { describe, expect, it } from 'vitest';
import { bernoulli } from './distribucion-bernoulli';
import { pascal } from './distribucion-de-pascal';
import { geometric } from './distribucion-geometrica';
import { hypergeometric } from './distribucion-hipergeometrica';
import { multinomial } from './distribucion-multinomial';

// Walpole, Myers, Myers y Ye, Probabilidad y estadística para ingeniería y ciencias, 9.ª ed. en
// español (Pearson, 2012), capítulo 5. El pensum cita la 6.ª ed.; los tests de binomial y Poisson
// (statistics.test.ts) usan la numeración de la 8.ª. Los resultados del libro vienen redondeados
// a 4 cifras o de tablas.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('Distribución de Bernoulli', () => {
  // Ejemplo 5.1 (p. 145): un componente sobrevive a la prueba de choque con p = 3/4. Un solo
  // componente es un ensayo de Bernoulli; la prueba del teorema 5.1 (p. 147) representa cada
  // ensayo así, con valores 1 y 0 de probabilidades p y q, y el teorema con n = 1 da μ = p y
  // σ² = pq = (3/4)(1/4) = 0.1875.
  it('Walpole, ejemplo 5.1 con un solo componente', () => {
    const { value } = ok(bernoulli.solve(bernoulli.example));
    expect(value.probability).toBe(0.75);
    expect(value.mean).toBe(0.75);
    expect(value.variance).toBeCloseTo(0.1875, 12);
    expect(ok(bernoulli.solve({ p: 0.75, query: 'igual', k: 0 })).value.probability).toBe(0.25);
  });

  it('X solo toma 0 y 1', () => {
    expect(ok(bernoulli.solve({ p: 0.3, query: 'mayor-igual', k: 0 })).value.probability).toBe(1);
    expect(bernoulli.inputSchema.safeParse({ p: 0.3, query: 'igual', k: 2 }).success).toBe(false);
  });
});

describe('Distribución geométrica', () => {
  // Ejemplo 5.15 (p. 160): uno de cada 100 artículos es defectuoso;
  // g(5; 0.01) = (0.01)(0.99)⁴ = 0.0096.
  it('Walpole, ejemplo 5.15', () => {
    const result = ok(geometric.solve(geometric.example));
    expect(result.value.probability).toBeCloseTo(0.0096, 4);
  });

  // Ejemplo 5.16 (p. 160): conmutador telefónico con p = 0.05; g(5; 0.05) = (0.05)(0.95)⁴ = 0.041.
  // Media y varianza con el teorema 5.3: μ = 1/p = 20 intentos, σ² = (1 − p)/p² = 380.
  it('Walpole, ejemplo 5.16 y teorema 5.3', () => {
    const { value } = ok(geometric.solve({ p: 0.05, query: 'igual', k: 5 }));
    expect(value.probability).toBeCloseTo(0.041, 3);
    expect(value.mean).toBeCloseTo(20, 12);
    expect(value.variance).toBeCloseTo(380, 9);
  });

  // Caso borde, analítico: P(X ≤ k) = 1 − qᵏ (el primer éxito no tarda más de k ensayos).
  it('P(X ≤ k) = 1 − qᵏ y el soporte empieza en 1', () => {
    const result = ok(geometric.solve({ p: 0.05, query: 'menor-igual', k: 3 }));
    expect(result.value.probability).toBeCloseTo(1 - 0.95 ** 3, 12);
    expect(result.tables[0]?.rows[0]?.x).toBe(1);
    expect(ok(geometric.solve({ p: 0.05, query: 'menor', k: 1 })).value.probability).toBe(0);
  });

  it('p = 0 no es válido', () => {
    expect(geometric.inputSchema.safeParse({ p: 0, query: 'igual', k: 1 }).success).toBe(false);
  });
});

describe('Distribución de Pascal (binomial negativa)', () => {
  const solve = (successes: number, query: 'igual' | 'entre', k: number, k2?: number) =>
    ok(pascal.solve({ successes, p: 0.55, query, k, k2 })).value.probability;

  // Ejemplo 5.14 (p. 159): serie de la NBA, A gana cada juego con p = 0.55.
  //   a) b*(6; 4, 0.55) = 0.1853
  //   b) b*(4) + b*(5) + b*(6) + b*(7) = 0.0915 + 0.1647 + 0.1853 + 0.1668 = 0.6083
  //   c) serie a 3 victorias: 0.1664 + 0.2246 + 0.2021 = 0.5931
  it('Walpole, ejemplo 5.14', () => {
    expect(solve(4, 'igual', 6)).toBeCloseTo(0.1853, 4);
    expect(solve(4, 'igual', 4)).toBeCloseTo(0.0915, 4);
    expect(solve(4, 'igual', 5)).toBeCloseTo(0.1647, 4);
    expect(solve(4, 'igual', 7)).toBeCloseTo(0.1668, 4);
    expect(solve(4, 'entre', 4, 7)).toBeCloseTo(0.6083, 4);
    expect(solve(3, 'igual', 3)).toBeCloseTo(0.1664, 4);
    expect(solve(3, 'igual', 4)).toBeCloseTo(0.2246, 4);
    expect(solve(3, 'igual', 5)).toBeCloseTo(0.2021, 4);
    expect(solve(3, 'entre', 3, 5)).toBeCloseTo(0.5931, 4);
  });

  // Sección 5.4 (p. 158): quinto éxito en el séptimo ensayo con p = 0.6;
  // P(X = 7) = C(6, 4)(0.6)⁵(0.4)² = 0.1866.
  it('Walpole, sección 5.4: el quinto éxito en el séptimo ensayo', () => {
    const { value } = ok(pascal.solve({ successes: 5, p: 0.6, query: 'igual', k: 7 }));
    expect(value.probability).toBeCloseTo(0.1866, 4);
  });

  // Caso borde, analítico: antes de k ensayos no puede haber k éxitos, y la media es k/p (suma de
  // k geométricas, teorema 5.3).
  it('soporte desde k y media k/p', () => {
    expect(solve(4, 'entre', 1, 7)).toBeCloseTo(solve(4, 'entre', 4, 7), 12);
    expect(solve(4, 'igual', 3)).toBe(0);
    const { value } = ok(pascal.solve(pascal.example));
    expect(value.mean).toBeCloseTo(4 / 0.55, 12);
    expect(value.variance).toBeCloseTo((4 * 0.45) / 0.55 ** 2, 12);
  });
});

describe('Distribución hipergeométrica', () => {
  // Ejemplo 5.9 (p. 154): lote de 40 con 3 defectuosos, muestra de 5; h(1; 40, 5, 3) = 0.3011.
  it('Walpole, ejemplo 5.9', () => {
    expect(ok(hypergeometric.solve(hypergeometric.example)).value.probability).toBeCloseTo(
      0.3011,
      4,
    );
  });

  // Ejemplo 5.11 (p. 155): para el ejemplo 5.9, μ = (5)(3)/40 = 0.375,
  // σ² = (35/39)(5)(3/40)(1 − 3/40) = 0.3113 y σ = 0.558.
  it('Walpole, ejemplo 5.11: media y varianza (teorema 5.2)', () => {
    const { value } = ok(hypergeometric.solve(hypergeometric.example));
    expect(value.mean).toBeCloseTo(0.375, 12);
    expect(value.variance).toBeCloseTo(0.3113, 4);
    expect(value.standardDeviation).toBeCloseTo(0.558, 3);
  });

  // Ejemplo 5.8 (pp. 153-154): lotes de 10 con 2 defectuosos, se prueban 3 y se acepta si ninguno
  // es defectuoso: h(0; 10, 3, 2) = 0.467. Ejemplo 5.10 (p. 155): h(3; 100, 10, 12) = 0.08.
  it('Walpole, ejemplos 5.8 y 5.10', () => {
    const accept = hypergeometric.solve({
      lotSize: 10,
      successes: 2,
      sampleSize: 3,
      query: 'igual',
      k: 0,
    });
    expect(ok(accept).value.probability).toBeCloseTo(0.467, 3);
    const lot = hypergeometric.solve({
      lotSize: 100,
      successes: 12,
      sampleSize: 10,
      query: 'igual',
      k: 3,
    });
    expect(ok(lot).value.probability).toBeCloseTo(0.08, 2);
  });

  // Caso borde, analítico: con 8 éxitos en un lote de 10, una muestra de 5 tiene al menos
  // 5 − 2 = 3 éxitos (solo hay 2 fracasos), como indica el rango del libro (p. 154).
  it('el soporte empieza en máx{0, n − (N − k)}', () => {
    const result = ok(
      hypergeometric.solve({
        lotSize: 10,
        successes: 8,
        sampleSize: 5,
        query: 'menor-igual',
        k: 2,
      }),
    );
    expect(result.value.probability).toBe(0);
    expect(result.tables[0]?.rows[0]?.x).toBe(3);
  });

  it('valida el lote y la muestra', () => {
    const schema = hypergeometric.inputSchema;
    const base = { lotSize: 10, successes: 3, sampleSize: 4, query: 'igual', k: 1 };
    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, successes: 11 }).success).toBe(false);
    expect(schema.safeParse({ ...base, sampleSize: 11 }).success).toBe(false);
    expect(schema.safeParse({ ...base, k: 5 }).success).toBe(false);
  });
});

describe('Distribución multinomial', () => {
  // Ejemplo 5.7 (p. 150): pistas con p = 2/9, 1/6 y 11/18; 6 aviones repartidos 2, 1 y 3.
  // f = [6!/(2! 1! 3!)](2/9)²(1/6)(11/18)³ = 0.1127. (En la copia consultada el resultado impreso
  // no se lee; se verificó con la fórmula del libro: 60 · 0.0493827 · 0.1666667 · 0.2282236.)
  it('Walpole, ejemplo 5.7', () => {
    const { value } = ok(multinomial.solve(multinomial.example));
    expect(value.coefficient).toBe(60);
    expect(value.trials).toBe(6);
    expect(value.probability).toBeCloseTo(0.1127, 4);
  });

  // Ejemplo 5.1 (p. 145): con dos resultados es la binomial; 2 de 4 componentes sobreviven con
  // p = 3/4: C(4, 2)(3/4)²(1/4)² = 27/128.
  it('con dos resultados coincide con la binomial (ejemplo 5.1)', () => {
    const result = multinomial.solve({
      outcomes: [
        { name: 'Sobrevive', probability: '3/4', count: 2 },
        { name: 'Falla', probability: '1/4', count: 2 },
      ],
    });
    expect(ok(result).value.probability).toBeCloseTo(27 / 128, 12);
  });

  it('un resultado imposible que ocurre da probabilidad 0', () => {
    const result = multinomial.solve({
      outcomes: [
        { name: 'A', probability: '1', count: 2 },
        { name: 'B', probability: '0', count: 1 },
      ],
    });
    expect(ok(result).value.probability).toBe(0);
  });

  it('las probabilidades deben sumar 1', () => {
    const schema = multinomial.inputSchema;
    const outcomes = (p: string) => [
      { name: 'A', probability: p, count: 1 },
      { name: 'B', probability: '1/3', count: 1 },
      { name: 'C', probability: '1/3', count: 1 },
    ];
    expect(schema.safeParse({ outcomes: outcomes('1/3') }).success).toBe(true);
    const bad = schema.safeParse({ outcomes: outcomes('0.3') });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0]?.message).toContain('deben sumar 1');
    expect(schema.safeParse({ outcomes: outcomes('abc') }).success).toBe(false);
  });
});
