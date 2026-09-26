import { describe, expect, it } from 'vitest';
import { Rational, sumRationals } from './rational';

// Casos aritméticos: los valores esperados se verifican a mano (son identidades de fracciones).

const r = (n: number, d = 1) => Rational.of(n, d);

describe('Rational', () => {
  it('normaliza signo y fracción irreducible', () => {
    expect(r(4, -6).toString()).toBe('-2/3');
    expect(r(0, 5).toString()).toBe('0');
    expect(r(10, 5).isInteger()).toBe(true);
  });

  it('opera con exactitud', () => {
    expect(r(1, 3).add(r(1, 6)).toString()).toBe('1/2');
    expect(r(2, 3).sub(r(1, 6)).toString()).toBe('1/2');
    expect(r(2, 3).mul(r(9, 4)).toString()).toBe('3/2');
    expect(r(24).div(r(6)).toString()).toBe('4');
    expect(sumRationals([r(1, 10), r(2, 10)]).toString()).toBe('3/10');
  });

  it('convierte números decimales sin error binario', () => {
    expect(Rational.fromNumber(0.21).toString()).toBe('21/100');
    expect(Rational.fromNumber(0.1).add(Rational.fromNumber(0.2)).toString()).toBe('3/10');
    expect(Rational.fromNumber(-2.5).toString()).toBe('-5/2');
    expect(Rational.fromNumber(1e-7).toString()).toBe('1/10000000');
    expect(Rational.fromNumber(3e21).toString()).toBe('3000000000000000000000');
    expect(() => Rational.fromNumber(Number.NaN)).toThrow();
  });

  it('compara, redondea y convierte a número', () => {
    expect(r(2, 3).cmp(r(3, 5))).toBe(1);
    expect(r(-1, 2).lt(r(1, 3))).toBe(true);
    expect(r(7, 2).floor().toString()).toBe('3');
    expect(r(-7, 2).floor().toString()).toBe('-4');
    expect(r(-7, 2).ceil().toString()).toBe('-3');
    expect(r(15, 4).toNumber()).toBe(3.75);
  });

  it('muestra decimales cortos y fracciones en LaTeX', () => {
    expect(r(1, 2).toLatex()).toBe('0.5');
    expect(r(-21, 100).toLatex()).toBe('-0.21');
    expect(r(2, 3).toLatex()).toBe(String.raw`\frac{2}{3}`);
    expect(r(-1, 6).toLatex()).toBe(String.raw`-\frac{1}{6}`);
    expect(r(1, 32).toLatex()).toBe(String.raw`\frac{1}{32}`);
    expect(r(5).toLatex()).toBe('5');
    expect(r(2, 3).toText()).toBe('2/3');
  });
});
