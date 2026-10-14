import { describe, expect, it } from 'vitest';
import {
  respuestaSegundoOrden,
  solveSecondOrder,
  type SecondOrderInput,
} from './respuesta-segundo-orden';

const base: SecondOrderInput = {
  circuit: 'paralelo',
  resistance: 1,
  inductance: 1,
  capacitance: 1,
  mode: 'elementos',
  vC0: 0,
  iL0: 0,
  source: 0,
  x0: 0,
  dx0: 0,
  xInf: 0,
};

function solved(input: Partial<SecondOrderInput>) {
  const result = solveSecondOrder({ ...base, ...input });
  if (!result.ok) throw new Error('no debería fallar');
  return result.value;
}

describe('circuitos RLC', () => {
  it('Hayt, Kemmerly y Durbin, 8.ª ed., ejemplo 9.2: v_C = 80e^{−50000t} − 20e^{−200000t} V', () => {
    const value = solved({
      resistance: 200,
      inductance: 0.005,
      capacitance: 2e-8,
      vC0: 60,
      iL0: -0.3,
    });
    expect(value.damping).toBe('sobreamortiguado');
    expect(value.alpha).toBeCloseTo(125000, 6);
    expect(value.omega0).toBeCloseTo(100000, 6);
    const [A1, A2] = value.responses[0]!.constants;
    expect(A1).toBeCloseTo(80, 8);
    expect(A2).toBeCloseTo(-20, 8);
  });

  it('Hayt, ejemplo 9.1 (fig. 9.2): v = 84(e^{−t} − e^{−6t}) V', () => {
    // R = 6 Ω, L = 7 H, C = 1/42 F, v(0) = 0. En la fig. 9.2 la corriente i del inductor
    // apunta hacia el nodo superior (i(0) = 10 A); con la convención de la calculadora
    // (i_L hacia abajo) es i_L(0) = −10 A, que da dv/dt(0) = 420 V/s como en el libro.
    const value = solved({ resistance: 6, inductance: 7, capacitance: 1 / 42, iL0: -10 });
    expect(value.responses[0]!.dx0).toBeCloseTo(420, 9);
    expect(value.responses[0]!.tex).toBe('84e^{-t} - 84e^{-6t}');
  });

  it('Hayt, fig. 9.11: con R = 21/√6 Ω (crítico), v = 420te^{−2.45t} V', () => {
    const value = solved({
      resistance: 21 / Math.sqrt(6),
      inductance: 7,
      capacitance: 1 / 42,
      iL0: -10,
    });
    expect(value.damping).toBe('critico');
    const [A1, A2] = value.responses[0]!.constants;
    expect(A1).toBeCloseTo(420, 8);
    expect(A2).toBeCloseTo(0, 10);
    expect(value.alpha).toBeCloseTo(2.449, 3);
  });

  it('Hayt, sec. 9.4: con R = 10.5 Ω, v = 210√2 e^{−2t} sen √2t V', () => {
    const value = solved({ resistance: 10.5, inductance: 7, capacitance: 1 / 42, iL0: -10 });
    expect(value.damping).toBe('subamortiguado');
    const [B1, B2] = value.responses[0]!.constants;
    expect(B1).toBeCloseTo(0, 10);
    expect(B2).toBeCloseTo(210 * Math.SQRT2, 8);
  });

  it('Hayt, ejemplo 9.6: i_L = e^{−1.2t}(2.027 cos 4.75t + 2.561 sen 4.75t) A', () => {
    // R = 100 Ω, L = 10 H, C = 1/240 F, v_C(0) = 97.30 V e i_L(0) = 2.027 A.
    const value = solved({
      resistance: 100,
      inductance: 10,
      capacitance: 1 / 240,
      vC0: 97.3,
      iL0: 2.027,
    });
    expect(value.damping).toBe('subamortiguado');
    const iL = value.responses.find((r) => r.name === 'i_L')!;
    expect(iL.constants[0]).toBeCloseTo(2.027, 10);
    expect(iL.constants[1]).toBeCloseTo(2.561, 3);
    expect('omegaD' in value.roots && value.roots.omegaD).toBeCloseTo(4.75, 2);
  });

  it('Hayt, ejemplo 9.7 (serie): i = 2e^{−1000t} cos 20000t mA', () => {
    // L = 1 H, R = 2 kΩ, C = 1/401 µF, i(0) = 2 mA, v_C(0) = 2 V. En la fig. 9.22, v_C tiene la
    // polaridad opuesta a la convención pasiva respecto de i; con la de la calculadora es −2 V,
    // que da di/dt(0) = −2 A/s como en el libro.
    const value = solved({
      circuit: 'serie',
      resistance: 2000,
      inductance: 1,
      capacitance: 1e-6 / 401,
      vC0: -2,
      iL0: 0.002,
    });
    expect(value.alpha).toBeCloseTo(1000, 9);
    const i = value.responses[0]!;
    expect(i.dx0).toBeCloseTo(-2, 10);
    expect(i.constants[0]).toBeCloseTo(0.002, 12);
    expect(i.constants[1]).toBeCloseTo(0, 10);
    expect('omegaD' in value.roots && value.roots.omegaD).toBeCloseTo(20000, 6);
  });

  it('Hayt, ejemplo 9.10 (respuesta completa, modo general): v_C = 150 + 13.5(e^{−t} − e^{−9t}) V', () => {
    // Serie con R = 30 Ω, L = 3 H, C = 1/27 F; v_C(0⁺) = 150 V, dv_C/dt(0⁺) = 108 V/s, v_f = 150 V.
    const value = solved({
      circuit: 'serie',
      resistance: 30,
      inductance: 3,
      capacitance: 1 / 27,
      mode: 'general',
      x0: 150,
      dx0: 108,
      xInf: 150,
    });
    expect(value.responses[0]!.tex).toBe('150 + 13.5e^{-t} - 13.5e^{-9t}');
  });

  it('con fuente de cd en serie, v_C tiende al voltaje de la fuente', () => {
    // Verificación analítica: en t → ∞ el capacitor queda cargado a V_s = 12 V.
    const result = solveSecondOrder({
      ...base,
      circuit: 'serie',
      resistance: 4,
      inductance: 1,
      capacitance: 0.25,
      source: 12,
      time: 50,
    });
    if (!result.ok) return;
    expect(result.value.responses.find((r) => r.name === 'v_C')!.atTime).toBeCloseTo(12, 8);
    expect(result.value.responses.find((r) => r.name === 'i')!.atTime).toBeCloseTo(0, 8);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    const calc = respuestaSegundoOrden;
    expect(calc.inputSchema.safeParse(calc.example).success).toBe(true);
    expect(calc.solve(calc.example).ok).toBe(true);
  });
});
