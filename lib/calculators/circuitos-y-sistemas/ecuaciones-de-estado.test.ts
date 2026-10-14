import { describe, expect, it } from 'vitest';
import type { CircuitDocument } from './circuit';
import { ecuacionesDeEstado, solveStateEquations } from './ecuaciones-de-estado';
import { solveNodal } from './analisis-de-nodos';

function solved(circuit: CircuitDocument) {
  const result = solveStateEquations({ circuit });
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

/**
 * Hayt, Kemmerly y Durbin, 8.ª ed., ejemplo 9.10 (fig. 9.31), para t > 0: fuente de 4 A que entra
 * al nodo izquierdo, inductor de 3 H de ese nodo a tierra, 30 Ω entre los nodos, capacitor de
 * 1/27 F del nodo derecho a tierra y fuente de 5 A que entra al nodo derecho. Con i_L(0⁺) = 5 A y
 * v_C(0⁺) = 150 V el libro obtiene v_C(t) = 150 + 13.5(e^{−t} − e^{−9t}) V.
 */
const HAYT_9_10: CircuitDocument = {
  components: [
    {
      id: 'i1',
      kind: 'current-source',
      a: { x: 0, y: 4 },
      b: { x: 0, y: 0 },
      value: 4,
      label: 'I1',
    },
    {
      id: 'l1',
      kind: 'inductor',
      a: { x: 4, y: 0 },
      b: { x: 4, y: 4 },
      value: 3,
      label: 'L1',
      initial: 5,
    },
    { id: 'r1', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 8, y: 0 }, value: 30, label: 'R1' },
    {
      id: 'c1',
      kind: 'capacitor',
      a: { x: 8, y: 0 },
      b: { x: 8, y: 4 },
      value: 1 / 27,
      label: 'C1',
      initial: 150,
    },
    {
      id: 'i2',
      kind: 'current-source',
      a: { x: 12, y: 4 },
      b: { x: 12, y: 0 },
      value: 5,
      label: 'I2',
    },
  ],
  wires: [
    {
      id: 'w1',
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
    },
    {
      id: 'w2',
      points: [
        { x: 8, y: 0 },
        { x: 12, y: 0 },
      ],
    },
    {
      id: 'tierra',
      points: [
        { x: 0, y: 4 },
        { x: 12, y: 4 },
      ],
    },
  ],
  ground: { x: 0, y: 4 },
};

describe('ecuaciones de estado', () => {
  it('Dorf y Svoboda, 9.ª ed., sec. 9.9 (fig. 9.9-1): A = [[−2, 1], [2, −3]] y v₁(t) = 9 − 2e^{−t} − 2e^{−4t}', () => {
    const result = solved(ecuacionesDeEstado.example.circuit);
    const { model, charPoly, solutions, steady } = result.value;
    expect(model.A).toEqual([
      [-2, 1],
      [2, -3],
    ]);
    // dv₁/dt = −2v₁ + v₂ + v_a y dv₂/dt = 2v₁ − 3v₂ + v_b (ecs. 9.9-5 y 9.9-6 del libro).
    expect(model.B).toEqual([
      [1, 0],
      [0, 1],
    ]);
    // Ecuación característica s² + 5s + 4 = 0 (ec. 9.9-7).
    expect(charPoly).toEqual([1, 5, 4]);
    expect(solutions[0]).toBe('9 - 2e^{-t} - 2e^{-4t}');
    // Valor final: v₁f = 9 V (y v₂ = 2v₁ − 10 = 8 V de la primera ecuación en estado estable).
    expect(steady).toEqual([9, 8]);
  });

  it('Hayt, ejemplo 9.10: v_C(t) = 150 + 13.5(e^{−t} − e^{−9t}) V', () => {
    const { model, charPoly, solutions, steady } = solved(HAYT_9_10).value;
    // s₁ = −1 y s₂ = −9 → s² + 10s + 9.
    expect(charPoly).toEqual([1, 10, 9]);
    const k = model.states.findIndex((s) => s.label === 'C1');
    expect(solutions[k]).toBe('150 + 13.5e^{-t} - 13.5e^{-9t}');
    // En cd el inductor es un corto: toda la corriente (4 A + 5 A) baja por él.
    const kl = model.states.findIndex((s) => s.label === 'L1');
    expect(steady![kl]).toBeCloseTo(9, 10);
  });

  it('el árbol normal pone los capacitores en el árbol y los inductores en el coárbol', () => {
    const { model } = solved(HAYT_9_10).value;
    expect(model.tree).toContain('C1');
    expect(model.links).toContain('L1');
  });

  it('red impropia: dos capacitores en paralelo forman un lazo solo de capacitores', () => {
    const circuit: CircuitDocument = {
      components: [
        {
          id: 'v1',
          kind: 'voltage-source',
          a: { x: 0, y: 0 },
          b: { x: 0, y: 4 },
          value: 1,
          label: 'V1',
        },
        { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, value: 1, label: 'R1' },
        {
          id: 'c1',
          kind: 'capacitor',
          a: { x: 4, y: 0 },
          b: { x: 4, y: 4 },
          value: 1,
          label: 'C1',
        },
        {
          id: 'c2',
          kind: 'capacitor',
          a: { x: 8, y: 0 },
          b: { x: 8, y: 4 },
          value: 1,
          label: 'C2',
        },
      ],
      wires: [
        {
          id: 'w1',
          points: [
            { x: 4, y: 0 },
            { x: 8, y: 0 },
          ],
        },
        {
          id: 'w2',
          points: [
            { x: 0, y: 4 },
            { x: 8, y: 4 },
          ],
        },
      ],
      ground: { x: 0, y: 4 },
    };
    const result = solveStateEquations({ circuit });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('red-impropia');
  });

  it('sin capacitores ni inductores no hay variables de estado', () => {
    const circuit: CircuitDocument = {
      components: [
        {
          id: 'v1',
          kind: 'voltage-source',
          a: { x: 0, y: 0 },
          b: { x: 0, y: 4 },
          value: 1,
          label: 'V1',
        },
        { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 0, y: 4 }, value: 1, label: 'R1' },
      ],
      wires: [],
    };
    const result = solveStateEquations({ circuit });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sin-elementos-almacenadores');
  });

  it('las calculadoras de cd rechazan capacitores e inductores', () => {
    const result = solveNodal({ circuit: HAYT_9_10 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('elementos-almacenadores');
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(ecuacionesDeEstado.inputSchema.safeParse(ecuacionesDeEstado.example).success).toBe(true);
    expect(ecuacionesDeEstado.solve(ecuacionesDeEstado.example).ok).toBe(true);
  });
});
