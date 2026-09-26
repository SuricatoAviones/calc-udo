/**
 * Números racionales exactos (numerador y denominador `bigint`).
 *
 * Las tablas simplex, de transporte y de asignación se calculan con fracciones exactas: así los
 * pasos muestran 2/3 o 1/6 como en los libros, sin ruido de coma flotante, y las comparaciones
 * (¿es 0?, ¿cuál razón es menor?) no dependen de una tolerancia.
 */

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

export class Rational {
  /** Denominador siempre positivo y fracción irreducible. */
  readonly num: bigint;
  readonly den: bigint;

  private constructor(num: bigint, den: bigint) {
    if (den === 0n) throw new RangeError('Denominador cero');
    const sign = den < 0n ? -1n : 1n;
    const g = gcd(num, den) || 1n;
    this.num = (sign * num) / g;
    this.den = (sign * den) / g;
  }

  static readonly ZERO = new Rational(0n, 1n);
  static readonly ONE = new Rational(1n, 1n);

  static of(num: bigint | number, den: bigint | number = 1n): Rational {
    return new Rational(BigInt(num), BigInt(den));
  }

  /**
   * Número de JavaScript → racional exacto de su representación decimal más corta: 0.21 da
   * 21/100 (no la fracción binaria que guarda el `double`). Lanza con `NaN` o infinito: quien la
   * llama valida antes que los datos sean finitos.
   */
  static fromNumber(value: number): Rational {
    if (!Number.isFinite(value)) throw new RangeError('Número no finito');
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
    if (!match) throw new RangeError(`No se pudo convertir ${value}`);
    const [, sign, int = '0', frac = '', exp = '0'] = match;
    let num = BigInt(int + frac);
    let den = 10n ** BigInt(frac.length);
    const e = Number(exp);
    if (e > 0) num *= 10n ** BigInt(e);
    if (e < 0) den *= 10n ** BigInt(-e);
    return new Rational(sign === '-' ? -num : num, den);
  }

  add(o: Rational): Rational {
    return new Rational(this.num * o.den + o.num * this.den, this.den * o.den);
  }

  sub(o: Rational): Rational {
    return new Rational(this.num * o.den - o.num * this.den, this.den * o.den);
  }

  mul(o: Rational): Rational {
    return new Rational(this.num * o.num, this.den * o.den);
  }

  div(o: Rational): Rational {
    return new Rational(this.num * o.den, this.den * o.num);
  }

  neg(): Rational {
    return new Rational(-this.num, this.den);
  }

  abs(): Rational {
    return this.num < 0n ? this.neg() : this;
  }

  /** −1, 0 o 1. */
  sign(): -1 | 0 | 1 {
    return this.num < 0n ? -1 : this.num > 0n ? 1 : 0;
  }

  cmp(o: Rational): -1 | 0 | 1 {
    const d = this.num * o.den - o.num * this.den;
    return d < 0n ? -1 : d > 0n ? 1 : 0;
  }

  eq(o: Rational): boolean {
    return this.num === o.num && this.den === o.den;
  }

  lt(o: Rational): boolean {
    return this.cmp(o) < 0;
  }

  gt(o: Rational): boolean {
    return this.cmp(o) > 0;
  }

  isZero(): boolean {
    return this.num === 0n;
  }

  isInteger(): boolean {
    return this.den === 1n;
  }

  /** Mayor entero ≤ este número. */
  floor(): Rational {
    const q = this.num / this.den;
    return Rational.of(this.num < 0n && q * this.den !== this.num ? q - 1n : q);
  }

  ceil(): Rational {
    return this.neg().floor().neg();
  }

  toNumber(): number {
    return Number(this.num) / Number(this.den);
  }

  toString(): string {
    return this.den === 1n ? String(this.num) : `${this.num}/${this.den}`;
  }

  /**
   * LaTeX legible: enteros y decimales cortos (0.5, 0.21) como decimales; las demás fracciones
   * como `\frac{2}{3}`. Un decimal corto es una fracción cuyo denominador solo tiene factores 2 y
   * 5 y que se escribe con a lo sumo 4 decimales.
   */
  toLatex(): string {
    if (this.den === 1n) return String(this.num);
    const decimal = shortDecimal(this);
    if (decimal !== null) return decimal;
    const n = this.num < 0n ? -this.num : this.num;
    return `${this.num < 0n ? '-' : ''}\\frac{${n}}{${this.den}}`;
  }

  /** Igual que `toLatex`, pero en texto plano: `2/3`, `0.5`. */
  toText(): string {
    if (this.den === 1n) return String(this.num);
    return shortDecimal(this) ?? `${this.num}/${this.den}`;
  }
}

function shortDecimal(r: Rational): string | null {
  let d = r.den;
  let twos = 0;
  let fives = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  const places = Math.max(twos, fives);
  if (d !== 1n || places > 4) return null;
  const scaled = (r.num * 10n ** BigInt(places)) / r.den;
  const negative = scaled < 0n;
  const digits = String(negative ? -scaled : scaled).padStart(places + 1, '0');
  const text = `${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(/\.?0+$/, '');
  return `${negative ? '-' : ''}${text}`;
}

/** Suma de una lista de racionales. */
export function sumRationals(values: Rational[]): Rational {
  return values.reduce((s, v) => s.add(v), Rational.ZERO);
}
