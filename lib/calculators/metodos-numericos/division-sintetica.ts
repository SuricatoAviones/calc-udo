/**
 * División sintética entre (x − r) y transformación del polinomio (Chapra & Canale, sec. 7.2,
 * ejemplo 7.1; Nakamura, cap. de raíces de polinomios).
 *
 * Dividir:      P(x) = (x − r) Q(x) + R,   con R = P(r) (teorema del residuo).
 * Transformar:  dividiendo una y otra vez los cocientes entre (x − r), los residuos son los
 *               coeficientes de P escrito en potencias de (x − r):
 *                 P(x) = c₀ + c₁(x − r) + c₂(x − r)² + ⋯ + cₙ(x − r)ⁿ,   c_k = P⁽ᵏ⁾(r) / k!
 *               Es el cambio de variable x = y + r que se usa para trasladar las raíces.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type SummaryItem,
} from '../types';
import {
  coefficientsField,
  parseCoefficients,
  polynomialLatex,
  ruffiniLatex,
  syntheticDivision,
} from './polynomial';
import { finiteNumber } from './root-finding';

export const syntheticModes = ['dividir', 'transformar'] as const;

export const syntheticDivisionInputSchema = z.object({
  coefficients: coefficientsField(1),
  r: finiteNumber('r'),
  mode: z.enum(syntheticModes, { error: 'Elige qué hacer.' }),
});

export type SyntheticDivisionInput = z.infer<typeof syntheticDivisionInputSchema>;

export interface SyntheticDivisionValue {
  quotient: number[];
  remainder: number;
  /** Solo al transformar: c₀ … cₙ de P(x) = Σ c_k (x − r)^k. */
  shifted?: number[];
}

export type SyntheticDivisionErrorCode = never;

const n = (v: number) => toLatexNumber(v, 7);
const op = (v: number) => toLatexOperand(v, 7);

/** Con más coeficientes que esto no se detalla cada b_k. */
const MAX_DETAILED = 12;

function divisionStep(
  coefficients: number[],
  r: number,
  title: string,
  name: string,
): {
  step: Step;
  quotient: number[];
  remainder: number;
} {
  const division = syntheticDivision(coefficients, r);
  const degree = coefficients.length - 1;
  const children: Step[] = division.b.slice(0, MAX_DETAILED).map((b, i) => {
    const k = degree - i;
    if (i === 0) {
      return { title: `Bajar el primer coeficiente`, result: `b_{${k}} = a_{${k}} = ${n(b)}` };
    }
    return {
      title: i === degree ? 'Residuo' : `Coeficiente b${'₀₁₂₃₄₅₆₇₈₉'[k] ?? k}`,
      formula: `b_{${k}} = a_{${k}} + r\\,b_{${k + 1}}`,
      substitution: `b_{${k}} = ${n(coefficients[i]!)} + ${op(r)}${op(division.b[i - 1]!)}`,
      result: `b_{${k}} = ${n(b)}`,
    };
  });
  const quotientTex = polynomialLatex(division.quotient);
  return {
    quotient: division.quotient,
    remainder: division.remainder,
    step: {
      title,
      explanation:
        'Se baja el primer coeficiente; cada uno de los siguientes es el coeficiente de arriba más r por el último resultado. El último número es el residuo.',
      formula: `${name} \\div (x ${r < 0 ? '+' : '-'} ${n(Math.abs(r))})`,
      substitution: ruffiniLatex(coefficients, r, division),
      children,
      result: `Q(x) = ${quotientTex}, \\quad R = ${n(division.remainder)}`,
    },
  };
}

export function solveSyntheticDivision(
  input: SyntheticDivisionInput,
): CalculatorResult<SyntheticDivisionValue, SyntheticDivisionErrorCode> {
  const coefficients = parseCoefficients(input.coefficients) as number[];
  const { r } = input;
  const degree = coefficients.length - 1;
  const divisor = `x ${r < 0 ? '+' : '-'} ${n(Math.abs(r))}`;
  const steps: Step[] = [
    {
      title: 'Polinomio y divisor',
      explanation: `P es de grado ${degree}. Se divide entre (x ${r < 0 ? '+' : '−'} ${formatNumber(Math.abs(r))}), es decir, r = ${formatNumber(r)}.`,
      result: `P(x) = ${polynomialLatex(coefficients)}, \\qquad x - r = ${divisor}`,
    },
  ];

  const first = divisionStep(coefficients, r, 'División sintética', 'P(x)');
  steps.push(first.step);
  const isRoot = Math.abs(first.remainder) <= 1e-12 * Math.max(1, ...coefficients.map(Math.abs));
  steps.push({
    title: 'Teorema del residuo',
    explanation: isRoot
      ? `El residuo es 0: r = ${formatNumber(r)} es raíz de P y (x − r) es un factor. Q(x) es el polinomio deflactado, de un grado menos, que conserva las demás raíces.`
      : `El residuo es el valor del polinomio en r. Como no es 0, r = ${formatNumber(r)} no es raíz de P.`,
    formula: 'P(x) = (x - r)\\,Q(x) + R, \\qquad R = P(r)',
    result: `P(${n(r)}) = ${n(first.remainder)}${isRoot ? `, \\quad P(x) = (${divisor})(${polynomialLatex(first.quotient)})` : ''}`,
  });

  const division = syntheticDivision(coefficients, r);
  const summary: SummaryItem[] = [
    { label: 'Cociente', value: `Q(x) = ${polynomialLatex(first.quotient)}`, emphasis: true },
    { label: 'Residuo', value: `R = P(${n(r)}) = ${n(first.remainder)}`, emphasis: true },
  ];
  const tables = [
    {
      id: 'division',
      title: 'División sintética',
      columns: [
        { key: 'power', header: '\\text{Potencia}', format: 'latex' as const },
        { key: 'a', header: 'a_k' },
        { key: 'product', header: 'r\\,b_{k+1}' },
        { key: 'b', header: 'b_k' },
      ],
      rows: coefficients.map((a, i) => ({
        power: degree - i === 0 ? '\\text{residuo}' : `x^{${degree - i}}`,
        a,
        product: division.products[i] ?? null,
        b: division.b[i]!,
      })),
    },
  ];

  if (input.mode === 'dividir') {
    return {
      ok: true,
      value: { quotient: first.quotient, remainder: first.remainder },
      summary,
      ...emptyTrace(),
      steps,
      tables,
    };
  }

  // Transformación: divisiones repetidas de los cocientes.
  const shifted: number[] = [first.remainder];
  let current = first.quotient;
  const repeated: Step[] = [];
  for (let k = 1; current.length > 1; k++) {
    const next = divisionStep(current, r, `División ${k + 1}`, `Q_{${k}}(x)`);
    repeated.push({
      ...next.step,
      result: `${next.step.result} \\;\\Rightarrow\\; c_{${k}} = ${n(next.remainder)}`,
    });
    shifted.push(next.remainder);
    current = next.quotient;
  }
  shifted.push(current[0]!);
  steps.push({
    title: 'Divisiones repetidas',
    explanation:
      'Se divide cada cociente entre (x − r). Los residuos, en orden, son c₀, c₁, …; el último cociente (una constante) es cₙ.',
    children: repeated,
    result: `c_{${degree}} = ${n(current[0]!)}`,
  });

  const shiftedTex = shifted
    .map((c, k) => ({ c, k }))
    .reverse()
    .filter(({ c }) => c !== 0)
    .map(({ c, k }, i) => {
      const abs = Math.abs(c);
      const base = k === 0 ? '' : k === 1 ? `(${divisor})` : `(${divisor})^{${k}}`;
      const body = `${k > 0 && abs === 1 ? '' : n(abs)}${base}`;
      if (i === 0) return c < 0 ? `-${body}` : body;
      return c < 0 ? `- ${body}` : `+ ${body}`;
    })
    .join(' ');
  const factorials = shifted.map((_, k) =>
    Array.from({ length: k }, (__, i) => i + 1).reduce((p, v) => p * v, 1),
  );
  steps.push({
    title: 'Polinomio transformado',
    explanation: `Con y = x − r, P(y + r) = ${shifted
      .slice()
      .reverse()
      .map((c) => formatNumber(c, 7))
      .join(
        ', ',
      )} (coeficientes de mayor a menor grado). Además, cada c_k = P⁽ᵏ⁾(r)/k!, así que las divisiones dan también las derivadas de P en r.`,
    formula: `P(x) = c_0 + c_1(x - r) + \\cdots + c_{${degree}}(x - r)^{${degree}}`,
    result: `P(x) = ${shiftedTex || '0'}`,
  });

  return {
    ok: true,
    value: { quotient: first.quotient, remainder: first.remainder, shifted },
    summary: [
      ...summary,
      { label: 'En potencias de (x − r)', value: `P(x) = ${shiftedTex || '0'}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      ...tables,
      {
        id: 'transformado',
        title: 'Coeficientes en potencias de (x − r) y derivadas en r',
        columns: [
          { key: 'k', header: 'k' },
          { key: 'c', header: 'c_k' },
          { key: 'derivative', header: 'P^{(k)}(r) = k!\\,c_k' },
        ],
        rows: shifted.map((c, k) => ({ k, c, derivative: c * factorials[k]! })),
      },
    ],
  };
}

export const syntheticDivisionCalculator: Calculator<
  SyntheticDivisionInput,
  SyntheticDivisionValue,
  SyntheticDivisionErrorCode
> = {
  meta: {
    id: 'division-sintetica',
    title: 'División sintética',
    summary:
      'Divide un polinomio entre (x − r) con el esquema de Ruffini y lo transforma a potencias de (x − r).',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 7, sec. 7.2 (cálculos con polinomios), ejemplo 7.1 (deflación polinomial: −24 + 2x + x² entre x − 4), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'smith-1993' },
    ],
  },
  inputSchema: syntheticDivisionInputSchema,
  example: { coefficients: '1 2 -24', r: 4, mode: 'dividir' },
  solve: solveSyntheticDivision,
};
