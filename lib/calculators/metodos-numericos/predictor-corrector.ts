/**
 * Métodos predictor-corrector con el corrector iterado (Chapra & Canale, sec. 25.2.1 y 26.2.1):
 *
 *   Predictor de Euler (Heun iterado):          y⁰_{i+1} = y_i + f(x_i, y_i) h
 *   Predictor del punto medio (Heun sin
 *   autoinicio):                                y⁰_{i+1} = y_{i−1} + f(x_i, y_i) 2h
 *   Corrector (trapecio), se itera:             yʲ_{i+1} = y_i + [f(x_i, y_i) + f(x_{i+1}, yʲ⁻¹_{i+1})] h/2
 *
 * El corrector se repite hasta que |ε_a| = |(yʲ − yʲ⁻¹)/yʲ| × 100 % < ε_s o hasta el máximo de
 * iteraciones. Aplicado una sola vez con el predictor de Euler es el método de Euler modificado
 * (ADR-013). El predictor del punto medio necesita y_{i−1}: se toma de la solución exacta en
 * x₀ − h (como en el libro) o se da el primer paso con Runge-Kutta de cuarto orden.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import type { Calculator, Step } from '../types';
import {
  odeShape,
  refineOde,
  slopeStep,
  solveOde,
  type OdeErrorCode,
  type OdeRule,
  type OdeRuleFactory,
  type OdeValue,
} from './ode';
import { rk4Rule } from './ode-methods';
import { toleranceField } from './root-finding';

export const predictorOptions = ['euler', 'punto-medio'] as const;
export const pcStartOptions = ['rk4', 'exacta'] as const;

export const predictorCorrectorInputSchema = z
  .object({
    ...odeShape,
    predictor: z.enum(predictorOptions, { error: 'Elige el predictor.' }),
    start: z.enum(pcStartOptions, { error: 'Elige cómo obtener y₋₁.' }),
    tolerance: toleranceField,
    maxIterations: z
      .number({ error: 'Ingresa el máximo de iteraciones del corrector.' })
      .int('Debe ser un número entero.')
      .min(1, 'Debe haber al menos 1 iteración.')
      .max(100, 'El máximo permitido es 100 iteraciones.'),
  })
  .superRefine((v, ctx) => {
    refineOde(v, ctx);
    if (v.predictor === 'punto-medio' && v.start === 'exacta' && !v.exact) {
      ctx.addIssue({
        code: 'custom',
        path: ['exact'],
        message: 'Para tomar y₋₁ de la solución exacta, escríbela.',
      });
    }
  });

export type PredictorCorrectorInput = z.infer<typeof predictorCorrectorInputSchema>;

const n = toLatexNumber;
const op = toLatexOperand;

/** Con más iteraciones del corrector que esto, solo se detallan las primeras y la última. */
const DETAILED_ITERATIONS = 5;

interface Prediction {
  predictor: number;
  step: Step;
}

function midpointPredictor(i: number, yPrev: number, k1: number, h: number): Prediction {
  const predictor = yPrev + k1 * 2 * h;
  return {
    predictor,
    step: {
      title: 'Predictor del punto medio',
      formula: String.raw`y^0_{i+1} = y_{i-1} + y'_i\,2h`,
      substitution: String.raw`y^0_{${i + 1}} = ${n(yPrev)} + ${op(k1)}\,(2)(${n(h)})`,
      result: `y^0_{${i + 1}} = ${n(predictor)}`,
    },
  };
}

function eulerPredictor(i: number, y: number, k1: number, h: number): Prediction {
  const predictor = y + k1 * h;
  return {
    predictor,
    step: {
      title: 'Predictor de Euler',
      formula: String.raw`y^0_{i+1} = y_i + y'_i\,h`,
      substitution: String.raw`y^0_{${i + 1}} = ${n(y)} + ${op(k1)}\,(${n(h)})`,
      result: `y^0_{${i + 1}} = ${n(predictor)}`,
    },
  };
}

interface CorrectorStart {
  evaluate: (x: number, y: number) => number;
  i: number;
  x1: number;
  y: number;
  k1: number;
  h: number;
  predictor: number;
  maxIterations: number;
  tolerance: number;
}

interface CorrectorRun {
  value: number;
  ea: number | null;
  iterations: number;
  steps: Step[];
}

function correctorIterationStep(
  c: CorrectorStart,
  j: number,
  current: number,
  slope: number,
  next: number,
  ea: number | null,
): Step {
  const { i, y, k1, x1, h } = c;
  const error = ea === null ? '' : String.raw`, \quad \varepsilon_a = ${n(ea, 4)}\,\%`;
  return {
    title: `Corrector, iteración ${j}`,
    formula:
      j === 1
        ? String.raw`y^j_{i+1} = y_i + \frac{y'_i + f(x_{i+1},\ y^{j-1}_{i+1})}{2}\,h`
        : undefined,
    substitution: String.raw`y^{${j}}_{${i + 1}} = ${n(y)} + \frac{${n(k1)} + f(${n(x1)},\ ${n(current)})}{2}\,(${n(h)}) = ${n(y)} + \frac{${n(k1)} + ${op(slope)}}{2}\,(${n(h)})`,
    result: `y^{${j}}_{${i + 1}} = ${n(next)}${error}`,
  };
}

/** Corrector del trapecio iterado hasta |εa| < εs o el máximo de iteraciones. */
function runCorrector(c: CorrectorStart): CorrectorRun {
  let current = c.predictor;
  let ea: number | null = null;
  let iterations = 0;
  const steps: Step[] = [];
  for (let j = 1; j <= c.maxIterations; j++) {
    const slope = c.evaluate(c.x1, current);
    const next = c.y + ((c.k1 + slope) / 2) * c.h;
    ea = next === 0 ? null : Math.abs((next - current) / next) * 100;
    iterations = j;
    if (j <= DETAILED_ITERATIONS || j === c.maxIterations) {
      steps.push(correctorIterationStep(c, j, current, slope, next, ea));
    } else if (j === DETAILED_ITERATIONS + 1) {
      steps.push({
        title: 'Iteraciones siguientes',
        explanation: 'Se repite el corrector con el último valor obtenido.',
      });
    }
    current = next;
    if (!Number.isFinite(next) || (ea !== null && ea < c.tolerance)) break;
  }
  return { value: current, ea, iterations, steps };
}

function predictorCorrectorRule(input: PredictorCorrectorInput): OdeRuleFactory {
  return (f, exact): OdeRule | string => {
    const midpoint = input.predictor === 'punto-medio';
    const evaluate = (x: number, y: number) => f.evaluateAt({ x, y });
    const previous = new Map<number, number>();
    const introSteps: Step[] = [];
    const rkStart = midpoint && input.start === 'rk4';

    if (midpoint && input.start === 'exacta') {
      if (!exact) return 'Falta la solución exacta para obtener y₋₁.';
      const xm = input.x0 - input.h;
      const ym = exact.evaluate(xm);
      if (!Number.isFinite(ym)) {
        return `La solución exacta no tiene un valor real finito en x = ${formatNumber(xm)}.`;
      }
      previous.set(-1, ym);
      introSteps.push({
        title: 'Valor de arranque y₋₁',
        explanation:
          'El predictor del punto medio usa el punto anterior. Como en el libro, se toma de la solución exacta en x₀ − h.',
        result: `y_{-1} = y(${n(xm)}) = ${n(ym)}`,
      });
    } else if (rkStart) {
      introSteps.push({
        title: 'Valor de arranque',
        explanation:
          'El predictor del punto medio usa el punto anterior, que no existe en el primer paso: ese paso se da con Runge-Kutta de cuarto orden.',
      });
    }

    return {
      introSteps,
      slopeColumns: [
        { key: 'k1', header: "y'_i" },
        { key: 'predictor', header: 'y^0_{i+1}' },
        { key: 'iterations', header: String.raw`\text{Iteraciones}` },
        { key: 'ea', header: String.raw`\varepsilon_a\,(\%)` },
      ],
      stepTitle: (i) => (rkStart && i === 0 ? 'arranque con Runge-Kutta de 4.º orden' : undefined),
      advance(fn, i, x, y, h) {
        previous.set(i, y);
        const k1 = evaluate(x, y);
        if (rkStart && i === 0) {
          const rk = rk4Rule.advance(fn, i, x, y, h);
          return {
            ...rk,
            slopes: [
              { ...rk.slopes[0]!, key: 'k1' },
              ...rk.slopes.slice(1).map((s) => ({ ...s, key: `rk-${s.key}` })),
            ],
          };
        }
        const { predictor, step: predictorStep } = midpoint
          ? midpointPredictor(i, previous.get(i - 1)!, k1, h)
          : eulerPredictor(i, y, k1, h);
        const {
          value: current,
          ea,
          iterations,
          steps: iterationSteps,
        } = runCorrector({
          evaluate,
          i,
          x1: x + h,
          y,
          k1,
          h,
          predictor,
          maxIterations: input.maxIterations,
          tolerance: input.tolerance,
        });
        const converged = ea !== null && ea < input.tolerance;
        return {
          yNext: current,
          slopes: [
            { key: 'k1', value: k1, step: slopeStep('Pendiente al inicio', `y'_{${i}}`, x, y, k1) },
            { key: 'predictor', value: predictor, step: predictorStep },
            {
              key: 'iterations',
              value: iterations,
              step: {
                title: 'Corrector iterado (regla del trapecio)',
                explanation: converged
                  ? `Después de ${iterations} iteración(es), |εa| < εs = ${formatNumber(input.tolerance)} %.`
                  : `Se alcanzó el máximo de ${input.maxIterations} iteración(es) sin llegar a εs = ${formatNumber(input.tolerance)} %: se usa el último valor.`,
                children: iterationSteps,
              },
            },
            ...(ea === null
              ? []
              : [
                  {
                    key: 'ea',
                    value: ea,
                    step: {
                      title: 'Error aproximado final',
                      result: String.raw`\varepsilon_a = ${n(ea, 4)}\,\%`,
                    },
                  },
                ]),
          ],
          update: {
            title: 'Valor corregido',
            result: `y_{${i + 1}} = ${n(current)}`,
          },
        };
      },
    };
  };
}

export const predictorCorrector: Calculator<PredictorCorrectorInput, OdeValue, OdeErrorCode> = {
  meta: {
    id: 'predictor-corrector',
    title: 'Método predictor-corrector',
    summary:
      'Predice con Euler o con el punto medio y corrige con la regla del trapecio iterando hasta la tolerancia.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 25, sec. 25.2.1 (Heun con corrector iterado, ejemplo 25.5 y tabla 25.2) y cap. 26, sec. 26.2.1, ejemplo 26.2 (método de Heun sin autoinicio), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: predictorCorrectorInputSchema,
  example: {
    expression: '4 e^(0.8x) - 0.5y',
    x0: 0,
    y0: 2,
    h: 1,
    xf: 4,
    exact: '4/1.3 * (e^(0.8x) - e^(-0.5x)) + 2 e^(-0.5x)',
    predictor: 'punto-medio',
    start: 'exacta',
    tolerance: 0.00001,
    maxIterations: 100,
  },
  solve: (input) => solveOde(input, predictorCorrectorRule(input)),
};
