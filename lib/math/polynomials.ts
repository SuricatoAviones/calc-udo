/**
 * Polinomios con coeficientes reales, de mayor a menor grado (la convención de
 * `metodos-numericos/polynomial.ts`): `[1, 3, 2]` es s² + 3s + 2.
 *
 * Incluye la aritmética que piden las fracciones parciales (producto, división larga, derivada),
 * el desarrollo de Taylor alrededor de un punto complejo y las raíces con su multiplicidad.
 *
 * Raíces. Si los coeficientes son decimales "limpios" (lo usual cuando el estudiante escribe el
 * polinomio), primero se separa el polinomio en factores sin raíces repetidas con el algoritmo de
 * Yun en aritmética racional exacta: la multiplicidad sale exacta, sin tolerancias. Cada factor
 * se resuelve con el método de Aberth-Ehrlich, que converge cuadráticamente en raíces simples. Si
 * los coeficientes traen ruido de coma flotante, se usa Aberth sobre todo el polinomio y las
 * raíces casi iguales se agrupan como una raíz múltiple.
 */
import * as C from './complex';
import type { Complex } from './complex';
import { Rational } from './rational';

export type Poly = number[];

/** Quita ceros a la izquierda (deja al menos un coeficiente). */
export function trimPoly(p: Poly): Poly {
  let i = 0;
  while (i < p.length - 1 && p[i] === 0) i++;
  return p.slice(i);
}

export function degree(p: Poly): number {
  return trimPoly(p).length - 1;
}

export function isZeroPoly(p: Poly): boolean {
  return p.every((c) => c === 0);
}

export function addPoly(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out = Array<number>(n).fill(0);
  a.forEach((c, i) => (out[n - a.length + i]! += c));
  b.forEach((c, i) => (out[n - b.length + i]! += c));
  return trimPoly(out);
}

export function scalePoly(p: Poly, k: number): Poly {
  return trimPoly(p.map((c) => c * k));
}

export function subPoly(a: Poly, b: Poly): Poly {
  return addPoly(a, scalePoly(b, -1));
}

export function mulPoly(a: Poly, b: Poly): Poly {
  const out = Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j]! += x * y)));
  return trimPoly(out);
}

export function powPoly(p: Poly, n: number): Poly {
  let out: Poly = [1];
  for (let k = 0; k < n; k++) out = mulPoly(out, p);
  return out;
}

/** División larga: a = q·b + r con grado(r) < grado(b). */
export function dividePoly(a: Poly, b: Poly): { quotient: Poly; remainder: Poly } {
  const num = trimPoly(a).slice();
  const den = trimPoly(b);
  if (den.length === 1 && den[0] === 0) throw new RangeError('División entre el polinomio cero');
  if (num.length < den.length) return { quotient: [0], remainder: num };
  const quotient = Array<number>(num.length - den.length + 1).fill(0);
  for (let i = 0; i < quotient.length; i++) {
    const factor = num[i]! / den[0]!;
    quotient[i] = factor;
    for (let j = 0; j < den.length; j++) num[i + j]! -= factor * den[j]!;
  }
  const remainder = trimPoly(num.slice(quotient.length));
  // Lo que en teoría es 0 queda como ruido de redondeo frente al tamaño del dividendo.
  const size = Math.max(...a.map(Math.abs), 1e-300);
  return {
    quotient,
    remainder: trimPoly(remainder.map((c) => (Math.abs(c) < 1e-13 * size ? 0 : c))),
  };
}

export function derivPoly(p: Poly): Poly {
  const n = p.length - 1;
  if (n <= 0) return [0];
  return p.slice(0, -1).map((c, i) => c * (n - i));
}

export function evalPoly(p: Poly, x: number): number {
  return p.reduce((acc, c) => acc * x + c, 0);
}

export function evalPolyComplex(p: readonly (number | Complex)[], z: Complex): Complex {
  let acc = C.ZERO;
  for (const c of p) acc = C.add(C.mul(acc, z), typeof c === 'number' ? C.complex(c) : c);
  return acc;
}

/** Polinomio real a partir de sus raíces (las complejas deben venir en pares conjugados). */
export function polyFromRoots(roots: Complex[], lead = 1): Poly {
  let p: Complex[] = [C.ONE];
  for (const r of roots) {
    const next: Complex[] = Array.from({ length: p.length + 1 }, () => C.ZERO);
    p.forEach((c, i) => {
      next[i] = C.add(next[i]!, c);
      next[i + 1] = C.sub(next[i + 1]!, C.mul(c, r));
    });
    p = next;
  }
  return p.map((c) => c.re * lead);
}

/**
 * Coeficientes de Taylor de P alrededor de `center`: P(center + h) = Σ c_k h^k, k = 0 … order.
 * Se obtienen con divisiones sintéticas sucesivas entre (x − center): c_k = P⁽ᵏ⁾(center)/k!.
 */
export function taylorCoefficients(
  p: readonly (number | Complex)[],
  center: Complex,
  order: number,
): Complex[] {
  let a: Complex[] = p.map((c) => (typeof c === 'number' ? C.complex(c) : c));
  const out: Complex[] = [];
  for (let k = 0; k <= order; k++) {
    if (a.length === 0) {
      out.push(C.ZERO);
      continue;
    }
    const q: Complex[] = [];
    let acc = C.ZERO;
    for (let i = 0; i < a.length; i++) {
      acc = C.add(C.mul(acc, center), a[i]!);
      if (i < a.length - 1) q.push(acc);
    }
    out.push(acc);
    a = q;
  }
  return out;
}

/** Divide P entre (x − root) `times` veces (división sintética compleja, sin residuo). */
export function deflate(p: readonly (number | Complex)[], root: Complex, times = 1): Complex[] {
  let a: Complex[] = p.map((c) => (typeof c === 'number' ? C.complex(c) : c));
  for (let t = 0; t < times; t++) {
    const q: Complex[] = [];
    let acc = C.ZERO;
    for (let i = 0; i < a.length - 1; i++) {
      acc = C.add(C.mul(acc, root), a[i]!);
      q.push(acc);
    }
    a = q.length > 0 ? q : [C.ZERO];
  }
  return a;
}

// ─── Raíces ─────────────────────────────────────────────────────────────────

export interface PolyRoot {
  value: Complex;
  multiplicity: number;
}

/** Aberth-Ehrlich sobre un polinomio sin raíz en 0. Devuelve las n raíces (con repeticiones). */
function aberth(p: Poly): Complex[] {
  const lead = p[0]!;
  const monic = p.map((c) => c / lead);
  const n = monic.length - 1;
  if (n === 1) return [C.complex(-monic[1]!)];
  const dp = derivPoly(monic);
  // Radio inicial: cota de Fujiwara (todas las raíces caben en ese disco).
  let bound = 0;
  for (let k = 1; k <= n; k++) bound = Math.max(bound, Math.abs(monic[k]!) ** (1 / k));
  const radius = Math.max(bound, 1e-3);
  const z: Complex[] = Array.from({ length: n }, (_, k) =>
    C.fromPolar(radius, (2 * Math.PI * k) / n + 0.4),
  );
  for (let iter = 0; iter < 800; iter++) {
    let maxStep = 0;
    for (let i = 0; i < n; i++) {
      const pz = evalPolyComplex(monic, z[i]!);
      if (C.abs(pz) === 0) continue;
      const dpz = evalPolyComplex(dp, z[i]!);
      const ratio = C.abs(dpz) === 0 ? C.complex(1e-8) : C.div(pz, dpz);
      let sum = C.ZERO;
      for (let j = 0; j < n; j++) {
        if (j !== i) sum = C.add(sum, C.div(C.ONE, C.sub(z[i]!, z[j]!)));
      }
      const step = C.div(ratio, C.sub(C.ONE, C.mul(ratio, sum)));
      if (!Number.isFinite(step.re) || !Number.isFinite(step.im)) continue;
      z[i] = C.sub(z[i]!, step);
      maxStep = Math.max(maxStep, C.abs(step) / Math.max(1, C.abs(z[i]!)));
    }
    if (maxStep < 1e-16) break;
  }
  return z;
}

/** Redondea a un decimal "limpio" si la diferencia es solo ruido de coma flotante. */
export function snap(x: number): number {
  if (x === 0) return 0;
  for (let decimals = 0; decimals <= 9; decimals++) {
    const k = 10 ** decimals;
    const rounded = Math.round(x * k) / k;
    if (Math.abs(rounded - x) <= 1e-11 * Math.max(1, Math.abs(x))) return rounded;
  }
  return x;
}

function snapComplex(z: Complex): Complex {
  const size = Math.max(1, C.abs(z));
  const im = Math.abs(z.im) <= 1e-10 * size ? 0 : snap(z.im);
  const re = Math.abs(z.re) <= 1e-12 * size ? 0 : snap(z.re);
  return { re, im };
}

/** Empareja raíces complejas en conjugadas exactas (el polinomio es real). */
function enforceConjugates(roots: PolyRoot[]): PolyRoot[] {
  const out: PolyRoot[] = [];
  const upper = roots.filter((r) => r.value.im > 0);
  const real = roots.filter((r) => r.value.im === 0);
  for (const r of real) out.push(r);
  for (const r of upper) {
    out.push(r);
    out.push({ value: C.conj(r.value), multiplicity: r.multiplicity });
  }
  return out;
}

/** Orden de presentación: reales de mayor a menor, luego complejas por parte real. */
function sortRoots(roots: PolyRoot[]): PolyRoot[] {
  return [...roots].sort((a, b) => {
    const ar = a.value.im === 0 ? 0 : 1;
    const br = b.value.im === 0 ? 0 : 1;
    if (ar !== br) return ar - br;
    if (a.value.re !== b.value.re) return b.value.re - a.value.re;
    return b.value.im - a.value.im;
  });
}

/** Agrupa raíces numéricamente casi iguales (cada grupo = una raíz múltiple). */
function clusterRoots(values: Complex[]): PolyRoot[] {
  const groups: Complex[][] = [];
  for (const v of values) {
    const group = groups.find((g) => {
      const mean = g.reduce((s, x) => C.add(s, x), C.ZERO);
      const m = C.scale(mean, 1 / g.length);
      return C.abs(C.sub(m, v)) <= 1e-4 * Math.max(1, C.abs(m));
    });
    if (group) group.push(v);
    else groups.push([v]);
  }
  return groups.map((g) => ({
    value: C.scale(
      g.reduce((s, x) => C.add(s, x), C.ZERO),
      1 / g.length,
    ),
    multiplicity: g.length,
  }));
}

// Aritmética exacta para la factorización libre de cuadrados.
type RPoly = Rational[];

function rTrim(p: RPoly): RPoly {
  let i = 0;
  while (i < p.length - 1 && p[i]!.isZero()) i++;
  return p.slice(i);
}

function rDeriv(p: RPoly): RPoly {
  const n = p.length - 1;
  if (n <= 0) return [Rational.ZERO];
  return p.slice(0, -1).map((c, i) => c.mul(Rational.of(n - i)));
}

function rDivide(a: RPoly, b: RPoly): { q: RPoly; r: RPoly } {
  const num = rTrim(a).slice();
  const den = rTrim(b);
  if (num.length < den.length) return { q: [Rational.ZERO], r: num };
  const q: RPoly = Array.from({ length: num.length - den.length + 1 }, () => Rational.ZERO);
  for (let i = 0; i < q.length; i++) {
    const factor = num[i]!.div(den[0]!);
    q[i] = factor;
    for (let j = 0; j < den.length; j++) num[i + j] = num[i + j]!.sub(factor.mul(den[j]!));
  }
  return { q, r: rTrim(num.slice(q.length)) };
}

function rIsZero(p: RPoly): boolean {
  return p.every((c) => c.isZero());
}

function rMonic(p: RPoly): RPoly {
  const t = rTrim(p);
  return t.map((c) => c.div(t[0]!));
}

function rGcd(a: RPoly, b: RPoly): RPoly {
  let x = rTrim(a);
  let y = rTrim(b);
  while (!rIsZero(y)) {
    const { r } = rDivide(x, y);
    x = y;
    y = r;
  }
  return rMonic(x);
}

/** Factores libres de cuadrados (algoritmo de Yun): [factor, multiplicidad]. */
function squareFree(p: RPoly): { factor: RPoly; multiplicity: number }[] {
  const out: { factor: RPoly; multiplicity: number }[] = [];
  const dp = rDeriv(p);
  const g = rGcd(p, dp);
  let c = rDivide(p, g).q;
  let d = rSub(rDivide(dp, g).q, rDeriv(c));
  let i = 1;
  while (rTrim(c).length > 1) {
    const a = rGcd(c, d);
    if (a.length > 1) out.push({ factor: a, multiplicity: i });
    c = rDivide(c, a).q;
    d = rSub(rDivide(d, a).q, rDeriv(c));
    i++;
    if (i > 64) break;
  }
  return out;
}

function rSub(a: RPoly, b: RPoly): RPoly {
  const n = Math.max(a.length, b.length);
  const out: RPoly = Array.from({ length: n }, () => Rational.ZERO);
  a.forEach((c, i) => (out[n - a.length + i] = out[n - a.length + i]!.add(c)));
  b.forEach((c, i) => (out[n - b.length + i] = out[n - b.length + i]!.sub(c)));
  return rTrim(out);
}

/** ¿Todos los coeficientes son decimales cortos (sin ruido de coma flotante)? */
function toCleanRationals(p: Poly): RPoly | null {
  const out: RPoly = [];
  for (const c of p) {
    if (!Number.isFinite(c)) return null;
    const r = Rational.fromNumber(c);
    if (r.den > 1_000_000_000n) return null;
    out.push(r);
  }
  return out;
}

/**
 * Simplifica N/D dividiendo entre su máximo común divisor. Si los coeficientes son decimales
 * limpios se usa aritmética racional exacta (así (s + 1)/[(s + 1)(s + 2)] queda 1/(s + 2)); si no,
 * solo se cancelan los factores x comunes (coeficientes finales nulos). `reduced` indica si cambió.
 */
export function reduceRational(num: Poly, den: Poly): { num: Poly; den: Poly; reduced: boolean } {
  let N = trimPoly(num);
  let D = trimPoly(den);
  let reduced = false;
  while (N.length > 1 && D.length > 1 && N[N.length - 1] === 0 && D[D.length - 1] === 0) {
    N = N.slice(0, -1);
    D = D.slice(0, -1);
    reduced = true;
  }
  const exactN = toCleanRationals(N);
  const exactD = toCleanRationals(D);
  if (exactN && exactD && !(N.length === 1 && N[0] === 0)) {
    const g = rGcd(exactN, exactD);
    if (g.length > 1) {
      N = rDivide(exactN, g).q.map((c) => c.toNumber());
      D = rDivide(exactD, g).q.map((c) => c.toNumber());
      reduced = true;
    }
  }
  return { num: trimPoly(N), den: trimPoly(D), reduced };
}

/**
 * Raíces de un polinomio real, con su multiplicidad. Las raíces en 0 se separan primero (los
 * coeficientes finales nulos), así que su multiplicidad es exacta.
 */
export function polyRoots(input: Poly): PolyRoot[] {
  let p = trimPoly(input);
  if (p.length <= 1) return [];
  const roots: PolyRoot[] = [];
  let zeros = 0;
  while (p.length > 1 && p[p.length - 1] === 0) {
    p = p.slice(0, -1);
    zeros++;
  }
  if (zeros > 0) roots.push({ value: C.ZERO, multiplicity: zeros });
  if (p.length <= 1) return roots;

  const exact = toCleanRationals(p);
  if (exact) {
    for (const { factor, multiplicity } of squareFree(exact)) {
      const numeric = factor.map((c) => c.toNumber());
      for (const value of aberth(numeric)) {
        roots.push({ value: snapComplex(value), multiplicity });
      }
    }
  } else {
    for (const r of clusterRoots(aberth(p))) {
      let value = r.value;
      // Un grupo que coincide con su conjugado es una raíz real (el polinomio es real).
      if (Math.abs(value.im) <= 1e-4 * Math.max(1, C.abs(value))) value = C.complex(value.re);
      // Pulido: la raíz de multiplicidad m es raíz simple de la derivada (m − 1).
      let q: Poly = p;
      for (let k = 1; k < r.multiplicity; k++) q = derivPoly(q);
      const dq = derivPoly(q);
      for (let iter = 0; iter < 8; iter++) {
        const step = C.div(evalPolyComplex(q, value), evalPolyComplex(dq, value));
        if (!Number.isFinite(step.re) || !Number.isFinite(step.im)) break;
        value = C.sub(value, step);
      }
      roots.push({ value: snapComplex(value), multiplicity: r.multiplicity });
    }
  }
  return sortRoots(enforceConjugates(roots));
}
