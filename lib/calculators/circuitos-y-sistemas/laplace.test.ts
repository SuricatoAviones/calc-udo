import { describe, expect, it } from 'vitest';
import {
  evaluatePieces,
  groupToRational,
  laplaceOfSignal,
  parseTransform,
  timePieces,
} from './laplace';
import { partialFractions } from './partial-fractions';
import { parseSignal } from './signal';

const continuous = { variable: 't', discrete: false };

function transform(source: string) {
  const parsed = parseSignal(source, continuous);
  if (!parsed.ok) throw new Error(parsed.message);
  return laplaceOfSignal(parsed.signal).map((g) => ({ delay: g.delay, ...groupToRational(g) }));
}

/** Coeficientes normalizados para que el denominador sea mónico. */
function monic({ num, den }: { num: number[]; den: number[] }) {
  const lead = den[0]!;
  return { num: num.map((c) => c / lead), den: den.map((c) => c / lead) };
}

function expectPoly(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((c, i) => expect(actual[i]).toBeCloseTo(c, 9));
}

describe('transformada directa', () => {
  it('Dorf y Svoboda, 9.ª ed., ejemplo 14.2-4: ℒ{5 − 5e^{−2t}(1 + 2t)} = 20/[s(s² + 4s + 4)]', () => {
    const [g] = transform('5 - 5e^(-2t)(1 + 2t)');
    const { num, den } = monic(g!);
    expectPoly(num, [20]);
    expectPoly(den, [1, 4, 4, 0]);
  });

  it('Dorf, ejemplo 14.2-5: ℒ{e^{−4t}(8cos 20t − 6 sen 20t)} = (8s − 88)/(s² + 8s + 416)', () => {
    // El libro reescribe 10e^{−4t}cos(20t + 36.9°) como e^{−4t}(8 cos 20t − 6 sen 20t).
    const [g] = transform('e^(-4t)(8cos(20t) - 6sin(20t))');
    const { num, den } = monic(g!);
    expectPoly(num, [8, -88]);
    expectPoly(den, [1, 8, 416]);
  });

  it('Dorf, ejemplo 14.2-5 (segundo): ℒ{2δ(t) + 3 + 4u(t)} = 2 + 7/s', () => {
    const [g] = transform('2delta(t) + 3 + 4u(t)');
    const { num, den } = monic(g!);
    expectPoly(num, [2, 7]);
    expectPoly(den, [1, 0]);
  });

  it('Dorf, ejemplo 14.3-1: g(t) = 1.5t u(t) − 1.5(t − 10)u(t − 10) ↔ 1.5(1 − e^{−10s})/s²', () => {
    const groups = transform('1.5t - 1.5(t - 10)u(t - 10)');
    expect(groups.map((g) => g.delay)).toEqual([0, 10]);
    expectPoly(monic(groups[0]!).num, [1.5]);
    expectPoly(monic(groups[0]!).den, [1, 0, 0]);
    expectPoly(monic(groups[1]!).num, [-1.5]);
    expectPoly(monic(groups[1]!).den, [1, 0, 0]);
  });

  it('Hayt, 8.ª ed., ejemplo 14.10: u(t − 2) − u(t − 5) ↔ (e^{−2s} − e^{−5s})/s', () => {
    const groups = transform('u(t-2) - u(t-5)');
    expect(groups.map((g) => g.delay)).toEqual([2, 5]);
    expectPoly(monic(groups[0]!).num, [1]);
    expectPoly(monic(groups[1]!).num, [-1]);
  });

  it('rechaza funciones fuera de la tabla', () => {
    expect(parseSignal('ln(t)', continuous).ok).toBe(false);
    expect(parseSignal('1/t', continuous).ok).toBe(false);
    expect(parseSignal('x + 1', continuous).ok).toBe(false);
  });
});

describe('transformada inversa (fracciones parciales)', () => {
  function inverse(source: string) {
    const parsed = parseTransform(source, 's');
    if (!parsed.ok) throw new Error(parsed.message);
    const g = parsed.groups[0]!;
    const pf = partialFractions(g.num, g.den);
    return { pf, f: (t: number) => evaluatePieces(timePieces(pf.poles), t) };
  }

  it('Dorf, ejemplo 14.4-1: (s + 3)/(s² + 7s + 10) → (1/3)e^{−2t} + (2/3)e^{−5t}', () => {
    const { f } = inverse('(s + 3)/(s^2 + 7s + 10)');
    for (const t of [0, 0.3, 1]) {
      expect(f(t)).toBeCloseTo((1 / 3) * Math.exp(-2 * t) + (2 / 3) * Math.exp(-5 * t), 10);
    }
  });

  it('Dorf, ejemplo 14.4-2: 10/[(s² + 6s + 10)(s + 2)] → −5e^{−3t}cos t − 5e^{−3t}sen t + 5e^{−2t}', () => {
    // Resultado de la «solución alterna» del libro (p. 684), que coincide con R1 = −5/2 + j5/2.
    const { pf, f } = inverse('10/((s^2 + 6s + 10)(s + 2))');
    const upper = pf.poles.find((p) => p.pole.im > 0)!;
    // Residuo del libro: R1 = −5/2 + j5/2 en p = −3 + j.
    expect(upper.residues[0]!.re).toBeCloseTo(-2.5, 10);
    expect(upper.residues[0]!.im).toBeCloseTo(2.5, 10);
    const exact = (t: number) =>
      -5 * Math.exp(-3 * t) * Math.cos(t) -
      5 * Math.exp(-3 * t) * Math.sin(t) +
      5 * Math.exp(-2 * t);
    for (const t of [0, 0.5, 2]) expect(f(t)).toBeCloseTo(exact(t), 10);
  });

  it('Dorf, ejemplo 14.4-3: 4/[(s + 1)²(s + 2)] → −4e^{−t} + 4te^{−t} + 4e^{−2t}', () => {
    const { pf, f } = inverse('4/((s + 1)^2 (s + 2))');
    const double = pf.poles.find((p) => p.multiplicity === 2)!;
    expect(double.residues[0]!.re).toBeCloseTo(-4, 10);
    expect(double.residues[1]!.re).toBeCloseTo(4, 10);
    const exact = (t: number) => -4 * Math.exp(-t) + 4 * t * Math.exp(-t) + 4 * Math.exp(-2 * t);
    for (const t of [0, 0.5, 3]) expect(f(t)).toBeCloseTo(exact(t), 10);
  });

  it('lee retardos e^{−as}: (1 − e^{−s})/s', () => {
    const parsed = parseTransform('(1 - e^(-s))/s', 's');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.groups.map((g) => g.delay)).toEqual([0, 1]);
  });
});
