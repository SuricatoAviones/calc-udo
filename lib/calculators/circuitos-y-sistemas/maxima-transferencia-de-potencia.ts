/**
 * Calculadora de máxima transferencia de potencia para Circuitos y Sistemas.
 *
 * A partir del equivalente de Thévenin visto por una resistencia de carga, la potencia entregada a
 * la carga es P_L = V_th² R_L / (R_th + R_L)². Se maximiza con R_L = R_th y vale
 * P_máx = V_th² / (4 R_th).
 *
 * Fuente: Hayt, Kemmerly & Durbin, *Análisis de Circuitos en Ingeniería*, 7.ª ed., cap. 4.
 */
import { z } from 'zod';
import { formatNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, Series, Step, SummaryItem } from '../types';
import { circuitDocumentSchema } from './circuit';
import { computeThevenin, type TheveninErrorCode, type TheveninResult } from './thevenin';

export const maxPowerInputSchema = z.object({
  circuit: circuitDocumentSchema,
  load: z.string().min(1, 'Elige la resistencia de carga.'),
});

export type MaxPowerInput = z.infer<typeof maxPowerInputSchema>;
export type MaxPowerValue = TheveninResult;
export type MaxPowerErrorCode = TheveninErrorCode | 'degenerado';

export function solveMaxPower(
  input: MaxPowerInput,
): CalculatorResult<MaxPowerValue, MaxPowerErrorCode> {
  const outcome = computeThevenin(input.circuit, input.load);
  if (!outcome.ok) {
    return {
      ok: false,
      error: { code: outcome.code, message: outcome.message },
      steps: [],
      tables: [],
      series: [],
      notices: [{ level: 'error', message: outcome.message }],
    };
  }

  const { vTh, rTh, loadValue, loadPower, pMax } = outcome.result;
  if (!Number.isFinite(rTh) || rTh <= 1e-12) {
    return {
      ok: false,
      error: {
        code: 'degenerado',
        message:
          rTh <= 1e-12 && Number.isFinite(rTh)
            ? 'R_th es 0 Ω (fuente ideal): la potencia tiende a infinito y no hay un máximo finito.'
            : 'No hay camino resistivo entre los terminales (R_th infinita): la potencia máxima es 0 W.',
      },
      steps: [],
      tables: [],
      series: [],
      notices: [],
    };
  }

  const powerAt = (r: number) => (vTh * vTh * r) / ((rTh + r) * (rTh + r));
  const maxR = Math.max(4 * rTh, 1.5 * loadValue, 1e-6);
  const points = Array.from({ length: 201 }, (_, i) => {
    const r = (maxR * i) / 200;
    return { x: r, y: powerAt(r) };
  });
  const series: Series = {
    id: 'potencia',
    title: 'Potencia entregada a la carga según R_L',
    xLabel: 'R_L (Ω)',
    yLabel: 'P_L (W)',
    points,
    kind: 'line',
    label: 'P_L(R_L)',
    scatter: {
      label: 'óptimo y carga actual',
      points: [
        { x: rTh, y: pMax },
        { x: loadValue, y: loadPower },
      ],
    },
  };

  const pMaxValue = Number.isFinite(pMax) ? pMax : 0;
  const summary: SummaryItem[] = [
    { label: 'R_L óptima', value: `${formatNumber(rTh, 4)}\\ \\Omega`, emphasis: true },
    { label: 'P_máx', value: `${formatNumber(pMaxValue, 4)}\\text{ W}` },
    { label: 'R_L actual', value: `${formatNumber(loadValue, 4)}\\ \\Omega` },
    { label: 'P_L actual', value: `${formatNumber(loadPower, 4)}\\text{ W}` },
  ];

  const transferSteps: Step[] = [
    ...outcome.steps,
    {
      title: 'Potencia en función de la carga',
      explanation:
        'Con el equivalente de Thévenin, la potencia que recibe una carga R_L es el producto de su tensión por su corriente.',
      formula: 'P_L = i_L^2 R_L = \\frac{V_{th}^2\\, R_L}{(R_{th} + R_L)^2}',
    },
    {
      title: 'Condición de máximo',
      explanation:
        'Se deriva P_L respecto de R_L y se iguala a cero. El máximo ocurre cuando la carga ve la misma resistencia que el equivalente: R_L = R_th.',
      formula: '\\frac{dP_L}{dR_L} = 0 \\;\\Rightarrow\\; R_L = R_{th}',
      substitution: `R_L = ${formatNumber(rTh, 6)}\\ \\Omega`,
    },
    {
      title: 'Potencia máxima',
      explanation:
        'Al sustituir R_L = R_th, queda la mitad de la tensión de Thévenin sobre la carga.',
      formula: 'P_{máx} = \\frac{V_{th}^2}{4\\,R_{th}}',
      substitution: `P_{máx} = \\frac{${formatNumber(vTh, 6)}^2}{4\\,(${formatNumber(rTh, 6)})}`,
      result: `P_{máx} = ${formatNumber(pMaxValue, 6)}\\text{ W}`,
    },
    {
      title: 'Comparación con la carga actual',
      explanation: `La carga actual es de ${formatNumber(loadValue, 6)} Ω. Solo recibe la potencia máxima si su valor coincide con R_th.`,
      result: `P_L = ${formatNumber(loadPower, 6)}\\text{ W} \\quad (${((loadPower / pMaxValue) * 100).toFixed(1)}\\,\\%\\ \\text{de } P_{máx})`,
    },
  ];

  return {
    ok: true,
    value: outcome.result,
    summary,
    steps: transferSteps,
    tables: [
      ...outcome.tables,
      {
        id: 'maxima',
        title: 'Máxima transferencia de potencia',
        columns: [
          { key: 'magnitud', header: 'Magnitud' },
          { key: 'valor', header: 'Valor' },
        ],
        rows: [
          { magnitud: 'R_L óptima', valor: `${formatNumber(rTh, 6)} Ω` },
          { magnitud: 'P_máx', valor: `${formatNumber(pMaxValue, 6)} W` },
          { magnitud: 'R_L actual', valor: `${formatNumber(loadValue, 6)} Ω` },
          { magnitud: 'P_L actual', valor: `${formatNumber(loadPower, 6)} W` },
        ],
      },
    ],
    series: [series],
    notices: [
      ...outcome.notices,
      {
        level: 'info',
        message:
          'La máxima transferencia de potencia no implica máxima eficiencia: con R_L = R_th la mitad de la potencia se pierde en R_th.',
      },
    ],
  };
}

export const maximaTransferenciaDePotencia: Calculator<
  MaxPowerInput,
  MaxPowerValue,
  MaxPowerErrorCode
> = {
  meta: {
    id: 'maxima-transferencia-de-potencia',
    title: 'Máxima transferencia de potencia',
    summary:
      'Encuentra la resistencia de carga que recibe la mayor potencia y calcula esa potencia máxima.',
    citations: [{ sourceId: 'hayt-kemmerly-1993', locator: 'Capítulo 4' }],
  },
  inputSchema: maxPowerInputSchema,
  example: {
    circuit: {
      components: [
        {
          id: 'v1',
          kind: 'voltage-source',
          a: { x: 0, y: 0 },
          b: { x: 0, y: 4 },
          value: 10,
          label: 'V1',
        },
        { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, value: 5, label: 'R1' },
        {
          id: 'r2',
          kind: 'resistor',
          a: { x: 4, y: 0 },
          b: { x: 4, y: 4 },
          value: 10,
          label: 'R2',
        },
      ],
      wires: [
        {
          id: 'w1',
          points: [
            { x: 0, y: 4 },
            { x: 4, y: 4 },
          ],
        },
      ],
      ground: { x: 0, y: 4 },
    },
    load: 'r2',
  },
  solve: solveMaxPower,
};
