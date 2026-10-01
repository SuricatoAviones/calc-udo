/**
 * Piezas comunes de programación no lineal (Taha, caps. 20 y 21; Hillier & Lieberman, cap. 13):
 * funciones de varias variables x1, …, x6 escritas por el estudiante, gradiente y matriz hessiana
 * simbólicos, clasificación de matrices por sus menores, el método de Newton para sistemas y la
 * lectura de restricciones («2x1 + x2 <= 5»).
 */
import { derivative, type MathNode } from 'mathjs';
import { expressionFromNode, parseFunction, type ParsedExpression } from '@/lib/math/expression';
import { formatNumber, toLatexNumber } from '@/lib/math/format';

export const MAX_NLP_VARIABLES = 6;
export const NLP_VARIABLES = Array.from({ length: MAX_NLP_VARIABLES }, (_, i) => `x${i + 1}`);

export const NLP_HINT =
  'Usa x1, x2, … como variables y * o un espacio entre dos variables (x1*x2 o x1 x2). Ej.: x1 + 2x3 + x2*x3 - x1^2.';

/** Nombres x1 … xn y su LaTeX. */
export const variableNames = (n: number) => NLP_VARIABLES.slice(0, n);
export const variableTex = (j: number) => `x_{${j + 1}}`;

export type NlpParse =
  { ok: true; expr: ParsedExpression; maxIndex: number } | { ok: false; message: string };

/** Índice más alto de las variables x1 … x6 que aparecen en el nodo (0 si ninguna). */
function highestVariable(node: MathNode): number {
  let highest = 0;
  node.traverse((child) => {
    if (child.type !== 'SymbolNode') return;
    const match = /^x(\d)$/.exec((child as unknown as { name: string }).name);
    if (match) highest = Math.max(highest, Number(match[1]));
  });
  return highest;
}

/** Función de x1 … x6. */
export function parseNlpExpression(text: string): NlpParse {
  const parsed = parseFunction(text, NLP_VARIABLES);
  if (!parsed.ok) return parsed;
  return { ok: true, expr: parsed.expr, maxIndex: highestVariable(parsed.expr.node) };
}

/** Evalúa en el punto x (x1 = x[0], …). */
export function evaluateAt(expr: ParsedExpression, x: number[]): number {
  return expr.evaluateAt(Object.fromEntries(x.map((v, j) => [`x${j + 1}`, v])));
}

/** Derivada parcial simbólica respecto de x_{j+1}. */
export function partial(expr: ParsedExpression, j: number): ParsedExpression | null {
  try {
    return expressionFromNode(derivative(expr.node, `x${j + 1}`), NLP_VARIABLES);
  } catch {
    return null;
  }
}

/** Gradiente simbólico (n componentes) o `null` si no se pudo derivar. */
export function gradientOf(expr: ParsedExpression, n: number): ParsedExpression[] | null {
  const components = Array.from({ length: n }, (_, j) => partial(expr, j));
  return components.every(Boolean) ? (components as ParsedExpression[]) : null;
}

/** Hessiana simbólica (n × n) o `null`. */
export function hessianOf(expr: ParsedExpression, n: number): ParsedExpression[][] | null {
  const gradient = gradientOf(expr, n);
  if (!gradient) return null;
  const rows = gradient.map((g) => gradientOf(g, n));
  return rows.every(Boolean) ? (rows as ParsedExpression[][]) : null;
}

export const evaluateVector = (v: ParsedExpression[], x: number[]) =>
  v.map((e) => evaluateAt(e, x));
export const evaluateMatrix = (M: ParsedExpression[][], x: number[]) =>
  M.map((row) => evaluateVector(row, x));

/** Matriz de expresiones en LaTeX. */
export function expressionMatrixTex(M: ParsedExpression[][]): string {
  return `\\begin{bmatrix} ${M.map((row) => row.map((e) => e.tex).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
}

/** Vector columna de expresiones en LaTeX. */
export function expressionVectorTex(v: ParsedExpression[]): string {
  return `\\begin{bmatrix} ${v.map((e) => e.tex).join(' \\\\ ')} \\end{bmatrix}`;
}

/** Punto (x1, …, xn) en LaTeX. */
export function pointTex(x: number[], digits = 6): string {
  return `\\left(${x.map((v) => toLatexNumber(clean(v), digits)).join(',\\ ')}\\right)`;
}

export function pointText(x: number[], digits = 6): string {
  return `(${x.map((v) => formatNumber(clean(v), digits)).join(', ')})`;
}

/** Limpia ruido de coma flotante: 1e−15 → 0, 0.49999999999999 → 0.5. */
export function clean(v: number): number {
  if (Math.abs(v) < 1e-12) return 0;
  return Number(v.toPrecision(12));
}

// ─── Álgebra lineal ─────────────────────────────────────────────────────────

/** Determinante por eliminación con pivoteo parcial. */
export function determinant(M: number[][]): number {
  const A = M.map((row) => [...row]);
  const size = A.length;
  let det = 1;
  for (let k = 0; k < size; k++) {
    let pivot = k;
    for (let i = k + 1; i < size; i++) if (Math.abs(A[i]![k]!) > Math.abs(A[pivot]![k]!)) pivot = i;
    if (Math.abs(A[pivot]![k]!) < 1e-14) return 0;
    if (pivot !== k) {
      [A[pivot], A[k]] = [A[k]!, A[pivot]!];
      det = -det;
    }
    det *= A[k]![k]!;
    for (let i = k + 1; i < size; i++) {
      const factor = A[i]![k]! / A[k]![k]!;
      for (let j = k; j < size; j++) A[i]![j]! -= factor * A[k]![j]!;
    }
  }
  return det;
}

/** Menores principales dominantes Δ₁ … Δₙ. */
export function leadingMinors(H: number[][]): number[] {
  return H.map((_, k) => determinant(H.slice(0, k + 1).map((row) => row.slice(0, k + 1))));
}

/** Todos los menores principales de orden k (submatrices con las mismas filas y columnas). */
function principalMinors(H: number[][], k: number): number[] {
  const size = H.length;
  const result: number[] = [];
  const choose = (start: number, picked: number[]) => {
    if (picked.length === k) {
      result.push(determinant(picked.map((i) => picked.map((j) => H[i]![j]!))));
      return;
    }
    for (let i = start; i < size; i++) choose(i + 1, [...picked, i]);
  };
  choose(0, []);
  return result;
}

export type Definiteness =
  | 'definida positiva'
  | 'definida negativa'
  | 'semidefinida positiva'
  | 'semidefinida negativa'
  | 'indefinida'
  | 'nula';

/**
 * Clasifica una matriz simétrica por sus menores (criterio de Sylvester): definida positiva si
 * todos los menores dominantes son positivos; definida negativa si alternan empezando negativo;
 * semidefinida si todos los menores principales de orden k tienen el signo de (−1)^k (negativa)
 * o son ≥ 0 (positiva); indefinida en otro caso.
 */
export function classifyMatrix(H: number[][], tolerance = 1e-9): Definiteness {
  const scale = Math.max(1, ...H.flat().map(Math.abs));
  const eps = (k: number) => tolerance * scale ** k;
  if (H.every((row) => row.every((v) => Math.abs(v) <= tolerance * scale))) return 'nula';
  const minors = leadingMinors(H);
  if (minors.every((d, k) => d > eps(k + 1))) return 'definida positiva';
  if (minors.every((d, k) => (k % 2 === 0 ? d < -eps(k + 1) : d > eps(k + 1)))) {
    return 'definida negativa';
  }
  let positive = true;
  let negative = true;
  for (let k = 1; k <= H.length; k++) {
    for (const d of principalMinors(H, k)) {
      if (d < -eps(k)) positive = false;
      if ((k % 2 === 1 ? -d : d) < -eps(k)) negative = false;
    }
  }
  if (positive) return 'semidefinida positiva';
  if (negative) return 'semidefinida negativa';
  return 'indefinida';
}

/** Solución de A x = b por eliminación con pivoteo parcial; `null` si es singular. */
export function solveDense(A: number[][], b: number[]): number[] | null {
  const size = A.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let k = 0; k < size; k++) {
    let pivot = k;
    for (let i = k + 1; i < size; i++) if (Math.abs(M[i]![k]!) > Math.abs(M[pivot]![k]!)) pivot = i;
    if (Math.abs(M[pivot]![k]!) < 1e-13) return null;
    [M[pivot], M[k]] = [M[k]!, M[pivot]!];
    for (let i = k + 1; i < size; i++) {
      const factor = M[i]![k]! / M[k]![k]!;
      for (let j = k; j <= size; j++) M[i]![j]! -= factor * M[k]![j]!;
    }
  }
  const x = new Array<number>(size).fill(0);
  for (let i = size - 1; i >= 0; i--) {
    let sum = M[i]![size]!;
    for (let j = i + 1; j < size; j++) sum -= M[i]![j]! * x[j]!;
    x[i] = sum / M[i]![i]!;
  }
  return x;
}

export interface NewtonIteration {
  point: number[];
  residual: number;
}

export interface NewtonResult {
  point: number[];
  iterations: NewtonIteration[];
  converged: boolean;
  /** Motivo si no convergió. */
  failure?: 'singular' | 'non-finite' | 'max-iterations';
}

/**
 * Método de Newton-Raphson para F(z) = 0 (Taha, sec. 20.1.2): z_{k+1} = z_k − J(z_k)⁻¹ F(z_k).
 * Se detiene cuando ‖F‖ y el paso son despreciables.
 */
export function newtonSystem(
  F: (z: number[]) => number[],
  J: (z: number[]) => number[][],
  start: number[],
  maxIterations = 50,
): NewtonResult {
  let z = [...start];
  const iterations: NewtonIteration[] = [];
  for (let k = 0; k < maxIterations; k++) {
    const f = F(z);
    const residual = Math.hypot(...f);
    if (!f.every(Number.isFinite))
      return { point: z, iterations, converged: false, failure: 'non-finite' };
    if (residual < 1e-12) return { point: z, iterations, converged: true };
    const step = solveDense(
      J(z),
      f.map((v) => -v),
    );
    if (!step) return { point: z, iterations, converged: false, failure: 'singular' };
    z = z.map((v, i) => v + step[i]!);
    iterations.push({ point: z, residual: Math.hypot(...F(z)) });
    const size = Math.hypot(...step);
    if (size < 1e-13 * Math.max(1, Math.hypot(...z)) && Math.hypot(...F(z)) < 1e-9) {
      return { point: z, iterations, converged: true };
    }
  }
  const residual = Math.hypot(...F(z));
  return residual < 1e-9
    ? { point: z, iterations, converged: true }
    : { point: z, iterations, converged: false, failure: 'max-iterations' };
}

// ─── Restricciones ──────────────────────────────────────────────────────────

export type ConstraintRelation = '<=' | '>=' | '=';

export interface NlpConstraint {
  /** Texto original de la línea. */
  source: string;
  relation: ConstraintRelation;
  /** g(x) = lado izquierdo − lado derecho; la restricción es g(x) (≤, ≥, =) 0. */
  g: ParsedExpression;
  /** «2x_1 + x_2 \le 5» como la escribió el estudiante. */
  tex: string;
  maxIndex: number;
}

export const relationTex: Record<ConstraintRelation, string> = {
  '<=': '\\le',
  '>=': '\\ge',
  '=': '=',
};

/** Una restricción «lhs <= rhs», «lhs >= rhs» o «lhs = rhs». */
export function parseNlpConstraint(line: string): NlpConstraint | string {
  const text = line.trim().replace(/[−–—]/g, '-').replace(/≤|=</g, '<=').replace(/≥|=>/g, '>=');
  const match = /^(.*?)(<=|>=|=)(.*)$/.exec(text);
  if (!match) return 'falta el signo de la restricción (<=, >= o =)';
  const [, left = '', relation, right = ''] = match;
  if (/[<>=]/.test(right)) return 'usa un solo signo por restricción';
  const lhs = parseNlpExpression(left);
  if (!lhs.ok) return `lado izquierdo: ${lhs.message}`;
  const rhs = parseNlpExpression(right);
  if (!rhs.ok) return `lado derecho: ${rhs.message}`;
  const g = parseNlpExpression(`(${left}) - (${right})`);
  if (!g.ok) return g.message;
  return {
    source: line.trim(),
    relation: relation as ConstraintRelation,
    g: g.expr,
    tex: `${lhs.expr.tex} ${relationTex[relation as ConstraintRelation]} ${rhs.expr.tex}`,
    maxIndex: Math.max(lhs.maxIndex, rhs.maxIndex),
  };
}

/** Lista de restricciones (una por línea) o el primer error con su número de línea. */
export function parseConstraintList(text: string): NlpConstraint[] | string {
  const lines = text
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
  const constraints: NlpConstraint[] = [];
  for (const [index, line] of lines.entries()) {
    const parsed = parseNlpConstraint(line);
    if (typeof parsed === 'string') return `Restricción ${index + 1}: ${parsed}.`;
    constraints.push(parsed);
  }
  return constraints;
}

/** Lista de números «1, 2, 0» o «1; 2; 0». */
export function parsePoint(text: string, size: number): number[] | string {
  const tokens = text
    .replace(/[()]/g, ' ')
    .split(/[\s;]+|,(?=\s)/)
    .map((t) => t.trim())
    .filter((t) => t !== '' && t !== ',');
  const values = tokens.map((t) => Number(t.replace(',', '.')));
  if (values.some((v) => !Number.isFinite(v))) return 'el punto debe tener solo números';
  if (values.length !== size) {
    return `el punto debe tener ${size} coordenada${size === 1 ? '' : 's'} (x1 … x${size})`;
  }
  return values;
}
