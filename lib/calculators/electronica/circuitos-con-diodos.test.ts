import { describe, expect, it } from 'vitest';
import { circuitosConDiodos, solveDiode, type DiodeInput } from './circuitos-con-diodos';

const base: DiodeInput = {
  source: 10,
  resistance: 500,
  orientation: 'directa',
  model: 'segunda',
  vk: 0.7,
  rb: 0,
  is: 10e-12,
  n: 1.5,
  vt: 0.026,
};

function solved(input: Partial<DiodeInput>) {
  const result = solveDiode({ ...base, ...input });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('circuitos con diodos', () => {
  it('Boylestad y Nashelsky, 10.ª ed., ejemplo 2.3 (ideal): E = 10 V, R = 0.5 kΩ → I_D = 20 mA', () => {
    const value = solved({ model: 'ideal' });
    expect(value.id).toBeCloseTo(0.02, 12);
    expect(value.vd).toBe(0);
  });

  it('Boylestad, ejemplo 2.2 (modelo aproximado de silicio): V_DQ = 0.7 V, I_DQ ≈ 18.5 mA', () => {
    // El libro lee 18.5 mA en la gráfica; (10 − 0.7)/0.5 kΩ = 18.6 mA.
    const value = solved({});
    expect(value.vd).toBe(0.7);
    expect(value.id * 1000).toBeCloseTo(18.6, 10);
  });

  it('Boylestad, sec. 2.2 (Mathcad, fig. 2.7): Shockley con I_S = 10 pA y nV_T = 39 mV → 18.336 mA, 0.8319 V', () => {
    const value = solved({ model: 'real' });
    expect(value.id * 1000).toBeCloseTo(18.336, 3);
    expect(value.vd).toBeCloseTo(0.831853, 5);
  });

  it('Boylestad, ejemplo 2.4: E = 8 V, R = 2.2 kΩ (Si) → V_R = 7.3 V, I_D = 3.32 mA', () => {
    const value = solved({ source: 8, resistance: 2200 });
    expect(value.vr).toBeCloseTo(7.3, 10);
    expect(value.id * 1000).toBeCloseTo(3.32, 2);
  });

  it('Boylestad, ejemplo 2.5: con el diodo invertido, I_D = 0 y toda la fuente queda en el diodo', () => {
    // La calculadora mide V_D de ánodo a cátodo (−8 V); el libro marca la polaridad al revés y
    // escribe V_D = E = 8 V.
    const value = solved({ source: 8, resistance: 2200, orientation: 'inversa' });
    expect(value.conducting).toBe(false);
    expect(value.id).toBe(0);
    expect(value.vd).toBe(-8);
  });

  it('Boylestad, ejemplo 2.6: E = 0.5 V no enciende el diodo de silicio', () => {
    const value = solved({ source: 0.5, resistance: 1200 });
    expect(value.conducting).toBe(false);
    expect(value.vr).toBe(0);
    expect(value.vd).toBe(0.5);
  });

  it('Boylestad, ejemplo 2.7: silicio + LED (V_K = 0.7 + 1.8 V), E = 12 V, R = 680 Ω → 13.97 mA', () => {
    const value = solved({ source: 12, resistance: 680, vk: 2.5 });
    expect(value.vr).toBeCloseTo(9.5, 10);
    expect(value.id * 1000).toBeCloseTo(13.97, 2);
  });

  it('Malvino, 6.ª ed., ejemplo 3-6 (segunda aproximación): 9.3 V, 9.3 mA y 6.51 mW', () => {
    const value = solved({ source: 10, resistance: 1000 });
    expect(value.vr).toBeCloseTo(9.3, 10);
    expect(value.pd * 1000).toBeCloseTo(6.51, 10);
  });

  it('Malvino, ejemplo 3-9 (tercera aproximación): R_L = 10 Ω, r_B = 0.23 Ω → 0.909 A, V_L = 9.09 V', () => {
    const value = solved({ source: 10, resistance: 10, model: 'tercera', rb: 0.23 });
    expect(value.id).toBeCloseTo(0.909, 3);
    expect(value.vr).toBeCloseTo(9.09, 2);
    expect(value.vd).toBeCloseTo(0.909, 3);
  });

  it('Malvino, ejemplo 3-8: si r_B < 0.01·R se puede ignorar', () => {
    const result = solveDiode({
      ...base,
      source: 10,
      resistance: 1000,
      model: 'tercera',
      rb: 0.23,
    });
    expect(result.notices.some((n) => n.message.includes('1 %'))).toBe(true);
    if (!result.ok) return;
    // 9.3 V/1000.23 Ω: prácticamente los 9.3 mA de la segunda aproximación.
    expect(result.value.id * 1000).toBeCloseTo(9.3, 2);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    const calc = circuitosConDiodos;
    expect(calc.inputSchema.safeParse(calc.example).success).toBe(true);
    expect(calc.solve(calc.example).ok).toBe(true);
  });
});
