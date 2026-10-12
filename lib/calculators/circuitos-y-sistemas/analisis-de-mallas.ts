/**
 * Análisis de mallas interactivo para Circuitos y Sistemas.
 *
 * El estudiante dibuja un circuito planar (sin cruces) con el editor; se detectan las mallas como
 * las caras acotadas del dibujo y se resuelve por corrientes de malla, mostrando las KVL, el
 * sistema y su solución.
 *
 * Fuentes: Hayt, Kemmerly & Durbin, *Análisis de Circuitos en Ingeniería*, 7.ª ed., cap. 4.
 */
import { z } from 'zod';
import { formatNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, SummaryItem } from '../types';
import { circuitDocumentSchema } from './circuit';
import { solveMesh, type MeshErrorCode, type MeshResult } from './mesh';

export const meshInputSchema = z.object({ circuit: circuitDocumentSchema });

export type MeshInput = z.infer<typeof meshInputSchema>;
export type MeshValue = MeshResult;
export type MeshCalcErrorCode = MeshErrorCode;

export function solveMeshAnalysis(
  input: MeshInput,
): CalculatorResult<MeshValue, MeshCalcErrorCode> {
  const outcome = solveMesh(input.circuit);
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

  const summary: SummaryItem[] = outcome.result.meshCurrents.map((v, i) => ({
    label: `i_${i + 1}`,
    value: `${formatNumber(v, 4)}\\text{ A}`,
  }));
  summary.unshift({ label: 'Mallas', value: String(outcome.result.meshes.length) });

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

export const analisisDeMallas: Calculator<MeshInput, MeshValue, MeshCalcErrorCode> = {
  meta: {
    id: 'analisis-de-mallas',
    title: 'Análisis de mallas',
    summary:
      'Construye un circuito planar y resuélvelo por corrientes de malla con la KVL de cada malla.',
    citations: [{ sourceId: 'hayt-kemmerly-1993', locator: 'Capítulo 4' }],
  },
  inputSchema: meshInputSchema,
  example: {
    circuit: {
      // Dos mallas con la rama central R4 compartida. Verificado contra el análisis nodal.
      components: [
        {
          id: 'v1',
          kind: 'voltage-source',
          a: { x: 0, y: 0 },
          b: { x: 0, y: 4 },
          value: 10,
          label: 'V1',
        },
        { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, value: 2, label: 'R1' },
        { id: 'r2', kind: 'resistor', a: { x: 2, y: 0 }, b: { x: 4, y: 0 }, value: 4, label: 'R2' },
        { id: 'r3', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, value: 4, label: 'R3' },
        { id: 'r4', kind: 'resistor', a: { x: 2, y: 0 }, b: { x: 2, y: 4 }, value: 4, label: 'R4' },
      ],
      wires: [
        {
          id: 'w1',
          points: [
            { x: 0, y: 4 },
            { x: 2, y: 4 },
          ],
        },
        {
          id: 'w2',
          points: [
            { x: 2, y: 4 },
            { x: 4, y: 4 },
          ],
        },
      ],
      ground: { x: 0, y: 4 },
    },
  },
  solve: solveMeshAnalysis,
};
