import { describe, expect, it } from 'vitest';
import { errorEnEstadoEstacionario, type SteadyStateInput } from './error-en-estado-estacionario';

const solve = (input: Partial<SteadyStateInput>) =>
  errorEnEstadoEstacionario.solve({ forward: '1/(s+1)', feedback: '1', amplitude: 1, ...input });

function ok(input: Partial<SteadyStateInput>) {
  const r = solve(input);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('error en estado estacionario', () => {
  it('el ejemplo cumple el schema', () => {
    expect(
      errorEnEstadoEstacionario.inputSchema.safeParse(errorEnEstadoEstacionario.example).success,
    ).toBe(true);
  });

  // Kuo, 7.ª ed., ejemplos 7-2(a) y 7-3: G(s) = K(s + 3.15)/[s(s + 1.5)(s + 0.5)], tipo 1:
  // e_escalón = 0, e_rampa = R/(4.2K) y e_parábola = ∞ (válido para 0 < K < 1.3043). Con K = 1.
  it('Kuo, ejemplos 7-2(a) y 7-3: tipo 1, e_rampa = R/(4.2K)', () => {
    const r = ok({ forward: '(s + 3.15)/(s(s + 1.5)(s + 0.5))' });
    expect(r.value.type).toBe(1);
    expect(r.value.kp).toBe(Infinity);
    expect(r.value.kv).toBeCloseTo(4.2, 10);
    expect(r.value.ka).toBe(0);
    expect(r.value.errors.step).toBe(0);
    expect(r.value.errors.ramp).toBeCloseTo(1 / 4.2, 10);
    expect(r.value.errors.parabola).toBe(Infinity);
  });

  // Kuo, ejemplo 7-2(b): G(s) = K/[s²(s + 12)] es inestable para todo K: el análisis no tiene
  // sentido (con K = 1).
  it('Kuo, ejemplo 7-2(b): lazo cerrado inestable', () => {
    const r = solve({ forward: '1/(s^2 (s + 12))' });
    expect(!r.ok && r.error.code).toBe('lazo-cerrado-inestable');
  });

  // Kuo, ejemplos 7-2(c) y 7-4: G(s) = 5(s + 1)/[s²(s + 12)(s + 5)], tipo 2 y estable:
  // K_a = 5/60 = 1/12, e_parábola = 12R; M(s) = 5(s + 1)/(s⁴ + 17s³ + 60s² + 5s + 5).
  it('Kuo, ejemplos 7-2(c) y 7-4: tipo 2, e_parábola = 12R', () => {
    const r = ok({ forward: '5(s + 1)/(s^2 (s + 12)(s + 5))', amplitude: 2 });
    expect(r.value.type).toBe(2);
    expect(r.value.ka).toBeCloseTo(1 / 12, 10);
    expect(r.value.errors.step).toBe(0);
    expect(r.value.errors.ramp).toBe(0);
    expect(r.value.errors.parabola).toBeCloseTo(24, 8);
  });

  // Kuo, ejemplo 7-5: G(s) = 1/[s²(s + 12)], H(s) = 5(s + 1)/(s + 5), K_H = 1. La salida ante la
  // rampa unitaria tiende a t − 0.8 (ec. 7-57): e_rampa = 0.8; ante el escalón, 0; ante la
  // parábola, la salida tiende a 0.5t² − 0.8t − 11.2: el error crece sin límite.
  it('Kuo, ejemplo 7-5: realimentación no unitaria, e_rampa = 0.8', () => {
    const r = ok({ forward: '1/(s^2 (s + 12))', feedback: '5(s + 1)/(s + 5)' });
    expect(r.value.unity).toBe(false);
    expect(r.value.errors.step).toBeCloseTo(0, 10);
    expect(r.value.errors.ramp).toBeCloseTo(0.8, 10);
    expect(r.value.errors.parabola).toBe(Infinity);
  });

  // Ogata, 3.ª ed., sec. 5-10 (tabla 5-2): un sistema de tipo 0 tiene error de posición 1/(1 + K) y
  // error de velocidad infinito. El caso numérico no es del libro: con G(s) = 10/(s + 1) la fórmula
  // da K_p = 10 y e = 1/11 (a mano).
  it('Ogata, sec. 5-10: tipo 0, e_escalón = 1/(1 + K_p)', () => {
    const r = ok({ forward: '10/(s + 1)' });
    expect(r.value.type).toBe(0);
    expect(r.value.kp).toBeCloseTo(10, 10);
    expect(r.value.errors.step).toBeCloseTo(1 / 11, 10);
    expect(r.value.errors.ramp).toBe(Infinity);
    expect(r.series.length).toBe(2);
  });

  it('errores de entrada', () => {
    const bad = solve({ forward: 's^^2' });
    expect(!bad.ok && bad.error.code).toBe('funcion-invalida');
    const singular = solve({ forward: '1/(s + 1)', feedback: '1/s' });
    expect(!singular.ok && singular.error.code).toBe('realimentacion-singular');
  });
});
