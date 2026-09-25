/**
 * Núcleo común de la integración numérica (Chapra & Canale, cap. 21): divide [a, b] en n
 * segmentos de ancho h = (b − a)/n, evalúa f en los nodos que pide cada regla y combina esos
 * valores. Cada regla (rectangular, trapecio, Simpson) aporta sus nodos y su fórmula.
 *
 * Si el estudiante conoce el valor exacto, se reportan E_t = valor exacto − aproximación y
 * ε_t = E_t / valor exacto × 100 % (Chapra, ec. 3.2 y 3.3), como en los ejemplos del libro.
 */
import { z } from 'zod';
import { parseFunction, type ParsedExpression } from '@/lib/math/expression';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import {
  emptyTrace,
  type CalculatorResult,
  type Series,
  type Step,
  type SummaryItem,
} from '../types';
import { expressionField, finiteNumber } from './root-finding';

export const integrationShape = {
  expression: expressionField,
  a: finiteNumber('el límite inferior a'),
  b: finiteNumber('el límite superior b'),
  n: z
    .number({ error: 'Ingresa el número de segmentos.' })
    .int('El número de segmentos debe ser entero.')
    .min(1, 'Debe haber al menos 1 segmento.')
    .max(1000, 'El máximo permitido es 1000 segmentos.'),
  exact: finiteNumber('el valor exacto').optional(),
};

/** Refinamiento común: a < b. Se usa como `.refine(intervalIsValid, intervalError)`. */
export const intervalIsValid = (v: { a: number; b: number }) => v.a < v.b;
export const intervalError = {
  message: 'El límite inferior a debe ser menor que el superior b.',
  path: ['b'],
};

export interface IntegrationInput {
  expression: string;
  a: number;
  b: number;
  n: number;
  exact?: number | undefined;
}

export interface IntegrationValue {
  integral: number;
  h: number;
  n: number;
  /** E_t = exacto − aproximado; `null` si no se dio el valor exacto. */
  trueError: number | null;
  /** ε_t (%); `null` si no se dio el valor exacto o es 0. */
  trueRelativeError: number | null;
}

export type IntegrationErrorCode = 'invalid-expression' | 'non-finite' | 'invalid-segments';
export type IntegrationResult = CalculatorResult<IntegrationValue, IntegrationErrorCode>;

export interface IntegrationNode {
  i: number;
  x: number;
  fx: number;
}

export interface IntegrationRule<TInput extends IntegrationInput> {
  /** Mensaje de error si la regla no admite esa entrada (p. ej. Simpson con n = 1). */
  validate?(input: TInput): string | null;
  /** Explicación de dónde se evalúa f. */
  nodesExplanation(input: TInput): string;
  /** Abscisas donde se evalúa f, en orden, a partir de a, h y n. */
  nodes(input: TInput, h: number): number[];
  /** Nombre LaTeX del nodo i (`x_i` o `\bar{x}_i` para puntos medios). */
  nodeLabel?: string;
  /** Índice del primer nodo (1 si la regla empieza en x_1, p. ej. extremos derechos). */
  firstIndex?(input: TInput): number;
  /** Aplica la fórmula a los valores y explica cada paso. */
  apply(input: TInput, h: number, nodes: IntegrationNode[]): { integral: number; steps: Step[] };
}

const n = toLatexNumber;

/** Muestra los valores uno por uno si son pocos; si no, solo su suma. */
export function listOrSum(values: number[], maxListed = 6): string {
  if (values.length === 0) return '0';
  if (values.length > maxListed) return n(values.reduce((s, v) => s + v, 0));
  return values
    .map((v, i) => (i === 0 ? n(v) : `${v < 0 ? '-' : '+'} ${n(Math.abs(v))}`))
    .join(' ');
}

function curve(f: ParsedExpression, a: number, b: number): Series['points'] {
  const samples = 120;
  return Array.from({ length: samples + 1 }, (_, k) => {
    const x = a + ((b - a) * k) / samples;
    return { x, y: f.evaluate(x) };
  }).filter((p) => Number.isFinite(p.y));
}

export function solveIntegration<TInput extends IntegrationInput>(
  input: TInput,
  rule: IntegrationRule<TInput>,
): IntegrationResult {
  const { a, b } = input;
  const invalid = rule.validate?.(input);
  if (invalid) {
    return { ok: false, error: { code: 'invalid-segments', message: invalid }, ...emptyTrace() };
  }
  const parsed = parseFunction(input.expression);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: parsed.message },
      ...emptyTrace(),
    };
  }
  const f = parsed.expr;
  const h = (b - a) / input.n;
  const label = rule.nodeLabel ?? 'x';

  const steps: Step[] = [
    {
      title: 'Ancho de cada segmento',
      formula: 'h = \\frac{b - a}{n}',
      substitution: `h = \\frac{${n(b)} - ${toLatexOperand(a)}}{${input.n}}`,
      result: `h = ${n(h)}`,
    },
  ];

  const first = rule.firstIndex?.(input) ?? 0;
  const nodes: IntegrationNode[] = rule
    .nodes(input, h)
    .map((x, k) => ({ i: first + k, x, fx: f.evaluate(x) }));
  steps.push({
    title: 'Evaluar f en los nodos',
    explanation: `${rule.nodesExplanation(input)}${nodes.length > 12 ? ' Los valores están en la tabla de resultados.' : ''}`,
    children:
      nodes.length <= 12
        ? nodes.map((node) => ({
            title: `Nodo ${node.i}`,
            result: `f(${label}_{${node.i}}) = f(${n(node.x)}) = ${n(node.fx)}`,
          }))
        : undefined,
  });

  const table = {
    id: 'nodos',
    title: 'Valores de f en los nodos',
    columns: [
      { key: 'i', header: 'i' },
      { key: 'x', header: `${label}_i` },
      { key: 'fx', header: `f(${label}_i)` },
    ],
    rows: nodes.map((node) => ({ ...node })),
  };
  const series: Series[] = [
    {
      id: 'funcion',
      title: `f(x) en [${formatNumber(a)}, ${formatNumber(b)}]`,
      xLabel: 'x',
      yLabel: 'f(x)',
      kind: 'area',
      points: curve(f, a, b),
    },
  ];

  const bad = nodes.find((node) => !Number.isFinite(node.fx));
  if (bad) {
    return {
      ok: false,
      error: {
        code: 'non-finite',
        message: `f(x) no tiene un valor real finito en x = ${formatNumber(bad.x)} (por ejemplo, una división entre cero). La regla necesita que f esté definida en todos los nodos.`,
      },
      ...emptyTrace(),
      steps,
      tables: [table],
      series,
    };
  }

  const applied = rule.apply(input, h, nodes);
  const integral = applied.integral;
  steps.push(...applied.steps);

  const summary: SummaryItem[] = [
    { label: 'Integral aproximada', value: `I \\approx ${n(integral)}`, emphasis: true },
    { label: 'Segmentos', value: `n = ${input.n}` },
    { label: 'Ancho del segmento', value: `h = ${n(h)}` },
  ];

  let trueError: number | null = null;
  let trueRelativeError: number | null = null;
  if (input.exact !== undefined) {
    trueError = input.exact - integral;
    trueRelativeError = input.exact === 0 ? null : (trueError / input.exact) * 100;
    steps.push({
      title: 'Error verdadero',
      explanation: 'Con el valor exacto se mide qué tan buena es la aproximación.',
      formula:
        'E_t = \\text{valor exacto} - I, \\qquad \\varepsilon_t = \\frac{E_t}{\\text{valor exacto}} \\times 100\\%',
      substitution: `E_t = ${n(input.exact)} - ${toLatexOperand(integral)}`,
      result:
        trueRelativeError === null
          ? `E_t = ${n(trueError)}`
          : `E_t = ${n(trueError)}, \\qquad \\varepsilon_t = ${n(trueRelativeError, 4)}\\,\\%`,
    });
    summary.push({ label: 'Error verdadero', value: `E_t = ${n(trueError, 6)}` });
    if (trueRelativeError !== null) {
      summary.push({
        label: 'Error relativo verdadero',
        value: `\\varepsilon_t = ${n(trueRelativeError, 4)}\\,\\%`,
      });
    }
  }

  return {
    ok: true,
    value: { integral, h, n: input.n, trueError, trueRelativeError },
    summary,
    ...emptyTrace(),
    steps,
    tables: [table],
    series,
  };
}
