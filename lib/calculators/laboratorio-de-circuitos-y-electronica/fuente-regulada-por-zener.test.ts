import { describe, expect, it } from 'vitest';
import { maxSeriesResistance } from '../electronica/zener';
import {
  fuenteReguladaPorZener,
  solveZenerSupply,
  type ZenerSupplyInput,
} from './fuente-regulada-por-zener';

const base = fuenteReguladaPorZener.example;

function solved(input: Partial<ZenerSupplyInput>) {
  const result = solveZenerSupply({ ...base, ...input });
  if (!result.ok) throw new Error('no debería fallar');
  return result;
}

describe('fuente regulada por Zener (Malvino, 6.ª ed. en español, ejemplo 5-9, fig. 5-13)', () => {
  it('secundario de 21.2 V de pico y 19.8 V en el filtro', () => {
    const { value } = solved({});
    expect(value.vp2).toBeCloseTo(21.2, 1);
    expect(value.vp).toBeCloseTo(19.8, 1);
  });

  it('51 mA por la resistencia de 390 Ω, 36 mA por R_S y 87 mA desde el condensador', () => {
    const { value } = solved({});
    // I_S = (19.8 − 10)/270 = 36.3 mA y I_dren = 19.8/390 = 50.8 mA.
    expect((value.idc - value.vp / 390) * 1e3).toBeCloseTo(36, 0);
    expect((value.vp / 390) * 1e3).toBeCloseTo(51, 0);
    expect(value.idc * 1e3).toBeCloseTo(87, 0);
  });

  it('rizado de unos 2.7 V pp en el filtro, que varía de 19.8 a 17.1 V con media de 18.5 V', () => {
    const { value } = solved({});
    expect(value.vrpp).toBeCloseTo(2.7, 1);
    expect(value.vmin).toBeCloseTo(17.1, 1);
    expect(value.vdc).toBeCloseTo(18.5, 1);
  });

  it('rizado a la salida del regulador de unos 85 mV pp', () => {
    const { value } = solved({});
    expect(value.vrOut! * 1e3).toBeCloseTo(85, -1);
    expect(value.zenerOn).toBe(true);
    expect(value.regulates).toBe(true);
  });

  it('presenta las secciones de la fuente en una tabla', () => {
    const result = solved({});
    expect(result.tables[0]!.rows.map((r) => r.section)).toContain('Regulador');
  });

  it('detecta la pérdida de regulación con una R_S demasiado grande (caso construido)', () => {
    // No viene del libro: con R_S = 2.2 kΩ, R_S(máx) = (17.1/10 − 1)(1 kΩ) ≈ 0.7 kΩ.
    const result = solved({ rs: 2200 });
    expect(result.value.regulates).toBe(false);
    expect(result.notices.some((x) => x.level === 'warning')).toBe(true);
  });

  it('falla sin tensión si el secundario no vence a los diodos', () => {
    const result = solveZenerSupply({ ...base, v1rms: 1, ratio: 10 });
    expect(result.ok).toBe(false);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(fuenteReguladaPorZener.inputSchema.safeParse(base).success).toBe(true);
    expect(fuenteReguladaPorZener.solve(base).ok).toBe(true);
  });
});

describe('punto límite de funcionamiento (Malvino, sec. 5-4)', () => {
  it('ejemplo 5-10: V_S de 22 a 30 V, V_Z = 12 V y R_L desde 140 Ω → R_S(máx) = 117 Ω', () => {
    expect(maxSeriesResistance(22, 12, 140).rsMax).toBeCloseTo(117, 0);
  });

  it('ejemplo 5-11: V_S de 15 a 20 V, I_L hasta 20 mA y V_Z = 6.8 V → R_S(máx) = 410 Ω', () => {
    // Ec. (5-10) con R_L(mín) = V_Z/I_L(máx) = 340 Ω.
    expect(maxSeriesResistance(15, 6.8, 6.8 / 0.02).rsMax).toBeCloseTo(410, 6);
  });
});
