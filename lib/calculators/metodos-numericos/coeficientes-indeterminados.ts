/**
 * Método de coeficientes indeterminados (Chapra & Canale, sec. 22.3 y cap. 23; Nakamura, cap. de
 * derivación e integración numéricas): se busca una fórmula
 *
 *   f⁽ᵈ⁾(xᵢ) ≈ (1/hᵈ) Σⱼ cⱼ f(xᵢ + tⱼh)        o        ∫_{xᵢ+ah}^{xᵢ+bh} f(x) dx ≈ h Σⱼ cⱼ f(xᵢ + tⱼh)
 *
 * con nodos tⱼ dados, exigiendo que sea exacta para f = 1, t, t², …, t^{m−1} (m = número de nodos).
 * Con xᵢ = 0 y h = 1 eso da el sistema lineal
 *
 *   Σⱼ cⱼ tⱼᵏ = Mₖ,   Mₖ = dᵈ(tᵏ)/dtᵈ en 0 = k! si k = d (0 en otro caso)   o   Mₖ = (b^{k+1} − a^{k+1})/(k + 1)
 *
 * que se resuelve con fracciones exactas. El primer k para el que la fórmula deja de ser exacta da el
 * error de truncamiento: E = (Mₖ − Σ cⱼtⱼᵏ)/k! · h^{k−d} f⁽ᵏ⁾(ξ) (derivada) o · h^{k+1} f⁽ᵏ⁾(ξ)
 * (integral). Así salen, por ejemplo, la diferencia centrada con E = −h²f'''/6 y la regla de
 * Simpson 1/3 con E = −h⁵f⁽⁴⁾/90 (ec. 21.16).
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { parseFunction } from '@/lib/math/expression';
import { formatNumber, joinSignedTerms, toLatexNumber } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type SummaryItem,
} from '../types';
import { finiteNumber } from './root-finding';

export const undeterminedTargets = ['derivada', 'integral'] as const;

const MAX_NODES = 8;

function parseNodes(text: string): number[] | string {
  const { values, invalid } = parseDataList(text);
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  if (values.length < 1) return 'Escribe al menos un nodo.';
  if (values.length > MAX_NODES) return `El máximo es ${MAX_NODES} nodos.`;
  if (new Set(values).size !== values.length) return 'Los nodos no pueden repetirse.';
  if (values.some((v) => Math.abs(v) > 20)) return 'Usa nodos entre −20 y 20 (en unidades de h).';
  return [...values].sort((a, b) => a - b);
}

export const undeterminedCoefficientsInputSchema = z
  .object({
    target: z.enum(undeterminedTargets, { error: 'Elige qué fórmula deducir.' }),
    order: z
      .number({ error: 'Ingresa el orden de la derivada.' })
      .int('El orden debe ser un número entero.')
      .min(1, 'El orden mínimo es 1.')
      .max(4, 'El orden máximo es 4.'),
    nodes: z.string(),
    a: finiteNumber('el límite inferior a'),
    b: finiteNumber('el límite superior b'),
    expression: z.string().trim().max(200, 'La expresión es demasiado larga.').optional(),
    x0: finiteNumber('xᵢ').optional(),
    h: finiteNumber('h')
      .refine((v) => v > 0, 'h debe ser mayor que 0.')
      .optional(),
  })
  .superRefine((v, ctx) => {
    const nodes = parseNodes(v.nodes);
    if (typeof nodes === 'string') {
      ctx.addIssue({ code: 'custom', path: ['nodes'], message: nodes });
      return;
    }
    if (v.target === 'derivada' && nodes.length <= v.order) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: `Para la derivada de orden ${v.order} hacen falta al menos ${v.order + 1} nodos.`,
      });
    }
    // Escrito así para que también rechace NaN.
    const ascending = v.b > v.a;
    if (v.target === 'integral' && !ascending) {
      ctx.addIssue({
        code: 'custom',
        path: ['b'],
        message: 'El límite superior debe ser mayor que el inferior.',
      });
    }
    if (v.expression && (v.x0 === undefined || v.h === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: [v.x0 === undefined ? 'x0' : 'h'],
        message: 'Para aplicar la fórmula indica xᵢ y h.',
      });
    }
  });

export type UndeterminedCoefficientsInput = z.infer<typeof undeterminedCoefficientsInputSchema>;

export interface UndeterminedCoefficientsValue {
  nodes: number[];
  /** Coeficientes cⱼ como fracciones exactas ("−1/2"). */
  coefficients: string[];
  /** Grado máximo de los polinomios para los que la fórmula es exacta. */
  exactDegree: number;
  /** Potencia de h del error de truncamiento, o `null` si no se detectó. */
  errorPower: number | null;
  /** Constante C de E = C · hᵖ · f⁽ᵏ⁾(ξ), como fracción. */
  errorConstant: string | null;
  /** Resultado de aplicar la fórmula, si se pidió. */
  applied: number | null;
}

export type UndeterminedCoefficientsErrorCode = 'singular' | 'invalid-expression' | 'non-finite';

const factorial = (k: number) =>
  Array.from({ length: k }, (_, i) => i + 1).reduce((p, v) => p * v, 1);

/** Resuelve A c = b con fracciones exactas (Gauss-Jordan). `null` si es singular. */
function solveRational(a: Rational[][], b: Rational[]): Rational[] | null {
  const size = a.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let k = 0; k < size; k++) {
    const pivot = m.findIndex((row, r) => r >= k && !row[k]!.isZero());
    if (pivot < 0) return null;
    [m[k], m[pivot]] = [m[pivot]!, m[k]!];
    const p = m[k]![k]!;
    m[k] = m[k]!.map((v) => v.div(p));
    for (let r = 0; r < size; r++) {
      if (r === k || m[r]![k]!.isZero()) continue;
      const factor = m[r]![k]!;
      m[r] = m[r]!.map((v, c) => v.sub(factor.mul(m[k]![c]!)));
    }
  }
  return m.map((row) => row[size]!);
}

function power(t: Rational, k: number): Rational {
  let result = Rational.ONE;
  for (let i = 0; i < k; i++) result = result.mul(t);
  return result;
}

/** Momento Mₖ que la fórmula debe reproducir para f(t) = tᵏ. */
function moment(
  target: 'derivada' | 'integral',
  k: number,
  order: number,
  a: Rational,
  b: Rational,
) {
  if (target === 'derivada') return k === order ? Rational.of(factorial(order)) : Rational.ZERO;
  return power(b, k + 1)
    .sub(power(a, k + 1))
    .div(Rational.of(k + 1));
}

function nodeTerm(t: number): string {
  if (t === 0) return 'f(x_i)';
  const abs = Math.abs(t);
  return `f(x_i ${t < 0 ? '-' : '+'} ${abs === 1 ? '' : toLatexNumber(abs)}h)`;
}

/** Σ aⱼ·nombreⱼ en LaTeX, omitiendo los coeficientes nulos: `-c_{0} + c_{2}`. */
function linearCombination(coefficients: Rational[], names: string[]): string {
  const terms = coefficients
    .map((c, j) => ({ c, j }))
    .filter(({ c }) => !c.isZero())
    .map(({ c, j }) => {
      const abs = c.abs();
      const coefficient = abs.eq(Rational.ONE) ? '' : String.raw`${abs.toLatex()}\,`;
      return { negative: c.sign() < 0, text: `${coefficient}${names[j]}` };
    });
  return terms.length === 0 ? '0' : joinSignedTerms(terms);
}

/** Factor delante de la suma: 1/h, 1/hᵈ (derivada) o h (integral). */
function scaleTex(derivative: boolean, d: number): string {
  if (!derivative) return 'h';
  return d === 1 ? String.raw`\frac{1}{h}` : String.raw`\frac{1}{h^{${d}}}`;
}

/** f(t) = 1, t, t², … en el título de cada condición. */
function powerTitle(k: number): string {
  if (k === 0) return 'f(t) = 1';
  return k === 1 ? 'f(t) = t' : `f(t) = t^${k}`;
}

interface TruncationError {
  /** Grado máximo de los polinomios para los que la fórmula es exacta. */
  exactDegree: number;
  errorPower: number | null;
  errorConstant: Rational | null;
}

/** Primer k en que la fórmula deja de ser exacta: da el orden y la constante del error. */
function truncationError(
  solution: Rational[],
  t: Rational[],
  momentOf: (k: number) => Rational,
  derivative: boolean,
  d: number,
): TruncationError {
  const size = solution.length;
  let exactDegree = size - 1;
  for (let k = size; k < size + 6; k++) {
    const achieved = solution.reduce((s, c, j) => s.add(c.mul(power(t[j]!, k))), Rational.ZERO);
    const expected = momentOf(k);
    if (!achieved.eq(expected)) {
      return {
        exactDegree,
        errorPower: derivative ? k - d : k + 1,
        errorConstant: expected.sub(achieved).div(Rational.of(factorial(k))),
      };
    }
    exactDegree = k;
  }
  return { exactDegree, errorPower: null, errorConstant: null };
}

/** Orden de la derivada f⁽ᵏ⁾(ξ) del término de error. */
function errorDerivativeOrder(errorPower: number | null, derivative: boolean, d: number) {
  if (errorPower === null) return null;
  return derivative ? errorPower + d : errorPower - 1;
}

function truncationStep(
  { exactDegree, errorPower, errorConstant }: TruncationError,
  derivativeK: number | null,
): Step {
  if (errorPower === null || errorConstant === null) {
    return {
      title: 'Error de truncamiento',
      explanation: `La fórmula es exacta al menos hasta polinomios de grado ${exactDegree}.`,
    };
  }
  const next = exactDegree + 1;
  return {
    title: 'Error de truncamiento',
    explanation: `La fórmula es exacta para polinomios de grado ≤ ${exactDegree}; con t^${next} ya no. El término que falta da el error de truncamiento.`,
    formula: String.raw`E = \frac{M_{${next}} - \sum_j c_j t_j^{${next}}}{${next}!}\, h^{${errorPower}} f^{(${derivativeK})}(\xi)`,
    result: String.raw`E = ${errorConstant.toLatex()}\, h^{${errorPower}} f^{(${derivativeK})}(\xi) = O(h^{${errorPower}})`,
  };
}

type Applied =
  { applied: number; step: Step } | { code: UndeterminedCoefficientsErrorCode; message: string };

/** Evalúa la fórmula en una función dada, con los xᵢ y h del formulario. */
function applyFormula(
  input: UndeterminedCoefficientsInput,
  expression: string,
  nodes: number[],
  solution: Rational[],
): Applied {
  const parsed = parseFunction(expression);
  if (!parsed.ok) return { code: 'invalid-expression', message: parsed.message };
  const derivative = input.target === 'derivada';
  const d = input.order;
  const x0 = input.x0!;
  const h = input.h!;
  const values = nodes.map((tj) => parsed.expr.evaluate(x0 + tj * h));
  if (values.some((v) => !Number.isFinite(v))) {
    return { code: 'non-finite', message: 'f no tiene un valor real finito en algún nodo.' };
  }
  const sum = solution.reduce((s, c, j) => s + c.toNumber() * values[j]!, 0);
  const applied = derivative ? sum / h ** d : sum * h;
  const target = derivative ? `f^{(${d})}(${toLatexNumber(x0)})` : String.raw`\int f(x)\,dx`;
  return {
    applied,
    step: {
      title: `Aplicar a f(x) = ${expression}`,
      explanation: `Con xᵢ = ${formatNumber(x0)} y h = ${formatNumber(h)}.`,
      substitution: nodes
        .map((tj, j) => `f(${toLatexNumber(x0 + tj * h)}) = ${toLatexNumber(values[j]!)}`)
        .join(String.raw`,\ `),
      result: String.raw`${target} \approx ${toLatexNumber(applied)}`,
    },
  };
}

/** Σ cⱼ f(xᵢ + tⱼh) en LaTeX. */
function formulaSum(coefficients: Rational[], nodes: number[]): string {
  return linearCombination(coefficients, nodes.map(nodeTerm));
}

export function solveUndeterminedCoefficients(
  input: UndeterminedCoefficientsInput,
): CalculatorResult<UndeterminedCoefficientsValue, UndeterminedCoefficientsErrorCode> {
  const nodes = parseNodes(input.nodes) as number[];
  const derivative = input.target === 'derivada';
  const d = input.order;
  const size = nodes.length;
  const t = nodes.map((v) => Rational.fromNumber(v));
  const a = Rational.fromNumber(input.a);
  const b = Rational.fromNumber(input.b);
  const lhsName = derivative
    ? `f^{(${d})}(x_i)`
    : String.raw`\int_{${nodeTermPoint(input.a)}}^{${nodeTermPoint(input.b)}} f(x)\,dx`;
  const scale = scaleTex(derivative, d);

  const matrix = Array.from({ length: size }, (_, k) => t.map((tj) => power(tj, k)));
  const rhs = Array.from({ length: size }, (_, k) => moment(input.target, k, d, a, b));

  const steps: Step[] = [
    {
      title: 'Forma de la fórmula',
      explanation: `Se buscan ${size} coeficientes c₀ … c${'₀₁₂₃₄₅₆₇₈₉'[size - 1]} para los nodos t = ${nodes.map((v) => formatNumber(v)).join(', ')} (en unidades de h, contados desde xᵢ).`,
      formula: String.raw`${lhsName} \approx ${scale} \sum_{j} c_j\, f(x_i + t_j h)`,
    },
    {
      title: 'Condiciones: exacta para 1, t, t², …',
      explanation: derivative
        ? `Con xᵢ = 0 y h = 1, la fórmula debe dar la derivada de orden ${d} de cada potencia tᵏ en 0, que vale ${d}! si k = ${d} y 0 si no.`
        : `Con xᵢ = 0 y h = 1, la fórmula debe dar la integral de cada potencia tᵏ entre ${formatNumber(input.a)} y ${formatNumber(input.b)}: (b^{k+1} − a^{k+1})/(k + 1).`,
      children: matrix.map((row, k) => ({
        title: powerTitle(k),
        result: `${linearCombination(
          row,
          row.map((_, j) => `c_{${j}}`),
        )} = ${rhs[k]!.toLatex()}`,
      })),
    },
  ];

  const solution = solveRational(matrix, rhs);
  if (!solution) {
    return {
      ok: false,
      error: { code: 'singular', message: 'El sistema no tiene solución única con esos nodos.' },
      ...emptyTrace(),
      steps,
    };
  }
  steps.push({
    title: 'Resolver el sistema',
    explanation: 'Se resuelve con fracciones exactas (eliminación de Gauss-Jordan).',
    result: solution.map((c, j) => `c_{${j}} = ${c.toLatex()}`).join(String.raw`,\quad `),
  });

  const truncation = truncationError(
    solution,
    t,
    (k) => moment(input.target, k, d, a, b),
    derivative,
    d,
  );
  const { exactDegree, errorPower, errorConstant } = truncation;

  const formulaTex = String.raw`${lhsName} \approx ${scale}\left[${formulaSum(solution, nodes)}\right]`;
  const derivativeK = errorDerivativeOrder(errorPower, derivative, d);
  steps.push({ title: 'Fórmula', result: formulaTex }, truncationStep(truncation, derivativeK));

  let applied: number | null = null;
  if (input.expression) {
    const result = applyFormula(input, input.expression, nodes, solution);
    if ('code' in result) {
      return {
        ok: false,
        error: { code: result.code, message: result.message },
        ...emptyTrace(),
        steps,
      };
    }
    applied = result.applied;
    steps.push(result.step);
  }

  const summary: SummaryItem[] = [
    { label: 'Fórmula', value: formulaTex, emphasis: true },
    ...(errorPower === null || errorConstant === null
      ? []
      : [
          {
            label: 'Error de truncamiento',
            value: String.raw`${errorConstant.toLatex()}\, h^{${errorPower}} f^{(${derivativeK})}(\xi)`,
          },
        ]),
    ...(applied === null ? [] : [{ label: 'Valor aproximado', value: toLatexNumber(applied) }]),
  ];

  return {
    ok: true,
    value: {
      nodes,
      coefficients: solution.map((c) => c.toString()),
      exactDegree,
      errorPower,
      errorConstant: errorConstant?.toString() ?? null,
      applied,
    },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'coeficientes',
        title: 'Coeficientes',
        columns: [
          { key: 'node', header: 't_j', format: 'latex' },
          { key: 'term', header: String.raw`\text{Punto}`, format: 'latex' },
          { key: 'c', header: 'c_j', format: 'latex' },
        ],
        rows: solution.map((c, j) => ({
          node: toLatexNumber(nodes[j]!),
          term: nodeTerm(nodes[j]!),
          c: c.toLatex(),
        })),
      },
    ],
  };
}

function nodeTermPoint(t: number): string {
  if (t === 0) return 'x_i';
  const abs = Math.abs(t);
  return `x_i ${t < 0 ? '-' : '+'} ${abs === 1 ? '' : toLatexNumber(abs)}h`;
}

export const undeterminedCoefficients: Calculator<
  UndeterminedCoefficientsInput,
  UndeterminedCoefficientsValue,
  UndeterminedCoefficientsErrorCode
> = {
  meta: {
    id: 'coeficientes-indeterminados',
    title: 'Método de coeficientes indeterminados',
    summary:
      'Deduce una fórmula de derivación o de integración numérica resolviendo un sistema lineal, con su error.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 21, ec. 21.15–21.16 (Simpson 1/3) y ec. 21.21 (Simpson 3/8); cap. 23, figuras 23.1 a 23.3 (fórmulas de derivación), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'smith-1993' },
    ],
  },
  inputSchema: undeterminedCoefficientsInputSchema,
  example: {
    target: 'integral',
    order: 1,
    nodes: '0 1 2',
    a: 0,
    b: 2,
    expression: '',
  },
  solve: solveUndeterminedCoefficients,
};
