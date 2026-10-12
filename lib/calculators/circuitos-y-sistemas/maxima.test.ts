import { describe, expect, it } from 'vitest';
import { maximaTransferenciaDePotencia, solveMaxPower } from './maxima-transferencia-de-potencia';

describe('solveMaxPower', () => {
  it('calcula la carga óptima y la potencia máxima del ejemplo', () => {
    const result = solveMaxPower(maximaTransferenciaDePotencia.example);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.vTh).toBeCloseTo(10, 6);
    expect(result.value.rTh).toBeCloseTo(5, 6);
    expect(result.value.pMax).toBeCloseTo(5, 6);
    expect(result.value.loadPower).toBeCloseTo((10 / 15) ** 2 * 10, 6);
    expect(result.series).toHaveLength(1);
    expect(result.series[0]!.scatter?.points[0]).toEqual({ x: 5, y: 5 });
  });

  it('falla si la carga no es resistiva', () => {
    const result = solveMaxPower({ ...maximaTransferenciaDePotencia.example, load: 'v1' });
    expect(result.ok).toBe(false);
  });
});
