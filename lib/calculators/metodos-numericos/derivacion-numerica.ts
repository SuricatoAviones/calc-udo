/**
 * Derivación numérica con diferencias finitas (Chapra & Canale, sec. 4.1.3 y 23.1; figuras 23.1 a
 * 23.3). Cada fórmula es una combinación de valores de f en x_i + k·h:
 *
 *   Primera derivada                                   Segunda derivada
 *   adelante O(h):  [f(x_{i+1}) − f(x_i)] / h            [f(x_{i+2}) − 2f(x_{i+1}) + f(x_i)] / h²
 *   atrás O(h):     [f(x_i) − f(x_{i−1})] / h            [f(x_i) − 2f(x_{i−1}) + f(x_{i−2})] / h²
 *   centrada O(h²): [f(x_{i+1}) − f(x_{i−1})] / 2h       [f(x_{i+1}) − 2f(x_i) + f(x_{i−1})] / h²
 *
 * y las versiones de alta exactitud (un término más de la serie de Taylor): adelante y atrás O(h²),
 * centrada O(h⁴). El valor verdadero se obtiene derivando f simbólicamente.
 */
import { z } from 'zod';
import { differentiate, parseFunction } from '@/lib/math/expression';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type SummaryItem,
} from '../types';
import { expressionField, finiteNumber } from './root-finding';

export const derivativeOrders = ['primera', 'segunda'] as const;
export const accuracyLevels = ['basica', 'alta'] as const;
type Direction = 'adelante' | 'atras' | 'centrada';

export const numericalDerivativeInputSchema = z.object({
  expression: expressionField,
  x: finiteNumber('x'),
  h: finiteNumber('h').refine((v) => v > 0, 'h debe ser mayor que 0.'),
  derivative: z.enum(derivativeOrders, { error: 'Elige la derivada.' }),
  accuracy: z.enum(accuracyLevels, { error: 'Elige la exactitud.' }),
});

export type NumericalDerivativeInput = z.infer<typeof numericalDerivativeInputSchema>;

export interface DerivativeEstimate {
  direction: Direction;
  value: number;
  /** ε_t (%), `null` si la derivada verdadera es 0 o no se pudo calcular. */
  trueRelativeError: number | null;
}

export interface NumericalDerivativeValue {
  estimates: DerivativeEstimate[];
  trueValue: number | null;
}

export type NumericalDerivativeErrorCode = 'invalid-expression' | 'non-finite';

interface Formula {
  direction: Direction;
  name: string;
  /** Orden del error de truncamiento, en LaTeX: `O(h^2)`. */
  order: string;
  offsets: number[];
  coefficients: number[];
  /** Denominador numérico que multiplica a h (o h²): 2 en 2h, 12 en 12h. */
  divisor: number;
}

const FORMULAS: Record<(typeof derivativeOrders)[number], Record<(typeof accuracyLevels)[number], Formula[]>> = {
  primera: {
    basica: [
      { direction: 'adelante', name: 'Diferencia hacia adelante', order: 'O(h)', offsets: [1, 0], coefficients: [1, -1], divisor: 1 },
      { direction: 'atras', name: 'Diferencia hacia atrás', order: 'O(h)', offsets: [0, -1], coefficients: [1, -1], divisor: 1 },
      { direction: 'centrada', name: 'Diferencia centrada', order: 'O(h^2)', offsets: [1, -1], coefficients: [1, -1], divisor: 2 },
    ],
    alta: [
      { direction: 'adelante', name: 'Diferencia hacia adelante', order: 'O(h^2)', offsets: [2, 1, 0], coefficients: [-1, 4, -3], divisor: 2 },
      { direction: 'atras', name: 'Diferencia hacia atrás', order: 'O(h^2)', offsets: [0, -1, -2], coefficients: [3, -4, 1], divisor: 2 },
      { direction: 'centrada', name: 'Diferencia centrada', order: 'O(h^4)', offsets: [2, 1, -1, -2], coefficients: [-1, 8, -8, 1], divisor: 12 },
    ],
  },
  segunda: {
    basica: [
      { direction: 'adelante', name: 'Diferencia hacia adelante', order: 'O(h)', offsets: [2, 1, 0], coefficients: [1, -2, 1], divisor: 1 },
      { direction: 'atras', name: 'Diferencia hacia atrás', order: 'O(h)', offsets: [0, -1, -2], coefficients: [1, -2, 1], divisor: 1 },
      { direction: 'centrada', name: 'Diferencia centrada', order: 'O(h^2)', offsets: [1, 0, -1], coefficients: [1, -2, 1], divisor: 1 },
    ],
    alta: [
      { direction: 'adelante', name: 'Diferencia hacia adelante', order: 'O(h^2)', offsets: [3, 2, 1, 0], coefficients: [-1, 4, -5, 2], divisor: 1 },
      { direction: 'atras', name: 'Diferencia hacia atrás', order: 'O(h^2)', offsets: [0, -1, -2, -3], coefficients: [2, -5, 4, -1], divisor: 1 },
      { direction: 'centrada', name: 'Diferencia centrada', order: 'O(h^4)', offsets: [2, 1, 0, -1, -2], coefficients: [-1, 16, -30, 16, -1], divisor: 12 },
    ],
  },
}; // prettier-ignore

const n = toLatexNumber;

function nodeName(offset: number): string {
  if (offset === 0) return 'x_i';
  return `x_{i${offset > 0 ? '+' : '-'}${Math.abs(offset)}}`;
}

/** Combinación lineal en LaTeX: `-f(x_{i+2}) + 4f(x_{i+1}) - 3f(x_i)`. */
function combination(coefficients: number[], terms: string[]): string {
  return coefficients
    .map((c, j) => {
      const abs = Math.abs(c);
      const body = `${abs === 1 ? '' : abs}${terms[j]}`;
      if (j === 0) return c < 0 ? `-${body}` : body;
      return c < 0 ? `- ${body}` : `+ ${body}`;
    })
    .join(' ');
}

export function solveNumericalDerivative(
  input: NumericalDerivativeInput,
): CalculatorResult<NumericalDerivativeValue, NumericalDerivativeErrorCode> {
  const parsed = parseFunction(input.expression);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: parsed.message },
      ...emptyTrace(),
    };
  }
  const f = parsed.expr;
  const { x, h } = input;
  const second = input.derivative === 'segunda';
  const symbol = second ? "f''" : "f'";
  const hPower = second ? 'h^2' : 'h';
  const formulas = FORMULAS[input.derivative][input.accuracy];

  // Derivada exacta, para el error verdadero.
  let trueValue: number | null = null;
  let trueTex: string | null = null;
  const d1 = differentiate(f);
  if (d1.ok) {
    const target = second ? differentiate(d1.expr) : d1;
    if (target.ok) {
      const value = target.expr.evaluate(x);
      trueValue = Number.isFinite(value) ? value : null;
      trueTex = target.expr.tex;
    }
  }

  const offsets = [...new Set(formulas.flatMap((form) => form.offsets))].sort((a, b) => a - b);
  const values = new Map(offsets.map((k) => [k, f.evaluate(x + k * h)]));
  const steps: Step[] = [
    {
      title: 'Función y puntos',
      explanation: `Se aproxima la ${second ? 'segunda' : 'primera'} derivada de f en xᵢ = ${formatNumber(x)} con paso h = ${formatNumber(h)}.`,
      formula: `f(x) = ${f.tex}`,
      result:
        trueValue === null
          ? undefined
          : `\\text{Valor verdadero: } ${symbol}(x) = ${trueTex}, \\quad ${symbol}(${n(x)}) = ${n(trueValue)}`,
    },
    {
      title: 'Evaluar f en los puntos necesarios',
      result: offsets.map((k) => `f(${n(x + k * h)}) = ${n(values.get(k)!)}`).join(',\\quad '),
    },
  ];

  const bad = offsets.find((k) => !Number.isFinite(values.get(k)!));
  if (bad !== undefined) {
    return {
      ok: false,
      error: {
        code: 'non-finite',
        message: `f(x) no tiene un valor real finito en x = ${formatNumber(x + bad * h)}.`,
      },
      ...emptyTrace(),
      steps,
    };
  }

  const estimates: DerivativeEstimate[] = formulas.map((form) => {
    const sum = form.coefficients.reduce((s, c, j) => s + c * values.get(form.offsets[j]!)!, 0);
    const denominator = form.divisor * (second ? h * h : h);
    const value = sum / denominator;
    const rel =
      trueValue === null || trueValue === 0 ? null : ((trueValue - value) / trueValue) * 100;
    const general = combination(
      form.coefficients,
      form.offsets.map((k) => `f(${nodeName(k)})`),
    );
    const numeric = combination(
      form.coefficients,
      form.offsets.map((k) => `(${n(values.get(k)!)})`),
    );
    steps.push({
      title: `${form.name}, ${form.order.replace('O(h^2)', 'O(h²)').replace('O(h^4)', 'O(h⁴)')}`,
      formula: `${symbol}(x_i) \\approx \\frac{${general}}{${form.divisor === 1 ? '' : form.divisor}${hPower}}`,
      substitution: `${symbol}(${n(x)}) \\approx \\frac{${numeric}}{${form.divisor === 1 ? '' : `${form.divisor}\\,`}(${n(h)})${second ? '^2' : ''}}`,
      result: `${symbol}(${n(x)}) \\approx ${n(value)}${rel === null ? '' : `, \\quad \\varepsilon_t = ${n(rel, 4)}\\,\\%`}`,
    });
    return { direction: form.direction, value, trueRelativeError: rel };
  });

  const centered = estimates.find((e) => e.direction === 'centrada')!;
  steps.push({
    title: 'Comparación',
    explanation:
      'La diferencia centrada usa puntos a ambos lados de xᵢ y su error de truncamiento es de un orden mayor que el de las diferencias hacia adelante y hacia atrás con los mismos puntos. Al reducir h a la mitad, el error de una fórmula O(h) se reduce aproximadamente a la mitad y el de una O(h²) a la cuarta parte.',
  });

  const summary: SummaryItem[] = [
    {
      label: `Diferencia centrada ${formulas[2]!.order.replace('^2', '²').replace('^4', '⁴')}`,
      value: `${symbol}(${n(x)}) \\approx ${n(centered.value)}`,
      emphasis: true,
    },
    ...(trueValue === null
      ? []
      : [{ label: 'Valor verdadero', value: `${symbol}(${n(x)}) = ${n(trueValue)}` }]),
  ];

  return {
    ok: true,
    value: { estimates, trueValue },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'estimaciones',
        title: 'Aproximaciones',
        columns: [
          { key: 'name', header: '\\text{Fórmula}', format: 'text' },
          { key: 'order', header: '\\text{Error}', format: 'latex' },
          { key: 'value', header: `${symbol}(x_i)` },
          ...(trueValue === null ? [] : [{ key: 'et', header: '\\varepsilon_t\\,(\\%)' }]),
        ],
        rows: estimates.map((e, j) => ({
          name: formulas[j]!.name,
          order: formulas[j]!.order,
          value: e.value,
          et: e.trueRelativeError,
        })),
      },
    ],
  };
}

export const numericalDerivative: Calculator<
  NumericalDerivativeInput,
  NumericalDerivativeValue,
  NumericalDerivativeErrorCode
> = {
  meta: {
    id: 'derivacion-numerica',
    title: 'Derivación por diferencias finitas',
    summary:
      'Aproxima la primera o la segunda derivada con diferencias hacia adelante, hacia atrás y centradas.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 4, sec. 4.1.3, ejemplo 4.4 (diferencias divididas finitas) y cap. 23, sec. 23.1, ejemplo 23.1 y figuras 23.1 a 23.3 (fórmulas de alta exactitud), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'smith-1993' },
    ],
  },
  inputSchema: numericalDerivativeInputSchema,
  example: {
    expression: '-0.1x^4 - 0.15x^3 - 0.5x^2 - 0.25x + 1.2',
    x: 0.5,
    h: 0.5,
    derivative: 'primera',
    accuracy: 'basica',
  },
  solve: solveNumericalDerivative,
};
