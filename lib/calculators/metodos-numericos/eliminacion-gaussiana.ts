/**
 * Eliminación de Gauss para A x = b (Chapra & Canale, sec. 9.2 y 9.4.2):
 *
 * 1. Eliminación hacia adelante sobre la matriz aumentada [A | b] hasta dejarla triangular
 *    superior, opcionalmente con pivoteo parcial.
 * 2. Sustitución hacia atrás:
 *      x_n = b_n / a_nn,   x_i = (b_i − Σ_{j>i} a_ij x_j) / a_ii
 * 3. Comprobación: se sustituye x en las ecuaciones originales.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Latex,
  type Step,
  type SummaryItem,
} from '../types';
import {
  backSubstitution,
  determinantFromUpper,
  forwardElimination,
  MATRIX_DIGITS,
  matrixSchema,
  matVec,
  subscript,
  texAugmented,
} from './matrix';

export const pivotingOptions = ['parcial', 'ninguno'] as const;

export const gaussEliminationInputSchema = z.object({
  system: matrixSchema('El sistema', { minRows: 2, maxRows: 8, maxCols: 9, shape: 'augmented' }),
  pivoting: z.enum(pivotingOptions, { error: 'Elige si se usa pivoteo.' }),
});

export type GaussEliminationInput = z.infer<typeof gaussEliminationInputSchema>;

export interface GaussEliminationValue {
  solution: number[];
  determinant: number;
  swaps: number;
  /** A x − b en cada ecuación original. */
  residuals: number[];
}

export type GaussEliminationErrorCode = 'singular' | 'zero-pivot';

const n = (v: number) => toLatexNumber(v, MATRIX_DIGITS);

/** Una ecuación lineal en LaTeX: `3x_1 - 0.1x_2 - 0.2x_3 = 7.85`. */
export function linearEquationLatex(coefficients: number[], rhs: number, variable = 'x'): Latex {
  const terms: string[] = [];
  coefficients.forEach((a, j) => {
    if (a === 0) return;
    const name = `${variable}_{${j + 1}}`;
    const abs = Math.abs(a);
    const body = abs === 1 ? name : `${n(abs)}${name}`;
    if (terms.length === 0) terms.push(a < 0 ? `-${body}` : body);
    else terms.push(a < 0 ? `- ${body}` : `+ ${body}`);
  });
  return `${terms.length === 0 ? '0' : terms.join(' ')} = ${n(rhs)}`;
}

export function solveGaussElimination(
  input: GaussEliminationInput,
): CalculatorResult<GaussEliminationValue, GaussEliminationErrorCode> {
  const { system } = input;
  const size = system.length;
  const pivoting = input.pivoting === 'parcial';
  const a = system.map((row) => row.slice(0, size));
  const b = system.map((row) => row[size]!);

  const steps: Step[] = [
    {
      title: 'Sistema de ecuaciones',
      explanation: `${size} ecuaciones con ${size} incógnitas, escritas como la matriz aumentada [A | b].`,
      formula: `\\begin{aligned} ${system.map((row) => linearEquationLatex(row.slice(0, size), row[size]!).replace('=', '&=')).join(' \\\\ ')} \\end{aligned}`,
      result: `[A \\mid b] = ${texAugmented(system, 1)}`,
    },
  ];

  const elimination = forwardElimination(system, {
    pivotColumns: size,
    pivoting,
    augmentedColumns: 1,
  });
  steps.push({
    title: 'Eliminación hacia adelante',
    explanation: pivoting
      ? 'En cada columna se elige como pivote el elemento de mayor valor absoluto (pivoteo parcial) y se hacen ceros debajo de él restando múltiplos de su fila.'
      : 'En cada columna se usa como pivote el elemento de la diagonal y se hacen ceros debajo de él restando múltiplos de su fila (eliminación de Gauss simple).',
    children: elimination.steps,
  });

  const trace = () => ({ ...emptyTrace(), steps });

  if (elimination.zeroPivotColumn !== null) {
    const k = elimination.zeroPivotColumn + 1;
    if (!pivoting) {
      const below = elimination.upper.slice(k).some((row) => row[k - 1] !== 0);
      steps.push({
        title: `Pivote cero en la columna ${k}`,
        explanation: below
          ? `El pivote a${subscript(k)}${subscript(k)} vale 0 y no se puede dividir entre él. Hay un elemento distinto de 0 más abajo en la columna: con pivoteo parcial se intercambiarían las filas y se podría continuar.`
          : `El pivote a${subscript(k)}${subscript(k)} vale 0 y todos los elementos debajo de él también: la matriz es singular.`,
      });
      return {
        ok: false,
        error: below
          ? {
              code: 'zero-pivot',
              message: `El pivote de la columna ${k} es 0. Activa el pivoteo parcial para intercambiar filas.`,
            }
          : {
              code: 'singular',
              message:
                'La matriz de coeficientes es singular (det A = 0): el sistema no tiene solución única.',
            },
        ...trace(),
      };
    }
    steps.push({
      title: `Sin pivote en la columna ${k}`,
      explanation: `Todos los elementos de la columna ${k}, desde la fila ${k} hacia abajo, son 0: la matriz de coeficientes es singular (det A = 0).`,
    });
    return {
      ok: false,
      error: {
        code: 'singular',
        message:
          'La matriz de coeficientes es singular (det A = 0): el sistema no tiene solución o tiene infinitas.',
      },
      ...trace(),
    };
  }

  const { x, steps: backSteps } = backSubstitution(elimination.upper);
  steps.push({
    title: 'Sustitución hacia atrás',
    explanation:
      'La última ecuación tiene una sola incógnita. Se despeja y se sustituye en la anterior, y así hasta la primera.',
    children: backSteps,
  });

  const ax = matVec(a, x);
  const residuals = ax.map((v, i) => v - b[i]!);
  steps.push({
    title: 'Comprobación',
    explanation:
      'Se sustituye la solución en las ecuaciones originales. Las diferencias con el lado derecho se deben solo al redondeo.',
    children: system.map((row, i) => ({
      title: `Ecuación ${i + 1}`,
      substitution: `${row
        .slice(0, size)
        .map((coef, j) => `(${n(coef)})(${n(x[j]!)})`)
        .join(' + ')}`,
      result: `${n(ax[i]!)} \\approx ${n(b[i]!)}`,
    })),
  });

  const det = determinantFromUpper(elimination.upper, elimination.swaps);
  steps.push({
    ...det.step,
    title: 'De paso: el determinante de A',
    explanation: `${det.step.explanation} (Chapra, cuadro 9.1.)`,
  });

  const summary: SummaryItem[] = [
    {
      label: 'Solución',
      value: x.map((v, i) => `x_{${i + 1}} = ${n(v)}`).join(',\\quad '),
      emphasis: true,
    },
    { label: 'Determinante', value: `\\det A = ${n(det.value)}` },
    {
      label: 'Intercambios de filas',
      value: pivoting ? String(elimination.swaps) : '\\text{sin pivoteo}',
    },
  ];

  return {
    ok: true,
    value: { solution: x, determinant: det.value, swaps: elimination.swaps, residuals },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'solucion',
        title: 'Solución del sistema',
        columns: [
          { key: 'variable', header: '\\text{Incógnita}', format: 'latex' },
          { key: 'value', header: '\\text{Valor}' },
          { key: 'residual', header: '(Ax - b)_i' },
        ],
        rows: x.map((v, i) => ({
          variable: `x_{${i + 1}}`,
          value: v,
          residual: residuals[i]!,
        })),
      },
    ],
    notices:
      elimination.swaps > 0
        ? [
            {
              level: 'info',
              message: `Se intercambiaron filas ${formatNumber(elimination.swaps)} vez/veces por el pivoteo parcial.`,
            },
          ]
        : [],
  };
}

export const gaussElimination: Calculator<
  GaussEliminationInput,
  GaussEliminationValue,
  GaussEliminationErrorCode
> = {
  meta: {
    id: 'eliminacion-gaussiana',
    title: 'Eliminación gaussiana con pivoteo',
    summary:
      'Resuelve un sistema lineal con eliminación hacia adelante, pivoteo parcial y sustitución hacia atrás.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 9, sec. 9.2, ejemplo 9.5 (eliminación de Gauss simple) y sec. 9.4.2, ejemplo 9.9 (pivoteo parcial), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'smith-1993' },
    ],
  },
  inputSchema: gaussEliminationInputSchema,
  example: {
    system: [
      [3, -0.1, -0.2, 7.85],
      [0.1, 7, -0.3, -19.3],
      [0.3, -0.2, 10, 71.4],
    ],
    pivoting: 'parcial',
  },
  solve: solveGaussElimination,
};
