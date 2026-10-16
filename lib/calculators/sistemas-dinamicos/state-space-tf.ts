/**
 * Función de transferencia a partir de las ecuaciones de estado (Ogata, 3.ª ed., sec. 3-4,
 * ec. 3-32): G(s) = C(sI − A)⁻¹B + D = [C·adj(sI − A)·B + D·det(sI − A)] / det(sI − A).
 *
 * La adjunta y el determinante salen del algoritmo de Faddeev-LeVerrier, el mismo que usan las
 * ecuaciones de estado de Circuitos y Sistemas.
 */
import { toLatexMatrix } from '@/lib/math/format';
import { addPoly, scalePoly, type Poly } from '@/lib/math/polynomials';
import type { Step } from '../types';
import { adjugateTex, faddeevLeverrier, sIminusATex } from '../circuitos-y-sistemas/state-space';
import { polyTex, tfReduce, tfTex, tidyPoly, type TransferFunction } from './transfer-function';

const DIGITS = 6;

export interface StateSpaceTf {
  tf: TransferFunction;
  /** G(s) antes de cancelar factores comunes (su denominador es det(sI − A)). */
  raw: TransferFunction;
  charPoly: Poly;
  reduced: boolean;
  steps: Step[];
}

/** Columna `j` de B y fila `i` de C (sistemas con varias entradas y salidas). */
export function stateSpaceToTf(
  A: number[][],
  B: number[][],
  C: number[][],
  D: number[][],
  outputIndex = 0,
  inputIndex = 0,
): StateSpaceTf {
  const n = A.length;
  const { charPoly, M } = faddeevLeverrier(A);
  const b = B.map((row) => row[inputIndex] ?? 0);
  const c = C[outputIndex] ?? Array<number>(n).fill(0);
  const d = D[outputIndex]?.[inputIndex] ?? 0;
  // C·adj(sI − A)·B = Σ_k (c M_k b) s^{n−1−k}.
  const numerator: Poly = M.map((m) =>
    c.reduce((s, ci, i) => s + ci * m[i]!.reduce((t, mij, j) => t + mij * b[j]!, 0), 0),
  );
  const num = tidyPoly(addPoly(numerator, scalePoly(charPoly, d)));
  const raw: TransferFunction = { num, den: charPoly };
  const { tf, reduced } = tfReduce(raw);
  const steps: Step[] = [
    {
      title: 'Matriz sI − A',
      result: `sI - A = ${sIminusATex(A)}`,
    },
    {
      title: 'Determinante y adjunta (Faddeev-LeVerrier)',
      explanation:
        'det(sI − A) es el polinomio característico: sus raíces (los valores característicos de A) son los polos de G(s). La adjunta se obtiene con M₀ = I, c_k = −tr(A·M_{k−1})/k y M_k = A·M_{k−1} + c_k·I.',
      result: `\\det(sI - A) = ${polyTex(charPoly)},\\quad \\operatorname{adj}(sI - A) = ${adjugateTex(M)}`,
    },
    {
      title: 'Función de transferencia',
      explanation: reduced
        ? 'Se cancelaron factores comunes del numerador y el denominador: el sistema tiene polos que no se ven desde la entrada o la salida (no es completamente controlable u observable).'
        : undefined,
      formula:
        'G(s) = C(sI - A)^{-1}B + D = \\frac{C\\,\\operatorname{adj}(sI - A)\\,B}{\\det(sI - A)} + D',
      substitution: `C = ${toLatexMatrix([c], DIGITS)},\\quad B = ${toLatexMatrix(
        b.map((v) => [v]),
        DIGITS,
      )},\\quad D = ${toLatexMatrix([[d]], DIGITS)}`,
      result: reduced ? `G(s) = ${tfTex(raw)} = ${tfTex(tf)}` : `G(s) = ${tfTex(tf)}`,
    },
  ];
  return { tf, raw, charPoly, reduced, steps };
}
