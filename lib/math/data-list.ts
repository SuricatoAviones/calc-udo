/**
 * Lista de datos escrita o pegada por el estudiante → números.
 *
 * Separadores: espacios, saltos de línea, punto y coma, y coma seguida de espacio ("3, 4, 5").
 * Una coma sin espacio es coma decimal ("0,5"), como se escribe en Venezuela. Así
 * "3, 4, 5" y "0,5; 1,2" funcionan; "1,2,3" es ambiguo y se rechaza.
 */
import { parseDecimal } from './format';

export interface ParsedDataList {
  values: number[];
  /** Fragmentos que no son números, en el orden en que aparecen. */
  invalid: string[];
}

export function parseDataList(text: string): ParsedDataList {
  const tokens = text
    .split(/[\s;]+|,(?=\s)/)
    .map((t) => t.trim())
    .filter((t) => t !== '' && t !== ',');
  const values: number[] = [];
  const invalid: string[] = [];
  for (const token of tokens) {
    const value = parseDecimal(token);
    if (Number.isNaN(value)) invalid.push(token);
    else values.push(value);
  }
  return { values, invalid };
}
