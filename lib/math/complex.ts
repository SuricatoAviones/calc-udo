/**
 * Números complejos para fasores, impedancias, polos y residuos.
 *
 * Se usa `j` como unidad imaginaria (la notación de los libros de circuitos: Hayt, Dorf), para no
 * confundirla con la corriente i. Los ángulos se guardan en radianes y se muestran en grados en
 * la forma polar `M∠θ°`.
 */
import { formatNumber, toLatexNumber } from './format';

export interface Complex {
  re: number;
  im: number;
}

export function complex(re: number, im = 0): Complex {
  return { re, im };
}

export const ZERO: Complex = { re: 0, im: 0 };
export const ONE: Complex = { re: 1, im: 0 };
export const J: Complex = { re: 0, im: 1 };

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function sub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function mul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

export function scale(a: Complex, k: number): Complex {
  return { re: a.re * k, im: a.im * k };
}

/** a / b. Devuelve `NaN` en ambas partes si b = 0. */
export function div(a: Complex, b: Complex): Complex {
  // Algoritmo de Smith: evita desbordes cuando |b| es grande o pequeño.
  if (b.re === 0 && b.im === 0) return { re: NaN, im: NaN };
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const r = b.im / b.re;
    const d = b.re + b.im * r;
    return { re: (a.re + a.im * r) / d, im: (a.im - a.re * r) / d };
  }
  const r = b.re / b.im;
  const d = b.re * r + b.im;
  return { re: (a.re * r + a.im) / d, im: (a.im * r - a.re) / d };
}

export function neg(a: Complex): Complex {
  return { re: -a.re, im: -a.im };
}

export function conj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

export function abs(a: Complex): number {
  return Math.hypot(a.re, a.im);
}

/** Ángulo en radianes, en (−π, π]. */
export function arg(a: Complex): number {
  return Math.atan2(a.im, a.re);
}

export function exp(a: Complex): Complex {
  const m = Math.exp(a.re);
  return { re: m * Math.cos(a.im), im: m * Math.sin(a.im) };
}

/** Logaritmo principal. */
export function log(a: Complex): Complex {
  return { re: Math.log(abs(a)), im: arg(a) };
}

/** aⁿ con n entero (n ≥ 0). */
export function powInt(a: Complex, n: number): Complex {
  let result = ONE;
  for (let k = 0; k < n; k++) result = mul(result, a);
  return result;
}

export function fromPolar(magnitude: number, angleRad: number): Complex {
  return { re: magnitude * Math.cos(angleRad), im: magnitude * Math.sin(angleRad) };
}

export function degrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function radians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** ¿Es (numéricamente) real? Compara la parte imaginaria con la escala del número. */
export function isReal(a: Complex, tolerance = 1e-9): boolean {
  return Math.abs(a.im) <= tolerance * Math.max(1, Math.abs(a.re));
}

export function isZero(a: Complex, tolerance = 1e-12): boolean {
  return abs(a) <= tolerance;
}

/** Limpia el ruido de coma flotante: partes despreciables frente a la otra se vuelven 0. */
export function clean(a: Complex, tolerance = 1e-12): Complex {
  const size = Math.max(abs(a), 1e-300);
  return {
    re: Math.abs(a.re) <= tolerance * size ? 0 : a.re,
    im: Math.abs(a.im) <= tolerance * size ? 0 : a.im,
  };
}

/** Forma rectangular en LaTeX: `3 - j4`, `j2`, `-5`. */
export function toLatexRect(a: Complex, digits = 6): string {
  const c = clean(a, 1e-10);
  const re = c.re;
  const im = c.im;
  if (im === 0) return toLatexNumber(re, digits);
  const imagAbs = toLatexNumber(Math.abs(im), digits);
  const imag = imagAbs === '1' ? 'j' : `j${imagAbs}`;
  if (re === 0) return im < 0 ? `-${imag}` : imag;
  return `${toLatexNumber(re, digits)} ${im < 0 ? '-' : '+'} ${imag}`;
}

/** Forma rectangular en texto plano (para explicaciones): `3 − j4`, `−2`. */
export function toTextRect(a: Complex, digits = 6): string {
  const c = clean(a, 1e-10);
  const fmt = (v: number) => formatNumber(v, digits).replace('-', '−');
  if (c.im === 0) return fmt(c.re);
  const imagAbs = formatNumber(Math.abs(c.im), digits);
  const imag = imagAbs === '1' ? 'j' : `j${imagAbs}`;
  if (c.re === 0) return c.im < 0 ? `−${imag}` : imag;
  return `${fmt(c.re)} ${c.im < 0 ? '−' : '+'} ${imag}`;
}

/** Forma polar en LaTeX: `5\angle -53.13^{\circ}`. */
export function toLatexPolar(a: Complex, digits = 6): string {
  const magnitude = abs(a);
  if (magnitude === 0) return '0';
  const angle = degrees(arg(a));
  // Las llaves evitan un doble superíndice si el ángulo sale en notación científica (10^{-13}).
  return `${toLatexNumber(magnitude, digits)}\\angle {${toLatexNumber(angle, digits)}}^{\\circ}`;
}
