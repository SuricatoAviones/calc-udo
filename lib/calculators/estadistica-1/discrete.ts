/**
 * Núcleo común de las distribuciones discretas: dada la función de probabilidad p(x) de un
 * modelo (binomial, Poisson…), calcula P(X = k), P(X ≤ k), P(X < k), P(X ≥ k), P(X > k) o
 * P(a ≤ X ≤ b) como suma de términos, igual que con las tablas del libro. Cuando la suma
 * directa tiene muchos términos (o infinitos), usa el complemento: P(X ≥ k) = 1 − P(X ≤ k − 1).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type CalculatorResult, type Step, type SummaryItem } from '../types';

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
export const betweenIsValid = (v: { query: DiscreteQuery; k: number; k2?: number }) =>
  v.query !== 'entre' || (v.k2 !== undefined && v.k2 >= v.k);
export const betweenError = {
  message: 'Para P(a ≤ X ≤ b) indica un límite superior b mayor o igual que a.',
  path: ['k2'],
};

export interface DiscreteQueryInput {
  query: DiscreteQuery;
  k: number;
  k2?: number;
}

export interface DiscreteModel {
  /** Nombre del modelo en el texto: "binomial". */
  name: string;
  /** Menor valor posible de X (0 si se omite; 1 en la geométrica). */
  min?: number;
  /** Mayor valor posible de X (`Infinity` si no hay). */
  max: number;
  pmf(x: number): number;
  /** Notación de la función de probabilidad con sus parámetros: `b(x;\ 15, 0.4)`. */
  notation(x: string): string;
  /** Fórmula general de p(x). */
  pmfFormula: string;
  /** Sustitución de p(x) con números para un x concreto. */
  pmfSubstitution(x: number): string;
  mean: number;
  variance: number;
  meanFormula: string;
  varianceFormula: string;
  /** Explicación de cuándo aplica el modelo. */
  explanation: string;
}

export interface DiscreteValue {
  probability: number;
  mean: number;
  variance: number;
  standardDeviation: number;
}

const n = toLatexNumber;
/** Con más términos que esto se muestra solo el valor de cada uno, sin sustitución. */
const SUBSTITUTED_TERMS = 3;
const MAX_TABLE_ROWS = 120;

/** Intervalo [a, b] de valores de X que pide la consulta. */
function interval(input: DiscreteQueryInput, min: number, max: number): [number, number] {
  const { query, k } = input;
  switch (query) {
    case 'igual':
      return [k, k];
    case 'menor-igual':
      return [min, k];
    case 'menor':
      return [min, k - 1];
    case 'mayor-igual':
      return [k, max];
    case 'mayor':
      return [k + 1, max];
    case 'entre':
      return [k, input.k2 ?? k];
  }
}

function queryLatex(input: DiscreteQueryInput): string {
  const { query, k } = input;
  switch (query) {
    case 'igual':
      return `P(X = ${k})`;
    case 'menor-igual':
      return String.raw`P(X \le ${k})`;
    case 'menor':
      return `P(X < ${k})`;
    case 'mayor-igual':
      return String.raw`P(X \ge ${k})`;
    case 'mayor':
      return `P(X > ${k})`;
    case 'entre':
      return String.raw`P(${k} \le X \le ${input.k2 ?? k})`;
  }
}

function range(a: number, b: number): number[] {
  return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
}

function setupExplanation(useComplement: boolean, single: boolean): string | undefined {
  if (useComplement) {
    return 'Es más corto calcular el complemento: la probabilidad de los valores que NO cumplen la condición, y restarla de 1.';
  }
  return single
    ? undefined
    : 'Es la suma de la función de probabilidad en cada valor que cumple la condición.';
}

function sumTitle(useComplement: boolean, single: boolean): string {
  if (useComplement) return 'Sumar los términos y restar de 1';
  return single ? 'Resultado' : 'Sumar los términos';
}

function sumSubstitution(
  target: string,
  values: number[],
  sum: number,
  useComplement: boolean,
): string | undefined {
  if (useComplement) return `${target} = 1 - ${n(sum)}`;
  if (values.length <= 1) return undefined;
  const added = values.length <= 8 ? values.map((v) => n(v, 6)).join(' + ') : n(sum);
  return `${target} = ${added}`;
}

/** Suma de p(x) en los valores pedidos (o en su complemento, restada de 1), con sus pasos. */
function sumSteps(
  model: DiscreteModel,
  target: string,
  terms: number[],
  useComplement: boolean,
): { probability: number; steps: Step[] } {
  const values = terms.map((x) => model.pmf(x));
  const sum = values.reduce((s, v) => s + v, 0);
  const probability = useComplement ? 1 - sum : sum;
  const single = terms.length === 1;

  const rangeText = (xs: number[]) => {
    if (xs.length === 1) return `${model.notation(String(xs[0]))}`;
    const contiguous = xs.every((x, i) => i === 0 || x === xs[i - 1]! + 1);
    return contiguous
      ? String.raw`\sum_{x=${xs[0]}}^{${xs.at(-1)}} ${model.notation('x')}`
      : xs.map((x) => model.notation(String(x))).join(' + ');
  };

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
                .join(String.raw`,\quad `) +
              (terms.length > SUBSTITUTED_TERMS + 6 ? String.raw`,\ \ldots` : ''),
          },
        ]
      : [];
  return {
    probability,
    steps: [
      {
        title: 'Plantear la probabilidad',
        explanation: setupExplanation(useComplement, single),
        formula: useComplement
          ? String.raw`${target} = 1 - \left[${rangeText(terms)}\right]`
          : `${target} = ${rangeText(terms)}`,
      },
      { title: 'Calcular cada término', children: [...detailed, ...rest] },
      {
        title: sumTitle(useComplement, single),
        substitution: sumSubstitution(target, values, sum, useComplement),
        result: `${target} = ${n(probability)}`,
      },
    ],
  };
}

/** Filas de la tabla: los valores con probabilidad apreciable, los de la consulta y los dos primeros. */
function distributionRows(
  model: DiscreteModel,
  min: number,
  upper: number,
  [a, b]: [number, number],
): { x: number; px: number; cumulative: number }[] {
  let cumulative = 0;
  const rows: { x: number; px: number; cumulative: number }[] = [];
  for (let x = min; x <= upper && rows.length < MAX_TABLE_ROWS; x++) {
    const px = model.pmf(x);
    cumulative += px;
    const inQuery = x >= a && x <= b;
    if (px >= 1e-6 || inQuery || x <= min + 1) rows.push({ x, px, cumulative });
  }
  return rows;
}

export function solveDiscrete(
  input: DiscreteQueryInput,
  model: DiscreteModel,
): CalculatorResult<DiscreteValue, never> {
  const target = queryLatex(input);
  const min = model.min ?? 0;
  const [aRaw, bRaw] = interval(input, min, model.max);
  const a = Math.max(aRaw, min);
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
    ...range(min, a - 1),
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
    const summed = sumSteps(model, target, useComplement ? complementTerms : direct, useComplement);
    probability = summed.probability;
    steps.push(...summed.steps);
  }

  const standardDeviation = Math.sqrt(model.variance);
  steps.push({
    title: 'Media, varianza y desviación estándar',
    formula: String.raw`\mu = ${model.meanFormula}, \qquad \sigma^2 = ${model.varianceFormula}`,
    result: String.raw`\mu = ${n(model.mean)}, \qquad \sigma^2 = ${n(model.variance)}, \qquad \sigma = ${n(standardDeviation)}`,
  });

  // Tabla y gráfica: todos los valores con probabilidad apreciable y los de la consulta.
  const lastQueried = b === Infinity ? a : b;
  const upper = Number.isFinite(model.max)
    ? model.max
    : Math.max(lastQueried, Math.ceil(model.mean + 10 * standardDeviation + 10));
  const rows = distributionRows(model, min, upper, [a, b]);

  const summary: SummaryItem[] = [
    { label: 'Probabilidad', value: `${target} = ${n(probability, 6)}`, emphasis: true },
    { label: 'Media', value: String.raw`\mu = ${n(model.mean, 6)}` },
    { label: 'Varianza', value: String.raw`\sigma^2 = ${n(model.variance, 6)}` },
    { label: 'Desviación estándar', value: String.raw`\sigma = ${n(standardDeviation, 6)}` },
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
          { key: 'cumulative', header: String.raw`P(X \le x)` },
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
