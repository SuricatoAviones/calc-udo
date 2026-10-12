import { describe, expect, it } from 'vitest';
import { buildTopology, type CircuitDocument } from './circuit';
import { solveMesh } from './mesh';
import { solveMna } from './mna';

/**
 * Los valores esperados de estos casos se contrastaron con el análisis nodal del mismo circuito
 * (implementado y probado en `mna.test.ts`): ambas técnicas resuelven el mismo circuito lineal, así
 * que las corrientes de rama deben coincidir. No provienen de un ejemplo de libro.
 */
function branchCurrents(doc: CircuitDocument): Record<string, number> {
  const topology = buildTopology(doc);
  const mna = solveMna(topology);
  if (!mna.ok) throw new Error('MNA no resolvió el circuito de contraste');
  const out: Record<string, number> = {};
  for (const b of mna.result.branchResults) out[b.label] = b.i;
  return out;
}

function expectSameBranches(doc: CircuitDocument) {
  const mesh = solveMesh(doc);
  expect(mesh.ok).toBe(true);
  if (!mesh.ok) return;
  const expected = branchCurrents(doc);
  for (const b of mesh.result.branchResults) {
    expect(b.i).toBeCloseTo(expected[b.label]!, 6);
  }
}

describe('solveMesh', () => {
  it('resuelve una malla única (fuente y dos resistencias en serie)', () => {
    const doc: CircuitDocument = {
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
        { id: 'r2', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, value: 3, label: 'R2' },
      ],
      wires: [
        {
          id: 'w',
          points: [
            { x: 0, y: 4 },
            { x: 4, y: 4 },
          ],
        },
      ],
      ground: { x: 0, y: 4 },
    };
    const mesh = solveMesh(doc);
    expect(mesh.ok).toBe(true);
    if (!mesh.ok) return;
    expect(mesh.result.meshes).toHaveLength(1);
    // i = E / (R1 + R2) = 10 / 5 = 2 A.
    expect(Math.abs(mesh.result.meshCurrents[0]!)).toBeCloseTo(2, 6);
    expectSameBranches(doc);
  });

  it('resuelve dos mallas con una rama compartida', () => {
    const doc: CircuitDocument = {
      components: [
        {
          id: 'v1',
          kind: 'voltage-source',
          a: { x: 0, y: 0 },
          b: { x: 0, y: 4 },
          value: 10,
          label: 'V1',
        },
        { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, value: 2, label: 'R1' },
        { id: 'r2', kind: 'resistor', a: { x: 2, y: 0 }, b: { x: 4, y: 0 }, value: 4, label: 'R2' },
        { id: 'r3', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, value: 4, label: 'R3' },
        { id: 'r4', kind: 'resistor', a: { x: 2, y: 0 }, b: { x: 2, y: 4 }, value: 4, label: 'R4' },
      ],
      wires: [
        {
          id: 'w1',
          points: [
            { x: 0, y: 4 },
            { x: 2, y: 4 },
          ],
        },
        {
          id: 'w2',
          points: [
            { x: 2, y: 4 },
            { x: 4, y: 4 },
          ],
        },
      ],
      ground: { x: 0, y: 4 },
    };
    const mesh = solveMesh(doc);
    expect(mesh.ok).toBe(true);
    if (!mesh.ok) return;
    expect(mesh.result.meshes).toHaveLength(2);
    const r4 = mesh.result.branchResults.find((b) => b.label === 'R4');
    expect(r4?.i).toBeCloseTo(10 / 7, 6); // v_T = 40/7 V; i = v_T / 4
    const r2 = mesh.result.branchResults.find((b) => b.label === 'R2');
    expect(r2?.i).toBeCloseTo(5 / 7, 6); // (v_T − v_TR) / 4
    expectSameBranches(doc);
  });

  it('resuelve una malla con fuente de corriente (supermalla)', () => {
    const doc: CircuitDocument = {
      components: [
        {
          id: 'i1',
          kind: 'current-source',
          a: { x: 0, y: 0 },
          b: { x: 0, y: 4 },
          value: 2,
          label: 'I1',
        },
        { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, value: 3, label: 'R1' },
        { id: 'r2', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, value: 2, label: 'R2' },
      ],
      wires: [
        {
          id: 'w',
          points: [
            { x: 0, y: 4 },
            { x: 4, y: 4 },
          ],
        },
      ],
      ground: { x: 0, y: 4 },
    };
    const mesh = solveMesh(doc);
    expect(mesh.ok).toBe(true);
    if (!mesh.ok) return;
    // La fuente impone 2 A en la malla; la tensión de la fuente debe ser E = 2·(3+2) = 10 V.
    const i1 = mesh.result.branchResults.find((b) => b.label === 'I1');
    const r1 = mesh.result.branchResults.find((b) => b.label === 'R1');
    expect(i1?.i).toBeCloseTo(2, 6);
    expect(Math.abs(r1?.i ?? 0)).toBeCloseTo(2, 6);
    expect(Math.abs(i1?.v ?? 0)).toBeCloseTo(10, 6);
    expectSameBranches(doc);
  });

  it('detecta que no hay mallas', () => {
    const doc: CircuitDocument = {
      components: [
        {
          id: 'v1',
          kind: 'voltage-source',
          a: { x: 0, y: 0 },
          b: { x: 0, y: 4 },
          value: 10,
          label: 'V1',
        },
        { id: 'r1', kind: 'resistor', a: { x: 0, y: 4 }, b: { x: 4, y: 4 }, value: 5, label: 'R1' },
      ],
      wires: [],
      ground: { x: 0, y: 4 },
    };
    const mesh = solveMesh(doc);
    expect(mesh.ok).toBe(false);
    if (mesh.ok) return;
    expect(mesh.code).toBe('sin-mallas');
  });

  it('detecta una rama colgante', () => {
    const doc: CircuitDocument = {
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
        { id: 'r2', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, value: 3, label: 'R2' },
        // Rama colgante: R3 comparte el vértice (4,0) pero su otro extremo queda libre.
        { id: 'r3', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 6, y: 0 }, value: 9, label: 'R3' },
      ],
      wires: [
        {
          id: 'w',
          points: [
            { x: 0, y: 4 },
            { x: 4, y: 4 },
          ],
        },
      ],
      ground: { x: 0, y: 4 },
    };
    const mesh = solveMesh(doc);
    expect(mesh.ok).toBe(false);
    if (mesh.ok) return;
    expect(mesh.code).toBe('rama-colgante');
  });
});
