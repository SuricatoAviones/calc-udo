/**
 * Criterio de estabilidad de Routh-Hurwitz: arreglo de Routh, casos especiales (ε y polinomio
 * auxiliar), número de raíces en el semiplano derecho y, si el polinomio tiene un parámetro
 * (la ganancia K), el intervalo de estabilidad y la ganancia y la frecuencia críticas.
 *
 * Fuentes: Ogata, 3.ª ed., sec. 5-5 (ejemplos 5-1 y 5-2, los casos especiales y el sistema de la
 * figura 5-24); Ogata, 3.ª ed., ejemplo 6-1 (cruce con el eje imaginario por Routh).
 */
import { z } from 'zod';
import { toLatexNumber, toLatexRational } from '@/lib/math/format';
import { polyRoots } from '@/lib/math/polynomials';
import type { Calculator, CalculatorResult, Notice, Step, SummaryItem } from '../types';
import {
  analyzeSigns,
  parameterStability,
  polynomialTex,
  routhArray,
  routhTable,
  substitute,
  variableTex,
  type RouthErrorCode,
} from './routh';
import {
  mpCollect,
  mpConstant,
  mpSymbols,
  mpToUnivariate,
  parsePolynomial,
  symbolTex,
} from './symbolic';
import { polyTex, rootsText } from './transfer-function';
import { uFromPoly, uIsConstant, uIsZero, uTex, uValue, type URat } from './urat';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

const inputSchema = z.object({
  polynomial: z
    .string()
    .trim()
    .min(1, 'Escribe el polinomio característico.')
    .max(200, 'El polinomio es demasiado largo.'),
});

export type RouthInput = z.infer<typeof inputSchema>;

export interface RouthValue {
  degree: number;
  /** Raíces con parte real positiva (cambios de signo de la primera columna). */
  rightHalf: number | null;
  /** Raíces sobre el eje imaginario (polinomio auxiliar y raíces en el origen). */
  imaginary: number | null;
  stable: boolean | null;
  parameter: string | null;
  /** Intervalos del parámetro con estabilidad: [desde, hasta] (null = infinito). */
  intervals: [number | null, number | null][];
  /** Valores críticos del parámetro con raíces sobre el eje jω y la frecuencia de oscilación. */
  critical: { value: number; omega: number[] }[];
  firstColumn: string[];
  /** Valor numérico de cada elemento constante de la primera columna (null si depende de algo). */
  firstColumnValues: (number | null)[];
}

export type RouthCalculatorErrorCode =
  | RouthErrorCode
  | 'polinomio-invalido'
  | 'sin-variable-s'
  | 'demasiados-parametros'
  | 'grado-excesivo';

const MAX_DEGREE = 12;

function fail(
  code: RouthCalculatorErrorCode,
  message: string,
  steps: Step[] = [],
): CalculatorResult<RouthValue, RouthCalculatorErrorCode> {
  return {
    ok: false,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

export function solveRouth(
  input: RouthInput,
): CalculatorResult<RouthValue, RouthCalculatorErrorCode> {
  const parsed = parsePolynomial(input.polynomial);
  if (!parsed.ok) return fail('polinomio-invalido', parsed.message);
  const symbols = mpSymbols(parsed.poly);
  if (!symbols.includes('s'))
    return fail('sin-variable-s', 'El polinomio debe estar escrito en la variable s.');
  const others = symbols.filter((v) => v !== 's');
  if (others.length > 1) {
    return fail(
      'demasiados-parametros',
      `Solo se admite un parámetro además de s; hay ${others.join(', ')}.`,
    );
  }
  const parameter = others[0] ?? null;
  const collected = mpCollect(parsed.poly, 's');
  let coefficients: URat[] = collected.map((c) =>
    uFromPoly(parameter ? mpToUnivariate(c, parameter)! : [mpConstant(c) ?? 0]),
  );
  if (coefficients.length - 1 > MAX_DEGREE)
    return fail('grado-excesivo', `El grado máximo es ${MAX_DEGREE}.`);

  const steps: Step[] = [];
  const notices: Notice[] = [];
  const pTex = parameter ? symbolTex(parameter) : '';
  const coefTex = (c: URat) => uTex(c, pTex || 'K');

  // Raíces en el origen: coeficientes finales nulos.
  let zeroRoots = 0;
  while (coefficients.length > 1 && uIsZero(coefficients[coefficients.length - 1]!)) {
    coefficients = coefficients.slice(0, -1);
    zeroRoots++;
  }
  const degree = coefficients.length - 1 + zeroRoots;
  steps.push({
    title: 'Ecuación característica',
    explanation: [
      `Grado ${degree}.`,
      parameter && `Los coeficientes dependen del parámetro ${parameter}.`,
      zeroRoots > 0 &&
        `Tiene ${zeroRoots === 1 ? 'una raíz' : `${zeroRoots} raíces`} en s = 0 (el término independiente es 0): se factoriza s${zeroRoots > 1 ? `^${zeroRoots}` : ''} y se analiza el resto, como pide Ogata (aₙ ≠ 0).`,
    ]
      .filter(Boolean)
      .join(' '),
    formula: `${
      zeroRoots
        ? `s${zeroRoots > 1 ? `^{${zeroRoots}}` : ''}\\left(${polynomialTex(coefficients, pTex)}\\right)`
        : polynomialTex(coefficients, pTex)
    } = 0`,
    result: `a_0, a_1, \\ldots = ${coefficients.map(coefTex).join(',\\ ')}`,
  });
  if (coefficients.length - 1 < 1) {
    return fail(
      'grado-insuficiente',
      'Después de factorizar las raíces en s = 0 no queda polinomio que analizar.',
      steps,
    );
  }

  // Condición necesaria (todos los coeficientes presentes y del mismo signo).
  if (!parameter) {
    const values = coefficients.map(uValue);
    const allSame = values.every((v) => v > 0) || values.every((v) => v < 0);
    steps.push({
      title: 'Condición necesaria',
      explanation: allSame
        ? 'Todos los coeficientes están presentes y tienen el mismo signo: la condición necesaria se cumple (no es suficiente; falta el arreglo).'
        : 'Hay coeficientes nulos o de distinto signo: el polinomio tiene raíces imaginarias o con parte real positiva, así que el sistema no es estable. Se arma el arreglo para contar cuántas raíces hay en el semiplano derecho.',
    });
  }

  const outcome = routhArray(coefficients, parameter);
  if (!outcome.ok) return fail(outcome.code, outcome.message, [...steps, ...outcome.steps]);
  const { array } = outcome;
  steps.push(...array.steps);
  const tables = [routhTable(array)];
  const first = array.rows.map((r) => r.entries[0]!);
  const firstColumn = first.map((e) => uTex(e, variableTex(array)));
  const firstColumnValues = first.map((e) => (uIsConstant(e) ? uValue(e) : null));
  const summary: SummaryItem[] = [];

  if (!parameter) {
    const analysis = analyzeSigns(array);
    const rightHalf = analysis.changes;
    const imaginary = analysis.imaginary + zeroRoots;
    const stable = rightHalf === 0 && imaginary === 0;
    steps.push({
      title: 'Primera columna y cambios de signo',
      explanation: `${
        array.variable === 'epsilon' ? 'Con ε → 0⁺, los' : 'Los'
      } signos de la primera columna son ${analysis.signs.map((s) => (s > 0 ? '+' : s < 0 ? '−' : '0')).join(', ')}: hay ${rightHalf} ${
        rightHalf === 1 ? 'cambio' : 'cambios'
      } de signo, así que ${rightHalf === 1 ? 'hay una raíz' : `hay ${rightHalf} raíces`} con parte real positiva.`,
      result: `\\text{Primera columna: } ${firstColumn.join(',\\ ')}`,
    });
    if (analysis.auxiliaryRoots.length) {
      steps.push({
        title: 'Raíces del polinomio auxiliar',
        explanation: `Son raíces del polinomio original, simétricas respecto al origen: ${rootsText(analysis.auxiliaryRoots)}.`,
      });
    }
    const verification = polyRoots(substitute(coefficients, 0));
    const right = verification
      .filter((r) => r.value.re > 1e-9)
      .reduce((s, r) => s + r.multiplicity, 0);
    steps.push({
      title: 'Verificación con las raíces',
      explanation: `Raíces del polinomio${zeroRoots ? ' (sin las de s = 0)' : ''}: ${rootsText(verification)}. ${
        right === rightHalf
          ? 'Coincide con el criterio.'
          : 'No coincide con el conteo de la primera columna.'
      }`,
    });
    if (right !== rightHalf) {
      notices.push({
        level: 'warning',
        message: 'El conteo de Routh no coincide con las raíces calculadas numéricamente.',
      });
    }
    const verdict = stable
      ? 'Estable: todas las raíces tienen parte real negativa.'
      : rightHalf > 0
        ? `Inestable: ${rightHalf} ${rightHalf === 1 ? 'raíz' : 'raíces'} con parte real positiva.`
        : 'Marginalmente estable: hay raíces sobre el eje imaginario y ninguna en el semiplano derecho.';
    summary.push(
      { label: 'Conclusión', value: `\\text{${verdict}}`, emphasis: true },
      { label: 'Semiplano derecho', value: `${rightHalf}` },
      { label: 'Eje imaginario', value: `${imaginary}` },
      { label: 'Semiplano izquierdo', value: `${degree - rightHalf - imaginary}` },
    );
    return {
      ok: true,
      value: {
        degree,
        rightHalf,
        imaginary,
        stable,
        parameter: null,
        intervals: [],
        critical: [],
        firstColumn,
        firstColumnValues,
      },
      summary,
      steps,
      tables,
      series: [],
      notices,
    };
  }

  // ─── Con parámetro: intervalo de estabilidad ──────────────────────────────
  const analysis = parameterStability(coefficients, array, parameter);
  steps.push(...analysis.steps);
  const { intervals, criticalInfo, intervalTex } = analysis;

  summary.push({
    label: 'Estabilidad',
    value: intervals.length
      ? intervals.map(([lo, hi]) => intervalTex(lo, hi)).join(',\\ ')
      : `\\text{inestable para todo } ${pTex}`,
    emphasis: true,
  });
  for (const c of criticalInfo.filter((x) => x.omega.length)) {
    summary.push({
      label: `${parameter} crítico`,
      value: `${pTex} = ${toLatexRational(c.value, DIGITS)},\\quad \\omega = ${c.omega.map(n).join(',\\ ')}\\ \\text{rad/s}`,
    });
  }
  return {
    ok: true,
    value: {
      degree,
      rightHalf: null,
      imaginary: null,
      stable: null,
      parameter,
      intervals,
      critical: criticalInfo,
      firstColumn,
      firstColumnValues,
    },
    summary,
    steps,
    tables,
    series: [],
    notices,
  };
}

export const routhHurwitz: Calculator<RouthInput, RouthValue, RouthCalculatorErrorCode> = {
  meta: {
    id: 'routh-hurwitz',
    title: 'Criterio de Routh-Hurwitz',
    summary: 'Tabla de Routh y número de raíces con parte real positiva.',
    citations: [
      {
        sourceId: 'ogata-1998',
        locator: 'Sec. 5-5, ejemplos 5-1 y 5-2, casos especiales y figura 5-24',
      },
      { sourceId: 'kuo-1996', locator: 'Sec. 6-5' },
    ],
  },
  inputSchema,
  // Ogata, ejemplo 5-2: dos cambios de signo, dos raíces con parte real positiva.
  example: { polynomial: 's^4 + 2s^3 + 3s^2 + 4s + 5' },
  solve: solveRouth,
};

export { polyTex };
