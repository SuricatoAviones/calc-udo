/**
 * Piezas comunes de las cadenas de Markov de tiempo discreto (Taha, sec. 19.5; Hillier &
 * Lieberman, cap. de cadenas de Markov): validación de la matriz de transición y formato.
 *
 * Los estados se numeran 1, 2, …, n en la interfaz, como en Taha.
 */
import { z } from 'zod';
import { formatNumber } from '@/lib/math/format';

export const MIN_STATES = 2;
export const MAX_STATES = 8;
/** Tolerancia para que una fila "sume 1" (los estudiantes escriben 0.333 + 0.333 + 0.334). */
export const ROW_SUM_TOLERANCE = 1e-6;

/** Problema de validación de una matriz de transición, o `null` si es válida. */
export function transitionMatrixProblem(P: unknown): string | null {
  if (!Array.isArray(P) || P.length < MIN_STATES || P.length > MAX_STATES) {
    return `La matriz debe tener entre ${MIN_STATES} y ${MAX_STATES} estados.`;
  }
  const size = P.length;
  for (let i = 0; i < size; i++) {
    const row: unknown = P[i];
    if (!Array.isArray(row) || row.length !== size) return 'La matriz debe ser cuadrada.';
    for (let j = 0; j < size; j++) {
      const p: unknown = row[j];
      if (typeof p !== 'number' || !Number.isFinite(p)) {
        return `La entrada de la fila ${i + 1}, columna ${j + 1} no es un número.`;
      }
      if (p < 0 || p > 1) {
        return `La entrada de la fila ${i + 1}, columna ${j + 1} (${formatNumber(p)}) no es una probabilidad: debe estar entre 0 y 1.`;
      }
    }
    const sum = (row as number[]).reduce((s, p) => s + p, 0);
    if (Math.abs(sum - 1) > ROW_SUM_TOLERANCE) {
      return `La fila ${i + 1} suma ${formatNumber(sum, 6)}; cada fila de P debe sumar 1.`;
    }
  }
  return null;
}

export const transitionMatrixField = z
  .custom<number[][]>((v) => Array.isArray(v), 'Ingresa la matriz de transición.')
  .superRefine((P, ctx) => {
    const problem = transitionMatrixProblem(P);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

/** Problema de validación de una distribución de probabilidad de tamaño `size`. */
export function distributionProblem(a: unknown, size: number): string | null {
  if (!Array.isArray(a) || a.length !== size) {
    return `La distribución inicial debe tener ${size} valores, uno por estado.`;
  }
  for (let i = 0; i < size; i++) {
    const p: unknown = a[i];
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
      return `El valor ${i + 1} de la distribución inicial no es una probabilidad.`;
    }
  }
  const sum = (a as number[]).reduce((s, p) => s + p, 0);
  if (Math.abs(sum - 1) > ROW_SUM_TOLERANCE) {
    return `La distribución inicial suma ${formatNumber(sum, 6)}; debe sumar 1.`;
  }
  return null;
}

/** Filas de una tabla con la matriz: una fila por estado, columnas p_{i1} … p_{in}. */
export function matrixTable(id: string, title: string, M: number[][], symbol: string) {
  return {
    id,
    title,
    columns: [
      { key: 'state', header: '\\text{Estado}' },
      ...M.map((_, j) => ({ key: `c${j}`, header: `${symbol}_{i${j + 1}}` })),
    ],
    rows: M.map((row, i) => ({
      state: i + 1,
      ...Object.fromEntries(row.map((v, j) => [`c${j}`, v])),
    })),
  };
}

/** Limpia ruido de coma flotante: −1e−17 → 0. */
export function clean(v: number): number {
  return Math.abs(v) < 1e-14 ? 0 : v;
}
