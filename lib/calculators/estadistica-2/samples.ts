/**
 * Muestras escritas por el estudiante (listas de números) y sus medidas básicas, comunes a las
 * calculadoras de Estadísticas II.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';

export const MAX_SAMPLE = 1000;

/** Lista de números o un mensaje de error. */
export function parseSample(
  text: string | undefined,
  min = 2,
  label = 'la muestra',
): number[] | string {
  const { values, invalid } = parseDataList(text ?? '');
  if (invalid.length > 0) {
    return `En ${label} hay valores que no son números: ${invalid
      .slice(0, 3)
      .map((t) => `«${t}»`)
      .join(', ')}.`;
  }
  if (values.length < min) return `Ingresa al menos ${min} datos en ${label}.`;
  if (values.length > MAX_SAMPLE) return `El máximo es ${MAX_SAMPLE} datos.`;
  return values;
}

/** Agrega el error de `parseSample` al campo `path`, o devuelve los valores. */
export function refineSample(
  text: string | undefined,
  path: string,
  ctx: z.RefinementCtx,
  min = 2,
  label?: string,
): number[] | null {
  const parsed = parseSample(text, min, label);
  if (typeof parsed === 'string') {
    ctx.addIssue({ code: 'custom', path: [path], message: parsed });
    return null;
  }
  return parsed;
}

export function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Varianza muestral (divisor n − 1). */
export function sampleVariance(values: number[]): number {
  const m = mean(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

export const positive = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine((v) => Number.isFinite(v) && v > 0, `${label} debe ser mayor que 0.`);

export const finite = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`);

export const sampleSize = (label = 'el tamaño de la muestra n') =>
  z
    .number({ error: `Ingresa ${label}.` })
    .int(`${label} debe ser un número entero.`)
    .min(2, 'La muestra debe tener al menos 2 datos.')
    .max(1_000_000, 'El tamaño de la muestra es demasiado grande.');

/**
 * Promedio de rangos con empates (Walpole, sec. 16.2): a los valores repetidos se les asigna el
 * promedio de las posiciones que ocupan. Devuelve el rango de cada valor en el orden original.
 */
export function averageRanks(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let k = 0;
  while (k < order.length) {
    let end = k;
    while (end + 1 < order.length && order[end + 1]!.v === order[k]!.v) end++;
    const average = (k + 1 + end + 1) / 2;
    for (let j = k; j <= end; j++) ranks[order[j]!.i] = average;
    k = end + 1;
  }
  return ranks;
}
