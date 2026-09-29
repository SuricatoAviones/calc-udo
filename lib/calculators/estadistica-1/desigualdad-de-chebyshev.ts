/**
 * Teorema (desigualdad) de Chebyshev: para cualquier distribución con media μ y desviación
 * estándar σ (Walpole, Myers, Myers y Ye, sec. 4.4, teorema 4.10):
 *
 *   P(μ − kσ < X < μ + kσ) ≥ 1 − 1/k²,   y por complemento   P(|X − μ| ≥ kσ) ≤ 1/k²
 *
 * Es una cota: la probabilidad exacta depende de la distribución, que aquí no se conoce.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand, toLatexRational } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Notice,
  type Step,
} from '../types';

export const chebyshevModes = ['k', 'intervalo', 'fuera'] as const;
export const dispersionTypes = ['desviacion', 'varianza'] as const;

const finite = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`);
const positive = (label: string) =>
  finite(label).refine((v) => v > 0, `${label} debe ser mayor que 0.`);

export const chebyshevInputSchema = z
  .object({
    mean: finite('la media μ'),
    dispersionType: z.enum(dispersionTypes, { error: 'Elige qué dato de dispersión tienes.' }),
    dispersion: positive('la dispersión'),
    mode: z.enum(chebyshevModes, { error: 'Elige qué quieres acotar.' }),
    k: positive('k').optional(),
    lower: finite('el límite inferior').optional(),
    upper: finite('el límite superior').optional(),
    distance: positive('la distancia c').optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'k' && v.k === undefined) {
      ctx.addIssue({ code: 'custom', path: ['k'], message: 'Ingresa k.' });
    }
    if (v.mode === 'fuera' && v.distance === undefined) {
      ctx.addIssue({ code: 'custom', path: ['distance'], message: 'Ingresa la distancia c.' });
    }
    if (v.mode === 'intervalo') {
      if (v.lower === undefined) {
        ctx.addIssue({ code: 'custom', path: ['lower'], message: 'Ingresa el límite inferior.' });
      }
      if (v.upper === undefined) {
        ctx.addIssue({ code: 'custom', path: ['upper'], message: 'Ingresa el límite superior.' });
      } else if (v.lower !== undefined && v.upper <= v.lower) {
        ctx.addIssue({
          code: 'custom',
          path: ['upper'],
          message: 'El límite superior debe ser mayor que el inferior.',
        });
      }
    }
  });

export type ChebyshevInput = z.infer<typeof chebyshevInputSchema>;

export interface ChebyshevValue {
  k: number;
  /** Cota: mínima para "dentro" (≥), máxima para "fuera" (≤). */
  bound: number;
  kind: 'minimo' | 'maximo';
  /** Intervalo μ ± kσ. */
  interval: [number, number];
}

export type ChebyshevErrorCode = 'invalid-input';

const n = toLatexNumber;

export function solveChebyshev(
  input: ChebyshevInput,
): CalculatorResult<ChebyshevValue, ChebyshevErrorCode> {
  const { mean: mu, mode } = input;
  const sigma =
    input.dispersionType === 'varianza' ? Math.sqrt(input.dispersion) : input.dispersion;
  const steps: Step[] = [];
  const notices: Notice[] = [];

  if (input.dispersionType === 'varianza') {
    steps.push({
      title: 'Desviación estándar',
      formula: '\\sigma = \\sqrt{\\sigma^2}',
      substitution: `\\sigma = \\sqrt{${n(input.dispersion)}}`,
      result: `\\sigma = ${n(sigma)}`,
    });
  }

  let k: number;
  if (mode === 'k') {
    k = input.k ?? Number.NaN;
    steps.push({
      title: 'Intervalo de k desviaciones estándar',
      formula: '\\mu \\pm k\\sigma',
      substitution: `${n(mu)} \\pm (${n(k)})(${n(sigma)})`,
      result: `(${n(mu - k * sigma)},\\ ${n(mu + k * sigma)})`,
    });
  } else if (mode === 'fuera') {
    const c = input.distance ?? Number.NaN;
    k = c / sigma;
    steps.push({
      title: 'Número de desviaciones estándar',
      explanation: `Alejarse al menos c = ${formatNumber(c)} de la media es alejarse al menos k desviaciones estándar.`,
      formula: 'k = \\frac{c}{\\sigma}',
      substitution: `k = \\frac{${n(c)}}{${n(sigma)}}`,
      result: `k = ${n(k)}`,
    });
  } else {
    const a = input.lower ?? Number.NaN;
    const b = input.upper ?? Number.NaN;
    const below = (mu - a) / sigma;
    const above = (b - mu) / sigma;
    k = Math.max(0, Math.min(below, above));
    const symmetric = Math.abs(below - above) <= 1e-9 * Math.max(1, Math.abs(below));
    steps.push({
      title: 'Número de desviaciones estándar',
      explanation: symmetric
        ? 'El intervalo es simétrico alrededor de la media: sus extremos están a k desviaciones estándar de μ.'
        : 'El intervalo no es simétrico alrededor de la media. Se usa el extremo más cercano a μ: el intervalo contiene a (μ − kσ, μ + kσ), así que la cota sigue valiendo (aunque es más débil).',
      formula: symmetric
        ? 'k = \\frac{b - \\mu}{\\sigma} = \\frac{\\mu - a}{\\sigma}'
        : 'k = \\min\\left(\\frac{\\mu - a}{\\sigma}, \\frac{b - \\mu}{\\sigma}\\right)',
      substitution: symmetric
        ? `k = \\frac{${n(b)} - ${toLatexOperand(mu)}}{${n(sigma)}}`
        : `k = \\min\\left(\\frac{${n(mu)} - ${toLatexOperand(a)}}{${n(sigma)}}, \\frac{${n(b)} - ${toLatexOperand(mu)}}{${n(sigma)}}\\right)`,
      result: `k = ${n(k)}`,
    });
    if (!symmetric) {
      notices.push({
        level: 'info',
        message: `El intervalo no es simétrico alrededor de μ = ${formatNumber(mu)}; la cota se calcula con el lado más cercano.`,
      });
    }
  }

  const inside = mode !== 'fuera';
  const bound = inside ? Math.max(0, 1 - 1 / k ** 2) : Math.min(1, 1 / k ** 2);
  const interval: [number, number] = [mu - k * sigma, mu + k * sigma];
  const target =
    mode === 'intervalo'
      ? `P(${n(input.lower!)} < X < ${n(input.upper!)})`
      : mode === 'fuera'
        ? `P(|X - ${toLatexOperand(mu)}| \\ge ${n(input.distance!)})`
        : `P(${n(interval[0])} < X < ${n(interval[1])})`;
  const boundTex = toLatexRational(bound);

  steps.push({
    title: 'Teorema de Chebyshev',
    explanation: inside
      ? 'Para cualquier distribución, al menos 1 − 1/k² de la probabilidad está a menos de k desviaciones estándar de la media.'
      : 'Por complemento: P(|X − μ| ≥ kσ) = 1 − P(|X − μ| < kσ) ≤ 1 − (1 − 1/k²) = 1/k².',
    formula: inside
      ? 'P(\\mu - k\\sigma < X < \\mu + k\\sigma) \\ge 1 - \\frac{1}{k^2}'
      : 'P(|X - \\mu| \\ge k\\sigma) \\le \\frac{1}{k^2}',
    substitution: inside
      ? `${target} \\ge 1 - \\frac{1}{(${n(k)})^2}`
      : `${target} \\le \\frac{1}{(${n(k)})^2}`,
    result: `${target} ${inside ? '\\ge' : '\\le'} ${boundTex}`,
  });

  if (k <= 1) {
    notices.push({
      level: 'warning',
      message:
        'Con k ≤ 1 la desigualdad no da información: toda probabilidad es ≥ 0 y ≤ 1. Chebyshev solo sirve para k > 1.',
    });
  }
  notices.push({
    level: 'info',
    message:
      'Es una cota válida para cualquier distribución. Si conoces la distribución (normal, binomial…), la probabilidad exacta suele ser mucho mayor que la cota.',
  });

  return {
    ok: true,
    value: { k, bound, kind: inside ? 'minimo' : 'maximo', interval },
    summary: [
      {
        label: inside ? 'Cota inferior' : 'Cota superior',
        value: `${target} ${inside ? '\\ge' : '\\le'} ${boundTex}`,
        emphasis: true,
      },
      { label: 'Desviaciones estándar', value: `k = ${n(k, 6)}` },
      { label: 'Intervalo μ ± kσ', value: `(${n(interval[0], 6)},\\ ${n(interval[1], 6)})` },
    ],
    ...emptyTrace(),
    steps,
    notices,
  };
}

export const chebyshev: Calculator<ChebyshevInput, ChebyshevValue, ChebyshevErrorCode> = {
  meta: {
    id: 'desigualdad-de-chebyshev',
    title: 'Desigualdad de Chebyshev',
    summary: 'Acota la probabilidad de alejarse k desviaciones estándar de la media.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 4.4, teorema 4.10, Ejemplo 4.27; Ejemplo 5.11 (9.ª ed. en español)',
      },
      { sourceId: 'meyer-1998' },
      { sourceId: 'canavos-1995' },
    ],
  },
  inputSchema: chebyshevInputSchema,
  // Walpole, ejemplo 4.27: μ = 8, σ² = 9, distribución desconocida; ¿P(−4 < X < 20)?
  example: {
    mean: 8,
    dispersionType: 'varianza',
    dispersion: 9,
    mode: 'intervalo',
    lower: -4,
    upper: 20,
    k: 2,
    distance: 6,
  },
  solve: solveChebyshev,
};
