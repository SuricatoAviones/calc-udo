/**
 * Polinomio interpolante de Newton (Chapra & Canale, sec. 18.1):
 *
 * Diferencias divididas (ec. 18.15):
 *   fₙ(x) = b₀ + b₁(x − x₀) + b₂(x − x₀)(x − x₁) + ⋯ + bₙ(x − x₀)⋯(x − xₙ₋₁),
 *   b_k = f[x_k, …, x₀]
 * Diferencias hacia adelante de Newton (Newton-Gregory), para x igualmente espaciados con paso h:
 *   fₙ(x) = y₀ + sΔy₀ + s(s − 1)/2! Δ²y₀ + ⋯ + s(s − 1)⋯(s − n + 1)/n! Δⁿy₀,   s = (x − x₀)/h
 *
 * Se evalúa en el punto pedido con grado creciente (f₁, f₂, …): cada término nuevo es también una
 * estimación del error del polinomio anterior (ec. 18.18).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
  type SummaryItem,
} from '../types';
import {
  describeSpacing,
  dividedDifferences,
  dividedName,
  equalSpacing,
  forwardDifferences,
  forwardName,
  parsePoints,
  pointsShape,
  refinePoints,
  SPACING_MESSAGE,
} from './differences';
import { finiteNumber } from './root-finding';

export const interpolationMethods = ['divididas', 'adelante'] as const;

export const newtonInterpolationInputSchema = z
  .object({
    method: z.enum(interpolationMethods, { error: 'Elige la fórmula.' }),
    ...pointsShape,
    point: finiteNumber('el punto a interpolar'),
    trueValue: finiteNumber('el valor verdadero').optional(),
  })
  .superRefine((v, ctx) => {
    const points = refinePoints(v, ctx);
    if (points && v.method === 'adelante' && equalSpacing(points.x) === null) {
      ctx.addIssue({ code: 'custom', path: ['x'], message: SPACING_MESSAGE });
    }
  });

export type NewtonInterpolationInput = z.infer<typeof newtonInterpolationInputSchema>;

export interface NewtonInterpolationValue {
  /** Valor del polinomio de mayor grado en el punto. */
  value: number;
  /** f₀(x), f₁(x), …, fₙ(x) en el punto. */
  approximations: number[];
  /** Coeficientes b_k (divididas) o Δᵏy₀ (hacia adelante). */
  coefficients: number[];
}

export type NewtonInterpolationErrorCode = never;

const n = (v: number) => toLatexNumber(v, 8);
const op = (v: number) => toLatexOperand(v, 8);

const factorial = (k: number) =>
  Array.from({ length: k }, (_, i) => i + 1).reduce((p, v) => p * v, 1);

export function solveNewtonInterpolation(
  input: NewtonInterpolationInput,
): CalculatorResult<NewtonInterpolationValue, NewtonInterpolationErrorCode> {
  const { x, y } = parsePoints(input.x, input.y) as { x: number[]; y: number[] };
  const xp = input.point;
  const forward = input.method === 'adelante';
  const size = x.length;
  const levels = forward ? forwardDifferences(y) : dividedDifferences(x, y);
  const coefficients = levels.map((level) => level[0]!);
  const h = forward ? equalSpacing(x)! : null;
  const s = h !== null ? (xp - x[0]!) / h : null;

  const steps: Step[] = [
    {
      title: 'Datos',
      explanation: `${size} puntos: el polinomio interpolante es de grado ${size - 1} como máximo.${h !== null ? ` ${describeSpacing(h)}` : ''}`,
      result: x.map((xi, i) => `(${n(xi)},\\ ${n(y[i]!)})`).join(',\\ '),
    },
    {
      title: forward ? 'Diferencias hacia adelante en x₀' : 'Coeficientes: diferencias divididas',
      explanation: forward
        ? 'Se usan las diferencias de la primera fila de la tabla (Δy₀, Δ²y₀, …).'
        : 'Los coeficientes son la diagonal superior de la tabla de diferencias divididas.',
      result: coefficients
        .map((c, k) =>
          forward ? `${forwardName(0, k)} = ${n(c)}` : `b_{${k}} = ${dividedName(0, k)} = ${n(c)}`,
        )
        .join(',\\quad '),
    },
  ];

  // Términos del polinomio evaluados en xp.
  const terms: number[] = [];
  const termSteps: Step[] = [];
  for (let k = 0; k < size; k++) {
    let term: number;
    let formula: string;
    let substitution: string;
    if (forward) {
      let product = 1;
      for (let j = 0; j < k; j++) product *= s! - j;
      term = (coefficients[k]! * product) / factorial(k);
      const factors = Array.from({ length: k }, (_, j) => (j === 0 ? 's' : `(s - ${j})`)).join('');
      formula = k === 0 ? 'y_0' : `\\frac{${factors}}{${k}!}\\,${forwardName(0, k)}`;
      const numericFactors = Array.from({ length: k }, (_, j) => `(${n(s! - j)})`).join('');
      substitution =
        k === 0
          ? n(coefficients[0]!)
          : `\\frac{${numericFactors}}{${factorial(k)}}${op(coefficients[k]!)}`;
    } else {
      let product = 1;
      for (let j = 0; j < k; j++) product *= xp - x[j]!;
      term = coefficients[k]! * product;
      formula = `b_{${k}}${Array.from({ length: k }, (_, j) => `(x - x_{${j}})`).join('')}`;
      substitution = `${op(coefficients[k]!)}${Array.from({ length: k }, (_, j) => `(${n(xp)} - ${op(x[j]!)})`).join('')}`;
    }
    terms.push(term);
    termSteps.push({ title: `Término ${k}`, formula, substitution, result: n(term) });
  }
  const approximations = terms.reduce<number[]>((acc, t) => [...acc, (acc.at(-1) ?? 0) + t], []);
  const value = approximations.at(-1)!;

  const newtonForm = forward
    ? `f_{${size - 1}}(x) = ${coefficients
        .map((c, k) => {
          if (k === 0) return n(c);
          const factors = Array.from({ length: k }, (_, j) => (j === 0 ? 's' : `(s - ${j})`)).join(
            '',
          );
          return `${c < 0 ? '-' : '+'} \\frac{${n(Math.abs(c))}}{${k}!}${factors}`;
        })
        .join(' ')}`
    : `f_{${size - 1}}(x) = ${coefficients
        .map((c, k) => {
          const factors = Array.from({ length: k }, (_, j) =>
            x[j] === 0 ? 'x' : `(x ${x[j]! < 0 ? '+' : '-'} ${n(Math.abs(x[j]!))})`,
          ).join('');
          if (k === 0) return n(c);
          return `${c < 0 ? '-' : '+'} ${n(Math.abs(c))}${factors}`;
        })
        .join(' ')}`;

  steps.push({
    title: 'Polinomio de Newton',
    formula: forward
      ? `f_n(x) = y_0 + s\\,\\Delta y_0 + \\frac{s(s-1)}{2!}\\Delta^2 y_0 + \\cdots, \\qquad s = \\frac{x - x_0}{h}`
      : 'f_n(x) = b_0 + b_1(x - x_0) + b_2(x - x_0)(x - x_1) + \\cdots',
    result: newtonForm,
  });
  if (forward) {
    steps.push({
      title: 'Valor de s',
      formula: 's = \\frac{x - x_0}{h}',
      substitution: `s = \\frac{${n(xp)} - ${op(x[0]!)}}{${n(h!)}}`,
      result: `s = ${n(s!)}`,
    });
  }
  steps.push({
    title: `Evaluar en x = ${formatNumber(xp)}`,
    explanation:
      'Cada término agrega un grado al polinomio. La suma parcial hasta el término k es el polinomio interpolante de grado k con los primeros k + 1 puntos.',
    children: termSteps,
    result: `f_{${size - 1}}(${n(xp)}) = ${n(value)}`,
  });

  const rows = approximations.map((approx, k) => {
    const et =
      input.trueValue === undefined || input.trueValue === 0
        ? null
        : ((input.trueValue - approx) / input.trueValue) * 100;
    return {
      k,
      coefficient: coefficients[k]!,
      term: terms[k]!,
      approx,
      next: k + 1 < size ? terms[k + 1]! : null,
      et,
    };
  });
  steps.push({
    title: 'Estimación del error',
    explanation:
      size > 1
        ? `El último término agregado (${formatNumber(terms.at(-1)!, 6)}) estima el error del polinomio de grado ${size - 2} (Chapra, ec. 18.18). Si los términos se hacen pequeños, la interpolación es confiable.`
        : 'Con un solo punto no hay estimación del error.',
    result:
      input.trueValue === undefined
        ? undefined
        : `\\varepsilon_t = \\frac{${n(input.trueValue)} - ${op(value)}}{${n(input.trueValue)}} \\times 100\\% = ${toLatexNumber(rows.at(-1)!.et ?? 0, 4)}\\,\\%`,
  });

  // Gráfica: el polinomio y los datos.
  const lo = Math.min(...x, xp);
  const hi = Math.max(...x, xp);
  const pad = 0.05 * (hi - lo || 1);
  const evaluateAt = (t: number) => {
    if (forward) {
      const st = (t - x[0]!) / h!;
      let sum = 0;
      let product = 1;
      coefficients.forEach((c, k) => {
        if (k > 0) product *= (st - (k - 1)) / k;
        sum += c * product;
      });
      return sum;
    }
    let sum = 0;
    let product = 1;
    coefficients.forEach((c, k) => {
      if (k > 0) product *= t - x[k - 1]!;
      sum += c * product;
    });
    return sum;
  };
  const series: Series[] = [
    {
      id: 'interpolacion',
      title: 'Polinomio interpolante',
      xLabel: 'x',
      yLabel: 'y',
      label: `Polinomio de grado ${size - 1}`,
      points: Array.from({ length: 121 }, (_, i) => {
        const t = lo - pad + ((hi - lo + 2 * pad) * i) / 120;
        return { x: t, y: evaluateAt(t) };
      }),
      scatter: { label: 'Datos', points: x.map((xi, i) => ({ x: xi, y: y[i]! })) },
    },
  ];

  const summary: SummaryItem[] = [
    {
      label: 'Valor interpolado',
      value: `f_{${size - 1}}(${n(xp)}) = ${n(value)}`,
      emphasis: true,
    },
    { label: 'Grado', value: String(size - 1) },
  ];
  if (input.trueValue !== undefined && rows.at(-1)!.et !== null) {
    summary.push({
      label: 'Error relativo verdadero',
      value: `\\varepsilon_t = ${n(rows.at(-1)!.et!)}\\,\\%`,
    });
  }
  if (xp < Math.min(...x) || xp > Math.max(...x)) {
    summary.push({ label: 'Atención', value: '\\text{extrapolación}' });
  }

  return {
    ok: true,
    value: { value, approximations, coefficients },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'aproximaciones',
        title: 'Aproximación con grado creciente',
        columns: [
          { key: 'k', header: '\\text{Grado } k' },
          { key: 'coefficient', header: forward ? '\\Delta^k y_0' : 'b_k' },
          { key: 'term', header: '\\text{Término}' },
          { key: 'approx', header: `f_k(${n(xp)})` },
          { key: 'next', header: 'R_k \\approx \\text{término } k+1' },
          ...(input.trueValue === undefined
            ? []
            : [{ key: 'et', header: '\\varepsilon_t\\,(\\%)' }]),
        ],
        rows,
      },
    ],
    series,
    notices:
      xp < Math.min(...x) || xp > Math.max(...x)
        ? [
            {
              level: 'warning',
              message: `x = ${formatNumber(xp)} está fuera del rango de los datos: es una extrapolación y el error puede ser grande.`,
            },
          ]
        : [],
  };
}

export const newtonInterpolation: Calculator<
  NewtonInterpolationInput,
  NewtonInterpolationValue,
  NewtonInterpolationErrorCode
> = {
  meta: {
    id: 'interpolacion-de-newton',
    title: 'Interpolación con fórmulas de Newton',
    summary:
      'Polinomio interpolante de Newton con diferencias divididas o hacia adelante, evaluado con grado creciente.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 18, sec. 18.1, ejemplos 18.1, 18.2 y 18.3 (ln 2 a partir de ln 1, ln 4, ln 6 y ln 5), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'smith-1993' },
    ],
  },
  inputSchema: newtonInterpolationInputSchema,
  example: {
    method: 'divididas',
    x: '1 4 6 5',
    y: '0 1.3862944 1.7917595 1.6094379',
    point: 2,
    trueValue: 0.6931472,
  },
  solve: solveNewtonInterpolation,
};
