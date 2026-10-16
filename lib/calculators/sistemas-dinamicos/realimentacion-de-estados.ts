/**
 * Control por realimentación de estados u = −Kx con ubicación de polos (Ogata, 3.ª ed.,
 * sec. 12-2, ejemplo 12-1):
 *
 *   método 1: con la forma canónica controlable, T = MW y K = [αₙ − aₙ ⋯ α₁ − a₁]T⁻¹
 *   método 3: fórmula de Ackermann, K = [0 ⋯ 0 1][B | AB | ⋯ | Aⁿ⁻¹B]⁻¹ φ(A)
 *
 * aᵢ son los coeficientes de |sI − A| y αᵢ los del polinomio característico deseado. Se verifica
 * que los valores característicos de A − BK sean los polos pedidos y, si se da x(0), se calcula la
 * respuesta x(t) = ℒ⁻¹{(sI − A + BK)⁻¹x(0)}.
 */
import { z } from 'zod';
import * as C from '@/lib/math/complex';
import { toLatexMatrix, toLatexNumber } from '@/lib/math/format';
import { polyRoots, type Poly } from '@/lib/math/polynomials';
import type { Calculator, CalculatorResult, Notice, Series, Step, SummaryItem } from '../types';
import { matrixSchema } from '../metodos-numericos/matrix';
import { adjugateTex, faddeevLeverrier } from '../circuitos-y-sistemas/state-space';
import { inverseLaplace } from '../circuitos-y-sistemas/laplace-inverse';
import { polyTex as laplacePolyTex } from '../circuitos-y-sistemas/laplace';
import {
  controllabilityMatrix,
  hasConjugatePairs,
  inverse,
  matAdd,
  matMul,
  parseComplexList,
  polyFromComplexRoots,
  polyOfMatrix,
  rank,
  tidyMatrix,
  type Matrix,
} from './state-design';
import { horizonFor, sample } from './time-response';
import { rootsText } from './transfer-function';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);
const tex = (m: Matrix) => toLatexMatrix(m, DIGITS);

const inputSchema = z.object({
  A: matrixSchema('A', { maxRows: 6, maxCols: 6, shape: 'square' }),
  B: matrixSchema('B', { maxRows: 6, maxCols: 1 }),
  poles: z.string().trim().min(1, 'Escribe los polos deseados.').max(200, 'Demasiados caracteres.'),
  /** Estado inicial para la respuesta (opcional, separado por comas). */
  initial: z.string().max(200),
});

export type StateFeedbackInput = z.infer<typeof inputSchema>;

export interface StateFeedbackValue {
  K: number[];
  closedLoop: Matrix;
  desired: number[];
  characteristic: number[];
}

export type StateFeedbackErrorCode =
  'dimensiones' | 'polos-invalidos' | 'no-controlable' | 'estado-inicial-invalido';

function fail(
  code: StateFeedbackErrorCode,
  message: string,
  steps: Step[] = [],
): CalculatorResult<StateFeedbackValue, StateFeedbackErrorCode> {
  return {
    ok: false,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

/** W de Ogata (sec. 12-2): W_ij = a_{n−1−i−j} (con a₀ = 1 y 0 debajo de la antidiagonal). */
function wMatrix(charPoly: Poly): Matrix {
  const size = charPoly.length - 1;
  // charPoly = [1, a1, …, an]; W fila i = [a_{n−1−i}, …, a_1, 1, 0, …].
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => {
      const k = i + j; // índice desde la fila 0
      const idx = size - 1 - k; // a_{idx}, con a_0 = 1
      return idx < 0 ? 0 : charPoly[idx]!;
    }),
  );
}

export function solveStateFeedback(
  input: StateFeedbackInput,
): CalculatorResult<StateFeedbackValue, StateFeedbackErrorCode> {
  const { A, B } = input;
  const size = A.length;
  if (B.length !== size) return fail('dimensiones', `B debe tener ${size} filas, como A.`);
  const parsed = parseComplexList(input.poles);
  if (!parsed.ok) return fail('polos-invalidos', parsed.message);
  if (parsed.values.length !== size) {
    return fail(
      'polos-invalidos',
      `Se necesitan ${size} polos deseados (uno por variable de estado); hay ${parsed.values.length}.`,
    );
  }
  if (!hasConjugatePairs(parsed.values)) {
    return fail(
      'polos-invalidos',
      'Los polos complejos deben venir en pares conjugados para que K sea real.',
    );
  }
  const steps: Step[] = [];
  const notices: Notice[] = [];

  // Controlabilidad.
  const { matrix: M } = controllabilityMatrix(A, B);
  const r = rank(M);
  steps.push({
    title: 'Controlabilidad',
    explanation:
      r.rank === size
        ? 'M tiene rango n: el sistema es de estado completamente controlable y los polos en lazo cerrado se pueden ubicar donde se quiera.'
        : 'M tiene rango menor que n: el sistema no es completamente controlable y no se pueden ubicar todos los polos.',
    formula: 'M = [B \\mid AB \\mid \\cdots \\mid A^{n-1}B]',
    result: `M = ${tex(M)},\\quad |M| = ${n(r.determinant ?? 0)},\\quad \\operatorname{rango} M = ${r.rank}`,
  });
  if (r.rank < size)
    return fail(
      'no-controlable',
      'El sistema no es de estado completamente controlable: no existe K que ubique todos los polos.',
      steps,
    );

  const { charPoly } = faddeevLeverrier(A);
  const desired = polyFromComplexRoots(parsed.values);
  steps.push({
    title: 'Polinomio característico del sistema',
    formula: '|sI - A| = s^n + a_1s^{n-1} + \\cdots + a_n',
    result: `|sI - A| = ${laplacePolyTex(charPoly)}`,
  });
  steps.push({
    title: 'Polinomio característico deseado',
    explanation: `Polos deseados: ${parsed.values.map((v) => C.toTextRect(v, DIGITS)).join(', ')}.`,
    formula:
      '(s - \\mu_1)(s - \\mu_2)\\cdots(s - \\mu_n) = s^n + \\alpha_1s^{n-1} + \\cdots + \\alpha_n',
    result: laplacePolyTex(desired),
  });

  // Método 1: T = MW.
  const W = wMatrix(charPoly);
  const T = tidyMatrix(matMul(M, W));
  const Tinv = inverse(T);
  const diff = Array.from({ length: size }, (_, k) => desired[size - k]! - charPoly[size - k]!);
  let K1: number[] | null = null;
  if (Tinv) K1 = tidyMatrix(matMul([diff], Tinv))[0]!;
  steps.push({
    title: 'Método 1: matriz de transformación T = MW',
    explanation:
      'T lleva el sistema a la forma canónica controlable, donde la ganancia es la diferencia de coeficientes de los polinomios característicos.',
    formula:
      'K = [\\alpha_n - a_n \\mid \\alpha_{n-1} - a_{n-1} \\mid \\cdots \\mid \\alpha_1 - a_1]\\,T^{-1}',
    substitution: `W = ${tex(W)},\\quad T = ${tex(T)}`,
    result: K1 ? `K = ${tex([diff])}${tex(Tinv!)} = ${tex([K1])}` : undefined,
  });

  // Método 3: Ackermann.
  const phi = polyOfMatrix(desired, A);
  const Minv = inverse(M)!;
  const last = [Array.from({ length: size }, (_, k) => (k === size - 1 ? 1 : 0))];
  const K = tidyMatrix(matMul(matMul(last, Minv), phi))[0]!;
  steps.push({
    title: 'Método 3: fórmula de Ackermann',
    formula:
      'K = [0 \\ \\cdots \\ 0 \\ 1]\\,[B \\mid AB \\mid \\cdots \\mid A^{n-1}B]^{-1}\\,\\phi(A),\\quad \\phi(A) = A^n + \\alpha_1A^{n-1} + \\cdots + \\alpha_nI',
    substitution: `\\phi(A) = ${tex(phi)},\\quad M^{-1} = ${tex(Minv)}`,
    result: `K = ${tex([K])}`,
  });
  if (K1 && K1.some((v, i) => Math.abs(v - K[i]!) > 1e-6 * Math.max(1, Math.abs(v)))) {
    notices.push({
      level: 'warning',
      message: 'Los dos métodos dan valores distintos de K (posible problema numérico).',
    });
  }

  // Verificación.
  const closedLoop = tidyMatrix(matAdd(A, matMul(B, [K]), -1));
  const closedPoly = faddeevLeverrier(closedLoop).charPoly;
  const eig = polyRoots(closedPoly);
  steps.push({
    title: 'Verificación',
    explanation: `Valores característicos de A − BK: ${rootsText(eig)}.`,
    formula: 'A - BK',
    result: `A - BK = ${tex(closedLoop)},\\quad |sI - A + BK| = ${laplacePolyTex(closedPoly)}`,
  });

  // Respuesta a condición inicial.
  const series: Series[] = [];
  const text = input.initial.trim();
  if (text) {
    const values = text
      .split(/[;,\s]+/)
      .filter(Boolean)
      .map((v) => Number(v.replace(',', '.')));
    if (values.length !== size || values.some((v) => !Number.isFinite(v))) {
      return fail(
        'estado-inicial-invalido',
        `Escribe ${size} valores para x(0), separados por comas.`,
        steps,
      );
    }
    const { charPoly: cp, M: adj } = faddeevLeverrier(closedLoop);
    const horizon = horizonFor({ num: [1], den: cp });
    const children: Step[] = [];
    for (let i = 0; i < size; i++) {
      // X_i(s) = [adj(sI − A_c) x0]_i / det.
      const num = adj.map((mk) => mk[i]!.reduce((s, v, j) => s + v * values[j]!, 0));
      const inv = inverseLaplace([{ delay: 0, num, den: cp }], `X_{${i + 1}}`, `x_{${i + 1}}`);
      if (!inv.ok) continue;
      children.push({ title: `x${i + 1}(t)`, result: `x_{${i + 1}}(t) = ${inv.result.tex}` });
      series.push({
        id: `x${i + 1}`,
        title: `Respuesta x${i + 1}(t) a la condición inicial`,
        xLabel: 't (s)',
        yLabel: `x${i + 1}(t)`,
        points: sample(inv.result.evaluate, horizon),
      });
    }
    steps.push({
      title: 'Respuesta a la condición inicial',
      explanation:
        'Con u = −Kx el sistema queda ẋ = (A − BK)x; su respuesta es X(s) = (sI − A + BK)⁻¹x(0).',
      formula:
        '\\mathbf{X}(s) = \\frac{\\operatorname{adj}(sI - A + BK)}{|sI - A + BK|}\\,\\mathbf{x}(0)',
      substitution: `\\operatorname{adj}(sI - A + BK) = ${adjugateTex(adj)}`,
      children,
    });
  }

  const summary: SummaryItem[] = [
    { label: 'Matriz de ganancias', value: `K = ${tex([K])}`, emphasis: true },
    { label: 'Polinomio deseado', value: laplacePolyTex(desired) },
    {
      label: 'Polos en lazo cerrado',
      value: eig
        .filter((e) => e.value.im >= 0)
        .map((e) => `s = ${C.toLatexRect(e.value, DIGITS)}${e.value.im > 0 ? '\\ (\\pm)' : ''}`)
        .join(',\\ '),
    },
  ];
  return {
    ok: true,
    value: { K, closedLoop, desired, characteristic: charPoly },
    summary,
    steps,
    tables: [],
    series,
    notices,
  };
}

export const realimentacionDeEstados: Calculator<
  StateFeedbackInput,
  StateFeedbackValue,
  StateFeedbackErrorCode
> = {
  meta: {
    id: 'realimentacion-de-estados',
    title: 'Control por realimentación de estados',
    summary: 'Diseña un controlador asignando los polos en lazo cerrado.',
    citations: [
      { sourceId: 'ogata-1998', locator: 'Sec. 12-2, ec. 12-13 y 12-18 (Ackermann), ejemplo 12-1' },
    ],
  },
  inputSchema,
  // Ogata, ejemplo 12-1: polos en −2 ± j4 y −10.
  example: {
    A: [
      [0, 1, 0],
      [0, 0, 1],
      [-1, -5, -6],
    ],
    B: [[0], [0], [1]],
    poles: '-2 + 4j, -2 - 4j, -10',
    initial: '',
  },
  solve: solveStateFeedback,
};
