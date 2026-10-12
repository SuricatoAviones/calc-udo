import { describe, expect, it } from 'vitest';
import { analisisDeNodos, solveNodal } from './analisis-de-nodos';

describe('analisis-de-nodos', () => {
  it('resuelve el ejemplo predeterminado', () => {
    const result = solveNodal(analisisDeNodos.example);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r1 = result.value.branchResults.find((b) => b.label === 'R1');
    const r2 = result.value.branchResults.find((b) => b.label === 'R2');
    const i1 = result.value.branchResults.find((b) => b.label === 'I1');
    expect(r1?.i).toBeCloseTo(0.0006667, 7);
    expect(r2?.i).toBeCloseTo(0.0003333, 7);
    expect(i1?.i).toBeCloseTo(0.001, 9);
    expect(result.value.branchResults.reduce((s, b) => s + b.p, 0)).toBeCloseTo(0, 9);
  });

  it('detecta circuito vacío', () => {
    const result = solveNodal({ circuit: { components: [], wires: [] } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('circuito-vacio');
  });
});
