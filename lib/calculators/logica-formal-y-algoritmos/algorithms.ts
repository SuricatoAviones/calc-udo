/**
 * Piezas comunes de las trazas de búsqueda y ordenamiento: la lista de entrada, su LaTeX y el
 * pseudocódigo al estilo de Tucker y Joyanes (palabras reservadas en negrita, arreglos desde 1).
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { latexLines, toLatexNumber } from '@/lib/math/format';

/** Lista de números escrita por el estudiante (espacios, punto y coma o coma y espacio). */
export const listField = (min: number, max: number) =>
  z.string({ error: 'Escribe la lista.' }).superRefine((text, ctx) => {
    const { values, invalid } = parseDataList(text);
    if (invalid.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `No son números: ${invalid
          .slice(0, 3)
          .map((t) => `«${t}»`)
          .join(', ')}. Separa los datos con espacios, punto y coma o coma y espacio.`,
      });
    } else if (values.length < min) {
      ctx.addIssue({ code: 'custom', message: `Escribe al menos ${min} números.` });
    } else if (values.length > max) {
      ctx.addIssue({ code: 'custom', message: `Usa a lo sumo ${max} números.` });
    }
  });

export const num = (x: number) => toLatexNumber(x);

/**
 * Lista en LaTeX. `bold` resalta posiciones (desde 0), p. ej. la parte ya ordenada; `boxed`
 * encierra una posición, p. ej. el elemento que se compara.
 */
export function listLatex(
  values: number[],
  options: { bold?: (i: number) => boolean; boxed?: number[] } = {},
): string {
  const items = values.map((v, i) => {
    let tex = num(v);
    if (options.bold?.(i)) tex = `\\mathbf{${tex}}`;
    if (options.boxed?.includes(i)) tex = `\\boxed{${tex}}`;
    return tex;
  });
  return `\\left[\\,${items.join(',\\ ')}\\,\\right]`;
}

/**
 * Pseudocódigo en LaTeX: cada renglón con su sangría (número de niveles) y las palabras
 * reservadas escritas como `**si**`, que se pasan a negrita.
 */
export function pseudocode(lines: [number, string][]): string {
  return latexLines(
    lines.map(([indent, text]) => {
      const body = text
        .split(/(\*\*[^*]+\*\*)/)
        .filter((part) => part !== '')
        .map((part) => (part.startsWith('**') ? `\\textbf{${part.slice(2, -2)}}` : part))
        .join('\\ ');
      return `${'\\quad '.repeat(indent)}${body}`;
    }),
  );
}
