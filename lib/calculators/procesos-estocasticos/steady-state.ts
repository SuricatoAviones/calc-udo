/**
 * Probabilidades de estado estable de una cadena de Markov: la solución de
 *
 *   π_j = Σ_i π_i p_ij  (j = 1 … n),     Σ_j π_j = 1
 *
 * Una de las n primeras ecuaciones es redundante, así que se reemplaza por la de normalización y
 * el sistema resultante se resuelve por eliminación de Gauss. Tiempos medios de recurrencia:
 * μ_jj = 1/π_j. Taha, sec. 19.5.2 (ejemplo 19.5-3) y sec. 19.3 (ejemplo 19.3-1).
 */
import { z } from 'zod';
import { toLatexMatrix, toLatexNumber, toLatexVector } from '@/lib/math/format';
import { solveLinearSystem, vectorTimesMatrix } from '@/lib/math/linear-algebra';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Notice,
  type Step,
} from '../types';
import { clean, transitionMatrixField } from './markov';

export const steadyStateInputSchema = z.object({ P: transitionMatrixField });
export type SteadyStateInput = z.infer<typeof steadyStateInputSchema>;

export interface SteadyStateValue {
  pi: number[];
  /** μ_jj = 1/π_j; `Infinity` para estados con π_j = 0. */
  recurrenceTimes: number[];
}

export type SteadyStateErrorCode = 'not-unique';

const n = toLatexNumber;

export function solveSteadyState({
  P,
}: SteadyStateInput): CalculatorResult<SteadyStateValue, SteadyStateErrorCode> {
  const size = P.length;
  const piName = (j: number) => `\\pi_{${j + 1}}`;

  const equations = P.map(
    (_, j) => `${piName(j)} &= ${P.map((row, i) => `${n(row[j]!)}\\,${piName(i)}`).join(' + ')}`,
  );
  const steps: Step[] = [
    {
      title: 'Plantear las ecuaciones de balance',
      explanation:
        'En el estado estable, la probabilidad de estar en j es la misma antes y después de una transición: π = πP. Además, las probabilidades suman 1.',
      formula: '\\pi_j = \\sum_i \\pi_i\\,p_{ij}, \\qquad \\sum_j \\pi_j = 1',
      substitution: `\\begin{aligned} ${equations.join(' \\\\ ')} \\\\ 1 &= ${P.map((_, j) => piName(j)).join(' + ')} \\end{aligned}`,
    },
  ];

  // Sistema A π = b: filas j = 1 … n−1 de (Pᵀ − I) π = 0 y la normalización en la última.
  const A = Array.from({ length: size }, (_, j) =>
    j === size - 1
      ? new Array<number>(size).fill(1)
      : P.map((row, i) => row[j]! - (i === j ? 1 : 0)),
  );
  const b = A.map((_, j) => (j === size - 1 ? 1 : 0));
  steps.push({
    title: 'Reemplazar la ecuación redundante',
    explanation: `Una de las ${size} ecuaciones de balance se deduce de las demás, así que la última se reemplaza por la de normalización. Queda un sistema lineal A π = b.`,
    formula: 'A\\,\\pi^T = b',
    result: `${toLatexMatrix(A)} \\begin{bmatrix} ${P.map((_, j) => piName(j)).join(' \\\\ ')} \\end{bmatrix} = ${toLatexMatrix(b.map((v) => [v]))}`,
  });

  const solution = solveLinearSystem(A, b);
  if (!solution) {
    return {
      ok: false,
      error: {
        code: 'not-unique',
        message:
          'El sistema no tiene solución única: la cadena tiene más de una clase cerrada de estados (por ejemplo, varios estados absorbentes), así que la distribución a largo plazo depende del estado inicial.',
      },
      ...emptyTrace(),
      steps,
    };
  }
  const pi = solution.map(clean);
  steps.push({
    title: 'Resolver el sistema',
    explanation: 'Se resuelve por eliminación de Gauss con pivoteo parcial.',
    result: `\\pi = ${toLatexVector(pi)}`,
  });

  const check = vectorTimesMatrix(pi, P);
  steps.push({
    title: 'Verificar que π = πP',
    formula: '\\pi P = \\pi',
    substitution: `${toLatexVector(pi)}\\,${toLatexMatrix(P)} = ${toLatexVector(check)}`,
  });

  const recurrenceTimes = pi.map((p) => (p === 0 ? Infinity : 1 / p));
  steps.push({
    title: 'Tiempos medios de recurrencia',
    explanation: 'Número esperado de transiciones para volver a un estado partiendo de él.',
    formula: '\\mu_{jj} = \\frac{1}{\\pi_j}',
    substitution: pi
      .map((p, j) => `\\mu_{${j + 1}${j + 1}} = \\frac{1}{${n(p)}}`)
      .join(', \\quad '),
    result: recurrenceTimes.map((m, j) => `\\mu_{${j + 1}${j + 1}} = ${n(m, 6)}`).join(', \\quad '),
  });

  const notices: Notice[] = [];
  const transient = pi.flatMap((p, j) => (p === 0 ? [j + 1] : []));
  if (transient.length > 0) {
    notices.push({
      level: 'info',
      message: `π = 0 para ${transient.length === 1 ? 'el estado' : 'los estados'} ${transient.join(', ')}: a largo plazo la cadena no vuelve a ${transient.length === 1 ? 'él' : 'ellos'} (estados transitorios).`,
    });
  }
  notices.push({
    level: 'info',
    message:
      'Si la cadena es periódica, π sigue siendo la fracción de tiempo en cada estado, pero Pⁿ no converge a una matriz con filas iguales.',
  });

  return {
    ok: true,
    value: { pi, recurrenceTimes },
    summary: [
      {
        label: 'Probabilidades de estado estable',
        value: `\\pi = ${toLatexVector(pi, 6)}`,
        emphasis: true,
      },
      ...pi.map((p, j) => ({
        label: `Estado ${j + 1}`,
        value: `\\pi_{${j + 1}} = ${n(p, 6)}, \\quad \\mu_{${j + 1}${j + 1}} = ${Number.isFinite(recurrenceTimes[j]!) ? n(recurrenceTimes[j]!, 4) : '\\infty'}`,
      })),
    ],
    ...emptyTrace(),
    steps,
    notices,
    tables: [
      {
        id: 'estado-estable',
        title: 'Distribución de estado estable',
        columns: [
          { key: 'state', header: '\\text{Estado}' },
          { key: 'pi', header: '\\pi_j' },
          { key: 'mu', header: '\\mu_{jj}' },
        ],
        rows: pi.map((p, j) => ({
          state: j + 1,
          pi: p,
          mu: Number.isFinite(recurrenceTimes[j]!) ? recurrenceTimes[j]! : '∞',
        })),
      },
    ],
    series: [
      {
        id: 'pi',
        title: 'Probabilidades de estado estable',
        xLabel: 'Estado',
        yLabel: 'π',
        kind: 'bar',
        points: pi.map((p, j) => ({ x: j + 1, y: p })),
      },
    ],
  };
}

export const steadyState: Calculator<SteadyStateInput, SteadyStateValue, SteadyStateErrorCode> = {
  meta: {
    id: 'estado-estable',
    title: 'Probabilidades de estado estable',
    summary: 'Resuelve π = πP para una cadena de Markov y calcula los tiempos de recurrencia.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 19.5.2, Ejemplo 19.5-3 (p. 699 de la 7.ª ed. en español)',
      },
      { sourceId: 'taha', locator: 'Sec. 19.3, Ejemplo 19.3-1: problema del jardinero (p. 683)' },
      { sourceId: 'hillier-lieberman-2002' },
    ],
  },
  inputSchema: steadyStateInputSchema,
  // Taha, ejemplo 19.3-1: política "fertilizar siempre" del problema del jardinero.
  example: {
    P: [
      [0.3, 0.6, 0.1],
      [0.1, 0.6, 0.3],
      [0.05, 0.4, 0.55],
    ],
  },
  solve: solveSteadyState,
};
