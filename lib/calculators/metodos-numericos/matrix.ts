/**
 * Piezas comunes de las calculadoras de matrices y sistemas lineales (Chapra & Canale, parte 3,
 * cap. 9): validación de matrices escritas en el formulario, LaTeX de matrices aumentadas y la
 * eliminación hacia adelante con la traza de cada operación de fila.
 *
 * Eliminación hacia adelante (sec. 9.2.1): para cada columna k se elimina a_{ik} (i > k) con
 *
 *   f_{ik} = a_{ik} / a_{kk},     R_i ← R_i − f_{ik} R_k
 *
 * Con pivoteo parcial (sec. 9.4.2), antes de eliminar se intercambia la fila k con la que tenga
 * el mayor |a_{ik}| en la columna. Cada intercambio cambia el signo del determinante (cuadro 9.1):
 *
 *   det A = (−1)^p · a_{11} a_{22} ⋯ a_{nn}      (matriz triangular superior, p intercambios)
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import type { Latex, Step } from '../types';

export type Matrix = number[][];

/** Cifras significativas con que se muestran las entradas de las matrices en los pasos. */
export const MATRIX_DIGITS = 6;

const n = (v: number) => toLatexNumber(v, MATRIX_DIGITS);
const op = (v: number) => toLatexOperand(v, MATRIX_DIGITS);

/**
 * Schema de una matriz escrita en el formulario: filas del mismo largo, entradas finitas.
 * `square` exige n × n; `augmented` exige n × (n + 1) (un sistema [A | b]).
 */
export function matrixSchema(
  label: string,
  {
    minRows = 1,
    maxRows = 8,
    maxCols = 8,
    shape = 'any',
  }: {
    minRows?: number;
    maxRows?: number;
    maxCols?: number;
    shape?: 'any' | 'square' | 'augmented';
  } = {},
) {
  return z.array(z.array(z.number())).superRefine((m, ctx) => {
    const rows = m.length;
    const cols = m[0]?.length ?? 0;
    if (rows < minRows || rows > maxRows) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} debe tener entre ${minRows} y ${maxRows} filas.`,
      });
      return;
    }
    if (cols < 1 || cols > maxCols || m.some((row) => row.length !== cols)) {
      ctx.addIssue({
        code: 'custom',
        message: `Todas las filas de ${label} deben tener entre 1 y ${maxCols} columnas.`,
      });
      return;
    }
    if (shape === 'square' && cols !== rows) {
      ctx.addIssue({ code: 'custom', message: `${label} debe ser cuadrada.` });
      return;
    }
    if (shape === 'augmented' && cols !== rows + 1) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} debe tener una columna más que filas: los coeficientes y el lado derecho.`,
      });
      return;
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (!Number.isFinite(m[i]![j]!)) {
          ctx.addIssue({
            code: 'custom',
            path: [i, j],
            message: `La entrada de la fila ${i + 1}, columna ${j + 1} de ${label} no es un número.`,
          });
          return;
        }
      }
    }
  });
}

export function cloneMatrix(m: Matrix): Matrix {
  return m.map((row) => [...row]);
}

/** Matriz → LaTeX entre corchetes. */
export function texMatrix(m: Matrix, digits = MATRIX_DIGITS): Latex {
  const rows = m.map((row) => row.map((v) => toLatexNumber(v, digits)).join(' & '));
  return `\\begin{bmatrix} ${rows.join(' \\\\ ')} \\end{bmatrix}`;
}

/** Determinante escrito con barras: `\begin{vmatrix} … \end{vmatrix}`. */
export function texDeterminant(m: Matrix, digits = MATRIX_DIGITS): Latex {
  const rows = m.map((row) => row.map((v) => toLatexNumber(v, digits)).join(' & '));
  return `\\begin{vmatrix} ${rows.join(' \\\\ ')} \\end{vmatrix}`;
}

/**
 * Matriz aumentada con una línea vertical antes de las últimas `extra` columnas: [A | b] o
 * [A | I].
 */
export function texAugmented(m: Matrix, extra: number, digits = MATRIX_DIGITS): Latex {
  const cols = m[0]?.length ?? 0;
  const spec = `${'c'.repeat(cols - extra)}|${'c'.repeat(extra)}`;
  const rows = m.map((row) => row.map((v) => toLatexNumber(v, digits)).join(' & '));
  return `\\left[\\begin{array}{${spec}} ${rows.join(' \\\\ ')} \\end{array}\\right]`;
}

/** Umbral relativo bajo el cual un pivote se considera cero. */
const PIVOT_EPSILON = 1e-12;

/** Escala de la matriz: el mayor |a_ij|, para decidir si un pivote es "cero". */
export function matrixScale(m: Matrix): number {
  return Math.max(1e-300, ...m.flatMap((row) => row.map(Math.abs)));
}

export function isNegligible(value: number, scale: number): boolean {
  return Math.abs(value) <= PIVOT_EPSILON * scale;
}

export interface EliminationOptions {
  /** Columnas donde se buscan pivotes (las de A; en [A | b] no se pivotea sobre b). */
  pivotColumns: number;
  pivoting: boolean;
  /** Columnas separadas por una línea al mostrar la matriz (1 para [A | b]). */
  augmentedColumns: number;
}

export interface EliminationResult {
  steps: Step[];
  /** Matriz triangular superior (y su lado derecho, si lo hay). */
  upper: Matrix;
  /** Intercambios de filas realizados. */
  swaps: number;
  /** Columna (base 0) en la que no hubo pivote distinto de cero, o `null`. */
  zeroPivotColumn: number | null;
  /** Matriz después de cada etapa, para las tablas. */
  stages: Matrix[];
}

/** Matriz aumentada o simple, según `augmentedColumns`. */
function show(m: Matrix, augmentedColumns: number): Latex {
  return augmentedColumns > 0 ? texAugmented(m, augmentedColumns) : texMatrix(m);
}

/**
 * Eliminación hacia adelante con la traza de cada etapa. Si una columna no tiene pivote distinto
 * de cero, se detiene ahí (`zeroPivotColumn`) y devuelve los pasos hechos hasta ese momento; sin
 * pivoteo se detiene en cuanto el pivote de la diagonal es cero.
 */
export function forwardElimination(input: Matrix, options: EliminationOptions): EliminationResult {
  const m = cloneMatrix(input);
  const size = Math.min(options.pivotColumns, m.length);
  const scale = matrixScale(input);
  const steps: Step[] = [];
  const stages: Matrix[] = [];
  let swaps = 0;

  // En la última columna solo se revisa que el pivote no sea cero (matriz singular).
  for (let k = 0; k < size; k++) {
    const children: Step[] = [];

    if (options.pivoting) {
      let best = k;
      for (let r = k + 1; r < m.length; r++) {
        if (Math.abs(m[r]![k]!) > Math.abs(m[best]![k]!)) best = r;
      }
      const candidates = m
        .slice(k)
        .map((row, r) => `|a_{${k + r + 1}${k + 1}}| = ${n(Math.abs(row[k]!))}`)
        .join(',\\ ');
      if (best !== k) {
        [m[k], m[best]] = [m[best]!, m[k]!];
        swaps++;
        children.push({
          title: `Pivoteo parcial: intercambiar R${k + 1} y R${best + 1}`,
          explanation: `En la columna ${k + 1}, el mayor valor absoluto desde la fila ${k + 1} hacia abajo está en la fila ${best + 1}. Se usa como pivote para reducir el error de redondeo.`,
          substitution: candidates,
          result: `R_{${k + 1}} \\leftrightarrow R_{${best + 1}}:\\quad ${show(m, options.augmentedColumns)}`,
        });
      } else if (k < m.length - 1) {
        children.push({
          title: 'Pivoteo parcial: no hace falta intercambiar',
          explanation: `El mayor valor absoluto de la columna ${k + 1} ya está en la fila del pivote.`,
          substitution: candidates,
        });
      }
    }

    const pivot = m[k]![k]!;
    if (isNegligible(pivot, scale)) {
      if (children.length > 0) steps.push({ title: `Columna ${k + 1}`, children });
      return { steps, upper: m, swaps, zeroPivotColumn: k, stages };
    }
    if (k === size - 1) break;

    for (let i = k + 1; i < m.length; i++) {
      const a = m[i]![k]!;
      if (a === 0) {
        children.push({
          title: `Fila ${i + 1}: ya tiene un cero en la columna ${k + 1}`,
          result: `a_{${i + 1}${k + 1}} = 0`,
        });
        continue;
      }
      const factor = a / pivot;
      for (let c = k; c < m[i]!.length; c++) m[i]![c]! -= factor * m[k]![c]!;
      m[i]![k] = 0; // exacto: evita residuos de redondeo bajo la diagonal
      children.push({
        title: `Eliminar a${sub(i + 1, k + 1)} con la fila ${k + 1}`,
        formula: `f_{${i + 1}${k + 1}} = \\frac{a_{${i + 1}${k + 1}}}{a_{${k + 1}${k + 1}}}, \\qquad R_{${i + 1}} \\leftarrow R_{${i + 1}} - f_{${i + 1}${k + 1}}\\,R_{${k + 1}}`,
        substitution: `f_{${i + 1}${k + 1}} = \\frac{${n(a)}}{${n(pivot)}} = ${n(factor)}`,
        result: `R_{${i + 1}} = (${m[i]!.map((v) => n(v)).join(',\\ ')})`,
      });
    }
    stages.push(cloneMatrix(m));
    steps.push({
      title: `Eliminación en la columna ${k + 1} (pivote a${sub(k + 1, k + 1)} = ${formatNumber(m[k]![k]!, MATRIX_DIGITS)})`,
      children,
      result: show(m, options.augmentedColumns),
    });
  }
  return { steps, upper: m, swaps, zeroPivotColumn: null, stages };
}

/** Número en subíndices Unicode, para títulos en texto plano: 12 → `₁₂`. */
export function subscript(v: number): string {
  return String(v).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]!);
}

function sub(i: number, j: number): string {
  return `${subscript(i)}${subscript(j)}`;
}

/** Producto de la diagonal con el signo de los intercambios, con su paso. */
export function determinantFromUpper(upper: Matrix, swaps: number): { value: number; step: Step } {
  const size = upper.length;
  const diagonal = upper.map((row, i) => row[i]!);
  const product = diagonal.reduce((p, v) => p * v, 1);
  const value = (swaps % 2 === 0 ? 1 : -1) * product;
  return {
    value,
    step: {
      title: 'Determinante: producto de la diagonal',
      explanation:
        swaps === 0
          ? 'El determinante de una matriz triangular es el producto de su diagonal, y la eliminación (restar a una fila un múltiplo de otra) no lo cambia.'
          : `El determinante de una matriz triangular es el producto de su diagonal. La eliminación no lo cambia, pero cada uno de los ${swaps} intercambio(s) de filas le cambia el signo: se multiplica por (−1)^${swaps}.`,
      formula: `\\det A = (-1)^{p}\\, a_{11} a_{22} \\cdots a_{${size}${size}}`,
      substitution: `\\det A = ${swaps === 0 ? '' : `(-1)^{${swaps}}\\,`}${diagonal.map((v) => `(${n(v)})`).join('')}`,
      result: `\\det A = ${n(value)}`,
    },
  };
}

/** Sustitución hacia atrás sobre [U | b], con un paso por incógnita (Chapra, ec. 9.12 y 9.13). */
export function backSubstitution(upper: Matrix): { x: number[]; steps: Step[] } {
  const size = upper.length;
  const x = new Array<number>(size).fill(0);
  const steps: Step[] = [];
  for (let i = size - 1; i >= 0; i--) {
    const row = upper[i]!;
    const b = row[size]!;
    const terms: { j: number; a: number }[] = [];
    let sum = b;
    for (let j = i + 1; j < size; j++) {
      sum -= row[j]! * x[j]!;
      terms.push({ j, a: row[j]! });
    }
    x[i] = sum / row[i]!;
    const idx = i + 1;
    const formula =
      terms.length === 0
        ? `x_{${idx}} = \\frac{b_{${idx}}}{a_{${idx}${idx}}}`
        : `x_{${idx}} = \\frac{b_{${idx}} - ${terms.map(({ j }) => `a_{${idx}${j + 1}}x_{${j + 1}}`).join(' - ')}}{a_{${idx}${idx}}}`;
    const numerator =
      terms.length === 0
        ? n(b)
        : `${n(b)} - ${terms.map(({ j, a }) => `${op(a)}${op(x[j]!)}`).join(' - ')}`;
    steps.push({
      title: `Despejar x${subscript(idx)}`,
      formula,
      substitution: `x_{${idx}} = \\frac{${numerator}}{${n(row[i]!)}}`,
      result: `x_{${idx}} = ${n(x[i]!)}`,
    });
  }
  return { x, steps };
}

/** Producto A·x, para comprobar la solución. */
export function matVec(a: Matrix, x: number[]): number[] {
  return a.map((row) => row.reduce((s, v, j) => s + v * (x[j] ?? 0), 0));
}
