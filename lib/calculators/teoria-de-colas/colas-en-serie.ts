/**
 * Colas infinitas en serie (Hillier & Lieberman, sec. 17.9; Winston, sec. 20.10): todos los
 * clientes pasan por m estaciones en el mismo orden. Las llegadas a la primera son de Poisson con
 * tasa λ, cada estación j tiene s_j servidores exponenciales de tasa μ_j y cola sin límite.
 *
 * Por la propiedad de equivalencia (Burke) y el teorema de Jackson, si λ < s_j μ_j en todas las
 * estaciones, la salida de cada una es de Poisson con tasa λ y cada estación es un M/M/s_j
 * independiente con tasa λ. Las medidas de la línea se suman:
 *
 *   L = Σ L_j,   L_q = Σ L_{q,j},   W = Σ W_j,   W_q = Σ W_{q,j}
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import { rateField } from './queueing';
import {
  analyzeStations,
  MAX_STATIONS,
  stationShape,
  stationsTable,
  type StationResult,
} from './networks';

export const seriesQueueInputSchema = z.object({
  lambda: rateField('la tasa de llegadas λ'),
  stations: z
    .array(z.object(stationShape))
    .min(1, 'Agrega al menos una estación.')
    .max(MAX_STATIONS, `El máximo es ${MAX_STATIONS} estaciones.`),
});

export type SeriesQueueInput = z.infer<typeof seriesQueueInputSchema>;

export interface SeriesQueueValue {
  stations: StationResult[];
  L: number;
  Lq: number;
  W: number;
  Wq: number;
}

export type SeriesQueueErrorCode = 'unstable';

type Result = CalculatorResult<SeriesQueueValue, SeriesQueueErrorCode>;

const n = toLatexNumber;

export function solveSeriesQueue({ lambda, stations }: SeriesQueueInput): Result {
  const steps: Step[] = [
    {
      title: 'Llegadas a cada estación',
      explanation:
        'Si cada estación tiene capacidad para λ (λ < sⱼμⱼ), en estado estable su salida también es un proceso de Poisson con tasa λ, que es la entrada de la siguiente. Así, cada estación se analiza como un M/M/s independiente con la misma λ.',
      formula: '\\lambda_1 = \\lambda_2 = \\cdots = \\lambda_m = \\lambda',
      result: `\\lambda_j = ${n(lambda)}`,
    },
  ];
  const analysis = analyzeStations(
    stations,
    stations.map(() => lambda),
  );
  steps.push(...analysis.steps);
  if ('unstable' in analysis) {
    return {
      ok: false,
      error: {
        code: 'unstable',
        message: `La estación ${analysis.unstable} no alcanza a atender λ = ${formatNumber(lambda)} clientes por unidad de tiempo: su cola crece sin límite. Aumenta sus servidores o su tasa de servicio.`,
      },
      ...emptyTrace(),
      steps,
    };
  }
  const { results } = analysis;
  const sum = (key: 'L' | 'Lq' | 'W' | 'Wq') => results.reduce((acc, r) => acc + r[key], 0);
  const value: SeriesQueueValue = {
    stations: results,
    L: sum('L'),
    Lq: sum('Lq'),
    W: sum('W'),
    Wq: sum('Wq'),
  };
  const list = (key: 'L' | 'W' | 'Wq') => results.map((r) => n(r[key], 6)).join(' + ');
  steps.push({
    title: 'Medidas de toda la línea',
    explanation:
      'Cada cliente pasa una vez por cada estación, así que los tiempos y los números promedio de clientes se suman.',
    formula: 'L = \\sum_j L_j, \\qquad W = \\sum_j W_j, \\qquad W_q = \\sum_j W_{q,j}',
    substitution: `L = ${list('L')}, \\qquad W = ${list('W')}, \\qquad W_q = ${list('Wq')}`,
    result: `L = ${n(value.L)}, \\qquad W = ${n(value.W)}, \\qquad W_q = ${n(value.Wq)}`,
  });

  const busiest = results.reduce((a, b) => (b.rho > a.rho ? b : a));
  return {
    ok: true,
    value,
    summary: [
      { label: 'Tiempo total en la línea', value: `W = ${n(value.W, 6)}`, emphasis: true },
      { label: 'Tiempo total de espera', value: `W_q = ${n(value.Wq, 6)}` },
      { label: 'Clientes en la línea', value: `L = ${n(value.L, 6)}` },
      { label: 'Clientes esperando', value: `L_q = ${n(value.Lq, 6)}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [stationsTable(results)],
    notices: [
      {
        level: 'info',
        message: `La estación más cargada es la ${busiest.station} (ρ = ${formatNumber(busiest.rho, 4)}): es el cuello de botella de la línea.`,
      },
    ],
  };
}

export const seriesQueue: Calculator<SeriesQueueInput, SeriesQueueValue, SeriesQueueErrorCode> = {
  meta: {
    id: 'colas-en-serie',
    title: 'Colas en serie',
    summary: 'Estaciones de servicio consecutivas con capacidad infinita.',
    citations: [
      {
        sourceId: 'winston-1994',
        locator: 'Sec. 20.10, Ejemplo 13 (ensamblaje de autos, 4.ª ed.)',
      },
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 17.9, colas infinitas en serie (7.ª ed.)',
      },
    ],
  },
  inputSchema: seriesQueueInputSchema,
  // Winston, ejemplo 13: 54 autos/h; un trabajador instala el motor (60 autos/h) y tres ponen
  // los neumáticos (3 min por auto: 20 autos/h cada uno).
  example: {
    lambda: 54,
    stations: [
      { servers: 1, mu: 60 },
      { servers: 3, mu: 20 },
    ],
  },
  solve: solveSeriesQueue,
};
