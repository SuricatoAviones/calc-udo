/**
 * Álgebra lineal básica para las calculadoras: producto de matrices, vector por matriz y
 * solución de sistemas por eliminación de Gauss con pivoteo parcial (Chapra & Canale, cap. 9).
 * Todas las funciones son puras y no modifican sus argumentos.
 */

export type Matrix = number[][];
export type Vector = number[];

export function identity(size: number): Matrix {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i === j ? 1 : 0)),
  );
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  const rows = a.length;
  const inner = b.length;
  const cols = b[0]?.length ?? 0;
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => {
      let sum = 0;
      for (let k = 0; k < inner; k++) sum += a[i]![k]! * b[k]![j]!;
      return sum;
    }),
  );
}

/** Vector fila por matriz: (vA)_j = Σ_i v_i A_ij. */
export function vectorTimesMatrix(v: Vector, a: Matrix): Vector {
  const cols = a[0]?.length ?? 0;
  return Array.from({ length: cols }, (_, j) => v.reduce((sum, vi, i) => sum + vi * a[i]![j]!, 0));
}

/** Umbral bajo el cual un pivote se considera cero (sistema singular). */
const PIVOT_EPSILON = 1e-12;

/**
 * Resuelve A x = b por eliminación de Gauss con pivoteo parcial y sustitución hacia atrás.
 * Devuelve `null` si el sistema es singular (no tiene solución única).
 */
export function solveLinearSystem(a: Matrix, b: Vector): Vector | null {
  const size = a.length;
  const m = a.map((row, i) => [...row, b[i]!]);

  for (let col = 0; col < size; col++) {
    // Pivoteo parcial: la fila con el mayor |valor| en esta columna pasa a ser la del pivote.
    let pivotRow = col;
    for (let r = col + 1; r < size; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivotRow]![col]!)) pivotRow = r;
    }
    if (Math.abs(m[pivotRow]![col]!) < PIVOT_EPSILON) return null;
    [m[col], m[pivotRow]] = [m[pivotRow]!, m[col]!];

    for (let r = col + 1; r < size; r++) {
      const factor = m[r]![col]! / m[col]![col]!;
      for (let c = col; c <= size; c++) m[r]![c]! -= factor * m[col]![c]!;
    }
  }

  const x = new Array<number>(size).fill(0);
  for (let i = size - 1; i >= 0; i--) {
    let sum = m[i]![size]!;
    for (let j = i + 1; j < size; j++) sum -= m[i]![j]! * x[j]!;
    x[i] = sum / m[i]![i]!;
  }
  return x;
}
