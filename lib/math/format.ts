/**
 * Formateo de números para mostrar en tablas y en LaTeX.
 *
 * Criterio: mostrar suficientes cifras significativas para comparar contra las tablas de los
 * libros (Chapra, por ejemplo, usa 9 o 10), sin ceros sobrantes ni ruido de coma flotante.
 */

export const DEFAULT_SIGNIFICANT_DIGITS = 10;

/**
 * Piezas de LaTeX que se repiten dentro de otras fórmulas. Usarlas en lugar de un
 * `` String.raw`…` `` dentro de `${…}` evita anidar plantillas (ADR-041).
 */
export const TEX = {
  /** Separador de listas: `a,\ b`. */
  listSep: String.raw`,\ `,
  /** Salto de línea de `array`, `aligned` y `cases`. */
  newline: String.raw` \\ `,
  /** Alternativas empatadas: `x = 1\ \text{o}\ 2`. */
  or: String.raw`\ \text{o}\ `,
  /** Celda o valor que no aplica. */
  dash: String.raw`\text{—}`,
  /** Cola de una suma truncada. */
  plusCdots: String.raw` + \cdots`,
  infty: String.raw`\infty`,
  negInfty: String.raw`-\infty`,
  ge: String.raw`\ge`,
  le: String.raw`\le`,
  thinSpace: String.raw`\,`,
  checkmark: String.raw`\checkmark`,
  times: String.raw`\times`,
  pm: String.raw`\pm`,
} as const;

/** Por debajo de este valor absoluto (o por encima del grande) se usa notación científica. */
const SMALL = 1e-4;
const LARGE = 1e10;

/** Quita los ceros finales: «1200» → «12». Sin regex, que con muchos ceros retrocede. */
export function trimTrailingZeros(digits: string): string {
  let end = digits.length;
  while (end > 0 && digits[end - 1] === '0') end--;
  return digits.slice(0, end);
}

/** Ceros finales de un decimal y el punto si queda solo: «1.500» → «1.5», «2.00» → «2». */
export function trimDecimalZeros(text: string): string {
  const trimmed = trimTrailingZeros(text);
  return trimmed !== text && trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
}

function trimZeros(mantissa: string): string {
  return mantissa.includes('.') ? trimDecimalZeros(mantissa) : mantissa;
}

/**
 * Número → texto legible. `1.2345e-7` → `"1.2345e-7"`, `0.500000000001` → `"0.5"`.
 * `NaN`/`±Infinity` se muestran como texto en español.
 */
export function formatNumber(
  value: number,
  significantDigits = DEFAULT_SIGNIFICANT_DIGITS,
): string {
  if (Number.isNaN(value)) return 'indefinido';
  if (value === Infinity) return '∞';
  if (value === -Infinity) return '−∞';
  if (value === 0) return '0'; // también normaliza -0

  const abs = Math.abs(value);
  if (abs < SMALL || abs >= LARGE) {
    const [mantissa = '', exponent = '0'] = value.toExponential(significantDigits - 1).split('e');
    return `${trimZeros(mantissa)}e${Number(exponent)}`;
  }
  // toPrecision puede devolver notación exponencial ("1.0e+2" para 100 con 2 cifras); pasar por
  // Number la devuelve a decimal y de paso elimina ceros sobrantes.
  return String(Number(value.toPrecision(significantDigits)));
}

/** Número → LaTeX. Usa `\times 10^{n}` en vez de `e`. */
export function toLatexNumber(
  value: number,
  significantDigits = DEFAULT_SIGNIFICANT_DIGITS,
): string {
  const text = formatNumber(value, significantDigits);
  if (text === 'indefinido') return String.raw`\text{indefinido}`;
  if (text === '∞') return String.raw`\infty`;
  if (text === '−∞') return String.raw`-\infty`;
  const match = /^(-?[\d.]+)e(-?\d+)$/.exec(text);
  if (match) return String.raw`${match[1]} \times 10^{${match[2]}}`;
  return text;
}

/**
 * Para sustituir un número dentro de una expresión LaTeX: los negativos van entre paréntesis
 * para que `x - (-2)` no se lea como `x - -2`.
 */
export function toLatexOperand(
  value: number,
  significantDigits = DEFAULT_SIGNIFICANT_DIGITS,
): string {
  const tex = toLatexNumber(value, significantDigits);
  return value < 0 || tex.includes(String.raw`\times`) ? String.raw`\left(${tex}\right)` : tex;
}

/**
 * Texto de un campo numérico → número. Acepta coma decimal ("0,5"), como se escribe en
 * Venezuela. Devuelve `NaN` si el texto no es un número, para que la validación lo rechace.
 */
export function parseDecimal(text: string): number {
  const normalized = text.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^[-+]?(\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/i.test(normalized)) return Number.NaN;
  return Number(normalized);
}

/**
 * Número escrito como fracción ("2/9") o como decimal ("0,25"), como se dan las probabilidades
 * en los libros. Devuelve `NaN` si no es válido o si el denominador es 0.
 */
export function parseFraction(text: string): number {
  const parts = text.split('/');
  if (parts.length === 1) return parseDecimal(text);
  if (parts.length !== 2) return Number.NaN;
  const numerator = parseDecimal(parts[0]!);
  const denominator = parseDecimal(parts[1]!);
  if (denominator === 0) return Number.NaN;
  return numerator / denominator;
}

/** El texto de `parseFraction` en LaTeX: "2/9" → `\frac{2}{9}`, "0,25" → `0.25`. */
export function fractionToLatex(text: string): string {
  const parts = text.split('/');
  if (parts.length === 2) {
    const [top, bottom] = parts.map((part) => toLatexNumber(parseDecimal(part)));
    return String.raw`\frac{${top}}{${bottom}}`;
  }
  return toLatexNumber(parseDecimal(text));
}

/** Matriz → LaTeX (`bmatrix`), con `significantDigits` cifras por entrada. */
export function toLatexMatrix(matrix: number[][], significantDigits = 6): string {
  const rows = matrix.map((row) => row.map((v) => toLatexNumber(v, significantDigits)).join(' & '));
  return String.raw`\begin{bmatrix} ${rows.join(TEX.newline)} \end{bmatrix}`;
}

/** Vector fila → LaTeX: `(0.32,\ 0.68)`. */
export function toLatexVector(vector: number[], significantDigits = 6): string {
  return String.raw`\left(${vector.map((v) => toLatexNumber(v, significantDigits)).join(TEX.listSep)}\right)`;
}

/** Varias líneas de LaTeX, una debajo de otra (sirve en modo en línea y en bloque). */
export function latexLines(lines: string[]): string {
  if (lines.length <= 1) return lines[0] ?? '';
  return String.raw`\begin{array}{l} ${lines.join(TEX.newline)} \end{array}`;
}

const LATEX_TEXT_ESCAPES: Record<string, string> = {
  '\\': String.raw`\textbackslash{}`,
  '{': String.raw`\{`,
  '}': String.raw`\}`,
  $: String.raw`\$`,
  '&': String.raw`\&`,
  '#': String.raw`\#`,
  '%': String.raw`\%`,
  _: String.raw`\_`,
  '^': String.raw`\textasciicircum{}`,
  '~': String.raw`\textasciitilde{}`,
};

/**
 * Texto escrito por el estudiante (el nombre de una actividad o de un nodo) → `\text{…}`,
 * escapando los caracteres que LaTeX interpreta.
 */
export function toLatexText(text: string): string {
  return String.raw`\text{${text.replace(/[\\{}$&#%_^~]/g, (c) => LATEX_TEXT_ESCAPES[c] ?? c)}}`;
}

export interface Rational {
  numerator: number;
  denominator: number;
}

/**
 * Fracción p/q equivalente a `value` con q ≤ `maxDenominator` (por fracciones continuas), o
 * `null` si no la hay. Sirve para mostrar como en el libro resultados que son racionales, p. ej.
 * las estrategias mixtas de un juego con pagos enteros (7/11, 4/11).
 */
export function toRational(value: number, maxDenominator = 1000): Rational | null {
  if (!Number.isFinite(value)) return null;
  const sign = value < 0 ? -1 : 1;
  let x = Math.abs(value);
  // Convergentes h/k: se arranca con h₋₂ = 0, h₋₁ = 1, k₋₂ = 1, k₋₁ = 0.
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(x);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > maxDenominator) return null;
    if (Math.abs((sign * h1) / k1 - value) <= 1e-9 * Math.max(1, Math.abs(value))) {
      return { numerator: sign * h1, denominator: k1 };
    }
    const fraction = x - a;
    if (fraction < 1e-12) return null;
    x = 1 / fraction;
  }
  return null;
}

/**
 * Número → LaTeX mostrando la fracción cuando es un racional sencillo: `\frac{7}{11} \approx
 * 0.636364`. Los enteros y los números sin fracción corta se muestran como `toLatexNumber`.
 */
export function toLatexRational(value: number, significantDigits = 6): string {
  const rational = toRational(value);
  if (!rational || rational.denominator === 1) return toLatexNumber(value, significantDigits);
  const { numerator, denominator } = rational;
  const fraction = String.raw`${numerator < 0 ? '-' : ''}\frac{${Math.abs(numerator)}}{${denominator}}`;
  return String.raw`${fraction} \approx ${toLatexNumber(value, significantDigits)}`;
}
