import { describe, expect, it } from 'vitest';
import { buildTopology, type CircuitDocument } from './circuit';
import { solveSuperposition } from './superposition';
import { solveMna } from './mna';

/**
 * La superposición es exacta en circuitos lineales, así que la respuesta total debe coincidir con
 * la del análisis nodal del mismo circuito (implementado y probado en `mna.test.ts`). Este
 * contraste es la verificación; no proviene de un ejemplo de libro.
 */
const example: CircuitDocument = {
  components: [
    {
      id: 'v1',
      kind: 'voltage-source',
      a: { x: 0, y: 0 },
      b: { x: 0, y: 4 },
      value: 10,
      label: 'V1',
    },
    { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, value: 2, label: 'R1' },
    { id: 'r3', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, value: 6, label: 'R3' },
    { id: 'r2', kind: 'resistor', a: { x: 8, y: 0 }, b: { x: 4, y: 0 }, value: 3, label: 'R2' },
    {
      id: 'v2',
      kind: 'voltage-source',
      a: { x: 8, y: 0 },
      b: { x: 8, y: 4 },
      value: 5,
      label: 'V2',
    },
  ],
  wires: [
    {
      id: 'w1',
      points: [
        { x: 0, y: 4 },
        { x: 4, y: 4 },
      ],
    },
    {
      id: 'w2',
      points: [
        { x: 4, y: 4 },
        { x: 8, y: 4 },
      ],
    },
  ],
  ground: { x: 4, y: 4 },
};

describe('solveSuperposition', () => {
  it('suma los aportes y coincide con el análisis nodal', () => {
    const outcome = solveSuperposition(example);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.contributions).toHaveLength(2);

    const mna = solveMna(buildTopology(example));
    expect(mna.ok).toBe(true);
    if (!mna.ok) return;

    for (const b of outcome.result.total) {
      const reference = mna.result.branchResults.find((r) => r.id === b.id)!;
      expect(b.i).toBeCloseTo(reference.i, 6);
      expect(b.v).toBeCloseTo(reference.v, 6);
    }
  });

  it('calcula aportes conocidos del ejemplo', () => {
    const outcome = solveSuperposition(example);
    if (!outcome.ok) return;
    const r1 = outcome.result.total.find((b) => b.label === 'R1')!;
    // v_M = 20/3 V ⇒ i(R1) = (10 − 20/3) / 2 = 5/3 A.
    expect(r1.i).toBeCloseTo(5 / 3, 6);
    const r3 = outcome.result.total.find((b) => b.label === 'R3')!;
    expect(r3.i).toBeCloseTo(20 / 3 / 6, 6);
  });

  it('exige fuentes independientes', () => {
    const doc: CircuitDocument = {
      components: [
        { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, value: 2, label: 'R1' },
        { id: 'r2', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 0, y: 4 }, value: 3, label: 'R2' },
      ],
      wires: [
        {
          id: 'w',
          points: [
            { x: 4, y: 0 },
            { x: 4, y: 4 },
          ],
        },
      ],
      ground: { x: 0, y: 4 },
    };
    const outcome = solveSuperposition(doc);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe('sin-fuentes');
  });
});
