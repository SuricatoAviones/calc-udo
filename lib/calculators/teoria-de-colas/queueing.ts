/**
 * Piezas comunes de los modelos de colas de Poisson (Taha, sec. 17.6; Hillier & Lieberman,
 * cap. de teoría de colas): entradas λ y μ, las medidas de desempeño y su presentación.
 *
 * Notación: L y L_q (clientes en el sistema y en la cola), W y W_q (tiempo en el sistema y en
 * la cola), p_n (probabilidad de n clientes en el sistema). Taha escribe L_s y W_s para L y W.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type CalculatorResult,
  type Series,
  type Step,
  type SummaryItem,
} from '../types';

export const rateField = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`)
    .refine((v) => v > 0, `${label} debe ser mayor que 0.`);

export const queueRatesShape = {
  lambda: rateField('la tasa de llegadas λ'),
  mu: rateField('la tasa de servicio μ'),
};

export interface QueueValue {
  /** Factor de utilización de los servidores. */
  rho: number;
  p0: number;
  L: number;
  Lq: number;
  W: number;
  Wq: number;
  /** Tasa efectiva de llegadas (igual a λ salvo con capacidad limitada). */
  lambdaEff: number;
  /** p_n para n = 0, 1, 2, … (hasta la capacidad o hasta acumular ≈ 1). */
  probabilities: number[];
}

export type QueueErrorCode = 'unstable';
export type QueueResult = CalculatorResult<QueueValue, QueueErrorCode>;

const n = toLatexNumber;

/** Cuántos p_n mostrar cuando la capacidad es infinita. */
const MAX_ROWS = 100;
const CUMULATIVE_TARGET = 0.999;

/** Toma p_n de una función hasta acumular ≈ 1 (capacidad infinita). */
export function probabilitiesUntilCovered(pn: (k: number) => number): number[] {
  const out: number[] = [];
  let cumulative = 0;
  for (let k = 0; k < MAX_ROWS && cumulative < CUMULATIVE_TARGET; k++) {
    const p = pn(k);
    out.push(p);
    cumulative += p;
  }
  return out;
}

/** Pasos de las medidas derivadas por la ley de Little, comunes a todos los modelos. */
export function littleSteps(value: QueueValue, lambdaSymbol: string): Step[] {
  return [
    {
      title: 'Tiempo promedio en el sistema (ley de Little)',
      formula: `W = \\frac{L}{${lambdaSymbol}}`,
      substitution: `W = \\frac{${n(value.L)}}{${n(value.lambdaEff)}}`,
      result: `W = ${n(value.W)}`,
    },
    {
      title: 'Tiempo promedio en la cola (ley de Little)',
      formula: `W_q = \\frac{L_q}{${lambdaSymbol}}`,
      substitution: `W_q = \\frac{${n(value.Lq)}}{${n(value.lambdaEff)}}`,
      result: `W_q = ${n(value.Wq)}`,
    },
  ];
}

export function queueSummary(value: QueueValue, extra: SummaryItem[] = []): SummaryItem[] {
  return [
    { label: 'Clientes en el sistema', value: `L = ${n(value.L, 6)}`, emphasis: true },
    { label: 'Clientes en la cola', value: `L_q = ${n(value.Lq, 6)}` },
    { label: 'Tiempo en el sistema', value: `W = ${n(value.W, 6)}` },
    { label: 'Tiempo en la cola', value: `W_q = ${n(value.Wq, 6)}` },
    { label: 'Utilización', value: `\\rho = ${n(value.rho, 6)}` },
    { label: 'Sistema vacío', value: `p_0 = ${n(value.p0, 6)}` },
    ...extra,
  ];
}

/** Tabla y gráfica de p_n, comunes a todos los modelos. */
export function probabilityTrace(
  steps: Step[],
  value: QueueValue,
  notices: QueueResult['notices'] = [],
) {
  const covered = value.probabilities.reduce((sum, p) => sum + p, 0);
  if (covered < CUMULATIVE_TARGET) {
    notices = [
      ...notices,
      {
        level: 'info',
        message: `La tabla muestra n = 0 a ${value.probabilities.length - 1}; la probabilidad de tener más clientes es ${formatNumber(1 - covered, 4)}.`,
      },
    ];
  }
  let cumulative = 0;
  const rows = value.probabilities.map((p, k) => {
    cumulative += p;
    return { n: k, pn: p, cumulative };
  });
  const series: Series[] = [
    {
      id: 'pn',
      title: 'Probabilidad de n clientes en el sistema',
      xLabel: 'n',
      yLabel: 'pₙ',
      kind: 'bar',
      points: rows.map((r) => ({ x: r.n, y: r.pn })),
    },
  ];
  return {
    ...emptyTrace(),
    steps,
    notices,
    tables: [
      {
        id: 'probabilidades',
        title: 'Probabilidades de estado estable',
        columns: [
          { key: 'n', header: 'n' },
          { key: 'pn', header: 'p_n' },
          { key: 'cumulative', header: 'P(N \\le n)' },
        ],
        rows,
      },
    ],
    series,
  };
}

/** Falla por inestabilidad (ρ ≥ 1): la cola crece sin límite. */
export function unstable(steps: Step[], rho: number): QueueResult {
  return {
    ok: false,
    error: {
      code: 'unstable',
      message: `ρ = ${formatNumber(rho, 6)} ≥ 1: llegan clientes al menos tan rápido como se atienden, así que la cola crece sin límite y no hay estado estable. Aumenta μ o el número de servidores, o reduce λ.`,
    },
    ...emptyTrace(),
    steps,
  };
}
