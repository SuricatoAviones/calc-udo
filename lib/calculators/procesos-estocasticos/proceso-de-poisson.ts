/**
 * Proceso de Poisson con tasa λ (Taha, sec. 18.4.1, «modelo de nacimiento puro»; Hillier &
 * Lieberman, sec. 17.4): el número de eventos N(t) en un intervalo de longitud t tiene
 * distribución de Poisson con media λt, y el tiempo entre eventos es exponencial con media 1/λ.
 *
 *   P{N(t) = n} = (λt)ⁿ e^{−λt} / n!,    P{T ≤ a} = 1 − e^{−λa},    P{T > a} = e^{−λa}
 *
 * Incrementos independientes: si en los primeros s ocurrieron m eventos, la probabilidad de
 * completar n eventos en t es la de n − m eventos en t − s.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { lnGamma } from '@/lib/math/special';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
} from '../types';

export const countQueries = ['igual', 'a-lo-sumo', 'al-menos'] as const;
export type CountQuery = (typeof countQueries)[number];

const positive = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine((v) => Number.isFinite(v) && v > 0, `${label} debe ser mayor que 0.`);

const count = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .int(`${label} debe ser un número entero.`)
    .min(0, `${label} no puede ser negativo.`)
    .max(100000, `${label} es demasiado grande.`);

export const poissonProcessInputSchema = z
  .object({
    lambda: positive('la tasa λ'),
    t: positive('la longitud del intervalo t'),
    n: count('el número de eventos n'),
    query: z.enum(countQueries, { error: 'Elige qué probabilidad calcular.' }),
    observedTime: positive('el tiempo ya transcurrido s').optional(),
    observedCount: count('el número de eventos ya observados m').optional(),
    waitingTime: positive('el tiempo a').optional(),
  })
  .superRefine((v, ctx) => {
    const hasTime = v.observedTime !== undefined;
    const hasCount = v.observedCount !== undefined;
    if (hasTime !== hasCount) {
      ctx.addIssue({
        code: 'custom',
        path: [hasTime ? 'observedCount' : 'observedTime'],
        message: 'Para usar lo ya observado indica el tiempo s y los eventos m.',
      });
      return;
    }
    if (hasTime && v.observedTime! >= v.t) {
      ctx.addIssue({
        code: 'custom',
        path: ['observedTime'],
        message: 'El tiempo ya transcurrido s debe ser menor que t.',
      });
    }
  });

export type PoissonProcessInput = z.infer<typeof poissonProcessInputSchema>;

export interface PoissonProcessValue {
  /** Media λ(t − s) del conteo que se calcula. */
  mean: number;
  /** Eventos que faltan: n − m (o n si no hay observación). */
  remaining: number;
  probability: number;
  /** P{N = k} para la tabla. */
  pmf: number[];
  interarrival: { a: number; atMost: number; beyond: number } | null;
}

export type PoissonProcessErrorCode = never;

type Result = CalculatorResult<PoissonProcessValue, PoissonProcessErrorCode>;

const n = toLatexNumber;

function poissonPmf(k: number, mean: number): number {
  if (k < 0) return 0;
  return Math.exp(k * Math.log(mean) - mean - lnGamma(k + 1));
}

const QUERY_LATEX: Record<CountQuery, string> = {
  igual: '=',
  'a-lo-sumo': '\\le',
  'al-menos': '\\ge',
};

export function solvePoissonProcess(input: PoissonProcessInput): Result {
  const { lambda, t, n: target, query, observedTime, observedCount, waitingTime } = input;
  const conditional = observedTime !== undefined && observedCount !== undefined;
  const length = conditional ? t - observedTime : t;
  const remaining = conditional ? target - observedCount : target;
  const mean = lambda * length;
  const steps: Step[] = [];

  if (conditional) {
    steps.push({
      title: 'Usar los incrementos independientes',
      explanation: `Lo que ocurre después de s = ${formatNumber(observedTime)} no depende de lo que ya ocurrió: tener ${target} eventos en t = ${formatNumber(t)} sabiendo que hubo ${observedCount} en los primeros ${formatNumber(observedTime)} equivale a tener ${target} − ${observedCount} eventos en un intervalo de longitud t − s.`,
      formula: 'P\\{N(t) = n \\mid N(s) = m\\} = P\\{N(t - s) = n - m\\}',
      substitution: `P\\{N(${n(t)}) = ${target} \\mid N(${n(observedTime)}) = ${observedCount}\\} = P\\{N(${n(length)}) = ${remaining}\\}`,
    });
  }

  steps.push({
    title: 'Número esperado de eventos',
    explanation: 'En un intervalo de longitud t el número de eventos es Poisson con media λt.',
    formula: 'E[N(t)] = \\lambda t',
    substitution: `E[N(${n(length)})] = ${n(lambda)}(${n(length)})`,
    result: `\\lambda t = ${n(mean)}`,
  });

  const maxK = Math.max(
    remaining,
    Math.min(Math.ceil(mean + 6 * Math.sqrt(mean) + 10), Math.max(remaining, 0) + 2000),
  );
  const pmf = Array.from({ length: Math.max(maxK, 0) + 1 }, (_, k) => poissonPmf(k, mean));
  const cdfAt = (k: number) =>
    k < 0
      ? 0
      : Math.min(
          1,
          pmf.slice(0, k + 1).reduce((a, b) => a + b, 0),
        );

  let probability: number;
  const r = remaining;
  const symbol = QUERY_LATEX[query];
  const term = (k: number) => `\\frac{(${n(mean)})^{${k}} e^{-${n(mean)}}}{${k}!}`;
  if (query === 'igual') {
    probability = poissonPmf(r, mean);
    steps.push({
      title: 'Probabilidad de exactamente n eventos',
      formula: 'P\\{N(t) = n\\} = \\frac{(\\lambda t)^n e^{-\\lambda t}}{n!}',
      substitution: r < 0 ? `n - m = ${r} < 0` : `P\\{N = ${r}\\} = ${term(r)}`,
      result: `P\\{N = ${r}\\} = ${n(probability)}`,
    });
  } else if (query === 'a-lo-sumo') {
    probability = cdfAt(r);
    steps.push({
      title: 'Probabilidad de a lo sumo n eventos',
      explanation: 'Se suman las probabilidades de 0, 1, …, n eventos.',
      formula: 'P\\{N(t) \\le n\\} = \\sum_{k=0}^{n} \\frac{(\\lambda t)^k e^{-\\lambda t}}{k!}',
      substitution:
        r < 0
          ? `n - m = ${r} < 0`
          : `P\\{N \\le ${r}\\} = ${Array.from({ length: Math.min(r, 3) + 1 }, (_, k) => term(k)).join(' + ')}${r > 3 ? ' + \\cdots' : ''}`,
      result: `P\\{N \\le ${r}\\} = ${n(probability)}`,
    });
  } else {
    probability = r <= 0 ? 1 : Math.max(0, 1 - cdfAt(r - 1));
    steps.push({
      title: 'Probabilidad de al menos n eventos',
      explanation: 'Es el complemento de tener a lo sumo n − 1 eventos.',
      formula:
        'P\\{N(t) \\ge n\\} = 1 - \\sum_{k=0}^{n-1} \\frac{(\\lambda t)^k e^{-\\lambda t}}{k!}',
      substitution: r <= 0 ? `n - m = ${r} \\le 0` : `P\\{N \\ge ${r}\\} = 1 - ${n(cdfAt(r - 1))}`,
      result: `P\\{N \\ge ${r}\\} = ${n(probability)}`,
    });
  }

  let interarrival: PoissonProcessValue['interarrival'] = null;
  if (waitingTime !== undefined) {
    const atMost = 1 - Math.exp(-lambda * waitingTime);
    interarrival = { a: waitingTime, atMost, beyond: 1 - atMost };
    steps.push({
      title: 'Tiempo entre eventos',
      explanation:
        'El tiempo entre dos eventos consecutivos (o hasta el primero) es exponencial con media 1/λ. «Ningún evento en un intervalo de longitud a» equivale a «el tiempo hasta el siguiente evento es mayor que a».',
      formula:
        'P\\{T \\le a\\} = 1 - e^{-\\lambda a}, \\qquad P\\{T > a\\} = e^{-\\lambda a} = P\\{N(a) = 0\\}',
      substitution: `P\\{T \\le ${n(waitingTime)}\\} = 1 - e^{-${n(lambda)}(${n(waitingTime)})}`,
      result: `P\\{T \\le ${n(waitingTime)}\\} = ${n(atMost)}, \\qquad P\\{T > ${n(waitingTime)}\\} = ${n(interarrival.beyond)}`,
    });
  }

  steps.push({
    title: 'Tiempo promedio entre eventos',
    formula: 'E[T] = \\frac{1}{\\lambda}',
    substitution: `E[T] = \\frac{1}{${n(lambda)}}`,
    result: `E[T] = ${n(1 / lambda)}`,
  });

  const shown = pmf.slice(0, Math.min(pmf.length, 200));
  let cumulative = 0;
  const rows = shown.map((p, k) => {
    cumulative += p;
    return { k, p, cumulative: Math.min(1, cumulative) };
  });
  const series: Series[] = [
    {
      id: 'conteo',
      title: `Distribución del número de eventos en un intervalo de longitud ${formatNumber(length)}`,
      xLabel: 'k',
      yLabel: 'P{N = k}',
      kind: 'bar',
      points: shown.map((p, k) => ({ x: k, y: p })),
      highlight:
        r < 0
          ? undefined
          : query === 'igual'
            ? { from: r, to: r }
            : query === 'a-lo-sumo'
              ? { from: 0, to: r }
              : { from: r, to: shown.length - 1 },
    },
  ];

  const summary = [
    {
      label: conditional ? 'Probabilidad condicional' : 'Probabilidad',
      value: `P\\{N ${symbol} ${r}\\} = ${n(probability, 6)}`,
      emphasis: true,
    },
    { label: 'Media del conteo', value: `\\lambda t = ${n(mean, 6)}` },
    { label: 'Tiempo promedio entre eventos', value: `1/\\lambda = ${n(1 / lambda, 6)}` },
  ];
  if (interarrival) {
    summary.push({
      label: 'Tiempo entre eventos',
      value: `P\\{T \\le ${n(interarrival.a)}\\} = ${n(interarrival.atMost, 6)}`,
    });
  }

  return {
    ok: true,
    value: { mean, remaining: r, probability, pmf, interarrival },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'distribucion',
        title: 'Probabilidades del conteo',
        columns: [
          { key: 'k', header: 'k' },
          { key: 'p', header: 'P\\{N = k\\}' },
          { key: 'cumulative', header: 'P\\{N \\le k\\}' },
        ],
        rows,
      },
    ],
    series,
    notices:
      pmf.length > shown.length
        ? [
            {
              level: 'info',
              message: `La tabla muestra k = 0 a ${shown.length - 1}.`,
            },
          ]
        : [],
  };
}

export const poissonProcess: Calculator<
  PoissonProcessInput,
  PoissonProcessValue,
  PoissonProcessErrorCode
> = {
  meta: {
    id: 'proceso-de-poisson',
    title: 'Proceso de Poisson',
    summary: 'Probabilidades de conteo, incrementos independientes y tiempos entre llegadas.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 18.4.1, modelo de nacimiento puro, Ejemplo 18.4-1 (10.ª ed.)',
      },
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 17.4, papel de la distribución exponencial (7.ª ed.)',
      },
      { sourceId: 'wong-2007' },
    ],
  },
  inputSchema: poissonProcessInputSchema,
  // Taha, ejemplo 18.4-1(c): un nacimiento cada 12 minutos (λ = 5 por hora); probabilidad de
  // expedir 50 actas en 3 horas si en las 2 primeras se expidieron 40.
  example: {
    lambda: 5,
    t: 3,
    n: 50,
    query: 'igual',
    observedTime: 2,
    observedCount: 40,
    waitingTime: 0.3,
  },
  solve: solvePoissonProcess,
};
