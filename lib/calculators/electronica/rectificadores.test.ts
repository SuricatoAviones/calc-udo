import { describe, expect, it } from 'vitest';
import { rectificadores, solveRectifier, type RectifierInput } from './rectificadores';

const base: RectifierInput = {
  type: 'media-onda',
  input: 'transformador',
  v1rms: 120,
  ratio: 10,
  vp2: 20,
  vk: 0,
  f: 60,
};

function solved(input: Partial<RectifierInput>) {
  const result = solveRectifier({ ...base, ...input });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('rectificadores', () => {
  it('Malvino, 6.ª ed., ejemplo 4-1: 10 V rms en media onda → V_p = 14.1 V y V_cd = 4.49 V (ideal)', () => {
    const value = solved({ v1rms: 10, ratio: 1 });
    expect(value.vpOut).toBeCloseTo(14.1, 1);
    expect(value.vdc).toBeCloseTo(4.49, 1);
  });

  it('Malvino, ejemplo 4-1 (segunda aproximación): 13.4 V de pico y 4.27 V de cd', () => {
    const value = solved({ v1rms: 10, ratio: 1, vk: 0.7 });
    expect(value.vpOut).toBeCloseTo(13.4, 1);
    expect(value.vdc).toBeCloseTo(4.27, 1);
  });

  it('Malvino, ejemplo 4-3: 120 V, 10:1 con derivación central → 17 V en el secundario, 8.5 V y 7.8 V a la salida', () => {
    const ideal = solved({ type: 'derivacion-central' });
    expect(ideal.vp2).toBeCloseTo(17, 0);
    expect(ideal.vpOut).toBeCloseTo(8.5, 1);
    expect(ideal.fOut).toBe(120);
    const second = solved({ type: 'derivacion-central', vk: 0.7 });
    expect(second.vpOut).toBeCloseTo(7.8, 1);
  });

  it('Malvino, ejemplo 4-5 y tabla 4-1: el puente usa todo el secundario (17 V) y resta 1.4 V', () => {
    expect(solved({ type: 'puente' }).vpOut).toBeCloseTo(17, 0);
    expect(solved({ type: 'puente', vk: 0.7 }).vpOut).toBeCloseTo(17 - 1.4, 0);
  });

  it('Boylestad y Nashelsky, 10.ª ed., ejemplo 2.16: V_m = 20 V → 6.36 V ideal y 6.14 V con silicio', () => {
    // El libro usa 0.318 ≈ 1/π (trunca a tres cifras).
    expect(solved({ input: 'pico', vp2: 20 }).vdc).toBeCloseTo(6.36, 1);
    expect(solved({ input: 'pico', vp2: 20, vk: 0.7 }).vdc).toBeCloseTo(6.14, 1);
    // Con V_m = 200 V el libro da 63.6 V y 63.38 V usando 0.318 ≈ 1/π.
    expect(Math.abs(solved({ input: 'pico', vp2: 200 }).vdc - 63.6)).toBeLessThan(0.1);
    expect(Math.abs(solved({ input: 'pico', vp2: 200, vk: 0.7 }).vdc - 63.38)).toBeLessThan(0.1);
  });

  it('Boylestad, ecs. 15.4 a 15.8: V_r(rms) = 0.385V_m (r = 121 %) y 0.308V_m (r = 48 %)', () => {
    const half = solved({ input: 'pico', vp2: 10 });
    // √(1/4 − 1/π²) = 0.3856 y √(1/2 − 4/π²) = 0.3078, que el libro redondea a 0.385 y 0.308.
    expect(half.vripple / 10).toBeCloseTo(0.385, 2);
    expect(half.rippleFactor * 100).toBeCloseTo(121, 0);
    const full = solved({ input: 'pico', vp2: 10, type: 'puente' });
    expect(full.vripple / 10).toBeCloseTo(0.308, 2);
    expect(full.rippleFactor * 100).toBeCloseTo(48, 0);
  });

  it('corriente en la carga con R_L', () => {
    // Verificación analítica: I_cd = V_cd/R_L.
    const value = solved({ input: 'pico', vp2: 20, rl: 2000 });
    expect(value.idc).toBeCloseTo(20 / Math.PI / 2000, 12);
  });

  it('sin conducción si el pico no supera las caídas de los diodos', () => {
    const result = solveRectifier({ ...base, input: 'pico', vp2: 1, type: 'puente', vk: 0.7 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sin-conduccion');
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(rectificadores.inputSchema.safeParse(rectificadores.example).success).toBe(true);
    expect(rectificadores.solve(rectificadores.example).ok).toBe(true);
  });
});
