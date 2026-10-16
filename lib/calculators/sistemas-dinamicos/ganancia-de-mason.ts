/**
 * Fórmula de ganancia de Mason sobre un flujograma escrito como lista de ramas o sobre el
 * flujograma equivalente de un diagrama de bloques dibujado.
 *
 * Fuentes: Kuo, 7.ª ed., sec. 3-7 a 3-9 (ec. 3-46 a 3-48, ejemplos de la fig. 3-8 y 3-17);
 * Ogata, 3.ª ed., ejemplo 3-1 (el mismo diagrama que se reduce por álgebra de bloques).
 */
import type { Calculator, CalculatorResult, Notice, Step, SummaryItem } from '../types';
import { KUO_FIG_3_17_BRANCHES, OGATA_FIG_3_9 } from './examples';
import {
  graphInputSchema,
  resolveGraph,
  type GraphErrorCode,
  type GraphInput,
} from './graph-input';
import { mason, nodeTex, type MasonErrorCode } from './signal-flow';
import { frTex } from './symbolic';
import { rootsText, tfReduce, tfTex, zpk, zpkTex } from './transfer-function';

export type MasonInput = GraphInput;

export interface MasonValue {
  /** M = y_sal/y_ent en LaTeX. */
  transferTex: string;
  deltaTex: string;
  paths: number;
  loops: number;
  /** Si las ganancias solo dependen de s: M(s) simplificada. */
  rational: { num: number[]; den: number[] } | null;
}

export type MasonCalculatorErrorCode = GraphErrorCode | MasonErrorCode;

export function solveMasonCalculator(
  input: MasonInput,
): CalculatorResult<MasonValue, MasonCalculatorErrorCode> {
  const resolved = resolveGraph(input);
  if (!resolved.ok) {
    return {
      ok: false,
      error: { code: resolved.code, message: resolved.message },
      steps: resolved.steps,
      tables: [],
      series: [],
      notices: [{ level: 'error', message: resolved.message }],
    };
  }
  const ratio = `\\frac{${nodeTex(resolved.output)}}{${nodeTex(resolved.input)}}`;
  const outcome = mason(resolved.graph, resolved.input, resolved.output, ratio);
  const steps: Step[] = [...resolved.steps];
  const tables = [...resolved.tables];
  if (!outcome.ok) {
    return {
      ok: false,
      error: { code: outcome.code, message: outcome.message },
      steps: [...steps, ...outcome.steps],
      tables: [...tables, ...outcome.tables],
      series: [],
      notices: [{ level: 'error', message: outcome.message }],
    };
  }
  const r = outcome.result;
  steps.push(...r.steps);
  tables.push(...r.tables);
  const notices: Notice[] = [];
  const summary: SummaryItem[] = [
    { label: 'Función de transferencia', value: `${ratio} = ${frTex(r.transfer)}`, emphasis: true },
    { label: 'Determinante', value: `\\Delta = ${frTex(r.delta)}` },
    {
      label: 'Trayectorias y lazos',
      value: `${r.paths.length}\\ \\text{trayectorias},\\ ${r.loops.length}\\ \\text{lazos}`,
    },
  ];

  let rational: MasonValue['rational'] = null;
  if (r.rational) {
    const { tf, reduced } = tfReduce(r.rational);
    rational = tf;
    const { poles, zeros } = zpk(tf);
    steps.push({
      title: 'Función de transferencia en s',
      explanation: [
        'Todas las ganancias son funciones de s: se multiplican numerador y denominador para obtener un cociente de polinomios.',
        reduced && 'Se cancelaron los factores comunes del numerador y el denominador.',
        `Polos: ${rootsText(poles)}. Ceros: ${rootsText(zeros)}.`,
      ]
        .filter(Boolean)
        .join(' '),
      result: `${ratio} = ${tfTex(tf)} = ${zpkTex(tf)}`,
    });
    summary.push({ label: 'Como cociente de polinomios', value: `${ratio} = ${tfTex(tf)}` });
  }

  return {
    ok: true,
    value: {
      transferTex: frTex(r.transfer),
      deltaTex: frTex(r.delta),
      paths: r.paths.length,
      loops: r.loops.length,
      rational,
    },
    summary,
    steps,
    tables,
    series: [],
    notices,
  };
}

export const gananciaDeMason: Calculator<MasonInput, MasonValue, MasonCalculatorErrorCode> = {
  meta: {
    id: 'ganancia-de-mason',
    title: 'Fórmula de ganancia de Mason',
    summary: 'Función de transferencia de un flujograma a partir de lazos y trayectos directos.',
    citations: [
      {
        sourceId: 'kuo-1996',
        locator: 'Sec. 3-7 a 3-9, ec. 3-46 a 3-48; flujogramas de las figuras 3-8 y 3-17',
      },
      { sourceId: 'ogata-1998', locator: 'Sec. 3-3, ejemplo 3-1 (figura 3-9)' },
    ],
  },
  inputSchema: graphInputSchema,
  // Kuo, fig. 3-17: dos trayectorias directas y cinco lazos que se tocan entre sí.
  example: {
    mode: 'flujograma',
    branches: KUO_FIG_3_17_BRANCHES,
    input: 'R',
    output: 'Y',
    diagram: OGATA_FIG_3_9,
  },
  solve: solveMasonCalculator,
};
