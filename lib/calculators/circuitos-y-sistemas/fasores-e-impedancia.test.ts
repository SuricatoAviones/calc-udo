import { describe, expect, it } from 'vitest';
import * as C from '@/lib/math/complex';
import { fasoresEImpedancia, solvePhasor, type PhasorInput } from './fasores-e-impedancia';

const base: PhasorInput = {
  amplitude: 8,
  phase: 0,
  form: 'cos',
  omega: 1000,
  connection: 'serie',
  resistance: 0,
  inductance: 0,
  capacitance: 0,
};

function solved(input: Partial<PhasorInput>) {
  const result = solvePhasor({ ...base, ...input });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('fasores e impedancia', () => {
  it('Hayt, Kemmerly y Durbin, 8.ª ed., ejemplo 10.1: 8 cos 1000t sobre 20 Ω y 30 mH → 222 cos(1000t − 56.3°) mA', () => {
    const { impedance, current } = solved({ resistance: 20, inductance: 0.03 });
    expect(impedance.re).toBeCloseTo(20, 10);
    expect(impedance.im).toBeCloseTo(30, 10);
    expect(C.abs(current)).toBeCloseTo(0.2219, 4);
    expect(C.degrees(C.arg(current))).toBeCloseTo(-56.31, 2);
  });

  it('Hayt, sec. 10.5: 10 Ω y 5 H a ω = 4 rad/s → 10 + j20 Ω en serie y 8 + j4 Ω en paralelo', () => {
    const serie = solved({ omega: 4, resistance: 10, inductance: 5 }).impedance;
    expect(serie.re).toBeCloseTo(10, 10);
    expect(serie.im).toBeCloseTo(20, 10);
    // El libro da también la forma polar 22.4∠63.4°.
    expect(C.abs(serie)).toBeCloseTo(22.36, 2);
    expect(C.degrees(C.arg(serie))).toBeCloseTo(63.43, 2);
    const paralelo = solved({
      omega: 4,
      resistance: 10,
      inductance: 5,
      connection: 'paralelo',
    }).impedance;
    expect(paralelo.re).toBeCloseTo(8, 10);
    expect(paralelo.im).toBeCloseTo(4, 10);
  });

  it('Hayt, ejemplo 10.4: 8∠−50° V a ω = 100 rad/s sobre 4 H → I = 0.02∠−140° A', () => {
    const { current } = solved({ phase: -50, omega: 100, inductance: 4 });
    expect(C.abs(current)).toBeCloseTo(0.02, 12);
    expect(C.degrees(C.arg(current))).toBeCloseTo(-140, 10);
  });

  it('Hayt, ejemplo 10.7: 40 sen 3000t V → V = 40∠−90° V', () => {
    const { voltage } = solved({ amplitude: 40, form: 'sin', omega: 3000, resistance: 1000 });
    expect(C.abs(voltage)).toBeCloseTo(40, 12);
    expect(C.degrees(C.arg(voltage))).toBeCloseTo(-90, 10);
  });

  it('Hayt, problema de práctica 10.7a: −5 sen(580t − 110°) → 5∠−20°', () => {
    const { voltage } = solved({
      amplitude: -5,
      phase: -110,
      form: 'sin',
      omega: 580,
      resistance: 1,
    });
    expect(C.abs(voltage)).toBeCloseTo(5, 12);
    expect(C.degrees(C.arg(voltage))).toBeCloseTo(-20, 10);
  });

  it('en serie, los voltajes de los elementos suman el de la fuente (LVK)', () => {
    const { elements, voltage } = solved({ resistance: 20, inductance: 0.03, capacitance: 50e-6 });
    const sum = elements.reduce((s, e) => C.add(s, e.voltage), C.ZERO);
    expect(sum.re).toBeCloseTo(voltage.re, 10);
    expect(sum.im).toBeCloseTo(voltage.im, 10);
  });

  it('resonancia serie LC sin resistencia: impedancia nula', () => {
    // ω = 1/√(LC) = 1000 rad/s con L = 1 H y C = 1 µF: Z_L + Z_C = 0.
    const result = solvePhasor({ ...base, inductance: 1, capacitance: 1e-6 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('impedancia-nula');
  });

  it('resonancia paralelo LC sin resistencia: impedancia infinita', () => {
    const result = solvePhasor({
      ...base,
      connection: 'paralelo',
      inductance: 1,
      capacitance: 1e-6,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('impedancia-infinita');
  });

  it('exige al menos un elemento', () => {
    expect(fasoresEImpedancia.inputSchema.safeParse(base).success).toBe(false);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    const calc = fasoresEImpedancia;
    expect(calc.inputSchema.safeParse(calc.example).success).toBe(true);
    expect(calc.solve(calc.example).ok).toBe(true);
  });
});
