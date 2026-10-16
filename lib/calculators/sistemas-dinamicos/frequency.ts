/**
 * Respuesta en frecuencia de G(jω) (Ogata, 3.ª ed., sec. 8-2, 8-9 y 8-10):
 *
 *   forma de Bode: G(jω) = K (jω)^{±N} Π(1 + jωT)^{±1} Π[1 + 2ζ(jω/ω_n) + (jω/ω_n)²]^{±1}
 *   magnitud:      |G|_dB = 20 log₁₀|G(jω)|      fase: suma de las fases de los factores
 *   margen de fase:       γ = 180° + ∠G(jω_c),  |G(jω_c)| = 1 (frecuencia de cruce de ganancia)
 *   margen de ganancia:   K_g = 1/|G(jω_1)|,    ∠G(jω_1) = −180° (cruce de fase)
 *
 * La fase se calcula factor por factor, así es continua (no salta de −180° a 180°).
 */
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import { addPoly, evalPolyComplex, polyRoots, type Poly } from '@/lib/math/polynomials';
import type { TransferFunction } from './transfer-function';
import { lowFrequencyGain, zeroMultiplicity } from './transfer-function';

export type FactorKind = 'origen' | 'primer-orden' | 'cuadratico';

export interface BodeFactor {
  kind: FactorKind;
  /** Factor del numerador (cero) o del denominador (polo). */
  zero: boolean;
  multiplicity: number;
  /** Frecuencia de esquina ω_c = 1/T o ω_n. */
  corner: number;
  zeta: number;
  /** Raíz en el semiplano derecho (fase no mínima). */
  rightHalf: boolean;
  /** Raíz (real) o una del par (complejo). */
  root: Complex;
}

export interface BodeForm {
  /** K de la forma de Bode: lím sᴺG(s) cuando s → 0. */
  gain: number;
  factors: BodeFactor[];
}

export function bodeForm(tf: TransferFunction): BodeForm {
  const factors: BodeFactor[] = [];
  for (const [poly, zero] of [
    [tf.num, true],
    [tf.den, false],
  ] as const) {
    const k = zeroMultiplicity(poly);
    if (k > 0)
      factors.push({
        kind: 'origen',
        zero,
        multiplicity: k,
        corner: 0,
        zeta: 0,
        rightHalf: false,
        root: C.ZERO,
      });
    for (const r of polyRoots(poly)) {
      if (C.abs(r.value) <= 1e-12 || r.value.im < 0) continue;
      const corner = C.abs(r.value);
      if (r.value.im === 0) {
        factors.push({
          kind: 'primer-orden',
          zero,
          multiplicity: r.multiplicity,
          corner,
          zeta: 1,
          rightHalf: r.value.re > 0,
          root: r.value,
        });
      } else {
        factors.push({
          kind: 'cuadratico',
          zero,
          multiplicity: r.multiplicity,
          corner,
          zeta: -r.value.re / corner,
          rightHalf: r.value.re > 0,
          root: r.value,
        });
      }
    }
  }
  factors.sort((a, b) => a.corner - b.corner);
  return { gain: lowFrequencyGain(tf), factors };
}

/** Fase de un factor (sin multiplicidad), en grados, continua en ω ≥ 0. */
function factorPhase(f: BodeFactor, w: number): number {
  if (f.kind === 'origen') return 90;
  if (f.kind === 'primer-orden') return C.degrees(Math.atan2(-w / f.root.re, 1));
  const wn2 = f.corner * f.corner;
  return C.degrees(Math.atan2((-2 * f.root.re * w) / wn2, 1 - (w * w) / wn2));
}

export function phaseDeg(form: BodeForm, w: number): number {
  let phase = form.gain < 0 ? -180 : 0;
  for (const f of form.factors) phase += (f.zero ? 1 : -1) * f.multiplicity * factorPhase(f, w);
  return phase;
}

export function magnitude(tf: TransferFunction, w: number): number {
  const s = C.complex(0, w);
  return C.abs(C.div(evalPolyComplex(tf.num, s), evalPolyComplex(tf.den, s)));
}

export function magnitudeDb(tf: TransferFunction, w: number): number {
  return 20 * Math.log10(magnitude(tf, w));
}

/** Curva asintótica de magnitud (rectas que cambian de pendiente en las esquinas). */
export function asymptoticDb(form: BodeForm, w: number): number {
  let db = 20 * Math.log10(Math.abs(form.gain));
  for (const f of form.factors) {
    const sign = (f.zero ? 1 : -1) * f.multiplicity;
    if (f.kind === 'origen') db += sign * 20 * Math.log10(w);
    else if (w > f.corner)
      db += sign * (f.kind === 'cuadratico' ? 40 : 20) * Math.log10(w / f.corner);
  }
  return db;
}

/** Rango de frecuencias: dos décadas más allá de las esquinas y los cruces. */
export function frequencyRange(form: BodeForm, extra: number[] = []): [number, number] {
  const corners = [
    ...form.factors.filter((f) => f.kind !== 'origen').map((f) => f.corner),
    ...extra,
  ].filter((w) => w > 0);
  if (corners.length === 0) return [0.01, 100];
  const lo = 10 ** (Math.floor(Math.log10(Math.min(...corners))) - 1);
  const hi = 10 ** (Math.ceil(Math.log10(Math.max(...corners))) + 1);
  return [lo, hi];
}

export function logGrid(lo: number, hi: number, count = 600): number[] {
  const a = Math.log10(lo);
  const b = Math.log10(hi);
  return Array.from({ length: count + 1 }, (_, i) => 10 ** (a + ((b - a) * i) / count));
}

function bisectLog(f: (w: number) => number, a: number, b: number): number {
  let lo = Math.log10(a);
  let hi = Math.log10(b);
  const g = (x: number) => f(10 ** x);
  const sLo = Math.sign(g(lo));
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(g(mid)) === sLo) lo = mid;
    else hi = mid;
  }
  return 10 ** ((lo + hi) / 2);
}

function crossingsOf(f: (w: number) => number, grid: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < grid.length; i++) {
    const a = f(grid[i - 1]!);
    const b = f(grid[i]!);
    if (a === 0) out.push(grid[i - 1]!);
    else if (Math.sign(a) !== Math.sign(b) && Number.isFinite(a) && Number.isFinite(b))
      out.push(bisectLog(f, grid[i - 1]!, grid[i]!));
  }
  return out;
}

export interface Margins {
  gainCrossovers: { w: number; phase: number; margin: number }[];
  phaseCrossovers: { w: number; magnitudeDb: number; margin: number }[];
  /** Margen de fase en la frecuencia de cruce de ganancia más alta (Ogata, sec. 8-9). */
  phaseMargin: number | null;
  gainCrossover: number | null;
  /** El menor margen de ganancia (en dB) entre los cruces de fase. */
  gainMarginDb: number | null;
  phaseCrossover: number | null;
}

const normalize180 = (a: number) => {
  let x = ((a % 360) + 360) % 360;
  if (x > 180) x -= 360;
  return x;
};

export function margins(tf: TransferFunction, form: BodeForm): Margins {
  const [lo, hi] = frequencyRange(form);
  const grid = logGrid(lo / 100, hi * 100, 4000);
  const gainCrossovers = crossingsOf((w) => magnitudeDb(tf, w), grid).map((w) => {
    const phase = phaseDeg(form, w);
    return { w, phase, margin: normalize180(180 + phase) };
  });
  const phases = grid.map((w) => phaseDeg(form, w));
  const minPhase = Math.min(...phases);
  const maxPhase = Math.max(...phases);
  const phaseCrossovers: Margins['phaseCrossovers'] = [];
  for (
    let k = Math.floor((minPhase + 180) / 360) - 1;
    k <= Math.ceil((maxPhase + 180) / 360) + 1;
    k++
  ) {
    const level = -180 + 360 * k;
    if (level < minPhase - 1e-9 || level > maxPhase + 1e-9) continue;
    for (const w of crossingsOf((x) => phaseDeg(form, x) - level, grid)) {
      const db = magnitudeDb(tf, w);
      phaseCrossovers.push({ w, magnitudeDb: db, margin: -db });
    }
  }
  phaseCrossovers.sort((a, b) => a.w - b.w);
  const highest = gainCrossovers.at(-1) ?? null;
  const worst = phaseCrossovers.length
    ? phaseCrossovers.reduce((a, b) => (b.margin < a.margin ? b : a))
    : null;
  return {
    gainCrossovers,
    phaseCrossovers,
    phaseMargin: highest ? highest.margin : null,
    gainCrossover: highest ? highest.w : null,
    gainMarginDb: worst ? worst.margin : null,
    phaseCrossover: worst ? worst.w : null,
  };
}

export interface ClosedLoopFrequency {
  /** |M(j0)|. */
  dc: number;
  /** Pico de resonancia M_r = máx |M(jω)| y su frecuencia (null si no hay pico). */
  peak: { w: number; magnitude: number } | null;
  /** Ancho de banda: |M| cae 3 dB por debajo de |M(j0)|. */
  bandwidth: number | null;
}

/** M(s) = G/(1 + G) con realimentación unitaria. */
export function unityClosedLoop(tf: TransferFunction): TransferFunction {
  return { num: tf.num, den: addPoly(tf.den, tf.num) };
}

export function closedLoopFrequency(
  M: TransferFunction,
  range: [number, number],
): ClosedLoopFrequency {
  const grid = logGrid(range[0] / 10, range[1] * 10, 4000);
  const values = grid.map((w) => magnitude(M, w));
  const dcValue = magnitude(M, 0);
  let best = -1;
  for (let i = 1; i < grid.length - 1; i++) {
    if (
      values[i]! > values[i - 1]! &&
      values[i]! >= values[i + 1]! &&
      values[i]! > dcValue * (1 + 1e-9)
    ) {
      if (best < 0 || values[i]! > values[best]!) best = i;
    }
  }
  let peak: ClosedLoopFrequency['peak'] = null;
  if (best > 0) {
    let a = Math.log10(grid[best - 1]!);
    let b = Math.log10(grid[best + 1]!);
    const g = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < 100; k++) {
      const x1 = b - g * (b - a);
      const x2 = a + g * (b - a);
      if (magnitude(M, 10 ** x1) > magnitude(M, 10 ** x2)) b = x2;
      else a = x1;
    }
    const w = 10 ** ((a + b) / 2);
    peak = { w, magnitude: magnitude(M, w) };
  }
  const target = dcValue / Math.SQRT2;
  const band = crossingsOf((w) => magnitude(M, w) - target, grid);
  return { dc: dcValue, peak, bandwidth: band[0] ?? null };
}

export function rootsOf(p: Poly) {
  return polyRoots(p);
}
