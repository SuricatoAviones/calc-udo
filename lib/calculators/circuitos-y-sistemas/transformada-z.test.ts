import { describe, expect, it } from 'vitest';
import { powerSeries, solveZ, transformadaZ, type ZInput } from './transformada-z';

const base = { coefficients: '', initial: '', samples: 12 };
const sequence = (expression: string): ZInput => ({ mode: 'sucesion', expression, ...base });
const inverse = (expression: string): ZInput => ({ mode: 'inversa', expression, ...base });

function solved(input: ZInput) {
  const result = solveZ(input);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function monic(input: ZInput) {
  const { num, den } = solved(input).value;
  const lead = den[0]!;
  return { num: num.map((c) => c / lead), den: den.map((c) => c / lead) };
}

function expectPoly(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((c, i) => expect(actual[i]).toBeCloseTo(c, 9));
}

describe('transformada Z de una sucesión', () => {
  it('Kuo, 7.ª ed., ejemplo 2-21: Z{e^{−ak}} = z/(z − e^{−a}) (con a = 0.5)', () => {
    const { num, den } = monic(sequence('e^(-0.5k)'));
    expectPoly(num, [1, 0]);
    expectPoly(den, [1, -Math.exp(-0.5)]);
  });

  it('Kuo, ec. 2-176: con a = 0, la sucesión de unos da z/(z − 1)', () => {
    const { num, den } = monic(sequence('1'));
    expectPoly(num, [1, 0]);
    expectPoly(den, [1, -1]);
  });

  it('Kuo, ejemplo 2-25 (traslación compleja): Z{k e^{−ak}} = z e^{−a}/(z − e^{−a})², con a = 1', () => {
    const { num, den } = monic(sequence('k e^(-k)'));
    const p = Math.exp(-1);
    expectPoly(num, [p, 0]);
    expectPoly(den, [1, -2 * p, p * p]);
  });

  it('la división larga reproduce las muestras de la sucesión', () => {
    const result = solved(sequence('0.5^k + delta(k - 2)'));
    for (const row of result.tables[0]!.rows) {
      expect(row.serie as number).toBeCloseTo(row.x as number, 12);
    }
  });

  it('traslación real: u(k − 2) ↔ z^{−2}·z/(z − 1) = 1/[z(z − 1)]', () => {
    const { num, den } = monic(sequence('u(k-2)'));
    expectPoly(num, [1]);
    expectPoly(den, [1, -1, 0]);
  });

  it('rechaza sucesiones fuera de la tabla', () => {
    const result = solveZ(sequence('ln(k)'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fuera-de-tabla');
  });
});

describe('transformada Z inversa', () => {
  it('Kuo, ejemplo 2-26: (1 − e^{−aT})z/[(z − 1)(z − e^{−aT})] → 1 − e^{−akT} (con aT = 1)', () => {
    const result = solved(inverse('(1 - e^(-1)) z/((z - 1)(z - e^(-1)))'));
    expect(result.value.tex).toBe('1 - \\left(0.367879\\right)^{k}');
    for (const row of result.tables[0]!.rows) {
      expect(row.cerrada as number).toBeCloseTo(1 - Math.exp(-(row.k as number)), 12);
      expect(row.division as number).toBeCloseTo(row.cerrada as number, 12);
    }
  });

  it('Kuo, ejemplo 2-24 (valor final): 0.792z²/[(z − 1)(z² − 0.416z + 0.208)] tiende a 1', () => {
    const result = solved({ ...inverse('0.792z^2/((z - 1)(z^2 - 0.416z + 0.208))'), samples: 40 });
    // El residuo en z = 1 es el valor final: 0.792/(1 − 0.416 + 0.208) = 1.
    const last = result.tables[0]!.rows.at(-1)!;
    expect(last.cerrada as number).toBeCloseTo(1, 4);
    expect(
      result.value.terms!.find((t) => t.pole.re === 1 && t.pole.im === 0)!.residue.re,
    ).toBeCloseTo(1, 12);
  });

  it('un polo en z = 0 da impulsos: X(z) = 1 + 2z⁻¹ → δ(k) + 2δ(k − 1)', () => {
    const result = solved(inverse('1 + 2z^(-1)'));
    expect(result.value.tex).toBe('\\delta\\left(k\\right) + 2\\delta\\left(k - 1\\right)');
  });

  it('rechaza X(z) no causal (numerador de mayor grado)', () => {
    const result = solveZ(inverse('z^2/(z - 1)'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('no-causal');
  });
});

describe('ecuaciones en diferencias', () => {
  it('Kuo, ec. 2-211: y(k + 1) + y(k) = 0 → y(k) = (−1)ᵏ y(0)', () => {
    const result = solved({
      mode: 'ecuacion',
      expression: '0',
      coefficients: '1 1',
      initial: '3',
      samples: 8,
    });
    expect(result.value.tex).toBe('3\\left(-1\\right)^{k}');
  });

  it('Kuo, sec. 2-12: y(k + 2) + 0.5y(k + 1) + 0.2y(k) = u(k), y(0) = y(1) = 0', () => {
    // Resultado del libro (ec. 2-222): y(k) = 0.588 − 2.072(0.447)ᵏ cos(2.165k − 1.283). La
    // amplitud exacta es 2|K| = 2.0684: el libro redondea |K| a 1.036 (con 1.0342, y(0) = 0).
    const result = solved({
      mode: 'ecuacion',
      expression: 'u(k)',
      coefficients: '1 0.5 0.2',
      initial: '0 0',
      samples: 12,
    });
    const terms = result.value.terms!;
    const step = terms.find((t) => t.pole.im === 0)!;
    const pair = terms.find((t) => t.pole.im > 0)!;
    expect(step.residue.re).toBeCloseTo(0.588, 3);
    // Como en la ec. 2-221, Y(z)/z = 1/[(z − 1)(z² + 0.5z + 0.2)]: la z se cancela y no hay polo
    // en el origen.
    expect(terms).toHaveLength(2);
    expect(terms.some((t) => t.pole.re === 0 && t.pole.im === 0)).toBe(false);
    expect(2 * Math.hypot(pair.residue.re, pair.residue.im)).toBeCloseTo(2.07, 2);
    expect(Math.hypot(pair.pole.re, pair.pole.im)).toBeCloseTo(0.447, 3);
    expect(Math.atan2(pair.pole.im, pair.pole.re)).toBeCloseTo(2.165, 2);
    // Fase del residuo: π − 1.283; se muestra como −2.068·cos(2.164k − 1.283), como en el libro.
    expect(Math.atan2(pair.residue.im, pair.residue.re)).toBeCloseTo(Math.PI - 1.283, 2);
    expect(result.value.tex).toBe(
      '0.588235 - 2.06835\\left(0.447214\\right)^{k}\\cos\\left(2.164k - 1.28242\\right)',
    );
    for (const row of result.tables[0]!.rows) {
      expect(row.cerrada as number).toBeCloseTo(row.recursion as number, 10);
    }
  });

  it('valida coeficientes y valores iniciales', () => {
    const schema = transformadaZ.inputSchema;
    expect(
      schema.safeParse({
        mode: 'ecuacion',
        expression: '1',
        coefficients: '1 2 3',
        initial: '1',
        samples: 10,
      }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...sequence('1'), samples: 2 }).success).toBe(false);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(transformadaZ.inputSchema.safeParse(transformadaZ.example).success).toBe(true);
    expect(transformadaZ.solve(transformadaZ.example).ok).toBe(true);
  });
});

describe('división larga', () => {
  it('z/(z − 0.5) = 1 + 0.5z⁻¹ + 0.25z⁻² + …', () => {
    expect(powerSeries([1, 0], [1, -0.5], 4)).toEqual([1, 0.5, 0.25, 0.125]);
  });
});
