/**
 * Reducción de diagramas de bloques con el álgebra de bloques (bloques en cascada, en paralelo,
 * lazos de realimentación y movimiento de puntos suma y de bifurcación).
 *
 * Fuentes: Ogata, 3.ª ed., sec. 3-3, tabla 3-1 y ejemplo 3-1 (figura 3-9); Kuo, 7.ª ed.,
 * sec. 3-3 y 3-9 (el diagrama de la figura 3-17 y su flujograma equivalente).
 */
import type { Calculator, CalculatorResult, Notice, Step, SummaryItem } from '../types';
import { KUO_FIG_3_17_BRANCHES, OGATA_FIG_3_9 } from './examples';
import {
  graphInputSchema,
  resolveGraph,
  type GraphErrorCode,
  type GraphInput,
} from './graph-input';
import { reduceDiagram } from './reduction';
import { nodeTex } from './signal-flow';
import { frTex, frToUnivariate } from './symbolic';
import { rootsText, tfReduce, tfTex, zpk, zpkTex } from './transfer-function';

export type ReductionInput = GraphInput;

export interface ReductionValue {
  transferTex: string;
  /** Forma con numerador y denominador desarrollados (la de Mason). */
  canonicalTex: string;
  rational: { num: number[]; den: number[] } | null;
}

export type ReductionErrorCode = GraphErrorCode | 'no-reducible';

export function solveReduction(
  input: ReductionInput,
): CalculatorResult<ReductionValue, ReductionErrorCode> {
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
  const steps: Step[] = [...resolved.steps];
  const ratio = `\\frac{${nodeTex(resolved.output)}}{${nodeTex(resolved.input)}}`;
  const outcome = reduceDiagram(resolved.graph, resolved.input, resolved.output);
  if (!outcome.ok) {
    return {
      ok: false,
      error: { code: 'no-reducible', message: outcome.message },
      steps: [...steps, ...outcome.steps],
      tables: resolved.tables,
      series: [],
      notices: [{ level: 'error', message: outcome.message }],
    };
  }
  const { transfer, canonical } = outcome.result;
  steps.push(...outcome.result.steps);
  const transferTex = frTex(transfer);
  const canonicalTex = frTex(canonical);
  steps.push({
    title: 'Diagrama reducido',
    explanation:
      transferTex === canonicalTex
        ? 'Queda un solo bloque entre la entrada y la salida.'
        : 'Queda un solo bloque entre la entrada y la salida. Al desarrollar el numerador y el denominador se obtiene la misma función que da la fórmula de Mason: el numerador es la suma de las trayectorias directas por sus cofactores y el denominador es 1 menos la suma de los lazos, más los productos de lazos que no se tocan.',
    result:
      transferTex === canonicalTex
        ? `${ratio} = ${transferTex}`
        : `${ratio} = ${transferTex} = ${canonicalTex}`,
  });

  const summary: SummaryItem[] = [
    { label: 'Función de transferencia', value: `${ratio} = ${canonicalTex}`, emphasis: true },
  ];
  const notices: Notice[] = [];
  const asRational = frToUnivariate(canonical, 's');
  let rational: ReductionValue['rational'] = null;
  if (asRational) {
    const { tf, reduced } = tfReduce(asRational);
    rational = tf;
    const { poles, zeros } = zpk(tf);
    steps.push({
      title: 'Función de transferencia en s',
      explanation: [
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
    value: { transferTex, canonicalTex, rational },
    summary,
    steps,
    tables: resolved.tables,
    series: [],
    notices,
  };
}

export const reduccionDeDiagramasDeBloques: Calculator<
  ReductionInput,
  ReductionValue,
  ReductionErrorCode
> = {
  meta: {
    id: 'reduccion-de-diagramas-de-bloques',
    title: 'Reducción de diagramas de bloques',
    summary: 'Simplifica un diagrama de bloques con el álgebra de bloques.',
    citations: [
      { sourceId: 'ogata-1998', locator: 'Sec. 3-3, tabla 3-1 y ejemplo 3-1 (figura 3-9)' },
      { sourceId: 'kuo-1996', locator: 'Sec. 3-3 y 3-9 (figura 3-17)' },
    ],
  },
  inputSchema: graphInputSchema,
  // Ogata, ejemplo 3-1: C/R = G1G2G3/(1 − G1G2H1 + G2G3H2 + G1G2G3).
  example: {
    mode: 'diagrama',
    branches: KUO_FIG_3_17_BRANCHES,
    input: 'R',
    output: 'C',
    diagram: OGATA_FIG_3_9,
  },
  solve: solveReduction,
};
