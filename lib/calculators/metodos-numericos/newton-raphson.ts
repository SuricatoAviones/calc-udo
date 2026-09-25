/**
 * Método de Newton-Raphson para aproximar una raíz de f(x) = 0.
 *
 *   x_{n+1} = x_n − f(x_n) / f'(x_n)
 *
 * Criterio de parada (Chapra & Canale, sec. 3.3 y 6.2): error relativo porcentual aproximado
 * ε_a = |(x_{n+1} − x_n) / x_{n+1}| × 100 % < ε_s.
 */
import { z } from 'zod';
import { differentiate, parseFunction } from '@/lib/math/expression';
import { absoluteError } from '@/lib/math/error-metrics';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type ResultTable,
  type Step,
  type Trace,
} from '../types';
import {
  approximateError,
  convergenceSeries,
  expressionField,
  finiteNumber,
  maxIterationsField,
  rootSummary,
  toleranceField,
} from './root-finding';

// ─── Entrada ────────────────────────────────────────────────────────────────

export const newtonRaphsonInputSchema = z.object({
  expression: expressionField,
  x0: finiteNumber('x₀'),
  tolerance: toleranceField,
  maxIterations: maxIterationsField,
});

export type NewtonRaphsonInput = z.infer<typeof newtonRaphsonInputSchema>;

// ─── Salida ─────────────────────────────────────────────────────────────────

export interface NewtonRaphsonValue {
  root: number;
  /** Iteraciones realizadas (0 si x₀ ya era raíz exacta). */
  iterations: number;
  converged: boolean;
  /** ε_a (%) de la última iteración; `null` si no se iteró. */
  approximateError: number | null;
  /** f evaluada en la raíz aproximada, para que el estudiante vea qué tan cerca de 0 queda. */
  residual: number;
}

export type NewtonRaphsonErrorCode =
  'invalid-expression' | 'zero-derivative' | 'non-finite' | 'max-iterations';

type Result = CalculatorResult<NewtonRaphsonValue, NewtonRaphsonErrorCode>;

interface IterationRow {
  n: number;
  xn: number;
  fxn: number;
  dfxn: number;
  xNext: number;
  absoluteError: number;
  relativeError: number | null;
}

// ─── LaTeX ──────────────────────────────────────────────────────────────────

const NEWTON_FORMULA = "x_{n+1} = x_n - \\frac{f(x_n)}{f'(x_n)}";

const n = toLatexNumber;

function iterationTable(rows: IterationRow[]): ResultTable {
  return {
    id: 'iteraciones',
    title: 'Iteraciones',
    columns: [
      { key: 'n', header: 'n' },
      { key: 'xn', header: 'x_n' },
      { key: 'fxn', header: 'f(x_n)' },
      { key: 'dfxn', header: "f'(x_n)" },
      { key: 'xNext', header: 'x_{n+1}' },
      { key: 'absoluteError', header: 'E_a' },
      { key: 'relativeError', header: '\\varepsilon_a\\,(\\%)' },
    ],
    rows: rows.map((row) => ({ ...row })),
  };
}

function buildTrace(steps: Step[], rows: IterationRow[], notices: Trace['notices']): Trace {
  const trace = emptyTrace();
  trace.steps = steps;
  trace.notices = notices;
  if (rows.length > 0) {
    trace.tables.push(iterationTable(rows));
    trace.series.push(
      ...convergenceSeries(
        rows.map((r) => ({ iteration: r.n + 1, approximation: r.xNext, ea: r.relativeError })),
        'x_{n+1}',
      ),
    );
  }
  return trace;
}

// ─── Algoritmo ──────────────────────────────────────────────────────────────

export function solveNewtonRaphson(input: NewtonRaphsonInput): Result {
  const { x0, tolerance, maxIterations } = input;

  const parsed = parseFunction(input.expression);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: parsed.message },
      ...emptyTrace(),
    };
  }
  const f = parsed.expr;
  const derived = differentiate(f);
  if (!derived.ok) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: derived.message },
      ...emptyTrace(),
    };
  }
  const df = derived.expr;

  const steps: Step[] = [
    {
      title: 'Función y su derivada',
      explanation:
        'Newton-Raphson usa la recta tangente a f en cada punto, así que necesita la derivada. Se obtiene de forma simbólica.',
      formula: `f(x) = ${f.tex}`,
      result: `f'(x) = ${df.tex}`,
    },
  ];
  const rows: IterationRow[] = [];
  const notices: Trace['notices'] = [];

  const fail = (code: NewtonRaphsonErrorCode, message: string): Result => ({
    ok: false,
    error: { code, message },
    ...buildTrace(steps, rows, notices),
  });

  const succeed = (root: number, converged: boolean): Result => {
    const ea = rows.at(-1)?.relativeError ?? null;
    const residual = f.evaluate(root);
    return {
      ok: true,
      value: { root, iterations: rows.length, converged, approximateError: ea, residual },
      summary: rootSummary(root, rows.length, ea, residual),
      ...buildTrace(steps, rows, notices),
    };
  };

  let x = x0;
  for (let i = 0; i < maxIterations; i++) {
    const fx = f.evaluate(x);
    const dfx = df.evaluate(x);
    const xi = `x_{${i}}`;

    const evaluation: Step[] = [
      { title: `Evaluar f en ${formatNumber(x)}`, result: `f(${xi}) = f(${n(x)}) = ${n(fx)}` },
      {
        title: `Evaluar f' en ${formatNumber(x)}`,
        result: `f'(${xi}) = f'(${n(x)}) = ${n(dfx)}`,
      },
    ];

    if (!Number.isFinite(fx) || !Number.isFinite(dfx)) {
      steps.push({ title: `Iteración ${i + 1}`, children: evaluation });
      return fail(
        'non-finite',
        `f(x) o f'(x) no tiene un valor real finito en x = ${formatNumber(x)} (por ejemplo, una división entre cero o la raíz de un negativo). Prueba con otro valor inicial.`,
      );
    }

    if (fx === 0) {
      steps.push({
        title: i === 0 ? 'Comprobar el valor inicial' : `Iteración ${i + 1}`,
        explanation: `f(${formatNumber(x)}) = 0, así que ${formatNumber(x)} es una raíz exacta y no hace falta seguir iterando.`,
        children: evaluation.slice(0, 1),
      });
      notices.push({
        level: 'info',
        message: `x = ${formatNumber(x)} es una raíz exacta: f(x) = 0.`,
      });
      return succeed(x, true);
    }

    if (dfx === 0) {
      steps.push({
        title: `Iteración ${i + 1}`,
        explanation:
          'La derivada vale 0: la recta tangente es horizontal y nunca corta el eje x, así que la fórmula dividiría entre cero.',
        children: evaluation,
      });
      return fail(
        'zero-derivative',
        `La derivada se anula en x = ${formatNumber(x)} (iteración ${i + 1}); el método no puede continuar. Prueba con otro valor inicial.`,
      );
    }

    const xNext = x - fx / dfx;
    const xn1 = `x_{${i + 1}}`;
    const Ea = absoluteError(xNext, x);
    const { ea, converged, step: errorStep } = approximateError(xNext, x, tolerance, xn1, xi);

    rows.push({ n: i, xn: x, fxn: fx, dfxn: dfx, xNext, absoluteError: Ea, relativeError: ea });

    steps.push({
      title: `Iteración ${i + 1}`,
      children: [
        ...evaluation,
        {
          title: 'Aplicar la fórmula de Newton-Raphson',
          formula: NEWTON_FORMULA,
          substitution: `${xn1} = ${n(x)} - \\frac{${n(fx)}}{${n(dfx)}}`,
          result: `${xn1} = ${n(xNext)}`,
        },
        errorStep,
      ],
    });

    if (!Number.isFinite(xNext)) {
      return fail(
        'non-finite',
        `La aproximación se volvió infinita en la iteración ${i + 1}: el método diverge desde este valor inicial.`,
      );
    }

    if (converged) {
      steps.push({
        title: 'Conclusión',
        explanation: `Después de ${i + 1} iteraciones el error relativo aproximado es menor que la tolerancia.`,
        result: `x_r \\approx ${n(xNext)}`,
      });
      return succeed(xNext, true);
    }

    x = xNext;
  }

  // ¿Terminó justo en una raíz exacta tras la última iteración? (p. ej. funciones lineales)
  if (f.evaluate(x) === 0) {
    notices.push({
      level: 'info',
      message: `x = ${formatNumber(x)} es una raíz exacta: f(x) = 0.`,
    });
    return succeed(x, true);
  }

  return fail(
    'max-iterations',
    `El método no alcanzó la tolerancia de ${String(tolerance)} % en ${maxIterations} iteraciones. La última aproximación fue x = ${formatNumber(x)}. Aumenta el máximo de iteraciones o prueba con otro valor inicial.`,
  );
}

// ─── Calculadora ────────────────────────────────────────────────────────────

export const newtonRaphson: Calculator<
  NewtonRaphsonInput,
  NewtonRaphsonValue,
  NewtonRaphsonErrorCode
> = {
  meta: {
    id: 'newton-raphson',
    title: 'Método de Newton-Raphson',
    summary: 'Aproxima una raíz usando la recta tangente en cada iteración.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator: 'Cap. 6, sección 6.2, Ejemplos 6.3 y 6.5 (pp. 149–152 de la 5.ª ed. en español)',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: newtonRaphsonInputSchema,
  // Chapra & Canale, Ejemplo 6.3. εs = 0.00005 % garantiza 6 cifras significativas (ec. 3.7).
  example: { expression: 'e^(-x) - x', x0: 0, tolerance: 0.00005, maxIterations: 20 },
  solve: solveNewtonRaphson,
};
