/**
 * Magnitudes eléctricas con prefijo de ingeniería, como se escriben en los libros de electrónica:
 * 18.6 mA, 2.2 kΩ, 47.08 µA. Los cálculos se hacen en unidades del SI (A, V, Ω, F, S) y solo la
 * presentación usa prefijos.
 */
import { formatNumber, toLatexNumber } from '@/lib/math/format';

const PREFIXES = [
  { scale: 1e9, symbol: 'G' },
  { scale: 1e6, symbol: 'M' },
  { scale: 1e3, symbol: 'k' },
  { scale: 1, symbol: '' },
  { scale: 1e-3, symbol: 'm' },
  { scale: 1e-6, symbol: 'µ' },
  { scale: 1e-9, symbol: 'n' },
  { scale: 1e-12, symbol: 'p' },
] as const;

/** Unidades que no llevan prefijo (porcentajes, grados, adimensionales). */
const NO_PREFIX = new Set(['', '%', '°']);

function split(value: number, unit: string): { scaled: number; prefix: string } {
  if (value === 0 || !Number.isFinite(value) || NO_PREFIX.has(unit)) {
    return { scaled: value, prefix: '' };
  }
  const abs = Math.abs(value);
  for (const { scale, symbol } of PREFIXES) {
    if (abs >= scale * 0.9995) return { scaled: value / scale, prefix: symbol };
  }
  return { scaled: value / 1e-12, prefix: 'p' };
}

const LATEX_UNIT: Record<string, string> = { Ω: '\\Omega', µ: '\\mu ' };

/** `18.6\ \text{mA}`, `2.2\ \text{k}\Omega`. */
export function engTex(value: number, unit: string, digits = 4): string {
  const { scaled, prefix } = split(value, unit);
  const number = toLatexNumber(scaled, digits);
  if (unit === '') return number;
  const prefixTex = prefix === 'µ' ? '\\mu' : prefix ? `\\text{${prefix}}` : '';
  const unitTex = LATEX_UNIT[unit] ?? `\\text{${unit}}`;
  return `${number}\\ ${prefixTex}${unitTex}`;
}

/** Texto plano para explicaciones: `18.6 mA`. */
export function engText(value: number, unit: string, digits = 4): string {
  const { scaled, prefix } = split(value, unit);
  return `${formatNumber(scaled, digits).replace('-', '−')} ${prefix}${unit}`.trim();
}

const PREFIX_VALUE: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  μ: 1e-6,
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
};

/**
 * Lee una magnitud como la escribe un estudiante: `2.2k`, `2,2 kΩ`, `100µF`, `100u`, `47 nF`,
 * `1e-6`, `−0.3 mA`. La unidad final es opcional y se ignora. Devuelve `NaN` si no es válida.
 */
export function parseQuantity(text: string): number {
  const s = text
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/^[−–]/, '-')
    .replace(/(Ω|ohms?|Hz|[VAFHSW])$/, '');
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([pnuµμmkKMG]?)$/i.exec(s);
  if (!m) return Number.NaN;
  // Con exponente no se admite prefijo ("1e3k" es ambiguo); "1E" no es un exponente.
  const [, number, prefix] = m;
  if (prefix && /e/i.test(number!)) return Number.NaN;
  const value = Number(number);
  if (!prefix) return value;
  // `m` es mili y `M` mega: aquí la mayúscula importa.
  const scale = PREFIX_VALUE[prefix] ?? Number.NaN;
  // Dividir entre 10ⁿ redondea mejor que multiplicar por 10⁻ⁿ (10µ da 1e-5 exacto).
  return scale < 1 ? value / Math.round(1 / scale) : value * scale;
}

/** Paralelo de resistencias (∞ se ignora; 0 da 0). */
export function parallel(...values: number[]): number {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.some((v) => v === 0)) return 0;
  const sum = finite.reduce((s, v) => s + 1 / v, 0);
  return sum === 0 ? Infinity : 1 / sum;
}

/** Voltaje térmico a temperatura ambiente que usan Boylestad y Malvino (26 mV). */
export const VT_ROOM = 0.026;
