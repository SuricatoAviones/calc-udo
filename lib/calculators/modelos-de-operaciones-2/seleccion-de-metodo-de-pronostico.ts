/**
 * Selección del método de pronóstico (Anderson, Sweeney y Williams, secs. 15.2 a 15.4): se
 * aplican varios métodos a la misma serie y se comparan sus medidas de exactitud sobre los datos
 * históricos (MAD, MSE, MAPE). Se elige el de menor error según el criterio indicado.
 *
 * Métodos:
 * - ingenuo: F_{t+1} = Y_t;
 * - promedio de todos los datos anteriores: F_{t+1} = (Y_1 + … + Y_t)/t;
 * - promedio móvil de k periodos: F_{t+1} = (Y_t + … + Y_{t−k+1})/k;
 * - suavizamiento exponencial: F_{t+1} = αY_t + (1 − α)F_t con F_2 = Y_1;
 * - proyección de tendencia lineal: T_t = b₀ + b₁t por mínimos cuadrados (pronósticos dentro de
 *   la muestra).
 *
 * Cada método se mide con los periodos que tienen pronóstico, así que no todos usan el mismo
 * número de errores (como en el libro).
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Series,
  type Step,
} from '../types';
import {
  accuracy,
  timeSeriesField,
  type ForecastAccuracy,
  type ForecastPoint,
} from './forecasting';

export const selectionCriteria = ['mse', 'mad', 'mape'] as const;
export type SelectionCriterion = (typeof selectionCriteria)[number];

function parseList(text: string | undefined, kind: 'orders' | 'alphas'): number[] | string {
  if (!text || text.trim() === '') return [];
  const { values, invalid } = parseDataList(text);
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  if (values.length > 6) return 'El máximo es 6 valores.';
  if (kind === 'orders' && values.some((v) => !Number.isInteger(v) || v < 1)) {
    return 'Los órdenes del promedio móvil deben ser enteros positivos.';
  }
  if (kind === 'alphas' && values.some((v) => !(v > 0 && v <= 1))) {
    return 'Cada α debe estar entre 0 y 1.';
  }
  return values;
}

export const forecastSelectionInputSchema = z
  .object({
    data: timeSeriesField,
    orders: z.string().optional(),
    alphas: z.string().optional(),
    trend: z.enum(['si', 'no'], { error: 'Indica si se incluye la tendencia lineal.' }),
    criterion: z.enum(selectionCriteria, { error: 'Elige el criterio.' }),
  })
  .superRefine((v, ctx) => {
    const orders = parseList(v.orders, 'orders');
    if (typeof orders === 'string')
      ctx.addIssue({ code: 'custom', path: ['orders'], message: orders });
    const alphas = parseList(v.alphas, 'alphas');
    if (typeof alphas === 'string')
      ctx.addIssue({ code: 'custom', path: ['alphas'], message: alphas });
    const size = parseDataList(v.data).values.length;
    if (typeof orders !== 'string' && orders.some((k) => k >= size)) {
      ctx.addIssue({
        code: 'custom',
        path: ['orders'],
        message: 'Cada orden debe ser menor que el número de datos.',
      });
    }
  });

export type ForecastSelectionInput = z.infer<typeof forecastSelectionInputSchema>;

export interface MethodResult {
  method: string;
  points: ForecastPoint[];
  accuracy: ForecastAccuracy;
  next: number;
}

export interface ForecastSelectionValue {
  methods: MethodResult[];
  best: string;
}

export type ForecastSelectionErrorCode = 'invalid-data';

type Result = CalculatorResult<ForecastSelectionValue, ForecastSelectionErrorCode>;

const n = toLatexNumber;

const CRITERION_LABEL: Record<SelectionCriterion, string> = {
  mse: 'MSE',
  mad: 'MAD',
  mape: 'MAPE',
};

function naive(data: number[]): MethodResult {
  const points = data.slice(1).map((y, k) => ({ period: k + 2, actual: y, forecast: data[k]! }));
  return {
    method: 'Ingenuo (último dato)',
    points,
    accuracy: accuracy(points),
    next: data.at(-1)!,
  };
}

function averageOfAll(data: number[]): MethodResult {
  const points: ForecastPoint[] = [];
  let sum = data[0]!;
  for (let t = 1; t < data.length; t++) {
    points.push({ period: t + 1, actual: data[t]!, forecast: sum / t });
    sum += data[t]!;
  }
  return {
    method: 'Promedio de los datos anteriores',
    points,
    accuracy: accuracy(points),
    next: sum / data.length,
  };
}

function movingAverage(data: number[], k: number): MethodResult {
  const points: ForecastPoint[] = [];
  for (let t = k; t < data.length; t++) {
    const window = data.slice(t - k, t);
    points.push({
      period: t + 1,
      actual: data[t]!,
      forecast: window.reduce((a, b) => a + b, 0) / k,
    });
  }
  const next = data.slice(-k).reduce((a, b) => a + b, 0) / k;
  return { method: `Promedio móvil de ${k} periodos`, points, accuracy: accuracy(points), next };
}

function exponential(data: number[], alpha: number): MethodResult {
  const points: ForecastPoint[] = [];
  let forecast = data[0]!;
  for (let t = 1; t < data.length; t++) {
    points.push({ period: t + 1, actual: data[t]!, forecast });
    forecast = alpha * data[t]! + (1 - alpha) * forecast;
  }
  return {
    method: `Suavizamiento exponencial (α = ${formatNumber(alpha)})`,
    points,
    accuracy: accuracy(points),
    next: forecast,
  };
}

function linearTrend(data: number[]): MethodResult & { b0: number; b1: number } {
  const size = data.length;
  const ts = data.map((_, k) => k + 1);
  const tMean = (size + 1) / 2;
  const yMean = data.reduce((a, b) => a + b, 0) / size;
  const b1 =
    ts.reduce((acc, t, k) => acc + (t - tMean) * (data[k]! - yMean), 0) /
    ts.reduce((acc, t) => acc + (t - tMean) ** 2, 0);
  const b0 = yMean - b1 * tMean;
  const points = data.map((y, k) => ({ period: k + 1, actual: y, forecast: b0 + b1 * (k + 1) }));
  return {
    method: 'Proyección de tendencia lineal',
    points,
    accuracy: accuracy(points),
    next: b0 + b1 * (size + 1),
    b0,
    b1,
  };
}

const measure = (acc: ForecastAccuracy, criterion: SelectionCriterion) =>
  criterion === 'mse' ? acc.mse : criterion === 'mad' ? acc.mad : acc.mape;

export function solveForecastSelection(input: ForecastSelectionInput): Result {
  const { values: data } = parseDataList(input.data);
  const orders = parseList(input.orders, 'orders');
  const alphas = parseList(input.alphas, 'alphas');
  if (typeof orders === 'string' || typeof alphas === 'string' || data.length < 3) {
    return {
      ok: false,
      error: { code: 'invalid-data', message: 'Revisa los datos y los parámetros.' },
      ...emptyTrace(),
    };
  }

  const methods: MethodResult[] = [naive(data), averageOfAll(data)];
  for (const k of [...new Set(orders)].sort((a, b) => a - b)) methods.push(movingAverage(data, k));
  for (const alpha of [...new Set(alphas)]) methods.push(exponential(data, alpha));
  let trend: ReturnType<typeof linearTrend> | null = null;
  if (input.trend === 'si') {
    trend = linearTrend(data);
    methods.push(trend);
  }

  const criterion = input.criterion;
  const candidates = methods.filter((m) => measure(m.accuracy, criterion) !== null);
  const best = candidates.reduce((a, b) =>
    measure(b.accuracy, criterion)! < measure(a.accuracy, criterion)! - 1e-12 ? b : a,
  );

  const methodStep = (m: MethodResult, formula: string): Step => {
    const sumAbs = m.points.reduce((s, p) => s + Math.abs(p.actual! - p.forecast), 0);
    const sumSq = m.points.reduce((s, p) => s + (p.actual! - p.forecast) ** 2, 0);
    return {
      title: m.method,
      formula,
      substitution: `\\mathrm{MAD} = \\frac{${n(sumAbs, 6)}}{${m.accuracy.count}},\\quad \\mathrm{MSE} = \\frac{${n(sumSq, 6)}}{${m.accuracy.count}}`,
      result: `\\mathrm{MAD} = ${n(m.accuracy.mad, 6)},\\ \\mathrm{MSE} = ${n(m.accuracy.mse, 6)},\\ \\mathrm{MAPE} = ${m.accuracy.mape === null ? '\\text{no definido}' : `${n(m.accuracy.mape, 4)}\\,\\%`}`,
    };
  };
  const formulas = new Map<string, string>([
    ['Ingenuo (último dato)', 'F_{t+1} = Y_t'],
    ['Promedio de los datos anteriores', 'F_{t+1} = \\frac{1}{t}\\sum_{i=1}^{t} Y_i'],
  ]);
  const children = methods.map((m) => {
    if (formulas.has(m.method)) return methodStep(m, formulas.get(m.method)!);
    if (m.method.startsWith('Promedio móvil')) {
      return methodStep(m, 'F_{t+1} = \\frac{Y_t + Y_{t-1} + \\cdots + Y_{t-k+1}}{k}');
    }
    if (m.method.startsWith('Suavizamiento')) {
      return methodStep(m, 'F_{t+1} = \\alpha Y_t + (1 - \\alpha) F_t, \\qquad F_2 = Y_1');
    }
    return methodStep(
      m,
      trend ? `T_t = b_0 + b_1 t = ${n(trend.b0, 6)} + ${n(trend.b1, 6)}\\,t` : 'T_t = b_0 + b_1 t',
    );
  });

  const steps: Step[] = [
    {
      title: 'Medidas de exactitud',
      explanation:
        'Cada método se aplica a los datos históricos y se mide cuánto se equivoca en los periodos en que tiene pronóstico.',
      formula:
        'e_t = Y_t - F_t, \\quad \\mathrm{MAD} = \\frac{\\sum|e_t|}{k}, \\quad \\mathrm{MSE} = \\frac{\\sum e_t^2}{k}, \\quad \\mathrm{MAPE} = \\frac{1}{k}\\sum\\left|\\frac{e_t}{Y_t}\\right| 100\\,\\%',
    },
    { title: 'Métodos evaluados', children },
    {
      title: `Selección por el ${CRITERION_LABEL[criterion]}`,
      explanation:
        'Se elige el método con el menor error histórico. Antes de usarlo conviene revisar si el patrón de la serie (horizontal, con tendencia, estacional) seguirá igual en el futuro.',
      substitution: candidates
        .map((m) => `\\text{${m.method}}: ${n(measure(m.accuracy, criterion)!, 6)}`)
        .join(' \\\\ '),
      result: `\\text{${best.method}}`,
    },
  ];

  const rows = methods.map((m): Record<string, CellValue> => ({
    method: m.method,
    count: m.accuracy.count,
    mad: m.accuracy.mad,
    mse: m.accuracy.mse,
    mape: m.accuracy.mape,
    next: m.next,
    best: m === best ? '✓' : '',
  }));
  const series: Series[] = [
    {
      id: 'serie',
      title: 'Serie y pronósticos del mejor método',
      xLabel: 'Periodo t',
      yLabel: 'Valor',
      label: 'Datos',
      points: data.map((y, k) => ({ x: k + 1, y })),
      others: [
        {
          label: best.method,
          points: [
            ...best.points.map((p) => ({ x: p.period, y: p.forecast })),
            { x: data.length + 1, y: best.next },
          ],
        },
      ],
    },
  ];

  return {
    ok: true,
    value: { methods, best: best.method },
    summary: [
      {
        label: `Mejor método (${CRITERION_LABEL[criterion]})`,
        value: `\\text{${best.method}}`,
        emphasis: true,
      },
      {
        label: CRITERION_LABEL[criterion],
        value: n(measure(best.accuracy, criterion)!, 6),
      },
      { label: `Pronóstico para el periodo ${data.length + 1}`, value: n(best.next, 6) },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'comparacion',
        title: 'Comparación de los métodos',
        columns: [
          { key: 'method', header: '\\text{Método}', format: 'text' },
          { key: 'count', header: 'k' },
          { key: 'mad', header: '\\mathrm{MAD}' },
          { key: 'mse', header: '\\mathrm{MSE}' },
          { key: 'mape', header: '\\mathrm{MAPE}\\ (\\%)' },
          { key: 'next', header: `F_{${data.length + 1}}` },
          { key: 'best', header: '\\text{Elegido}', format: 'text' },
        ],
        rows,
      },
    ],
    series,
    notices:
      methods.some((m) => m.accuracy.mape === null) && criterion === 'mape'
        ? [
            {
              level: 'warning',
              message: 'Algún dato vale 0: el MAPE no está definido para todos los métodos.',
            },
          ]
        : [],
  };
}

export const forecastSelection: Calculator<
  ForecastSelectionInput,
  ForecastSelectionValue,
  ForecastSelectionErrorCode
> = {
  meta: {
    id: 'seleccion-de-metodo-de-pronostico',
    title: 'Comparación de métodos de pronóstico',
    summary: 'Compara varios métodos sobre los mismos datos con MAD, MSE y MAPE.',
    citations: [
      {
        sourceId: 'anderson-1993',
        locator: 'Secs. 15.2 a 15.4, serie de ventas de gasolina (13.ª ed.)',
      },
      { sourceId: 'aquilano-1994' },
      { sourceId: 'hillier-lieberman-2002', locator: 'Cap. 20, errores de pronóstico (7.ª ed.)' },
    ],
  },
  inputSchema: forecastSelectionInputSchema,
  // Anderson, tabla 15.1: ventas semanales de gasolina (miles de galones).
  example: {
    data: '17, 21, 19, 23, 18, 16, 20, 18, 22, 20, 15, 22',
    orders: '3, 6',
    alphas: '0.2',
    trend: 'no',
    criterion: 'mse',
  },
  solve: solveForecastSelection,
};
