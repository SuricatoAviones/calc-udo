/**
 * Piezas comunes de los modelos de programación dinámica determinística (Taha, cap. 10; Hillier
 * & Lieberman, cap. 10 de la 9.ª ed.): la tabla de cada etapa (estados × alternativas) y la
 * presentación de la ecuación recursiva.
 */
import { toLatexNumber } from '@/lib/math/format';
import type { CellValue, ResultTable } from '../types';

const n = toLatexNumber;

export interface StageRow {
  /** Estado de la etapa, tal como se muestra en la tabla. */
  state: string;
  /** Valor de cada alternativa factible, por clave de la alternativa. */
  values: Map<string, number>;
  best: number;
  /** Alternativas óptimas (varias si hay empate). */
  argBest: string[];
}

/**
 * Tabla de una etapa en el formato de los libros: una fila por estado, una columna por
 * alternativa (— si no es factible), el valor óptimo y la decisión óptima.
 */
export function stageTable(options: {
  id: string;
  title: string;
  stateHeader: string;
  decisions: { key: string; header: string }[];
  rows: StageRow[];
  bestHeader: string;
  argHeader: string;
}): ResultTable {
  const { decisions, rows } = options;
  return {
    id: options.id,
    title: options.title,
    columns: [
      { key: 'state', header: options.stateHeader, format: 'text' },
      ...decisions.map((d) => ({ key: `d:${d.key}`, header: d.header })),
      { key: 'best', header: options.bestHeader },
      { key: 'arg', header: options.argHeader, format: 'text' },
    ],
    rows: rows.map((row) => {
      const cells: Record<string, CellValue> = { state: row.state };
      for (const d of decisions) cells[`d:${d.key}`] = row.values.get(d.key) ?? null;
      cells.best = row.best;
      cells.arg = row.argBest.join(' o ');
      return cells;
    }),
  };
}

/** `\min\{7,\ 9,\ 10\}` o `\max\{…\}`; con una sola alternativa, el número solo. */
export function optimumLatex(kind: 'min' | 'max', values: number[]): string {
  if (values.length === 1) return n(values[0]!);
  return `\\${kind}\\{${values.map((v) => n(v)).join(',\\ ')}\\}`;
}

/** Índices de los valores óptimos (con tolerancia para empates de coma flotante). */
export function argOptimum(kind: 'min' | 'max', values: number[]): number[] {
  const best = kind === 'min' ? Math.min(...values) : Math.max(...values);
  const tol = 1e-9 * Math.max(1, Math.abs(best));
  return values.flatMap((v, k) => (Math.abs(v - best) <= tol ? [k] : []));
}
