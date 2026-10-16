/**
 * Entrada común de las calculadoras de la Unidad I: un flujograma escrito como lista de ramas o un
 * diagrama de bloques dibujado en el constructor. Ambos se convierten en un `Sfg`.
 */
import { z } from 'zod';
import type { ResultTable, Step } from '../types';
import { blockDiagramSchema, diagramToGraph, type DiagramErrorCode } from './block-diagram';
import { nodeTex, type Sfg, type SfgBranch } from './signal-flow';
import { frTex, parseGain } from './symbolic';

const nodeName = z
  .string()
  .trim()
  .min(1, 'Escribe el nombre del nodo.')
  .max(12, 'Nombre de nodo demasiado largo.')
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Usa letras y números, empezando por una letra (x1, R, E).');

export const branchRowSchema = z.object({
  from: nodeName,
  to: nodeName,
  gain: z.string().trim().min(1, 'Escribe la ganancia.').max(120, 'Ganancia demasiado larga.'),
});

export const graphInputShape = {
  mode: z.enum(['flujograma', 'diagrama']),
  branches: z.array(branchRowSchema).max(60, 'Como máximo 60 ramas.'),
  /** Nodo o señal de entrada; vacío = la primera entrada. */
  input: z.string().trim().max(12),
  /** Nodo o señal de salida; vacío = la primera salida. */
  output: z.string().trim().max(12),
  diagram: blockDiagramSchema,
};

export const graphInputSchema = z.object(graphInputShape);
export type GraphInput = z.infer<typeof graphInputSchema>;

export type GraphErrorCode =
  DiagramErrorCode | 'ganancia-invalida' | 'sin-ramas' | 'nodo-inexistente';

export type GraphOutcome =
  | { ok: true; graph: Sfg; input: string; output: string; steps: Step[]; tables: ResultTable[] }
  | { ok: false; code: GraphErrorCode; message: string; steps: Step[] };

/** Nodos que no reciben ramas (posibles entradas) y que no salen (posibles salidas). */
export function defaultEnds(graph: Sfg): { input: string; output: string } {
  const sources = graph.nodes.filter((n) => !graph.branches.some((b) => b.to === n));
  const sinks = graph.nodes.filter((n) => !graph.branches.some((b) => b.from === n));
  return {
    input: sources[0] ?? graph.nodes[0] ?? '',
    output: sinks.at(-1) ?? graph.nodes.at(-1) ?? '',
  };
}

export function resolveGraph(input: GraphInput): GraphOutcome {
  if (input.mode === 'diagrama') {
    const converted = diagramToGraph(input.diagram);
    if (!converted.ok)
      return { ok: false, code: converted.code, message: converted.message, steps: [] };
    const { graph, inputs, outputs, steps } = converted.value;
    const from = input.input || inputs[0]!;
    const to = input.output || outputs[0]!;
    if (!inputs.includes(from)) {
      return {
        ok: false,
        code: 'nodo-inexistente',
        message: `El diagrama no tiene una entrada llamada «${from}».`,
        steps,
      };
    }
    if (!outputs.includes(to)) {
      return {
        ok: false,
        code: 'nodo-inexistente',
        message: `El diagrama no tiene una salida llamada «${to}».`,
        steps,
      };
    }
    return { ok: true, graph, input: from, output: to, steps, tables: [branchTable(graph)] };
  }

  if (input.branches.length === 0) {
    return {
      ok: false,
      code: 'sin-ramas',
      message: 'Agrega al menos una rama al flujograma.',
      steps: [],
    };
  }
  const nodes: string[] = [];
  const branches: SfgBranch[] = [];
  for (const [i, row] of input.branches.entries()) {
    const parsed = parseGain(row.gain);
    if (!parsed.ok) {
      return {
        ok: false,
        code: 'ganancia-invalida',
        message: `Rama ${i + 1} (${row.from} → ${row.to}): ${parsed.message}`,
        steps: [],
      };
    }
    for (const n of [row.from, row.to]) if (!nodes.includes(n)) nodes.push(n);
    if (parsed.value.coef !== 0) branches.push({ from: row.from, to: row.to, gain: parsed.value });
  }
  const graph: Sfg = { nodes, branches };
  const ends = defaultEnds(graph);
  const from = input.input || ends.input;
  const to = input.output || ends.output;
  for (const n of [from, to]) {
    if (!nodes.includes(n)) {
      return {
        ok: false,
        code: 'nodo-inexistente',
        message: `El flujograma no tiene un nodo llamado «${n}».`,
        steps: [],
      };
    }
  }
  const steps: Step[] = [
    {
      title: 'Flujograma',
      explanation: `${nodes.length} nodos y ${branches.length} ramas. Cada nodo es una señal igual a la suma de las ramas que llegan a él, cada una multiplicada por su ganancia. Entrada: ${from}; salida: ${to}.`,
    },
  ];
  return { ok: true, graph, input: from, output: to, steps, tables: [branchTable(graph)] };
}

export function branchTable(graph: Sfg): ResultTable {
  return {
    id: 'ramas',
    title: 'Ramas del flujograma',
    columns: [
      { key: 'de', header: '\\text{De}', format: 'latex' },
      { key: 'a', header: '\\text{A}', format: 'latex' },
      { key: 'ganancia', header: '\\text{Ganancia}', format: 'latex' },
    ],
    rows: graph.branches.map((b) => ({
      de: nodeTex(b.from),
      a: nodeTex(b.to),
      ganancia: frTex(b.gain),
    })),
  };
}
