import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  parseDecimal,
  toLatexMatrix,
  toLatexNumber,
  toLatexOperand,
  toLatexVector,
} from './format';

// Casos de formateo: el valor esperado es la representación decimal del literal de entrada,
// no el resultado de un cálculo, así que se verifica por inspección.

describe('formatNumber', () => {
  it('elimina ruido de coma flotante y ceros sobrantes', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(0.5)).toBe('0.5');
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(-1.25)).toBe('-1.25');
  });

  it('respeta las cifras significativas pedidas', () => {
    expect(formatNumber(0.56714329040978, 9)).toBe('0.56714329');
    expect(formatNumber(0.56714329040978, 4)).toBe('0.5671');
    // Con menos cifras que dígitos enteros no debe caer en notación exponencial.
    expect(formatNumber(100, 2)).toBe('100');
    expect(formatNumber(51.65, 2)).toBe('52');
  });

  it('usa notación científica para valores muy pequeños o muy grandes', () => {
    expect(formatNumber(1.2345e-7)).toBe('1.2345e-7');
    expect(formatNumber(3e12)).toBe('3e12');
  });

  it('normaliza -0 y representa valores no finitos', () => {
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(NaN)).toBe('indefinido');
    expect(formatNumber(Infinity)).toBe('∞');
    expect(formatNumber(-Infinity)).toBe('−∞');
  });
});

describe('toLatexNumber', () => {
  it('convierte la notación científica a potencias de 10', () => {
    expect(toLatexNumber(2.2e-5)).toBe('2.2 \\times 10^{-5}');
    expect(toLatexNumber(0.25)).toBe('0.25');
    expect(toLatexNumber(Infinity)).toBe('\\infty');
  });
});

describe('toLatexOperand', () => {
  it('encierra negativos y notación científica entre paréntesis', () => {
    expect(toLatexOperand(-2)).toBe('\\left(-2\\right)');
    expect(toLatexOperand(1e-6)).toBe('\\left(1 \\times 10^{-6}\\right)');
    expect(toLatexOperand(3)).toBe('3');
  });
});

describe('parseDecimal', () => {
  it('acepta punto o coma decimal, signo y notación científica', () => {
    expect(parseDecimal('0,5')).toBe(0.5);
    expect(parseDecimal(' -2.25 ')).toBe(-2.25);
    expect(parseDecimal('5e-5')).toBe(0.00005);
    expect(parseDecimal('.5')).toBe(0.5);
  });

  it('devuelve NaN para texto vacío o no numérico', () => {
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
    expect(parseDecimal('1.2.3')).toBeNaN();
  });
});

describe('toLatexMatrix y toLatexVector', () => {
  it('arma una bmatrix y un vector fila', () => {
    expect(
      toLatexMatrix([
        [0.2, 0.8],
        [0.6, 0.4],
      ]),
    ).toBe(String.raw`\begin{bmatrix} 0.2 & 0.8 \\ 0.6 & 0.4 \end{bmatrix}`);
    expect(toLatexVector([0.32, 0.68])).toBe(String.raw`\left(0.32,\ 0.68\right)`);
  });

  // Un "\b" o "\r" mal escapado en el código se convierte en un carácter de control invisible
  // (backspace, retorno de carro) que KaTeX muestra como □. Este test lo detecta aunque el valor
  // esperado tenga el mismo error.
  it('no produce caracteres de control', () => {
    const latex = toLatexMatrix([[1]]) + toLatexVector([1]) + toLatexOperand(-1);
    expect(latex).not.toMatch(/[\u0000-\u001f]/);
    expect(latex).toContain('\\begin');
    expect(latex).toContain('\\left');
  });
});
