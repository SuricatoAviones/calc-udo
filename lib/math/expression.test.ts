import { describe, expect, it } from 'vitest';
import { differentiate, parseFunction } from './expression';

function parseOk(source: string) {
  const result = parseFunction(source);
  if (!result.ok) throw new Error(result.message);
  return result.expr;
}

function derivativeOk(source: string) {
  const result = differentiate(parseOk(source));
  if (!result.ok) throw new Error(result.message);
  return result.expr;
}

// Las derivadas esperadas son reglas de derivación de tabla (d/dx e^{-x} = −e^{-x}, etc.);
// se verifican evaluando en puntos cuyo valor exacto se conoce.

describe('parseFunction', () => {
  it('evalúa la función del Ejemplo 6.3 de Chapra: f(x) = e^{-x} − x', () => {
    const f = parseOk('e^(-x) - x');
    expect(f.evaluate(0)).toBe(1);
    expect(f.evaluate(1)).toBeCloseTo(Math.exp(-1) - 1, 12);
  });

  it('acepta multiplicación implícita, pi y alias en español', () => {
    expect(parseOk('2x^2').evaluate(3)).toBe(18);
    expect(parseOk('sen(pi/2)').evaluate(0)).toBeCloseTo(1, 12);
    expect(parseOk('ln(e)').evaluate(0)).toBeCloseTo(1, 12);
    expect(parseOk('tg(0)').evaluate(0)).toBe(0);
  });

  it('muestra la función en LaTeX', () => {
    expect(parseOk('x^10 - 1').tex).toContain('{10}');
    expect(parseOk('ln(x)').tex).toContain('\\ln');
  });

  it('devuelve NaN cuando el valor no es real', () => {
    expect(parseOk('sqrt(x)').evaluate(-1)).toBeNaN();
  });

  it.each([
    ['', 'Escribe una función.'],
    ['x^^2', 'no es válida'],
    ['(x + 1', 'paréntesis'],
    ['y + 1', '«y» no está definido'],
    ['log(x)', 'ln(x)'],
    ['foo(x)', '«foo» no está soportada'],
    ['x'.repeat(201), 'demasiado larga'],
  ])('rechaza %j con un mensaje claro', (source, fragment) => {
    const result = parseFunction(source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(fragment);
  });
});

describe('differentiate', () => {
  it('d/dx (e^{-x} − x) = −e^{-x} − 1', () => {
    const df = derivativeOk('e^(-x) - x');
    expect(df.evaluate(0)).toBeCloseTo(-2, 12);
    expect(df.evaluate(1)).toBeCloseTo(-Math.exp(-1) - 1, 12);
  });

  it('d/dx (x^{10} − 1) = 10x^9', () => {
    const df = derivativeOk('x^10 - 1');
    expect(df.evaluate(0.5)).toBeCloseTo(10 * 0.5 ** 9, 12);
  });

  it('d/dx ln(x) = 1/x y d/dx sen(x) = cos(x)', () => {
    expect(derivativeOk('ln(x)').evaluate(4)).toBeCloseTo(0.25, 12);
    expect(derivativeOk('sen(x)').evaluate(0)).toBeCloseTo(1, 12);
  });
});
