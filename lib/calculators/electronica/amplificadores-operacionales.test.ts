import { describe, expect, it } from 'vitest';
import {
  amplificadoresOperacionales,
  solveOpAmp,
  type OpAmpInput,
} from './amplificadores-operacionales';

const base = amplificadoresOperacionales.example;

function solved(input: Partial<OpAmpInput>) {
  const result = solveOpAmp({ ...base, ...input });
  if (!result.ok) throw new Error('no debería fallar');
  return result;
}

function linear(input: Partial<OpAmpInput>) {
  const { value } = solved(input);
  if (value.kind !== 'lineal') throw new Error('se esperaba un circuito lineal');
  return value;
}

describe('circuitos lineales (Boylestad y Nashelsky, 10.ª ed. en español)', () => {
  it('ejemplo 10.5: inversor, R₁ = 100 kΩ, R_f = 500 kΩ, V₁ = 2 V → V_o = −10 V', () => {
    const v = linear({});
    expect(v.gain).toBeCloseTo(-5, 10);
    expect(v.vo).toBeCloseTo(-10, 10);
  });

  it('ejemplo 10.6: no inversor con los mismos valores → V_o = 12 V', () => {
    expect(linear({ circuit: 'no-inversor' }).vo).toBeCloseTo(12, 10);
  });

  it('ejemplo 11.1: inversor con R_f = 200 kΩ, R₁ = 2 kΩ y 2.5 mV → A = −100 y V_o = −250 mV', () => {
    const v = linear({ rf: 200e3, r1: 2e3, v1: 2.5e-3 });
    expect(v.gain).toBeCloseTo(-100, 10);
    expect(v.vo).toBeCloseTo(-0.25, 10);
  });

  it('ejemplo 11.2: no inversor con R_f = 240 kΩ y R₁ = 2.4 kΩ, 120 mV → A = 101 y V_o = 12.12 V', () => {
    // Errata: el libro escribe 12.12 mV; 101 × 120 mV = 12.12 V.
    const v = linear({ circuit: 'no-inversor', rf: 240e3, r1: 2.4e3, v1: 0.12 });
    expect(v.gain).toBeCloseTo(101, 10);
    expect(v.vo).toBeCloseTo(12.12, 10);
  });

  it('ejemplo 10.7: sumador con R_f = 1 MΩ → a) −7 V; b) +3 V', () => {
    expect(
      linear({ circuit: 'sumador', rf: 1e6, v1: 1, r1: 500e3, v2: 2, r2: 1e6, v3: 3, r3: 1e6 }).vo,
    ).toBeCloseTo(-7, 10);
    expect(
      linear({ circuit: 'sumador', rf: 1e6, v1: -2, r1: 200e3, v2: 3, r2: 500e3, v3: 1, r3: 1e6 })
        .vo,
    ).toBeCloseTo(3, 10);
  });

  it('ejemplo 11.6: sumador de dos entradas, 330 kΩ/33 kΩ y 330 kΩ/10 kΩ → V_o = −(10V₁ + 33V₂)', () => {
    // En el pico de cada senoidal: 50 mV y 10 mV → −(0.5 + 0.33) V.
    const v = linear({ circuit: 'sumador', rf: 330e3, r1: 33e3, r2: 10e3, v1: 0.05, v2: 0.01 });
    expect(v.vo).toBeCloseTo(-0.83, 10);
  });

  it('ejemplo 11.8: restador con R₁ = R₃ = 20 kΩ y R₂ = R₄ = 100 kΩ → V_o = V₁ − V₂', () => {
    const v = linear({
      circuit: 'diferencial',
      r1: 20e3,
      r3: 20e3,
      r2: 100e3,
      r4: 100e3,
      v1: 3,
      v2: 1.2,
    });
    expect(v.vo).toBeCloseTo(1.8, 10);
  });

  it('el seguidor copia la entrada y la salida se recorta en ±V_sat', () => {
    // Ecuación (10.10); el recorte es la definición de V_sat (Malvino, sec. 22-1), no un ejemplo del libro.
    expect(linear({ circuit: 'seguidor', v1: -3.5 }).vo).toBe(-3.5);
    const result = solved({ vsat: 13.5, v1: 4 });
    expect(result.value).toMatchObject({ kind: 'lineal', vo: -13.5, saturated: true });
    expect(result.notices[0]!.level).toBe('warning');
  });
});

describe('circuitos no lineales (Malvino, 6.ª ed. en español, cap. 22)', () => {
  it('ejemplos 22-4 y 22-5: referencia de 5 V y senoidal de 10 V de pico → ciclo de trabajo 33.3 %', () => {
    const { value } = solved({ circuit: 'comparador', vsat: 5, vref: 5, v1: 7, vp: 10 });
    if (value.kind !== 'comparador') throw new Error();
    expect(value.vo).toBe(5);
    expect(value.duty!).toBeCloseTo(0.333, 3);
  });

  it('ejemplo 22-6: Schmitt inversor con 1 kΩ y 47 kΩ y V_sat = 13.5 V → PCS = 0.281 V, PCI = −0.281 V, H = 0.562 V', () => {
    // El libro escribe "1 kΩ/40 kΩ", pero su B = 0.0208 es 1 kΩ/48 kΩ, como en la figura 22-21.
    const { value } = solved({
      circuit: 'schmitt',
      mode: 'inversor',
      r1: 1e3,
      r2: 47e3,
      vsat: 13.5,
    });
    if (value.kind !== 'schmitt') throw new Error();
    expect(value.b!).toBeCloseTo(0.0208, 4);
    expect(value.pcs).toBeCloseTo(0.281, 3);
    expect(value.pci).toBeCloseTo(-0.281, 3);
    expect(value.h).toBeCloseTo(0.562, 2);
  });

  it('Schmitt no inversor: PCS = (R₁/R₂)V_sat (Malvino, ecs. 22-10 y 22-11)', () => {
    // Sin ejemplo numérico en el libro; se verifica la ecuación con R₁/R₂ = 1/10 y V_sat = 13.5 V.
    const { value } = solved({
      circuit: 'schmitt',
      mode: 'no-inversor',
      r1: 10e3,
      r2: 100e3,
      vsat: 13.5,
    });
    if (value.kind !== 'schmitt') throw new Error();
    expect(value.pcs).toBeCloseTo(1.35, 10);
    expect(value.h).toBeCloseTo(2.7, 10);
  });

  it('pide V_sat para el comparador', () => {
    expect(
      amplificadoresOperacionales.inputSchema.safeParse({ ...base, circuit: 'comparador' }).success,
    ).toBe(false);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(amplificadoresOperacionales.inputSchema.safeParse(base).success).toBe(true);
    expect(amplificadoresOperacionales.solve(base).ok).toBe(true);
  });
});
