/**
 * Punto de reorden y stock de seguridad con demanda aleatoria durante el tiempo de entrega (Taha,
 * modelo de EOQ «probabilizado», ejemplo 14.1-1 de la 9.ª ed.; Hillier & Lieberman, sec. 19.5 de
 * la 7.ª ed.). Si la demanda durante el tiempo de entrega es normal N(μ_L, σ_L):
 *
 *   R = μ_L + z σ_L,   stock de seguridad = z σ_L,   z = Φ⁻¹(nivel de servicio)
 *
 * Si se conoce la demanda por periodo (media d y desviación σ_d, periodos independientes) y el
 * tiempo de entrega L: μ_L = d L y σ_L = σ_d √L.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { normalDensity, standardNormalQuantile } from '@/lib/math/normal';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';

export const leadDemandModes = ['tiempo-de-entrega', 'por-periodo'] as const;

const optionalNumber = z
  .number({ error: 'Escribe un número.' })
  .refine(Number.isFinite, 'Debe ser un número finito.')
  .optional();

export const reorderInputSchema = z
  .object({
    mode: z.enum(leadDemandModes, { error: 'Elige cómo se describe la demanda.' }),
    leadDemandMean: optionalNumber,
    leadDemandSd: optionalNumber,
    demandMean: optionalNumber,
    demandSd: optionalNumber,
    leadTime: optionalNumber,
    serviceLevel: z
      .number({ error: 'Ingresa el nivel de servicio.' })
      .refine(
        (v) => Number.isFinite(v) && v > 0 && v < 1,
        'Escribe el nivel de servicio como probabilidad entre 0 y 1: 0.95 = 95 %.',
      ),
  })
  .superRefine((v, ctx) => {
    const require = (key: keyof typeof v, label: string, positive: boolean) => {
      const value = v[key];
      if (typeof value !== 'number') {
        ctx.addIssue({ code: 'custom', path: [key], message: `Ingresa ${label}.` });
      } else if (positive ? value <= 0 : value < 0) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${label[0]!.toUpperCase()}${label.slice(1)} debe ser ${positive ? 'mayor que 0' : '0 o más'}.`,
        });
      }
    };
    if (v.mode === 'tiempo-de-entrega') {
      require('leadDemandMean', 'la demanda media en el tiempo de entrega', false);
      require('leadDemandSd', 'la desviación de esa demanda', true);
    } else {
      require('demandMean', 'la demanda media por periodo', false);
      require('demandSd', 'la desviación de la demanda por periodo', true);
      require('leadTime', 'el tiempo de entrega', true);
    }
  });

export type ReorderInput = z.infer<typeof reorderInputSchema>;

export interface ReorderValue {
  leadDemandMean: number;
  leadDemandSd: number;
  z: number;
  safetyStock: number;
  reorderPoint: number;
  stockoutProbability: number;
}

export type ReorderErrorCode = 'missing-data';

const n = toLatexNumber;

export function solveReorder(
  input: ReorderInput,
): CalculatorResult<ReorderValue, ReorderErrorCode> {
  const perPeriod = input.mode === 'por-periodo';
  const d = input.demandMean;
  const sd = input.demandSd;
  const L = input.leadTime;
  const mean = perPeriod ? (d ?? NaN) * (L ?? NaN) : (input.leadDemandMean ?? NaN);
  const sigma = perPeriod ? (sd ?? NaN) * Math.sqrt(L ?? NaN) : (input.leadDemandSd ?? NaN);
  if (!Number.isFinite(mean) || !Number.isFinite(sigma) || sigma <= 0) {
    return {
      ok: false,
      error: {
        code: 'missing-data',
        message: 'Faltan datos de la demanda durante el tiempo de entrega.',
      },
      ...emptyTrace(),
    };
  }

  const level = input.serviceLevel;
  const z = standardNormalQuantile(level);
  const safety = z * sigma;
  const R = mean + safety;

  const steps: Step[] = [];
  if (perPeriod) {
    steps.push({
      title: 'Demanda durante el tiempo de entrega',
      explanation:
        'Con demandas independientes en cada periodo, las medias y las varianzas de los L periodos se suman.',
      formula: '\\mu_L = d\\,L, \\qquad \\sigma_L = \\sigma_d \\sqrt{L}',
      substitution: `\\mu_L = ${n(d!)}(${n(L!)}), \\qquad \\sigma_L = ${n(sd!)}\\sqrt{${n(L!)}}`,
      result: `\\mu_L = ${n(mean, 6)}, \\qquad \\sigma_L = ${n(sigma, 6)}`,
    });
  }
  steps.push(
    {
      title: 'Valor z del nivel de servicio',
      explanation: `Se busca en la tabla de la normal el valor z que deja un área de ${formatNumber(level)} a su izquierda: la probabilidad de no quedarse sin inventario mientras llega el pedido.`,
      formula: '\\Phi(z) = \\text{nivel de servicio} = 1 - \\alpha',
      substitution: `\\Phi(z) = ${n(level)}`,
      result: `z = ${n(z, 4)}`,
    },
    {
      title: 'Stock de seguridad',
      explanation:
        'Inventario adicional que cubre la variación de la demanda durante el tiempo de entrega.',
      formula: 'B = z\\,\\sigma_L',
      substitution: `B = ${n(z, 6)}(${n(sigma, 6)})`,
      result: `B = ${n(safety, 6)}`,
    },
    {
      title: 'Punto de reorden',
      explanation:
        'Se hace el pedido cuando el inventario baja a la demanda media del tiempo de entrega más el stock de seguridad.',
      formula: 'R = \\mu_L + B',
      substitution: `R = ${n(mean, 6)} + ${n(safety, 6)}`,
      result: `R = ${n(R, 6)}`,
    },
  );

  return {
    ok: true,
    value: {
      leadDemandMean: mean,
      leadDemandSd: sigma,
      z,
      safetyStock: safety,
      reorderPoint: R,
      stockoutProbability: 1 - level,
    },
    summary: [
      { label: 'Punto de reorden', value: `R = ${n(R, 6)}`, emphasis: true },
      { label: 'Stock de seguridad', value: `B = ${n(safety, 6)}` },
      { label: 'Valor z', value: `z = ${n(z, 4)}` },
      {
        label: 'Probabilidad de faltante en el tiempo de entrega',
        value: `\\alpha = ${n(1 - level, 6)}`,
      },
    ],
    ...emptyTrace(),
    steps,
    notices:
      safety < 0
        ? [
            {
              level: 'warning',
              message:
                'Con un nivel de servicio menor que 0.5 el stock de seguridad es negativo: el punto de reorden queda por debajo de la demanda media.',
            },
          ]
        : [],
    series: [
      {
        id: 'demanda',
        title: `Demanda en el tiempo de entrega ≈ N(${formatNumber(mean, 5)}, ${formatNumber(sigma, 5)}) y área hasta R`,
        xLabel: 'Demanda',
        yLabel: 'densidad',
        points: Array.from({ length: 161 }, (_, k) => {
          const x = mean - 4 * sigma + (8 * sigma * k) / 160;
          return { x, y: normalDensity(x, mean, sigma) };
        }),
        highlight: { from: mean - 4 * sigma, to: Math.min(R, mean + 4 * sigma) },
      },
    ],
  };
}

export const reorder: Calculator<ReorderInput, ReorderValue, ReorderErrorCode> = {
  meta: {
    id: 'punto-de-reorden',
    title: 'Punto de reorden y stock de seguridad',
    summary: 'Cuándo pedir si la demanda durante el tiempo de entrega es aleatoria.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Modelo de EOQ «probabilizado», Ejemplo 14.1-1 (9.ª ed. en inglés)',
      },
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 19.5, ejemplo de las bocinas con demanda variable (7.ª ed. en inglés)',
      },
      { sourceId: 'diaz-matalobos-1998' },
    ],
  },
  inputSchema: reorderInputSchema,
  // Taha, ejemplo 14.1-1: demanda diaria normal con media 100 y desviación 10, tiempo de entrega
  // (efectivo) de 2 días y probabilidad de faltante de 0.05.
  example: {
    mode: 'por-periodo',
    demandMean: 100,
    demandSd: 10,
    leadTime: 2,
    serviceLevel: 0.95,
  },
  solve: solveReorder,
};
