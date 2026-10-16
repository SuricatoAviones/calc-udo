/**
 * Respuesta en el tiempo de C(s) = G(s)R(s) ante el impulso, el escalón, la rampa y la parábola
 * unitarios (Ogata, 3.ª ed., cap. 4), con la transformada inversa por fracciones parciales de
 * Circuitos y Sistemas, y las especificaciones de la respuesta al escalón medidas sobre la curva
 * (Ogata, sec. 4-3, fig. 4-11): tiempo de retardo, de levantamiento, pico, sobrepaso máximo y
 * tiempo de asentamiento.
 */
import { polyRoots } from '@/lib/math/polynomials';
import type { Point, Step } from '../types';
import { inverseLaplace } from '../circuitos-y-sistemas/laplace-inverse';
import type { TransferFunction } from './transfer-function';

export type InputKind = 'impulso' | 'escalon' | 'rampa' | 'aceleracion';

export const INPUT_INFO: Record<
  InputKind,
  { name: string; r: string; R: string; power: number; at: (t: number) => number }
> = {
  impulso: { name: 'impulso unitario', r: '\\delta(t)', R: '1', power: 0, at: () => 0 },
  escalon: { name: 'escalón unitario', r: 'u(t)', R: '\\frac{1}{s}', power: 1, at: () => 1 },
  rampa: { name: 'rampa unitaria', r: 't', R: '\\frac{1}{s^{2}}', power: 2, at: (t) => t },
  aceleracion: {
    name: 'parábola unitaria',
    r: '\\frac{t^{2}}{2}',
    R: '\\frac{1}{s^{3}}',
    power: 3,
    at: (t) => (t * t) / 2,
  },
};

export interface TimeResponse {
  tex: string;
  steps: Step[];
  evaluate: (t: number) => number;
}

/** c(t) = ℒ⁻¹{G(s)R(s)} con la traza de las fracciones parciales. */
export function timeResponse(tf: TransferFunction, input: InputKind): TimeResponse | null {
  const { power } = INPUT_INFO[input];
  const den = [...tf.den, ...Array<number>(power).fill(0)];
  const inverse = inverseLaplace([{ delay: 0, num: tf.num, den }], 'C', 'c');
  if (!inverse.ok) return null;
  return {
    tex: inverse.result.tex,
    steps: inverse.result.steps,
    evaluate: inverse.result.evaluate,
  };
}

/** Horizonte de la gráfica: unas ocho constantes de tiempo del polo más lento. */
export function horizonFor(tf: TransferFunction, minimum = 1): number {
  const roots = polyRoots(tf.den).filter((r) => Math.abs(r.value.re) > 1e-9);
  if (roots.length === 0) return 10;
  const slowest = Math.min(...roots.map((r) => Math.abs(r.value.re)));
  const fastestOsc = Math.max(0, ...roots.map((r) => Math.abs(r.value.im)));
  let horizon = 8 / slowest;
  if (fastestOsc > 0) horizon = Math.max(horizon, (3 * 2 * Math.PI) / fastestOsc);
  return Math.min(Math.max(horizon, minimum), 1000);
}

export function sample(f: (t: number) => number, horizon: number, count = 400): Point[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = (horizon * i) / count;
    return { x: t, y: f(t) };
  });
}

export interface StepSpecs {
  final: number;
  /** Tiempo de retardo: 50 % del valor final. */
  delay: number | null;
  /** Tiempo de levantamiento (0 a 100 % si hay sobrepaso; 10 a 90 % si no). */
  rise: number | null;
  riseCriterion: '0-100' | '10-90';
  peak: number | null;
  /** Sobrepaso máximo como fracción del valor final. */
  overshoot: number;
  settling2: number | null;
  settling5: number | null;
}

function bisect(f: (t: number) => number, a: number, b: number): number {
  let lo = a;
  let hi = b;
  let flo = f(lo);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Primer cruce de c(t) = level en la malla de muestras, refinado por bisección. */
function crossing(c: (t: number) => number, level: number, grid: number[]): number | null {
  for (let i = 1; i < grid.length; i++) {
    const a = c(grid[i - 1]!) - level;
    const b = c(grid[i]!) - level;
    if (a === 0) return grid[i - 1]!;
    if (Math.sign(a) !== Math.sign(b)) return bisect((t) => c(t) - level, grid[i - 1]!, grid[i]!);
  }
  return null;
}

/** Especificaciones de la respuesta al escalón de un sistema estable con valor final `final`. */
export function stepSpecs(c: (t: number) => number, final: number, horizon: number): StepSpecs {
  const count = 6000;
  const grid = Array.from({ length: count + 1 }, (_, i) => (horizon * i) / count);
  const values = grid.map(c);
  const sign = Math.sign(final) || 1;
  let peakIndex = -1;
  for (let i = 1; i < count; i++) {
    if (
      sign * values[i]! > sign * final &&
      sign * values[i]! >= sign * values[i - 1]! &&
      sign * values[i]! >= sign * values[i + 1]!
    ) {
      peakIndex = i;
      break;
    }
  }
  let peak: number | null = null;
  let overshoot = 0;
  if (peakIndex > 0) {
    // Sección dorada en [t_{i−1}, t_{i+1}] para el máximo.
    let a = grid[peakIndex - 1]!;
    let b = grid[peakIndex + 1]!;
    const g = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < 80; k++) {
      const x1 = b - g * (b - a);
      const x2 = a + g * (b - a);
      if (sign * c(x1) > sign * c(x2)) b = x2;
      else a = x1;
    }
    peak = (a + b) / 2;
    overshoot = (c(peak) - final) / final;
  }
  const hasOvershoot = overshoot > 1e-9;
  const rise = hasOvershoot
    ? crossing(c, final, grid)
    : (() => {
        const t10 = crossing(c, 0.1 * final, grid);
        const t90 = crossing(c, 0.9 * final, grid);
        return t10 !== null && t90 !== null ? t90 - t10 : null;
      })();
  const settling = (tol: number): number | null => {
    const band = tol * Math.abs(final);
    let last = -1;
    for (let i = 0; i <= count; i++) if (Math.abs(values[i]! - final) > band) last = i;
    if (last === count) return null;
    if (last < 0) return 0;
    const f = (t: number) => Math.abs(c(t) - final) - band;
    return bisect(f, grid[last]!, grid[last + 1]!);
  };
  return {
    final,
    delay: crossing(c, 0.5 * final, grid),
    rise,
    riseCriterion: hasOvershoot ? '0-100' : '10-90',
    peak: hasOvershoot ? peak : null,
    overshoot: hasOvershoot ? overshoot : 0,
    settling2: settling(0.02),
    settling5: settling(0.05),
  };
}
