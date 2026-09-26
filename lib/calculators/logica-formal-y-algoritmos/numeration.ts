/**
 * Sistemas de numeración posicionales (Tucker y Joyanes). Un número en base b con dígitos
 * dₖ…d₁d₀.d₋₁d₋₂… vale Σ dᵢ·bⁱ. Para pasarlo a otra base:
 *
 *   parte entera       divisiones sucesivas entre la base; los residuos, leídos de abajo
 *                      hacia arriba, son los dígitos
 *   parte fraccionaria multiplicaciones sucesivas por la base; las partes enteras, leídas de
 *                      arriba hacia abajo, son los dígitos
 *
 * Todo se calcula con enteros grandes y fracciones exactas, sin redondeo.
 */
import { Rational } from '@/lib/math/rational';

export const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const MIN_BASE = 2;
export const MAX_BASE = 36;
/** Dígitos fraccionarios que se calculan como máximo. */
export const MAX_FRACTION_DIGITS = 12;
/** Mayor parte entera aceptada: 2⁶⁴ − 1 (a lo sumo 64 divisiones). */
export const MAX_INTEGER = 2n ** 64n - 1n;

export interface Numeral {
  negative: boolean;
  intDigits: number[];
  fracDigits: number[];
}

export const digitChar = (d: number) => DIGITS[d]!;

/** Lee un número escrito en la base dada (admite signo y punto o coma como separador). */
export function parseNumeral(text: string, base: number): Numeral | string {
  const clean = text.trim().toUpperCase().replace(/\s+/g, '');
  const match = /^([+-]?)([0-9A-Z]*)(?:[.,]([0-9A-Z]*))?$/.exec(clean);
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    return 'escribe un número con dígitos y, si hace falta, un punto o una coma';
  }
  const toDigits = (s: string): number[] | string => {
    const out: number[] = [];
    for (const ch of s) {
      const d = DIGITS.indexOf(ch);
      if (d < 0 || d >= base) {
        return `«${ch}» no es un dígito de la base ${base}${base <= 10 ? ` (usa 0 a ${base - 1})` : ` (usa 0 a 9 y A a ${digitChar(base - 1)})`}`;
      }
      out.push(d);
    }
    return out;
  };
  const intDigits = toDigits(match[2] || '0');
  if (typeof intDigits === 'string') return intDigits;
  const fracDigits = toDigits((match[3] ?? '').replace(/0+$/, ''));
  if (typeof fracDigits === 'string') return fracDigits;
  return { negative: match[1] === '-', intDigits, fracDigits };
}

export function integerValue(digits: number[], base: number): bigint {
  return digits.reduce((acc, d) => acc * BigInt(base) + BigInt(d), 0n);
}

export function fractionValue(digits: number[], base: number): Rational {
  return digits.reduce(
    (acc, d, k) => acc.add(Rational.of(d, BigInt(base) ** BigInt(k + 1))),
    Rational.ZERO,
  );
}

export interface DivisionRow {
  dividend: bigint;
  quotient: bigint;
  remainder: number;
}

/** Divisiones sucesivas de n > 0 entre la base, hasta que el cociente es 0. */
export function successiveDivisions(n: bigint, base: number): DivisionRow[] {
  const rows: DivisionRow[] = [];
  const b = BigInt(base);
  for (let dividend = n; dividend > 0n; dividend /= b) {
    rows.push({ dividend, quotient: dividend / b, remainder: Number(dividend % b) });
  }
  return rows;
}

export function integerDigits(n: bigint, base: number): number[] {
  if (n === 0n) return [0];
  return successiveDivisions(n, base)
    .map((r) => r.remainder)
    .reverse();
}

export interface MultiplicationRow {
  fraction: Rational;
  product: Rational;
  digit: number;
}

export interface FractionExpansion {
  rows: MultiplicationRow[];
  digits: number[];
  /** Posición donde empieza el período si se detectó una fracción repetida. */
  periodStart: number | null;
  /** Se llegó al límite de dígitos sin terminar ni repetir. */
  truncated: boolean;
}

/** Multiplicaciones sucesivas de 0 ≤ f < 1 por la base. */
export function successiveMultiplications(
  f: Rational,
  base: number,
  maxDigits = MAX_FRACTION_DIGITS,
): FractionExpansion {
  const rows: MultiplicationRow[] = [];
  const seen = new Map<string, number>();
  let fraction = f;
  while (!fraction.isZero() && rows.length < maxDigits) {
    const key = fraction.toString();
    const previous = seen.get(key);
    if (previous !== undefined) {
      return { rows, digits: rows.map((r) => r.digit), periodStart: previous, truncated: false };
    }
    seen.set(key, rows.length);
    const product = fraction.mul(Rational.of(base));
    const digit = Number(product.floor().num);
    rows.push({ fraction, product, digit });
    fraction = product.sub(Rational.of(digit));
  }
  const periodStart = fraction.isZero() ? null : (seen.get(fraction.toString()) ?? null);
  return {
    rows,
    digits: rows.map((r) => r.digit),
    periodStart,
    truncated: !fraction.isZero() && periodStart === null,
  };
}

/** Texto del número: «-11001.011». */
export function numeralText(negative: boolean, intDigits: number[], fracDigits: number[]): string {
  const int = intDigits.map(digitChar).join('');
  const frac = fracDigits.map(digitChar).join('');
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}

/** LaTeX del número con su base como subíndice; el período, con una raya encima. */
export function numeralLatex(
  negative: boolean,
  intDigits: number[],
  fracDigits: number[],
  base: number,
  options: { periodStart?: number | null; truncated?: boolean } = {},
): string {
  const int = intDigits.map(digitChar).join('');
  const { periodStart = null, truncated = false } = options;
  let frac = '';
  if (fracDigits.length > 0) {
    const fixed = fracDigits
      .slice(0, periodStart ?? fracDigits.length)
      .map(digitChar)
      .join('');
    const period =
      periodStart === null ? '' : fracDigits.slice(periodStart).map(digitChar).join('');
    frac = `.${fixed}${period ? `\\overline{${period}}` : ''}${truncated ? '\\ldots' : ''}`;
  }
  return `${negative ? '-' : ''}${int}${frac}_{${base}}`;
}
