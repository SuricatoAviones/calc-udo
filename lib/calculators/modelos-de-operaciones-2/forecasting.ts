/**
 * Piezas comunes de los métodos de pronóstico de series de tiempo (Anderson, Sweeney y Williams,
 * cap. de pronósticos): la serie de datos, las medidas de exactitud y su presentación.
 *
 *   e_t = Y_t − F_t
 *   MAD = Σ|e_t| / k,   MSE = Σe_t² / k,   MAPE = (Σ|e_t / Y_t| / k) × 100 %
 *
 * donde k es el número de periodos que tienen pronóstico y dato real.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { toLatexNumber } from '@/lib/math/format';
import type { CalculatorResult, CellValue, Notice, Step, SummaryItem } from '../types';

export const MAX_DATA = 500;

export const timeSeriesField = z.string().superRefine((text, ctx) => {
  const { values, invalid } = parseDataList(text);
  if (invalid.length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: `No son números: ${invalid
        .slice(0, 3)
        .map((t) => `«${t}»`)
        .join(', ')}${invalid.length > 3 ? '…' : ''}.`,
    });
  } else if (values.length < 3) {
    ctx.addIssue({ code: 'custom', message: 'Ingresa al menos 3 datos de la serie.' });
  } else if (values.length > MAX_DATA) {
    ctx.addIssue({ code: 'custom', message: `El máximo es ${MAX_DATA} datos.` });
  }
});

export interface ForecastPoint {
  period: number;
  /** Dato real; `null` para el periodo futuro que se pronostica. */
  actual: number | null;
  forecast: number;
}

export interface ForecastAccuracy {
  /** Periodos con pronóstico y dato real. */
  count: number;
  mad: number;
  mse: number;
  /** `null` si algún dato real es 0 (el error porcentual no está definido). */
  mape: number | null;
}

export interface ForecastValue extends ForecastAccuracy {
  /** Pronóstico del periodo siguiente al último dato. */
  next: number;
  nextPeriod: number;
  forecasts: ForecastPoint[];
}

export type ForecastErrorCode = 'invalid-data';
export type ForecastResult = CalculatorResult<ForecastValue, ForecastErrorCode>;

const n = toLatexNumber;

export function accuracy(points: ForecastPoint[]): ForecastAccuracy {
  const measured = points.filter((p): p is ForecastPoint & { actual: number } => p.actual !== null);
  const errors = measured.map((p) => p.actual - p.forecast);
  const count = errors.length;
  const mad = errors.reduce((s, e) => s + Math.abs(e), 0) / count;
  const mse = errors.reduce((s, e) => s + e * e, 0) / count;
  const mape = measured.some((p) => p.actual === 0)
    ? null
    : (measured.reduce((s, p) => s + Math.abs((p.actual - p.forecast) / p.actual), 0) / count) *
      100;
  return { count, mad, mse, mape };
}

/** Pasos de las medidas de error, con las sumas sustituidas. */
export function accuracySteps(points: ForecastPoint[], acc: ForecastAccuracy): Step[] {
  const measured = points.filter((p) => p.actual !== null);
  const sumAbs = measured.reduce((s, p) => s + Math.abs(p.actual! - p.forecast), 0);
  const sumSq = measured.reduce((s, p) => s + (p.actual! - p.forecast) ** 2, 0);
  const steps: Step[] = [
    {
      title: 'Errores del pronóstico',
      explanation: `Se comparan los pronósticos con los ${acc.count} datos reales que tienen pronóstico. La tabla de resultados trae cada error.`,
      formula: 'e_t = Y_t - F_t',
    },
    {
      title: 'Desviación absoluta media (MAD)',
      formula: '\\mathrm{MAD} = \\frac{\\sum |e_t|}{k}',
      substitution: `\\mathrm{MAD} = \\frac{${n(sumAbs, 6)}}{${acc.count}}`,
      result: `\\mathrm{MAD} = ${n(acc.mad, 6)}`,
    },
    {
      title: 'Error cuadrático medio (MSE)',
      explanation:
        'Penaliza más los errores grandes. Es el criterio más usado para comparar métodos.',
      formula: '\\mathrm{MSE} = \\frac{\\sum e_t^2}{k}',
      substitution: `\\mathrm{MSE} = \\frac{${n(sumSq, 6)}}{${acc.count}}`,
      result: `\\mathrm{MSE} = ${n(acc.mse, 6)}`,
    },
  ];
  if (acc.mape !== null) {
    const sumPct = measured.reduce((s, p) => s + Math.abs((p.actual! - p.forecast) / p.actual!), 0);
    steps.push({
      title: 'Error porcentual absoluto medio (MAPE)',
      formula:
        '\\mathrm{MAPE} = \\frac{1}{k}\\sum \\left|\\frac{e_t}{Y_t}\\right| \\times 100\\,\\%',
      substitution: `\\mathrm{MAPE} = \\frac{${n(sumPct, 6)}}{${acc.count}} \\times 100\\,\\%`,
      result: `\\mathrm{MAPE} = ${n(acc.mape, 4)}\\,\\%`,
    });
  }
  return steps;
}

export function accuracySummary(acc: ForecastAccuracy): SummaryItem[] {
  return [
    { label: 'Desviación absoluta media', value: `\\mathrm{MAD} = ${n(acc.mad, 6)}` },
    { label: 'Error cuadrático medio', value: `\\mathrm{MSE} = ${n(acc.mse, 6)}` },
    {
      label: 'Error porcentual absoluto medio',
      value:
        acc.mape === null
          ? '\\mathrm{MAPE}\\ \\text{no definido}'
          : `\\mathrm{MAPE} = ${n(acc.mape, 4)}\\,\\%`,
    },
  ];
}

export function accuracyNotices(acc: ForecastAccuracy): Notice[] {
  return acc.mape === null
    ? [
        {
          level: 'info',
          message:
            'Algún dato real vale 0, así que el MAPE no está definido (habría que dividir entre 0). Compara los métodos con el MAD o el MSE.',
        },
      ]
    : [];
}

/** Tabla, gráfica y resumen comunes a todos los métodos. */
export function forecastOutput(
  data: number[],
  points: ForecastPoint[],
  acc: ForecastAccuracy,
  methodLabel: string,
) {
  const next = points.at(-1)!;
  return {
    summary: [
      {
        label: `Pronóstico para el periodo ${next.period}`,
        value: `F_{${next.period}} = ${n(next.forecast, 6)}`,
        emphasis: true,
      },
      ...accuracySummary(acc),
    ] satisfies SummaryItem[],
    tables: [
      {
        id: 'pronosticos',
        title: `Pronósticos y errores (${methodLabel})`,
        columns: [
          { key: 't', header: 't' },
          { key: 'actual', header: 'Y_t' },
          { key: 'forecast', header: 'F_t' },
          { key: 'error', header: 'e_t' },
          { key: 'abs', header: '|e_t|' },
          { key: 'sq', header: 'e_t^2' },
          { key: 'pct', header: '|e_t / Y_t|\\ (\\%)' },
        ],
        rows: data
          .map((y, k): Record<string, CellValue> => {
            const t = k + 1;
            const p = points.find((q) => q.period === t);
            if (!p) {
              return { t, actual: y, forecast: null, error: null, abs: null, sq: null, pct: null };
            }
            const e = y - p.forecast;
            return {
              t,
              actual: y,
              forecast: p.forecast,
              error: e,
              abs: Math.abs(e),
              sq: e * e,
              pct: y === 0 ? null : Math.abs(e / y) * 100,
            };
          })
          .concat([
            {
              t: next.period,
              actual: null,
              forecast: next.forecast,
              error: null,
              abs: null,
              sq: null,
              pct: null,
            },
          ]),
      },
    ],
    series: [
      {
        id: 'serie',
        title: `Serie de tiempo y pronósticos (${methodLabel})`,
        xLabel: 'Periodo',
        yLabel: 'Valor',
        label: 'Datos reales',
        points: data.map((y, k) => ({ x: k + 1, y })),
        reference: {
          label: 'Pronóstico',
          points: points.map((p) => ({ x: p.period, y: p.forecast })),
        },
      },
    ],
  };
}

export function nextForecastStep(next: ForecastPoint, lastPeriod: number): Step {
  return {
    title: `Pronóstico para el periodo ${next.period}`,
    explanation: `Es el pronóstico que se calcula con los datos hasta el periodo ${lastPeriod}, el último conocido.`,
    result: `F_{${next.period}} = ${n(next.forecast, 6)}`,
  };
}
