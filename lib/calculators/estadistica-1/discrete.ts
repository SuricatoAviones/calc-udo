/**
 * Núcleo común de las distribuciones discretas: dada la función de probabilidad p(x) de un
 * modelo (binomial, Poisson…), calcula P(X = k), P(X ≤ k), P(X < k), P(X ≥ k), P(X > k) o
 * P(a ≤ X ≤ b) como suma de términos, igual que con las tablas del libro. Cuando la suma
 * directa tiene muchos términos (o infinitos), usa el complemento: P(X ≥ k) = 1 − P(X ≤ k − 1).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type CalculatorResult,
  type Latex,
  type Step,
  type SummaryItem,
} from '../types';

export const discreteQueryTypes = [
  'igual',
  'menor-igual',
  'menor',
  'mayor-igual',
  'mayor',
  'entre',
] as const;
export type DiscreteQuery = (typeof discreteQueryTypes)[number];

const nonNegativeInteger = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .int(`${label} debe ser un número entero.`)
    .min(0, `${label} no puede ser negativo.`);

export const discreteQueryShape = {
  query: z.enum(discreteQueryTypes, { error: 'Elige qué probabilidad calcular.' }),
  k: nonNegativeInteger('el valor k'),
  k2: nonNegativeInteger('el límite superior').optional(),
};

/** Refinamiento: con "entre" hace falta k2 ≥ k. */
export const betweenIsValid = (v: { query: DiscreteQuery; k: number; k2?: number | undefined }) =>
  v.query !== 'entre' || (v.k2 !== undefined && v.k2 >= v.k);
export const betweenError = {
  message: 'Para P(a ≤ X ≤ b) indica un límite superior b mayor o igual que a.',
  path: ['k2'],
};

export interface DiscreteQueryInput {
  query: DiscreteQuery;
  k: number;
  k2?: number | undefined;
}

export interface DiscreteModel {
  /** Nombre del modelo en el texto: "binomial". */
  name: string;
  /** Mayor valor posible de X (`Infinity` si no hay). */
  max: number;
  pmf(x: number): number;
  /** Notación de la función de probabilidad con sus parámetros: `b(x;\ 15, 0.4)`. */
  notation(x: string): Latex;
  /** Fórmula general de p(x). */
  pmfFormula: Latex;
  /** Sustitución de p(x) con números para un x concreto. */
  pmfSubstitution(x: number): Latex;
  mean: number;
  variance: number;
  meanFormula: Latex;
  varianceFormula: Latex;
  /** Explicación de cuándo aplica el modelo. */
  explanation: string;
}

export interface DiscreteValue {
  probability: number;
  mean: number;
  variance: number;
  standardDeviation: number;
}

export type DiscreteErrorCode = never;

const n = toLatexNumber;
/** Con más términos que esto se muestra solo el valor de cada uno, sin sustitución. */
const SUBSTITUTED_TERMS = 3;
const MAX_TABLE_ROWS = 120;

/** Intervalo [a, b] de valores de X que pide la consulta. */
function interval(input: DiscreteQueryInput, max: number): [number, number] {
  const { query, k } = input;
  switch (query) {
    case 'igual':
      return [k, k];
    case 'menor-igual':
      return [0, k];
    case 'menor':
      return [0, k - 1];
    case 'mayor-igual':
      return [k, max];
    case 'mayor':
      return [k + 1, max];
    case 'entre':
      return [k, input.k2 ?? k];
  }
}

function queryLatex(input: DiscreteQueryInput): Latex {
  const { query, k } = input;
  switch (query) {
    case 'igual':
      return `P(X = ${k})`;
    case 'menor-igual':
      return `P(X \\le ${k})`;
    case 'menor':
      return `P(X < ${k})`;
    case 'mayor-igual':
      return `P(X \\ge ${k})`;
    case 'mayor':
      return `P(X > ${k})`;
    case 'entre':
      return `P(${k} \\le X \\le ${input.k2 ?? k})`;
  }
}

function range(a: number, b: number): number[] {
  return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
}

export function solveDiscrete(
  input: DiscreteQueryInput,
  model: DiscreteModel,
): CalculatorResult<DiscreteValue, DiscreteErrorCode> {
  const target = queryLatex(input);
  const [a, bRaw] = interval(input, model.max);
  const b = Math.min(bRaw, model.max);

  const steps: Step[] = [
    {
      title: `Distribución ${model.name}`,
      explanation: model.explanation,
      formula: `${model.notation('x')} = ${model.pmfFormula}`,
    },
  ];

  // ¿Suma directa o complemento? Se elige la que tiene menos términos (o finitos).
  const direct = a > b || !Number.isFinite(b) ? [] : range(a, b);
  const complementTerms = [
    ...range(0, a - 1),
    ...(Number.isFinite(model.max) ? range(b + 1, model.max) : []),
  ];
  // Con soporte infinito (Poisson) el complemento de un intervalo acotado tiene infinitos
  // términos, así que solo se usa cuando lo pedido es la cola derecha (b = ∞).
  const useComplement =
    a <= b &&
    (!Number.isFinite(b) || (Number.isFinite(model.max) && complementTerms.length < direct.length));

  let probability: number;
  if (a > b) {
    probability = 0;
    steps.push({
      title: 'Plantear la probabilidad',
      explanation: `Ningún valor posible de X cumple la condición, así que la probabilidad es 0.`,
      result: `${target} = 0`,
    });
  } else {
    const terms = useComplement ? complementTerms : direct;
    const values = terms.map((x) => model.pmf(x));
    const sum = values.reduce((s, v) => s + v, 0);
    probability = useComplement ? 1 - sum : sum;

    const rangeText = (xs: number[]) => {
      if (xs.length === 1) return `${model.notation(String(xs[0]))}`;
      const contiguous = xs.every((x, i) => i === 0 || x === xs[i - 1]! + 1);
      return contiguous
        ? `\\sum_{x=${xs[0]}}^{${xs.at(-1)}} ${model.notation('x')}`
        : xs.map((x) => model.notation(String(x))).join(' + ');
    };

    steps.push({
      title: 'Plantear la probabilidad',
      explanation: useComplement
        ? 'Es más corto calcular el complemento: la probabilidad de los valores que NO cumplen la condición, y restarla de 1.'
        : terms.length === 1
          ? undefined
          : 'Es la suma de la función de probabilidad en cada valor que cumple la condición.',
      formula: useComplement
        ? `${target} = 1 - \\left[${rangeText(terms)}\\right]`
        : `${target} = ${rangeText(terms)}`,
    });

    const detailed = terms.slice(0, SUBSTITUTED_TERMS).map((x) => ({
      title: `Evaluar en x = ${x}`,
      formula: `${model.notation(String(x))} = ${model.pmfSubstitution(x)}`,
      result: `${model.notation(String(x))} = ${n(model.pmf(x))}`,
    }));
    const rest =
      terms.length > SUBSTITUTED_TERMS
        ? [
            {
              title: `Los otros ${terms.length - SUBSTITUTED_TERMS} términos`,
              explanation: 'Se calculan igual; sus valores están en la tabla de resultados.',
              result:
                terms
                  .slice(SUBSTITUTED_TERMS, SUBSTITUTED_TERMS + 6)
                  .map(
                    (x, i) =>
                      `${model.notation(String(x))} = ${n(values[SUBSTITUTED_TERMS + i]!, 6)}`,
                  )
                  .join(',\\quad ') + (terms.length > SUBSTITUTED_TERMS + 6 ? ',\\ \\ldots' : ''),
            },
          ]
        : [];
    steps.push({ title: 'Calcular cada término', children: [...detailed, ...rest] });

    steps.push({
      title: useComplement
        ? 'Sumar los términos y restar de 1'
        : terms.length === 1
          ? 'Resultado'
          : 'Sumar los términos',
      substitution:
        terms.length > 1 || useComplement
          ? useComplement
            ? `${target} = 1 - ${n(sum)}`
            : `${target} = ${values.length <= 8 ? values.map((v) => n(v, 6)).join(' + ') : n(sum)}`
          : undefined,
      result: `${target} = ${n(probability)}`,
    });
  }

  const standardDeviation = Math.sqrt(model.variance);
  steps.push({
    title: 'Media, varianza y desviación estándar',
    formula: `\\mu = ${model.meanFormula}, \\qquad \\sigma^2 = ${model.varianceFormula}`,
    result: `\\mu = ${n(model.mean)}, \\qquad \\sigma^2 = ${n(model.variance)}, \\qquad \\sigma = ${n(standardDeviation)}`,
  });

  // Tabla y gráfica: todos los valores con probabilidad apreciable y los de la consulta.
  const upper = Number.isFinite(model.max)
    ? model.max
    : Math.max(b === Infinity ? a : b, Math.ceil(model.mean + 10 * standardDeviation + 10));
  let cumulative = 0;
  const rows: { x: number; px: number; cumulative: number }[] = [];
  for (let x = 0; x <= upper && rows.length < MAX_TABLE_ROWS; x++) {
    const px = model.pmf(x);
    cumulative += px;
    const inQuery = x >= a && x <= b;
    if (px >= 1e-6 || inQuery || x <= 1) rows.push({ x, px, cumulative });
  }

  const summary: SummaryItem[] = [
    { label: 'Probabilidad', value: `${target} = ${n(probability, 6)}`, emphasis: true },
    { label: 'Media', value: `\\mu = ${n(model.mean, 6)}` },
    { label: 'Varianza', value: `\\sigma^2 = ${n(model.variance, 6)}` },
    { label: 'Desviación estándar', value: `\\sigma = ${n(standardDeviation, 6)}` },
  ];

  return {
    ok: true,
    value: { probability, mean: model.mean, variance: model.variance, standardDeviation },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'distribucion',
        title: `Distribución ${model.name}`,
        columns: [
          { key: 'x', header: 'x' },
          { key: 'px', header: 'P(X = x)' },
          { key: 'cumulative', header: 'P(X \\le x)' },
        ],
        rows,
      },
    ],
    series: [
      {
        id: 'distribucion',
        title: `Función de probabilidad (${formatNumber(probability, 4)} resaltado)`,
        xLabel: 'x',
        yLabel: 'P(X = x)',
        kind: 'bar',
        points: rows.map((r) => ({ x: r.x, y: r.px })),
        highlight: a <= b ? { from: a, to: Number.isFinite(b) ? b : upper } : undefined,
      },
    ],
  };
}

/** ln(k!) con una tabla calculada una sola vez. */
const lnFactorials: number[] = [0];
export function lnFactorial(k: number): number {
  for (let i = lnFactorials.length; i <= k; i++)
    lnFactorials[i] = lnFactorials[i - 1]! + Math.log(i);
  return lnFactorials[k]!;
}

/** Combinaciones C(n, k), exactas mientras quepan en un double. */
export function combinations(total: number, k: number): number {
  if (k < 0 || k > total) return 0;
  let result = 1;
  const m = Math.min(k, total - k);
  for (let i = 1; i <= m; i++) result = (result * (total - m + i)) / i;
  return Math.round(result);
}
