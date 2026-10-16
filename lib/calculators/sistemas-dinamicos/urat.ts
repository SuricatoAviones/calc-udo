/**
 * Funciones racionales de una variable con coeficientes racionales exactos, N(v)/D(v). Son los
 * elementos del arreglo de Routh cuando hay un parámetro (la ganancia K) o cuando un cero de la
 * primera columna se reemplaza por ε. La aritmética es exacta (`Rational` con `bigint`), así que
 * los elementos salen como en el libro (7/3, 2 − 9K/7) y los factores comunes se cancelan.
 */
import { toLatexNumber } from '@/lib/math/format';
import { polyRoots, type Poly } from '@/lib/math/polynomials';
import { Rational } from '@/lib/math/rational';

const DIGITS = 6;

type RPoly = Rational[];

export interface URat {
  num: RPoly;
  den: RPoly;
}

const R0 = Rational.ZERO;
const R1 = Rational.ONE;

function trim(p: RPoly): RPoly {
  let i = 0;
  while (i < p.length - 1 && p[i]!.isZero()) i++;
  return p.slice(i);
}

function isZeroPoly(p: RPoly): boolean {
  return p.every((c) => c.isZero());
}

function add(a: RPoly, b: RPoly): RPoly {
  const n = Math.max(a.length, b.length);
  const out: RPoly = Array.from({ length: n }, () => R0);
  a.forEach((c, i) => (out[n - a.length + i] = out[n - a.length + i]!.add(c)));
  b.forEach((c, i) => (out[n - b.length + i] = out[n - b.length + i]!.add(c)));
  return trim(out);
}

function scale(p: RPoly, k: Rational): RPoly {
  return trim(p.map((c) => c.mul(k)));
}

function mul(a: RPoly, b: RPoly): RPoly {
  const out: RPoly = Array.from({ length: a.length + b.length - 1 }, () => R0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] = out[i + j]!.add(x.mul(y)))));
  return trim(out);
}

function divmod(a: RPoly, b: RPoly): { q: RPoly; r: RPoly } {
  const num = trim(a).slice();
  const den = trim(b);
  if (num.length < den.length) return { q: [R0], r: num };
  const q: RPoly = Array.from({ length: num.length - den.length + 1 }, () => R0);
  for (let i = 0; i < q.length; i++) {
    const f = num[i]!.div(den[0]!);
    q[i] = f;
    for (let j = 0; j < den.length; j++) num[i + j] = num[i + j]!.sub(f.mul(den[j]!));
  }
  return { q, r: trim(num.slice(q.length)) };
}

function gcd(a: RPoly, b: RPoly): RPoly {
  let x = trim(a);
  let y = trim(b);
  while (!isZeroPoly(y)) {
    const { r } = divmod(x, y);
    x = y;
    y = r;
  }
  return scale(x, R1.div(x[0]!));
}

export const U_ZERO: URat = { num: [R0], den: [R1] };
export const U_ONE: URat = { num: [R1], den: [R1] };

export function uConst(c: number): URat {
  return { num: [Rational.fromNumber(c)], den: [R1] };
}

export function uVar(): URat {
  return { num: [R1, R0], den: [R1] };
}

/** Polinomio de coeficientes `number` (de mayor a menor grado). */
export function uFromPoly(p: Poly): URat {
  return { num: trim(p.map((c) => Rational.fromNumber(c))), den: [R1] };
}

export function uIsZero(a: URat): boolean {
  return isZeroPoly(a.num);
}

/** Cancela el máximo común divisor y deja el denominador mónico. */
export function uNormalize(a: URat): URat {
  if (isZeroPoly(a.num)) return U_ZERO;
  const g = gcd(a.num, a.den);
  let num = divmod(a.num, g).q;
  let den = divmod(a.den, g).q;
  const lead = den[0]!;
  num = scale(num, R1.div(lead));
  den = scale(den, R1.div(lead));
  return { num, den };
}

export function uAdd(a: URat, b: URat): URat {
  return uNormalize({ num: add(mul(a.num, b.den), mul(b.num, a.den)), den: mul(a.den, b.den) });
}

export function uNeg(a: URat): URat {
  return { num: scale(a.num, R1.neg()), den: a.den };
}

export function uSub(a: URat, b: URat): URat {
  return uAdd(a, uNeg(b));
}

export function uMul(a: URat, b: URat): URat {
  return uNormalize({ num: mul(a.num, b.num), den: mul(a.den, b.den) });
}

export function uDiv(a: URat, b: URat): URat {
  if (uIsZero(b)) throw new RangeError('División entre 0');
  return uNormalize({ num: mul(a.num, b.den), den: mul(a.den, b.num) });
}

export function uScale(a: URat, k: number): URat {
  return uNormalize({ num: scale(a.num, Rational.fromNumber(k)), den: a.den });
}

export function uIsConstant(a: URat): boolean {
  return trim(a.num).length === 1 && trim(a.den).length === 1;
}

export function uValue(a: URat): number {
  return trim(a.num)[0]!.div(trim(a.den)[0]!).toNumber();
}

function evalR(p: RPoly, v: number): number {
  return p.reduce((acc, c) => acc * v + c.toNumber(), 0);
}

export function uEval(a: URat, v: number): number {
  return evalR(a.num, v) / evalR(a.den, v);
}

/** Coeficiente de menor grado distinto de 0 y su grado. */
function lowest(p: RPoly): { coef: Rational; degree: number } {
  const q = trim(p);
  for (let i = q.length - 1; i >= 0; i--) {
    if (!q[i]!.isZero()) return { coef: q[i]!, degree: q.length - 1 - i };
  }
  return { coef: R0, degree: 0 };
}

/** Signo de a(v) cuando v → 0⁺ (para los elementos con ε). */
export function uSignAtZero(a: URat): -1 | 0 | 1 {
  if (uIsZero(a)) return 0;
  return (lowest(a.num).coef.sign() * lowest(a.den).coef.sign()) as -1 | 1;
}

/** Límite de a(v) cuando v → 0⁺. */
export function uLimitAtZero(a: URat): number {
  if (uIsZero(a)) return 0;
  const n = lowest(a.num);
  const d = lowest(a.den);
  if (n.degree > d.degree) return 0;
  if (n.degree === d.degree) return n.coef.div(d.coef).toNumber();
  return n.coef.sign() * d.coef.sign() * Infinity;
}

/** Raíces reales de N y D (donde el elemento cambia de signo o no existe). */
export function uCriticalPoints(a: URat): number[] {
  const out: number[] = [];
  for (const p of [a.num, a.den]) {
    if (trim(p).length < 2) continue;
    for (const r of polyRoots(p.map((c) => c.toNumber())))
      if (r.value.im === 0) out.push(r.value.re);
  }
  return out;
}

/** Coeficiente en LaTeX: entero, decimal corto o fracción; si el denominador es enorme, decimal. */
export function rationalTex(c: Rational): string {
  if (c.den > 999n) return toLatexNumber(c.toNumber(), DIGITS);
  return c.toLatex();
}

function polyTexR(p: RPoly, variable: string): string {
  const q = trim(p);
  const degree = q.length - 1;
  const terms: string[] = [];
  q.forEach((c, i) => {
    if (c.isZero()) return;
    const power = degree - i;
    const abs = c.abs();
    const base = power === 0 ? '' : power === 1 ? variable : `${variable}^{${power}}`;
    const coef = power > 0 && abs.eq(R1) ? '' : rationalTex(abs);
    const body = `${coef}${base}`;
    if (terms.length === 0) terms.push(c.sign() < 0 ? `-${body}` : body);
    else terms.push(c.sign() < 0 ? `- ${body}` : `+ ${body}`);
  });
  return terms.length === 0 ? '0' : terms.join(' ');
}

export function uTex(a: URat, variable: string): string {
  const den = trim(a.den);
  if (den.length === 1) return polyTexR(scale(a.num, R1.div(den[0]!)), variable);
  return `\\frac{${polyTexR(a.num, variable)}}{${polyTexR(den, variable)}}`;
}
