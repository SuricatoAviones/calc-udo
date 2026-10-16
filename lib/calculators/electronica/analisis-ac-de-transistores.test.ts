import { describe, expect, it } from 'vitest';
import { analisisAcDeTransistores, solveAc, type AcInput } from './analisis-ac-de-transistores';

const base = analisisAcDeTransistores.example;

function solved(input: Partial<AcInput>) {
  const result = solveAc({ ...base, ...input });
  if (!result.ok) throw new Error('no debería fallar');
  return result.value;
}

// En los ejemplos con el modelo r_e se usa h_ie = βr_e y h_fe = β (Boylestad, sec. 5.19, fig. 5.99).
describe('modelo aproximado (Boylestad y Nashelsky, 10.ª ed. en español, cap. 5)', () => {
  it('ejemplo 5.20: polarización fija → Z_i = 1.171 kΩ, Z_o = 2.56 kΩ, A_v ≈ −262', () => {
    const v = solved({});
    expect(v.zi / 1e3).toBeCloseTo(1.171, 3);
    expect(v.zo / 1e3).toBeCloseTo(2.56, 2);
    // Errata: el libro divide entre Z_i = 1.171 kΩ en vez de h_ie = 1.175 kΩ y da −262.34; la
    // fórmula que cita (−h_fe(R_C ∥ 1/h_oe)/h_ie) da −261.6.
    expect(v.av).toBeCloseTo(-262.34, -1);
    // El libro aproxima A_i ≅ h_fe = 120; con su ec. (5.147), A_i = −A_v·Z_i/R_C = 262.34·1.171/2.7 = 113.8.
    expect(v.ai).toBeCloseTo(113.8, 0);
  });

  it('ejemplos 5.1 y 5.11: β = 100, r_e = 10.71 Ω → A_v = −280.11; con R_L = 4.7 kΩ y R_s = 0.3 kΩ, A_vL = −170.98 y A_vs = −133.5', () => {
    const circuit = { hie: 1071, hfe: 100, hoe: 0, rb: 470e3, rc: 3e3 };
    const nl = solved(circuit);
    expect(nl.zi / 1e3).toBeCloseTo(1.07, 2);
    expect(nl.zo / 1e3).toBeCloseTo(3, 10);
    expect(nl.av).toBeCloseTo(-280.11, 1);
    // Ejemplo 5.1e: con r_o = 50 kΩ → Z_o = 2.83 kΩ y A_v = −264.24 (el libro usa Z_o redondeada).
    const withRo = solved({ ...circuit, hoe: 1 / 50e3 });
    expect(withRo.zo / 1e3).toBeCloseTo(2.83, 2);
    expect(withRo.av).toBeCloseTo(-264.24, 0);
    // Ejemplos 5.11 y 5.12 (el 5.11 da A_vs = −133.54 y el 5.12, por otro camino, −133.45).
    const loaded = solved({ ...circuit, rl: 4.7e3, rs: 0.3e3 });
    expect(loaded.av).toBeCloseTo(-170.98, 1);
    expect(loaded.avNL).toBeCloseTo(-280.11, 1);
    expect(loaded.avs!).toBeCloseTo(-133.5, 0);
  });

  it('ejemplo 5.2: divisor de voltaje, β = 90, r_e = 18.44 Ω → Z_i = 1.35 kΩ, A_v = −368.76; con r_o = 50 kΩ, Z_o = 5.98 kΩ y A_v = −324.3', () => {
    const circuit = {
      bias: 'divisor',
      hie: 90 * 18.44,
      hfe: 90,
      hoe: 0,
      r1: 56e3,
      r2: 8.2e3,
      rc: 6.8e3,
    } as const;
    const v = solved(circuit);
    expect(v.zi / 1e3).toBeCloseTo(1.35, 2);
    expect(v.zo / 1e3).toBeCloseTo(6.8, 10);
    expect(v.av).toBeCloseTo(-368.76, 1);
    const withRo = solved({ ...circuit, hoe: 1 / 50e3 });
    // 6.8 kΩ ∥ 50 kΩ = 5.986 kΩ, que el libro trunca a 5.98 kΩ.
    expect(withRo.zo / 1e3).toBeCloseTo(5.98, 1);
    expect(withRo.av).toBeCloseTo(-324.3, 0);
  });

  it('ejemplo 5.3: R_E sin puentear, β = 120, r_e = 5.99 Ω → Z_i ≈ 59.34 kΩ, A_v ≈ −3.89', () => {
    // El libro aproxima Z_b ≅ β(r_e + R_E) = 67.92 kΩ; aquí se usa Z_b = h_ie + (1 + h_fe)R_E.
    const v = solved({
      config: 'emisor-sin-puentear',
      hie: 120 * 5.99,
      hfe: 120,
      hoe: 0,
      rb: 470e3,
      rc: 2.2e3,
      re: 0.56e3,
    });
    expect(v.zi / 1e3).toBeCloseTo(59.34, 0);
    expect(v.zo).toBeCloseTo(2200, 10);
    expect(v.av).toBeCloseTo(-3.89, 1);
  });

  it('ejemplo 5.5: divisor con R_E sin puentear, β = 210 → Z_i = 8.47 kΩ y Z_o = 2.2 kΩ', () => {
    const v = solved({
      config: 'emisor-sin-puentear',
      bias: 'divisor',
      hie: 210 * 19.64,
      hfe: 210,
      hoe: 0,
      r1: 90e3,
      r2: 10e3,
      rc: 2.2e3,
      re: 0.68e3,
    });
    expect(v.zi / 1e3).toBeCloseTo(8.47, 1);
    expect(v.zo).toBeCloseTo(2200, 10);
  });

  it('ejemplo 5.7: seguidor de emisor, β = 100, r_e = 12.61 Ω → Z_b = 334.56 kΩ, Z_i = 132.72 kΩ, Z_o ≈ 12.56 Ω, A_v = 0.996', () => {
    const v = solved({ config: 'seguidor', hie: 1261, hfe: 100, hoe: 0, rb: 220e3, re: 3.3e3 });
    expect(v.zb! / 1e3).toBeCloseTo(334.56, 2);
    expect(v.zi / 1e3).toBeCloseTo(132.72, 2);
    // El libro toma Z_o = R_E ∥ r_e = 12.56 Ω; con h_ie/(1 + h_fe) = 12.49 Ω queda 12.44 Ω.
    expect(v.zo).toBeCloseTo(12.56, 0);
    expect(v.av).toBeCloseTo(0.996, 3);
  });

  it('ejemplo 5.8: base común, r_e = 20 Ω y α = 0.98 → Z_i = 19.61 Ω, Z_o = 5 kΩ, A_i ≈ −0.98', () => {
    // h_ib = r_e = 20 Ω y h_fb = −α = −0.98 salen de h_fe = 49 y h_ie = 1 kΩ (apéndice A).
    const v = solved({ config: 'base-comun', hie: 1000, hfe: 49, hoe: 0, re: 1e3, rc: 5e3 });
    expect(v.zi).toBeCloseTo(19.61, 2);
    expect(v.zo).toBeCloseTo(5000, 10);
    expect(v.ai).toBeCloseTo(-0.98, 1);
  });

  it('ejemplo 5.21: base común con h_ib = 14.3 Ω, h_fb = −0.99 y h_ob = 0.5 µS → Z_i = 14.21 Ω, Z_o ≈ 3.3 kΩ, A_v ≈ 229.9', () => {
    // h_fe = 99, h_ie = 1.43 kΩ y h_oe = 50 µS dan exactamente esos parámetros en base común.
    const v = solved({
      config: 'base-comun',
      hie: 1430,
      hfe: 99,
      hoe: 50e-6,
      re: 2.2e3,
      rc: 3.3e3,
    });
    expect(v.zi).toBeCloseTo(14.21, 2);
    expect(v.zo / 1e3).toBeCloseTo(3.3, 1);
    // Errata como en el 5.20: el libro divide entre Z_i = 14.21 Ω y no entre h_ib = 14.3 Ω.
    expect(v.av).toBeCloseTo(229.91, -1);
  });
});

describe('modelo completo (Boylestad, sec. 5.21)', () => {
  it('ejemplo 5.22: emisor común → Z_i = 1.51 kΩ, A_v = −313.9, A_i = 100.55, Z_o′ = 86.66 kΩ, Z_o = 4.46 kΩ', () => {
    const v = solved({
      model: 'completo',
      hie: 1.6e3,
      hre: 2e-4,
      hfe: 110,
      hoe: 20e-6,
      rb: 470e3,
      rc: 4.7e3,
      rs: 1e3,
    });
    expect(v.ziT! / 1e3).toBeCloseTo(1.51, 1);
    expect(v.zi / 1e3).toBeCloseTo(1.51, 1);
    expect(v.av).toBeCloseTo(-313.9, 1);
    expect(v.aiT!).toBeCloseTo(100.55, 2);
    expect(v.ai).toBeCloseTo(100.55, 0);
    // El libro usa R_s = 1 kΩ en lugar de R_s ∥ R_B = 997.9 Ω.
    expect(v.zoT! / 1e3).toBeCloseTo(86.66, 0);
    expect(v.zo / 1e3).toBeCloseTo(4.46, 2);
  });

  it('ejemplo 5.23: base común con los mismos parámetros → Z_i′ = 14.60 Ω, A_v = 149.25, A_i′ = −0.991, Z_o′ = 3.39 MΩ, Z_o = 2.199 kΩ', () => {
    const v = solved({
      model: 'completo',
      config: 'base-comun',
      hie: 1.6e3,
      hre: 2e-4,
      hfe: 110,
      hoe: 20e-6,
      re: 3e3,
      rc: 2.2e3,
      rs: 1e3,
    });
    expect(v.ziT!).toBeCloseTo(14.6, 1);
    expect(v.av).toBeCloseTo(149.25, 0);
    expect(v.aiT!).toBeCloseTo(-0.991, 3);
    expect(v.zoT! / 1e6).toBeCloseTo(3.39, 1);
    expect(v.zo / 1e3).toBeCloseTo(2.199, 3);
  });

  it('rechaza el modelo completo con R_E sin puentear', () => {
    expect(
      analisisAcDeTransistores.inputSchema.safeParse({
        ...base,
        model: 'completo',
        config: 'seguidor',
      }).success,
    ).toBe(false);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(analisisAcDeTransistores.inputSchema.safeParse(base).success).toBe(true);
    expect(analisisAcDeTransistores.solve(base).ok).toBe(true);
  });
});
