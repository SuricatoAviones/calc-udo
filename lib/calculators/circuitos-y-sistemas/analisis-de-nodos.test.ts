import { describe, expect, it } from 'vitest';
import { analisisDeNodos, solveNodal } from './analisis-de-nodos';

describe('analisis-de-nodos', () => {
  it('resuelve el ejemplo predeterminado', () => {
    const result = solveNodal(analisisDeNodos.example);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const v1 = result.value.branchResults.find((b) => b.label === 'V1');
    const r1 = result.value.branchResults.find((b) => b.label === 'R1');
    expect(v1?.i).toBeCloseTo(-2, 6);
    expect(r1?.i).toBeCloseTo(2, 6);
  });

  it('detecta circuito vacío', () => {
    const result = solveNodal({ components: [], wires: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('circuito-vacio');
  });
});
