import { describe, expect, it } from 'vitest';
import {
  filtroYRegulacion,
  solveFilterRegulation,
  type FilterRegulationInput,
  type FilterRegulationValue,
} from './filtro-y-regulacion';

const base = filtroYRegulacion.example;

function solved(input: Partial<FilterRegulationInput>): FilterRegulationValue {
  const result = solveFilterRegulation({ ...base, ...input });
  if (!result.ok) throw new Error('no debería fallar');
  return result.value;
}

function filter(input: Partial<FilterRegulationInput>) {
  const value = solved({ part: 'filtro', ...input });
  if (value.part !== 'filtro') throw new Error('se esperaba el filtro');
  return value;
}

describe('filtro con condensador', () => {
  it('Boylestad y Nashelsky, 10.ª ed., ejemplos 15.3 y 15.4: 100 µF, 50 mA → V_r(rms) = 1.2 V y V_cd = 27.9 V', () => {
    const value = filter({});
    expect(value.vrrms).toBeCloseTo(1.2, 2);
    expect(value.vdc).toBeCloseTo(27.9, 1);
  });

  it('Boylestad, ejemplo 15.5: rizo de 4.3 %', () => {
    // El enunciado dice C = 50 µF, pero la solución usa los 100 µF y 27.9 V del ejemplo 15.4.
    expect(filter({}).ripple * 100).toBeCloseTo(4.3, 1);
  });

  it('Malvino, 6.ª ed., ejemplo 4-6: media onda, 34 V de pico, 5 kΩ y 100 µF → 1.13 V pp', () => {
    const value = filter({ rectifier: 'media-onda', vm: 34, load: 'resistencia', rl: 5000 });
    expect(value.idc * 1000).toBeCloseTo(6.8, 10);
    expect(value.vrpp).toBeCloseTo(1.13, 2);
  });

  it('Malvino, ejemplos 4-7 y 4-8: derivación central (17 V) → 0.283 V pp; puente (34 V) → 0.566 V pp', () => {
    expect(filter({ vm: 17, load: 'resistencia', rl: 5000 }).vrpp).toBeCloseTo(0.283, 3);
    // 6.8 mA/(120 Hz·100 µF) = 0.5667 V, que el libro trunca a 0.566 V.
    expect(filter({ vm: 34, load: 'resistencia', rl: 5000 }).vrpp).toBeCloseTo(0.566, 2);
  });
});

describe('regulador Zener', () => {
  it('Boylestad, ejemplo 2.26a: con R_L = 1.2 kΩ el Zener está apagado y V_L = 8.73 V', () => {
    const value = solved({ part: 'zener', zenerCase: 'fijo', vi: 16, rs: 1000, rl: 1200, vz: 10 });
    if (value.part !== 'zener' || value.case !== 'fijo') throw new Error();
    expect(value.on).toBe(false);
    expect(value.vl).toBeCloseTo(8.73, 2);
  });

  it('Boylestad, ejemplo 2.26b: con R_L = 3 kΩ → V_L = 10 V, I_Z = 2.67 mA y P_Z = 26.7 mW < 30 mW', () => {
    const result = solveFilterRegulation({
      ...base,
      part: 'zener',
      zenerCase: 'fijo',
      vi: 16,
      rs: 1000,
      rl: 3000,
      vz: 10,
      pzm: 0.03,
    });
    if (!result.ok || result.value.part !== 'zener' || result.value.case !== 'fijo')
      throw new Error();
    const value = result.value;
    expect(value.vl).toBe(10);
    expect(value.ir * 1000).toBeCloseTo(6, 10);
    expect(value.il * 1000).toBeCloseTo(3.33, 2);
    expect(value.iz * 1000).toBeCloseTo(2.67, 2);
    expect(value.pz * 1000).toBeCloseTo(26.7, 1);
    expect(result.notices[0]!.level).toBe('info');
  });

  it('Boylestad, ejemplo 2.27: V_i = 50 V, R = 1 kΩ, V_Z = 10 V, I_ZM = 32 mA → 250 Ω ≤ R_L ≤ 1.25 kΩ', () => {
    const value = solved({
      part: 'zener',
      zenerCase: 'rl-variable',
      vi: 50,
      rs: 1000,
      vz: 10,
      izm: 0.032,
    });
    if (value.part !== 'zener' || value.case !== 'rl-variable') throw new Error();
    expect(value.rlMin).toBeCloseTo(250, 10);
    expect(value.ir * 1000).toBeCloseTo(40, 10);
    expect(value.ilMin * 1000).toBeCloseTo(8, 10);
    expect(value.rlMax).toBeCloseTo(1250, 8);
    expect(value.pMax * 1000).toBeCloseTo(320, 10);
  });

  it('Boylestad, ejemplo 2.28: R_L = 1.2 kΩ, R = 220 Ω, V_Z = 20 V, I_ZM = 60 mA → 23.67 V ≤ V_i ≤ 36.87 V', () => {
    const value = solved({
      part: 'zener',
      zenerCase: 'vi-variable',
      rl: 1200,
      rs: 220,
      vz: 20,
      izm: 0.06,
    });
    if (value.part !== 'zener' || value.case !== 'vi-variable') throw new Error();
    expect(value.viMin).toBeCloseTo(23.67, 2);
    expect(value.il * 1000).toBeCloseTo(16.67, 2);
    expect(value.viMax).toBeCloseTo(36.87, 2);
  });

  it('Malvino, ejemplo 5-8: R_S = 270 Ω, R_Z = 8.5 Ω y 2 V de rizado → unos 63 mV a la salida', () => {
    const value = solved({
      part: 'zener',
      zenerCase: 'fijo',
      vi: 20,
      rs: 270,
      rl: 1000,
      vz: 10,
      rz: 8.5,
      vrin: 2,
    });
    if (value.part !== 'zener' || value.case !== 'fijo') throw new Error();
    expect(value.rippleOut! * 1000).toBeCloseTo(63, 0);
  });

  it('valida que V_i supere a V_Z', () => {
    expect(
      filtroYRegulacion.inputSchema.safeParse({ ...base, part: 'zener', vi: 5, vz: 10 }).success,
    ).toBe(false);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(filtroYRegulacion.inputSchema.safeParse(base).success).toBe(true);
    expect(filtroYRegulacion.solve(base).ok).toBe(true);
  });
});
