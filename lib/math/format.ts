/**
 * Formateo de números para mostrar en tablas y en LaTeX.
 *
 * Criterio: mostrar suficientes cifras significativas para comparar contra las tablas de los
 * libros (Chapra, por ejemplo, usa 9 o 10), sin ceros sobrantes ni ruido de coma flotante.
 */

export const DEFAULT_SIGNIFICANT_DIGITS = 10;

/** Por debajo de este valor absoluto (o por encima del grande) se usa notación científica. */
const SMALL = 1e-4;
const LARGE = 1e10;

function trimZeros(mantissa: string): string {
  return mantissa.includes('.') ? mantissa.replace(/\.?0+$/, '') : mantissa;
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
  if (text === 'indefinido') return '\\text{indefinido}';
  if (text === '∞') return '\\infty';
  if (text === '−∞') return '-\\infty';
  const match = /^(-?[\d.]+)e(-?\d+)$/.exec(text);
  if (match) return `${match[1]} \\times 10^{${match[2]}}`;
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
  return value < 0 || tex.includes('\\times') ? `\\left(${tex}\\right)` : tex;
}

/**
 * Texto de un campo numérico → número. Acepta coma decimal ("0,5"), como se escribe en
 * Venezuela. Devuelve `NaN` si el texto no es un número, para que la validación lo rechace.
 */
export function parseDecimal(text: string): number {
  const normalized = text.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(normalized)) return Number.NaN;
  return Number(normalized);
}
