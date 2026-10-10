import { describe, expect, it } from 'vitest';
import { relacionesVip, solveRelacionesVip } from './relaciones-v-i-p';

describe('relaciones-v-i-p', () => {
  it('calcula corriente en un capacitor dado el voltaje', () => {
    const result = solveRelacionesVip({
      component: 'capacitor',
      known: 'voltage',
      expression: '10*sin(t)',
      value: 0.5,
      tEnd: 5,
      samples: 400,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.iExpr).toContain('5');
    expect(result.summary).toEqual(
      expect.arrayContaining([
        { label: 'i(0)', value: expect.stringContaining('5'), emphasis: undefined },
      ]),
    );
  });

  it('calcula voltaje en un inductor dado la corriente', () => {
    const result = solveRelacionesVip({
      component: 'inductor',
      known: 'current',
      expression: '2*t',
      value: 3,
      tEnd: 5,
      samples: 400,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // v(t) = L * di/dt = 3 * 2 = 6 V
    const v0 = result.value.series.points[0]?.y ?? NaN;
    expect(v0).toBeCloseTo(6, 6);
  });

  it('calcula potencia en una resistencia dado el voltaje', () => {
    const result = solveRelacionesVip({
      component: 'resistor',
      known: 'voltage',
      expression: '10',
      value: 5,
      tEnd: 5,
      samples: 400,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // i = 2 A, p = 20 W
    expect(result.value.series.others?.find((s) => s.label === 'p(t)')?.points[0]?.y).toBeCloseTo(
      20,
      6,
    );
  });

  it('rechaza una expresión inválida', () => {
    const result = solveRelacionesVip({
      component: 'resistor',
      known: 'voltage',
      expression: 'esto no es válido',
      value: 1,
      tEnd: 5,
      samples: 400,
    });
    expect(result.ok).toBe(false);
  });

  it('el ejemplo predeterminado es resoluble', () => {
    const result = solveRelacionesVip(relacionesVip.example);
    expect(result.ok).toBe(true);
  });
});
