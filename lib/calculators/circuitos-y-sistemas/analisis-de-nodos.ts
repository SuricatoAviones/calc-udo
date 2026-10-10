/**
 * Análisis de nodos interactivo para Circuitos y Sistemas.
 *
 * El estudiante construye el circuito con el editor gráfico; la calculadora extrae la topología,
 * valida el circuito y resuelve por análisis nodal modificado (MNA) mostrando el procedimiento paso
 * a paso.
 *
 * Fuentes: Hayt, Kemmerly & Durbin, *Análisis de Circuitos en Ingeniería*, 7.ª ed., cap. 4.
 */
import { z } from 'zod';
import { formatNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, SummaryItem } from '../types';
import { circuitDocumentSchema, buildTopology, validateTopology } from './circuit';
import type { MnaErrorCode } from './mna';
import { solveMna, type MnaResult } from './mna';

export const nodalInputSchema = circuitDocumentSchema;

export type NodalInput = z.infer<typeof nodalInputSchema>;
export type NodalValue = MnaResult;
export type NodalErrorCode =
  | MnaErrorCode
  | 'circuito-vacio'
  | 'circuito-desconectado'
  | 'lazo-de-fuentes-de-voltaje'
  | 'corte-de-fuentes-de-corriente'
  | 'nodo-sin-referencia';

export function solveNodal(input: NodalInput): CalculatorResult<NodalValue, NodalErrorCode> {
  const topology = buildTopology(input);
  const structural = validateTopology(topology);
  if (structural) {
    return {
      ok: false,
      error: { code: structural.code as NodalErrorCode, message: structural.message },
      steps: [],
      tables: [],
      series: [],
      notices: [{ level: 'error', message: structural.message }],
    };
  }

  const mna = solveMna(topology);
  if (!mna.ok) {
    return {
      ok: false,
      error: { code: mna.code as NodalErrorCode, message: mna.message },
      steps: [],
      tables: [],
      series: [],
      notices: [{ level: 'error', message: mna.message }],
    };
  }

  const summary: SummaryItem[] = mna.result.branchResults.map((b) => ({
    label: b.label,
    value: `${formatNumber(b.i, 4)}\\text{ A}`,
  }));
  summary.unshift({
    label: 'Nodos',
    value: String(topology.nodes.length),
  });

  return {
    ok: true,
    value: mna.result,
    summary,
    steps: mna.steps,
    tables: mna.tables,
    series: [],
    notices: mna.notices,
  };
}

export const analisisDeNodos: Calculator<NodalInput, NodalValue, NodalErrorCode> = {
  meta: {
    id: 'analisis-de-nodos',
    title: 'Análisis de nodos',
    summary:
      'Construye un circuito con resistencias y fuentes independientes y resuélvelo por análisis nodal.',
    citations: [{ sourceId: 'hayt-kemmerly-1993', locator: 'Capítulo 4' }],
  },
  inputSchema: nodalInputSchema,
  example: {
    components: [
      {
        id: 'v1',
        kind: 'voltage-source',
        a: { x: 0, y: 0 },
        b: { x: 0, y: 4 },
        value: 10,
        label: 'V1',
      },
      { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 0, y: 4 }, value: 5, label: 'R1' },
    ],
    wires: [],
    ground: { x: 0, y: 4 },
  },
  solve: solveNodal,
};
