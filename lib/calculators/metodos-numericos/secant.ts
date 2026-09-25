/**
 * Método de la secante (método abierto): aproxima la derivada de Newton-Raphson con una
 * diferencia dividida hacia atrás, así que no necesita f'(x).
 *
 *   x_{i+1} = x_i − f(x_i)(x_{i−1} − x_i) / (f(x_{i−1}) − f(x_i))      (Chapra & Canale, ec. 6.7)
 *
 * A diferencia de la falsa posición, los valores se reemplazan en secuencia estricta (x_i pasa a
 * ser x_{i−1}), así que pueden quedar del mismo lado de la raíz y el método puede diverger.
 */
import { z } from 'zod';
import { parseFunction } from '@/lib/math/expression';
import { absoluteError } from '@/lib/math/error-metrics';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type Trace,
} from '../types';
import {
  approximateError,
  convergenceSeries,
  evaluationStep,
  expressionField,
  finiteNumber,
  maxIterationsField,
  nonFiniteMessage,
  rootSummary,
  toleranceField,
} from './root-finding';

export const secantInputSchema = z
  .object({
    expression: expressionField,
    xPrev: finiteNumber('x₋₁'),
    x0: finiteNumber('x₀'),
    tolerance: toleranceField,
    maxIterations: maxIterationsField,
  })
  .refine((v) => v.xPrev !== v.x0, {
    message: 'Los dos valores iniciales deben ser distintos.',
    path: ['x0'],
  });

export type SecantInput = z.infer<typeof secantInputSchema>;

export interface SecantValue {
  root: number;
  iterations: number;
  approximateError: number | null;
  residual: number;
}

export type SecantErrorCode =
  'invalid-expression' | 'zero-denominator' | 'non-finite' | 'max-iterations';

type Result = CalculatorResult<SecantValue, SecantErrorCode>;

interface Row {
  i: number;
  xPrev: number;
  xCurr: number;
  fPrev: number;
  fCurr: number;
  xNext: number;
  absoluteError: number;
  ea: number | null;
}

const n = toLatexNumber;
const op = toLatexOperand;
const SECANT_FORMULA = 'x_{i+1} = x_i - \\frac{f(x_i)\\,(x_{i-1} - x_i)}{f(x_{i-1}) - f(x_i)}';

function buildTrace(steps: Step[], rows: Row[], notices: Trace['notices']): Trace {
  const trace = { ...emptyTrace(), steps, notices };
  if (rows.length === 0) return trace;
  trace.tables.push({
    id: 'iteraciones',
    title: 'Iteraciones',
    columns: [
      { key: 'i', header: 'i' },
      { key: 'xPrev', header: 'x_{i-1}' },
      { key: 'xCurr', header: 'x_i' },
      { key: 'fPrev', header: 'f(x_{i-1})' },
      { key: 'fCurr', header: 'f(x_i)' },
      { key: 'xNext', header: 'x_{i+1}' },
      { key: 'absoluteError', header: 'E_a' },
      { key: 'ea', header: '\\varepsilon_a\\,(\\%)' },
    ],
    rows: rows.map((row) => ({ ...row })),
  });
  trace.series.push(
    ...convergenceSeries(
      rows.map((r) => ({ iteration: r.i + 1, approximation: r.xNext, ea: r.ea })),
      'x_{i+1}',
    ),
  );
  return trace;
}

export function solveSecant(input: SecantInput): Result {
  const { tolerance, maxIterations } = input;
  const parsed = parseFunction(input.expression);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: parsed.message },
      ...emptyTrace(),
    };
  }
  const f = parsed.expr;

  const steps: Step[] = [];
  const rows: Row[] = [];
  const notices: Trace['notices'] = [];

  const fail = (code: SecantErrorCode, message: string): Result => ({
    ok: false,
    error: { code, message },
    ...buildTrace(steps, rows, notices),
  });
  const succeed = (root: number): Result => {
    const ea = rows.at(-1)?.ea ?? null;
    const residual = f.evaluate(root);
    return {
      ok: true,
      value: { root, iterations: rows.length, approximateError: ea, residual },
      summary: rootSummary(root, rows.length, ea, residual),
      ...buildTrace(steps, rows, notices),
    };
  };

  let xPrev = input.xPrev;
  let xCurr = input.x0;
  let fPrev = f.evaluate(xPrev);

  for (let i = 0; i < maxIterations; i++) {
    const fCurr = f.evaluate(xCurr);
    const prevLabel = `x_{${i - 1}}`;
    const currLabel = `x_{${i}}`;
    const nextLabel = `x_{${i + 1}}`;
    const children: Step[] = [
      evaluationStep(prevLabel, xPrev, fPrev),
      evaluationStep(currLabel, xCurr, fCurr),
    ];

    if (!Number.isFinite(fPrev) || !Number.isFinite(fCurr)) {
      steps.push({
        title: `Iteración ${i + 1}`,
        explanation:
          i > 0
            ? 'La aproximación anterior cayó fuera del dominio de f: el método diverge desde estos valores iniciales.'
            : undefined,
        children,
      });
      return fail('non-finite', nonFiniteMessage(Number.isFinite(fPrev) ? xCurr : xPrev));
    }

    if (fCurr === 0) {
      steps.push({
        title: i === 0 ? 'Comprobar el valor inicial' : `Iteración ${i + 1}`,
        explanation: `f(${formatNumber(xCurr)}) = 0, así que ${formatNumber(xCurr)} es una raíz exacta.`,
        children: children.slice(1),
      });
      notices.push({
        level: 'info',
        message: `x = ${formatNumber(xCurr)} es una raíz exacta: f(x) = 0.`,
      });
      return succeed(xCurr);
    }

    if (fPrev === fCurr) {
      steps.push({
        title: `Iteración ${i + 1}`,
        explanation:
          'f(xᵢ₋₁) = f(xᵢ): la recta secante es horizontal y nunca corta el eje x, así que la fórmula dividiría entre cero.',
        children,
      });
      return fail(
        'zero-denominator',
        `f toma el mismo valor en ${formatNumber(xPrev)} y en ${formatNumber(xCurr)} (iteración ${i + 1}); la secante no corta el eje x. Prueba con otros valores iniciales.`,
      );
    }

    const xNext = xCurr - (fCurr * (xPrev - xCurr)) / (fPrev - fCurr);
    const {
      ea,
      converged,
      step: errorStep,
    } = approximateError(xNext, xCurr, tolerance, nextLabel, currLabel);
    rows.push({
      i,
      xPrev,
      xCurr,
      fPrev,
      fCurr,
      xNext,
      absoluteError: absoluteError(xNext, xCurr),
      ea,
    });

    children.push(
      {
        title: 'Aplicar la fórmula de la secante',
        formula: SECANT_FORMULA,
        substitution: `${nextLabel} = ${n(xCurr)} - \\frac{${op(fCurr)}\\,(${n(xPrev)} - ${op(xCurr)})}{${n(fPrev)} - ${op(fCurr)}}`,
        result: `${nextLabel} = ${n(xNext)}`,
      },
      errorStep,
    );
    steps.push({ title: `Iteración ${i + 1}`, children });

    if (!Number.isFinite(xNext)) {
      return fail(
        'non-finite',
        `La aproximación se volvió infinita en la iteración ${i + 1}: el método diverge.`,
      );
    }
    if (converged) {
      steps.push({
        title: 'Conclusión',
        explanation: `Después de ${i + 1} iteraciones el error relativo aproximado es menor que la tolerancia.`,
        result: `x_r \\approx ${n(xNext)}`,
      });
      return succeed(xNext);
    }

    // Reemplazo en secuencia estricta: x_i → x_{i−1}, x_{i+1} → x_i.
    xPrev = xCurr;
    fPrev = fCurr;
    xCurr = xNext;
  }

  if (f.evaluate(xCurr) === 0) {
    notices.push({
      level: 'info',
      message: `x = ${formatNumber(xCurr)} es una raíz exacta: f(x) = 0.`,
    });
    return succeed(xCurr);
  }

  return fail(
    'max-iterations',
    `El método no alcanzó la tolerancia de ${String(tolerance)} % en ${maxIterations} iteraciones. La última aproximación fue x = ${formatNumber(xCurr)}. Aumenta el máximo de iteraciones o prueba con otros valores iniciales.`,
  );
}

export const secant: Calculator<SecantInput, SecantValue, SecantErrorCode> = {
  meta: {
    id: 'secante',
    title: 'Método de la secante',
    summary: 'Aproxima una raíz sin derivada, usando dos puntos previos.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator: 'Cap. 6, sección 6.3, Ejemplos 6.6 y 6.7 (pp. 155–156 de la 5.ª ed. en español)',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: secantInputSchema,
  // Chapra & Canale, ejemplo 6.6. εs = 0.00005 % garantiza 6 cifras significativas (ec. 3.7).
  example: { expression: 'e^(-x) - x', xPrev: 0, x0: 1, tolerance: 0.00005, maxIterations: 20 },
  solve: solveSecant,
};
