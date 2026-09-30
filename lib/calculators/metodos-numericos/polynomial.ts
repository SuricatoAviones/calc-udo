/**
 * Polinomios escritos por sus coeficientes (Chapra & Canale, sec. 7.2): lectura, LaTeX y división
 * sintética entre (x − r).
 *
 *   P(x) = aₙxⁿ + ⋯ + a₁x + a₀ = (x − r) Q(x) + R
 *   bₙ = aₙ,   b_k = a_k + r b_{k+1}   (k = n − 1, …, 0);   Q tiene coeficientes bₙ … b₁ y R = b₀
 *
 * Por el teorema del residuo, R = P(r): la división sintética es también la regla de Horner para
 * evaluar el polinomio (sec. 7.2.1).
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { toLatexNumber } from '@/lib/math/format';
import type { Latex } from '../types';

export const MAX_DEGREE = 20;

/** Coeficientes de mayor a menor grado, separados por espacios: "1 -3.5 2.75". */
export function parseCoefficients(text: string): number[] | string {
  const { values, invalid } = parseDataList(text);
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  if (values.length < 2)
    return 'Escribe al menos dos coeficientes (un polinomio de grado 1 o más).';
  if (values.length > MAX_DEGREE + 1) return `El grado máximo es ${MAX_DEGREE}.`;
  if (values[0] === 0)
    return 'El primer coeficiente (el del término de mayor grado) no puede ser 0.';
  return values;
}

export const coefficientsField = (minDegree = 1) =>
  z.string().superRefine((text, ctx) => {
    const parsed = parseCoefficients(text);
    if (typeof parsed === 'string') ctx.addIssue({ code: 'custom', message: parsed });
    else if (parsed.length - 1 < minDegree) {
      ctx.addIssue({
        code: 'custom',
        message: `El polinomio debe ser al menos de grado ${minDegree}.`,
      });
    }
  });

/** Coeficientes (de mayor a menor grado) → LaTeX: `x^{2} + 2x - 24`. */
export function polynomialLatex(coefficients: number[], variable: Latex = 'x', digits = 7): Latex {
  const degree = coefficients.length - 1;
  const terms: string[] = [];
  coefficients.forEach((a, i) => {
    if (a === 0) return;
    const power = degree - i;
    const abs = Math.abs(a);
    const base = power === 0 ? '' : power === 1 ? variable : `${variable}^{${power}}`;
    const coef = power > 0 && abs === 1 ? '' : toLatexNumber(abs, digits);
    const body = `${coef}${base}`;
    if (terms.length === 0) terms.push(a < 0 ? `-${body}` : body);
    else terms.push(a < 0 ? `- ${body}` : `+ ${body}`);
  });
  return terms.length === 0 ? '0' : terms.join(' ');
}

export interface SyntheticDivision {
  /** Coeficientes del cociente, de mayor a menor grado (bₙ … b₁). */
  quotient: number[];
  remainder: number;
  /** r·b_{k+1} de cada columna (la primera no tiene producto). */
  products: (number | null)[];
  /** b de cada columna, incluido el residuo al final. */
  b: number[];
}

export function syntheticDivision(coefficients: number[], r: number): SyntheticDivision {
  const b: number[] = [];
  const products: (number | null)[] = [];
  coefficients.forEach((a, i) => {
    if (i === 0) {
      b.push(a);
      products.push(null);
    } else {
      const product = r * b[i - 1]!;
      products.push(product);
      b.push(a + product);
    }
  });
  return { quotient: b.slice(0, -1), remainder: b.at(-1)!, products, b };
}

/** Esquema de Ruffini en LaTeX: coeficientes, productos y resultados bajo la línea. */
export function ruffiniLatex(
  coefficients: number[],
  r: number,
  division: SyntheticDivision,
  digits = 6,
): Latex {
  const f = (v: number) => toLatexNumber(v, digits);
  const cols = coefficients.length;
  const top = coefficients.map(f).join(' & ');
  const middle = division.products.map((p) => (p === null ? '' : f(p))).join(' & ');
  const bottom = division.b.map((v, i) => (i === cols - 1 ? `\\boxed{${f(v)}}` : f(v))).join(' & ');
  return `\\begin{array}{r|${'r'.repeat(cols)}} ${f(r)} & ${top} \\\\ & ${middle} \\\\ \\hline & ${bottom} \\end{array}`;
}

/** Número complejo sencillo para las raíces. */
export interface ComplexRoot {
  re: number;
  im: number;
}

/** Raíces de x² − r x − s (Chapra, ec. 7.41): x = [r ± √(r² + 4s)] / 2. */
export function quadraticFactorRoots(r: number, s: number): [ComplexRoot, ComplexRoot] {
  const disc = r * r + 4 * s;
  if (disc >= 0) {
    const sq = Math.sqrt(disc);
    return [
      { re: (r + sq) / 2, im: 0 },
      { re: (r - sq) / 2, im: 0 },
    ];
  }
  const sq = Math.sqrt(-disc);
  return [
    { re: r / 2, im: sq / 2 },
    { re: r / 2, im: -sq / 2 },
  ];
}

export function complexLatex({ re, im }: ComplexRoot, digits = 7): Latex {
  const f = (v: number) => toLatexNumber(v, digits);
  if (Math.abs(im) < 1e-14 * Math.max(1, Math.abs(re))) return f(re);
  const imag = `${f(Math.abs(im))}i`;
  if (Math.abs(re) < 1e-14 * Math.abs(im)) return im < 0 ? `-${imag}` : imag;
  return `${f(re)} ${im < 0 ? '-' : '+'} ${imag}`;
}
