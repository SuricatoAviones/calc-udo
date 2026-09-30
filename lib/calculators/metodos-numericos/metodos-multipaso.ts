/**
 * Métodos multipaso para dy/dx = f(x, y) (Chapra & Canale, sec. 26.2): usan los valores de
 * varios puntos anteriores, así que necesitan valores de arranque.
 *
 *   Adams-Bashforth de 2 pasos:  y_{i+1} = y_i + h (3f_i − f_{i−1}) / 2
 *   Adams-Bashforth de 3 pasos:  y_{i+1} = y_i + h (23f_i − 16f_{i−1} + 5f_{i−2}) / 12
 *   Adams-Bashforth de 4 pasos:  y_{i+1} = y_i + h (55f_i − 59f_{i−1} + 37f_{i−2} − 9f_{i−3}) / 24
 *   Adams de 4.º orden (tabla 26.2 y 26.3): predictor Adams-Bashforth de 4 pasos y corrector
 *     Adams-Moulton  y_{i+1} = y_i + h (9f⁰_{i+1} + 19f_i − 5f_{i−1} + f_{i−2}) / 24
 *   Milne (ec. 26.21 y 26.22): predictor y⁰_{i+1} = y_{i−3} + 4h (2f_i − f_{i−1} + 2f_{i−2}) / 3
 *     y corrector (Simpson 1/3)  y_{i+1} = y_{i−1} + h (f_{i−1} + 4f_i + f⁰_{i+1}) / 3
 *
 * con f_k = f(x_k, y_k). El corrector se aplica una vez por paso. Los valores de arranque se
 * calculan con Runge-Kutta de 4.º orden o, como en los ejemplos del libro, con la solución exacta
 * en x₀ − h, x₀ − 2h, … (antes del punto inicial).
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

export const multistepMethods = ['ab2', 'ab3', 'ab4', 'adams4', 'milne'] as const;
export type MultistepMethod = (typeof multistepMethods)[number];
export const startOptions = ['rk4', 'exacta'] as const;

export const multistepInputSchema = z
  .object({
    ...odeShape,
    method: z.enum(multistepMethods, { error: 'Elige un método.' }),
    start: z.enum(startOptions, { error: 'Elige cómo obtener los valores de arranque.' }),
  })
  .superRefine((v, ctx) => {
    refineOde(v, ctx);
    if (v.start === 'exacta' && !v.exact) {
      ctx.addIssue({
        code: 'custom',
        path: ['exact'],
        message: 'Para arrancar con la solución exacta, escríbela.',
      });
    }
  });

export type MultistepInput = z.infer<typeof multistepInputSchema>;

const n = toLatexNumber;
const op = toLatexOperand;

interface Point {
  x: number;
  y: number;
  f: number;
}

/** Puntos anteriores necesarios (incluido el actual). */
const STEPS: Record<MultistepMethod, number> = { ab2: 2, ab3: 3, ab4: 4, adams4: 4, milne: 4 };

const AB: Record<number, { weights: number[]; divisor: number }> = {
  2: { weights: [3, -1], divisor: 2 },
  3: { weights: [23, -16, 5], divisor: 12 },
  4: { weights: [55, -59, 37, -9], divisor: 24 },
};

const NAMES: Record<MultistepMethod, string> = {
  ab2: 'Adams-Bashforth de 2 pasos',
  ab3: 'Adams-Bashforth de 3 pasos',
  ab4: 'Adams-Bashforth de 4 pasos',
  adams4: 'Adams de cuarto orden (predictor-corrector)',
  milne: 'Milne (predictor-corrector)',
};

function fName(offset: number, predicted = false): string {
  const index = offset === 0 ? 'i' : `i${offset > 0 ? '+' : '-'}${Math.abs(offset)}`;
  return `f${predicted ? '^0' : ''}_{${index}}`;
}

/** Σ wₖ f_{i−k} en LaTeX, general y con números. */
function weighted(weights: number[], names: string[], values?: number[]): string {
  return weights
    .map((w, k) => {
      const abs = Math.abs(w);
      const body = values
        ? `${abs === 1 ? '' : abs}${op(values[k]!)}`
        : `${abs === 1 ? '' : abs}${names[k]}`;
      if (k === 0) return w < 0 ? `-${body}` : body;
      return w < 0 ? `- ${body}` : `+ ${body}`;
    })
    .join(' ');
}

function multistepRule(
  method: MultistepMethod,
  start: 'rk4' | 'exacta',
  x0: number,
  h: number,
): OdeRuleFactory {
  return (f, exact): OdeRule | string => {
    const needed = STEPS[method];
    const history = new Map<number, Point>();
    const evaluate = (x: number, y: number) => f.evaluateAt({ x, y });
    const introSteps: Step[] = [];

    if (start === 'exacta') {
      if (!exact) return 'Falta la solución exacta para los valores de arranque.';
      const earlier: Step[] = [];
      for (let k = 1; k < needed; k++) {
        const xk = x0 - k * h;
        const yk = exact.evaluate(xk);
        const fk = evaluate(xk, yk);
        if (!Number.isFinite(yk) || !Number.isFinite(fk)) {
          return `La solución exacta o f no tienen un valor real finito en x = ${formatNumber(xk)}, antes de x₀.`;
        }
        history.set(-k, { x: xk, y: yk, f: fk });
        earlier.push({
          title: `Punto x${subscriptIndex(-k)} = ${formatNumber(xk)}`,
          result: `y_{-${k}} = y(${n(xk)}) = ${n(yk)}, \\quad f_{-${k}} = ${n(fk)}`,
        });
      }
      if (earlier.length > 0) {
        introSteps.push({
          title: 'Valores de arranque con la solución exacta',
          explanation: `${NAMES[method]} necesita ${needed - 1} punto(s) anterior(es) a x₀. Como en los ejemplos del libro, se toman de la solución exacta.`,
          children: earlier,
        });
      }
    } else if (needed > 1) {
      introSteps.push({
        title: 'Valores de arranque con Runge-Kutta',
        explanation: `${NAMES[method]} necesita ${needed - 1} punto(s) anterior(es). Los primeros ${needed - 1} paso(s) se dan con Runge-Kutta de cuarto orden, que tiene un error del mismo orden que el método.`,
      });
    }

    const predictorCorrector = method === 'adams4' || method === 'milne';
    return {
      introSteps,
      slopeColumns: [
        { key: 'f', header: 'f_i' },
        ...(predictorCorrector
          ? [
              { key: 'predictor', header: 'y^0_{i+1}' },
              { key: 'fp', header: 'f^0_{i+1}' },
            ]
          : []),
      ],
      stepTitle: (i) =>
        start === 'rk4' && i < needed - 1 ? 'arranque con Runge-Kutta de 4.º orden' : undefined,
      advance(fn, i, x, y, h) {
        const fi = evaluate(x, y);
        history.set(i, { x, y, f: fi });
        if (start === 'rk4' && i < needed - 1) {
          const rk = rk4Rule.advance(fn, i, x, y, h);
          return {
            ...rk,
            slopes: [
              { key: 'f', value: fi, step: rk.slopes[0]!.step },
              ...rk.slopes.slice(1).map((s) => ({ ...s, key: `rk-${s.key}` })),
            ],
          };
        }
        const past = (k: number) => history.get(i - k)!;
        const fs = Array.from({ length: needed }, (_, k) => past(k).f);
        const slopeF = {
          key: 'f',
          value: fi,
          step: {
            ...slopeStep('Pendiente en el punto actual', `f_{${i}}`, x, y, fi),
            explanation:
              needed > 1
                ? `Valores anteriores: ${fs
                    .slice(1)
                    .map((v, k) => `f${subscriptIndex(i - k - 1)} = ${formatNumber(v)}`)
                    .join(', ')}.`
                : undefined,
          },
        };

        if (method === 'ab2' || method === 'ab3' || method === 'ab4') {
          const { weights, divisor } = AB[needed]!;
          const sum = weights.reduce((s, w, k) => s + w * fs[k]!, 0);
          const yNext = y + (h * sum) / divisor;
          const names = weights.map((_, k) => fName(-k));
          return {
            yNext,
            slopes: [slopeF],
            update: {
              title: NAMES[method],
              formula: `y_{i+1} = y_i + \\frac{h}{${divisor}}\\left(${weighted(weights, names)}\\right)`,
              substitution: `y_{${i + 1}} = ${n(y)} + \\frac{${n(h)}}{${divisor}}\\left(${weighted(weights, names, fs)}\\right)`,
              result: `y_{${i + 1}} = ${n(yNext)}`,
            },
          };
        }

        // Predictor-corrector.
        let predictor: number;
        let predictorStep: Step;
        if (method === 'adams4') {
          const { weights, divisor } = AB[4]!;
          predictor = y + (h * weights.reduce((s, w, k) => s + w * fs[k]!, 0)) / divisor;
          const names = weights.map((_, k) => fName(-k));
          predictorStep = {
            title: 'Predictor (Adams-Bashforth de 4 pasos)',
            formula: `y^0_{i+1} = y_i + \\frac{h}{24}\\left(${weighted(weights, names)}\\right)`,
            substitution: `y^0_{${i + 1}} = ${n(y)} + \\frac{${n(h)}}{24}\\left(${weighted(weights, names, fs)}\\right)`,
            result: `y^0_{${i + 1}} = ${n(predictor)}`,
          };
        } else {
          const weights = [2, -1, 2];
          const y3 = past(3).y;
          predictor = y3 + ((4 * h) / 3) * (2 * fs[0]! - fs[1]! + 2 * fs[2]!);
          const names = [fName(0), fName(-1), fName(-2)];
          predictorStep = {
            title: 'Predictor de Milne',
            formula: `y^0_{i+1} = y_{i-3} + \\frac{4h}{3}\\left(${weighted(weights, names)}\\right)`,
            substitution: `y^0_{${i + 1}} = ${n(y3)} + \\frac{4(${n(h)})}{3}\\left(${weighted(weights, names, fs.slice(0, 3))}\\right)`,
            result: `y^0_{${i + 1}} = ${n(predictor)}`,
          };
        }
        const fp = evaluate(x + h, predictor);
        let yNext: number;
        let update: Step;
        if (method === 'adams4') {
          const weights = [9, 19, -5, 1];
          const values = [fp, fs[0]!, fs[1]!, fs[2]!];
          const names = [fName(1, true), fName(0), fName(-1), fName(-2)];
          yNext = y + (h * weights.reduce((s, w, k) => s + w * values[k]!, 0)) / 24;
          update = {
            title: 'Corrector (Adams-Moulton)',
            formula: `y_{i+1} = y_i + \\frac{h}{24}\\left(${weighted(weights, names)}\\right)`,
            substitution: `y_{${i + 1}} = ${n(y)} + \\frac{${n(h)}}{24}\\left(${weighted(weights, names, values)}\\right)`,
            result: `y_{${i + 1}} = ${n(yNext)}`,
          };
        } else {
          const y1 = past(1).y;
          const weights = [1, 4, 1];
          const values = [fs[1]!, fs[0]!, fp];
          const names = [fName(-1), fName(0), fName(1, true)];
          yNext = y1 + (h / 3) * (fs[1]! + 4 * fs[0]! + fp);
          update = {
            title: 'Corrector de Milne (Simpson 1/3)',
            formula: `y_{i+1} = y_{i-1} + \\frac{h}{3}\\left(${weighted(weights, names)}\\right)`,
            substitution: `y_{${i + 1}} = ${n(y1)} + \\frac{${n(h)}}{3}\\left(${weighted(weights, names, values)}\\right)`,
            result: `y_{${i + 1}} = ${n(yNext)}`,
          };
        }
        return {
          yNext,
          slopes: [
            slopeF,
            { key: 'predictor', value: predictor, step: predictorStep },
            {
              key: 'fp',
              value: fp,
              step: slopeStep(
                'Pendiente con el valor predicho',
                `f^0_{${i + 1}}`,
                x + h,
                predictor,
                fp,
              ),
            },
          ],
          update,
        };
      },
    };
  };
}

function subscriptIndex(k: number): string {
  const digits = '₀₁₂₃₄₅₆₇₈₉';
  return `${k < 0 ? '₋' : ''}${String(Math.abs(k)).replace(/\d/g, (d) => digits[Number(d)]!)}`;
}

export const multistep: Calculator<MultistepInput, OdeValue, OdeErrorCode> = {
  meta: {
    id: 'metodos-multipaso',
    title: 'Métodos multipaso',
    summary:
      'Adams-Bashforth de 2, 3 y 4 pasos, Adams de cuarto orden y Milne, con arranque por Runge-Kutta o la solución exacta.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 26, sec. 26.2.3 (fórmulas de integración: Adams-Bashforth, Adams-Moulton y Milne; tablas 26.2 y 26.3), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: multistepInputSchema,
  example: {
    expression: '4 e^(0.8x) - 0.5y',
    x0: 0,
    y0: 2,
    h: 1,
    xf: 4,
    exact: '4/1.3 * (e^(0.8x) - e^(-0.5x)) + 2 e^(-0.5x)',
    method: 'adams4',
    start: 'exacta',
  },
  solve: (input) => solveOde(input, multistepRule(input.method, input.start, input.x0, input.h)),
};
