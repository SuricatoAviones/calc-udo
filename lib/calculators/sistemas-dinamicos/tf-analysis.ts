/**
 * Análisis común de una función de transferencia: forma polinomial, forma de polos y ceros,
 * polinomio característico, orden, tipo, ganancia en cd, estabilidad por la ubicación de los polos
 * (Ogata, 3.ª ed., sec. 3-2 y 5-4) y el diagrama de polos y ceros.
 */
import { toLatexNumber } from '@/lib/math/format';
import { trimPoly } from '@/lib/math/polynomials';
import type { Series, Step, SummaryItem } from '../types';
import {
  lowFrequencyGain,
  polyTex,
  rootPoints,
  rootsTex,
  rootsText,
  systemType,
  tfTex,
  zpk,
  zpkTex,
  type TransferFunction,
} from './transfer-function';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

export type Stability = 'estable' | 'marginal' | 'inestable';

export interface TfAnalysis {
  order: number;
  type: number;
  dcGain: number | null;
  stability: Stability;
  poles: { re: number; im: number }[];
  zeros: { re: number; im: number }[];
  steps: Step[];
  summary: SummaryItem[];
  series: Series[];
}

/** Ventana del plano s que contiene los puntos con un margen. */
export function planeBounds(points: { x: number; y: number }[]): { min: number; max: number } {
  const values = points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]);
  const size = Math.max(1, ...values) * 1.25;
  return { min: -size, max: size };
}

export function poleZeroSeries(tf: TransferFunction, title = 'Diagrama de polos y ceros'): Series {
  const { poles, zeros } = zpk(tf);
  return {
    id: 'polos-ceros',
    title,
    xLabel: 'Re(s)',
    yLabel: 'Im(s)',
    kind: 'plane',
    points: [],
    markers: [
      { label: 'Polos', shape: 'cross', points: rootPoints(poles) },
      ...(zeros.length
        ? [{ label: 'Ceros', shape: 'circle' as const, points: rootPoints(zeros) }]
        : []),
    ],
  };
}

export function analyzeTf(tf: TransferFunction, name = 'G(s)'): TfAnalysis {
  const { gain, poles, zeros } = zpk(tf);
  const order = trimPoly(tf.den).length - 1;
  const type = systemType(tf);
  const dcGain =
    type === 0 && trimPoly(tf.num).at(-1) !== 0 ? lowFrequencyGain(tf) : type < 0 ? 0 : null;
  const unstable = poles.some(
    (p) => p.value.re > 1e-9 || (Math.abs(p.value.re) <= 1e-9 && p.multiplicity > 1),
  );
  const onAxis = poles.some((p) => Math.abs(p.value.re) <= 1e-9);
  const stability: Stability = unstable ? 'inestable' : onAxis ? 'marginal' : 'estable';
  const steps: Step[] = [
    {
      title: 'Forma canónica polinomial',
      explanation: `El grado del denominador es el orden del sistema: ${order}. ${
        trimPoly(tf.num).length - 1 > order
          ? 'El numerador es de mayor grado: la función no es propia.'
          : ''
      }`.trim(),
      result: `${name} = ${tfTex(tf)}`,
    },
    {
      title: 'Polinomio característico',
      explanation: 'Es el denominador de la función de transferencia; sus raíces son los polos.',
      result: `${polyTex(tf.den)} = 0`,
    },
    {
      title: 'Polos y ceros',
      explanation: `Polos (raíces del denominador): ${rootsText(poles)}. Ceros (raíces del numerador): ${rootsText(zeros)}.`,
      formula: `${name} = k\\frac{\\prod (s - z_i)}{\\prod (s - p_j)}`,
      substitution:
        `k = ${n(gain)},\\quad ${rootsTex(zeros)}\\ \\text{(ceros)},\\quad ${rootsTex(poles)}\\ \\text{(polos)}`.replace(
          /s = /g,
          '',
        ),
      result: `${name} = ${zpkTex(tf)}`,
    },
    {
      title: 'Estabilidad',
      explanation:
        stability === 'estable'
          ? 'Todos los polos tienen parte real negativa: la respuesta natural se extingue y el sistema es estable.'
          : stability === 'marginal'
            ? 'Hay polos simples sobre el eje imaginario y ninguno a la derecha: el sistema es críticamente (marginalmente) estable.'
            : 'Hay polos con parte real positiva o polos repetidos sobre el eje imaginario: el sistema es inestable.',
    },
  ];
  const summary: SummaryItem[] = [
    { label: 'Función de transferencia', value: `${name} = ${tfTex(tf)}`, emphasis: true },
    { label: 'Polos y ceros', value: `${name} = ${zpkTex(tf)}` },
    {
      label: 'Orden y tipo',
      value: `\\text{orden } ${order},\\ \\text{tipo } ${Math.max(type, 0)}`,
    },
    {
      label: 'Estabilidad',
      value: `\\text{${{ estable: 'estable', marginal: 'marginalmente estable', inestable: 'inestable' }[stability]}}`,
    },
  ];
  if (dcGain !== null)
    summary.push({
      label: 'Ganancia en cd',
      value: `${name.replace('(s)', '(0)')} = ${n(dcGain)}`,
    });
  return {
    order,
    type: Math.max(type, 0),
    dcGain,
    stability,
    poles: poles.map((p) => p.value),
    zeros: zeros.map((z) => z.value),
    steps,
    summary,
    series: [poleZeroSeries(tf)],
  };
}
