import { describe, expect, it } from 'vitest';
import {
  respuestaPrimerOrden,
  solveFirstOrder,
  type FirstOrderInput,
} from './respuesta-primer-orden';

function solved(input: FirstOrderInput) {
  const result = solveFirstOrder(input);
  if (!result.ok) throw new Error('no debería fallar');
  return result.value;
}

describe('circuitos de primer orden', () => {
  it('Hayt, Kemmerly y Durbin, 8.ª ed., ejemplo 8.10 (RC): v_C = 20 + 80e^{−t/1.2} V', () => {
    // R_eq = 10 ∥ 50 ∥ 200 … = 24 Ω, C = 50 mF, v_C(0) = 100 V y v_C(∞) = 20 V.
    const value = solved({
      circuit: 'rc',
      resistance: 24,
      storage: 0.05,
      initial: 100,
      final: 20,
      time: 1.2,
    });
    expect(value.tau).toBeCloseTo(1.2, 12);
    expect(value.tex).toBe('20 + 80e^{-0.833333t}');
    expect(value.atTime!.x).toBeCloseTo(20 + 80 * Math.exp(-1), 12);
    // i_C = C dv/dt = −(80/24)e^{−t/1.2} A.
    expect(value.atTime!.other).toBeCloseTo((-80 / 24) * Math.exp(-1), 12);
  });

  it('Hayt, ejemplo 8.8 (RL): i = 50 − 25e^{−0.5t} A', () => {
    // R_eq = 1.5 Ω, L = 3 H (τ = 2 s), i(0) = 25 A e i(∞) = 50 A.
    const value = solved({ circuit: 'rl', resistance: 1.5, storage: 3, initial: 25, final: 50 });
    expect(value.tau).toBeCloseTo(2, 12);
    expect(value.tex).toBe('50 - 25e^{-0.5t}');
  });

  it('Hayt, ejemplo 8.2 (RL sin fuente): i_L = 2.4e^{−10t} A', () => {
    // 10 Ω + 40 Ω con 5 H: τ = 0.1 s. El libro pide v = −40 i_L en t = 0.2 s: −12.99 V.
    const value = solved({
      circuit: 'rl',
      resistance: 50,
      storage: 5,
      initial: 2.4,
      final: 0,
      time: 0.2,
    });
    expect(value.tex).toBe('2.4e^{-10t}');
    expect(-40 * value.atTime!.x).toBeCloseTo(-12.99, 2);
  });

  it('Hayt, ejemplo 8.7: i = 12 mA(1 − e^{−20000t}) vale 10.38 mA a los 100 µs', () => {
    const value = solved({
      circuit: 'rl',
      resistance: 1000,
      storage: 0.05,
      initial: 0,
      final: 0.012,
      time: 1e-4,
    });
    expect(value.tau).toBeCloseTo(5e-5, 15);
    expect(value.atTime!.x * 1000).toBeCloseTo(10.38, 2);
  });

  it('la tabla muestra el 63.2 % del cambio en una constante de tiempo', () => {
    const result = solveFirstOrder({
      circuit: 'rc',
      resistance: 1,
      storage: 1,
      initial: 0,
      final: 10,
    });
    if (!result.ok) return;
    expect(result.tables[0]!.rows[1]!.avance as number).toBeCloseTo(63.2, 1);
    expect(result.tables[0]!.rows[5]!.avance as number).toBeCloseTo(99.3, 1);
  });

  it('valida los datos', () => {
    const schema = respuestaPrimerOrden.inputSchema;
    expect(
      schema.safeParse({ circuit: 'rc', resistance: 0, storage: 1, initial: 0, final: 1 }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ circuit: 'rl', resistance: 1, storage: -1, initial: 0, final: 1 }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ circuit: 'rl', resistance: 1, storage: 1, initial: 0, final: 1, time: -1 })
        .success,
    ).toBe(false);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    const calc = respuestaPrimerOrden;
    expect(calc.inputSchema.safeParse(calc.example).success).toBe(true);
    expect(calc.solve(calc.example).ok).toBe(true);
  });
});
