/**
 * Modelo de pérdida de Erlang — M/G/s/s («clientes bloqueados se pierden»): s servidores sin
 * sala de espera. Quien llega con todos los servidores ocupados se va. Con r = λ/μ:
 *
 *   p_j = (r^j / j!) / Σ_{i=0}^{s} r^i / i!,   j = 0, 1, …, s
 *   p_s = B(s, r)  (fórmula B de Erlang: fracción de clientes bloqueados)
 *   L = r (1 − p_s)  (servidores ocupados en promedio),   λ_ef = λ (1 − p_s)
 *
 * El resultado no depende de la distribución del tiempo de servicio, solo de su media 1/μ.
 * Para buscar el número de servidores se usa la recursión B(k) = r·B(k−1) / (k + r·B(k−1)).
 *
 * Anderson, Sweeney y Williams, sec. 11.8 (ejemplo de Microdata, 13.ª ed.); Winston, sec. 20.11.
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
import { queueRatesShape } from './queueing';

const MAX_SERVERS = 150;

export const erlangLossInputSchema = z.object({
  ...queueRatesShape,
  servers: z
    .number({ error: 'Ingresa el número de servidores s.' })
    .int('El número de servidores debe ser entero.')
    .min(1, 'Debe haber al menos 1 servidor.')
    .max(MAX_SERVERS, `El máximo es ${MAX_SERVERS} servidores.`),
  maxBlocking: z
    .number({ error: 'La meta de bloqueo debe ser un número.' })
    .refine((v) => v > 0 && v < 1, 'La meta de bloqueo debe estar entre 0 y 1 (p. ej. 0.10).')
    .optional(),
});

export type ErlangLossInput = z.infer<typeof erlangLossInputSchema>;

export interface ErlangLossValue {
  /** p_j, j = 0 … s. */
  probabilities: number[];
  blocking: number;
  /** Servidores ocupados en promedio (= clientes en el sistema). */
  L: number;
  lambdaEff: number;
  lost: number;
  /** Menor número de servidores que cumple la meta de bloqueo, si se dio una. */
  requiredServers: number | null;
}

export type ErlangLossErrorCode = 'target-unreachable';

type Result = CalculatorResult<ErlangLossValue, ErlangLossErrorCode>;

const n = toLatexNumber;

/** B(k, r) para k = 0 … kMax con la recursión de Erlang (estable para k grande). */
function erlangB(r: number, kMax: number): number[] {
  const values = [1];
  for (let k = 1; k <= kMax; k++) {
    const previous = values[k - 1]!;
    values.push((r * previous) / (k + r * previous));
  }
  return values;
}

export function solveErlangLoss({ lambda, mu, servers: s, maxBlocking }: ErlangLossInput): Result {
  const r = lambda / mu;
  // Términos r^j/j! normalizados de forma estable: t_j = t_{j−1} · r / j.
  const terms = [1];
  for (let j = 1; j <= s; j++) terms.push((terms[j - 1]! * r) / j);
  const total = terms.reduce((sum, t) => sum + t, 0);
  const probabilities = terms.map((t) => t / total);
  const blocking = probabilities[s]!;
  const L = r * (1 - blocking);
  const lambdaEff = lambda * (1 - blocking);
  const lost = lambda * blocking;

  const shownTerms =
    s <= 4
      ? terms.map((_, j) => `\\frac{(${n(r)})^{${j}}}{${j}!}`).join(' + ')
      : `${terms
          .slice(0, 3)
          .map((_, j) => `\\frac{(${n(r)})^{${j}}}{${j}!}`)
          .join(' + ')} + \\cdots + \\frac{(${n(r)})^{${s}}}{${s}!}`;

  const steps: Step[] = [
    {
      title: 'Carga ofrecida',
      explanation:
        'Es el número promedio de servidores que estarían ocupados si nadie se perdiera. No hace falta que sea menor que s: los clientes que no encuentran servidor se van.',
      formula: 'r = \\frac{\\lambda}{\\mu}',
      substitution: `r = \\frac{${n(lambda)}}{${n(mu)}}`,
      result: `r = ${n(r)}`,
    },
    {
      title: 'Suma de los términos de cada estado',
      formula: '\\sum_{i=0}^{s} \\frac{r^i}{i!}',
      substitution: shownTerms,
      result: `\\sum_{i=0}^{${s}} \\frac{r^i}{i!} = ${n(total, 8)}`,
    },
    {
      title: 'Probabilidad de bloqueo (fórmula B de Erlang)',
      explanation: `Es la probabilidad de que los ${s} servidores estén ocupados: la fracción de clientes que llega y se pierde.`,
      formula: 'p_s = \\frac{r^s / s!}{\\sum_{i=0}^{s} r^i / i!}',
      substitution: `p_{${s}} = \\frac{(${n(r)})^{${s}} / ${s}!}{${n(total, 8)}}`,
      result: `p_{${s}} = ${n(blocking)}`,
    },
    {
      title: 'Servidores ocupados en promedio',
      explanation:
        'Sin cola, el número de clientes en el sistema es el número de servidores ocupados.',
      formula: 'L = \\frac{\\lambda}{\\mu}\\,(1 - p_s)',
      substitution: `L = ${n(r)}\\,(1 - ${n(blocking)})`,
      result: `L = ${n(L)}`,
    },
    {
      title: 'Clientes atendidos y perdidos por unidad de tiempo',
      formula: '\\lambda_{ef} = \\lambda\\,(1 - p_s), \\qquad \\lambda\\,p_s',
      substitution: `\\lambda_{ef} = ${n(lambda)}\\,(1 - ${n(blocking)}), \\qquad ${n(lambda)}\\,(${n(blocking)})`,
      result: `\\lambda_{ef} = ${n(lambdaEff)}, \\qquad \\lambda\\,p_s = ${n(lost)}`,
    },
  ];

  // Tabla de bloqueo según el número de servidores (hasta cumplir la meta o hasta s).
  let kMax = s;
  if (maxBlocking !== undefined) {
    const search = erlangB(r, MAX_SERVERS);
    const found = search.findIndex((b, k) => k >= 1 && b <= maxBlocking);
    if (found === -1) {
      return {
        ok: false,
        error: {
          code: 'target-unreachable',
          message: `Ni con ${MAX_SERVERS} servidores el bloqueo baja de ${formatNumber(maxBlocking)}.`,
        },
        ...emptyTrace(),
        steps,
      };
    }
    kMax = Math.max(s, found);
  }
  const blockingBy = erlangB(r, kMax);
  const requiredServers =
    maxBlocking === undefined ? null : blockingBy.findIndex((b, k) => k >= 1 && b <= maxBlocking);

  if (requiredServers !== null) {
    steps.push({
      title: 'Número de servidores para la meta de bloqueo',
      explanation: `Se busca el menor k con B(k) ≤ ${formatNumber(maxBlocking!)}. B(k) se calcula con la recursión de Erlang, sin factoriales grandes.`,
      formula: 'B(0) = 1, \\qquad B(k) = \\frac{r\\,B(k-1)}{k + r\\,B(k-1)}',
      substitution: blockingBy
        .slice(1)
        .map((b, i) => `B(${i + 1}) = ${n(b, 6)}`)
        .slice(0, 8)
        .join(',\\ '),
      result: `k = ${requiredServers} \\ \\text{servidores} \\ (B = ${n(blockingBy[requiredServers]!, 6)})`,
    });
  }

  const tables: ResultTable[] = [
    {
      id: 'probabilidades',
      title: `Probabilidad de j servidores ocupados (s = ${s})`,
      columns: [
        { key: 'j', header: 'j' },
        { key: 'p', header: 'p_j' },
        { key: 'cumulative', header: 'P(N \\le j)' },
      ],
      rows: (() => {
        let cumulative = 0;
        return probabilities.map((p, j) => {
          cumulative += p;
          return { j, p, cumulative };
        });
      })(),
    },
    {
      id: 'bloqueo',
      title: 'Probabilidad de bloqueo según el número de servidores',
      columns: [
        { key: 'k', header: 'k' },
        { key: 'blocking', header: 'B(k)' },
        { key: 'served', header: '1 - B(k)' },
        { key: 'lost', header: '\\lambda\\,B(k)' },
      ],
      rows: blockingBy.slice(1).map((b, i) => ({
        k: i + 1,
        blocking: b,
        served: 1 - b,
        lost: lambda * b,
      })),
    },
  ];

  const series: Series[] = [
    {
      id: 'pj',
      title: 'Probabilidad de j servidores ocupados',
      xLabel: 'j',
      yLabel: 'pⱼ',
      kind: 'bar',
      points: probabilities.map((p, j) => ({ x: j, y: p })),
    },
  ];

  const summary = [
    { label: 'Probabilidad de bloqueo', value: `p_{${s}} = ${n(blocking, 6)}`, emphasis: true },
    { label: 'Servidores ocupados en promedio', value: `L = ${n(L, 6)}` },
    { label: 'Clientes atendidos', value: `\\lambda_{ef} = ${n(lambdaEff, 6)}` },
    { label: 'Clientes perdidos', value: `\\lambda\\,p_{${s}} = ${n(lost, 6)}` },
  ];
  if (requiredServers !== null) {
    summary.push({
      label: 'Servidores para la meta',
      value: `k = ${requiredServers}`,
    });
  }

  return {
    ok: true,
    value: { probabilities, blocking, L, lambdaEff, lost, requiredServers },
    summary,
    ...emptyTrace(),
    steps,
    tables,
    series,
    notices: [
      {
        level: 'info',
        message: `El ${formatNumber(blocking * 100, 4)} % de los clientes encuentra todo ocupado y se pierde; en este modelo no hay cola, así que L_q = W_q = 0.`,
      },
    ],
  };
}

export const erlangLoss: Calculator<ErlangLossInput, ErlangLossValue, ErlangLossErrorCode> = {
  meta: {
    id: 'perdida-de-erlang',
    title: 'Modelo de pérdida de Erlang',
    summary: 'Probabilidad de bloqueo cuando no hay espacio de espera.',
    citations: [
      {
        sourceId: 'anderson-1993',
        locator: 'Sec. 11.8, ejemplo de Microdata Software (13.ª ed.)',
      },
      { sourceId: 'winston-1994', locator: 'Sec. 20.11, sistema M/G/s/GD/s/∞ (4.ª ed.)' },
      { sourceId: 'hillier-lieberman-2002' },
    ],
  },
  inputSchema: erlangLossInputSchema,
  // Anderson, Microdata: λ = 12 llamadas/h, μ = 6 por representante; con 4 líneas se atiende al
  // menos el 90 % de las llamadas.
  example: { lambda: 12, mu: 6, servers: 4, maxBlocking: 0.1 },
  solve: solveErlangLoss,
};
