/**
 * Distribución normal N(μ, σ): probabilidades por estandarización (Walpole, Myers y Myers,
 * sec. 6.2-6.3):
 *
 *   z = (x − μ)/σ,   P(X < x) = Φ(z),   Φ(z) = ½[1 + erf(z/√2)]
 *
 * Los libros leen Φ(z) de una tabla con z redondeado a 2 decimales; aquí Φ se calcula con la
 * función error, así que el resultado puede diferir de la tabla en la 4.ª cifra decimal cuando z
 * tiene más de 2 decimales.
 */
import { z } from 'zod';
import { toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { normalDensity, standardNormalCdf } from '@/lib/math/normal';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';

export const normalQueryTypes = ['menor', 'mayor', 'entre'] as const;

const finite = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`);

export const normalInputSchema = z
  .object({
    mean: finite('la media μ'),
    sd: finite('la desviación estándar σ').refine((v) => v > 0, 'σ debe ser mayor que 0.'),
    query: z.enum(normalQueryTypes, { error: 'Elige qué probabilidad calcular.' }),
    x: finite('el valor x'),
    x2: finite('el límite superior').optional(),
  })
  .refine((v) => v.query !== 'entre' || (v.x2 !== undefined && v.x2 > v.x), {
    message: 'Para P(a < X < b) indica un límite superior b mayor que a.',
    path: ['x2'],
  });

export type NormalInput = z.infer<typeof normalInputSchema>;

export interface NormalValue {
  probability: number;
  /** Valores z de cada límite. */
  z: number[];
}

export type NormalErrorCode = never;

const n = toLatexNumber;

export function solveNormal(input: NormalInput): CalculatorResult<NormalValue, NormalErrorCode> {
  const { mean: mu, sd: sigma, query, x } = input;
  const limits = query === 'entre' ? [x, input.x2!] : [x];
  const zs = limits.map((v) => (v - mu) / sigma);
  const phis = zs.map(standardNormalCdf);

  const target =
    query === 'menor'
      ? `P(X < ${n(x)})`
      : query === 'mayor'
        ? `P(X > ${n(x)})`
        : `P(${n(x)} < X < ${n(input.x2!)})`;
  const targetZ =
    query === 'menor'
      ? `P(Z < ${n(zs[0]!, 6)})`
      : query === 'mayor'
        ? `P(Z > ${n(zs[0]!, 6)})`
        : `P(${n(zs[0]!, 6)} < Z < ${n(zs[1]!, 6)})`;

  const probability =
    query === 'menor' ? phis[0]! : query === 'mayor' ? 1 - phis[0]! : phis[1]! - phis[0]!;

  const steps: Step[] = [
    {
      title: 'Estandarizar',
      explanation:
        'Se transforma X ~ N(μ, σ) en la normal estándar Z ~ N(0, 1) para usar una sola tabla (o función) para todas las normales.',
      formula: 'z = \\frac{x - \\mu}{\\sigma}',
      substitution: limits
        .map((v, i) => `z_{${i + 1}} = \\frac{${n(v)} - ${toLatexOperand(mu)}}{${n(sigma)}}`)
        .join(', \\qquad '),
      result: zs.map((z, i) => `z_{${i + 1}} = ${n(z, 6)}`).join(', \\qquad '),
    },
    {
      title: 'Buscar el área en la normal estándar',
      explanation: 'Φ(z) es el área bajo la curva a la izquierda de z (la que dan las tablas).',
      formula: '\\Phi(z) = P(Z < z)',
      result: zs.map((z, i) => `\\Phi(${n(z, 6)}) = ${n(phis[i]!, 6)}`).join(', \\qquad '),
    },
    {
      title: 'Calcular la probabilidad',
      formula:
        query === 'menor'
          ? `${target} = ${targetZ} = \\Phi(z_1)`
          : query === 'mayor'
            ? `${target} = ${targetZ} = 1 - \\Phi(z_1)`
            : `${target} = ${targetZ} = \\Phi(z_2) - \\Phi(z_1)`,
      substitution:
        query === 'menor'
          ? undefined
          : query === 'mayor'
            ? `${target} = 1 - ${n(phis[0]!, 6)}`
            : `${target} = ${n(phis[1]!, 6)} - ${n(phis[0]!, 6)}`,
      result: `${target} = ${n(probability, 6)}`,
    },
  ];

  const from = mu - 4 * sigma;
  const to = mu + 4 * sigma;
  const density = Array.from({ length: 161 }, (_, k) => {
    const v = from + ((to - from) * k) / 160;
    return { x: v, y: normalDensity(v, mu, sigma) };
  });
  const highlight =
    query === 'menor'
      ? { from, to: Math.min(x, to) }
      : query === 'mayor'
        ? { from: Math.max(x, from), to }
        : { from: Math.max(x, from), to: Math.min(input.x2!, to) };

  return {
    ok: true,
    value: { probability, z: zs },
    summary: [
      { label: 'Probabilidad', value: `${target} = ${n(probability, 6)}`, emphasis: true },
      { label: 'Estandarizado', value: `${targetZ}` },
    ],
    ...emptyTrace(),
    steps,
    series: [
      {
        id: 'densidad',
        title: `Densidad N(${n(mu)}, ${n(sigma)}) con el área pedida`,
        xLabel: 'x',
        yLabel: 'f(x)',
        points: density,
        highlight: highlight.from < highlight.to ? highlight : undefined,
      },
    ],
    notices: zs.some((z) => Math.round(z * 100) / 100 !== z)
      ? [
          {
            level: 'info',
            message:
              'z tiene más de 2 decimales: con la tabla del libro (z redondeado) el resultado puede diferir en la 4.ª cifra.',
          },
        ]
      : [],
  };
}

export const normal: Calculator<NormalInput, NormalValue, NormalErrorCode> = {
  meta: {
    id: 'distribucion-normal',
    title: 'Distribución normal',
    summary: 'Probabilidades de una normal por estandarización.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 6.3, Ejemplos 6.4, 6.5 y 6.7 (numeración de la 8.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: normalInputSchema,
  // Walpole, ejemplo 6.4: μ = 50, σ = 10; ¿P(45 < X < 62)?
  example: { mean: 50, sd: 10, query: 'entre', x: 45, x2: 62 },
  solve: solveNormal,
};
