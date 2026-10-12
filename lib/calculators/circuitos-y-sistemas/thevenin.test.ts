import { describe, expect, it } from 'vitest';
import { buildTopology, type CircuitDocument } from './circuit';
import { computeThevenin } from './thevenin';
import { solveMna } from './mna';

/**
 * Divisor de tensión clásico: V1 = 10 V con R1 = 5 Ω y la carga R2 = 10 Ω. El equivalente visto
 * por R2 es V_th = 10 V y R_th = 5 Ω (la fuente ideal en serie con R1), de modo que
 * i_L = 10 / (5 + 10) = 0.6667 A, que coincide con el análisis nodal del circuito completo.
 */
const divider: CircuitDocument = {
  components: [
    {
      id: 'v1',
      kind: 'voltage-source',
      a: { x: 0, y: 0 },
      b: { x: 0, y: 4 },
      value: 10,
      label: 'V1',
    },
    { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, value: 5, label: 'R1' },
    { id: 'r2', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, value: 10, label: 'R2' },
  ],
  wires: [
    {
      id: 'w1',
      points: [
        { x: 0, y: 4 },
        { x: 4, y: 4 },
      ],
    },
  ],
  ground: { x: 0, y: 4 },
};

describe('computeThevenin', () => {
  it('calcula el equivalente de Thévenin y Norton del divisor', () => {
    const outcome = computeThevenin(divider, 'r2');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.vTh).toBeCloseTo(10, 6);
    expect(outcome.result.rTh).toBeCloseTo(5, 6);
    expect(outcome.result.iN).toBeCloseTo(2, 6);
    expect(outcome.result.pMax).toBeCloseTo(5, 6);
    expect(outcome.result.loadCurrent).toBeCloseTo(10 / 15, 6);
    expect(outcome.result.loadPower).toBeCloseTo((10 / 15) ** 2 * 10, 6);
  });

  it('la corriente de carga coincide con el análisis nodal del circuito completo', () => {
    const outcome = computeThevenin(divider, 'r2');
    if (!outcome.ok) return;
    const mna = solveMna(buildTopology(divider));
    expect(mna.ok).toBe(true);
    if (!mna.ok) return;
    const load = mna.result.branchResults.find((b) => b.id === 'r2')!;
    expect(load.i).toBeCloseTo(outcome.result.loadCurrent, 6);
  });

  it('exige que la carga sea una resistencia', () => {
    const outcome = computeThevenin(divider, 'v1');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe('carga-no-valida');
  });

  it('admite una red con fuente de corriente', () => {
    // Fuente de 2 mA en paralelo con R1 = 1 kΩ y R2 = 1 kΩ de carga: V_th = i·R1 = 2 V, R_th = 1 kΩ.
    const doc: CircuitDocument = {
      components: [
        {
          id: 'i1',
          kind: 'current-source',
          a: { x: 0, y: 4 },
          b: { x: 0, y: 0 },
          value: 0.002,
          label: 'I1',
        },
        {
          id: 'r1',
          kind: 'resistor',
          a: { x: 2, y: 0 },
          b: { x: 2, y: 4 },
          value: 1000,
          label: 'R1',
        },
        {
          id: 'r2',
          kind: 'resistor',
          a: { x: 4, y: 0 },
          b: { x: 4, y: 4 },
          value: 1000,
          label: 'R2',
        },
      ],
      wires: [
        {
          id: 'wt1',
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
          ],
        },
        {
          id: 'wt2',
          points: [
            { x: 2, y: 0 },
            { x: 4, y: 0 },
          ],
        },
        {
          id: 'wb1',
          points: [
            { x: 0, y: 4 },
            { x: 2, y: 4 },
          ],
        },
        {
          id: 'wb2',
          points: [
            { x: 2, y: 4 },
            { x: 4, y: 4 },
          ],
        },
      ],
      ground: { x: 0, y: 4 },
    };
    const outcome = computeThevenin(doc, 'r2');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // V_th = i·R1 = 2 V (sin carga, toda la corriente pasa por R1); R_th = R1 = 1 kΩ.
    expect(outcome.result.vTh).toBeCloseTo(2, 6);
    expect(outcome.result.rTh).toBeCloseTo(1000, 3);
    expect(outcome.result.iN).toBeCloseTo(0.002, 9);
  });
});
