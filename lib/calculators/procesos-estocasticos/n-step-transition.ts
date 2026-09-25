/**
 * Probabilidades de transición en n pasos y distribución después de n transiciones
 * (ecuaciones de Chapman-Kolmogorov):
 *
 *   P⁽ⁿ⁾ = Pⁿ = Pⁿ⁻¹ · P,        a⁽ⁿ⁾ = a⁽⁰⁾ Pⁿ
 *
 * Taha, sec. 19.5.2 (ejemplo 19.5-1).
 */
import { z } from 'zod';
import { multiply, vectorTimesMatrix } from '@/lib/math/linear-algebra';
import { toLatexMatrix, toLatexNumber, toLatexVector } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
} from '../types';
import { clean, distributionProblem, matrixTable, transitionMatrixField } from './markov';

export const nStepInputSchema = z
  .object({
    P: transitionMatrixField,
    steps: z
      .number({ error: 'Ingresa el número de pasos n.' })
      .int('El número de pasos debe ser entero.')
      .min(1, 'n debe ser al menos 1.')
      .max(100, 'El máximo permitido es n = 100.'),
    initial: z.custom<number[]>((v) => Array.isArray(v)).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.initial === undefined || !Array.isArray(v.P)) return;
    const problem = distributionProblem(v.initial, v.P.length);
    if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['initial'] });
  });

export type NStepInput = z.infer<typeof nStepInputSchema>;

export interface NStepValue {
  /** Pⁿ. */
  power: number[][];
  /** a⁽ⁿ⁾, si se dio la distribución inicial. */
  distribution: number[] | null;
}

export type NStepErrorCode = never;

/** Con n mayor que esto, solo se detallan las primeras potencias y la última. */
const DETAILED_POWERS = 6;

const n = toLatexNumber;

export function solveNStep(input: NStepInput): CalculatorResult<NStepValue, NStepErrorCode> {
  const { P, steps: count, initial } = input;
  const size = P.length;
  const steps: Step[] = [
    {
      title: 'Matriz de transición de un paso',
      explanation:
        'p_ij es la probabilidad de pasar del estado i al estado j en una transición. Por las ecuaciones de Chapman-Kolmogorov, la matriz de n pasos es la potencia n de P.',
      formula: `P = ${toLatexMatrix(P)}, \\qquad P^{(n)} = P^n`,
    },
  ];

  let power = P;
  for (let k = 2; k <= count; k++) {
    const previous = power;
    power = multiply(previous, P).map((row) => row.map(clean));
    const detailed = count <= 2 * DETAILED_POWERS || k <= DETAILED_POWERS || k === count;
    if (detailed) {
      const entry = previous[0]!.map((v, m) => `(${n(v)})(${n(P[m]![0]!)})`).join(' + ');
      steps.push({
        title: `Calcular P^${k}`,
        explanation:
          k === 2
            ? 'Cada entrada es la suma, sobre todos los estados intermedios m, de ir de i a m y luego de m a j.'
            : undefined,
        formula: `P^{${k}} = P^{${k - 1}}\\,P`,
        substitution: `p^{(${k})}_{11} = \\sum_m p^{(${k - 1})}_{1m}\\,p_{m1} = ${entry}`,
        result: `P^{${k}} = ${toLatexMatrix(power)}`,
      });
    } else if (k === DETAILED_POWERS + 1) {
      steps.push({
        title: `Potencias ${DETAILED_POWERS + 1} a ${count - 1}`,
        explanation: 'Se repite la misma multiplicación por P en cada paso.',
      });
    }
  }

  let distribution: number[] | null = null;
  const series: Series[] = [];
  const tables = [
    matrixTable('potencia', `Matriz de transición en ${count} pasos, P^${count}`, power, 'p^{(n)}'),
  ];

  if (initial) {
    distribution = vectorTimesMatrix(initial, power).map(clean);
    const component = initial.map((a, i) => `(${n(a)})(${n(power[i]![0]!)})`).join(' + ');
    steps.push({
      title: `Distribución después de ${count} transiciones`,
      explanation: 'Se multiplica el vector de probabilidades iniciales por la matriz de n pasos.',
      formula: 'a^{(n)} = a^{(0)} P^n, \\qquad a^{(n)}_j = \\sum_i a^{(0)}_i\\,p^{(n)}_{ij}',
      substitution: `a^{(${count})}_1 = ${component}`,
      result: `a^{(${count})} = ${toLatexVector(distribution)}`,
    });
    tables.push({
      id: 'distribucion',
      title: `Distribución después de ${count} transiciones`,
      columns: [
        { key: 'state', header: '\\text{Estado}' },
        { key: 'initial', header: 'a^{(0)}_j' },
        { key: 'final', header: `a^{(${count})}_j` },
      ],
      rows: distribution.map((p, j) => ({ state: j + 1, initial: initial[j]!, final: p })),
    } as ReturnType<typeof matrixTable>);
    series.push({
      id: 'distribucion',
      title: `Distribución de probabilidad en el paso ${count}`,
      xLabel: 'Estado',
      yLabel: 'Probabilidad',
      kind: 'bar',
      points: distribution.map((p, j) => ({ x: j + 1, y: p })),
    });
  }

  const summary = [
    {
      label: `Matriz de ${count} pasos`,
      value: `P^{${count}} = ${toLatexMatrix(power, 4)}`,
      emphasis: true,
    },
    ...(distribution
      ? [
          {
            label: `Distribución en el paso ${count}`,
            value: `a^{(${count})} = ${toLatexVector(distribution, 4)}`,
          },
        ]
      : []),
    { label: 'Estados', value: String(size) },
  ];

  return {
    ok: true,
    value: { power, distribution },
    summary,
    ...emptyTrace(),
    steps,
    tables,
    series,
  };
}

export const nStepTransition: Calculator<NStepInput, NStepValue, NStepErrorCode> = {
  meta: {
    id: 'transicion-en-n-pasos',
    title: 'Probabilidades de transición en n pasos',
    summary: 'Potencias de la matriz de transición y distribución después de n pasos.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 19.5.2, Ejemplo 19.5-1 (p. 696 de la 7.ª ed. en español)',
      },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'wong-2007' },
    ],
  },
  inputSchema: nStepInputSchema,
  // Taha, ejemplo 19.5-1: dos estados, a⁽⁰⁾ = (0.7, 0.3); el libro calcula P², P⁴ y P⁸.
  example: {
    P: [
      [0.2, 0.8],
      [0.6, 0.4],
    ],
    steps: 8,
    initial: [0.7, 0.3],
  },
  solve: solveNStep,
};
