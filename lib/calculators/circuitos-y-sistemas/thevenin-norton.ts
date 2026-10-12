/**
 * Calculadora de equivalentes de Thévenin y Norton para Circuitos y Sistemas.
 *
 * Fuente: Hayt, Kemmerly & Durbin, *Análisis de Circuitos en Ingeniería*, 7.ª ed., cap. 4.
 */
import { z } from 'zod';
import { formatNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, SummaryItem } from '../types';
import { circuitDocumentSchema } from './circuit';
import { computeThevenin, type TheveninErrorCode, type TheveninResult } from './thevenin';

export const theveninInputSchema = z.object({
  circuit: circuitDocumentSchema,
  load: z.string().min(1, 'Elige la resistencia de carga.'),
});

export type TheveninInput = z.infer<typeof theveninInputSchema>;
export type TheveninValue = TheveninResult;

export function solveThevenin(
  input: TheveninInput,
): CalculatorResult<TheveninValue, TheveninErrorCode> {
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

  const { vTh, rTh, iN, pMax } = outcome.result;
  const omega = (v: number) => (Number.isFinite(v) ? `${formatNumber(v, 4)}\\ \\Omega` : '\\infty');
  const summary: SummaryItem[] = [
    { label: 'V_th', value: `${formatNumber(vTh, 4)}\\text{ V}`, emphasis: true },
    { label: 'R_th', value: omega(rTh) },
    { label: 'I_N', value: Number.isFinite(iN) ? `${formatNumber(iN, 4)}\\text{ A}` : '\\infty' },
    { label: 'P_máx', value: Number.isFinite(pMax) ? `${formatNumber(pMax, 4)}\\text{ W}` : '—' },
  ];

  return {
    ok: true,
    value: outcome.result,
    summary,
    steps: outcome.steps,
    tables: outcome.tables,
    series: [],
    notices: outcome.notices,
  };
}

export const theveninNorton: Calculator<TheveninInput, TheveninValue, TheveninErrorCode> = {
  meta: {
    id: 'thevenin-norton',
    title: 'Equivalentes de Thévenin y Norton',
    summary:
      'Reduce un circuito lineal a una fuente y una resistencia vistos desde una carga, con su equivalente de Norton.',
    citations: [{ sourceId: 'hayt-kemmerly-1993', locator: 'Capítulo 4' }],
  },
  inputSchema: theveninInputSchema,
  example: {
    circuit: {
      // Divisor: V1 = 10 V con R1 = 5 Ω y la carga R2 = 10 Ω. V_th = 10 V, R_th = 5 Ω.
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
  solve: solveThevenin,
};
