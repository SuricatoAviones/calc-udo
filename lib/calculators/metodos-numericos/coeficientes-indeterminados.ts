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
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Latex,
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
    if (v.target === 'integral' && !(v.b > v.a)) {
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

function nodeTerm(t: number): Latex {
  if (t === 0) return 'f(x_i)';
  const abs = Math.abs(t);
  return `f(x_i ${t < 0 ? '-' : '+'} ${abs === 1 ? '' : toLatexNumber(abs)}h)`;
}

/** Σ aⱼ·nombreⱼ en LaTeX, omitiendo los coeficientes nulos: `-c_{0} + c_{2}`. */
function linearCombination(coefficients: Rational[], names: Latex[]): Latex {
  const terms = coefficients
    .map((c, j) => ({ c, j }))
    .filter(({ c }) => !c.isZero())
    .map(({ c, j }, i) => {
      const abs = c.abs();
      const body = `${abs.eq(Rational.ONE) ? '' : `${abs.toLatex()}\\,`}${names[j]}`;
      if (i === 0) return c.sign() < 0 ? `-${body}` : body;
      return c.sign() < 0 ? `- ${body}` : `+ ${body}`;
    });
  return terms.length === 0 ? '0' : terms.join(' ');
}

/** Σ cⱼ f(xᵢ + tⱼh) en LaTeX. */
function formulaSum(coefficients: Rational[], nodes: number[]): Latex {
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
    : `\\int_{${nodeTermPoint(input.a)}}^{${nodeTermPoint(input.b)}} f(x)\\,dx`;
  const scale = derivative ? (d === 1 ? '\\frac{1}{h}' : `\\frac{1}{h^{${d}}}`) : 'h';

  const matrix = Array.from({ length: size }, (_, k) => t.map((tj) => power(tj, k)));
  const rhs = Array.from({ length: size }, (_, k) => moment(input.target, k, d, a, b));

  const steps: Step[] = [
    {
      title: 'Forma de la fórmula',
      explanation: `Se buscan ${size} coeficientes c₀ … c${'₀₁₂₃₄₅₆₇₈₉'[size - 1]} para los nodos t = ${nodes.map((v) => formatNumber(v)).join(', ')} (en unidades de h, contados desde xᵢ).`,
      formula: `${lhsName} \\approx ${scale} \\sum_{j} c_j\\, f(x_i + t_j h)`,
    },
    {
      title: 'Condiciones: exacta para 1, t, t², …',
      explanation: derivative
        ? `Con xᵢ = 0 y h = 1, la fórmula debe dar la derivada de orden ${d} de cada potencia tᵏ en 0, que vale ${d}! si k = ${d} y 0 si no.`
        : `Con xᵢ = 0 y h = 1, la fórmula debe dar la integral de cada potencia tᵏ entre ${formatNumber(input.a)} y ${formatNumber(input.b)}: (b^{k+1} − a^{k+1})/(k + 1).`,
      children: matrix.map((row, k) => ({
        title: k === 0 ? 'f(t) = 1' : k === 1 ? 'f(t) = t' : `f(t) = t^${k}`,
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
    result: solution.map((c, j) => `c_{${j}} = ${c.toLatex()}`).join(',\\quad '),
  });

  // Primer k en que la fórmula deja de ser exacta: da el orden del error.
  let exactDegree = size - 1;
  let errorPower: number | null = null;
  let errorConstant: Rational | null = null;
  for (let k = size; k < size + 6; k++) {
    const achieved = solution.reduce((s, c, j) => s.add(c.mul(power(t[j]!, k))), Rational.ZERO);
    const expected = moment(input.target, k, d, a, b);
    if (achieved.eq(expected)) {
      exactDegree = k;
      continue;
    }
    errorConstant = expected.sub(achieved).div(Rational.of(factorial(k)));
    errorPower = derivative ? k - d : k + 1;
    break;
  }

  const formulaTex = `${lhsName} \\approx ${scale}\\left[${formulaSum(solution, nodes)}\\right]`;
  const derivativeK = errorPower === null ? null : derivative ? errorPower + d : errorPower - 1;
  steps.push({
    title: 'Fórmula',
    result: formulaTex,
  });
  steps.push({
    title: 'Error de truncamiento',
    explanation:
      errorPower === null
        ? `La fórmula es exacta al menos hasta polinomios de grado ${exactDegree}.`
        : `La fórmula es exacta para polinomios de grado ≤ ${exactDegree}; con t^${exactDegree + 1} ya no. El término que falta da el error de truncamiento.`,
    formula:
      errorPower === null
        ? undefined
        : `E = \\frac{M_{${exactDegree + 1}} - \\sum_j c_j t_j^{${exactDegree + 1}}}{${exactDegree + 1}!}\\, h^{${errorPower}} f^{(${derivativeK})}(\\xi)`,
    result:
      errorPower === null || errorConstant === null
        ? undefined
        : `E = ${errorConstant.toLatex()}\\, h^{${errorPower}} f^{(${derivativeK})}(\\xi) = O(h^{${errorPower}})`,
  });

  let applied: number | null = null;
  if (input.expression) {
    const parsed = parseFunction(input.expression);
    if (!parsed.ok) {
      return {
        ok: false,
        error: { code: 'invalid-expression', message: parsed.message },
        ...emptyTrace(),
        steps,
      };
    }
    const x0 = input.x0!;
    const h = input.h!;
    const values = nodes.map((tj) => parsed.expr.evaluate(x0 + tj * h));
    if (values.some((v) => !Number.isFinite(v))) {
      return {
        ok: false,
        error: { code: 'non-finite', message: 'f no tiene un valor real finito en algún nodo.' },
        ...emptyTrace(),
        steps,
      };
    }
    const sum = solution.reduce((s, c, j) => s + c.toNumber() * values[j]!, 0);
    applied = derivative ? sum / h ** d : sum * h;
    steps.push({
      title: `Aplicar a f(x) = ${input.expression}`,
      explanation: `Con xᵢ = ${formatNumber(x0)} y h = ${formatNumber(h)}.`,
      substitution: nodes
        .map((tj, j) => `f(${toLatexNumber(x0 + tj * h)}) = ${toLatexNumber(values[j]!)}`)
        .join(',\\ '),
      result: `${derivative ? `f^{(${d})}(${toLatexNumber(x0)})` : '\\int f(x)\\,dx'} \\approx ${toLatexNumber(applied)}`,
    });
  }

  const summary: SummaryItem[] = [
    { label: 'Fórmula', value: formulaTex, emphasis: true },
    ...(errorPower === null || errorConstant === null
      ? []
      : [
          {
            label: 'Error de truncamiento',
            value: `${errorConstant.toLatex()}\\, h^{${errorPower}} f^{(${derivativeK})}(\\xi)`,
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
          { key: 'term', header: '\\text{Punto}', format: 'latex' },
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

function nodeTermPoint(t: number): Latex {
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
