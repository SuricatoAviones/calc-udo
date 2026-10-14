import { describe, expect, it } from 'vitest';
import { solveLaplace, transformadaDeLaplace, type LaplaceInput } from './transformada-de-laplace';

const fn = (expression: string): LaplaceInput => ({
  mode: 'funcion',
  expression,
  coefficients: '',
  initial: '',
});

function solved(input: LaplaceInput) {
  const result = solveLaplace(input);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

/** Grupo sin retardo normalizado con denominador mónico. */
function monic(input: LaplaceInput, delay = 0) {
  const group = solved(input).value.transform.find((g) => g.delay === delay)!;
  const lead = group.den[0]!;
  return { num: group.num.map((c) => c / lead), den: group.den.map((c) => c / lead) };
}

function expectPoly(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((c, i) => expect(actual[i]).toBeCloseTo(c, 9));
}

describe('transformada de Laplace de una función', () => {
  it('Dorf y Svoboda, 9.ª ed., ejemplo 14.2-4: 5 − 5e^{−2t}(1 + 2t) → 20/[s(s² + 4s + 4)]', () => {
    const { num, den } = monic(fn('5 - 5e^(-2t)(1 + 2t)'));
    expectPoly(num, [20]);
    expectPoly(den, [1, 4, 4, 0]);
    expect(solved(fn('5 - 5e^(-2t)(1 + 2t)')).summary[1]!.value).toBe(
      'F(s) = \\frac{20}{s^{3} + 4s^{2} + 4s}',
    );
  });

  it('Dorf, ejemplo 14.2-5: e^{−4t}(8 cos 20t − 6 sen 20t) → (8s − 88)/(s² + 8s + 416)', () => {
    // El libro reescribe 10e^{−4t}cos(20t + 36.9°) como 8e^{−4t}cos 20t − 6e^{−4t}sen 20t.
    const { num, den } = monic(fn('8e^(-4t)cos(20t) - 6e^(-4t)sin(20t)'));
    expectPoly(num, [8, -88]);
    expectPoly(den, [1, 8, 416]);
  });

  it('Dorf, ejemplo 14.2-5 (segundo): 2δ(t) + 3 + 4u(t) → 2 + 7/s', () => {
    const { num, den } = monic(fn('2delta(t) + 3 + 4u(t)'));
    expectPoly(num, [2, 7]);
    expectPoly(den, [1, 0]);
  });

  it('Dorf, ejemplo 14.3-1: pulso triangular h(t) → 1.5(1 − e^{−10s})/s² − 15e^{−10s}/s', () => {
    const input = fn('1.5t - 1.5(t - 10)u(t - 10) - 15u(t - 10)');
    expectPoly(monic(input, 0).num, [1.5]);
    expectPoly(monic(input, 0).den, [1, 0, 0]);
    // Grupo con e^{−10s}: −1.5/s² − 15/s = (−15s − 1.5)/s².
    expectPoly(monic(input, 10).num, [-15, -1.5]);
    expectPoly(monic(input, 10).den, [1, 0, 0]);
  });

  it('Hayt, Kemmerly y Durbin, 8.ª ed., problema de práctica 14.13: (5/s)(2e^{−2s} − e^{−4s} − e^{−5s})', () => {
    const input = fn('10u(t-2) - 5u(t-4) - 5u(t-5)');
    const groups = solved(input).value.transform;
    expect(groups.map((g) => g.delay)).toEqual([2, 4, 5]);
    expectPoly(monic(input, 2).num, [10]);
    expectPoly(monic(input, 4).num, [-5]);
    expectPoly(monic(input, 5).num, [-5]);
  });

  it('describe el par de la tabla de cada término', () => {
    const result = solved(fn('3e^(-2t)sin(4t) + 2t'));
    const pairs = result.steps.find((s) => s.title === 'Transformada de cada término')!.children!;
    expect(pairs.map((p) => p.title)).toEqual([
      'Seno y coseno amortiguados (desplazamiento en frecuencia)',
      'Potencia de t (rampa)',
    ]);
  });

  it('rechaza funciones fuera de la tabla', () => {
    const result = solveLaplace(fn('ln(t)'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fuera-de-tabla');
    expect(solveLaplace(fn('t +* 2')).ok).toBe(false);
  });
});

describe('ecuaciones diferenciales', () => {
  it('Hayt, ejemplo 14.7: 2 di/dt + 4i = 3u(t), i(0) = 5 A → i(t) = 0.75 + 4.25e^{−2t}', () => {
    const result = solved({ mode: 'ecuacion', expression: '3', coefficients: '2 4', initial: '5' });
    expect(result.value.solution!.tex).toBe('0.75 + 4.25e^{-2t}');
  });

  it('Dorf, ejemplo 14.6-1: v_C(t) = 5 + 4.17e^{−16t} − 6.67e^{−10t}', () => {
    // La ecuación 14.6-5 del libro, con L = 2.5 H, C = 10 mF, R1 = 15 Ω y R2 = 5 Ω, es
    // 0.025v″ + 0.65v′ + 4v = v_i = 20 V (t > 0). Con i_L(0) = 0.5 A = v_C(0)/R2 + C·v′(0),
    // v′(0) = 0 y v(0) = 2.5 V.
    const result = solved({
      mode: 'ecuacion',
      expression: '20',
      coefficients: '0.025 0.65 4',
      initial: '2.5 0',
    });
    expect(result.value.solution!.tex).toBe('5 - 6.66667e^{-10t} + 4.16667e^{-16t}');
    const y = solved({
      mode: 'ecuacion',
      expression: '20',
      coefficients: '0.025 0.65 4',
      initial: '2.5 0',
    });
    // Y(s) = (2.5s² + 65s + 800)/[s(s + 10)(s + 16)], como en el libro.
    const group = y.value.transform[0]!;
    const lead = group.den[0]!;
    expectPoly(
      group.num.map((c) => c / lead),
      [2.5, 65, 800],
    );
    expectPoly(
      group.den.map((c) => c / lead),
      [1, 26, 160, 0],
    );
  });

  it('valida el orden y las condiciones iniciales', () => {
    const schema = transformadaDeLaplace.inputSchema;
    expect(
      schema.safeParse({ mode: 'ecuacion', expression: '1', coefficients: '1 2 3', initial: '1' })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ mode: 'ecuacion', expression: '1', coefficients: '0 2', initial: '1' })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ mode: 'ecuacion', expression: '1', coefficients: '1 2', initial: '' })
        .success,
    ).toBe(true);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    const calc = transformadaDeLaplace;
    expect(calc.inputSchema.safeParse(calc.example).success).toBe(true);
    expect(calc.solve(calc.example).ok).toBe(true);
  });
});
