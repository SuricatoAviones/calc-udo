/**
 * Análisis de una serie de tiempo: tendencia, variación estacional y fluctuaciones cíclicas con la
 * descomposición multiplicativa de time-series.ts.
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
  seriesChart,
  trendLatex,
  type Decomposition,
} from './time-series';

export const seriesComponentsInputSchema = z
  .object({ data: z.string(), season: seasonField })
  .superRefine((v, ctx) => {
    refineSeries(v, ctx);
  });

export type SeriesComponentsInput = z.infer<typeof seriesComponentsInputSchema>;

export type SeriesComponentsValue = Decomposition;
export type SeriesComponentsErrorCode = never;

const n = (v: number) => toLatexNumber(v, 6);

export function solveSeriesComponents(
  input: SeriesComponentsInput,
): CalculatorResult<SeriesComponentsValue, SeriesComponentsErrorCode> {
  const y = parseSample(input.data, 3) as number[];
  const d = decompose(y, input.season);
  const steps: Step[] = [
    {
      title: 'Modelo multiplicativo',
      explanation: d.season
        ? `Cada dato se ve como el producto de la tendencia, el efecto estacional (ciclo de ${d.season} periodos), las fluctuaciones cíclicas y la irregularidad.`
        : 'Sin estacionalidad, cada dato se compara con la tendencia: lo que queda son las fluctuaciones cíclicas (y la irregularidad).',
      formula: d.season
        ? 'Y_t = T_t \\times S_t \\times C_t \\times I_t'
        : 'Y_t = T_t \\times C_t \\times I_t',
    },
    ...decompositionSteps(d),
  ];

  // Fluctuaciones cíclicas.
  const peak = d.cyclical.reduce((best, v, i) => (v > d.cyclical[best]! ? i : best), 0);
  const trough = d.cyclical.reduce((best, v, i) => (v < d.cyclical[best]! ? i : best), 0);
  steps.push({
    title: 'Fluctuaciones cíclicas',
    explanation: `${d.season ? 'Al dividir cada dato entre T × S queda el componente cíclico-irregular' : 'El porcentaje de la tendencia y el residuo cíclico relativo miden cuánto se aparta cada dato de la tendencia'}: por encima de 100 % la serie está sobre la tendencia y por debajo, bajo ella. El mayor valor está en t = ${peak + 1} (${formatNumber(d.cyclical[peak]!, 4)} %) y el menor en t = ${trough + 1} (${formatNumber(d.cyclical[trough]!, 4)} %).`,
    formula: d.season
      ? 'C_t I_t = \\frac{Y_t}{T_t\\,S_t} \\times 100\\%'
      : '\\frac{Y_t}{T_t} \\times 100\\%, \\qquad \\frac{Y_t - T_t}{T_t} \\times 100\\%',
    substitution: d.season
      ? `C_1 I_1 = \\frac{${n(y[0]!)}}{${n(d.trend[0]!)}(${n(d.periodIndex[0]!)})} \\times 100\\%`
      : `\\frac{Y_1}{T_1} = \\frac{${n(y[0]!)}}{${n(d.trend[0]!)}} \\times 100\\%`,
    result: `${n(d.cyclical[0]!)}\\,\\%`,
  });

  const summary: SummaryItem[] = [
    { label: 'Tendencia', value: trendLatex(d), emphasis: true },
    ...(d.season
      ? [
          {
            label: 'Índices estacionales',
            value: d.indices.map((v, j) => `S_{${j + 1}} = ${toLatexNumber(v, 4)}`).join(',\\ '),
            emphasis: true,
          },
        ]
      : []),
    {
      label: 'Crecimiento por periodo',
      value: `b_1 = ${n(d.b1)}`,
    },
  ];

  return {
    ok: true,
    value: d,
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'descomposicion',
        title: 'Descomposición de la serie',
        columns: decompositionColumns(d, true),
        rows: decompositionRows(d),
      },
      ...(d.season
        ? [
            {
              id: 'indices',
              title: 'Índices estacionales',
              columns: [
                { key: 'season', header: '\\text{Estación}' },
                { key: 'raw', header: '\\bar{r}_j' },
                { key: 'index', header: 'S_j' },
              ],
              rows: d.indices.map((v, j) => ({ season: j + 1, raw: d.rawIndices[j]!, index: v })),
            },
          ]
        : []),
    ],
    series: [seriesChart(d)],
  };
}

export const seriesComponents: Calculator<
  SeriesComponentsInput,
  SeriesComponentsValue,
  SeriesComponentsErrorCode
> = {
  meta: {
    id: 'componentes-de-series-de-tiempo',
    title: 'Análisis de series de tiempo',
    summary:
      'Descompone una serie en tendencia, índices estacionales y fluctuaciones cíclicas (modelo multiplicativo).',
    citations: [
      {
        sourceId: 'anderson-1993',
        locator:
          'Cap. de pronósticos: tendencia por mínimos cuadrados (ventas de bicicletas) e índices estacionales con promedios móviles centrados (ventas trimestrales de televisores)',
      },
      { sourceId: 'canavos-1995' },
    ],
  },
  inputSchema: seriesComponentsInputSchema,
  example: {
    data: '4.8 4.1 6.0 6.5 5.8 5.2 6.8 7.4 6.0 5.6 7.5 7.8 6.3 5.9 8.0 8.4',
    season: 4,
  },
  solve: solveSeriesComponents,
};
