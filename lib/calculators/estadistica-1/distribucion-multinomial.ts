/**
 * Distribución multinomial: cada uno de n ensayos independientes produce uno de k resultados
 * E₁, …, E_k con probabilidades p₁, …, p_k (Σpᵢ = 1). La probabilidad de que Eᵢ ocurra xᵢ veces
 * (Σxᵢ = n) es (Walpole, Myers, Myers y Ye, sec. 5.2):
 *
 *   f(x₁, …, x_k; p₁, …, p_k, n) = [n! / (x₁! x₂! ⋯ x_k!)] p₁^{x₁} p₂^{x₂} ⋯ p_k^{x_k}
 *
 * Cada Xᵢ es binomial con parámetros n y pᵢ, así que E(Xᵢ) = npᵢ y Var(Xᵢ) = npᵢ(1 − pᵢ).
 */
import { z } from 'zod';
import {
  formatNumber,
  fractionToLatex,
  parseFraction,
  toLatexNumber,
  toLatexText,
} from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import { lnFactorial } from './discrete';

const MAX_TRIALS = 200;
/** Tolerancia para Σpᵢ = 1: admite decimales como 0.1 + 0.2 + 0.7 sin exigir fracciones. */
const SUM_TOLERANCE = 1e-9;

const probabilityField = z.string().superRefine((text, ctx) => {
  const value = parseFraction(text.trim());
  if (Number.isNaN(value)) {
    ctx.addIssue({ code: 'custom', message: 'Escribe un número o una fracción, p. ej. 2/9.' });
  } else if (value < 0 || value > 1) {
    ctx.addIssue({ code: 'custom', message: 'Debe estar entre 0 y 1.' });
  }
});

export const multinomialInputSchema = z
  .object({
    outcomes: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Escribe un nombre.').max(30, 'Máximo 30 caracteres.'),
          probability: probabilityField,
          count: z
            .number({ error: 'Ingresa cuántas veces ocurre.' })
            .int('Debe ser un número entero.')
            .min(0, 'No puede ser negativo.'),
        }),
      )
      .min(2, 'Hacen falta al menos 2 resultados.')
      .max(10, 'El máximo es 10 resultados.'),
  })
  .superRefine((v, ctx) => {
    const probabilities = v.outcomes.map((o) => parseFraction(o.probability.trim()));
    if (probabilities.some(Number.isNaN)) return;
    const sum = probabilities.reduce((s, p) => s + p, 0);
    if (Math.abs(sum - 1) > SUM_TOLERANCE) {
      ctx.addIssue({
        code: 'custom',
        path: ['outcomes'],
        message: `Las probabilidades suman ${formatNumber(sum, 6)}; deben sumar 1. Si son periódicas (1/3), escríbelas como fracción.`,
      });
    }
    const trials = v.outcomes.reduce((s, o) => s + o.count, 0);
    if (trials < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['outcomes'],
        message: 'Al menos un conteo debe ser mayor que 0.',
      });
    } else if (trials > MAX_TRIALS) {
      ctx.addIssue({
        code: 'custom',
        path: ['outcomes'],
        message: `El número de ensayos n = Σx no puede pasar de ${MAX_TRIALS}.`,
      });
    }
  });

export type MultinomialInput = z.infer<typeof multinomialInputSchema>;

export interface MultinomialValue {
  probability: number;
  /** n! / (x₁! ⋯ x_k!) */
  coefficient: number;
  trials: number;
}

export type MultinomialErrorCode = never;

const n = toLatexNumber;

/** n! / (x₁! ⋯ x_k!) exacto con enteros grandes. */
function multinomialCoefficient(counts: number[]): bigint {
  const factorial = (m: number) => {
    let result = 1n;
    for (let i = 2n; i <= BigInt(m); i++) result *= i;
    return result;
  };
  const total = counts.reduce((s, c) => s + c, 0);
  return counts.reduce((acc, c) => acc / factorial(c), factorial(total));
}

export function solveMultinomial(
  input: MultinomialInput,
): CalculatorResult<MultinomialValue, MultinomialErrorCode> {
  const outcomes = input.outcomes.map((o) => ({
    name: o.name.trim(),
    text: o.probability.trim(),
    p: parseFraction(o.probability.trim()),
    x: o.count,
  }));
  const trials = outcomes.reduce((s, o) => s + o.x, 0);
  const k = outcomes.length;
  const coefficient = Number(multinomialCoefficient(outcomes.map((o) => o.x)));
  // Un resultado con p = 0 que sí ocurre hace imposible la muestra; 0⁰ = 1 si no ocurre.
  const impossible = outcomes.some((o) => o.p === 0 && o.x > 0);
  const lnProduct = impossible
    ? -Infinity
    : outcomes.reduce((s, o) => s + (o.x === 0 ? 0 : o.x * Math.log(o.p)), 0);
  const product = Math.exp(lnProduct);
  const lnCoefficient = lnFactorial(trials) - outcomes.reduce((s, o) => s + lnFactorial(o.x), 0);
  const probability = impossible ? 0 : Math.exp(lnCoefficient + lnProduct);

  const pTex = (o: (typeof outcomes)[number]) => fractionToLatex(o.text);
  const indices = outcomes.map((_, i) => i + 1);

  const steps: Step[] = [
    {
      title: 'Distribución multinomial',
      explanation: `Cada uno de los n ensayos independientes produce exactamente uno de los k = ${k} resultados, con las mismas probabilidades en cada ensayo. Xᵢ cuenta cuántas veces ocurre el resultado i.`,
      formula:
        'f(x_1, \\ldots, x_k;\\ p_1, \\ldots, p_k, n) = \\binom{n}{x_1, x_2, \\ldots, x_k} p_1^{x_1} p_2^{x_2} \\cdots p_k^{x_k}',
    },
    {
      title: 'Verificar los datos',
      explanation:
        'Las probabilidades de los resultados deben sumar 1, y el número de ensayos es la suma de los conteos.',
      formula: '\\sum p_i = 1, \\qquad n = \\sum x_i',
      substitution: `${outcomes.map(pTex).join(' + ')} = ${n(
        outcomes.reduce((s, o) => s + o.p, 0),
        6,
      )}, \\qquad n = ${outcomes.map((o) => o.x).join(' + ')}`,
      result: `n = ${trials}`,
    },
    {
      title: 'Coeficiente multinomial',
      explanation:
        'Cuenta los órdenes distintos en que pueden salir los resultados: las particiones de los n ensayos en grupos de x₁, x₂, …, x_k.',
      formula: `\\binom{n}{x_1, \\ldots, x_k} = \\frac{n!}{${indices.map((i) => `x_{${i}}!`).join('\\,')}}`,
      substitution: `\\frac{${trials}!}{${outcomes.map((o) => `${o.x}!`).join('\\,')}}`,
      result: `\\binom{${trials}}{${outcomes.map((o) => o.x).join(', ')}} = ${n(coefficient)}`,
    },
    {
      title: 'Probabilidad de un orden específico',
      explanation: impossible
        ? 'Un resultado con probabilidad 0 ocurre al menos una vez: esa muestra es imposible.'
        : 'Como los ensayos son independientes, la probabilidad de un orden concreto es el producto de las probabilidades.',
      formula: indices.map((i) => `p_{${i}}^{x_{${i}}}`).join(''),
      substitution: outcomes.map((o) => `\\left(${pTex(o)}\\right)^{${o.x}}`).join(''),
      result: `= ${n(product)}`,
    },
    {
      title: 'Multiplicar',
      formula: `f = \\binom{n}{x_1, \\ldots, x_k} ${indices.map((i) => `p_{${i}}^{x_{${i}}}`).join('')}`,
      substitution: `f = (${n(coefficient)})(${n(product)})`,
      result: `f = ${n(probability)}`,
    },
    {
      title: 'Media y varianza de cada conteo',
      explanation:
        'Cada Xᵢ, por separado, es binomial: n ensayos con probabilidad de éxito pᵢ. Sus valores están en la tabla.',
      formula: 'E(X_i) = np_i, \\qquad \\operatorname{Var}(X_i) = np_i(1 - p_i)',
    },
  ];

  return {
    ok: true,
    value: { probability, coefficient, trials },
    summary: [
      {
        label: 'Probabilidad',
        value: `f(${outcomes.map((o) => o.x).join(', ')}) = ${n(probability, 6)}`,
        emphasis: true,
      },
      { label: 'Ensayos', value: `n = ${trials}` },
      { label: 'Coeficiente multinomial', value: n(coefficient) },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'resultados',
        title: 'Resultados',
        columns: [
          { key: 'name', header: '\\text{Resultado}', format: 'latex' },
          { key: 'p', header: 'p_i' },
          { key: 'x', header: 'x_i' },
          { key: 'mean', header: 'np_i' },
          { key: 'variance', header: 'np_i(1 - p_i)' },
        ],
        rows: outcomes.map((o) => ({
          name: toLatexText(o.name),
          p: o.p,
          x: o.x,
          mean: trials * o.p,
          variance: trials * o.p * (1 - o.p),
        })),
      },
    ],
  };
}

export const multinomial: Calculator<MultinomialInput, MultinomialValue, MultinomialErrorCode> = {
  meta: {
    id: 'distribucion-multinomial',
    title: 'Distribución multinomial',
    summary: 'Probabilidad de que cada uno de k resultados ocurra un número dado de veces.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 5.2, distribución multinomial, Ejemplo 5.7 (9.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: multinomialInputSchema,
  // Walpole, ejemplo 5.7: tres pistas con probabilidades 2/9, 1/6 y 11/18; 6 aviones se reparten
  // 2, 1 y 3.
  example: {
    outcomes: [
      { name: 'Pista 1', probability: '2/9', count: 2 },
      { name: 'Pista 2', probability: '1/6', count: 1 },
      { name: 'Pista 3', probability: '11/18', count: 3 },
    ],
  },
  solve: solveMultinomial,
};
