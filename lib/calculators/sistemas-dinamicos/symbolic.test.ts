import { describe, expect, it } from 'vitest';
import {
  frAdd,
  frConst,
  frDiv,
  frEquivalent,
  frMul,
  frSub,
  frTex,
  frToUnivariate,
  mpDivExact,
  mpTex,
  parseGain,
  parsePolynomial,
  symbolTex,
  type FRat,
} from './symbolic';

function gain(source: string): FRat {
  const r = parseGain(source);
  if (!r.ok) throw new Error(r.message);
  return r.value;
}

// Casos de álgebra sin libro: se verifican desarrollando a mano las identidades.
describe('álgebra simbólica de ganancias', () => {
  it('escribe los símbolos con subíndice', () => {
    expect(symbolTex('G1')).toBe('G_{1}');
    expect(symbolTex('H_2')).toBe('H_{2}');
    expect(symbolTex('a12')).toBe('a_{12}');
    expect(symbolTex('K')).toBe('K');
  });

  it('lee productos pegados: G1G2H1 = G1·G2·H1', () => {
    expect(frTex(gain('G1G2H1'))).toBe('G_{1}G_{2}H_{1}');
    expect(frTex(gain('-G1 G2'))).toBe('-G_{1}G_{2}');
  });

  it('realimentación: G/(1 + GH) y cancelación del factor repetido', () => {
    const g = gain('G');
    const h = gain('H');
    const closed = frDiv(g, frAdd(frConst(1), frMul(g, h)));
    expect(frTex(closed)).toBe('\\frac{G}{1 + GH}');
    // [G/(1 + GH)]·(1 + GH) = G.
    expect(frTex(frMul(closed, frAdd(frConst(1), frMul(g, h))))).toBe('G');
  });

  it('suma con denominador común y división exacta', () => {
    // 1/(1 − x) − x/(1 − x) = 1.
    const x = gain('x');
    const one = frConst(1);
    const d = frSub(one, x);
    expect(frTex(frSub(frDiv(one, d), frDiv(x, d)))).toBe('1');
    // (x² − 1)/(x − 1) = x + 1 por división exacta.
    expect(frTex(gain('(x^2 - 1)/(x - 1)'))).toBe('x + 1');
  });

  it('la división exacta en varias variables reconoce los múltiplos', () => {
    const a = parsePolynomial('(1 + G1 H1)(G2 + H2)');
    const b = parsePolynomial('1 + G1 H1');
    if (!a.ok || !b.ok) throw new Error();
    const q = mpDivExact(a.poly, b.poly);
    expect(q && mpTex(q)).toBe('G_{2} + H_{2}');
    const c = parsePolynomial('1 + G1');
    if (!c.ok) throw new Error();
    expect(mpDivExact(a.poly, c.poly)).toBeNull();
  });

  it('una ganancia en s se convierte en función racional', () => {
    const tf = frToUnivariate(gain('10/(s + 1) * 1/s'), 's');
    expect(tf).toEqual({ num: [10], den: [1, 1, 0] });
  });

  it('compara expresiones como funciones', () => {
    expect(frEquivalent(gain('G/(1 + G H)'), gain('1/(1/G + H)'))).toBe(true);
    expect(frEquivalent(gain('G/(1 + G H)'), gain('G/(1 - G H)'))).toBe(false);
  });

  it('rechaza lo que no es una ganancia', () => {
    expect(parseGain('').ok).toBe(false);
    expect(parseGain('sin(s)').ok).toBe(false);
    expect(parseGain('G^x').ok).toBe(false);
    expect(parseGain('1/0').ok).toBe(false);
  });
});
