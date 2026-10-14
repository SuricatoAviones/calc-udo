import { describe, expect, it } from 'vitest';
import * as C from '@/lib/math/complex';
import { potenciaEnCa, solvePower, type PowerInput } from './potencia-en-ca';

const base: PowerInput = {
  given: 'vi',
  values: 'amplitud',
  vMag: 1,
  vAngle: 0,
  iMag: 1,
  iAngle: 0,
  resistance: 1,
  reactance: 0,
  omega: 1,
};

function solved(input: Partial<PowerInput>) {
  const result = solvePower({ ...base, ...input });
  if (!result.ok) throw new Error('no debería fallar');
  return result.value;
}

describe('potencia en circuitos senoidales', () => {
  it('Hayt, Kemmerly y Durbin, 8.ª ed., ejemplo 11.8: 60∠0° V ef. sobre 3 + j4 Ω', () => {
    // El libro: I = 12∠−53.13° A ef., P = 288 + 144 = 432 W, |S| = 720 VA y FP = 0.6.
    const value = solved({ given: 'vz', values: 'eficaz', vMag: 60, resistance: 3, reactance: 4 });
    expect(C.abs(value.iRms)).toBeCloseTo(12, 10);
    expect(C.degrees(C.arg(value.iRms))).toBeCloseTo(-53.13, 2);
    expect(value.average).toBeCloseTo(432, 9);
    expect(value.apparent).toBeCloseTo(720, 9);
    expect(value.powerFactor).toBeCloseTo(0.6, 12);
    expect(value.reactive).toBeCloseTo(576, 9);
    expect(value.character).toBe('atrasado');
  });

  it('Hayt, ejemplo 11.3: I = 5∠20° A (amplitud) en Z = 8 − j11 Ω → P = 100 W', () => {
    const value = solved({ given: 'iz', iMag: 5, iAngle: 20, resistance: 8, reactance: -11 });
    expect(value.average).toBeCloseTo(100, 10);
    expect(value.character).toBe('adelantado');
  });

  it('Hayt, ejemplo 11.4: la fuente de 20∠0° V con I₁ = 5 − j10 A entrega 50 W', () => {
    const value = solved({
      vMag: 20,
      iMag: Math.hypot(5, 10),
      iAngle: C.degrees(Math.atan2(-10, 5)),
    });
    expect(value.average).toBeCloseTo(50, 10);
    expect(value.complexPower.re).toBeCloseTo(50, 10);
    expect(value.complexPower.im).toBeCloseTo(100, 10);
  });

  it('carga resistiva: FP unitario y Q = 0', () => {
    const value = solved({ vMag: 10, iMag: 2 });
    expect(value.powerFactor).toBeCloseTo(1, 12);
    expect(value.reactive).toBeCloseTo(0, 12);
    expect(value.character).toBe('unitario');
  });

  it('valida los datos según lo conocido', () => {
    const schema = potenciaEnCa.inputSchema;
    expect(schema.safeParse({ ...base, given: 'vz', resistance: 0, reactance: 0 }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...base, vMag: 0 }).success).toBe(false);
    expect(schema.safeParse({ ...base, given: 'iz', vMag: 0 }).success).toBe(true);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(potenciaEnCa.inputSchema.safeParse(potenciaEnCa.example).success).toBe(true);
    expect(potenciaEnCa.solve(potenciaEnCa.example).ok).toBe(true);
  });
});
