/**
 * Núcleo común de los métodos cerrados (Chapra & Canale, cap. 5): bisección y falsa posición.
 *
 * Ambos parten de un intervalo [x_l, x_u] con cambio de signo y en cada iteración:
 *   1. calculan una aproximación x_r dentro del intervalo (aquí es donde difieren);
 *   2. evalúan f(x_l)·f(x_r) para quedarse con el subintervalo que contiene la raíz;
 *   3. se detienen cuando ε_a < ε_s (ec. 5.2).
 *
 * Cada método solo aporta su `BracketingRule` (cómo se calcula x_r y cómo se explica).
 */
import { z } from 'zod';
import { parseFunction } from '@/lib/math/expression';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { emptyTrace, type CalculatorResult, type Latex, type Step, type Trace } from '../types';
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

export const bracketingInputSchema = z
  .object({
    expression: expressionField,
    xl: finiteNumber('el límite inferior xₗ'),
    xu: finiteNumber('el límite superior xᵤ'),
    tolerance: toleranceField,
    maxIterations: maxIterationsField,
  })
  .refine((v) => v.xl < v.xu, {
    message: 'El límite inferior xₗ debe ser menor que el superior xᵤ.',
    path: ['xu'],
  });

export type BracketingInput = z.infer<typeof bracketingInputSchema>;

export interface BracketingValue {
  root: number;
  iterations: number;
  approximateError: number | null;
  residual: number;
}

export type BracketingErrorCode =
  'invalid-expression' | 'no-sign-change' | 'non-finite' | 'max-iterations';

export type BracketingResult = CalculatorResult<BracketingValue, BracketingErrorCode>;

export interface BracketingRule {
  /** Sujeto de la frase explicativa: "La bisección", "La falsa posición". */
  methodName: string;
  /** Título del paso que calcula x_r. */
  pointTitle: string;
  /** Explicación breve de por qué x_r se calcula así. */
  pointExplanation?: string;
  formula: Latex;
  compute(xl: number, xu: number, fxl: number, fxu: number): number;
  substitution(xl: number, xu: number, fxl: number, fxu: number): Latex;
}

interface Row {
  i: number;
  xl: number;
  xu: number;
  fxl: number;
  fxu: number;
  xr: number;
  fxr: number;
  ea: number | null;
}

const n = toLatexNumber;
const op = toLatexOperand;

function buildTrace(steps: Step[], rows: Row[], notices: Trace['notices']): Trace {
  const trace = { ...emptyTrace(), steps, notices };
  if (rows.length === 0) return trace;
  trace.tables.push({
    id: 'iteraciones',
    title: 'Iteraciones',
    columns: [
      { key: 'i', header: 'i' },
      { key: 'xl', header: 'x_l' },
      { key: 'xu', header: 'x_u' },
      { key: 'xr', header: 'x_r' },
      { key: 'fxl', header: 'f(x_l)' },
      { key: 'fxu', header: 'f(x_u)' },
      { key: 'fxr', header: 'f(x_r)' },
      { key: 'ea', header: '\\varepsilon_a\\,(\\%)' },
    ],
    rows: rows.map((row) => ({ ...row })),
  });
  trace.series.push(
    ...convergenceSeries(
      rows.map((r) => ({ iteration: r.i, approximation: r.xr, ea: r.ea })),
      'x_r',
    ),
  );
  return trace;
}

export function solveBracketing(input: BracketingInput, rule: BracketingRule): BracketingResult {
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

  const fail = (code: BracketingErrorCode, message: string): BracketingResult => ({
    ok: false,
    error: { code, message },
    ...buildTrace(steps, rows, notices),
  });
  const succeed = (root: number): BracketingResult => {
    const ea = rows.at(-1)?.ea ?? null;
    const residual = f.evaluate(root);
    return {
      ok: true,
      value: { root, iterations: rows.length, approximateError: ea, residual },
      summary: rootSummary(root, rows.length, ea, residual),
      ...buildTrace(steps, rows, notices),
    };
  };
  const exactRoot = (x: number) =>
    notices.push({
      level: 'info',
      message: `x = ${formatNumber(x)} es una raíz exacta: f(x) = 0.`,
    });

  let { xl, xu } = input;
  let fxl = f.evaluate(xl);
  let fxu = f.evaluate(xu);

  // ── Paso 0: el intervalo debe encerrar una raíz ───────────────────────────
  steps.push({
    title: 'Verificar el cambio de signo',
    explanation: `${rule.methodName} necesita un intervalo [xₗ, xᵤ] donde f cambie de signo: así se garantiza que hay al menos una raíz dentro.`,
    children: [
      evaluationStep('x_l', xl, fxl),
      evaluationStep('x_u', xu, fxu),
      {
        title: 'Producto de los valores en los extremos',
        explanation: 'Debe ser negativo.',
        formula: 'f(x_l)\\,f(x_u) < 0',
        substitution: `f(x_l)\\,f(x_u) = ${op(fxl)}\\,${op(fxu)}`,
        result: `f(x_l)\\,f(x_u) = ${n(fxl * fxu)}`,
      },
    ],
  });

  if (!Number.isFinite(fxl) || !Number.isFinite(fxu)) {
    return fail('non-finite', nonFiniteMessage(Number.isFinite(fxl) ? xu : xl));
  }
  if (fxl === 0 || fxu === 0) {
    const root = fxl === 0 ? xl : xu;
    exactRoot(root);
    return succeed(root);
  }
  if (fxl * fxu > 0) {
    return fail(
      'no-sign-change',
      `f(x_l) y f(x_u) tienen el mismo signo, así que el intervalo [${formatNumber(xl)}, ${formatNumber(xu)}] no garantiza una raíz. Grafica la función o prueba con otro intervalo.`,
    );
  }

  let xrOld: number | null = null;
  for (let i = 1; i <= maxIterations; i++) {
    const xr = rule.compute(xl, xu, fxl, fxu);
    const fxr = f.evaluate(xr);
    const children: Step[] = [
      {
        title: rule.pointTitle,
        explanation: rule.pointExplanation,
        formula: rule.formula,
        substitution: rule.substitution(xl, xu, fxl, fxu),
        result: `x_r = ${n(xr)}`,
      },
      evaluationStep('x_r', xr, fxr),
    ];

    if (!Number.isFinite(xr) || !Number.isFinite(fxr)) {
      steps.push({ title: `Iteración ${i}`, children });
      return fail('non-finite', nonFiniteMessage(xr));
    }

    let ea: number | null = null;
    let converged = false;
    if (xrOld !== null) {
      const error = approximateError(
        xr,
        xrOld,
        tolerance,
        'x_r^{\\text{nuevo}}',
        'x_r^{\\text{anterior}}',
      );
      ({ ea, converged } = error);
      children.push(error.step);
    }
    rows.push({ i, xl, xu, fxl, fxu, xr, fxr, ea });

    const product = fxl * fxr;
    const testStep: Step = {
      title: 'Elegir el subintervalo que contiene la raíz',
      formula: 'f(x_l)\\,f(x_r)',
      substitution: `f(x_l)\\,f(x_r) = ${op(fxl)}\\,${op(fxr)} = ${n(product)}`,
    };
    children.push(testStep);

    if (product === 0) {
      testStep.explanation = `El producto es 0 porque f(xᵣ) = 0: xᵣ = ${formatNumber(xr)} es una raíz exacta.`;
      steps.push({ title: `Iteración ${i}`, children });
      exactRoot(xr);
      return succeed(xr);
    }
    if (product < 0) {
      testStep.explanation =
        'El producto es negativo: la raíz está en el primer subintervalo, así que xᵤ toma el valor de xᵣ.';
      testStep.result = `[x_l,\\ x_u] = [${n(xl)},\\ ${n(xr)}]`;
      xu = xr;
      fxu = fxr;
    } else {
      testStep.explanation =
        'El producto es positivo: la raíz está en el segundo subintervalo, así que xₗ toma el valor de xᵣ.';
      testStep.result = `[x_l,\\ x_u] = [${n(xr)},\\ ${n(xu)}]`;
      xl = xr;
      fxl = fxr;
    }
    steps.push({ title: `Iteración ${i}`, children });

    if (converged) {
      steps.push({
        title: 'Conclusión',
        explanation: `Después de ${i} iteraciones el error relativo aproximado es menor que la tolerancia.`,
        result: `x_r \\approx ${n(xr)}`,
      });
      return succeed(xr);
    }
    xrOld = xr;
  }

  return fail(
    'max-iterations',
    `El método no alcanzó la tolerancia de ${String(tolerance)} % en ${maxIterations} iteraciones. La última aproximación fue x = ${formatNumber(rows.at(-1)?.xr ?? xl)}. Aumenta el máximo de iteraciones.`,
  );
}
