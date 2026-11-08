/**
 * Transformador y rectificadores (Malvino, 6.ª ed., tabla 4-1; Boylestad, 10.ª ed., sec. 2.6 y
 * 2.7): tensión de pico a la entrada y a la salida, frecuencia de rizado y PIV.
 *
 *                     Media onda      Derivación central     Puente
 *   Entrada de pico   V_p2            0.5·V_p2               V_p2
 *   Salida de pico    V_p2 − V_K      0.5·V_p2 − V_K         V_p2 − 2V_K
 *   Frecuencia        f               2f                     2f
 *   PIV (ideal)       V_p2            V_p2                   V_p2
 *
 * En la derivación central el PIV es el pico del secundario completo, 2V_m con V_m el pico de cada
 * mitad (Boylestad, ec. 2.13).
 */
import { toLatexNumber } from '@/lib/math/format';
import type { Step } from '../types';

export type RectifierType = 'media-onda' | 'derivacion-central' | 'puente';

export const RECTIFIER_NAME: Record<RectifierType, string> = {
  'media-onda': 'rectificador de media onda',
  'derivacion-central': 'rectificador de onda completa con derivación central',
  puente: 'puente rectificador',
};

const n = (v: number) => toLatexNumber(v, 6);

export interface TransformerResult {
  vp1: number;
  vp2: number;
  v2rms: number;
  steps: Step[];
}

/** V_p1 = √2·V_1(rms) y V_p2 = V_p1/(N₁/N₂). */
export function transformer(v1rms: number, ratio: number): TransformerResult {
  const vp1 = Math.SQRT2 * v1rms;
  const vp2 = vp1 / ratio;
  const v2rms = v1rms / ratio;
  return {
    vp1,
    vp2,
    v2rms,
    steps: [
      {
        title: 'Tensión de pico en el primario',
        formula: String.raw`V_{p1} = \frac{V_{1(rms)}}{0.707} = \sqrt{2}\,V_{1(rms)}`,
        substitution: String.raw`V_{p1} = \sqrt{2}\,(${n(v1rms)})`,
        result: String.raw`V_{p1} = ${n(vp1)}\ \text{V}`,
      },
      {
        title: 'Tensión de pico en el secundario',
        explanation:
          'El transformador reductor divide la tensión entre la relación de espiras N₁:N₂.',
        formula: String.raw`V_{p2} = \frac{V_{p1}}{N_1/N_2}`,
        substitution: String.raw`V_{p2} = \frac{${n(vp1)}}{${n(ratio)}}`,
        result: String.raw`V_{p2} = ${n(vp2)}\ \text{V}\quad (V_{2(rms)} = ${n(v2rms)}\ \text{V})`,
      },
    ],
  };
}

export interface RectifierResult {
  /** Pico de la tensión que ve cada rectificador de media onda. */
  vpIn: number;
  /** Pico en la carga. */
  vpOut: number;
  diodesInPath: number;
  fullWave: boolean;
  fOut: number;
  piv: number;
  step: Step;
}

/** Tensión de pico en la carga según el rectificador: fórmula, sustitución y explicación. */
const PEAK_TEXT: Record<
  RectifierType,
  {
    formula: string;
    substitution: (vp2: number, vk: number) => string;
    explanation: (withDrop: boolean) => string;
  }
> = {
  'media-onda': {
    formula: 'V_{p(out)} = V_{p2} - V_K',
    substitution: (vp2, vk) => `V_{p(out)} = ${n(vp2)} - ${n(vk)}`,
    explanation: (withDrop) =>
      `Conduce un solo diodo, en el semiciclo positivo${withDrop ? ', con su caída V_K' : ''}.`,
  },
  'derivacion-central': {
    formula: String.raw`V_{p(out)} = 0.5\,V_{p2} - V_K`,
    substitution: (vp2, vk) => `V_{p(out)} = 0.5(${n(vp2)}) - ${n(vk)}`,
    explanation: (withDrop) =>
      `Con la derivación central cada diodo ve la mitad del secundario. Conduce un diodo por semiciclo${withDrop ? ', con su caída V_K' : ''}.`,
  },
  puente: {
    formula: 'V_{p(out)} = V_{p2} - 2V_K',
    substitution: (vp2, vk) => `V_{p(out)} = ${n(vp2)} - 2(${n(vk)})`,
    explanation: (withDrop) =>
      `En el puente conducen dos diodos en serie en cada semiciclo${withDrop ? ': se restan dos caídas V_K' : ''}.`,
  },
};

export function rectify(vp2: number, type: RectifierType, vk: number, f: number): RectifierResult {
  const fullWave = type !== 'media-onda';
  const vpIn = type === 'derivacion-central' ? vp2 / 2 : vp2;
  const diodesInPath = type === 'puente' ? 2 : 1;
  const vpOut = Math.max(0, vpIn - diodesInPath * vk);
  const fOut = fullWave ? 2 * f : f;
  // PIV ideal sin filtro: el pico del secundario completo en los tres casos (Boylestad, ecs. 2.9,
  // 2.12 y 2.13; en la derivación central es 2V_m con V_m el pico de cada mitad).
  const piv = vp2;
  const text = PEAK_TEXT[type];
  return {
    vpIn,
    vpOut,
    diodesInPath,
    fullWave,
    fOut,
    piv,
    step: {
      title: 'Tensión de pico en la carga',
      explanation: text.explanation(vk > 0),
      formula: text.formula,
      substitution: vk > 0 ? text.substitution(vp2, vk) : undefined,
      result: String.raw`V_{p(out)} = ${n(vpOut)}\ \text{V}`,
    },
  };
}
