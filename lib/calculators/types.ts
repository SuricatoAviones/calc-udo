/**
 * Contrato común de calculadoras (ver docs/ARQUITECTURA.md y ADR-003).
 *
 * Toda calculadora exporta un `Calculator`. La lógica es pura y la UI es genérica: el layout,
 * la lista de pasos, las tablas y las gráficas se dibujan a partir de estos tipos, sin código
 * específico por calculadora.
 */
import type { z } from 'zod';
import type { BibliographyId } from '@/data/bibliography';

/** Cadena LaTeX lista para KaTeX (sin delimitadores `$`). */
export type Latex = string;

/** Cita a una obra de data/bibliography.ts con la ubicación precisa del método. */
export interface Citation {
  sourceId: BibliographyId;
  /** Capítulo, sección y/o ejemplo. P. ej. "Sección 6.2, Ejemplo 6.3". */
  locator?: string;
}

export interface CalculatorMeta {
  /** Slug estable; coincide con el id en data/curriculum.ts y en el registro de UI. */
  id: string;
  /** Nombre visible: "Método de Newton-Raphson". */
  title: string;
  /** Una línea para tarjetas y metadatos. */
  summary: string;
  /** Al menos una. Un test del registro lo verifica. */
  citations: Citation[];
}

/** Un paso del procedimiento. */
export interface Step {
  /** "Iteración 1", "Derivada de f(x)". */
  title: string;
  /** Prosa en español que explica qué se hace y por qué. */
  explanation?: string;
  /** Fórmula general del paso: `x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}`. */
  formula?: Latex;
  /** La misma fórmula con los números sustituidos, para compararla con el cuaderno. */
  substitution?: Latex;
  /** Resultado del paso: `x_1 = 0.5`. */
  result?: Latex;
  /** Subpasos (p. ej. evaluar f y f′ antes de aplicar la fórmula). */
  children?: Step[];
}

export type CellValue = number | string | null;

export interface TableColumn {
  key: string;
  /** Encabezado en LaTeX: `x_n`, `f'(x_n)`, `\varepsilon_a\,(\%)`. */
  header: Latex;
  /**
   * Cómo mostrar la celda. `number` (por defecto) formatea números; `latex` renderiza strings
   * como fórmula; `text` los muestra tal cual.
   */
  format?: 'number' | 'latex' | 'text';
}

export interface ResultTable {
  id: string;
  title: string;
  columns: TableColumn[];
  rows: Record<string, CellValue>[];
}

/** Datos crudos para una gráfica; la UI decide cómo dibujarlos. */
export interface Point {
  x: number;
  y: number;
}

export interface Series {
  id: string;
  title: string;
  xLabel: string;
  yLabel: string;
  points: Point[];
  yScale?: 'linear' | 'log';
  /**
   * Cómo dibujar los puntos: `line` (por defecto), `area` (línea con el área bajo la curva, p. ej.
   * una integral) o `bar` (valores discretos, p. ej. una distribución de probabilidad).
   */
  kind?: 'line' | 'area' | 'bar';
  /** Nombre de la serie principal en la leyenda, cuando hay `reference`. */
  label?: string;
  /** Segunda serie en la misma escala para comparar (p. ej. la solución exacta), punteada. */
  reference?: { label: string; points: Point[] };
  /**
   * Líneas adicionales, más delgadas, en la misma escala (solo con `kind: 'line'`). P. ej. las
   * rectas de pago esperado del método gráfico de juegos, o los costos de pedir y de mantener
   * junto al costo total de un inventario. Una línea puede cubrir solo parte del eje x.
   */
  others?: { label: string; points: Point[] }[];
  /**
   * Región sombreada entre una curva inferior y una superior (solo con `kind: 'line'`), p. ej. la
   * región factible del método gráfico. Se interpola linealmente entre los puntos.
   */
  region?: { label: string; points: { x: number; low: number; high: number }[] };
  /** Rango de x a resaltar (p. ej. la región cuya probabilidad se calcula). */
  highlight?: { from: number; to: number };
}

export interface SummaryItem {
  label: string;
  value: Latex;
  /** El resultado principal (p. ej. la raíz) se destaca visualmente. */
  emphasis?: boolean;
}

export interface Notice {
  level: 'info' | 'warning' | 'error';
  message: string;
}

/** Traza común a éxito y fallo: un fallo a mitad de camino también se explica. */
export interface Trace {
  steps: Step[];
  tables: ResultTable[];
  series: Series[];
  notices: Notice[];
}

export interface CalculatorError<TErrorCode extends string = string> {
  code: TErrorCode;
  /** Mensaje en español para el estudiante. */
  message: string;
}

export type CalculatorSuccess<TValue> = { ok: true; value: TValue; summary: SummaryItem[] } & Trace;
export type CalculatorFailure<TErrorCode extends string = string> = {
  ok: false;
  error: CalculatorError<TErrorCode>;
} & Trace;

export type CalculatorResult<TValue, TErrorCode extends string = string> =
  CalculatorSuccess<TValue> | CalculatorFailure<TErrorCode>;

export interface Calculator<TInput, TValue, TErrorCode extends string = string> {
  meta: CalculatorMeta;
  /**
   * El formulario (con zodResolver) y `solve()` comparten este schema. Entrada y salida tienen
   * la misma forma: la conversión de texto a número la hace el formulario (`setValueAs`), así los
   * valores del formulario están tipados igual que la entrada de `solve()`.
   */
  inputSchema: z.ZodType<TInput, TInput>;
  /** Ejemplo precargado, tomado de la bibliografía citada. */
  example: TInput;
  /** Pura y total: nunca lanza; los errores esperables se devuelven con `ok: false`. */
  solve(input: TInput): CalculatorResult<TValue, TErrorCode>;
}

/** Traza vacía, punto de partida para construir resultados. */
export function emptyTrace(): Trace {
  return { steps: [], tables: [], series: [], notices: [] };
}
