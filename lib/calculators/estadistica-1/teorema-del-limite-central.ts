/**
 * Teorema del límite central: la media X̄ de una muestra aleatoria de tamaño n de una población
 * con media μ y varianza σ² tiene, para n grande, distribución aproximadamente normal con media μ
 * y desviación estándar σ/√n (Walpole, Myers, Myers y Ye, sec. 8.4, teorema 8.2):
 *
 *   Z = (X̄ − μ) / (σ/√n)  ≈  N(0, 1)
 *
 * La aproximación suele ser buena con n ≥ 30; si la población es normal, es exacta para todo n.
 */
import { z } from 'zod';
import { toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { normalDensity, standardNormalCdf } from '@/lib/math/normal';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Notice,
  type Step,
} from '../types';
import {
  continuousBetweenError,
  continuousBetweenIsValid,
  continuousQueryShape,
  finiteNumber,
  positiveNumber,
} from './continuous';

export const centralLimitInputSchema = z
  .object({
    mean: finiteNumber('la media de la población μ'),
    sd: positiveNumber('la desviación estándar de la población σ'),
    n: z
      .number({ error: 'Ingresa el tamaño de la muestra n.' })
      .int('n debe ser un número entero.')
      .min(1, 'n debe ser al menos 1.')
      .max(1_000_000, 'n es demasiado grande.'),
    ...continuousQueryShape,
  })
  .refine(continuousBetweenIsValid, continuousBetweenError);

export type CentralLimitInput = z.infer<typeof centralLimitInputSchema>;

export interface CentralLimitValue {
  probability: number;
  standardError: number;
  z: number[];
}

export type CentralLimitErrorCode = never;

const n = toLatexNumber;

export function solveCentralLimit(
  input: CentralLimitInput,
): CalculatorResult<CentralLimitValue, CentralLimitErrorCode> {
  const { mean: mu, sd: sigma, n: size, query } = input;
  const se = sigma / Math.sqrt(size);
  const limits = query === 'entre' ? [input.x, input.x2 ?? input.x] : [input.x];
  const zs = limits.map((v) => (v - mu) / se);
  const phis = zs.map(standardNormalCdf);
  const probability =
    query === 'menor' ? phis[0]! : query === 'mayor' ? 1 - phis[0]! : phis[1]! - phis[0]!;

  const target =
    query === 'menor'
      ? `P(\\bar{X} < ${n(limits[0]!)})`
      : query === 'mayor'
        ? `P(\\bar{X} > ${n(limits[0]!)})`
        : `P(${n(limits[0]!)} < \\bar{X} < ${n(limits[1]!)})`;
  const targetZ =
    query === 'menor'
      ? `P(Z < ${n(zs[0]!, 6)})`
      : query === 'mayor'
        ? `P(Z > ${n(zs[0]!, 6)})`
        : `P(${n(zs[0]!, 6)} < Z < ${n(zs[1]!, 6)})`;

  const steps: Step[] = [
    {
      title: 'Distribución muestral de la media',
      explanation: `Por el teorema del límite central, X̄ es aproximadamente normal con la misma media que la población y una desviación estándar (error estándar) ${size > 1 ? `√${size} veces menor` : 'igual a σ'}.`,
      formula: '\\mu_{\\bar{X}} = \\mu, \\qquad \\sigma_{\\bar{X}} = \\frac{\\sigma}{\\sqrt{n}}',
      substitution: `\\mu_{\\bar{X}} = ${n(mu)}, \\qquad \\sigma_{\\bar{X}} = \\frac{${n(sigma)}}{\\sqrt{${size}}}`,
      result: `\\sigma_{\\bar{X}} = ${n(se)}`,
    },
    {
      title: 'Estandarizar',
      formula: 'z = \\frac{\\bar{x} - \\mu}{\\sigma / \\sqrt{n}}',
      substitution: limits
        .map((v, i) => `z_{${i + 1}} = \\frac{${n(v)} - ${toLatexOperand(mu)}}{${n(se)}}`)
        .join(', \\qquad '),
      result: zs.map((z, i) => `z_{${i + 1}} = ${n(z, 6)}`).join(', \\qquad '),
    },
    {
      title: 'Área bajo la normal estándar',
      explanation: 'Φ(z) es el área a la izquierda de z (la de la tabla de la normal).',
      formula: '\\Phi(z) = P(Z < z)',
      result: zs.map((z, i) => `\\Phi(${n(z, 6)}) = ${n(phis[i]!, 6)}`).join(', \\qquad '),
    },
    {
      title: 'Calcular la probabilidad',
      formula:
        query === 'menor'
          ? `${target} \\approx ${targetZ} = \\Phi(z_1)`
          : query === 'mayor'
            ? `${target} \\approx ${targetZ} = 1 - \\Phi(z_1)`
            : `${target} \\approx ${targetZ} = \\Phi(z_2) - \\Phi(z_1)`,
      substitution:
        query === 'menor'
          ? undefined
          : query === 'mayor'
            ? `${target} \\approx 1 - ${n(phis[0]!, 6)}`
            : `${target} \\approx ${n(phis[1]!, 6)} - ${n(phis[0]!, 6)}`,
      result: `${target} \\approx ${n(probability, 6)}`,
    },
  ];

  const notices: Notice[] = [];
  if (size < 30) {
    notices.push({
      level: 'warning',
      message: `Con n = ${size} < 30 la aproximación normal solo es buena si la población es normal o casi normal.`,
    });
  }
  if (zs.some((z) => Math.round(z * 100) / 100 !== z)) {
    notices.push({
      level: 'info',
      message:
        'z tiene más de 2 decimales: con la tabla del libro (z redondeado) el resultado puede diferir en la 4.ª cifra.',
    });
  }

  const from = mu - 4 * se;
  const to = mu + 4 * se;
  const density = Array.from({ length: 161 }, (_, k) => {
    const x = from + ((to - from) * k) / 160;
    return { x, y: normalDensity(x, mu, se) };
  });
  const highlight =
    query === 'menor'
      ? { from, to: Math.min(limits[0]!, to) }
      : query === 'mayor'
        ? { from: Math.max(limits[0]!, from), to }
        : { from: Math.max(limits[0]!, from), to: Math.min(limits[1]!, to) };

  return {
    ok: true,
    value: { probability, standardError: se, z: zs },
    summary: [
      { label: 'Probabilidad', value: `${target} \\approx ${n(probability, 6)}`, emphasis: true },
      { label: 'Error estándar', value: `\\sigma_{\\bar{X}} = ${n(se, 6)}` },
      { label: 'Estandarizado', value: targetZ },
    ],
    ...emptyTrace(),
    steps,
    notices,
    series: [
      {
        id: 'media-muestral',
        title: 'Distribución aproximada de la media muestral',
        xLabel: 'x̄',
        yLabel: 'f(x̄)',
        points: density,
        highlight: highlight.from < highlight.to ? highlight : undefined,
      },
    ],
  };
}

export const centralLimit: Calculator<CentralLimitInput, CentralLimitValue, CentralLimitErrorCode> =
  {
    meta: {
      id: 'teorema-del-limite-central',
      title: 'Teorema del límite central',
      summary: 'Probabilidades de la media muestral con la aproximación normal.',
      citations: [
        {
          sourceId: 'walpole-1999',
          locator:
            'Sec. 8.4, teorema 8.2, Ejemplos 8.4 y 8.5 y estudio de caso 8.1 (9.ª ed. en español)',
        },
        { sourceId: 'canavos-1995' },
        { sourceId: 'meyer-1998' },
      ],
    },
    inputSchema: centralLimitInputSchema,
    // Walpole, ejemplo 8.4: bombillas con μ = 800 h y σ = 40 h; ¿P(X̄ < 775) con n = 16?
    example: { mean: 800, sd: 40, n: 16, query: 'menor', x: 775 },
    solve: solveCentralLimit,
  };
