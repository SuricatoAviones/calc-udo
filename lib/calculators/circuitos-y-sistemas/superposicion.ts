/**
 * Calculadora de superposición para Circuitos y Sistemas.
 *
 * Fuente: Hayt, Kemmerly & Durbin, *Análisis de Circuitos en Ingeniería*, 7.ª ed., cap. 4.
 */
import { z } from 'zod';
import { formatNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, SummaryItem } from '../types';
import { circuitDocumentSchema } from './circuit';
import {
  solveSuperposition,
  type SuperpositionErrorCode,
  type SuperpositionResult,
} from './superposition';

export const superpositionInputSchema = z.object({ circuit: circuitDocumentSchema });

export type SuperpositionInput = z.infer<typeof superpositionInputSchema>;
export type SuperpositionValue = SuperpositionResult;

export function solveSuperpositionAnalysis(
  input: SuperpositionInput,
): CalculatorResult<SuperpositionValue, SuperpositionErrorCode> {
  const outcome = solveSuperposition(input.circuit);
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

  const summary: SummaryItem[] = outcome.result.total.map((b) => ({
    label: b.label,
    value: `${formatNumber(b.i, 4)}\\text{ A}`,
  }));
  summary.unshift({ label: 'Fuentes', value: String(outcome.result.contributions.length) });

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

export const superposicion: Calculator<
  SuperpositionInput,
  SuperpositionValue,
  SuperpositionErrorCode
> = {
  meta: {
    id: 'superposicion',
    title: 'Teorema de superposición',
    summary:
      'Resuelve un circuito lineal sumando las respuestas debidas a cada fuente independiente por separado.',
    citations: [{ sourceId: 'hayt-kemmerly-1993', locator: 'Capítulo 4' }],
  },
  inputSchema: superpositionInputSchema,
  example: {
    circuit: {
      // Dos fuentes: V1 = 10 V (izquierda) y V2 = 5 V (derecha) sobre una red en T.
      components: [
        {
          id: 'v1',
          kind: 'voltage-source',
          a: { x: 0, y: 0 },
          b: { x: 0, y: 4 },
          value: 10,
          label: 'V1',
        },
        { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, value: 2, label: 'R1' },
        { id: 'r3', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, value: 6, label: 'R3' },
        { id: 'r2', kind: 'resistor', a: { x: 8, y: 0 }, b: { x: 4, y: 0 }, value: 3, label: 'R2' },
        {
          id: 'v2',
          kind: 'voltage-source',
          a: { x: 8, y: 0 },
          b: { x: 8, y: 4 },
          value: 5,
          label: 'V2',
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
        {
          id: 'w2',
          points: [
            { x: 4, y: 4 },
            { x: 8, y: 4 },
          ],
        },
      ],
      ground: { x: 4, y: 4 },
    },
  },
  solve: solveSuperpositionAnalysis,
};
