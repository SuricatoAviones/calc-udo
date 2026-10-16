import { describe, expect, it } from 'vitest';
import { routhHurwitz } from './routh-hurwitz';

const solve = (polynomial: string) => routhHurwitz.solve({ polynomial });

function ok(polynomial: string) {
  const r = solve(polynomial);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('criterio de Routh-Hurwitz', () => {
  it('el ejemplo cumple el schema', () => {
    expect(routhHurwitz.inputSchema.safeParse(routhHurwitz.example).success).toBe(true);
  });

  // Ogata, 3.ª ed., sec. 5-5, ejemplo 5-2: s⁴ + 2s³ + 3s² + 4s + 5. Arreglo: 1 3 5 / 2 4 / 1 5 /
  // −6 / 5 (el libro también lo muestra con el renglón s³ dividido entre 2). Dos cambios de signo.
  it('Ogata, ejemplo 5-2: dos raíces con parte real positiva', () => {
    const r = ok('s^4 + 2s^3 + 3s^2 + 4s + 5');
    expect(r.value.firstColumn).toEqual(['1', '2', '1', '-6', '5']);
    expect(r.value.rightHalf).toBe(2);
    expect(r.value.stable).toBe(false);
    const table = r.tables[0]!;
    expect(table.rows[2]).toMatchObject({ potencia: 's^{2}', c0: '1', c1: '5' });
  });

  // Ogata, sec. 5-5, ec. (5-7): s³ + 2s² + s + 2 = 0 tiene raíces ±j. El libro reemplaza el cero
  // del renglón s¹ por ε; como ese renglón es todo ceros, aquí se usa el polinomio auxiliar
  // P(s) = 2s² + 2 (Kuo, sec. 6-5), con la misma conclusión: sin raíces en el semiplano derecho y
  // un par sobre el eje imaginario.
  it('Ogata, ec. 5-7: par de raíces imaginarias', () => {
    const r = ok('s^3 + 2s^2 + s + 2');
    expect(r.value.rightHalf).toBe(0);
    expect(r.value.imaginary).toBe(2);
    expect(r.value.stable).toBe(false);
  });

  // Ogata, sec. 5-5: s³ − 3s + 2 = (s − 1)²(s + 2). El cero del renglón s² se reemplaza por ε y
  // el renglón s¹ queda −3 − 2/ε: dos cambios de signo.
  it('Ogata, sec. 5-5: caso ε con dos cambios de signo', () => {
    const r = ok('s^3 - 3s + 2');
    expect(r.value.firstColumn[1]).toBe('\\varepsilon');
    expect(r.value.firstColumn[2]).toBe('\\frac{-3\\varepsilon - 2}{\\varepsilon}');
    expect(r.value.rightHalf).toBe(2);
  });

  // Ogata, sec. 5-5: s⁵ + 2s⁴ + 24s³ + 48s² − 25s − 50. El renglón s³ es todo ceros; con
  // P(s) = 2s⁴ + 48s² − 50 y dP/ds = 8s³ + 96s el arreglo queda 1, 2, 8, 24, 112.7, −50: un cambio
  // de signo. Las raíces de P son ±1 y ±j5.
  it('Ogata, sec. 5-5: renglón de ceros y polinomio auxiliar', () => {
    const r = ok('s^5 + 2s^4 + 24s^3 + 48s^2 - 25s - 50');
    expect(r.value.firstColumn.slice(0, 4)).toEqual(['1', '2', '8', '24']);
    expect(r.value.firstColumnValues[4]).toBeCloseTo(112.7, 1);
    expect(r.value.firstColumn[4]).toBe('\\frac{338}{3}');
    expect(r.value.firstColumn[5]).toBe('-50');
    expect(r.value.rightHalf).toBe(1);
    expect(r.value.imaginary).toBe(2);
  });

  // Ogata, sec. 5-5, figura 5-24: s(s² + s + 1)(s + 2) + K = s⁴ + 3s³ + 3s² + 2s + K.
  // Primera columna 1, 3, 7/3, 2 − 9K/7, K: estable para 14/9 > K > 0.
  it('Ogata, fig. 5-24: intervalo de estabilidad 0 < K < 14/9', () => {
    const r = ok('s(s^2 + s + 1)(s + 2) + K');
    expect(r.value.firstColumn).toEqual(['1', '3', '\\frac{7}{3}', '-\\frac{9}{7}K + 2', 'K']);
    expect(r.value.parameter).toBe('K');
    expect(r.value.intervals).toHaveLength(1);
    const [lo, hi] = r.value.intervals[0]!;
    expect(lo).toBeCloseTo(0, 10);
    expect(hi).toBeCloseTo(14 / 9, 10);
    const crit = r.value.critical.find((c) => c.omega.length > 0)!;
    expect(crit.value).toBeCloseTo(14 / 9, 10);
    // Con K = 14/9 el auxiliar (7/3)s² + 14/9 da ω = √(2/3) (verificado a mano).
    expect(crit.omega[0]).toBeCloseTo(Math.sqrt(2 / 3), 8);
  });

  // Ogata, 3.ª ed., ejemplo 6-1, paso 4: s³ + 3s² + 2s + K. El término s¹ se anula con K = 6 y
  // el auxiliar 3s² + 6 da s = ±j√2.
  it('Ogata, ejemplo 6-1: ganancia crítica K = 6 y ω = √2', () => {
    const r = ok('s^3 + 3s^2 + 2s + K');
    expect(r.value.intervals[0]![0]).toBeCloseTo(0, 10);
    expect(r.value.intervals[0]![1]).toBeCloseTo(6, 10);
    const crit = r.value.critical.find((c) => c.omega.length > 0)!;
    expect(crit.omega[0]).toBeCloseTo(Math.SQRT2, 8);
  });

  // Kuo, 7.ª ed., ejemplo 7-2(a): G(s) = K(s + 3.15)/[s(s + 1.5)(s + 0.5)] con realimentación
  // unitaria es estable para 0 < K < 1.3043.
  it('Kuo, ejemplo 7-2(a): 0 < K < 1.3043', () => {
    const r = ok('s(s + 1.5)(s + 0.5) + K(s + 3.15)');
    expect(r.value.intervals[0]![0]).toBeCloseTo(0, 10);
    expect(r.value.intervals[0]![1]).toBeCloseTo(1.3043, 4);
  });

  // Ogata, 3.ª ed., sec. 10-2: con la planta (s + 2)(s + 3)/[s(s + 1)(s + 5)] y control
  // proporcional, la primera columna es positiva para todo Kp > 0: no hay ganancia crítica.
  it('Ogata, sec. 10-2: estable para todo Kp positivo', () => {
    const r = ok('s(s + 1)(s + 5) + Kp(s + 2)(s + 3)');
    expect(r.value.parameter).toBe('Kp');
    const positive = r.value.intervals.find(([lo, hi]) => (lo ?? -Infinity) <= 0 && hi === null);
    expect(positive).toBeDefined();
  });

  it('raíces en el origen y polinomio estable', () => {
    // (s + 1)(s + 2)(s + 3) = s³ + 6s² + 11s + 6: estable (desarrollado a mano).
    expect(ok('(s+1)(s+2)(s+3)').value.stable).toBe(true);
    // s²(s + 1): dos raíces en el origen, sobre el eje imaginario.
    const r = ok('s^3 + s^2');
    expect(r.value.imaginary).toBe(2);
    expect(r.value.rightHalf).toBe(0);
  });

  it('errores', () => {
    const invalid = solve('s^^2');
    expect(!invalid.ok && invalid.error.code).toBe('polinomio-invalido');
    const noS = solve('x^2 + 1');
    expect(!noS.ok && noS.error.code).toBe('sin-variable-s');
    const many = solve('s^2 + a s + b');
    expect(!many.ok && many.error.code).toBe('demasiados-parametros');
    const fraction = solve('1/s + 1');
    expect(!fraction.ok && fraction.error.code).toBe('polinomio-invalido');
  });
});
