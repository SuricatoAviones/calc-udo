/**
 * Tablas de diferencias (Chapra & Canale, sec. 18.1; Nakamura, cap. de interpolación):
 *
 *   Diferencias hacia adelante:  Δy_i = y_{i+1} − y_i,   Δᵏy_i = Δᵏ⁻¹y_{i+1} − Δᵏ⁻¹y_i
 *   Diferencias divididas:       f[x_i, x_{i+1}] = (f[x_{i+1}] − f[x_i]) / (x_{i+1} − x_i)
 *                                f[x_i, …, x_{i+k}] = (f[x_{i+1}, …, x_{i+k}] − f[x_i, …, x_{i+k−1}]) / (x_{i+k} − x_i)
 *
 * Con datos igualmente espaciados (paso h) se cumple f[x_i, …, x_{i+k}] = Δᵏy_i / (k! hᵏ). Si las
 * diferencias de orden k son constantes, los datos provienen de un polinomio de grado k.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber } from '@/lib/math/format';

export const MAX_POINTS = 30;

export interface ParsedPoints {
  x: number[];
  y: number[];
}

function listError(label: string, invalid: string[]): string {
  return `En ${label} hay valores que no son números: ${invalid
    .slice(0, 3)
    .map((t) => `«${t}»`)
    .join(', ')}.`;
}

/** Lee las listas de x y de y. Devuelve un mensaje de error (y su campo) si algo falla. */
export function parsePoints(
  xText: string,
  yText: string,
  { min = 2, max = MAX_POINTS, distinct = true } = {},
): ParsedPoints | { field: 'x' | 'y'; message: string } {
  const xs = parseDataList(xText);
  const ys = parseDataList(yText);
  if (xs.invalid.length > 0) return { field: 'x', message: listError('x', xs.invalid) };
  if (ys.invalid.length > 0) return { field: 'y', message: listError('y', ys.invalid) };
  if (xs.values.length < min)
    return { field: 'x', message: `Ingresa al menos ${min} valores de x.` };
  if (xs.values.length > max) return { field: 'x', message: `El máximo es ${max} puntos.` };
  if (ys.values.length !== xs.values.length) {
    return {
      field: 'y',
      message: `Hay ${xs.values.length} valores de x y ${ys.values.length} de y: deben ser la misma cantidad.`,
    };
  }
  if (distinct && new Set(xs.values).size !== xs.values.length) {
    return { field: 'x', message: 'Los valores de x no pueden repetirse.' };
  }
  return { x: xs.values, y: ys.values };
}

/** Paso común h si los x están igualmente espaciados (y en orden creciente), o `null`. */
export function equalSpacing(x: number[]): number | null {
  if (x.length < 2) return null;
  const h = x[1]! - x[0]!;
  if (h <= 0) return null;
  const tol = 1e-9 * Math.max(Math.abs(h), ...x.map(Math.abs));
  for (let i = 1; i < x.length; i++) {
    if (Math.abs(x[i]! - x[i - 1]! - h) > tol) return null;
  }
  return h;
}

export const pointsShape = {
  x: z.string(),
  y: z.string(),
};

/** Agrega los errores de `parsePoints` al contexto de Zod. */
export function refinePoints(
  v: { x: string; y: string },
  ctx: z.RefinementCtx,
  options?: Parameters<typeof parsePoints>[2],
): ParsedPoints | null {
  const parsed = parsePoints(v.x, v.y, options);
  if ('message' in parsed) {
    ctx.addIssue({ code: 'custom', path: [parsed.field], message: parsed.message });
    return null;
  }
  return parsed;
}

export const SPACING_MESSAGE =
  'Las diferencias hacia adelante necesitan x igualmente espaciados y en orden creciente.';

/** Niveles de la tabla de diferencias hacia adelante: [y, Δy, Δ²y, …]. */
export function forwardDifferences(y: number[]): number[][] {
  const levels = [y];
  while (levels.at(-1)!.length > 1) {
    const prev = levels.at(-1)!;
    levels.push(prev.slice(1).map((v, i) => v - prev[i]!));
  }
  return levels;
}

/** Niveles de la tabla de diferencias divididas: [f[x_i], f[x_i, x_{i+1}], …]. */
export function dividedDifferences(x: number[], y: number[]): number[][] {
  const levels = [y];
  for (let k = 1; k < x.length; k++) {
    const prev = levels.at(-1)!;
    levels.push(prev.slice(1).map((v, i) => (v - prev[i]!) / (x[i + k]! - x[i]!)));
  }
  return levels;
}

/**
 * Orden a partir del cual las diferencias son constantes (dentro del redondeo), o `null`. Solo se
 * informa si quedan al menos dos valores constantes, para que no sea trivial.
 */
export function constantOrder(levels: number[][]): number | null {
  const scale = Math.max(1e-300, ...levels[0]!.map(Math.abs));
  for (let k = 1; k < levels.length; k++) {
    const level = levels[k]!;
    if (level.length < 2) return null;
    const first = level[0]!;
    if (level.every((v) => Math.abs(v - first) <= 1e-9 * scale)) return k;
  }
  return null;
}

/** Nombre LaTeX de una diferencia dividida: f[x_0, x_1, x_2]. */
export function dividedName(i: number, k: number): string {
  return `f[${Array.from({ length: k + 1 }, (_, j) => `x_{${i + j}}`).join(', ')}]`;
}

export function forwardName(i: number, k: number): string {
  if (k === 0) return `y_{${i}}`;
  return `\\Delta${k === 1 ? '' : `^{${k}}`} y_{${i}}`;
}

export function describeSpacing(h: number): string {
  return `Los x están igualmente espaciados con h = ${formatNumber(h)}.`;
}
