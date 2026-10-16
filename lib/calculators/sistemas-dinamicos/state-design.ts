/**
 * Análisis y diseño en el espacio de estados (Ogata, 3.ª ed., sec. 11-6, 11-7 y 12-2):
 *
 *   controlabilidad:     M = [B | AB | ⋯ | Aⁿ⁻¹B] de rango n
 *   observabilidad:      N = [C; CA; ⋯; CAⁿ⁻¹] de rango n (Ogata escribe la transpuesta
 *                        [C* | A*C* | ⋯ | (A*)ⁿ⁻¹C*], que tiene el mismo rango)
 *   ubicación de polos:  K = [0 ⋯ 0 1] M⁻¹ φ(A)   (fórmula de Ackermann, ec. 12-18)
 *
 * El rango se obtiene por eliminación de Gauss con fracciones exactas, así una fila que se anula
 * es exactamente cero.
 */
import { evaluate } from 'mathjs';
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import { snap, type Poly } from '@/lib/math/polynomials';
import { Rational } from '@/lib/math/rational';

export type Matrix = number[][];

export function identity(n: number): Matrix {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
}

export function matMul(a: Matrix, b: Matrix): Matrix {
  return a.map((row) => b[0]!.map((_, j) => row.reduce((s, v, k) => s + v * b[k]![j]!, 0)));
}

export function matAdd(a: Matrix, b: Matrix, k = 1): Matrix {
  return a.map((row, i) => row.map((v, j) => v + k * b[i]![j]!));
}

export function tidyMatrix(m: Matrix): Matrix {
  const scale = Math.max(1e-300, ...m.flat().map(Math.abs));
  return m.map((row) => row.map((v) => (Math.abs(v) <= 1e-12 * scale ? 0 : snap(v))));
}

/** [B | AB | ⋯ | Aⁿ⁻¹B] y los bloques AᵏB. */
export function controllabilityMatrix(A: Matrix, B: Matrix): { matrix: Matrix; blocks: Matrix[] } {
  const n = A.length;
  const blocks: Matrix[] = [B];
  for (let k = 1; k < n; k++) blocks.push(tidyMatrix(matMul(A, blocks[k - 1]!)));
  const matrix = A.map((_, i) => blocks.flatMap((b) => b[i]!));
  return { matrix, blocks };
}

/** [C; CA; ⋯; CAⁿ⁻¹] y los bloques CAᵏ. */
export function observabilityMatrix(A: Matrix, Cm: Matrix): { matrix: Matrix; blocks: Matrix[] } {
  const n = A.length;
  const blocks: Matrix[] = [Cm];
  for (let k = 1; k < n; k++) blocks.push(tidyMatrix(matMul(blocks[k - 1]!, A)));
  return { matrix: blocks.flat(), blocks };
}

export interface RankResult {
  rank: number;
  /** Forma escalonada (en números). */
  echelon: Matrix;
  /** Determinante si la matriz es cuadrada. */
  determinant: number | null;
}

/** Rango por eliminación de Gauss con fracciones exactas. */
export function rank(m: Matrix): RankResult {
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  const a = m.map((row) => row.map((v) => Rational.fromNumber(v)));
  let r = 0;
  let det = Rational.ONE;
  let swaps = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let pivot = -1;
    for (let i = r; i < rows; i++) {
      if (!a[i]![c]!.isZero()) {
        pivot = i;
        break;
      }
    }
    if (pivot < 0) continue;
    if (pivot !== r) {
      [a[pivot], a[r]] = [a[r]!, a[pivot]!];
      swaps++;
    }
    const p = a[r]![c]!;
    det = det.mul(p);
    for (let i = r + 1; i < rows; i++) {
      const f = a[i]![c]!.div(p);
      if (f.isZero()) continue;
      a[i] = a[i]!.map((v, j) => v.sub(f.mul(a[r]![j]!)));
    }
    r++;
  }
  const square = rows === cols;
  return {
    rank: r,
    echelon: a.map((row) => row.map((v) => v.toNumber())),
    determinant: square ? (r < rows ? 0 : (swaps % 2 ? -1 : 1) * det.toNumber()) : null,
  };
}

/** Inversa por Gauss-Jordan (null si es singular). */
export function inverse(m: Matrix): Matrix | null {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...identity(n)[i]!]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(a[i]![c]!) > Math.abs(a[pivot]![c]!)) pivot = i;
    if (Math.abs(a[pivot]![c]!) < 1e-12 * Math.max(1, ...m.flat().map(Math.abs))) return null;
    [a[pivot], a[c]] = [a[c]!, a[pivot]!];
    const p = a[c]![c]!;
    a[c] = a[c]!.map((v) => v / p);
    for (let i = 0; i < n; i++) {
      if (i === c) continue;
      const f = a[i]![c]!;
      if (f !== 0) a[i] = a[i]!.map((v, j) => v - f * a[c]![j]!);
    }
  }
  return tidyMatrix(a.map((row) => row.slice(n)));
}

/** φ(A) = Aⁿ + α₁Aⁿ⁻¹ + ⋯ + αₙI con los coeficientes de un polinomio mónico. */
export function polyOfMatrix(p: Poly, A: Matrix): Matrix {
  const n = A.length;
  let result: Matrix = A.map(() => Array<number>(n).fill(0));
  for (const c of p) result = matAdd(matMul(result, A), identity(n), c);
  return tidyMatrix(result);
}

/** Polinomio mónico con las raíces dadas (las complejas deben venir en pares conjugados). */
export function polyFromComplexRoots(roots: Complex[]): Poly {
  let p: Complex[] = [C.ONE];
  for (const r of roots) {
    const next: Complex[] = Array.from({ length: p.length + 1 }, () => C.ZERO);
    p.forEach((c, i) => {
      next[i] = C.add(next[i]!, c);
      next[i + 1] = C.sub(next[i + 1]!, C.mul(c, r));
    });
    p = next;
  }
  return p.map((c) => snap(c.re));
}

export type ComplexListResult = { ok: true; values: Complex[] } | { ok: false; message: string };

/** Lista de números complejos con la unidad j o i: «−2 + 4j, −2 − j4, −10». */
export function parseComplexList(text: string): ComplexListResult {
  const tokens = text
    .split(/[;,\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0)
    return { ok: false, message: 'Escribe los polos deseados separados por comas.' };
  const values: Complex[] = [];
  for (const token of tokens) {
    const source = token
      .replace(/−/g, '-')
      .replace(/\s+/g, '')
      .replace(/[ji]([\d.]+)/g, '$1i')
      .replace(/j/g, 'i');
    if (!/^[-+\d.ei()*]+$/.test(source))
      return { ok: false, message: `«${token}» no es un número complejo.` };
    let value: unknown;
    try {
      value = evaluate(source);
    } catch {
      return { ok: false, message: `«${token}» no es un número complejo.` };
    }
    if (typeof value === 'number' && Number.isFinite(value)) values.push(C.complex(value));
    else if (value && typeof value === 'object' && 're' in value && 'im' in value) {
      const z = value as { re: number; im: number };
      if (!Number.isFinite(z.re) || !Number.isFinite(z.im))
        return { ok: false, message: `«${token}» no es un número.` };
      values.push(C.complex(z.re, z.im));
    } else return { ok: false, message: `«${token}» no es un número complejo.` };
  }
  return { ok: true, values };
}

/** ¿Los complejos vienen en pares conjugados (para que K sea real)? */
export function hasConjugatePairs(values: Complex[]): boolean {
  const pending = values.filter((v) => Math.abs(v.im) > 1e-9);
  const used = new Set<number>();
  for (let i = 0; i < pending.length; i++) {
    if (used.has(i)) continue;
    const j = pending.findIndex(
      (w, k) =>
        k !== i &&
        !used.has(k) &&
        Math.abs(w.re - pending[i]!.re) < 1e-9 &&
        Math.abs(w.im + pending[i]!.im) < 1e-9,
    );
    if (j < 0) return false;
    used.add(i).add(j);
  }
  return true;
}
