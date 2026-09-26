import { describe, expect, it } from 'vitest';
import { vogel } from './aproximacion-de-vogel';
import { leastCost } from './costo-minimo';
import { northwestCorner } from './esquina-noroeste';
import { modi } from './metodo-de-multiplicadores';
import { hungarian } from './metodo-hungaro';

// Fuentes: Taha, Operations Research: An Introduction, 9.ª ed. en inglés (2011). Los datos se
// verificaron con el «R Textbook Companion» (FOSSEE, 2020): SunRay Transport (ejemplos 5.3-1 a
// 5.3-5) y asignación (5.4-1 y 5.4-2). Costos del libro: esquina noroeste $520, costo mínimo
// $475, Vogel $475, óptimo $435; asignación 5.4-1: $27. El 5.4-2 (costo 21, con un ajuste
// θ = 1) se resolvió a mano con el método del libro.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

const cells = (allocation: { from: number; to: number; quantity: number }[]) =>
  Object.fromEntries(allocation.map((a) => [`${a.from}${a.to}`, a.quantity]));

describe('Soluciones iniciales del transporte', () => {
  // Esquina noroeste: x11 = 5, x12 = 10, x22 = 5, x23 = 15, x24 = 5, x34 = 10 → $520.
  it('esquina noroeste: $520', () => {
    const { value } = ok(northwestCorner.solve(northwestCorner.example));
    expect(value.cost).toBe(520);
    expect(cells(value.allocation)).toEqual({
      '11': 5,
      '12': 10,
      '22': 5,
      '23': 15,
      '24': 5,
      '34': 10,
    });
  });

  // Costo mínimo: x12 = 15 (se tacha la columna 2 y la fila 1 queda con 0), x31 = 5, x23 = 15,
  // x14 = 0, x34 = 5, x24 = 10 → $475, con una básica en 0.
  it('costo mínimo: $475 con una básica degenerada', () => {
    const r = ok(leastCost.solve(leastCost.example));
    expect(r.value.cost).toBe(475);
    expect(cells(r.value.allocation)).toEqual({
      '12': 15,
      '31': 5,
      '23': 15,
      '14': 0,
      '34': 5,
      '24': 10,
    });
    expect(r.notices.some((n) => /degenerada/.test(n.message))).toBe(true);
  });

  // Vogel: la primera penalización mayor es la de la fila 3 (14 − 4 = 10) → x31 = 5; luego la
  // de la fila 1 (11 − 2 = 9) → x12 = 15. Costo $475.
  it('Vogel: $475, empezando por x31 = 5 y x12 = 15', () => {
    const r = ok(vogel.solve(vogel.example));
    expect(r.value.cost).toBe(475);
    const order = r.steps[1]!.children!.map((s) => s.result);
    expect(order[0]).toBe('x_{31} = 5');
    expect(order[1]).toBe('x_{12} = 15');
  });

  // Caso borde analítico: oferta total 55 > demanda 50 → destino ficticio con demanda 5.
  it('balancea con un destino ficticio', () => {
    const r = ok(northwestCorner.solve({ ...northwestCorner.example, supply: [20, 25, 10] }));
    expect(r.value.balanced).toBe(false);
    expect(r.tables[0]!.columns.some((c) => c.header.includes('Ficticio'))).toBe(true);
    expect(r.value.allocation).toHaveLength(3 + 5 - 1);
  });
});

describe('Método de los multiplicadores', () => {
  it('SunRay: de $520 (esquina noroeste) al óptimo de $435', () => {
    const { value } = ok(modi.solve(modi.example));
    expect(value.initialCost).toBe(520);
    expect(value.cost).toBe(435);
    const totals = (key: 'from' | 'to', n: number) =>
      Array.from({ length: n }, (_, i) =>
        value.allocation.filter((a) => a[key] === i + 1).reduce((s, a) => s + a.quantity, 0),
      );
    expect(totals('from', 3)).toEqual([15, 25, 10]);
    expect(totals('to', 4)).toEqual([5, 15, 15, 15]);
  });

  it('llega al mismo óptimo desde el costo mínimo y desde Vogel', () => {
    expect(ok(modi.solve({ ...modi.example, initial: 'costo-minimo' })).value.cost).toBe(435);
    expect(ok(modi.solve({ ...modi.example, initial: 'vogel' })).value.cost).toBe(435);
  });
});

describe('Método húngaro', () => {
  // Taha 5.4-1: John → C2 (10), Karen → C1 (9), Terri → C3 (8) = 27, sin ajustes.
  it('Taha 5.4-1: costo 27', () => {
    const { value } = ok(hungarian.solve(hungarian.example));
    expect(value.total).toBe(27);
    expect(value.assignment).toEqual([2, 1, 3]);
    expect(value.iterations).toBe(0);
  });

  // Taha 5.4-2: tras restar mínimos, 3 líneas cubren los ceros; θ = 1 y luego F1 → C1 (1),
  // F2 → C3 (10), F3 → C2 (5), F4 → C4 (5) = 21.
  it('Taha 5.4-2: costo 21 con un ajuste θ = 1', () => {
    const r = ok(
      hungarian.solve({
        costs: [
          [1, 4, 6, 3],
          [9, 7, 10, 9],
          [4, 5, 11, 7],
          [8, 7, 8, 5],
        ],
        sense: 'min',
      }),
    );
    expect(r.value.total).toBe(21);
    expect(r.value.assignment).toEqual([1, 3, 2, 4]);
    expect(r.value.iterations).toBe(1);
    expect(r.steps.find((s) => s.title === 'Ajuste 1')!.result).toBe('\\theta = 1');
  });

  // Casos borde analíticos: maximizar (restando del máximo) y una matriz no cuadrada.
  it('maximiza y completa matrices rectangulares', () => {
    const max = ok(
      hungarian.solve({
        costs: [
          [15, 10, 9],
          [9, 15, 10],
          [10, 12, 8],
        ],
        sense: 'max',
      }),
    );
    // Mejor combinación: 15 (F1→C1) + 15 (F2→C2) + 8 (F3→C3) = 38.
    expect(max.value.total).toBe(38);
    const rect = ok(
      hungarian.solve({
        costs: [
          [4, 2, 8],
          [3, 7, 1],
        ],
        sense: 'min',
      }),
    );
    // F1 → C2 (2) y F2 → C3 (1); la tercera columna queda para la fila ficticia.
    expect(rect.value.total).toBe(3);
    expect(rect.value.assignment).toEqual([2, 3]);
  });
});
