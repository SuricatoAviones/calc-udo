/**
 * Operaciones con matrices (Chapra & Canale, sec. PT3.2.2 "Reglas de operaciones con matrices" y
 * sec. 9.7 / 10.2 para la inversa):
 *
 *   Suma y resta:         c_ij = a_ij ± b_ij                    (mismas dimensiones)
 *   Producto por escalar: c_ij = k · a_ij
 *   Producto:             c_ij = Σ_k a_ik b_kj                 (columnas de A = filas de B)
 *   Transpuesta:          (Aᵀ)_ij = a_ji
 *   Inversa:              Gauss-Jordan sobre [A | I] → [I | A⁻¹]
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Latex,
  type Step,
  type SummaryItem,
} from '../types';
import {
  cloneMatrix,
  isNegligible,
  MATRIX_DIGITS,
  matrixScale,
  matrixSchema,
  texAugmented,
  texMatrix,
  type Matrix,
} from './matrix';

export const matrixOperations = [
  'suma',
  'resta',
  'escalar',
  'producto',
  'transpuesta',
  'inversa',
] as const;
export type MatrixOperation = (typeof matrixOperations)[number];

const usesB = (op: MatrixOperation) => op === 'suma' || op === 'resta' || op === 'producto';

export const matrixOperationsInputSchema = z
  .object({
    operation: z.enum(matrixOperations, { error: 'Elige una operación.' }),
    A: matrixSchema('A', { maxRows: 6, maxCols: 6 }),
    B: matrixSchema('B', { maxRows: 6, maxCols: 6 }).optional(),
    k: z
      .number({ error: 'Ingresa el escalar k.' })
      .refine(Number.isFinite, 'k debe ser un número finito.')
      .optional(),
  })
  .superRefine((v, ctx) => {
    const rowsA = v.A.length;
    const colsA = v.A[0]?.length ?? 0;
    if (usesB(v.operation)) {
      if (!v.B) {
        ctx.addIssue({ code: 'custom', path: ['B'], message: 'Escribe la matriz B.' });
        return;
      }
      const rowsB = v.B.length;
      const colsB = v.B[0]?.length ?? 0;
      if (v.operation !== 'producto' && (rowsA !== rowsB || colsA !== colsB)) {
        ctx.addIssue({
          code: 'custom',
          path: ['B'],
          message: `Para ${v.operation === 'suma' ? 'sumar' : 'restar'}, A y B deben tener las mismas dimensiones (A es ${rowsA} × ${colsA} y B es ${rowsB} × ${colsB}).`,
        });
      }
      if (v.operation === 'producto' && colsA !== rowsB) {
        ctx.addIssue({
          code: 'custom',
          path: ['B'],
          message: `Para multiplicar A·B, el número de columnas de A (${colsA}) debe ser igual al de filas de B (${rowsB}).`,
        });
      }
    }
    if (v.operation === 'escalar' && v.k === undefined) {
      ctx.addIssue({ code: 'custom', path: ['k'], message: 'Ingresa el escalar k.' });
    }
    if (v.operation === 'inversa' && rowsA !== colsA) {
      ctx.addIssue({
        code: 'custom',
        path: ['A'],
        message: 'Solo las matrices cuadradas tienen inversa.',
      });
    }
  });

export type MatrixOperationsInput = z.infer<typeof matrixOperationsInputSchema>;

export interface MatrixOperationsValue {
  result: Matrix;
}

export type MatrixOperationsErrorCode = 'singular';

type Result = CalculatorResult<MatrixOperationsValue, MatrixOperationsErrorCode>;

const n = (v: number) => toLatexNumber(v, MATRIX_DIGITS);
const op = (v: number) => toLatexOperand(v, MATRIX_DIGITS);

/** Con más entradas que esto no se detalla el cálculo de cada una. */
const MAX_DETAILED_ENTRIES = 16;

function dims(m: Matrix): string {
  return `${m.length} \\times ${m[0]?.length ?? 0}`;
}

/** Matriz de expresiones LaTeX ya armadas (p. ej. `1 + 5`). */
function texMatrixOf(cells: Latex[][]): Latex {
  return `\\begin{bmatrix} ${cells.map((row) => row.join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
}

function success(result: Matrix, steps: Step[], summaryLabel: Latex): Result {
  const summary: SummaryItem[] = [
    { label: 'Resultado', value: `${summaryLabel} = ${texMatrix(result)}`, emphasis: true },
    { label: 'Dimensiones', value: dims(result) },
  ];
  return { ok: true, value: { result }, summary, ...emptyTrace(), steps };
}

function elementwise(A: Matrix, B: Matrix, sign: 1 | -1): Result {
  const symbol = sign === 1 ? '+' : '-';
  const C = A.map((row, i) => row.map((a, j) => a + sign * B[i]![j]!));
  return success(
    C,
    [
      { title: 'Matrices', result: `A = ${texMatrix(A)}, \\quad B = ${texMatrix(B)}` },
      {
        title: sign === 1 ? 'Sumar elemento a elemento' : 'Restar elemento a elemento',
        explanation: `A y B tienen las mismas dimensiones (${formatNumber(A.length)} × ${formatNumber(A[0]!.length)}), así que se opera cada par de elementos que ocupan la misma posición.`,
        formula: `c_{ij} = a_{ij} ${symbol} b_{ij}`,
        substitution: `C = ${texMatrixOf(A.map((row, i) => row.map((a, j) => `${n(a)} ${symbol} ${op(B[i]![j]!)}`)))}`,
        result: `C = A ${symbol} B = ${texMatrix(C)}`,
      },
    ],
    `A ${symbol} B`,
  );
}

function scalar(A: Matrix, k: number): Result {
  const C = A.map((row) => row.map((a) => k * a));
  return success(
    C,
    [
      { title: 'Matriz y escalar', result: `A = ${texMatrix(A)}, \\quad k = ${n(k)}` },
      {
        title: 'Multiplicar cada elemento por k',
        formula: 'c_{ij} = k\\,a_{ij}',
        substitution: `kA = ${texMatrixOf(A.map((row) => row.map((a) => `${op(k)}${op(a)}`)))}`,
        result: `kA = ${texMatrix(C)}`,
      },
    ],
    'kA',
  );
}

function product(A: Matrix, B: Matrix): Result {
  const m = A.length;
  const inner = B.length;
  const p = B[0]!.length;
  const C: Matrix = Array.from({ length: m }, () => new Array<number>(p).fill(0));
  const entries: Step[] = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      const terms: string[] = [];
      for (let k = 0; k < inner; k++) {
        sum += A[i]![k]! * B[k]![j]!;
        terms.push(`${op(A[i]![k]!)}${op(B[k]![j]!)}`);
      }
      C[i]![j] = sum;
      entries.push({
        title: `Elemento c${'₀₁₂₃₄₅₆₇₈₉'[i + 1]}${'₀₁₂₃₄₅₆₇₈₉'[j + 1]}: fila ${i + 1} de A por columna ${j + 1} de B`,
        formula: `c_{${i + 1}${j + 1}} = ${Array.from({ length: inner }, (_, k) => `a_{${i + 1}${k + 1}}b_{${k + 1}${j + 1}}`).join(' + ')}`,
        substitution: `c_{${i + 1}${j + 1}} = ${terms.join(' + ')}`,
        result: `c_{${i + 1}${j + 1}} = ${n(sum)}`,
      });
    }
  }
  const detailed = m * p <= MAX_DETAILED_ENTRIES;
  return success(
    C,
    [
      {
        title: 'Matrices',
        result: `A_{${dims(A)}} = ${texMatrix(A)}, \\quad B_{${dims(B)}} = ${texMatrix(B)}`,
      },
      {
        title: 'Dimensiones del producto',
        explanation: `A tiene ${inner} columnas y B tiene ${inner} filas, así que el producto existe. El resultado tiene las filas de A y las columnas de B.`,
        result: `C = AB \\text{ es de } ${m} \\times ${p}`,
      },
      {
        title: 'Cada elemento: fila de A por columna de B',
        explanation: detailed
          ? 'Cada c_ij es la suma de los productos de la fila i de A por la columna j de B, término a término.'
          : `Cada c_ij es la suma de los productos de la fila i de A por la columna j de B. Se detallan los primeros ${MAX_DETAILED_ENTRIES} elementos.`,
        formula: `c_{ij} = \\sum_{k=1}^{${inner}} a_{ik}\\,b_{kj}`,
        children: detailed ? entries : entries.slice(0, MAX_DETAILED_ENTRIES),
      },
      { title: 'Producto', result: `C = AB = ${texMatrix(C)}` },
    ],
    'AB',
  );
}

function transpose(A: Matrix): Result {
  const T = A[0]!.map((_, j) => A.map((row) => row[j]!));
  return success(
    T,
    [
      { title: 'Matriz', result: `A_{${dims(A)}} = ${texMatrix(A)}` },
      {
        title: 'Intercambiar filas por columnas',
        explanation: 'La fila i de A pasa a ser la columna i de Aᵀ.',
        formula: '(A^T)_{ij} = a_{ji}',
        result: `A^T_{${dims(T)}} = ${texMatrix(T)}`,
      },
    ],
    'A^T',
  );
}

function inverse(A: Matrix): Result {
  const size = A.length;
  const scale = matrixScale(A);
  const m = A.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  const steps: Step[] = [
    { title: 'Matriz', result: `A = ${texMatrix(A)}` },
    {
      title: 'Matriz aumentada con la identidad',
      explanation:
        'Se aplican a [A | I] operaciones de fila hasta convertir A en la identidad (método de Gauss-Jordan). Las mismas operaciones convierten I en A⁻¹.',
      result: `[A \\mid I] = ${texAugmented(m, size)}`,
    },
  ];

  for (let k = 0; k < size; k++) {
    const children: Step[] = [];
    let best = k;
    for (let r = k + 1; r < size; r++) if (Math.abs(m[r]![k]!) > Math.abs(m[best]![k]!)) best = r;
    if (isNegligible(m[best]![k]!, scale)) {
      steps.push({
        title: `Columna ${k + 1}: no hay pivote`,
        explanation: `Todos los elementos de la columna ${k + 1}, desde la fila ${k + 1} hacia abajo, son 0. La matriz es singular (det A = 0) y no tiene inversa.`,
      });
      return {
        ok: false,
        error: {
          code: 'singular',
          message: 'La matriz es singular (det A = 0): no tiene inversa.',
        },
        ...emptyTrace(),
        steps,
      };
    }
    if (best !== k) {
      [m[k], m[best]] = [m[best]!, m[k]!];
      children.push({
        title: `Pivoteo parcial: intercambiar R${k + 1} y R${best + 1}`,
        explanation: `El mayor valor absoluto de la columna ${k + 1} está en la fila ${best + 1}.`,
      });
    }
    const pivot = m[k]![k]!;
    m[k] = m[k]!.map((v) => v / pivot);
    m[k]![k] = 1;
    children.push({
      title: `Normalizar la fila ${k + 1}`,
      formula: `R_{${k + 1}} \\leftarrow \\frac{R_{${k + 1}}}{a_{${k + 1}${k + 1}}}`,
      substitution: `R_{${k + 1}} \\leftarrow \\frac{R_{${k + 1}}}{${n(pivot)}}`,
      result: `R_{${k + 1}} = (${m[k]!.map(n).join(',\\ ')})`,
    });
    for (let i = 0; i < size; i++) {
      if (i === k) continue;
      const factor = m[i]![k]!;
      if (factor === 0) continue;
      m[i] = m[i]!.map((v, c) => v - factor * m[k]![c]!);
      m[i]![k] = 0;
      children.push({
        title: `Hacer cero el elemento de la fila ${i + 1}`,
        formula: `R_{${i + 1}} \\leftarrow R_{${i + 1}} - a_{${i + 1}${k + 1}}\\,R_{${k + 1}}`,
        substitution: `R_{${i + 1}} \\leftarrow R_{${i + 1}} - ${op(factor)}\\,R_{${k + 1}}`,
        result: `R_{${i + 1}} = (${m[i]!.map(n).join(',\\ ')})`,
      });
    }
    steps.push({
      title: `Columna ${k + 1}`,
      children,
      result: texAugmented(m, size),
    });
  }

  const inv = m.map((row) => row.slice(size));
  const check = A.map((row) =>
    inv[0]!.map((_, j) => row.reduce((s, a, k) => s + a * inv[k]![j]!, 0)),
  );
  steps.push({
    title: 'Inversa',
    explanation: 'La parte izquierda ya es la identidad; la derecha es A⁻¹.',
    result: `A^{-1} = ${texMatrix(inv)}`,
  });
  steps.push({
    title: 'Comprobación',
    explanation: 'A·A⁻¹ debe ser la identidad (salvo por el redondeo).',
    result: `A A^{-1} = ${texMatrix(check.map((row) => row.map((v) => (Math.abs(v) < 1e-12 ? 0 : v))))}`,
  });
  return success(cloneMatrix(inv), steps, 'A^{-1}');
}

export function solveMatrixOperations(input: MatrixOperationsInput): Result {
  const { A, B, k } = input;
  switch (input.operation) {
    case 'suma':
      return elementwise(A, B!, 1);
    case 'resta':
      return elementwise(A, B!, -1);
    case 'escalar':
      return scalar(A, k!);
    case 'producto':
      return product(A, B!);
    case 'transpuesta':
      return transpose(A);
    case 'inversa':
      return inverse(A);
  }
}

export const matrixOperationsCalculator: Calculator<
  MatrixOperationsInput,
  MatrixOperationsValue,
  MatrixOperationsErrorCode
> = {
  meta: {
    id: 'operaciones-con-matrices',
    title: 'Operaciones con matrices',
    summary: 'Suma, resta, producto, transpuesta e inversa de matrices con el procedimiento.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Parte 3, sec. PT3.2.2 (reglas de operaciones con matrices, figura PT3.2 del producto) y sec. 10.2 (la matriz inversa), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'smith-1993' },
    ],
  },
  inputSchema: matrixOperationsInputSchema,
  example: {
    operation: 'producto',
    A: [
      [3, 1],
      [8, 6],
      [0, 4],
    ],
    B: [
      [5, 9],
      [7, 2],
    ],
    k: 2,
  },
  solve: solveMatrixOperations,
};
