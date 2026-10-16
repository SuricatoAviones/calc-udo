import { describe, expect, it } from 'vitest';
import {
  amplificadorEmisorComun,
  solveCeAmplifier,
  type CeAmplifierInput,
} from './amplificador-emisor-comun';

const base = amplificadorEmisorComun.example;

function solved(input: Partial<CeAmplifierInput>) {
  const result = solveCeAmplifier({ ...base, ...input });
  if (!result.ok) throw new Error('no debería fallar');
  return result;
}

describe('amplificador emisor común (Boylestad y Nashelsky, 10.ª ed. en español)', () => {
  it('ejemplo 5.2: I_E = 1.41 mA, r_e = 18.44 Ω, Z_i = 1.35 kΩ, Z_o = 6.8 kΩ, A_v = −368.76', () => {
    const { value } = solved({});
    // El libro redondea V_B a 2.81 V e I_E a 1.41 mA; sin redondear, I_E = 1.407 mA y r_e = 18.48 Ω.
    expect(value.ie * 1e3).toBeCloseTo(1.41, 2);
    expect(value.re).toBeCloseTo(18.44, 0);
    expect(value.zi / 1e3).toBeCloseTo(1.35, 2);
    expect(value.zo / 1e3).toBeCloseTo(6.8, 10);
    expect(value.av).toBeCloseTo(-368.76, -1);
  });

  it('ejemplo 5.2e: con r_o = 50 kΩ → Z_o = 5.98 kΩ y A_v = −324.3', () => {
    const { value } = solved({ ro: 50e3 });
    expect(value.zo / 1e3).toBeCloseTo(5.98, 1);
    expect(value.av).toBeCloseTo(-324.3, -1);
  });

  it('ejemplo 5.5: R_E = 0.68 kΩ sin puentear, β = 210 → r_e = 19.64 Ω, Z_i = 8.47 kΩ, Z_o = 2.2 kΩ', () => {
    const circuit = { vcc: 16, r1: 90e3, r2: 10e3, rc: 2.2e3, beta: 210 };
    const { value } = solved({ ...circuit, re1: 0.68e3, re2: 0 });
    expect(value.re).toBeCloseTo(19.64, 1);
    expect(value.zi / 1e3).toBeCloseTo(8.47, 1);
    expect(value.zo / 1e3).toBeCloseTo(2.2, 10);
    // El libro aproxima A_v ≈ −R_C/R_E = −3.24; con Z_b = βr_e + (β + 1)R_E queda −3.13.
    expect(value.av).toBeCloseTo(-3.24, 0);
  });

  it('ejemplo 5.6: la misma red con C_E → Z_b = 4.12 kΩ, Z_i = 2.83 kΩ, A_v = −112.02', () => {
    const { value } = solved({
      vcc: 16,
      r1: 90e3,
      r2: 10e3,
      rc: 2.2e3,
      beta: 210,
      re1: 0,
      re2: 0.68e3,
    });
    expect(value.zi / 1e3).toBeCloseTo(2.83, 2);
    expect(value.av).toBeCloseTo(-112.02, 1);
  });
});

describe('recta de carga de ca y MPP (Malvino, 6.ª ed. en español, sec. 11-2)', () => {
  // Fig. 11-7: 10 V, R₁ = 10 kΩ, R₂ = 2.2 kΩ, R_C = 3.6 kΩ, R_E = 1 kΩ puenteada, R_L = 10 kΩ.
  const fig117 = {
    vcc: 10,
    r1: 10e3,
    r2: 2.2e3,
    rc: 3.6e3,
    re1: 0,
    re2: 1e3,
    rl: 10e3,
    beta: 100,
    vt: 0.025,
  };

  it('ejemplos 11-1 y 11-2: I_CQ = 1.1 mA, V_CEQ = 4.94 V, r_c = 2.65 kΩ, MPP = 5.84 V', () => {
    const { value } = solved(fig117);
    expect(value.ic * 1e3).toBeCloseTo(1.1, 1);
    // El libro resta con I_CQ redondeada a 1.1 mA; con 1.103 mA queda 4.93 V.
    expect(value.vce).toBeCloseTo(4.94, 1);
    expect(value.rcAc / 1e3).toBeCloseTo(2.65, 2);
    expect(value.mpp).toBeCloseTo(5.84, 1);
  });

  it('ejemplo 11-3: con R_E = 750 Ω → I_CQ = 1.47 mA, V_CEQ = 3.61 V y MPP = 7.22 V', () => {
    const { value } = solved({ ...fig117, re2: 750 });
    expect(value.ic * 1e3).toBeCloseTo(1.47, 2);
    expect(value.vce).toBeCloseTo(3.61, 1);
    expect(value.mpp).toBeCloseTo(7.22, 1);
  });

  it('avisa si la señal amplificada supera el MPP (caso construido con la fig. 11-7)', () => {
    // No viene del libro: A_v ≈ −106 (r_e = 22.7 Ω) y 100 mV pp darían unos 10.6 V pp > 5.84 V.
    const result = solved({ ...fig117, vin: 0.1 });
    expect(result.value.vout!).toBeGreaterThan(result.value.mpp);
    expect(result.notices.some((x) => x.level === 'warning')).toBe(true);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(amplificadorEmisorComun.inputSchema.safeParse(base).success).toBe(true);
    expect(amplificadorEmisorComun.solve(base).ok).toBe(true);
  });
});
