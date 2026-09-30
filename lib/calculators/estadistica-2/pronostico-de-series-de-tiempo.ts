/**
 * Predicción con series de tiempo (Anderson, Sweeney y Williams, cap. de pronósticos): se proyecta
 * la tendencia (largo plazo) y, si hay estacionalidad, se multiplica por el índice estacional de
 * cada periodo (corto plazo):
 *
 *   F_{n+h} = T_{n+h} × S_{estación de n+h},   T_t = b₀ + b₁t
 *
 * Se agregan las medidas de exactitud dentro de la muestra (MAD, MSE y MAPE) con los valores
 * ajustados Tₜ × Sₜ.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type SummaryItem,
} from '../types';
import { parseSample } from './samples';
import {
  decompose,
  decompositionColumns,
  decompositionRows,
  decompositionSteps,
  refineSeries,
  seasonField,
  seasonOf,
  seriesChart,
  trendLatex,
} from './time-series';

export const seriesForecastInputSchema = z
  .object({
    data: z.string(),
    season: seasonField,
    horizon: z
      .number({ error: 'Ingresa cuántos periodos pronosticar.' })
      .int('Debe ser un número entero.')
      .min(1, 'Pronostica al menos 1 periodo.')
      .max(60, 'El máximo es 60 periodos.'),
  })
  .superRefine((v, ctx) => {
    refineSeries(v, ctx);
  });

export type SeriesForecastInput = z.infer<typeof seriesForecastInputSchema>;

export interface SeriesForecastValue {
  forecasts: { t: number; trend: number; index: number; value: number }[];
  b0: number;
  b1: number;
  indices: number[];
  mad: number;
  mse: number;
  mape: number | null;
}

export type SeriesForecastErrorCode = never;

const n = (v: number) => toLatexNumber(v, 6);

export function solveSeriesForecast(
  input: SeriesForecastInput,
): CalculatorResult<SeriesForecastValue, SeriesForecastErrorCode> {
  const y = parseSample(input.data, 3) as number[];
  const d = decompose(y, input.season);
  const size = y.length;
  const steps: Step[] = [...decompositionSteps(d)];

  const forecasts = Array.from({ length: input.horizon }, (_, h) => {
    const t = size + h + 1;
    const trend = d.b0 + d.b1 * t;
    const index = d.season ? d.indices[seasonOf(t, d.season) - 1]! : 1;
    return { t, trend, index, value: trend * index };
  });
  steps.push({
    title: 'Pronósticos',
    explanation: d.season
      ? 'Se proyecta la tendencia al periodo futuro (largo plazo) y se ajusta con el índice de su estación (corto plazo).'
      : 'Se proyecta la tendencia a los periodos futuros.',
    formula: d.season ? 'F_t = T_t \\times S_t = (b_0 + b_1 t)\\,S_t' : 'F_t = T_t = b_0 + b_1 t',
    children: forecasts.slice(0, 12).map((f) => ({
      title: `Periodo t = ${f.t}${d.season ? ` (estación ${seasonOf(f.t, d.season)})` : ''}`,
      substitution: d.season
        ? `F_{${f.t}} = (${n(d.b0)} + ${n(d.b1)}(${f.t}))(${n(f.index)}) = ${n(f.trend)}(${n(f.index)})`
        : `F_{${f.t}} = ${n(d.b0)} + ${n(d.b1)}(${f.t})`,
      result: `F_{${f.t}} = ${n(f.value)}`,
    })),
  });

  const fitted = y.map((_, i) => d.trend[i]! * d.periodIndex[i]!);
  const errors = y.map((v, i) => v - fitted[i]!);
  const mad = errors.reduce((s, e) => s + Math.abs(e), 0) / size;
  const mse = errors.reduce((s, e) => s + e * e, 0) / size;
  const mape = y.some((v) => v === 0)
    ? null
    : (errors.reduce((s, e, i) => s + Math.abs(e / y[i]!), 0) / size) * 100;
  steps.push({
    title: 'Exactitud dentro de la muestra',
    explanation:
      'Se compara cada dato con su valor ajustado Tₜ × Sₜ. Sirve para comparar modelos: menor error, mejor ajuste.',
    formula:
      'MAD = \\frac{\\sum |Y_t - \\hat{Y}_t|}{n}, \\quad MSE = \\frac{\\sum (Y_t - \\hat{Y}_t)^2}{n}, \\quad MAPE = \\frac{100\\%}{n}\\sum \\left|\\frac{Y_t - \\hat{Y}_t}{Y_t}\\right|',
    result: `MAD = ${n(mad)}, \\quad MSE = ${n(mse)}${mape === null ? '' : `, \\quad MAPE = ${n(mape)}\\,\\%`}`,
  });

  const summary: SummaryItem[] = [
    {
      label: `Pronóstico de t = ${forecasts[0]!.t}`,
      value: `F_{${forecasts[0]!.t}} = ${n(forecasts[0]!.value)}`,
      emphasis: true,
    },
    { label: 'Tendencia', value: trendLatex(d) },
    { label: 'MAD', value: n(mad) },
  ];
  if (forecasts.length > 1) {
    summary.splice(1, 0, {
      label: `Pronósticos de t = ${forecasts[0]!.t} a ${forecasts.at(-1)!.t}`,
      value:
        forecasts
          .slice(0, 8)
          .map((f) => n(f.value))
          .join(',\\ ') + (forecasts.length > 8 ? ',\\ \\ldots' : ''),
    });
  }

  return {
    ok: true,
    value: { forecasts, b0: d.b0, b1: d.b1, indices: d.indices, mad, mse, mape },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'pronosticos',
        title: 'Pronósticos',
        columns: [
          { key: 't', header: 't' },
          ...(d.season ? [{ key: 'season', header: '\\text{Estación}' }] : []),
          { key: 'trend', header: 'T_t' },
          ...(d.season ? [{ key: 'index', header: 'S_t' }] : []),
          { key: 'value', header: 'F_t' },
        ],
        rows: forecasts.map((f) => ({
          t: f.t,
          season: d.season ? seasonOf(f.t, d.season) : null,
          trend: f.trend,
          index: f.index,
          value: f.value,
        })),
      },
      {
        id: 'ajuste',
        title: 'Serie, componentes y ajuste',
        columns: [
          ...decompositionColumns(d, false),
          { key: 'fitted', header: '\\hat{Y}_t = T_t S_t' },
          { key: 'error', header: 'Y_t - \\hat{Y}_t' },
        ],
        rows: decompositionRows(d).map((row, i) => ({
          ...row,
          fitted: fitted[i]!,
          error: errors[i]!,
        })),
      },
    ],
    series: [
      seriesChart(
        d,
        forecasts.map((f) => ({ t: f.t, value: f.value })),
      ),
    ],
    notices:
      input.horizon > (d.season ?? 4)
        ? [
            {
              level: 'info',
              message: `Los pronósticos a largo plazo (${formatNumber(input.horizon)} periodos) suponen que la tendencia lineal se mantiene; su incertidumbre crece con el horizonte.`,
            },
          ]
        : [],
  };
}

export const seriesForecast: Calculator<
  SeriesForecastInput,
  SeriesForecastValue,
  SeriesForecastErrorCode
> = {
  meta: {
    id: 'pronostico-de-series-de-tiempo',
    title: 'Predicción con series de tiempo',
    summary:
      'Pronósticos a corto y largo plazo con la tendencia lineal y los índices estacionales.',
    citations: [
      {
        sourceId: 'anderson-1993',
        locator:
          'Cap. de pronósticos: proyección de la tendencia (ventas de bicicletas) y pronóstico con tendencia y estacionalidad (ventas trimestrales de televisores)',
      },
      { sourceId: 'canavos-1995' },
    ],
  },
  inputSchema: seriesForecastInputSchema,
  example: {
    data: '4.8 4.1 6.0 6.5 5.8 5.2 6.8 7.4 6.0 5.6 7.5 7.8 6.3 5.9 8.0 8.4',
    season: 4,
    horizon: 4,
  },
  solve: solveSeriesForecast,
};
