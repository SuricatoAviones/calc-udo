/**
 * Núcleo común de las distribuciones continuas (uniforme, exponencial, gamma, beta, Weibull):
 * dada la densidad f(x) y la función de distribución F(x) = P(X ≤ x) de un modelo, calcula
 * P(X < x), P(X > x) = 1 − F(x) o P(a < X < b) = F(b) − F(a), como en Walpole, cap. 6. En una
 * variable continua P(X = x) = 0, así que da lo mismo usar < o ≤.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type CalculatorResult, type Latex, type Step } from '../types';

export const continuousQueryTypes = ['menor', 'mayor', 'entre'] as const;
export type ContinuousQuery = (typeof continuousQueryTypes)[number];

export const finiteNumber = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`);

export const positiveNumber = (label: string) =>
  finiteNumber(label).refine((v) => v > 0, `${label} debe ser mayor que 0.`);

export const continuousQueryShape = {
  query: z.enum(continuousQueryTypes, { error: 'Elige qué probabilidad calcular.' }),
  x: finiteNumber('el valor x'),
  x2: finiteNumber('el límite superior').optional(),
};

/** Refinamiento: con "entre" hace falta b > a. */
export const continuousBetweenIsValid = (v: { query: ContinuousQuery; x: number; x2?: number }) =>
  v.query !== 'entre' || (v.x2 !== undefined && v.x2 > v.x);
export const continuousBetweenError = {
  message: 'Para P(a < X < b) indica un límite superior b mayor que a.',
  path: ['x2'],
};

export interface ContinuousQueryInput {
  query: ContinuousQuery;
  x: number;
  x2?: number | undefined;
}

export interface ContinuousModel {
  /** Nombre del modelo en el texto: "exponencial". */
  name: string;
  /** Valores posibles de X, [mín, máx] (pueden ser infinitos). */
  support: [number, number];
  pdf(x: number): number;
  cdf(x: number): number;
  /** Densidad con su soporte, sin `f(x) =`: `\frac{1}{\beta} e^{-x/\beta}, \quad x > 0`. */
  pdfFormula: Latex;
  /** F(x) dentro del soporte, sin `F(x) =`. */
  cdfFormula: Latex;
  /** Cómo se obtiene F(x): forma cerrada, tabla, relación con otra distribución… */
  cdfExplanation?: string;
  /** F en un x del soporte con los números sustituidos (sin el resultado). */
  cdfSubstitution(x: number): Latex;
  mean: number;
  variance: number;
  /** Fórmula general = sustitución, sin `μ =`: `\beta = 4`. */
  meanFormula: Latex;
  varianceFormula: Latex;
  /** Qué modela la distribución y qué significan sus parámetros. */
  explanation: string;
}

export interface ContinuousValue {
  probability: number;
  /** F en cada límite de la consulta. */
  cdf: number[];
  mean: number;
  variance: number;
  standardDeviation: number;
}

export type ContinuousErrorCode = never;

const n = toLatexNumber;
const POINTS = 200;

function queryLatex({ query, x, x2 }: ContinuousQueryInput): Latex {
  if (query === 'menor') return `P(X < ${n(x)})`;
  if (query === 'mayor') return `P(X > ${n(x)})`;
  return `P(${n(x)} < X < ${n(x2 ?? x)})`;
}

/** Rango de la gráfica: el soporte, recortado a ±4σ de la media si es infinito. */
function plotRange(model: ContinuousModel, limits: number[]): [number, number] {
  const sd = Math.sqrt(model.variance);
  const [lo, hi] = model.support;
  let from = Number.isFinite(lo) ? lo : model.mean - 4 * sd;
  let to = Number.isFinite(hi) ? hi : model.mean + 4 * sd;
  for (const v of limits) {
    if (v > lo && v < hi) {
      from = Math.min(from, v);
      to = Math.max(to, v);
    }
  }
  if (!Number.isFinite(hi)) to += (to - from) * 0.05;
  return [from, to];
}

export function solveContinuous(
  input: ContinuousQueryInput,
  model: ContinuousModel,
): CalculatorResult<ContinuousValue, ContinuousErrorCode> {
  const { query } = input;
  const limits = query === 'entre' ? [input.x, input.x2 ?? input.x] : [input.x];
  const values = limits.map((v) => model.cdf(v));
  const target = queryLatex(input);
  const probability =
    query === 'menor'
      ? values[0]!
      : query === 'mayor'
        ? 1 - values[0]!
        : Math.max(0, values[1]! - values[0]!);
  const [lo, hi] = model.support;

  const evaluate: Step[] = limits.map((v, i) => {
    const F = values[i]!;
    if (v <= lo) {
      return {
        title: `Evaluar F(${formatNumber(v)})`,
        explanation: `x = ${formatNumber(v)} está a la izquierda del soporte de X: no hay área a su izquierda.`,
        result: `F(${n(v)}) = 0`,
      };
    }
    if (v >= hi) {
      return {
        title: `Evaluar F(${formatNumber(v)})`,
        explanation: `x = ${formatNumber(v)} está a la derecha del soporte de X: toda el área queda a su izquierda.`,
        result: `F(${n(v)}) = 1`,
      };
    }
    return {
      title: `Evaluar F(${formatNumber(v)})`,
      substitution: `F(${n(v)}) = ${model.cdfSubstitution(v)}`,
      result: `F(${n(v)}) = ${n(F)}`,
    };
  });

  const standardDeviation = Math.sqrt(model.variance);
  const steps: Step[] = [
    {
      title: `Distribución ${model.name}`,
      explanation: model.explanation,
      formula: `f(x) = ${model.pdfFormula}`,
    },
    {
      title: 'Función de distribución acumulada',
      explanation:
        model.cdfExplanation ??
        'F(x) = P(X ≤ x) es el área bajo la densidad a la izquierda de x: la integral de f desde el inicio del soporte hasta x.',
      formula: `F(x) = ${model.cdfFormula}`,
    },
    ...evaluate,
    {
      title: 'Calcular la probabilidad',
      explanation:
        query === 'menor'
          ? 'Es el área a la izquierda de x: F(x). Como X es continua, P(X < x) = P(X ≤ x).'
          : query === 'mayor'
            ? 'Es el área a la derecha de x: el complemento de F(x).'
            : 'Es el área entre a y b: lo acumulado hasta b menos lo acumulado hasta a.',
      formula:
        query === 'menor'
          ? `${target} = F(x)`
          : query === 'mayor'
            ? `${target} = 1 - F(x)`
            : `${target} = F(b) - F(a)`,
      substitution:
        query === 'menor'
          ? undefined
          : query === 'mayor'
            ? `${target} = 1 - ${n(values[0]!)}`
            : `${target} = ${n(values[1]!)} - ${n(values[0]!)}`,
      result: `${target} = ${n(probability)}`,
    },
    {
      title: 'Media, varianza y desviación estándar',
      formula: `\\mu = ${model.meanFormula}, \\qquad \\sigma^2 = ${model.varianceFormula}`,
      result: `\\mu = ${n(model.mean)}, \\qquad \\sigma^2 = ${n(model.variance)}, \\qquad \\sigma = ${n(standardDeviation)}`,
    },
  ];

  const [from, to] = plotRange(model, limits);
  const density = Array.from({ length: POINTS + 1 }, (_, k) => {
    const x = from + ((to - from) * k) / POINTS;
    return { x, y: model.pdf(x) };
  });
  const highlight =
    query === 'menor'
      ? { from, to: Math.min(input.x, to) }
      : query === 'mayor'
        ? { from: Math.max(input.x, from), to }
        : { from: Math.max(input.x, from), to: Math.min(input.x2 ?? input.x, to) };

  return {
    ok: true,
    value: {
      probability,
      cdf: values,
      mean: model.mean,
      variance: model.variance,
      standardDeviation,
    },
    summary: [
      { label: 'Probabilidad', value: `${target} = ${n(probability, 6)}`, emphasis: true },
      { label: 'Media', value: `\\mu = ${n(model.mean, 6)}` },
      { label: 'Varianza', value: `\\sigma^2 = ${n(model.variance, 6)}` },
      { label: 'Desviación estándar', value: `\\sigma = ${n(standardDeviation, 6)}` },
    ],
    ...emptyTrace(),
    steps,
    series: [
      {
        id: 'densidad',
        title: `Densidad ${model.name} con el área pedida`,
        xLabel: 'x',
        yLabel: 'f(x)',
        points: density,
        highlight: highlight.from < highlight.to ? highlight : undefined,
      },
    ],
  };
}
