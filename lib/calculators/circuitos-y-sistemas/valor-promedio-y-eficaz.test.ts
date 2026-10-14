import { describe, expect, it } from 'vitest';
import {
  solveAverageRms,
  valorPromedioYEficaz,
  type AverageRmsInput,
} from './valor-promedio-y-eficaz';

function solved(segments: AverageRmsInput['segments'], extra: Partial<AverageRmsInput> = {}) {
  const result = solveAverageRms({ quantity: 'voltaje', segments, ...extra });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('valor promedio y valor eficaz', () => {
  it('Dorf y Svoboda, 9.ª ed., ejemplo 11.4-1: diente de sierra → I_ef = I_m/√3', () => {
    // I_m = 6 A y T = 2 s: i = 3t. El promedio es I_m/2 = 3 A.
    const value = solved([{ end: '2', expression: '3t' }], {
      quantity: 'corriente',
      resistance: 10,
    });
    expect(value.average).toBeCloseTo(3, 10);
    expect(value.rms).toBeCloseTo(6 / Math.sqrt(3), 10);
    expect(value.power).toBeCloseTo((6 / Math.sqrt(3)) ** 2 * 10, 8);
  });

  it('Hayt, Kemmerly y Durbin, 8.ª ed., sec. 11.3: una senoide de amplitud I_m tiene I_ef = I_m/√2', () => {
    const value = solved([{ end: '2*pi/377', expression: '10cos(377t + 0.3)' }]);
    expect(value.average).toBeCloseTo(0, 10);
    expect(value.rms).toBeCloseTo(10 / Math.SQRT2, 10);
  });

  it('Hayt, problema de práctica 11.7: valores eficaces 4.24, 6.16, 5.23 y 6.82 V', () => {
    expect(solved([{ end: '2*pi/25', expression: '6cos(25t)' }]).rms).toBeCloseTo(4.24, 2);
    expect(
      solved([{ end: '2*pi/25', expression: '6cos(25t) + 4sin(25t + pi/6)' }]).rms,
    ).toBeCloseTo(6.16, 2);
    expect(solved([{ end: '2*pi/25', expression: '6cos(25t) + 5cos(25t)^2' }]).rms).toBeCloseTo(
      5.23,
      2,
    );
    // 25 y 30 rad/s se repiten juntas cada 2π/5 s.
    expect(solved([{ end: '2*pi/5', expression: '6cos(25t) + 5sin(30t) + 4' }]).rms).toBeCloseTo(
      6.82,
      2,
    );
  });

  it('onda cuadrada por tramos: ±5 V → promedio 0 y eficaz 5 V', () => {
    // Caso analítico: f² = 25 en todo el periodo.
    const value = solved([
      { end: '1', expression: '5' },
      { end: '2', expression: '-5' },
    ]);
    expect(value.average).toBeCloseTo(0, 12);
    expect(value.rms).toBeCloseTo(5, 12);
  });

  it('valida los tramos', () => {
    const schema = valorPromedioYEficaz.inputSchema;
    expect(
      schema.safeParse({
        quantity: 'voltaje',
        segments: [
          { end: '2', expression: '1' },
          { end: '1', expression: '0' },
        ],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ quantity: 'voltaje', segments: [{ end: 'x', expression: '1' }] }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ quantity: 'voltaje', segments: [{ end: '1', expression: 'ln(' }] })
        .success,
    ).toBe(false);
  });

  it('una integral que no converge se informa', () => {
    const result = solveAverageRms({
      quantity: 'voltaje',
      segments: [{ end: '1', expression: '1/t' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('integral-no-converge');
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    const calc = valorPromedioYEficaz;
    expect(calc.inputSchema.safeParse(calc.example).success).toBe(true);
    expect(calc.solve(calc.example).ok).toBe(true);
  });
});
