/**
 * Criterio de estabilidad de Routh (Ogata, 3.ª ed., sec. 5-5; Kuo, 7.ª ed., sec. 6-5).
 *
 *   sⁿ    a₀ a₂ a₄ …          b₁ = (a₁a₂ − a₀a₃)/a₁,  b₂ = (a₁a₄ − a₀a₅)/a₁, …
 *   sⁿ⁻¹  a₁ a₃ a₅ …          c₁ = (b₁a₃ − a₁b₂)/b₁, …
 *   sⁿ⁻²  b₁ b₂ b₃ …
 *
 * El número de raíces con parte real positiva es el número de cambios de signo de la primera
 * columna. Casos especiales: si el primer elemento de un renglón es 0 y el resto no, se reemplaza
 * por ε > 0 pequeño; si todo un renglón es 0, se forma el polinomio auxiliar con el renglón
 * anterior y se usan los coeficientes de su derivada. Los elementos pueden depender de un
 * parámetro (la ganancia K), y entonces la primera columna da las condiciones de estabilidad.
 */
import * as C from '@/lib/math/complex';
import { formatNumber, toLatexNumber, toLatexRational } from '@/lib/math/format';
import { polyRoots, type Poly, type PolyRoot } from '@/lib/math/polynomials';
import type { ResultTable, Step } from '../types';
import { symbolTex } from './symbolic';
import {
  U_ZERO,
  uConst,
  uCriticalPoints,
  uDiv,
  uEval,
  uFromPoly,
  uIsConstant,
  uIsZero,
  uMul,
  uScale,
  uSignAtZero,
  uSub,
  uTex,
  uValue,
  uVar,
  type URat,
} from './urat';

const DIGITS = 6;

export interface RouthRow {
  power: number;
  entries: URat[];
  /** El primer elemento era 0 y se reemplazó por ε. */
  epsilon?: boolean;
  /** El renglón era todo ceros: son los coeficientes de dP/ds. */
  auxiliary?: { coefficients: URat[]; power: number };
}

export interface RouthArray {
  /** Variable de los elementos: el parámetro (K), ε o ninguna. */
  variable: 'parametro' | 'epsilon' | null;
  parameter: string | null;
  rows: RouthRow[];
  steps: Step[];
}

export type RouthErrorCode = 'caso-especial-parametrico' | 'grado-insuficiente';

export type RouthOutcome =
  | { ok: true; array: RouthArray }
  | { ok: false; code: RouthErrorCode; message: string; steps: Step[] };

/** LaTeX de la variable de los elementos. */
export function variableTex(array: Pick<RouthArray, 'variable' | 'parameter'>): string {
  if (array.variable === 'epsilon') return '\\varepsilon';
  return array.parameter ? symbolTex(array.parameter) : 'K';
}

function cellTex(a: URat, array: Pick<RouthArray, 'variable' | 'parameter'>): string {
  return uTex(a, variableTex(array));
}

function operand(a: URat, array: Pick<RouthArray, 'variable' | 'parameter'>): string {
  const tex = cellTex(a, array);
  const isSum = / [+-] /.test(tex);
  return tex.startsWith('-') || isSum ? `\\left(${tex}\\right)` : tex;
}

const powerTex = (p: number) => (p === 0 ? 's^{0}' : p === 1 ? 's^{1}' : `s^{${p}}`);

/** P(s) del renglón de grado `power`: Σ e_j s^{power − 2j}. */
export function auxiliaryPolyTex(
  coefficients: URat[],
  power: number,
  array: Pick<RouthArray, 'variable' | 'parameter'>,
): string {
  const terms: string[] = [];
  coefficients.forEach((c, j) => {
    const p = power - 2 * j;
    if (p < 0 || uIsZero(c)) return;
    const tex = cellTex(c, array);
    const base = p === 0 ? '' : p === 1 ? 's' : `s^{${p}}`;
    const coef =
      tex === '1' && base
        ? ''
        : tex === '-1' && base
          ? '-'
          : /[+-]/.test(tex.slice(1))
            ? `\\left(${tex}\\right)`
            : tex;
    const term = `${coef}${base}`;
    terms.push(
      terms.length === 0 ? term : term.startsWith('-') ? `- ${term.slice(1)}` : `+ ${term}`,
    );
  });
  return terms.join(' ') || '0';
}

/**
 * Arma el arreglo de Routh de un polinomio cuyos coeficientes (de mayor a menor potencia de s)
 * pueden depender de un parámetro.
 */
export function routhArray(coefficients: URat[], parameter: string | null): RouthOutcome {
  const steps: Step[] = [];
  const n = coefficients.length - 1;
  if (n < 1) {
    return {
      ok: false,
      code: 'grado-insuficiente',
      message: 'El polinomio debe ser al menos de grado 1.',
      steps,
    };
  }
  const width = Math.ceil((n + 1) / 2);
  const array: RouthArray = {
    variable: parameter ? 'parametro' : null,
    parameter,
    rows: [],
    steps,
  };
  const pad = (row: URat[]) => [
    ...row,
    ...Array<URat>(Math.max(0, width - row.length)).fill(U_ZERO),
  ];
  array.rows.push({ power: n, entries: pad(coefficients.filter((_, i) => i % 2 === 0)) });
  array.rows.push({ power: n - 1, entries: pad(coefficients.filter((_, i) => i % 2 === 1)) });
  steps.push({
    title: 'Primeros dos renglones',
    explanation:
      'El renglón sⁿ lleva los coeficientes a₀, a₂, a₄, … y el renglón sⁿ⁻¹ los coeficientes a₁, a₃, a₅, …; donde faltan coeficientes se escribe 0.',
    result: array.rows
      .map((r) => `${powerTex(r.power)}:\\ ${r.entries.map((e) => cellTex(e, array)).join(',\\ ')}`)
      .join('\\qquad '),
  });

  // Un renglón todo ceros justo en el segundo renglón (p. ej. s⁴ + 4): se usa el auxiliar.
  const fixZeroRow = (k: number): Step | null => {
    const row = array.rows[k]!;
    if (!row.entries.every(uIsZero) || k === 0) return null;
    const prev = array.rows[k - 1]!;
    const p = prev.power;
    const derivative = prev.entries
      .map((c, j) => uScale(c, p - 2 * j))
      .filter((_, j) => p - 2 * j > 0);
    row.entries = pad(derivative);
    row.auxiliary = { coefficients: prev.entries, power: p };
    return {
      title: `Renglón ${powerTex(row.power)} de ceros: polinomio auxiliar`,
      explanation: `Todos los elementos del renglón son 0: hay raíces de igual magnitud y signo opuesto. Se forma el polinomio auxiliar con el renglón anterior (${powerTex(p)}) y el renglón de ceros se reemplaza por los coeficientes de su derivada.`,
      formula: `P(s) = ${auxiliaryPolyTex(prev.entries, p, array)}`,
      result: `\\frac{dP}{ds} = ${auxiliaryPolyTex(derivative, p - 1, array)}`,
    };
  };

  const first = fixZeroRow(1);
  if (first) steps.push(first);
  else if (uIsZero(array.rows[1]!.entries[0]!)) {
    if (parameter) {
      return {
        ok: false,
        code: 'caso-especial-parametrico',
        message: `El coeficiente a₁ es 0 para cualquier valor de ${parameter}: da un valor concreto al parámetro para analizar este caso especial.`,
        steps,
      };
    }
    array.rows[1]!.entries[0] = uVar();
    array.rows[1]!.epsilon = true;
    array.variable = 'epsilon';
    steps.push({
      title: `Caso especial en el renglón ${powerTex(n - 1)}`,
      explanation:
        'El primer elemento es 0 pero el resto del renglón no: se reemplaza por un número positivo muy pequeño ε y se continúa (Ogata, sec. 5-5).',
      result: `${powerTex(n - 1)}:\\ ${array.rows[1]!.entries.map((e) => cellTex(e, array)).join(',\\ ')}`,
    });
  }

  const rowSteps: Step[] = [];
  for (let k = 2; k <= n; k++) {
    const upper = array.rows[k - 2]!.entries;
    const pivotRow = array.rows[k - 1]!.entries;
    const pivot = pivotRow[0]!;
    const entries: URat[] = [];
    const children: Step[] = [];
    for (let j = 0; j < width; j++) {
      const a = upper[j + 1] ?? U_ZERO;
      const b = pivotRow[j + 1] ?? U_ZERO;
      const value = uDiv(uSub(uMul(pivot, a), uMul(upper[0]!, b)), pivot);
      entries.push(value);
      if (j < width - 1 && !(uIsZero(a) && uIsZero(b))) {
        children.push({
          title: `Elemento ${j + 1}`,
          substitution: `\\frac{${operand(pivot, array)} \\cdot ${operand(a, array)} - ${operand(upper[0]!, array)} \\cdot ${operand(b, array)}}{${cellTex(pivot, array)}}`,
          result: cellTex(value, array),
        });
      }
    }
    const row: RouthRow = { power: n - k, entries };
    array.rows.push(row);
    const zeroStep = fixZeroRow(k);
    if (!zeroStep && uIsZero(row.entries[0]!)) {
      if (parameter) {
        return {
          ok: false,
          code: 'caso-especial-parametrico',
          message: `El primer elemento del renglón ${row.power === 0 ? 's⁰' : `s^${row.power}`} es 0 para cualquier valor de ${parameter}: da un valor concreto al parámetro para analizar este caso especial.`,
          steps: [...steps, { title: 'Renglones siguientes', children: rowSteps }],
        };
      }
      row.entries[0] = uVar();
      row.epsilon = true;
      array.variable = 'epsilon';
      children.push({
        title: 'Caso especial: primer elemento nulo',
        explanation:
          'El primer elemento es 0 pero el resto del renglón no: se reemplaza por un número positivo muy pequeño ε y se continúa (Ogata, sec. 5-5).',
        result: `${powerTex(row.power)}:\\ ${row.entries.map((e) => cellTex(e, array)).join(',\\ ')}`,
      });
    }
    rowSteps.push({
      title: `Renglón ${powerTex(row.power)}`,
      formula:
        k === 2
          ? 'b_j = \\frac{a_1a_{2j} - a_0a_{2j+1}}{a_1}'
          : 'x_j = \\frac{p_1q_{j+1} - q_1p_{j+1}}{p_1}\\quad (p: \\text{renglón anterior},\\ q: \\text{dos renglones arriba})',
      children,
      result: `${powerTex(row.power)}:\\ ${row.entries.map((e) => cellTex(e, array)).join(',\\ ')}`,
    });
    if (zeroStep) rowSteps.push(zeroStep);
  }
  steps.push({ title: 'Renglones siguientes', children: rowSteps });
  return { ok: true, array };
}

/** Tabla del arreglo para mostrarla como en el libro. */
export function routhTable(array: RouthArray): ResultTable {
  const width = Math.max(...array.rows.map((r) => r.entries.length));
  const used = Array.from({ length: width }, (_, j) =>
    array.rows.some((r, i) => i < 2 || !uIsZero(r.entries[j] ?? U_ZERO)),
  );
  const columns: ResultTable['columns'] = [
    { key: 'potencia', header: '', format: 'latex' },
    ...Array.from({ length: width }, (_, j) => ({
      key: `c${j}`,
      header: `${j + 1}`,
      format: 'latex' as const,
    })).filter((_, j) => used[j]),
  ];
  return {
    id: 'routh',
    title: 'Arreglo de Routh',
    columns,
    rows: array.rows.map((r) => {
      const row: Record<string, string> = { potencia: powerTex(r.power) };
      r.entries.forEach((e, j) => {
        if (used[j])
          row[`c${j}`] =
            j > 0 && uIsZero(e) && r.power < array.rows[0]!.power - 1 ? '' : cellTex(e, array);
      });
      return row;
    }),
  };
}

/** Signo de un elemento numérico o con ε (cuando ε → 0⁺). */
export function entrySign(a: URat, array: RouthArray): -1 | 0 | 1 {
  if (array.variable === 'epsilon') return uSignAtZero(a);
  if (!uIsConstant(a)) return 0;
  const v = uValue(a);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

export interface SignAnalysis {
  signs: (-1 | 0 | 1)[];
  changes: number;
  /** Raíces de los polinomios auxiliares (simétricas respecto al origen). */
  auxiliaryRoots: PolyRoot[];
  /** Raíces sobre el eje imaginario (de los polinomios auxiliares), con su multiplicidad. */
  imaginary: number;
}

export function analyzeSigns(array: RouthArray): SignAnalysis {
  const signs = array.rows.map((r) => entrySign(r.entries[0]!, array));
  let changes = 0;
  let last = 0;
  for (const s of signs) {
    if (s === 0) continue;
    if (last !== 0 && s !== last) changes++;
    last = s;
  }
  const auxiliaryRoots: PolyRoot[] = [];
  for (const r of array.rows) {
    if (!r.auxiliary || array.variable === 'parametro') continue;
    const p = r.auxiliary.power;
    const poly: Poly = Array<number>(p + 1).fill(0);
    r.auxiliary.coefficients.forEach((c, j) => {
      if (p - 2 * j >= 0) poly[2 * j] = uIsConstant(c) ? uValue(c) : 0;
    });
    auxiliaryRoots.push(...polyRoots(poly));
  }
  const imaginary = auxiliaryRoots
    .filter((r) => Math.abs(r.value.re) <= 1e-9 * Math.max(1, C.abs(r.value)))
    .reduce((s, r) => s + r.multiplicity, 0);
  return { signs, changes, auxiliaryRoots, imaginary };
}

/** Coeficientes numéricos de un polinomio en s con el parámetro sustituido. */
export function substitute(coefficients: URat[], value: number): number[] {
  return coefficients.map((c) => uEval(c, value));
}

/** El polinomio en s con coeficientes que pueden depender del parámetro: s⁴ + 3s³ + … + K. */
export function polynomialTex(coefficients: URat[], variable: string): string {
  const n = coefficients.length - 1;
  const terms: string[] = [];
  coefficients.forEach((c, i) => {
    if (uIsZero(c)) return;
    const power = n - i;
    const base = power === 0 ? '' : power === 1 ? 's' : `s^{${power}}`;
    let tex = uTex(c, variable);
    let negative = false;
    if (uIsConstant(c)) {
      negative = uValue(c) < 0;
      if (negative) tex = tex.slice(1);
      if (tex === '1' && base) tex = '';
    } else if (/ [+-] /.test(tex) && base) tex = `\\left(${tex}\\right)`;
    const body = `${tex}${base}`;
    if (terms.length === 0) terms.push(negative ? `-${body}` : body);
    else terms.push(negative ? `- ${body}` : `+ ${body}`);
  });
  return terms.join(' ') || '0';
}

export function numberText(v: number): string {
  return formatNumber(v, DIGITS);
}

export function numberTexOf(v: number): string {
  return toLatexNumber(v, DIGITS);
}

export { uConst };

export interface ParameterStability {
  /** Intervalos del parámetro con estabilidad: [desde, hasta] (null = infinito). */
  intervals: [number | null, number | null][];
  /** Valores del parámetro en los bordes, con la frecuencia de las raíces sobre el eje jω. */
  criticalInfo: { value: number; omega: number[] }[];
  intervalTex: (lo: number | null, hi: number | null) => string;
  steps: Step[];
}

/**
 * Condiciones de estabilidad de un arreglo con parámetro: los elementos de la primera columna
 * deben tener el signo del primero. Se prueban valores entre los puntos donde algún elemento se
 * anula; en los bordes finitos se busca el polinomio auxiliar y la frecuencia de oscilación.
 */
export function parameterStability(
  coefficients: URat[],
  array: RouthArray,
  parameter: string,
): ParameterStability {
  const steps: Step[] = [];
  const first = array.rows.map((r) => r.entries[0]!);
  const pTex = symbolTex(parameter);
  const n = (v: number) => toLatexNumber(v, DIGITS);
  const critical = [
    ...new Set(first.flatMap(uCriticalPoints).map((v) => Number(v.toPrecision(12)))),
  ].sort((a, b) => a - b);
  const probes =
    critical.length === 0
      ? [0]
      : [
          critical[0]! - Math.max(1, Math.abs(critical[0]!)),
          ...critical.slice(1).map((v, i) => (v + critical[i]!) / 2),
          critical.at(-1)! + Math.max(1, Math.abs(critical.at(-1)!)),
        ];
  const stableAt = (k: number) => {
    const signs = first.map((e) => Math.sign(uEval(e, k)));
    return signs.every((s) => s === signs[0] && s !== 0);
  };
  const intervals: [number | null, number | null][] = [];
  probes.forEach((p, i) => {
    if (!stableAt(p)) return;
    const lo = i === 0 ? null : critical[i - 1]!;
    const hi = i === critical.length ? null : critical[i]!;
    const last = intervals.at(-1);
    if (last && last[1] === lo && lo !== null && stableAt(lo)) last[1] = hi;
    else intervals.push([lo, hi]);
  });

  const conditions = first
    .map((e) => ({ e, tex: uTex(e, pTex) }))
    .filter(({ e }) => !uIsConstant(e) || uValue(e) <= 0);
  steps.push({
    title: 'Condiciones de estabilidad',
    explanation: `No debe haber cambios de signo en la primera columna. Como el primer elemento es positivo, cada elemento que depende de ${parameter} debe ser positivo.`,
    result: conditions.length
      ? conditions.map(({ tex }) => `${tex} > 0`).join(',\\quad ')
      : '\\text{Ningún elemento depende del parámetro.}',
  });
  const bound = (v: number | null, inf: string) => (v === null ? inf : toLatexRational(v, DIGITS));
  const intervalTex = (lo: number | null, hi: number | null) =>
    lo === null && hi === null
      ? `${pTex} \\in \\mathbb{R}`
      : lo === null
        ? `${pTex} < ${bound(hi, '')}`
        : hi === null
          ? `${pTex} > ${bound(lo, '')}`
          : `${bound(lo, '')} < ${pTex} < ${bound(hi, '')}`;
  steps.push({
    title: 'Intervalo de estabilidad',
    explanation:
      intervals.length === 0
        ? `No hay ningún valor de ${parameter} que haga positivos todos los elementos: el sistema es inestable para todo ${parameter}.`
        : `Se prueban valores de ${parameter} entre los puntos donde algún elemento de la primera columna se anula (${critical.map((v) => formatNumber(v, DIGITS)).join(', ')}).`,
    result: intervals.length
      ? intervals.map(([lo, hi]) => intervalTex(lo, hi)).join(',\\quad ')
      : undefined,
  });

  // Valores críticos: en los bordes finitos, raíces sobre el eje jω.
  const criticalInfo: { value: number; omega: number[] }[] = [];
  const borders = [
    ...new Set(intervals.flatMap(([lo, hi]) => [lo, hi]).filter((v): v is number => v !== null)),
  ];
  const criticalSteps: Step[] = [];
  for (const k of borders) {
    const numeric = substitute(coefficients, k);
    const roots = polyRoots(numeric);
    const omegas = roots
      .filter(
        (r) => Math.abs(r.value.re) <= 1e-7 * Math.max(1, C.abs(r.value)) && r.value.im > 1e-9,
      )
      .map((r) => r.value.im);
    const zero = roots.some((r) => C.abs(r.value) <= 1e-9);
    criticalInfo.push({ value: k, omega: omegas });
    const numericArray = routhArray(
      numeric.map((c) => uFromPoly([c])),
      null,
    );
    const aux = numericArray.ok ? numericArray.array.rows.find((r) => r.auxiliary) : undefined;
    criticalSteps.push({
      title: `${parameter} = ${formatNumber(k, DIGITS)}`,
      explanation: omegas.length
        ? `Con este valor un renglón del arreglo se hace todo cero: el sistema queda marginalmente estable y oscila con amplitud constante. El polinomio auxiliar da las raíces sobre el eje imaginario.`
        : zero
          ? 'Con este valor el término independiente es 0: aparece una raíz en s = 0.'
          : 'Con este valor un elemento de la primera columna se anula.',
      formula:
        aux && numericArray.ok
          ? `P(s) = ${auxiliaryPolyTex(aux.auxiliary!.coefficients, aux.auxiliary!.power, numericArray.array)} = 0`
          : undefined,
      result: omegas.length
        ? `s = \\pm j${omegas.map(n).join(',\\ \\pm j')},\\quad \\omega = ${omegas.map(n).join(',\\ ')}\\ \\text{rad/s}`
        : undefined,
    });
  }
  if (criticalSteps.length) steps.push({ title: 'Valores críticos', children: criticalSteps });
  return { intervals, criticalInfo, intervalTex, steps };
}
