/**
 * Lugar geométrico de las raíces de 1 + K·F(s) = 0, con F(s) = N(s)/D(s) y K ≥ 0 (Ogata, 3.ª ed.,
 * sec. 6-2 y 6-3; Kuo, 7.ª ed., cap. 8):
 *
 *   condición de ángulo:   ∠F(s) = ±180°(2k + 1)        condición de magnitud: K = |D(s)|/|N(s)|
 *   asíntotas:             ángulos ±180°(2k + 1)/(n − m), centroide σ_a = (Σ polos − Σ ceros)/(n − m)
 *   puntos de ruptura:     dK/ds = 0  ⇔  N(s)D′(s) − N′(s)D(s) = 0
 *   ángulo de salida:      θ = 180° − Σ ángulos desde los otros polos + Σ ángulos desde los ceros
 *   cruces con el eje jω:  D(jω) + K·N(jω) = 0 (parte real e imaginaria)
 */
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import {
  addPoly,
  derivPoly,
  evalPolyComplex,
  mulPoly,
  polyRoots,
  scalePoly,
  subPoly,
  trimPoly,
  type Poly,
} from '@/lib/math/polynomials';
import type { Point } from '../types';

export interface LocusData {
  num: Poly;
  den: Poly;
  poles: Complex[];
  zeros: Complex[];
  n: number;
  m: number;
  /** Signo del cociente de los coeficientes principales (el lugar con K > 0 usa ±180°). */
  leadSign: 1 | -1;
}

export function locusData(num: Poly, den: Poly): LocusData {
  const N = trimPoly(num);
  const D = trimPoly(den);
  const expand = (p: Poly) =>
    polyRoots(p).flatMap((r) => Array.from({ length: r.multiplicity }, () => r.value));
  return {
    num: N,
    den: D,
    poles: expand(D),
    zeros: expand(N),
    n: D.length - 1,
    m: N.length - 1,
    leadSign: N[0]! / D[0]! > 0 ? 1 : -1,
  };
}

const F = (data: LocusData, s: Complex) =>
  C.div(evalPolyComplex(data.num, s), evalPolyComplex(data.den, s));

/** K que lleva una raíz a s (puede ser complejo si s no está en el lugar). */
export function gainAt(data: LocusData, s: Complex): Complex {
  return C.neg(C.div(evalPolyComplex(data.den, s), evalPolyComplex(data.num, s)));
}

/** Tramos del eje real que pertenecen al lugar (F(x) < 0). */
export function realAxisSegments(data: LocusData): [number, number][] {
  const real = [
    ...new Set(
      [...data.poles, ...data.zeros].filter((r) => Math.abs(r.im) < 1e-9).map((r) => r.re),
    ),
  ].sort((a, b) => a - b);
  const bounds = [-Infinity, ...real, Infinity];
  const out: [number, number][] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i]!;
    const b = bounds[i + 1]!;
    const x = !Number.isFinite(a) ? b - 1 : !Number.isFinite(b) ? a + 1 : (a + b) / 2;
    const value = F(data, C.complex(Number.isFinite(x) ? x : 0));
    if (value.re < 0) {
      const last = out.at(-1);
      if (last && last[1] === a) last[1] = b;
      else out.push([a, b]);
    }
  }
  return out;
}

export interface Asymptotes {
  count: number;
  angles: number[];
  centroid: number;
}

export function asymptotes(data: LocusData): Asymptotes | null {
  const count = data.n - data.m;
  if (count <= 0) return null;
  const angles = Array.from({ length: count }, (_, k) =>
    data.leadSign > 0 ? (180 * (2 * k + 1)) / count : (360 * k) / count,
  ).map((a) => (a > 180 ? a - 360 : a));
  const sum = (roots: Complex[]) => roots.reduce((s, r) => s + r.re, 0);
  return { count, angles, centroid: (sum(data.poles) - sum(data.zeros)) / count };
}

export interface BreakPoint {
  s: Complex;
  K: number;
  valid: boolean;
}

/** Raíces de N D′ − N′ D = 0 con su K; válidas si K es real y positivo. */
export function breakPoints(data: LocusData): { polynomial: Poly; points: BreakPoint[] } {
  const polynomial = trimPoly(
    subPoly(mulPoly(data.num, derivPoly(data.den)), mulPoly(derivPoly(data.num), data.den)),
  );
  if (polynomial.length < 2) return { polynomial, points: [] };
  const points = polyRoots(polynomial)
    .filter((r) => r.value.im >= 0)
    .map((r) => {
      const K = gainAt(data, r.value);
      const real = Math.abs(K.im) <= 1e-6 * Math.max(1, C.abs(K));
      return { s: r.value, K: K.re, valid: real && K.re > 1e-12 && Number.isFinite(K.re) };
    });
  return { polynomial, points };
}

function angleDeg(z: Complex): number {
  return C.degrees(Math.atan2(z.im, z.re));
}

/** Ángulos de salida de los polos complejos (y de llegada a los ceros complejos), en grados. */
export function departureAngles(
  data: LocusData,
): {
  root: Complex;
  kind: 'polo' | 'cero';
  angle: number;
  others: { from: Complex; angle: number; kind: 'polo' | 'cero' }[];
}[] {
  const out: ReturnType<typeof departureAngles> = [];
  const base = data.leadSign > 0 ? 180 : 0;
  const normalize = (a: number) => {
    let x = ((a % 360) + 360) % 360;
    if (x > 180) x -= 360;
    return x;
  };
  const seen: Complex[] = [];
  for (const [kind, list] of [
    ['polo', data.poles],
    ['cero', data.zeros],
  ] as const) {
    for (const root of list) {
      if (root.im <= 1e-9 || seen.some((x) => C.abs(C.sub(x, root)) < 1e-9)) continue;
      seen.push(root);
      const others: { from: Complex; angle: number; kind: 'polo' | 'cero' }[] = [];
      let sumPoles = 0;
      let sumZeros = 0;
      let skipped = false;
      for (const p of data.poles) {
        if (kind === 'polo' && !skipped && C.abs(C.sub(p, root)) < 1e-9) {
          skipped = true;
          continue;
        }
        const a = angleDeg(C.sub(root, p));
        others.push({ from: p, angle: a, kind: 'polo' });
        sumPoles += a;
      }
      skipped = false;
      for (const z of data.zeros) {
        if (kind === 'cero' && !skipped && C.abs(C.sub(z, root)) < 1e-9) {
          skipped = true;
          continue;
        }
        const a = angleDeg(C.sub(root, z));
        others.push({ from: z, angle: a, kind: 'cero' });
        sumZeros += a;
      }
      const angle =
        kind === 'polo'
          ? normalize(base - sumPoles + sumZeros)
          : normalize(base + sumPoles - sumZeros);
      out.push({ root, kind, angle, others });
    }
  }
  return out;
}

/** Parte real e imaginaria de p(jω) como polinomios en ω. */
export function splitJw(p: Poly): { re: Poly; im: Poly } {
  const q = trimPoly(p);
  const degree = q.length - 1;
  const re = Array<number>(degree + 1).fill(0);
  const im = Array<number>(degree + 1).fill(0);
  q.forEach((c, i) => {
    const k = degree - i;
    const sign = k % 4 === 0 || k % 4 === 1 ? 1 : -1;
    if (k % 2 === 0) re[i] = sign * c;
    else im[i] = sign * c;
  });
  return { re: trimPoly(re), im: trimPoly(im) };
}

export interface Crossing {
  omega: number;
  K: number;
}

/** Cruces con el eje imaginario: D(jω) + K N(jω) = 0 con K > 0. */
export function axisCrossings(data: LocusData): { equation: Poly; crossings: Crossing[] } {
  const d = splitJw(data.den);
  const nn = splitJw(data.num);
  // Eliminar K: D_r N_i − D_i N_r = 0.
  const equation = trimPoly(subPoly(mulPoly(d.re, nn.im), mulPoly(d.im, nn.re)));
  const crossings: Crossing[] = [];
  if (equation.length < 2 && equation[0] === 0) return { equation, crossings };
  for (const r of polyRoots(equation)) {
    if (Math.abs(r.value.im) > 1e-7 || r.value.re < -1e-9) continue;
    const omega = Math.max(0, r.value.re);
    const K = gainAt(data, C.complex(0, omega));
    if (Math.abs(K.im) > 1e-6 * Math.max(1, C.abs(K)) || !(K.re > 1e-9) || !Number.isFinite(K.re))
      continue;
    if (!crossings.some((c) => Math.abs(c.omega - omega) < 1e-9))
      crossings.push({ omega, K: K.re });
  }
  return { equation, crossings: crossings.sort((a, b) => a.omega - b.omega) };
}

/** Puntos del lugar sobre la recta de ζ constante (semiplano superior), con su K. */
export function dampingPoints(data: LocusData, zeta: number): { s: Complex; K: number }[] {
  const theta = Math.PI - Math.acos(Math.min(1, Math.max(0, zeta)));
  const dir = C.fromPolar(1, theta);
  const radius = 6 * Math.max(1, ...[...data.poles, ...data.zeros].map((r) => C.abs(r)));
  const f = (r: number) => {
    const s = C.scale(dir, r);
    return C.mul(evalPolyComplex(data.num, s), C.conj(evalPolyComplex(data.den, s)));
  };
  const count = 6000;
  const out: { s: Complex; K: number }[] = [];
  let prev = f(radius / count / 10);
  let prevR = radius / count / 10;
  for (let i = 1; i <= count; i++) {
    const r = (radius * i) / count;
    const cur = f(r);
    if (Math.sign(cur.im) !== Math.sign(prev.im) && cur.im !== 0) {
      let lo = prevR;
      let hi = r;
      for (let k = 0; k < 100; k++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(f(mid).im) === Math.sign(f(lo).im)) lo = mid;
        else hi = mid;
      }
      const root = (lo + hi) / 2;
      const value = f(root);
      if (value.re < 0) {
        const s = C.scale(dir, root);
        const K = gainAt(data, s);
        if (Number.isFinite(K.re) && K.re > 0) out.push({ s, K: K.re });
      }
    }
    prev = cur;
    prevR = r;
  }
  return out;
}

/** Raíces de D(s) + K N(s) = 0. */
export function closedLoopRoots(data: LocusData, K: number): Complex[] {
  const p = addPoly(data.den, scalePoly(data.num, K));
  return polyRoots(p).flatMap((r) => Array.from({ length: r.multiplicity }, () => r.value));
}

/**
 * Ramas del lugar para la gráfica: raíces de D + KN para K creciente (geométrico), emparejadas
 * con las del paso anterior por cercanía. Se recortan a la ventana `radius`.
 */
export function locusBranches(
  data: LocusData,
  radius: number,
  extraGains: number[] = [],
): Point[][] {
  const n = data.n;
  if (n === 0) return [];
  const scale =
    Math.abs(data.den[0]! / data.num[0]!) * Math.max(1, radius) ** Math.max(1, data.n - data.m);
  const gains: number[] = [];
  for (let k = scale * 1e-7; k <= scale * 1e5; k *= 1.04) gains.push(k);
  gains.push(...extraGains.filter((g) => g > 0));
  gains.sort((a, b) => a - b);
  let prev = data.poles.slice(0, n);
  const branches: Point[][] = prev.map((p) => [{ x: p.re, y: p.im }]);
  for (const K of gains) {
    const roots = closedLoopRoots(data, K);
    if (roots.length !== n) continue;
    const used = new Set<number>();
    const next: Complex[] = Array(n);
    // Emparejamiento voraz por la distancia más corta.
    const pairs: { i: number; j: number; d: number }[] = [];
    prev.forEach((p, i) => roots.forEach((r, j) => pairs.push({ i, j, d: C.abs(C.sub(p, r)) })));
    pairs.sort((a, b) => a.d - b.d);
    const assigned = new Set<number>();
    for (const { i, j } of pairs) {
      if (assigned.has(i) || used.has(j)) continue;
      next[i] = roots[j]!;
      assigned.add(i);
      used.add(j);
    }
    prev = next;
    next.forEach((r, i) => {
      if (Math.abs(r.re) <= 1.6 * radius && Math.abs(r.im) <= 1.6 * radius)
        branches[i]!.push({ x: r.re, y: r.im });
    });
  }
  return branches;
}
