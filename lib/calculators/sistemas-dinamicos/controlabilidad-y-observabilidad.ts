/**
 * Controlabilidad completa del estado, controlabilidad de la salida y observabilidad completa de
 * ẋ = Ax + Bu, y = Cx + Du por el rango de sus matrices (Ogata, 3.ª ed., sec. 11-6 y 11-7):
 *
 *   M = [B | AB | ⋯ | Aⁿ⁻¹B] de rango n            (estado completamente controlable)
 *   [CB | CAB | ⋯ | CAⁿ⁻¹B | D] de rango m          (salida completamente controlable)
 *   N = [C; CA; ⋯; CAⁿ⁻¹] de rango n                 (completamente observable)
 *
 * Con una entrada y una salida se calcula además G(s): una cancelación de polos y ceros indica que
 * el sistema no es completamente controlable u observable.
 */
import { z } from 'zod';
import { toLatexMatrix, toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, Notice, Step, SummaryItem } from '../types';
import { matrixSchema } from '../metodos-numericos/matrix';
import {
  controllabilityMatrix,
  matMul,
  observabilityMatrix,
  rank,
  tidyMatrix,
} from './state-design';
import { stateSpaceToTf } from './state-space-tf';
import { tfTex } from './transfer-function';

const DIGITS = 6;
const tex = (m: number[][]) => toLatexMatrix(m, DIGITS);

const inputSchema = z.object({
  A: matrixSchema('A', { maxRows: 6, maxCols: 6, shape: 'square' }),
  B: matrixSchema('B', { maxRows: 6, maxCols: 4 }),
  C: matrixSchema('C', { maxRows: 4, maxCols: 6 }),
  D: matrixSchema('D', { maxRows: 4, maxCols: 4 }),
});

export type ControllabilityInput = z.infer<typeof inputSchema>;

export interface ControllabilityValue {
  n: number;
  controllabilityRank: number;
  observabilityRank: number;
  outputRank: number;
  controllable: boolean;
  observable: boolean;
  outputControllable: boolean;
  /** Si es SISO: hubo cancelación al formar G(s). */
  cancellation: boolean | null;
}

export type ControllabilityErrorCode = 'dimensiones';

function fail(message: string): CalculatorResult<ControllabilityValue, ControllabilityErrorCode> {
  return {
    ok: false,
    error: { code: 'dimensiones', message },
    steps: [],
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

function rankStep(
  title: string,
  name: string,
  matrix: number[][],
  target: number,
  what: string,
  ok: string,
  notOk: string,
): { step: Step; value: number } {
  const r = rank(matrix);
  const square = matrix.length === matrix[0]!.length;
  return {
    value: r.rank,
    step: {
      title,
      explanation: `${what} El rango se obtiene llevando la matriz a la forma escalonada por eliminación de Gauss: es el número de filas no nulas. ${r.rank === target ? ok : notOk}`,
      formula: `${name} = ${tex(matrix)}`,
      substitution: square ? `\\det ${name} = ${toLatexNumber(r.determinant!, DIGITS)}` : undefined,
      result: `\\text{forma escalonada: } ${tex(tidyMatrix(r.echelon))},\\quad \\operatorname{rango} ${name} = ${r.rank}`,
    },
  };
}

export function solveControllability(
  input: ControllabilityInput,
): CalculatorResult<ControllabilityValue, ControllabilityErrorCode> {
  const { A, B, C: Cm, D } = input;
  const n = A.length;
  if (B.length !== n) return fail(`B debe tener ${n} filas, como A.`);
  if (Cm[0]!.length !== n) return fail(`C debe tener ${n} columnas, como A.`);
  if (D.length !== Cm.length || D[0]!.length !== B[0]!.length) {
    return fail(`D debe ser de ${Cm.length} × ${B[0]!.length} (salidas × entradas).`);
  }
  const m = Cm.length;
  const steps: Step[] = [];
  const notices: Notice[] = [];

  steps.push({
    title: 'Sistema',
    explanation: `${n} variables de estado, ${B[0]!.length} ${B[0]!.length === 1 ? 'entrada' : 'entradas'} y ${m} ${m === 1 ? 'salida' : 'salidas'}.`,
    formula:
      '\\dot{\\mathbf{x}} = A\\mathbf{x} + B\\mathbf{u},\\qquad \\mathbf{y} = C\\mathbf{x} + D\\mathbf{u}',
    result: `A = ${tex(A)},\\ B = ${tex(B)},\\ C = ${tex(Cm)},\\ D = ${tex(D)}`,
  });

  const ctrl = controllabilityMatrix(A, B);
  steps.push({
    title: 'Productos AᵏB',
    children: ctrl.blocks.map((b, k) => ({
      title: k === 0 ? 'B' : `A${k === 1 ? '' : `^${k}`}B`,
      result: `${k === 0 ? 'B' : k === 1 ? 'AB' : `A^{${k}}B`} = ${tex(b)}`,
    })),
  });
  const c = rankStep(
    'Controlabilidad completa del estado',
    'M',
    ctrl.matrix,
    n,
    `El sistema es de estado completamente controlable si y solo si M = [B | AB | ⋯ | Aⁿ⁻¹B] tiene rango n = ${n}.`,
    'El rango es n: el sistema es de estado completamente controlable.',
    'El rango es menor que n: el sistema no es de estado completamente controlable.',
  );
  steps.push(c.step);

  const outputBlocks = [...ctrl.blocks.map((b) => tidyMatrix(matMul(Cm, b))), D];
  const outputMatrix = Cm.map((_, i) => outputBlocks.flatMap((b) => b[i]!));
  const o = rankStep(
    'Controlabilidad de la salida',
    'Q',
    outputMatrix,
    m,
    `La salida es completamente controlable si y solo si [CB | CAB | ⋯ | CAⁿ⁻¹B | D] tiene rango m = ${m}.`,
    'El rango es m: la salida es completamente controlable.',
    'El rango es menor que m: la salida no es completamente controlable.',
  );
  steps.push(o.step);

  const obs = observabilityMatrix(A, Cm);
  const ob = rankStep(
    'Observabilidad completa',
    'N',
    obs.matrix,
    n,
    `El sistema es completamente observable si y solo si N = [C; CA; ⋯; CAⁿ⁻¹] tiene rango n = ${n}. (Ogata escribe la transpuesta [C* | A*C* | ⋯ | (A*)ⁿ⁻¹C*], que tiene el mismo rango.)`,
    'El rango es n: el sistema es completamente observable.',
    'El rango es menor que n: el sistema no es completamente observable.',
  );
  steps.push(ob.step);

  let cancellation: boolean | null = null;
  if (B[0]!.length === 1 && m === 1) {
    const result = stateSpaceToTf(A, B, Cm, D);
    cancellation = result.reduced;
    steps.push({
      title: 'Condición en el plano s',
      explanation: result.reduced
        ? 'Al formar la función de transferencia se cancelan polos y ceros: el modo cancelado no se puede controlar desde la entrada u observar desde la salida (Ogata, sec. 11-6 y 11-7).'
        : 'La función de transferencia no tiene cancelaciones, como corresponde a un sistema controlable y observable.',
      children: result.steps,
      result: `G(s) = ${tfTex(result.raw)}${result.reduced ? ` = ${tfTex(result.tf)}` : ''}`,
    });
  }

  const controllable = c.value === n;
  const observable = ob.value === n;
  const outputControllable = o.value === m;
  const yes = (v: boolean) => (v ? '\\text{sí}' : '\\text{no}');
  const summary: SummaryItem[] = [
    {
      label: 'Controlable',
      value: `${yes(controllable)}\\ (\\operatorname{rango} M = ${c.value})`,
      emphasis: true,
    },
    {
      label: 'Observable',
      value: `${yes(observable)}\\ (\\operatorname{rango} N = ${ob.value})`,
      emphasis: true,
    },
    {
      label: 'Salida controlable',
      value: `${yes(outputControllable)}\\ (\\operatorname{rango} = ${o.value})`,
    },
  ];
  return {
    ok: true,
    value: {
      n,
      controllabilityRank: c.value,
      observabilityRank: ob.value,
      outputRank: o.value,
      controllable,
      observable,
      outputControllable,
      cancellation,
    },
    summary,
    steps,
    tables: [],
    series: [],
    notices,
  };
}

export const controlabilidadYObservabilidad: Calculator<
  ControllabilityInput,
  ControllabilityValue,
  ControllabilityErrorCode
> = {
  meta: {
    id: 'controlabilidad-y-observabilidad',
    title: 'Controlabilidad y observabilidad',
    summary: 'Rango de las matrices de controlabilidad y de observabilidad.',
    citations: [
      { sourceId: 'ogata-1998', locator: 'Sec. 11-6 y 11-7, ejemplos 11-11 a 11-15' },
      { sourceId: 'ogata-1998', locator: '5.ª ed. en español (2010), ejemplos 9-10 y 9-11' },
    ],
  },
  inputSchema,
  // Ogata, 3.ª ed., ejemplo 11-14.
  example: {
    A: [
      [1, 1],
      [-2, -1],
    ],
    B: [[0], [1]],
    C: [[1, 0]],
    D: [[0]],
  },
  solve: solveControllability,
};
