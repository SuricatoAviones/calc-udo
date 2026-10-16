/**
 * Álgebra simbólica pequeña para las ganancias de diagramas de bloques y flujogramas: G1, H2, a12,
 * K, s y números, con suma, producto, cociente y potencias enteras.
 *
 * - `MPoly`: polinomio en varias variables con coeficientes reales (lista de términos).
 * - `FRat`: cociente factorizado c · Π símbolosᵉ · Π (polinomio)ᵖ, con exponentes enteros
 *   (negativos en el denominador). Guardar los factores permite cancelar los que se repiten, como
 *   hace el estudiante: [G/(1 − GH)]·(1 − GH) = G. Al sumar se busca un denominador común y se
 *   intenta dividir el numerador exactamente entre cada factor del denominador.
 *
 * Si el resultado solo depende de s, se convierte en una función racional de s
 * (`frToUnivariate`) y se simplifica con aritmética exacta.
 */
import { parse, type MathNode } from 'mathjs';
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import { toLatexNumber } from '@/lib/math/format';
import { snap, trimPoly, type Poly } from '@/lib/math/polynomials';

const DIGITS = 6;
const num = (v: number) => toLatexNumber(v, DIGITS);

/** Límites para que un diagrama grande no haga crecer los polinomios sin control. */
const MAX_TERMS = 4000;
const MAX_POWER = 12;

export class SymbolicError extends Error {}

// ─── Monomios y polinomios ──────────────────────────────────────────────────

export interface Term {
  coef: number;
  /** Símbolo y exponente (≥ 1), ordenados por símbolo. */
  vars: [string, number][];
}

export type MPoly = Term[];

/** Orden natural de símbolos: G1 < G2 < G10 < H1 < K < s. */
export function compareSymbols(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}

function monoKey(vars: [string, number][]): string {
  return vars.map(([v, e]) => (e === 1 ? v : `${v}^${e}`)).join('*');
}

function degreeOf(t: Term): number {
  return t.vars.reduce((s, [, e]) => s + e, 0);
}

function exponent(t: Term, symbol: string): number {
  return t.vars.find(([v]) => v === symbol)?.[1] ?? 0;
}

function mergeVars(a: [string, number][], b: [string, number][], sign = 1): [string, number][] {
  const map = new Map<string, number>();
  for (const [v, e] of a) map.set(v, (map.get(v) ?? 0) + e);
  for (const [v, e] of b) map.set(v, (map.get(v) ?? 0) + sign * e);
  return [...map.entries()].filter(([, e]) => e !== 0).sort((x, y) => compareSymbols(x[0], y[0]));
}

/** Junta términos semejantes y quita coeficientes despreciables frente a `scale`. */
function normalize(terms: Term[], scale?: number): MPoly {
  const map = new Map<string, Term>();
  for (const t of terms) {
    if (t.coef === 0) continue;
    const key = monoKey(t.vars);
    const prev = map.get(key);
    if (prev) prev.coef += t.coef;
    else map.set(key, { coef: t.coef, vars: t.vars });
  }
  const size = scale ?? Math.max(0, ...terms.map((t) => Math.abs(t.coef)));
  const out = [...map.values()]
    .filter((t) => Math.abs(t.coef) > 1e-11 * Math.max(size, 1e-300))
    .map((t) => ({ coef: snap(t.coef), vars: t.vars }))
    .filter((t) => t.coef !== 0);
  if (out.length > MAX_TERMS) {
    throw new SymbolicError('La expresión creció demasiado (más de 4000 términos).');
  }
  return out.sort((a, b) => (monoKey(a.vars) < monoKey(b.vars) ? -1 : 1));
}

export function mpConst(c: number): MPoly {
  return c === 0 ? [] : [{ coef: c, vars: [] }];
}

export function mpSymbol(name: string): MPoly {
  return [{ coef: 1, vars: [[name, 1]] }];
}

export function mpIsZero(p: MPoly): boolean {
  return p.length === 0;
}

/** El valor si el polinomio es constante; `null` si depende de algún símbolo. */
export function mpConstant(p: MPoly): number | null {
  if (p.length === 0) return 0;
  if (p.length === 1 && p[0]!.vars.length === 0) return p[0]!.coef;
  return null;
}

export function mpAdd(a: MPoly, b: MPoly): MPoly {
  const scale = Math.max(0, ...a.map((t) => Math.abs(t.coef)), ...b.map((t) => Math.abs(t.coef)));
  return normalize(
    [...a, ...b].map((t) => ({ ...t })),
    scale,
  );
}

export function mpScale(p: MPoly, k: number): MPoly {
  if (k === 0) return [];
  return normalize(p.map((t) => ({ coef: t.coef * k, vars: t.vars })));
}

export function mpSub(a: MPoly, b: MPoly): MPoly {
  return mpAdd(a, mpScale(b, -1));
}

export function mpMul(a: MPoly, b: MPoly): MPoly {
  const out: Term[] = [];
  for (const x of a) {
    for (const y of b) out.push({ coef: x.coef * y.coef, vars: mergeVars(x.vars, y.vars) });
  }
  return normalize(out);
}

export function mpPow(p: MPoly, k: number): MPoly {
  let out = mpConst(1);
  for (let i = 0; i < k; i++) out = mpMul(out, p);
  return out;
}

export function mpSymbols(p: MPoly): string[] {
  const set = new Set<string>();
  for (const t of p) for (const [v] of t.vars) set.add(v);
  return [...set].sort(compareSymbols);
}

export function mpEquals(a: MPoly, b: MPoly): boolean {
  const d = mpSub(a, b);
  const scale = Math.max(
    1e-300,
    ...a.map((t) => Math.abs(t.coef)),
    ...b.map((t) => Math.abs(t.coef)),
  );
  return d.every((t) => Math.abs(t.coef) <= 1e-9 * scale);
}

export function mpEval(p: MPoly, values: ReadonlyMap<string, Complex>): Complex {
  let sum = C.ZERO;
  for (const t of p) {
    let term = C.complex(t.coef);
    for (const [v, e] of t.vars) {
      const value = values.get(v);
      if (!value) throw new SymbolicError(`Falta el valor de ${v}.`);
      term = C.mul(term, C.powInt(value, e));
    }
    sum = C.add(sum, term);
  }
  return sum;
}

/** Orden de presentación: en una sola variable, de mayor a menor grado; si no, de menor a mayor. */
function displayOrder(p: MPoly): Term[] {
  const symbols = mpSymbols(p);
  const terms = [...p];
  if (symbols.length === 1) return terms.sort((a, b) => degreeOf(b) - degreeOf(a));
  return terms.sort((a, b) => {
    const d = degreeOf(a) - degreeOf(b);
    if (d !== 0) return d;
    const ka = monoKey(a.vars);
    const kb = monoKey(b.vars);
    return ka.localeCompare(kb, 'en', { numeric: true });
  });
}

/** `G1` → `G_{1}`, `H_2` → `H_{2}`, `a12` → `a_{12}`, `Kp` → `\mathrm{Kp}`. */
export function symbolTex(name: string): string {
  const m = /^([A-Za-z]+)_?(\d+)$/.exec(name);
  if (m) return `${m[1]!.length === 1 ? m[1] : `\\mathrm{${m[1]}}`}_{${m[2]}}`;
  if (/^[A-Za-z]$/.test(name)) return name;
  return `\\mathrm{${name.replace(/_/g, '')}}`;
}

function monoTex(vars: [string, number][]): string {
  return vars.map(([v, e]) => `${symbolTex(v)}${e === 1 ? '' : `^{${e}}`}`).join('');
}

export function mpTex(p: MPoly): string {
  if (p.length === 0) return '0';
  return displayOrder(p)
    .map((t, i) => {
      const abs = Math.abs(t.coef);
      const body = monoTex(t.vars);
      const magnitude = body === '' ? num(abs) : abs === 1 ? '' : num(abs);
      const text = `${magnitude}${body}`;
      if (i === 0) return t.coef < 0 ? `-${text}` : text;
      return t.coef < 0 ? ` - ${text}` : ` + ${text}`;
    })
    .join('');
}

/** Polinomio en una sola variable (`variable`), de mayor a menor grado; `null` si hay otras. */
export function mpToUnivariate(p: MPoly, variable: string): Poly | null {
  if (p.length === 0) return [0];
  let degree = 0;
  for (const t of p) {
    for (const [v, e] of t.vars) {
      if (v !== variable) return null;
      degree = Math.max(degree, e);
    }
  }
  const out = Array<number>(degree + 1).fill(0);
  for (const t of p) out[degree - exponent(t, variable)]! += t.coef;
  return trimPoly(out);
}

export function mpFromUnivariate(p: Poly, variable: string): MPoly {
  const d = p.length - 1;
  return normalize(
    p.map((c, i) => ({
      coef: c,
      vars: d - i === 0 ? [] : ([[variable, d - i]] as [string, number][]),
    })),
  );
}

/** Coeficientes de `p` como polinomios en `main` cuyos coeficientes son MPoly en las demás. */
export function mpCollect(p: MPoly, main: string): MPoly[] {
  let degree = 0;
  for (const t of p) degree = Math.max(degree, exponent(t, main));
  const out: Term[][] = Array.from({ length: degree + 1 }, () => []);
  for (const t of p) {
    const e = exponent(t, main);
    out[degree - e]!.push({ coef: t.coef, vars: t.vars.filter(([v]) => v !== main) });
  }
  return out.map((terms) => normalize(terms));
}

// ─── División exacta (orden lexicográfico) ──────────────────────────────────

function leading(p: MPoly, order: string[]): Term {
  let best = p[0]!;
  for (const t of p) {
    for (const v of order) {
      const d = exponent(t, v) - exponent(best, v);
      if (d > 0) {
        best = t;
        break;
      }
      if (d < 0) break;
    }
  }
  return best;
}

/** a / b si la división es exacta; `null` si no lo es. */
export function mpDivExact(a: MPoly, b: MPoly): MPoly | null {
  if (b.length === 0) return null;
  if (a.length === 0) return [];
  const order = [...new Set([...mpSymbols(a), ...mpSymbols(b)])].sort(compareSymbols);
  const lb = leading(b, order);
  const scale = Math.max(1e-300, ...a.map((t) => Math.abs(t.coef)));
  let r = a;
  const q: Term[] = [];
  for (let guard = 0; r.length > 0; guard++) {
    if (guard > 2000) return null;
    const lr = leading(r, order);
    const vars = mergeVars(lr.vars, lb.vars, -1);
    if (vars.some(([, e]) => e < 0)) return null;
    const t: Term = { coef: lr.coef / lb.coef, vars };
    q.push(t);
    r = normalize(
      [...r, ...b.map((x) => ({ coef: -x.coef * t.coef, vars: mergeVars(x.vars, t.vars) }))],
      scale,
    );
  }
  return normalize(q);
}

// ─── Cocientes factorizados ─────────────────────────────────────────────────

export interface Factor {
  /** Polinomio de dos o más términos, normalizado (su primer término de presentación vale 1). */
  poly: MPoly;
  key: string;
  power: number;
}

export interface FRat {
  coef: number;
  /** Símbolo → exponente entero (negativo: en el denominador). */
  mono: [string, number][];
  factors: Factor[];
}

export const FR_ZERO: FRat = { coef: 0, mono: [], factors: [] };
export const FR_ONE: FRat = { coef: 1, mono: [], factors: [] };

export function frConst(c: number): FRat {
  return { coef: c, mono: [], factors: [] };
}

export function frIsZero(f: FRat): boolean {
  return f.coef === 0;
}

/** Separa de un polinomio su contenido (número y monomio comunes) y el factor primitivo. */
export function frFromPoly(p: MPoly): FRat {
  if (p.length === 0) return FR_ZERO;
  if (p.length === 1) return { coef: p[0]!.coef, mono: p[0]!.vars, factors: [] };
  // Monomio común: el menor exponente de cada símbolo presente en todos los términos.
  const common = new Map<string, number>();
  for (const [v] of p[0]!.vars) {
    const min = Math.min(...p.map((t) => exponent(t, v)));
    if (min > 0) common.set(v, min);
  }
  const commonVars = [...common.entries()].sort((a, b) => compareSymbols(a[0], b[0]));
  const reduced = normalize(
    p.map((t) => ({ coef: t.coef, vars: mergeVars(t.vars, commonVars, -1) })),
  );
  const first = displayOrder(reduced)[0]!;
  const lead = first.coef;
  const primitive = normalize(reduced.map((t) => ({ coef: t.coef / lead, vars: t.vars })));
  return {
    coef: lead,
    mono: commonVars,
    factors: [{ poly: primitive, key: monoKeyOf(primitive), power: 1 }],
  };
}

function monoKeyOf(p: MPoly): string {
  return p.map((t) => `${snap(t.coef)}·${monoKey(t.vars)}`).join('+');
}

export function frSymbol(name: string): FRat {
  return { coef: 1, mono: [[name, 1]], factors: [] };
}

function mergeFactors(a: Factor[], b: Factor[], sign = 1): Factor[] {
  const map = new Map<string, Factor>();
  for (const f of a) map.set(f.key, { ...f });
  for (const f of b) {
    const prev = map.get(f.key);
    if (prev) prev.power += sign * f.power;
    else map.set(f.key, { ...f, power: sign * f.power });
  }
  return [...map.values()].filter((f) => f.power !== 0);
}

/** Intenta dividir exactamente cada factor del numerador entre cada factor del denominador. */
function cancel(f: FRat): FRat {
  let current = f;
  for (let pass = 0; pass < 8; pass++) {
    const tops = current.factors.filter((x) => x.power > 0);
    const bottoms = current.factors.filter((x) => x.power < 0);
    let changed = false;
    outer: for (const top of tops) {
      for (const bottom of bottoms) {
        for (const [dividend, divisor, topIsDividend] of [
          [top, bottom, true],
          [bottom, top, false],
        ] as const) {
          const q = mpDivExact(dividend.poly, divisor.poly);
          if (!q) continue;
          // dividend = q·divisor: se cancela un factor de cada lado y queda q.
          const quotient = frFromPoly(q);
          const removeTop: Factor = { ...top, power: 1 };
          const removeBottom: Factor = { ...bottom, power: -1 };
          let rest: FRat = {
            coef: current.coef,
            mono: current.mono,
            factors: mergeFactors(current.factors, [removeTop, removeBottom], -1),
          };
          rest = frMulRaw(rest, topIsDividend ? quotient : frInv(quotient));
          current = rest;
          changed = true;
          break outer;
        }
      }
    }
    if (!changed) break;
  }
  return current;
}

function frMulRaw(a: FRat, b: FRat): FRat {
  if (a.coef === 0 || b.coef === 0) return FR_ZERO;
  return {
    coef: snap(a.coef * b.coef),
    mono: mergeVars(a.mono, b.mono),
    factors: mergeFactors(a.factors, b.factors),
  };
}

export function frMul(a: FRat, b: FRat): FRat {
  return cancel(frMulRaw(a, b));
}

export function frInv(a: FRat): FRat {
  if (a.coef === 0) throw new SymbolicError('División entre 0.');
  return {
    coef: 1 / a.coef,
    mono: a.mono.map(([v, e]) => [v, -e]),
    factors: a.factors.map((f) => ({ ...f, power: -f.power })),
  };
}

export function frDiv(a: FRat, b: FRat): FRat {
  return frMul(a, frInv(b));
}

export function frNeg(a: FRat): FRat {
  return { ...a, coef: -a.coef };
}

export function frPow(a: FRat, k: number): FRat {
  if (k === 0) return FR_ONE;
  if (k < 0) return frPow(frInv(a), -k);
  let out = FR_ONE;
  for (let i = 0; i < k; i++) out = frMulRaw(out, a);
  return out;
}

/** Parte con exponentes positivos (numerador) o negativos (denominador) como polinomio. */
function expandPart(f: FRat, side: 1 | -1): MPoly {
  let p = mpConst(side === 1 ? f.coef : 1);
  const monoVars = f.mono.filter(([, e]) => e * side > 0).map(([v, e]) => [v, Math.abs(e)]);
  if (monoVars.length) p = mpMul(p, [{ coef: 1, vars: monoVars as [string, number][] }]);
  for (const factor of f.factors) {
    if (factor.power * side > 0) p = mpMul(p, mpPow(factor.poly, Math.abs(factor.power)));
  }
  return p;
}

export function frNumerator(f: FRat): MPoly {
  return expandPart(f, 1);
}

export function frDenominator(f: FRat): MPoly {
  return expandPart(f, -1);
}

export function frAdd(a: FRat, b: FRat): FRat {
  if (a.coef === 0) return b;
  if (b.coef === 0) return a;
  // Denominador común: cada factor y símbolo del denominador con su mayor exponente.
  const denMono = new Map<string, number>();
  for (const [v, e] of [...a.mono, ...b.mono]) {
    if (e < 0) denMono.set(v, Math.max(denMono.get(v) ?? 0, -e));
  }
  const denFactors = new Map<string, Factor>();
  for (const f of [...a.factors, ...b.factors]) {
    if (f.power >= 0) continue;
    const prev = denFactors.get(f.key);
    if (!prev || prev.power < -f.power) denFactors.set(f.key, { ...f, power: -f.power });
  }
  const common: FRat = {
    coef: 1,
    mono: [...denMono.entries()].sort((x, y) => compareSymbols(x[0], y[0])),
    factors: [...denFactors.values()],
  };
  // a·D y b·D ya no tienen denominador: se expanden y se suman.
  const sum = mpAdd(frNumerator(frMulRaw(a, common)), frNumerator(frMulRaw(b, common)));
  if (sum.length === 0) return FR_ZERO;
  return frMul(frFromPoly(sum), frInv(common));
}

export function frSub(a: FRat, b: FRat): FRat {
  return frAdd(a, frNeg(b));
}

export function frSymbols(f: FRat): string[] {
  const set = new Set<string>();
  for (const [v] of f.mono) set.add(v);
  for (const factor of f.factors) for (const v of mpSymbols(factor.poly)) set.add(v);
  return [...set].sort(compareSymbols);
}

/** zᵏ con k entero de cualquier signo. */
function powSigned(z: Complex, k: number): Complex {
  const p = C.powInt(z, Math.abs(k));
  return k >= 0 ? p : C.div(C.ONE, p);
}

export function frEval(f: FRat, values: ReadonlyMap<string, Complex>): Complex {
  let out = C.complex(f.coef);
  for (const [v, e] of f.mono) {
    const value = values.get(v);
    if (!value) throw new SymbolicError(`Falta el valor de ${v}.`);
    out = C.mul(out, powSigned(value, e));
  }
  for (const factor of f.factors) {
    out = C.mul(out, powSigned(mpEval(factor.poly, values), factor.power));
  }
  return out;
}

/** Valores de prueba deterministas para comparar dos expresiones. */
export function probeValues(symbols: string[], seed = 0): Map<string, Complex> {
  return new Map(
    symbols.map((s, i) => [s, C.complex(0.37 + 0.191 * (i + seed), 0.23 + 0.071 * (i + 2 * seed))]),
  );
}

/** ¿Son iguales como funciones? Se comparan en dos juegos de valores de prueba. */
export function frEquivalent(a: FRat, b: FRat): boolean {
  const symbols = [...new Set([...frSymbols(a), ...frSymbols(b)])];
  for (const seed of [0, 3]) {
    const values = probeValues(symbols, seed);
    const x = frEval(a, values);
    const y = frEval(b, values);
    if (C.abs(C.sub(x, y)) > 1e-7 * Math.max(1, C.abs(x), C.abs(y))) return false;
  }
  return true;
}

/** N/D como funciones racionales de `variable` si no hay otros símbolos. */
export function frToUnivariate(f: FRat, variable: string): { num: Poly; den: Poly } | null {
  const numP = mpToUnivariate(frNumerator(f), variable);
  const denP = mpToUnivariate(frDenominator(f), variable);
  if (!numP || !denP) return null;
  return { num: numP, den: denP };
}

// ─── LaTeX de cocientes factorizados ────────────────────────────────────────

function isSum(p: MPoly): boolean {
  return p.length > 1;
}

/** Producto de la parte de un lado: `G_{1}G_{2}(1 - H_{1})^{2}`. */
function sideTex(f: FRat, side: 1 | -1, withCoef: boolean): { tex: string; items: number } {
  const parts: string[] = [];
  const mono = f.mono.filter(([, e]) => e * side > 0).map(([v, e]) => [v, Math.abs(e)]);
  const factors = f.factors.filter((x) => x.power * side > 0);
  const items = mono.length + factors.length;
  if (mono.length) parts.push(monoTex(mono as [string, number][]));
  for (const factor of factors) {
    const p = Math.abs(factor.power);
    const inner = mpTex(factor.poly);
    const wrap = isSum(factor.poly) && (items > 1 || p > 1 || withCoef);
    const base = wrap ? `\\left(${inner}\\right)` : inner;
    parts.push(p === 1 ? base : `${wrap ? base : `\\left(${base}\\right)`}^{${p}}`);
  }
  return { tex: parts.join(''), items };
}

export function frTex(f: FRat): string {
  if (f.coef === 0) return '0';
  const abs = Math.abs(f.coef);
  const sign = f.coef < 0 ? '-' : '';
  const hasCoef = abs !== 1;
  const top = sideTex(f, 1, hasCoef);
  const bottom = sideTex(f, -1, false);
  let numerator: string;
  if (top.items === 0) numerator = num(abs);
  else numerator = `${hasCoef ? num(abs) : ''}${top.tex}`;
  if (bottom.items === 0) return `${sign}${numerator}`;
  return `${sign}\\frac{${numerator}}{${bottom.tex}}`;
}

/** Como `frTex`, pero entre paréntesis si es una suma o lleva signo (para productos). */
export function frOperandTex(f: FRat): string {
  const tex = frTex(f);
  if (f.coef < 0) return `\\left(${tex}\\right)`;
  const hasDen = f.mono.some(([, e]) => e < 0) || f.factors.some((x) => x.power < 0);
  const topItems =
    f.mono.filter(([, e]) => e > 0).length + f.factors.filter((x) => x.power > 0).length;
  const bareSum =
    !hasDen &&
    Math.abs(f.coef) === 1 &&
    topItems === 1 &&
    f.factors.some((x) => x.power === 1 && isSum(x.poly));
  return bareSum ? `\\left(${tex}\\right)` : tex;
}

// ─── Lectura de expresiones ─────────────────────────────────────────────────

const MATH_FUNCTIONS = new Set([
  'sin',
  'sen',
  'cos',
  'tan',
  'tg',
  'exp',
  'log',
  'ln',
  'sqrt',
  'abs',
  'sinh',
  'cosh',
  'tanh',
  'asin',
  'acos',
  'atan',
  'u',
  'delta',
]);

/** `G1G2H1` → [G1, G2, H1]: varios símbolos de una letra y número pegados son un producto. */
function splitProduct(name: string): string[] {
  if (/^([A-Za-z]\d+){2,}$/.test(name)) return name.match(/[A-Za-z]\d+/g)!;
  return [name];
}

function toFRat(node: MathNode): FRat {
  switch (node.type) {
    case 'ConstantNode': {
      const value = (node as unknown as { value: unknown }).value;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new SymbolicError('La expresión tiene un valor que no es un número.');
      }
      return frConst(value);
    }
    case 'SymbolNode': {
      const name = (node as unknown as { name: string }).name;
      if (name === 'pi') return frConst(Math.PI);
      if (name === 'e') return frConst(Math.E);
      return splitProduct(name).reduce<FRat>((acc, s) => frMulRaw(acc, frSymbol(s)), FR_ONE);
    }
    case 'ParenthesisNode':
      return toFRat((node as unknown as { content: MathNode }).content);
    case 'FunctionNode': {
      // mathjs lee «s(s + 1)» y «K(s + 2)» como llamadas a función: son productos. «G1(s)» es la
      // notación de una función de transferencia y se lee como G1.
      const fn = node as unknown as { fn: { name: string }; args: MathNode[] };
      const name = fn.fn.name;
      const [arg] = fn.args;
      if (MATH_FUNCTIONS.has(name.toLowerCase()) || fn.args.length !== 1 || !arg) {
        throw new SymbolicError(`La función «${name}» no está soportada.`);
      }
      const isVariable =
        arg.type === 'SymbolNode' && (arg as unknown as { name: string }).name === 's';
      if (isVariable && /^[A-Z][A-Za-z]*_?\d*$/.test(name)) return frSymbol(name);
      const factor = splitProduct(name).reduce<FRat>(
        (acc, s) => frMulRaw(acc, frSymbol(s)),
        FR_ONE,
      );
      return frMul(factor, toFRat(arg));
    }
    case 'OperatorNode': {
      const op = node as unknown as { fn: string; args: MathNode[] };
      const [a, b] = op.args;
      switch (op.fn) {
        case 'unaryMinus':
          return frNeg(toFRat(a!));
        case 'unaryPlus':
          return toFRat(a!);
        case 'add':
          return frAdd(toFRat(a!), toFRat(b!));
        case 'subtract':
          return frSub(toFRat(a!), toFRat(b!));
        case 'multiply':
          return frMul(toFRat(a!), toFRat(b!));
        case 'divide': {
          const d = toFRat(b!);
          if (d.coef === 0) throw new SymbolicError('División entre 0.');
          return frDiv(toFRat(a!), d);
        }
        case 'pow': {
          const exp = toFRat(b!);
          if (exp.mono.length || exp.factors.length || !Number.isInteger(exp.coef)) {
            throw new SymbolicError('Los exponentes deben ser enteros.');
          }
          if (Math.abs(exp.coef) > MAX_POWER) {
            throw new SymbolicError(
              `Los exponentes deben estar entre −${MAX_POWER} y ${MAX_POWER}.`,
            );
          }
          const base = toFRat(a!);
          if (base.coef === 0 && exp.coef < 0) throw new SymbolicError('División entre 0.');
          return cancel(frPow(base, exp.coef));
        }
        default:
          throw new SymbolicError(`El operador «${op.fn}» no está soportado.`);
      }
    }
    default:
      throw new SymbolicError('La expresión no es válida.');
  }
}

export type GainResult = { ok: true; value: FRat } | { ok: false; message: string };

/**
 * Lee una ganancia: `G1`, `-H2`, `G1*G2`, `10/(s + 1)`, `K/(s(s + 2))`, `a12`. Varios símbolos
 * de una letra y número pegados (`G1G2`) se leen como producto.
 */
export function parseGain(source: string): GainResult {
  const trimmed = source.trim();
  if (trimmed === '') return { ok: false, message: 'Escribe la ganancia.' };
  if (trimmed.length > 200) return { ok: false, message: 'La expresión es demasiado larga.' };
  let node: MathNode;
  try {
    node = parse(trimmed);
  } catch {
    return { ok: false, message: 'La expresión no es válida: revisa los paréntesis y operadores.' };
  }
  try {
    return { ok: true, value: toFRat(node) };
  } catch (error) {
    if (error instanceof SymbolicError) return { ok: false, message: error.message };
    return { ok: false, message: 'La expresión no es válida.' };
  }
}

/** Polinomio en varias variables escrito por el estudiante (p. ej. s³ + 3s² + 2s + K). */
export function parsePolynomial(
  source: string,
): { ok: true; poly: MPoly } | { ok: false; message: string } {
  const parsed = parseGain(source);
  if (!parsed.ok) return parsed;
  if (
    frDenominator(parsed.value).length !== 1 ||
    mpConstant(frDenominator(parsed.value)) === null
  ) {
    return {
      ok: false,
      message: 'Debe ser un polinomio (sin divisiones entre s ni entre parámetros).',
    };
  }
  const den = mpConstant(frDenominator(parsed.value))!;
  return { ok: true, poly: mpScale(frNumerator(parsed.value), 1 / den) };
}
