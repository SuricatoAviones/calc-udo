import { describe, expect, it } from 'vitest';
import { buildTopology, type CircuitComponent, type CircuitDocument } from './circuit';
import { solveMna } from './mna';

function r(
  id: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  value: number,
): CircuitComponent {
  return { id, kind: 'resistor', a, b, value, label: id };
}

function v(
  id: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  value: number,
): CircuitComponent {
  return { id, kind: 'voltage-source', a, b, value, label: id };
}

function i(
  id: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  value: number,
): CircuitComponent {
  return { id, kind: 'current-source', a, b, value, label: id };
}

describe('solveMna', () => {
  it('resuelve un circuito con fuentes de corriente y resistencias', () => {
    // Referencia común en y=6, unida por un cable; nodos 1 y 2 en y=4.
    const doc: CircuitDocument = {
      components: [
        i('i1', { x: 0, y: 6 }, { x: 0, y: 4 }, 3),
        i('i2', { x: 2, y: 6 }, { x: 2, y: 4 }, 5),
        r('r1', { x: 0, y: 4 }, { x: 0, y: 6 }, 2),
        r('r2', { x: 2, y: 4 }, { x: 2, y: 6 }, 4),
        r('r3', { x: 0, y: 4 }, { x: 2, y: 4 }, 1),
      ],
      wires: [
        {
          id: 'w1',
          points: [
            { x: 0, y: 6 },
            { x: 2, y: 6 },
          ],
        },
      ],
      ground: { x: 0, y: 6 },
    };
    const topo = buildTopology(doc);
    const outcome = solveMna(topo);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const node1 = topo.nodeOf.get('0,4')!;
    const node2 = topo.nodeOf.get('2,4')!;
    expect(outcome.result.nodeVoltages[node1]).toBeCloseTo(10, 6);
    expect(outcome.result.nodeVoltages[node2]).toBeCloseTo(12, 6);
    expect(outcome.result.branchResults.reduce((s, b) => s + b.p, 0)).toBeCloseTo(0, 6);
  });

  it('resuelve una fuente de voltaje con carga resistiva en paralelo', () => {
    const doc: CircuitDocument = {
      components: [
        v('v1', { x: 0, y: 0 }, { x: 0, y: 4 }, 10),
        r('r1', { x: 0, y: 0 }, { x: 0, y: 4 }, 5),
      ],
      wires: [],
      ground: { x: 0, y: 4 },
    };
    const topo = buildTopology(doc);
    const outcome = solveMna(topo);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const nodeTop = topo.nodeOf.get('0,0')!;
    expect(outcome.result.nodeVoltages[nodeTop]).toBeCloseTo(10, 6);

    const v1 = outcome.result.branchResults.find((b) => b.label === 'v1');
    const r1 = outcome.result.branchResults.find((b) => b.label === 'r1');
    expect(v1?.i).toBeCloseTo(-2, 6); // corriente que entra por + (negativa ⇒ entrega)
    expect(r1?.i).toBeCloseTo(2, 6);
    expect(outcome.result.branchResults.reduce((s, b) => s + b.p, 0)).toBeCloseTo(0, 6);
  });

  it('detecta sistema singular por lazo de fuentes de voltaje', () => {
    const doc: CircuitDocument = {
      components: [
        v('v1', { x: 0, y: 0 }, { x: 2, y: 0 }, 10),
        v('v2', { x: 2, y: 0 }, { x: 2, y: 2 }, 5),
        v('v3', { x: 2, y: 2 }, { x: 0, y: 2 }, 3),
        v('v4', { x: 0, y: 2 }, { x: 0, y: 0 }, 2),
      ],
      wires: [],
      ground: { x: 0, y: 0 },
    };
    const topo = buildTopology(doc);
    const outcome = solveMna(topo);
    expect(outcome.ok).toBe(false);
  });
});
