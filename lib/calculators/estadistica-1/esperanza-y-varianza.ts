/**
 * Esperanza y varianza de una variable aleatoria (Walpole, Myers, Myers y Ye, sec. 4.1 y 4.2):
 *
 *   μ = E(X) = Σ x f(x)   o   ∫ x f(x) dx                    (definición 4.1)
 *   σ² = E(X²) − μ²,   E(X²) = Σ x² f(x)   o   ∫ x² f(x) dx     (teorema 4.2)
 *
 * En el caso continuo las integrales se calculan numéricamente (Gauss-Kronrod adaptativo), con
 * límites finitos o infinitos. Si E(X²) diverge, la varianza no existe (ejemplo 4.3).
 */
import { z } from 'zod';
import { parseFunction } from '@/lib/math/expression';
import {
  formatNumber,
  fractionToLatex,
  parseDecimal,
  parseFraction,
  toLatexNumber,
  toLatexOperand,
} from '@/lib/math/format';
import { integrate } from '@/lib/math/quadrature';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Latex,
  type Series,
  type Step,
} from '../types';

export const randomVariableTypes = ['discreta', 'continua'] as const;

const SUM_TOLERANCE = 1e-9;
/** Tolerancia para ∫f = 1: la integral numérica es muy precisa, pero la densidad puede venir
 *  con coeficientes redondeados por el estudiante. */
const DENSITY_TOLERANCE = 1e-6;
const MAX_VALUES = 50;

/** Límite de integración: un número o ±∞ (`inf`, `infinito`, `∞`). */
export function parseBound(text: string | undefined): number {
  const clean = (text ?? '').trim().toLowerCase().replace('−', '-').replace(/\s+/g, '');
  if (/^\+?(inf|infinito|∞)$/.test(clean)) return Infinity;
  if (/^-(inf|infinito|∞)$/.test(clean)) return -Infinity;
  return parseDecimal(clean);
}

const probabilityText = z.string().superRefine((text, ctx) => {
  const value = parseFraction(text.trim());
  if (Number.isNaN(value)) {
    ctx.addIssue({ code: 'custom', message: 'Escribe un número o una fracción, p. ej. 12/35.' });
  } else if (value < 0 || value > 1) {
    ctx.addIssue({ code: 'custom', message: 'Debe estar entre 0 y 1.' });
  }
});

export const expectationInputSchema = z
  .object({
    type: z.enum(randomVariableTypes, { error: 'Elige el tipo de variable.' }),
    values: z
      .array(
        z.object({
          x: z
            .number({ error: 'Ingresa el valor x.' })
            .refine(Number.isFinite, 'x debe ser un número finito.'),
          p: probabilityText,
        }),
      )
      .max(MAX_VALUES, `El máximo es ${MAX_VALUES} valores.`)
      .optional(),
    density: z.string().optional(),
    lower: z.string().optional(),
    upper: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'discreta') {
      const values = v.values ?? [];
      if (values.length < 1) {
        ctx.addIssue({ code: 'custom', path: ['values'], message: 'Ingresa al menos un valor.' });
        return;
      }
      const probabilities = values.map((row) => parseFraction(row.p.trim()));
      if (probabilities.some(Number.isNaN)) return;
      const sum = probabilities.reduce((s, p) => s + p, 0);
      if (Math.abs(sum - 1) > SUM_TOLERANCE) {
        ctx.addIssue({
          code: 'custom',
          path: ['values'],
          message: `Las probabilidades suman ${formatNumber(sum, 6)}; deben sumar 1.`,
        });
      }
      const xs = values.map((row) => row.x);
      if (new Set(xs).size !== xs.length) {
        ctx.addIssue({ code: 'custom', path: ['values'], message: 'Hay valores de x repetidos.' });
      }
      return;
    }
    const parsed = parseFunction(v.density ?? '');
    if (!parsed.ok) ctx.addIssue({ code: 'custom', path: ['density'], message: parsed.message });
    const a = parseBound(v.lower);
    const b = parseBound(v.upper);
    if (Number.isNaN(a)) {
      ctx.addIssue({ code: 'custom', path: ['lower'], message: 'Escribe un número o -inf.' });
    }
    if (Number.isNaN(b)) {
      ctx.addIssue({ code: 'custom', path: ['upper'], message: 'Escribe un número o inf.' });
    }
    if (!Number.isNaN(a) && !Number.isNaN(b) && a >= b) {
      ctx.addIssue({
        code: 'custom',
        path: ['upper'],
        message: 'El límite superior debe ser mayor que el inferior.',
      });
    }
  });

export type ExpectationInput = z.infer<typeof expectationInputSchema>;

export interface ExpectationValue {
  mean: number;
  /** E(X²) */
  secondMoment: number | null;
  /** `null` si E(X²) diverge (la varianza no existe). */
  variance: number | null;
  standardDeviation: number | null;
}

export type ExpectationErrorCode =
  'invalid-input' | 'not-a-density' | 'non-finite' | 'divergent-mean';

type Result = CalculatorResult<ExpectationValue, ExpectationErrorCode>;

const n = toLatexNumber;

function fail(code: ExpectationErrorCode, message: string, steps: Step[] = []): Result {
  return { ok: false, error: { code, message }, ...emptyTrace(), steps };
}

function summary(value: ExpectationValue) {
  return [
    { label: 'Media', value: `\\mu = E(X) = ${n(value.mean, 6)}`, emphasis: true },
    {
      label: 'Varianza',
      value:
        value.variance === null
          ? '\\sigma^2\\ \\text{no existe}'
          : `\\sigma^2 = ${n(value.variance, 6)}`,
    },
    {
      label: 'Desviación estándar',
      value:
        value.standardDeviation === null
          ? '\\sigma\\ \\text{no existe}'
          : `\\sigma = ${n(value.standardDeviation, 6)}`,
    },
  ];
}

function varianceSteps(mean: number, second: number): Step[] {
  const variance = second - mean ** 2;
  return [
    {
      title: 'Varianza',
      explanation:
        'Con el teorema 4.2 no hace falta calcular cada desviación (x − μ)²: basta E(X²) y la media.',
      formula: '\\sigma^2 = E(X^2) - \\mu^2',
      substitution: `\\sigma^2 = ${n(second)} - ${toLatexOperand(mean)}^2`,
      result: `\\sigma^2 = ${n(variance)}`,
    },
    {
      title: 'Desviación estándar',
      formula: '\\sigma = \\sqrt{\\sigma^2}',
      substitution: `\\sigma = \\sqrt{${n(variance)}}`,
      result: `\\sigma = ${n(Math.sqrt(Math.max(0, variance)))}`,
    },
  ];
}

function solveDiscreteCase(input: ExpectationInput): Result {
  const rows = (input.values ?? []).map((row) => ({
    x: row.x,
    text: row.p.trim(),
    p: parseFraction(row.p.trim()),
  }));
  if (rows.length === 0 || rows.some((r) => Number.isNaN(r.p) || r.p < 0 || r.p > 1)) {
    return fail('invalid-input', 'Revisa la distribución: cada f(x) debe estar entre 0 y 1.');
  }
  const sum = rows.reduce((s, r) => s + r.p, 0);
  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    return fail('invalid-input', 'Las probabilidades deben sumar 1.');
  }
  const sorted = [...rows].sort((a, b) => a.x - b.x);
  const mean = sorted.reduce((s, r) => s + r.x * r.p, 0);
  const second = sorted.reduce((s, r) => s + r.x ** 2 * r.p, 0);
  const variance = second - mean ** 2;
  const value = {
    mean,
    secondMoment: second,
    variance,
    standardDeviation: Math.sqrt(Math.max(0, variance)),
  };
  const products = (power: 1 | 2) =>
    sorted.length <= 8
      ? sorted
          .map(
            (r) =>
              `${power === 1 ? toLatexOperand(r.x) : `(${n(r.x)})^2`}\\left(${fractionToLatex(r.text)}\\right)`,
          )
          .join(' + ')
      : undefined;

  const steps: Step[] = [
    {
      title: 'Verificar la distribución',
      explanation: 'Cada f(x) es una probabilidad y, juntas, suman 1.',
      formula: '\\sum_x f(x) = 1',
      substitution:
        sorted.length <= 8 ? sorted.map((r) => fractionToLatex(r.text)).join(' + ') : undefined,
      result: `\\sum_x f(x) = ${n(sum, 6)}`,
    },
    {
      title: 'Media (valor esperado)',
      explanation: 'Promedio de los valores de X, cada uno pesado por su probabilidad.',
      formula: '\\mu = E(X) = \\sum_x x\\,f(x)',
      substitution: products(1) && `\\mu = ${products(1)}`,
      result: `\\mu = ${n(mean)}`,
    },
    {
      title: 'Segundo momento',
      formula: 'E(X^2) = \\sum_x x^2 f(x)',
      substitution: products(2) && `E(X^2) = ${products(2)}`,
      result: `E(X^2) = ${n(second)}`,
    },
    ...varianceSteps(mean, second),
  ];

  const series: Series[] = [
    {
      id: 'distribucion',
      title: 'Distribución de probabilidad',
      xLabel: 'x',
      yLabel: 'f(x)',
      kind: 'bar',
      points: sorted.map((r) => ({ x: r.x, y: r.p })),
    },
  ];

  return {
    ok: true,
    value,
    summary: summary(value),
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'momentos',
        title: 'Cálculo de los momentos',
        columns: [
          { key: 'x', header: 'x', format: 'latex' },
          { key: 'p', header: 'f(x)' },
          { key: 'xp', header: 'x\\,f(x)' },
          { key: 'x2p', header: 'x^2 f(x)' },
          { key: 'dev', header: '(x - \\mu)^2 f(x)' },
        ],
        rows: [
          ...sorted.map((r) => ({
            x: n(r.x),
            p: r.p,
            xp: r.x * r.p,
            x2p: r.x ** 2 * r.p,
            dev: (r.x - mean) ** 2 * r.p,
          })),
          {
            x: '\\Sigma',
            p: sum,
            xp: mean,
            x2p: second,
            dev: sorted.reduce((s, r) => s + (r.x - mean) ** 2 * r.p, 0),
          },
        ],
      },
    ],
    series,
  };
}

const boundLatex = (v: number): Latex =>
  v === Infinity ? '\\infty' : v === -Infinity ? '-\\infty' : n(v);

function solveContinuousCase(input: ExpectationInput): Result {
  const parsed = parseFunction(input.density ?? '');
  if (!parsed.ok) return fail('invalid-input', parsed.message);
  const a = parseBound(input.lower);
  const b = parseBound(input.upper);
  if (Number.isNaN(a) || Number.isNaN(b) || a >= b) {
    return fail('invalid-input', 'Revisa los límites del soporte.');
  }
  const f = parsed.expr.evaluate;
  const tex = parsed.expr.tex;
  const range = `\\int_{${boundLatex(a)}}^{${boundLatex(b)}}`;

  const area = integrate(f, a, b);
  const steps: Step[] = [
    {
      title: 'Verificar la densidad',
      explanation:
        'Una función de densidad no es negativa y el área total bajo ella es 1. Fuera del soporte vale 0.',
      formula: `\\int_{-\\infty}^{\\infty} f(x)\\,dx = ${range} ${tex}\\,dx = 1`,
      result: area.converged ? `${range} f(x)\\,dx = ${n(area.value, 8)}` : undefined,
    },
  ];
  if (!area.converged || !Number.isFinite(area.value)) {
    return fail(
      'non-finite',
      'No se pudo integrar f(x) en el soporte: revisa que sea finita donde se define.',
      steps,
    );
  }
  // Muestreo para detectar valores negativos (una densidad no puede serlo en ningún punto).
  const lo = Number.isFinite(a) ? a : Math.min(-10, b - 10);
  const hi = Number.isFinite(b) ? b : Math.max(10, a + 10);
  const samples = Array.from({ length: 401 }, (_, k) => lo + ((hi - lo) * (k + 0.5)) / 401);
  const negative = samples.find((x) => f(x) < 0);
  if (negative !== undefined || Math.abs(area.value - 1) > DENSITY_TOLERANCE) {
    return fail(
      'not-a-density',
      negative !== undefined
        ? `f(x) es negativa en x = ${formatNumber(negative, 4)}: no es una función de densidad.`
        : `El área bajo f(x) es ${formatNumber(area.value, 8)}, no 1: no es una función de densidad (revisa la constante o el soporte).`,
      steps,
    );
  }

  const first = integrate((x) => x * f(x), a, b);
  steps.push({
    title: 'Media (valor esperado)',
    explanation: 'Es la integral de x por la densidad en el soporte (definición 4.1).',
    formula: `\\mu = E(X) = ${range} x\\,f(x)\\,dx`,
    substitution: `\\mu = ${range} x \\left(${tex}\\right) dx`,
    result: first.converged ? `\\mu = ${n(first.value)}` : undefined,
  });
  if (!first.converged || !Number.isFinite(first.value)) {
    return fail(
      'divergent-mean',
      'La integral de x·f(x) no converge: esta distribución no tiene media.',
      steps,
    );
  }
  const mean = first.value;
  const second = integrate((x) => x * x * f(x), a, b);
  steps.push({
    title: 'Segundo momento',
    formula: `E(X^2) = ${range} x^2 f(x)\\,dx`,
    substitution: `E(X^2) = ${range} x^2 \\left(${tex}\\right) dx`,
    result: second.converged ? `E(X^2) = ${n(second.value)}` : '\\text{la integral diverge}',
  });

  const notices = [];
  let value: ExpectationValue;
  if (second.converged && Number.isFinite(second.value)) {
    steps.push(...varianceSteps(mean, second.value));
    const variance = second.value - mean ** 2;
    value = {
      mean,
      secondMoment: second.value,
      variance,
      standardDeviation: Math.sqrt(Math.max(0, variance)),
    };
  } else {
    notices.push({
      level: 'warning' as const,
      message:
        'E(X²) es infinita: la variable tiene media pero no varianza (la cola de la densidad decrece demasiado lento).',
    });
    value = { mean, secondMoment: null, variance: null, standardDeviation: null };
  }

  const spread = value.standardDeviation ?? Math.abs(mean - (Number.isFinite(a) ? a : 0)) + 1;
  const plotFrom = Number.isFinite(a) ? a : mean - 4 * spread;
  const plotTo = Number.isFinite(b) ? b : mean + 4 * spread;
  const points = Array.from({ length: 201 }, (_, k) => {
    const x = plotFrom + ((plotTo - plotFrom) * k) / 200;
    return { x, y: f(x) };
  });

  return {
    ok: true,
    value,
    summary: summary(value),
    ...emptyTrace(),
    steps,
    notices,
    series: [
      {
        id: 'densidad',
        title: 'Función de densidad',
        xLabel: 'x',
        yLabel: 'f(x)',
        points,
        kind: 'area',
      },
    ],
  };
}

export function solveExpectation(input: ExpectationInput): Result {
  return input.type === 'discreta' ? solveDiscreteCase(input) : solveContinuousCase(input);
}

export const expectation: Calculator<ExpectationInput, ExpectationValue, ExpectationErrorCode> = {
  meta: {
    id: 'esperanza-y-varianza',
    title: 'Esperanza y varianza de una variable aleatoria',
    summary: 'Calcula E[X], E[X²], Var(X) y σ de una variable discreta o continua.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator:
          'Sec. 4.1 y 4.2, definición 4.1 y teorema 4.2, Ejemplos 4.1, 4.3, 4.8, 4.9 y 4.10 (9.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: expectationInputSchema,
  // Walpole, ejemplo 4.9: número de partes defectuosas en una muestra de 3.
  example: {
    type: 'discreta',
    values: [
      { x: 0, p: '0.51' },
      { x: 1, p: '0.38' },
      { x: 2, p: '0.10' },
      { x: 3, p: '0.01' },
    ],
    density: '2(x - 1)',
    lower: '1',
    upper: '2',
  },
  solve: solveExpectation,
};
