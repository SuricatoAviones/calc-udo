/**
 * Piezas comunes de los juegos de dos personas y suma cero (Taha, sec. 13.4; Hillier & Lieberman,
 * cap. 14): la matriz de pagos del jugador A (filas) contra B (columnas), los criterios maximin y
 * minimax y la presentación en LaTeX.
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';

export const MAX_STRATEGIES = 8;

export const payoffMatrixField = z
  .array(
    z.array(
      z
        .number({ error: 'Completa todos los pagos de la matriz.' })
        .refine(Number.isFinite, 'Los pagos deben ser números finitos.'),
    ),
  )
  .min(1, 'La matriz debe tener al menos una fila.')
  .max(MAX_STRATEGIES, `El máximo es ${MAX_STRATEGIES} estrategias por jugador.`)
  .superRefine((matrix, ctx) => {
    const cols = matrix[0]?.length ?? 0;
    if (cols === 0 || cols > MAX_STRATEGIES) {
      ctx.addIssue({
        code: 'custom',
        message: `Cada jugador debe tener entre 1 y ${MAX_STRATEGIES} estrategias.`,
      });
    } else if (matrix.some((row) => row.length !== cols)) {
      ctx.addIssue({ code: 'custom', message: 'Todas las filas deben tener el mismo largo.' });
    }
  });

export type PayoffMatrix = number[][];

const n = toLatexNumber;

export const rowName = (i: number) => `A_{${i + 1}}`;
export const colName = (j: number) => `B_{${j + 1}}`;

/** Tolerancia para comparar pagos y valores esperados. */
export function toleranceFor(matrix: PayoffMatrix): number {
  const scale = Math.max(1, ...matrix.flat().map(Math.abs));
  return 1e-9 * scale;
}

/**
 * Submatriz con las filas y columnas indicadas (índices de la matriz original), en LaTeX con
 * los nombres de las estrategias como encabezados.
 */
export function payoffMatrixLatex(
  matrix: PayoffMatrix,
  rows: number[] = matrix.map((_, i) => i),
  cols: number[] = (matrix[0] ?? []).map((_, j) => j),
): string {
  const header = ` & ${cols.map(colName).join(' & ')}`;
  const body = rows.map((i) => `${rowName(i)} & ${cols.map((j) => n(matrix[i]![j]!)).join(' & ')}`);
  return `\\begin{array}{c|${'c'.repeat(cols.length)}} ${header} \\\\ \\hline ${body.join(' \\\\ ')} \\end{array}`;
}

export interface MinimaxAnalysis {
  rowMins: number[];
  colMaxs: number[];
  /** Valor inferior (maximin) y superior (minimax) del juego en estrategias puras. */
  maximin: number;
  minimax: number;
  /** Índices (de `rows`/`cols`) de las estrategias maximin y minimax. */
  maximinRows: number[];
  minimaxCols: number[];
  /** Celdas que son a la vez el mínimo de su fila y el máximo de su columna. */
  saddlePoints: [number, number][];
}

/** Criterios maximin (A) y minimax (B) sobre la submatriz `rows × cols`. */
export function analyzeMinimax(
  matrix: PayoffMatrix,
  rows: number[] = matrix.map((_, i) => i),
  cols: number[] = (matrix[0] ?? []).map((_, j) => j),
): MinimaxAnalysis {
  const tol = toleranceFor(matrix);
  const rowMins = rows.map((i) => Math.min(...cols.map((j) => matrix[i]![j]!)));
  const colMaxs = cols.map((j) => Math.max(...rows.map((i) => matrix[i]![j]!)));
  const maximin = Math.max(...rowMins);
  const minimax = Math.min(...colMaxs);
  const maximinRows = rows.filter((_, k) => Math.abs(rowMins[k]! - maximin) <= tol);
  const minimaxCols = cols.filter((_, k) => Math.abs(colMaxs[k]! - minimax) <= tol);
  const saddlePoints: [number, number][] = [];
  if (Math.abs(maximin - minimax) <= tol) {
    rows.forEach((i, ri) =>
      cols.forEach((j, cj) => {
        const a = matrix[i]![j]!;
        if (Math.abs(a - rowMins[ri]!) <= tol && Math.abs(a - colMaxs[cj]!) <= tol) {
          saddlePoints.push([i, j]);
        }
      }),
    );
  }
  return { rowMins, colMaxs, maximin, minimax, maximinRows, minimaxCols, saddlePoints };
}

/** Lista de nombres de estrategias: `A_{1}, A_{3}`. */
export function strategyList(indices: number[], name: (k: number) => string): string {
  return indices.map(name).join(',\\ ');
}
