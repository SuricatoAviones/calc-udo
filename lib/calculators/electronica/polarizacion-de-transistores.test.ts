import { describe, expect, it } from 'vitest';
import {
  polarizacionDeTransistores,
  solveBias,
  type BiasInput,
} from './polarizacion-de-transistores';

const base = polarizacionDeTransistores.example;

function bjt(input: Partial<BiasInput>) {
  const result = solveBias({ ...base, device: 'bjt', ...input });
  if (!result.ok || result.value.device !== 'bjt') throw new Error('se esperaba un BJT');
  return result.value;
}

function fet(input: Partial<BiasInput>) {
  const result = solveBias({ ...base, ...input });
  if (!result.ok || result.value.device !== 'fet') throw new Error('se esperaba un FET');
  return { value: result.value, result };
}

describe('BJT (Boylestad y Nashelsky, 10.ª ed. en español, cap. 4)', () => {
  it('ejemplos 4.1 y 4.2: polarización fija → I_B = 47.08 µA, I_C = 2.35 mA, V_CE = 6.83 V, I_C(sat) = 5.45 mA', () => {
    const v = bjt({ bjtConfig: 'fija', vcc: 12, rb: 240e3, rc: 2.2e3, beta: 50, vbe: 0.7 });
    expect(v.ib * 1e6).toBeCloseTo(47.08, 2);
    expect(v.ic * 1e3).toBeCloseTo(2.35, 2);
    // El libro resta con I_C redondeada a 2.35 mA: 12 − 5.17 = 6.83 V; sin redondear da 6.82 V.
    expect(v.vce).toBeCloseTo(6.83, 1);
    expect(v.vb).toBeCloseTo(0.7, 10);
    expect(v.vbc).toBeCloseTo(-6.13, 1);
    expect(v.icSat * 1e3).toBeCloseTo(5.45, 2);
    expect(v.region).toBe('activa');
  });

  it('ejemplo 4.4: polarización de emisor → I_B = 40.1 µA, I_C = 2.01 mA, V_CE = 13.97 V', () => {
    const v = bjt({
      bjtConfig: 'emisor',
      vcc: 20,
      rb: 430e3,
      rc: 2e3,
      re: 1e3,
      beta: 50,
      vbe: 0.7,
    });
    expect(v.ib * 1e6).toBeCloseTo(40.1, 1);
    expect(v.ic * 1e3).toBeCloseTo(2.01, 2);
    expect(v.vce).toBeCloseTo(13.97, 1);
    expect(v.vc).toBeCloseTo(15.98, 1);
    expect(v.ve).toBeCloseTo(2.01, 1);
    expect(v.vb).toBeCloseTo(2.71, 1);
  });

  it('ejemplo 4.8: divisor exacto → I_B = 8.38 µA, I_C = 0.84 mA, V_CE = 12.34 V', () => {
    const v = bjt({});
    expect(v.ib * 1e6).toBeCloseTo(8.38, 2);
    expect(v.ic * 1e3).toBeCloseTo(0.84, 2);
    // El libro usa I_C = 0.84 mA ya redondeada; con 0.8384 mA da 12.36 V.
    expect(v.vce).toBeCloseTo(12.34, 1);
    expect(v.approxValid).toBe(true);
  });

  it('ejemplo 4.9: divisor aproximado → I_C = 0.867 mA, V_CE = 12.03 V', () => {
    const v = bjt({ method: 'aproximado' });
    expect(v.ic * 1e3).toBeCloseTo(0.867, 3);
    expect(v.vce).toBeCloseTo(12.03, 2);
  });

  it('ejemplo 4.10: con β = 50 → I_B = 16.24 µA, I_C = 0.81 mA, V_CE = 12.69 V', () => {
    const v = bjt({ beta: 50 });
    expect(v.ib * 1e6).toBeCloseTo(16.24, 1);
    expect(v.ic * 1e3).toBeCloseTo(0.81, 2);
    expect(v.vce).toBeCloseTo(12.69, 1);
  });

  it('ejemplo 4.11: βR_E < 10R₂ → exacto 1.98 mA y 4.54 V; aproximado 2.59 mA', () => {
    const circuit = {
      bjtConfig: 'divisor',
      vcc: 18,
      r1: 82e3,
      r2: 22e3,
      rc: 5.6e3,
      re: 1.2e3,
      beta: 50,
    } as const;
    const exact = bjt({ ...circuit, method: 'exacto' });
    expect(exact.approxValid).toBe(false);
    expect(exact.ib * 1e6).toBeCloseTo(39.6, 1);
    expect(exact.ic * 1e3).toBeCloseTo(1.98, 2);
    expect(exact.vce).toBeCloseTo(4.54, 1);
    const approx = solveBias({ ...base, ...circuit, method: 'aproximado' });
    if (!approx.ok || approx.value.device !== 'bjt') throw new Error();
    expect(approx.value.ic * 1e3).toBeCloseTo(2.59, 2);
    // Errata del libro: imprime V_CE = 3.88 V, pero su propia sustitución da
    // 18 V − (2.59 mA)(5.6 kΩ + 1.2 kΩ) = 0.39 V (con la misma fórmula, el exacto sí da 4.54 V).
    expect(approx.value.vce).toBeCloseTo(0.39, 1);
    expect(approx.notices.some((x) => x.level === 'warning')).toBe(true);
  });

  it('ejemplos 4.12 y 4.13: realimentación del colector con β = 90 y β = 135', () => {
    const circuit = {
      bjtConfig: 'realimentacion',
      vcc: 10,
      rb: 250e3,
      rc: 4.7e3,
      re: 1.2e3,
    } as const;
    const v90 = bjt({ ...circuit, beta: 90 });
    expect(v90.ib * 1e6).toBeCloseTo(11.91, 2);
    expect(v90.ic * 1e3).toBeCloseTo(1.07, 2);
    expect(v90.vce).toBeCloseTo(3.69, 1);
    const v135 = bjt({ ...circuit, beta: 135 });
    expect(v135.ib * 1e6).toBeCloseTo(8.89, 2);
    expect(v135.ic * 1e3).toBeCloseTo(1.2, 2);
    expect(v135.vce).toBeCloseTo(2.92, 1);
  });

  it('detecta la saturación (caso construido: R_B pequeña; I_C(sat) = 12 V/2.2 kΩ)', () => {
    // No viene del libro: con R_B = 10 kΩ, βI_B = 56.5 mA supera I_C(sat) = 5.45 mA.
    const v = bjt({ bjtConfig: 'fija', vcc: 12, rb: 10e3, rc: 2.2e3, beta: 50 });
    expect(v.region).toBe('saturacion');
    expect(v.vce).toBe(0);
    expect(v.ic * 1e3).toBeCloseTo(5.4545, 3);
  });
});

describe('FET (Boylestad y Nashelsky, 10.ª ed. en español, cap. 7)', () => {
  it('ejemplo 7.1: JFET con polarización fija → I_D = 5.625 mA, V_DS = 4.75 V', () => {
    const { value } = fet({
      device: 'jfet',
      fetConfig: 'fija',
      vdd: 16,
      vgg: 2,
      rd: 2e3,
      idss: 10e-3,
      vp: -8,
    });
    expect(value.vgs).toBe(-2);
    expect(value.id * 1e3).toBeCloseTo(5.625, 10);
    expect(value.vds).toBeCloseTo(4.75, 10);
    expect(value.vs).toBe(0);
    // El libro no comprueba la región, pero V_DS = 4.75 V < V_GS − V_P = −2 − (−8) = 6 V (el lugar
    // geométrico del estrangulamiento de su sec. 6.2, fig. 6.11): el punto queda en la región
    // óhmica y la calculadora lo avisa.
    expect(value.region).toBe('ohmica');
  });

  it('ejemplo 7.2: autopolarización → V_GS = −2.588 V, I_D = 2.588 mA (solución de Mathcad) y V_DS ≈ 8.82 V', () => {
    const { value } = fet({
      device: 'jfet',
      fetConfig: 'autopolarizacion',
      vdd: 20,
      rd: 3.3e3,
      rs: 1e3,
      idss: 8e-3,
      vp: -6,
    });
    expect(value.vgs).toBeCloseTo(-2.588, 3);
    expect(value.id * 1e3).toBeCloseTo(2.588, 3);
    // La solución gráfica del libro (I_D = 2.6 mA) da 8.82 V; con 2.588 mA queda 8.87 V.
    expect(value.vds).toBeCloseTo(8.82, 0);
    expect(value.vs).toBeCloseTo(2.6, 1);
  });

  it('ejemplo 7.4: divisor de voltaje → V_G = 1.82 V, I_D = 2.4 mA, V_GS = −1.8 V (solución gráfica)', () => {
    const { value, result } = fet({ device: 'jfet', fetConfig: 'divisor' });
    expect(value.vg).toBeCloseTo(1.82, 2);
    expect(value.id * 1e3).toBeCloseTo(2.4, 1);
    expect(value.vgs).toBeCloseTo(-1.8, 1);
    expect(value.vds).toBeCloseTo(6.64, 0);
    expect(result.tables[0]!.rows).toHaveLength(4);
  });

  it('ejemplos 7.6 y 7.7: MOSFET de empobrecimiento → 3.1 mA y −0.8 V; con R_S = 150 Ω, 7.6 mA y +0.35 V', () => {
    const circuit = {
      device: 'mosfet-empobrecimiento',
      fetConfig: 'divisor',
      vdd: 18,
      rg1: 110e6,
      rg2: 10e6,
      rd: 1.8e3,
      idss: 6e-3,
      vp: -3,
    } as const;
    const a = fet({ ...circuit, rs: 750 }).value;
    expect(a.vg).toBeCloseTo(1.5, 10);
    expect(a.id * 1e3).toBeCloseTo(3.1, 1);
    expect(a.vgs).toBeCloseTo(-0.8, 0);
    expect(a.vds).toBeCloseTo(10.1, 0);
    const b = fet({ ...circuit, rs: 150 }).value;
    expect(b.id * 1e3).toBeCloseTo(7.6, 1);
    expect(b.vgs).toBeCloseTo(0.35, 1);
    expect(b.id).toBeGreaterThan(6e-3);
  });

  it('ejemplo 7.10: MOSFET de enriquecimiento con realimentación → k = 0.24 mA/V², I_D ≈ 2.75 mA, V_GS = V_DS = 6.4 V', () => {
    const { value } = fet({
      device: 'mosfet-enriquecimiento',
      fetConfig: 'realimentacion',
      vdd: 12,
      rd: 2e3,
      idOn: 6e-3,
      vgsOn: 8,
      vt: 3,
    });
    expect(value.k * 1e3).toBeCloseTo(0.24, 10);
    // Solución gráfica: 2.75 mA; la ecuación de segundo grado da 2.79 mA.
    expect(value.id * 1e3).toBeCloseTo(2.75, 0);
    expect(value.vgs).toBeCloseTo(6.4, 1);
    expect(value.vds).toBeCloseTo(value.vgs, 10);
  });

  it('ejemplo 7.11: MOSFET de enriquecimiento con divisor → V_G = 18 V, I_D = 6.7 mA, V_GS = 12.5 V, V_DS = 14.4 V', () => {
    const { value } = fet({
      device: 'mosfet-enriquecimiento',
      fetConfig: 'divisor',
      vdd: 40,
      rg1: 22e6,
      rg2: 18e6,
      rd: 3e3,
      rs: 0.82e3,
      idOn: 3e-3,
      vgsOn: 10,
      vt: 5,
    });
    expect(value.vg).toBeCloseTo(18, 10);
    expect(value.k * 1e3).toBeCloseTo(0.12, 10);
    expect(value.id * 1e3).toBeCloseTo(6.7, 1);
    expect(value.vgs).toBeCloseTo(12.5, 1);
    expect(value.vds).toBeCloseTo(14.4, 0);
  });

  it('valida la configuración según el dispositivo', () => {
    const schema = polarizacionDeTransistores.inputSchema;
    expect(schema.safeParse({ ...base, device: 'jfet', fetConfig: 'realimentacion' }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ ...base, device: 'mosfet-enriquecimiento', fetConfig: 'autopolarizacion' })
        .success,
    ).toBe(false);
    expect(schema.safeParse({ ...base, device: 'jfet', vp: 4 }).success).toBe(false);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(polarizacionDeTransistores.inputSchema.safeParse(base).success).toBe(true);
    expect(polarizacionDeTransistores.solve(base).ok).toBe(true);
  });
});
