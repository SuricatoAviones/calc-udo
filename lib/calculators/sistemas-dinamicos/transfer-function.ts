/**
 * Funciones de transferencia racionales G(s) = N(s)/D(s) con coeficientes reales (Ogata, 3.ª ed.,
 * sec. 3-2): lectura de lo que escribe el estudiante, aritmética de bloques (serie, paralelo,
 * realimentación), formas canónica polinomial y de polos y ceros, ganancia, tipo y evaluación en
 * un punto complejo.
 *
 * La lectura reutiliza la de la transformada de Laplace (`parseTransform`), sin retardos e^{−as}.
 */
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import { toLatexNumber } from '@/lib/math/format';
import {
  addPoly,
  evalPolyComplex,
  isZeroPoly,
  mulPoly,
  polyRoots,
  reduceRational,
  scalePoly,
  snap,
  trimPoly,
  type Poly,
  type PolyRoot,
} from '@/lib/math/polynomials';
import { factoredTex, parseTransform, polyTex, rationalTex } from '../circuitos-y-sistemas/laplace';

export const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

export interface TransferFunction {
  num: Poly;
  den: Poly;
}

export type TfResult = { ok: true; tf: TransferFunction } | { ok: false; message: string };

/** Coeficientes sin ruido de coma flotante (lo despreciable frente a la escala es 0). */
export function tidyPoly(p: Poly): Poly {
  const scale = Math.max(1e-300, ...p.map(Math.abs));
  return trimPoly(p.map((c) => (Math.abs(c) <= 1e-12 * scale ? 0 : snap(c))));
}

/** Divide numerador y denominador entre el coeficiente principal del denominador. */
export function monic(tf: TransferFunction): TransferFunction {
  const den = trimPoly(tf.den);
  const lead = den[0]!;
  if (lead === 1) return { num: tidyPoly(tf.num), den: tidyPoly(den) };
  return { num: tidyPoly(scalePoly(tf.num, 1 / lead)), den: tidyPoly(scalePoly(den, 1 / lead)) };
}

/**
 * Lee G(s) escrita por el estudiante: polinomios, cocientes, productos y potencias enteras de s,
 * factorizados o no (`10(s + 3)/(s(s + 2)(s^2 + s + 2))`). `name` aparece en los mensajes.
 */
export function parseTf(source: string, name = 'G(s)'): TfResult {
  const parsed = parseTransform(source, 's');
  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.message.includes('idénticamente 0')
        ? `${name} no puede ser idénticamente 0.`
        : `${name}: ${parsed.message}`,
    };
  }
  if (parsed.groups.length !== 1 || parsed.groups[0]!.delay !== 0) {
    return {
      ok: false,
      message: `${name} debe ser un cociente de polinomios en s, sin retardos e^(−as).`,
    };
  }
  const { num, den } = parsed.groups[0]!;
  if (isZeroPoly(den)) return { ok: false, message: `El denominador de ${name} es 0.` };
  return { ok: true, tf: { num: tidyPoly(num), den: tidyPoly(den) } };
}

/** Vista previa en LaTeX de lo que escribe el estudiante (o `null` si no se puede leer). */
export function tfPreviewTex(source: string): string | null {
  const parsed = parseTf(source);
  return parsed.ok ? tfTex(parsed.tf) : null;
}

export function tfTex(tf: TransferFunction): string {
  return rationalTex(tf.num, tf.den, 's');
}

export function tfMul(a: TransferFunction, b: TransferFunction): TransferFunction {
  return { num: mulPoly(a.num, b.num), den: mulPoly(a.den, b.den) };
}

export function tfAdd(a: TransferFunction, b: TransferFunction): TransferFunction {
  return {
    num: addPoly(mulPoly(a.num, b.den), mulPoly(b.num, a.den)),
    den: mulPoly(a.den, b.den),
  };
}

/**
 * Lazo de realimentación: G/(1 + GH) con realimentación negativa (`sign = -1`) o G/(1 − GH) con
 * positiva (`sign = 1`). Con G = N_G/D_G y H = N_H/D_H queda N_G D_H / (D_G D_H ∓ N_G N_H).
 */
export function tfFeedback(
  G: TransferFunction,
  H: TransferFunction,
  sign: -1 | 1 = -1,
): TransferFunction {
  const forward = mulPoly(G.num, H.den);
  const loop = mulPoly(G.num, H.num);
  const base = mulPoly(G.den, H.den);
  return { num: forward, den: addPoly(base, scalePoly(loop, -sign)) };
}

/** Cancela los factores comunes de N y D (aritmética exacta cuando los coeficientes son limpios). */
export function tfReduce(tf: TransferFunction): { tf: TransferFunction; reduced: boolean } {
  const { num, den, reduced } = reduceRational(tf.num, tf.den);
  return { tf: monic({ num, den }), reduced };
}

export function tfEval(tf: TransferFunction, s: Complex): Complex {
  return C.div(evalPolyComplex(tf.num, s), evalPolyComplex(tf.den, s));
}

/** Multiplicidad de la raíz s = 0 de un polinomio (coeficientes finales nulos). */
export function zeroMultiplicity(p: Poly): number {
  const q = trimPoly(p);
  let k = 0;
  while (k < q.length - 1 && q[q.length - 1 - k] === 0) k++;
  return k;
}

/** Quita las raíces en s = 0: p(s) = s^k · q(s). */
export function stripZeroRoots(p: Poly): { k: number; rest: Poly } {
  const q = trimPoly(p);
  const k = zeroMultiplicity(q);
  return { k, rest: q.slice(0, q.length - k) };
}

/**
 * Tipo del sistema (Ogata, sec. 5-10): número de polos en el origen de la función de transferencia
 * en lazo abierto, después de cancelar ceros en el origen.
 */
export function systemType(tf: TransferFunction): number {
  return zeroMultiplicity(tf.den) - zeroMultiplicity(tf.num);
}

/**
 * Ganancia de Bode o de error: lím s→0 sᴺ·G(s), con N el tipo (o el número de ceros en el origen
 * con signo contrario). Es el K de la forma con factores (Ts + 1).
 */
export function lowFrequencyGain(tf: TransferFunction): number {
  const num = stripZeroRoots(tf.num).rest;
  const den = stripZeroRoots(tf.den).rest;
  return num[num.length - 1]! / den[den.length - 1]!;
}

export interface Zpk {
  /** Cociente de los coeficientes principales: G(s) = k Π(s − zᵢ)/Π(s − pⱼ). */
  gain: number;
  zeros: PolyRoot[];
  poles: PolyRoot[];
}

export function zpk(tf: TransferFunction): Zpk {
  const num = trimPoly(tf.num);
  const den = trimPoly(tf.den);
  return { gain: num[0]! / den[0]!, zeros: polyRoots(num), poles: polyRoots(den) };
}

/** Forma de polos y ceros: `10\frac{(s + 3)}{s(s + 2)(s^{2} + s + 2)}`. */
export function zpkTex(tf: TransferFunction): string {
  const { gain, zeros, poles } = zpk(tf);
  const top = zeros.length ? factoredTex(zeros, 1) : '1';
  if (poles.length === 0) return zeros.length ? `${gainPrefix(gain)}${top}` : n(gain);
  return `${gainPrefix(gain)}\\frac{${top}}{${factoredTex(poles, 1)}}`;
}

function gainPrefix(gain: number): string {
  if (gain === 1) return '';
  if (gain === -1) return '-';
  return n(gain);
}

/** Polinomio característico: el denominador (Ogata, sec. 3-2: D(s) = 0). */
export function characteristicTex(tf: TransferFunction): string {
  return `${polyTex(tf.den, 's')} = 0`;
}

/** Raíces en texto, con su multiplicidad: `−1, −2 ± j1.41421`. */
export function rootsText(roots: PolyRoot[]): string {
  if (roots.length === 0) return 'ninguno';
  return roots
    .filter((r) => r.value.im >= 0)
    .map((r) => {
      const re = C.toTextRect(C.complex(r.value.re), DIGITS);
      const text =
        r.value.im === 0
          ? re
          : `${r.value.re === 0 ? '' : `${re} `}± j${C.toTextRect(C.complex(r.value.im), DIGITS)}`;
      return r.multiplicity > 1 ? `${text} (multiplicidad ${r.multiplicity})` : text;
    })
    .join(', ');
}

/** Raíces en LaTeX: `s = -1,\ s = -2 \pm j1.41421`. */
export function rootsTex(roots: PolyRoot[], variable = 's'): string {
  if (roots.length === 0) return '\\text{ninguno}';
  return roots
    .filter((r) => r.value.im >= 0)
    .map((r) => {
      const value =
        r.value.im === 0
          ? n(r.value.re)
          : `${r.value.re === 0 ? '' : n(r.value.re)} \\pm j${n(r.value.im)}`;
      const mult = r.multiplicity > 1 ? `\\ (\\times ${r.multiplicity})` : '';
      return `${variable} = ${value}${mult}`;
    })
    .join(',\\ ');
}

/** Puntos (Re, Im) de las raíces, con repeticiones según la multiplicidad. */
export function rootPoints(roots: PolyRoot[]): { x: number; y: number }[] {
  return roots.map((r) => ({ x: r.value.re, y: r.value.im }));
}

export { polyTex };
