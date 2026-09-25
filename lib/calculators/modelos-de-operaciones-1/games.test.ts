import { describe, expect, it } from 'vitest';
import { mixedStrategies } from './estrategias-mixtas';
import { pureStrategies } from './estrategias-puras';

// Fuentes:
// - Taha, Operations Research: An Introduction, 9.ª ed. en inglés (2011), sec. 13.4. Las matrices
//   de los ejemplos 13.4-1 y 13.4-3 se verificaron con el «R Textbook Companion» de esa edición
//   (FOSSEE, 2020), que reproduce los datos y el punto maximin del método gráfico.
// - Hillier & Lieberman, Introduction to Operations Research, 7.ª ed. en inglés (2001), cap. 14,
//   problema de la campaña política: variación 1 (tabla 14.3), 2 (tabla 14.4) y 3 (tabla 14.5,
//   solución gráfica en la sec. 14.4).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

const expectVector = (actual: number[], expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((v, k) => expect(actual[k], `componente ${k + 1}`).toBeCloseTo(v, 10));
};

/** Pago esperado de A con las estrategias mixtas x (filas) e y (columnas). */
const expected = (payoff: number[][], x: number[], y: number[]) =>
  payoff.reduce((s, row, i) => s + row.reduce((t, a, j) => t + a * x[i]! * y[j]!, 0), 0);

describe('Estrategias puras', () => {
  // Taha, ejemplo 13.4-1: mínimos de fila −3, 5, −9 (maximin 5, A2); máximos de columna 8, 5,
  // 9, 8 (minimax 5, B2); punto de silla en (A2, B2) y valor del juego 5.
  it('Taha, ejemplo 13.4-1: punto de silla en (A2, B2) con v = 5', () => {
    const { value } = ok(pureStrategies.solve(pureStrategies.example));
    expect(value.rowMins).toEqual([-3, 5, -9]);
    expect(value.colMaxs).toEqual([8, 5, 9, 8]);
    expect(value.maximinRows).toEqual([1]);
    expect(value.minimaxCols).toEqual([1]);
    expect(value.saddlePoints).toEqual([[1, 1]]);
    expect(value.value).toBe(5);
  });

  // Hillier, tabla 14.4: maximin 0 (estrategia 2) = minimax 0 (estrategia 2): juego justo.
  it('Hillier, variación 2: juego justo con valor 0', () => {
    const { value } = ok(
      pureStrategies.solve({
        payoff: [
          [-3, -2, 6],
          [2, 0, 2],
          [5, -2, -4],
        ],
      }),
    );
    expect(value.maximin).toBe(0);
    expect(value.minimax).toBe(0);
    expect(value.saddlePoints).toEqual([[1, 1]]);
    expect(value.value).toBe(0);
  });

  // Hillier, tabla 14.5: maximin −2 (estrategia 1) y minimax 2 (estrategia 3): sin punto de silla.
  it('Hillier, variación 3: sin punto de silla', () => {
    const result = ok(
      pureStrategies.solve({
        payoff: [
          [0, -2, 2],
          [5, 4, -3],
          [2, 3, -4],
        ],
      }),
    );
    expect(result.value.maximin).toBe(-2);
    expect(result.value.maximinRows).toEqual([0]);
    expect(result.value.minimax).toBe(2);
    expect(result.value.minimaxCols).toEqual([2]);
    expect(result.value.value).toBeNull();
    expect(result.notices[0]!.level).toBe('warning');
  });

  it('rechaza matrices con filas de distinto largo o celdas vacías', () => {
    expect(pureStrategies.inputSchema.safeParse({ payoff: [[1, 2], [3]] }).success).toBe(false);
    expect(pureStrategies.inputSchema.safeParse({ payoff: [[1, Number.NaN]] }).success).toBe(false);
  });
});

describe('Estrategias mixtas', () => {
  // Hillier, sec. 14.4: A3 está dominada por A2; el punto maximin está en la intersección de
  // −3 + 5x₁ y 4 − 6x₁: x₁ = 7/11, v = 2/11; B: (y₁, y₂, y₃) = (0, 5/11, 6/11).
  it('Hillier, variación 3: x = (7/11, 4/11, 0), y = (0, 5/11, 6/11), v = 2/11', () => {
    const { value, steps, series } = ok(mixedStrategies.solve(mixedStrategies.example));
    expect(value.method).toBe('grafico-a');
    expect(value.value).toBeCloseTo(2 / 11, 12);
    expectVector(value.strategyA, [7 / 11, 4 / 11, 0]);
    expectVector(value.strategyB, [0, 5 / 11, 6 / 11]);
    // Además de A3, la dominancia elimina B1 (Hillier la conserva y le asigna y₁ = 0).
    const dominance = steps.find((s) => s.title === 'Eliminar estrategias dominadas')!;
    expect(dominance.children!.map((c) => c.title)).toEqual([
      'A3 está dominada por A2',
      'B1 está dominada por B2',
    ]);
    expect(series[0]!.others).toHaveLength(2);
  });

  // Hillier, sec. 14.2, variación 1: la dominancia sola resuelve el juego (A3, luego B3, A2 y
  // B2); ambos jugadores usan su estrategia 1 y el valor es 1.
  it('Hillier, variación 1: la dominancia deja A1 contra B1 con v = 1', () => {
    const { value, steps } = ok(
      mixedStrategies.solve({
        payoff: [
          [1, 2, 4],
          [1, 0, 5],
          [0, 1, -1],
        ],
      }),
    );
    expect(value.method).toBe('punto-de-silla');
    expect(value.value).toBe(1);
    expectVector(value.strategyA, [1, 0, 0]);
    expectVector(value.strategyB, [1, 0, 0]);
    const dominance = steps.find((s) => s.title === 'Eliminar estrategias dominadas')!;
    expect(dominance.children!.map((c) => c.title)).toEqual([
      'A3 está dominada por A1',
      'B3 está dominada por B1',
      'A2 está dominada por A1',
      'B2 está dominada por B1',
    ]);
  });

  // Taha, ejemplo 13.4-3 (2 × 4): el máximo de la envolvente inferior está en x₁ = 1/2 con
  // v = 5/2. B1 queda dominada por B2. Por ese punto pasan las rectas de B2, B3 y B4, así que B
  // tiene óptimos alternativos; la envolvente la forman B3 (a la izquierda) y B4 (a la derecha).
  // La mezcla de B3 y B4 se verificó a mano: 3y₃ − y₄ = 2y₃ + 6y₄ = 5/2 con y₃ + y₄ = 1 da
  // (y₃, y₄) = (7/8, 1/8).
  it('Taha, ejemplo 13.4-3: x₁ = 1/2 y v = 5/2', () => {
    const payoff = [
      [2, 2, 3, -1],
      [4, 3, 2, 6],
    ];
    const { value, notices } = ok(mixedStrategies.solve({ payoff }));
    expect(value.value).toBeCloseTo(2.5, 12);
    expectVector(value.strategyA, [0.5, 0.5]);
    expectVector(value.strategyB, [0, 0, 7 / 8, 1 / 8]);
    for (const row of [
      [1, 0],
      [0, 1],
    ]) {
      expect(expected(payoff, row, value.strategyB)).toBeCloseTo(2.5, 12);
    }
    expect(notices.some((n) => /pasan 3 rectas/.test(n.message))).toBe(true);
  });

  // Caso borde analítico: el juego −Mᵀ es el mismo juego con los papeles cambiados, así que su
  // valor es −v y las estrategias se intercambian.
  const minusTranspose = (M: number[][]) => M[0]!.map((_, j) => M.map((row) => -row[j]!));

  it('el juego −Mᵀ intercambia las estrategias y cambia el signo del valor', () => {
    const { value } = ok(
      mixedStrategies.solve({ payoff: minusTranspose(mixedStrategies.example.payoff) }),
    );
    expect(value.value).toBeCloseTo(-2 / 11, 12);
    expectVector(value.strategyA, [0, 5 / 11, 6 / 11]);
    expectVector(value.strategyB, [7 / 11, 4 / 11, 0]);
  });

  // Con el juego 2 × 4 de Taha transpuesto (4 × 2) se ejercita el método gráfico para B.
  it('m × 2: método gráfico para B con el juego de Taha transpuesto', () => {
    const { value } = ok(
      mixedStrategies.solve({
        payoff: minusTranspose([
          [2, 2, 3, -1],
          [4, 3, 2, 6],
        ]),
      }),
    );
    expect(value.method).toBe('grafico-b');
    expect(value.value).toBeCloseTo(-2.5, 12);
    expectVector(value.strategyA, [0, 0, 7 / 8, 1 / 8]);
    expectVector(value.strategyB, [0.5, 0.5]);
  });

  // Casos borde analíticos con una recta horizontal: B1 paga siempre 1.
  it('con una recta horizontal, B la juega pura', () => {
    const { value } = ok(
      mixedStrategies.solve({
        payoff: [
          [1, 0, 2],
          [1, 2, 0],
        ],
      }),
    );
    expect(value.value).toBeCloseTo(1, 12);
    expectVector(value.strategyA, [0.5, 0.5]);
    expectVector(value.strategyB, [1, 0, 0]);
  });

  it('avisa cuando el óptimo de A es un tramo (infinitas soluciones)', () => {
    const { value, notices } = ok(
      mixedStrategies.solve({
        payoff: [
          [1, 3, 0],
          [1, 0, 3],
        ],
      }),
    );
    expect(value.value).toBeCloseTo(1, 12);
    expect(value.strategyA[0]).toBeCloseTo(1 / 3, 12);
    expect(notices.some((n) => /tramo horizontal/.test(n.message))).toBe(true);
  });

  // Piedra, papel o tijera: sin dominancia ni punto de silla y 3 × 3.
  it('3 × 3 sin reducción → too-large, con la traza hasta ahí', () => {
    const result = mixedStrategies.solve({
      payoff: [
        [0, -1, 1],
        [1, 0, -1],
        [-1, 1, 0],
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('too-large');
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
  });
});
