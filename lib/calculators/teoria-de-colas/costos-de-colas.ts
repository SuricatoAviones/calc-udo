/**
 * Análisis de costos de un sistema M/M/s: número de servidores que minimiza el costo total
 * esperado por unidad de tiempo (Taha, sec. 18.9.1; Anderson, Sweeney y Williams, sec. 11.5):
 *
 *   CT(s) = C_s · s + C_w · L(s)
 *
 * donde C_s es el costo de operar cada servidor y C_w el costo de espera por cliente, ambos por
 * unidad de tiempo, y L(s) el número promedio de clientes en el sistema de un M/M/s. Si solo
 * cuesta la espera en la cola, se usa L_q(s) en lugar de L(s).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type ResultTable,
  type Series,
  type Step,
} from '../types';
import { mmsMeasures, queueRatesShape } from './queueing';

const MAX_SERVERS = 60;

const cost = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`)
    .refine((v) => v >= 0, `${label} no puede ser negativo.`);

export const waitingBases = ['sistema', 'cola'] as const;

export const queueCostInputSchema = z.object({
  ...queueRatesShape,
  serviceCost: cost('el costo por servidor'),
  waitingCost: cost('el costo de espera por cliente'),
  basis: z.enum(waitingBases, { error: 'Elige qué tiempo de espera cuesta.' }),
  maxServers: z
    .number({ error: 'Ingresa el máximo de servidores a evaluar.' })
    .int('El número de servidores debe ser entero.')
    .min(1, 'Evalúa al menos 1 servidor.')
    .max(MAX_SERVERS, `El máximo es ${MAX_SERVERS} servidores.`),
});

export type QueueCostInput = z.infer<typeof queueCostInputSchema>;

export interface QueueCostRow {
  servers: number;
  /** L(s) o L_q(s), según la base elegida. */
  customers: number;
  operatingCost: number;
  waitingCost: number;
  totalCost: number;
}

export interface QueueCostValue {
  rows: QueueCostRow[];
  optimalServers: number;
  optimalCost: number;
  /** Menor número de servidores con estado estable. */
  minimumServers: number;
}

export type QueueCostErrorCode = 'no-stable-option';

type Result = CalculatorResult<QueueCostValue, QueueCostErrorCode>;

const n = toLatexNumber;

export function solveQueueCost(input: QueueCostInput): Result {
  const { lambda, mu, serviceCost, waitingCost, basis, maxServers } = input;
  const symbol = basis === 'sistema' ? 'L' : 'L_q';
  const minimumServers = Math.floor(lambda / mu) + 1;
  const steps: Step[] = [
    {
      title: 'Servidores necesarios para el estado estable',
      explanation:
        'Con s servidores, cada uno está ocupado una fracción ρ = λ/(sμ) del tiempo. Solo hay estado estable si ρ < 1, es decir, si s > λ/μ.',
      formula: 's > \\frac{\\lambda}{\\mu}',
      substitution: `s > \\frac{${n(lambda)}}{${n(mu)}} = ${n(lambda / mu)}`,
      result: `s_{\\min} = ${minimumServers}`,
    },
  ];
  if (minimumServers > maxServers) {
    return {
      ok: false,
      error: {
        code: 'no-stable-option',
        message: `Hacen falta al menos ${minimumServers} servidores para que la cola no crezca sin límite; aumenta el máximo de servidores a evaluar.`,
      },
      ...emptyTrace(),
      steps,
    };
  }

  const rows: QueueCostRow[] = [];
  const evaluations: Step[] = [];
  for (let s = minimumServers; s <= maxServers; s++) {
    const m = mmsMeasures(lambda, mu, s)!;
    const customers = basis === 'sistema' ? m.L : m.Lq;
    const operatingCost = serviceCost * s;
    const waiting = waitingCost * customers;
    const totalCost = operatingCost + waiting;
    rows.push({ servers: s, customers, operatingCost, waitingCost: waiting, totalCost });
    evaluations.push({
      title: `s = ${s}`,
      explanation: `M/M/${s}: ρ = ${formatNumber(m.rho, 6)}, p₀ = ${formatNumber(m.p0, 6)}.`,
      formula: `CT(s) = C_s\\,s + C_w\\,${symbol}(s)`,
      substitution: `CT(${s}) = ${n(serviceCost)}(${s}) + ${n(waitingCost)}(${n(customers, 6)})`,
      result: `CT(${s}) = ${n(totalCost, 8)}`,
    });
  }

  const best = rows.reduce((a, b) => (b.totalCost < a.totalCost - 1e-12 ? b : a));
  steps.push(
    {
      title: 'Medidas del M/M/s para cada número de servidores',
      explanation: `${symbol}(s) sale del modelo M/M/s con λ = ${formatNumber(lambda)} y μ = ${formatNumber(mu)}; cada servidor adicional aumenta el costo de operación y reduce el de espera.`,
      formula:
        basis === 'sistema'
          ? 'L = L_q + \\frac{\\lambda}{\\mu}, \\qquad L_q = \\frac{r^{s+1}}{(s-1)!\\,(s - r)^2}\\,p_0'
          : 'L_q = \\frac{r^{s+1}}{(s-1)!\\,(s - r)^2}\\,p_0',
      children: evaluations,
    },
    {
      title: 'Número óptimo de servidores',
      explanation: 'Se elige el número de servidores con el menor costo total esperado.',
      formula: `CT(s^*) = \\min_s CT(s)`,
      result: `s^* = ${best.servers}, \\qquad CT(s^*) = ${n(best.totalCost, 8)}`,
    },
  );

  const table: ResultTable = {
    id: 'costos',
    title: 'Costo total esperado por número de servidores',
    columns: [
      { key: 'servers', header: 's' },
      { key: 'customers', header: `${symbol}(s)` },
      { key: 'operatingCost', header: 'C_s\\,s' },
      { key: 'waitingCost', header: `C_w\\,${symbol}(s)` },
      { key: 'totalCost', header: 'CT(s)' },
    ],
    rows: rows.map((r) => ({ ...r })),
  };

  const series: Series[] = [
    {
      id: 'costo-total',
      title: 'Costos según el número de servidores',
      xLabel: 'Servidores s',
      yLabel: 'Costo por unidad de tiempo',
      label: 'Costo total',
      points: rows.map((r) => ({ x: r.servers, y: r.totalCost })),
      others: [
        {
          label: 'Costo de servicio',
          points: rows.map((r) => ({ x: r.servers, y: r.operatingCost })),
        },
        { label: 'Costo de espera', points: rows.map((r) => ({ x: r.servers, y: r.waitingCost })) },
      ],
    },
  ];

  const notices: Result['notices'] = [];
  if (best.servers === maxServers && maxServers > minimumServers) {
    notices.push({
      level: 'warning',
      message:
        'El óptimo está en el máximo evaluado: aumenta el máximo de servidores para confirmar que el costo no sigue bajando.',
    });
  }

  return {
    ok: true,
    value: {
      rows,
      optimalServers: best.servers,
      optimalCost: best.totalCost,
      minimumServers,
    },
    summary: [
      { label: 'Número óptimo de servidores', value: `s^* = ${best.servers}`, emphasis: true },
      { label: 'Costo total mínimo', value: `CT(s^*) = ${n(best.totalCost, 8)}` },
      { label: 'Clientes (base del costo)', value: `${symbol}(s^*) = ${n(best.customers, 6)}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [table],
    series,
    notices,
  };
}

export const queueCost: Calculator<QueueCostInput, QueueCostValue, QueueCostErrorCode> = {
  meta: {
    id: 'costos-de-colas',
    title: 'Análisis de costos',
    summary: 'Número de servidores que minimiza el costo total esperado.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 18.9.1, Ejemplo 18.9-2 (10.ª ed.)' },
      {
        sourceId: 'anderson-1993',
        locator: 'Sec. 11.5, análisis económico de Burger Dome (13.ª ed.)',
      },
      { sourceId: 'hillier-lieberman-2002', locator: 'Cap. 18, modelos de decisión de colas' },
    ],
  },
  inputSchema: queueCostInputSchema,
  // Taha, ejemplo 18.9-2: pañol de herramientas con λ = 17.5 solicitudes/h, μ = 10 por
  // empleado, $12/h por empleado y $50/h por máquina que espera.
  example: {
    lambda: 17.5,
    mu: 10,
    serviceCost: 12,
    waitingCost: 50,
    basis: 'sistema',
    maxServers: 6,
  },
  solve: solveQueueCost,
};
