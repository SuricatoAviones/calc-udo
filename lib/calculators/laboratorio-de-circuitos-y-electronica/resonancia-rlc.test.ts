import { describe, expect, it } from 'vitest';
import { abs, div, ONE } from '@/lib/math/complex';
import { angleDeg, resonanciaRlc, solveResonance, type ResonanceInput } from './resonancia-rlc';

const base = resonanciaRlc.example;

function solved(input: Partial<ResonanceInput>) {
  const result = solveResonance({ ...base, ...input });
  if (!result.ok) throw new Error('no debería fallar');
  return result.value;
}

describe('RLC paralelo (Hayt, Kemmerly y Durbin, 8.ª ed. en inglés, sec. 16.1 y 16.2)', () => {
  it('práctica 16.1: R = 8 kΩ, L = 50 mH, C = 80 nF → ω₀ = 15.811 krad/s, Q₀ = 10.12, ω_d = 15.792 krad/s, α = 781 Np/s, ζ = 0.0494', () => {
    const v = solved({
      type: 'paralelo',
      r: 8e3,
      l: 50e-3,
      c: 80e-9,
      freq: undefined,
      source: undefined,
    });
    expect(v.w0 / 1e3).toBeCloseTo(15.811, 3);
    expect(v.q0).toBeCloseTo(10.12, 2);
    expect(v.wd / 1e3).toBeCloseTo(15.792, 3);
    expect(v.alpha).toBeCloseTo(781, 0);
    expect(v.zeta).toBeCloseTo(0.0494, 4);
  });

  it('ejemplo 16.1: L = 2 mH, C = 10 nF, Q₀ = 5 → R = 2.236 kΩ, ω₀ = 223.6 krad/s y |Y| en 0.9ω₀, ω₀ y 1.1ω₀', () => {
    const circuit = {
      type: 'paralelo',
      r: 2236.068,
      l: 2e-3,
      c: 10e-9,
      freqUnit: 'rad/s',
    } as const;
    const v = solved({ ...circuit, freq: undefined });
    expect(v.w0 / 1e3).toBeCloseTo(223.6, 1);
    expect(v.q0).toBeCloseTo(5, 4);
    const y = (factor: number) => abs(div(ONE, solved({ ...circuit, freq: factor * v.w0 }).zAt!));
    // El libro evalúa con ω₀ redondeada a 223.6 krad/s; las diferencias quedan en la cuarta cifra.
    expect(y(0.9) * 1e4).toBeCloseTo(6.504, 2);
    expect(y(1) * 1e4).toBeCloseTo(4.472, 3);
    expect(y(1.1) * 1e4).toBeCloseTo(6.182, 2);
  });

  it('ejemplo 16.2: R = 40 kΩ, L = 1 H, C = 1/64 µF → Q₀ = 5, B = 1600 rad/s, ω₁ ≈ 7200 y ω₂ ≈ 8800; en 8200 rad/s, Y = 25.75 µS ∠13.87° (aprox. 25.77 µS ∠14.04°)', () => {
    const v = solved({
      type: 'paralelo',
      r: 40e3,
      l: 1,
      c: 1e-6 / 64,
      freq: 8200,
      freqUnit: 'rad/s',
      source: undefined,
    });
    expect(v.w0).toBeCloseTo(8000, 6);
    expect(v.q0).toBeCloseTo(5, 10);
    expect(v.bw).toBeCloseTo(1600, 6);
    expect(v.w1Approx).toBeCloseTo(7200, 6);
    expect(v.w2Approx).toBeCloseTo(8800, 6);
    expect(v.n!).toBeCloseTo(0.25, 10);
    const y = div(ONE, v.zAt!);
    expect(abs(y) * 1e6).toBeCloseTo(25.75, 2);
    expect(angleDeg(y)).toBeCloseTo(13.87, 2);
    const yApprox = div(ONE, v.zApprox!);
    expect(abs(yApprox) * 1e6).toBeCloseTo(25.77, 2);
    expect(angleDeg(yApprox)).toBeCloseTo(14.04, 2);
  });

  it('práctica 16.3: f₀ = 440 Hz y Q₀ = 6 → f₁ = 404.9 Hz y f₂ = 478.2 Hz (aprox. 403.3 y 476.7 Hz)', () => {
    // El libro da solo f₀ y Q₀; se usa un RLC paralelo con esos valores (C = 1 µF, L = 1/(ω₀²C), R = Q₀/(ω₀C)).
    const w0 = 2 * Math.PI * 440;
    const c = 1e-6;
    const v = solved({
      type: 'paralelo',
      c,
      l: 1 / (w0 * w0 * c),
      r: 6 / (w0 * c),
      freq: undefined,
    });
    const hz = (w: number) => w / (2 * Math.PI);
    expect(hz(v.w1)).toBeCloseTo(404.9, 1);
    expect(hz(v.w2)).toBeCloseTo(478.2, 1);
    expect(hz(v.w1Approx)).toBeCloseTo(403.3, 1);
    expect(hz(v.w2Approx)).toBeCloseTo(476.7, 1);
  });
});

describe('RLC serie (Hayt, sec. 16.3)', () => {
  it('ejemplo 16.3: 10 Ω, 200 nF, 2 mH y 100 mV a 48 krad/s → ω₀ = 50 krad/s, Q₀ = 10, N = −0.8; |I| = 7.746 mA (aprox. 7.806 mA)', () => {
    const v = solved({});
    expect(v.w0).toBeCloseTo(50e3, 6);
    expect(v.q0).toBeCloseTo(10, 10);
    expect(v.bw).toBeCloseTo(5e3, 6);
    expect(v.n!).toBeCloseTo(-0.8, 10);
    expect(abs(v.zApprox!)).toBeCloseTo(12.81, 2);
    expect(angleDeg(v.zApprox!)).toBeCloseTo(-38.66, 2);
    // 7.7453 mA; el libro redondea a 7.746 mA.
    expect(abs(v.response!) * 1e3).toBeCloseTo(7.746, 2);
    expect(angleDeg(v.response!)).toBeCloseTo(39.24, 2);
    // El libro divide entre |Z| redondeada a 12.81 Ω; con 12.806 Ω da 7.809 mA.
    expect((0.1 / abs(v.zApprox!)) * 1e3).toBeCloseTo(7.806, 2);
  });

  it('práctica 16.4: L = 20 mH, C = 2 µF, B = 100 Hz → f₀ = 796 Hz, Q₀ = 7.96, Z = 12.57 Ω, f₂ ≈ 846 Hz', () => {
    // R sale de B = R/L: R = 2π(100)(0.02) = 12.57 Ω, la respuesta (c) del libro.
    const v = solved({ r: 12.566, l: 20e-3, c: 2e-6, freq: undefined, source: undefined });
    expect(v.f0).toBeCloseTo(796, 0);
    expect(v.q0).toBeCloseTo(7.96, 2);
    expect(v.z0.re).toBeCloseTo(12.57, 2);
    expect(v.z0.im).toBeCloseTo(0, 8);
    expect(v.w2Approx / (2 * Math.PI)).toBeCloseTo(846, 0);
  });
});

describe('paralelo práctico (Hayt, sec. 16.4)', () => {
  it('ejemplo 16.4: R₁ = 2 Ω, L = 1 H, C = 125 mF, R₂ = 3 Ω → ω₀ = 2 rad/s, Z = 1.714 Ω; máximo 1.980 Ω en ω_m = 3.26 rad/s', () => {
    const v = solved({
      type: 'paralelo-practico',
      rl: 2,
      l: 1,
      c: 0.125,
      r: 3,
      freq: 1 / Math.sqrt(0.125),
      source: undefined,
    });
    expect(v.w0).toBeCloseTo(2, 10);
    expect(v.z0.re).toBeCloseTo(1.714, 3);
    expect(v.z0.im).toBeCloseTo(0, 8);
    // En 1/√(LC) = 2.83 rad/s: Z = 1.947 Ω ∠−13.26°.
    expect(abs(v.zAt!)).toBeCloseTo(1.947, 3);
    expect(angleDeg(v.zAt!)).toBeCloseTo(-13.26, 2);
    expect(v.wm!).toBeCloseTo(3.26, 2);
    expect(v.zMax!).toBeCloseTo(1.98, 3);
    // "La Q de la combinación bobina-resistencia a 2 rad/s es la unidad."
    expect(v.qCoil!).toBeCloseTo(1, 10);
  });

  it('ejemplo 16.5: 100 mH con 5 Ω a 1000 rad/s → Q = 20 y R_p ≈ Q²R_s = 2 kΩ', () => {
    // El ejemplo no tiene condensador; se elige C para que la resonancia caiga en 1000 rad/s
    // (1/(LC) = ω₀² + (R/L)²). La ecuación exacta (22) da R_p = R_s(1 + Q²) = 5(401) = 2005 Ω.
    const v = solved({
      type: 'paralelo-practico',
      rl: 5,
      l: 0.1,
      c: 1 / (0.1 * (1000 ** 2 + 2500)),
      r: undefined,
      freq: undefined,
    });
    expect(v.w0).toBeCloseTo(1000, 6);
    expect(v.qCoil!).toBeCloseTo(20, 10);
    expect(v.z0.re).toBeCloseTo(2005, 6);
  });

  it('rechaza un paralelo práctico sin resonancia', () => {
    expect(
      resonanciaRlc.inputSchema.safeParse({ ...base, type: 'paralelo-practico', rl: 1000 }).success,
    ).toBe(false);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(resonanciaRlc.inputSchema.safeParse(base).success).toBe(true);
    expect(resonanciaRlc.solve(base).ok).toBe(true);
  });
});
