/**
 * Determinante de una matriz cuadrada (Chapra & Canale, sec. 9.1.2 y cuadro 9.1):
 *
 * - Por cofactores (expansión por la primera fila):
 *     D = Σⱼ (−1)^{1+j} a_{1j} M_{1j},   con 2 × 2: D = a₁₁a₂₂ − a₁₂a₂₁
 *   donde el menor M_{1j} es el determinante que queda al quitar la fila 1 y la columna j.
 * - Por eliminación de Gauss: se lleva la matriz a forma triangular superior y
 *     D = (−1)^p · a₁₁ a₂₂ ⋯ a_nn     (p = intercambios de filas).
 */
import { z } from 'zod';
import { toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { emptyTrace, type Calculator, type Latex, type Step, type SummaryItem } from '../types';
import {
  determinantFromUpper,
  forwardElimination,
  isNegligible,
  MATRIX_DIGITS,
  matrixScale,
  matrixSchema,
  texDeterminant,
  texMatrix,
  type Matrix,
} from './matrix';

export const determinantMethods = ['cofactores', 'gauss'] as const;
export type DeterminantMethod = (typeof determinantMethods)[number];

/** Con más filas, la expansión por cofactores tiene demasiados términos para mostrarla. */
const MAX_COFACTOR_SIZE = 4;
const MAX_SIZE = 8;

export const determinantInputSchema = z
  .object({
    matrix: matrixSchema('La matriz', { minRows: 1, maxRows: MAX_SIZE, shape: 'square' }),
    method: z.enum(determinantMethods, { error: 'Elige un método.' }),
  })
  .refine((v) => v.method !== 'cofactores' || v.matrix.length <= MAX_COFACTOR_SIZE, {
    message: `Por cofactores se admiten matrices de hasta ${MAX_COFACTOR_SIZE} × ${MAX_COFACTOR_SIZE}; usa eliminación de Gauss.`,
    path: ['method'],
  });

export type DeterminantInput = z.infer<typeof determinantInputSchema>;

export interface DeterminantValue {
  determinant: number;
  /** El determinante es 0 (dentro del redondeo): la matriz no tiene inversa. */
  singular: boolean;
}

export type DeterminantErrorCode = never;

const n = (v: number) => toLatexNumber(v, MATRIX_DIGITS);
const op = (v: number) => toLatexOperand(v, MATRIX_DIGITS);

/** La matriz sin la fila `row` ni la columna `col`. */
function minorMatrix(m: Matrix, row: number, col: number): Matrix {
  return m.filter((_, i) => i !== row).map((r) => r.filter((_, j) => j !== col));
}

/** Determinante por cofactores, con un paso por menor. `name` es el nombre LaTeX (D, M_{12}…). */
function cofactorDeterminant(m: Matrix, name: Latex): { value: number; step: Step } {
  const size = m.length;
  if (size === 1) {
    const value = m[0]![0]!;
    return { value, step: { title: 'Matriz de 1 × 1', result: `${name} = ${n(value)}` } };
  }
  if (size === 2) {
    const [[a, b], [c, d]] = m as [[number, number], [number, number]];
    const value = a * d - b * c;
    return {
      value,
      step: {
        title: `Determinante 2 × 2`,
        formula: `${name} = ${texDeterminant(m)} = a_{11}a_{22} - a_{12}a_{21}`,
        substitution: `${name} = ${op(a)}${op(d)} - ${op(b)}${op(c)}`,
        result: `${name} = ${n(value)}`,
      },
    };
  }
  const children: Step[] = [];
  const minors: number[] = [];
  for (let j = 0; j < size; j++) {
    const minor = cofactorDeterminant(minorMatrix(m, 0, j), `M_{1${j + 1}}`);
    minors.push(minor.value);
    children.push({
      ...minor.step,
      title: `Menor M₁${'₀₁₂₃₄₅₆₇₈₉'[j + 1]}: se quita la fila 1 y la columna ${j + 1}`,
    });
  }
  const first = m[0]!;
  const value = first.reduce((s, a, j) => s + (j % 2 === 0 ? 1 : -1) * a * minors[j]!, 0);
  const sign = (j: number) => (j === 0 ? '' : j % 2 === 0 ? ' + ' : ' - ');
  return {
    value,
    step: {
      title: `Expansión por cofactores de la primera fila (${size} × ${size})`,
      explanation:
        'Cada elemento de la primera fila se multiplica por su menor (el determinante que queda al quitar su fila y su columna), con signos alternados + − + ….',
      children,
      formula: `${name} = ${first.map((_, j) => `${sign(j)}a_{1${j + 1}} M_{1${j + 1}}`).join('')}`,
      substitution: `${name} = ${first.map((a, j) => `${sign(j)}${op(a)}${op(minors[j]!)}`).join('')}`,
      result: `${name} = ${n(value)}`,
    },
  };
}

export function solveDeterminant(input: DeterminantInput) {
  const { matrix, method } = input;
  const size = matrix.length;
  const steps: Step[] = [
    {
      title: 'Matriz',
      explanation: `Matriz cuadrada de ${size} × ${size}.`,
      result: `A = ${texMatrix(matrix)}`,
    },
  ];

  let determinant: number;
  if (method === 'cofactores') {
    const { value, step } = cofactorDeterminant(matrix, 'D');
    steps.push(step);
    determinant = value;
  } else {
    const elimination = forwardElimination(matrix, {
      pivotColumns: size,
      pivoting: true,
      augmentedColumns: 0,
    });
    steps.push(...elimination.steps);
    if (elimination.zeroPivotColumn !== null) {
      const k = elimination.zeroPivotColumn + 1;
      steps.push({
        title: 'No hay pivote distinto de cero',
        explanation: `En la columna ${k}, todos los elementos desde la fila ${k} hacia abajo son 0. La matriz triangular tendría un 0 en la diagonal, así que el determinante es 0.`,
        result: '\\det A = 0',
      });
      determinant = 0;
    } else {
      steps.push({
        title: 'Matriz triangular superior',
        result: `U = ${texMatrix(elimination.upper)}`,
      });
      const { value, step } = determinantFromUpper(elimination.upper, elimination.swaps);
      steps.push(step);
      determinant = value;
    }
  }

  // Un determinante mucho menor que el producto de las escalas es cero salvo por el redondeo.
  const singular = isNegligible(determinant, matrixScale(matrix) ** size);
  if (singular) determinant = 0;
  steps.push({
    title: 'Conclusión',
    explanation: singular
      ? 'El determinante es 0: la matriz es singular (no tiene inversa) y un sistema con esta matriz no tiene solución única.'
      : 'El determinante es distinto de 0: la matriz tiene inversa y un sistema con esta matriz tiene solución única.',
    result: `\\det A = ${n(determinant)}`,
  });

  const summary: SummaryItem[] = [
    { label: 'Determinante', value: `\\det A = ${n(determinant)}`, emphasis: true },
    {
      label: 'Método',
      value: `\\text{${method === 'cofactores' ? 'cofactores' : 'eliminación de Gauss'}}`,
    },
    {
      label: 'La matriz',
      value: singular ? '\\text{es singular}' : '\\text{tiene inversa}',
    },
  ];
  return {
    ok: true as const,
    value: { determinant, singular },
    summary,
    ...emptyTrace(),
    steps,
  };
}

export const determinant: Calculator<DeterminantInput, DeterminantValue, DeterminantErrorCode> = {
  meta: {
    id: 'determinante',
    title: 'Determinante de una matriz',
    summary: 'Calcula el determinante por cofactores o por eliminación de Gauss, paso a paso.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 9, sec. 9.1.2, ejemplos 9.2 (determinantes) y 9.3 (regla de Cramer, D = −0.0022), y cuadro 9.1 (evaluación de determinantes usando la eliminación de Gauss), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'smith-1993' },
    ],
  },
  inputSchema: determinantInputSchema,
  example: {
    matrix: [
      [0.3, 0.52, 1],
      [0.5, 1, 1.9],
      [0.1, 0.3, 0.5],
    ],
    method: 'cofactores',
  },
  solve: solveDeterminant,
};
