/**
 * Promedios móviles simple y ponderado (Anderson, Sweeney y Williams, cap. de pronósticos:
 * ejemplo de las ventas semanales de gasolina).
 *
 *   Simple:     F_{t+1} = (Y_t + Y_{t−1} + … + Y_{t−n+1}) / n
 *   Ponderado:  F_{t+1} = (w₁Y_t + w₂Y_{t−1} + … + w_nY_{t−n+1}) / Σw
 *
 * Los pesos se dan del periodo más reciente al más antiguo; si no suman 1 se dividen entre su
 * suma, como se hace con pesos enteros (3, 2, 1 → 3/6, 2/6, 1/6).
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type Step } from '../types';
import {
  accuracy,
  accuracyNotices,
  accuracySteps,
  forecastOutput,
  nextForecastStep,
  timeSeriesField,
  type ForecastErrorCode,
  type ForecastPoint,
  type ForecastResult,
  type ForecastValue,
} from './forecasting';

export const movingAverageTypes = ['simple', 'ponderado'] as const;

function parseWeights(text: string | undefined, count: number): number[] | string {
  const { values, invalid } = parseDataList(text ?? '');
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  if (values.length !== count) {
    return `Escribe ${count} ${count === 1 ? 'peso' : 'pesos'}, uno por cada periodo del promedio.`;
  }
  if (values.some((w) => w < 0)) return 'Los pesos no pueden ser negativos.';
  if (values.reduce((s, w) => s + w, 0) <= 0) return 'Al menos un peso debe ser positivo.';
  return values;
}

export const movingAverageInputSchema = z
  .object({
    data: timeSeriesField,
    periods: z
      .number({ error: 'Ingresa el número de periodos n.' })
      .int('n debe ser un número entero.')
      .min(1, 'n debe ser al menos 1.')
      .max(50, 'n no puede pasar de 50.'),
    type: z.enum(movingAverageTypes, { error: 'Elige el tipo de promedio.' }),
    weights: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const { values } = parseDataList(v.data);
    if (values.length >= 3 && v.periods >= values.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['periods'],
        message: `n debe ser menor que el número de datos (${values.length}).`,
      });
    }
    if (v.type === 'ponderado') {
      const weights = parseWeights(v.weights, v.periods);
      if (typeof weights === 'string') {
        ctx.addIssue({ code: 'custom', path: ['weights'], message: weights });
      }
    }
  });

export type MovingAverageInput = z.infer<typeof movingAverageInputSchema>;

const n = toLatexNumber;

export function solveMovingAverage(input: MovingAverageInput): ForecastResult {
  const { values: data } = parseDataList(input.data);
  const size = input.periods;
  const weighted = input.type === 'ponderado';
  const weights = weighted ? parseWeights(input.weights, size) : Array<number>(size).fill(1);
  if (typeof weights === 'string' || data.length < 3 || size >= data.length) {
    return {
      ok: false,
      error: {
        code: 'invalid-data',
        message:
          typeof weights === 'string'
            ? weights
            : 'Hacen falta más datos que periodos en el promedio.',
      },
      ...emptyTrace(),
    };
  }
  const weightSum = weights.reduce((s, w) => s + w, 0);

  const points: ForecastPoint[] = [];
  const children: Step[] = [];
  for (let t = size + 1; t <= data.length + 1; t++) {
    // Y_{t−1}, Y_{t−2}, …, Y_{t−n}: del más reciente al más antiguo.
    const window = Array.from({ length: size }, (_, k) => data[t - 2 - k]!);
    const forecast = window.reduce((s, y, k) => s + weights[k]! * y, 0) / weightSum;
    points.push({ period: t, actual: t <= data.length ? data[t - 1]! : null, forecast });
    children.push({
      title: t <= data.length ? `Periodo ${t}` : `Periodo ${t} (futuro)`,
      substitution: weighted
        ? `F_{${t}} = \\frac{${window.map((y, k) => `${n(weights[k]!)}(${n(y)})`).join(' + ')}}{${n(weightSum)}}`
        : `F_{${t}} = \\frac{${window.map((y) => n(y)).join(' + ')}}{${size}}`,
      result: `F_{${t}} = ${n(forecast, 6)}`,
    });
  }

  const acc = accuracy(points);
  const next = points.at(-1)!;
  const steps: Step[] = [
    {
      title: weighted ? 'Promedio móvil ponderado' : 'Promedio móvil simple',
      explanation: weighted
        ? `El pronóstico de cada periodo es el promedio de los ${size} datos anteriores, dando más peso a los más recientes. Los pesos van del periodo más reciente al más antiguo: ${weights.join(', ')} (suman ${weightSum}).`
        : `El pronóstico de cada periodo es el promedio de los ${size} datos anteriores. El primer pronóstico posible es el del periodo ${size + 1}.`,
      formula: weighted
        ? 'F_{t+1} = \\frac{w_1 Y_t + w_2 Y_{t-1} + \\cdots + w_n Y_{t-n+1}}{\\sum w}'
        : 'F_{t+1} = \\frac{Y_t + Y_{t-1} + \\cdots + Y_{t-n+1}}{n}',
      children,
    },
    ...accuracySteps(points, acc),
    nextForecastStep(next, data.length),
  ];

  const value: ForecastValue = {
    ...acc,
    next: next.forecast,
    nextPeriod: next.period,
    forecasts: points,
  };
  const label = weighted ? `promedio ponderado de ${size}` : `promedio móvil de ${size}`;
  return {
    ok: true,
    value,
    ...emptyTrace(),
    ...forecastOutput(data, points, acc, label),
    steps,
    notices: accuracyNotices(acc),
  };
}

export const movingAverage: Calculator<MovingAverageInput, ForecastValue, ForecastErrorCode> = {
  meta: {
    id: 'promedio-movil',
    title: 'Promedios móviles (simple y ponderado)',
    summary: 'Pronostica con el promedio de los últimos n periodos y mide el error.',
    citations: [
      {
        sourceId: 'anderson-1993',
        locator:
          'Cap. de pronósticos: ventas semanales de gasolina, promedio móvil de 3 semanas (ediciones recientes, tabla 17.1)',
      },
      { sourceId: 'aquilano-1994' },
      { sourceId: 'bonini-2000' },
    ],
  },
  inputSchema: movingAverageInputSchema,
  // Anderson, Sweeney y Williams: ventas de gasolina (miles de galones) de 12 semanas.
  example: {
    data: '17 21 19 23 18 16 20 18 22 20 15 22',
    periods: 3,
    type: 'simple',
    weights: '3 2 1',
  },
  solve: solveMovingAverage,
};
