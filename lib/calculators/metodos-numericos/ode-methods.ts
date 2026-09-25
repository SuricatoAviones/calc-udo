/**
 * Métodos de un paso para EDO (Chapra & Canale, cap. 25). Cada uno define cómo estima la
 * pendiente; el resto del procedimiento está en ode.ts.
 *
 *   Euler (sec. 25.1):              y_{i+1} = y_i + f(x_i, y_i)·h                        (ec. 25.2)
 *   Euler modificado / Heun (25.2.1): y⁰_{i+1} = y_i + f(x_i, y_i)·h                     (ec. 25.15)
 *                                   y_{i+1} = y_i + [f(x_i, y_i) + f(x_{i+1}, y⁰_{i+1})]/2·h   (ec. 25.16)
 *   Runge-Kutta clásico de 4.º orden (sec. 25.3.3):
 *                                   y_{i+1} = y_i + (k₁ + 2k₂ + 2k₃ + k₄)·h/6         (ec. 25.40)
 */
import { toLatexNumber, toLatexOperand } from '@/lib/math/format';
import type { Calculator } from '../types';
import {
  odeInputSchema,
  slopeStep,
  solveOde,
  type OdeErrorCode,
  type OdeInput,
  type OdeRule,
  type OdeValue,
} from './ode';

const n = toLatexNumber;
const op = toLatexOperand;

// ─── Euler ──────────────────────────────────────────────────────────────────

const eulerRule: OdeRule = {
  slopeColumns: [{ key: 'k', header: 'f(x_i, y_i)' }],
  advance(f, i, x, y, h) {
    const k = f.evaluateAt({ x, y });
    const yNext = y + k * h;
    return {
      yNext,
      slopes: [
        {
          key: 'k',
          value: k,
          step: slopeStep('Pendiente al inicio del paso', `f(x_{${i}}, y_{${i}})`, x, y, k),
        },
      ],
      update: {
        title: 'Avanzar con la pendiente',
        formula: 'y_{i+1} = y_i + f(x_i, y_i)\\,h',
        substitution: `y_{${i + 1}} = ${n(y)} + ${op(k)}\\,(${n(h)})`,
        result: `y_{${i + 1}} = ${n(yNext)}`,
      },
    };
  },
};

// ─── Euler modificado (Heun sin iterar el corrector) ────────────────────────

const heunRule: OdeRule = {
  slopeColumns: [
    { key: 'k1', header: "y'_i" },
    { key: 'predictor', header: 'y^0_{i+1}' },
    { key: 'k2', header: "y'_{i+1}" },
  ],
  advance(f, i, x, y, h) {
    const k1 = f.evaluateAt({ x, y });
    const predictor = y + k1 * h;
    const x1 = x + h;
    const k2 = f.evaluateAt({ x: x1, y: predictor });
    const yNext = y + ((k1 + k2) / 2) * h;
    return {
      yNext,
      slopes: [
        { key: 'k1', value: k1, step: slopeStep('Pendiente al inicio', `y'_{${i}}`, x, y, k1) },
        {
          key: 'predictor',
          value: predictor,
          step: {
            title: 'Predictor (un paso de Euler)',
            formula: "y^0_{i+1} = y_i + y'_i\\,h",
            substitution: `y^0_{${i + 1}} = ${n(y)} + ${op(k1)}\\,(${n(h)})`,
            result: `y^0_{${i + 1}} = ${n(predictor)}`,
          },
        },
        {
          key: 'k2',
          value: k2,
          step: slopeStep(
            'Pendiente al final, con el valor predicho',
            `y'_{${i + 1}}`,
            x1,
            predictor,
            k2,
          ),
        },
      ],
      update: {
        title: 'Corrector: avanzar con la pendiente promedio',
        formula: "y_{i+1} = y_i + \\frac{y'_i + y'_{i+1}}{2}\\,h",
        substitution: `y_{${i + 1}} = ${n(y)} + \\frac{${n(k1)} + ${op(k2)}}{2}\\,(${n(h)})`,
        result: `y_{${i + 1}} = ${n(yNext)}`,
      },
    };
  },
};

// ─── Runge-Kutta clásico de cuarto orden ───────────────────────────────────

const rk4Rule: OdeRule = {
  slopeColumns: [
    { key: 'k1', header: 'k_1' },
    { key: 'k2', header: 'k_2' },
    { key: 'k3', header: 'k_3' },
    { key: 'k4', header: 'k_4' },
  ],
  advance(f, i, x, y, h) {
    const half = h / 2;
    const k1 = f.evaluateAt({ x, y });
    const y2 = y + k1 * half;
    const k2 = f.evaluateAt({ x: x + half, y: y2 });
    const y3 = y + k2 * half;
    const k3 = f.evaluateAt({ x: x + half, y: y3 });
    const y4 = y + k3 * h;
    const k4 = f.evaluateAt({ x: x + h, y: y4 });
    const phi = (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    const yNext = y + phi * h;
    return {
      yNext,
      slopes: [
        {
          key: 'k1',
          value: k1,
          step: slopeStep('k₁: pendiente al inicio', 'k_1', x, y, k1, 'k_1 = f(x_i,\\ y_i)'),
        },
        {
          key: 'k2',
          value: k2,
          step: {
            ...slopeStep('k₂: pendiente en el punto medio, usando k₁', 'k_2', x + half, y2, k2),
            formula: 'k_2 = f\\left(x_i + \\tfrac{h}{2},\\ y_i + \\tfrac{h}{2}k_1\\right)',
            substitution: `y_i + \\tfrac{h}{2}k_1 = ${n(y)} + ${n(half)}\\,(${n(k1)}) = ${n(y2)}`,
          },
        },
        {
          key: 'k3',
          value: k3,
          step: {
            ...slopeStep('k₃: pendiente en el punto medio, usando k₂', 'k_3', x + half, y3, k3),
            formula: 'k_3 = f\\left(x_i + \\tfrac{h}{2},\\ y_i + \\tfrac{h}{2}k_2\\right)',
            substitution: `y_i + \\tfrac{h}{2}k_2 = ${n(y)} + ${n(half)}\\,(${n(k2)}) = ${n(y3)}`,
          },
        },
        {
          key: 'k4',
          value: k4,
          step: {
            ...slopeStep('k₄: pendiente al final, usando k₃', 'k_4', x + h, y4, k4),
            formula: 'k_4 = f(x_i + h,\\ y_i + h\\,k_3)',
            substitution: `y_i + h\\,k_3 = ${n(y)} + ${n(h)}\\,(${n(k3)}) = ${n(y4)}`,
          },
        },
      ],
      update: {
        title: 'Avanzar con el promedio ponderado de las pendientes',
        formula: 'y_{i+1} = y_i + \\frac{1}{6}\\,(k_1 + 2k_2 + 2k_3 + k_4)\\,h',
        substitution: `y_{${i + 1}} = ${n(y)} + \\frac{1}{6}\\,(${n(k1)} + 2(${n(k2)}) + 2(${n(k3)}) + ${n(k4)})\\,(${n(h)})`,
        result: `y_{${i + 1}} = ${n(yNext)}`,
      },
    };
  },
};

// ─── Calculadoras ───────────────────────────────────────────────────────────

type OdeCalculator = Calculator<OdeInput, OdeValue, OdeErrorCode>;

/** Chapra & Canale, ec. PT7.13 con solución exacta PT7.16 (ejemplos 25.1 y 25.7a). */
const POLYNOMIAL_EXAMPLE = {
  expression: '-2x^3 + 12x^2 - 20x + 8.5',
  x0: 0,
  y0: 1,
  h: 0.5,
  xf: 4,
  exact: '-0.5x^4 + 4x^3 - 10x^2 + 8.5x + 1',
};

/** Chapra & Canale, ejemplos 25.5 y 25.7b, con solución exacta E25.5.1. */
const EXPONENTIAL_EXAMPLE = {
  expression: '4 e^(0.8x) - 0.5y',
  x0: 0,
  y0: 2,
  h: 1,
  xf: 4,
  exact: '4/1.3 * (e^(0.8x) - e^(-0.5x)) + 2 e^(-0.5x)',
};

export const euler: OdeCalculator = {
  meta: {
    id: 'euler',
    title: 'Método de Euler',
    summary:
      'Resuelve un problema de valor inicial avanzando con la pendiente del inicio de cada paso.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 25, sección 25.1, Ejemplo 25.1 y tabla 25.1 (pp. 720–721 de la 5.ª ed. en español)',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: odeInputSchema,
  example: POLYNOMIAL_EXAMPLE,
  solve: (input) => solveOde(input, eulerRule),
};

export const modifiedEuler: OdeCalculator = {
  meta: {
    id: 'euler-modificado',
    title: 'Método de Euler modificado (Heun)',
    summary: 'Predice con Euler y corrige con el promedio de las pendientes al inicio y al final.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 25, sección 25.2.1 (método de Heun), Ejemplo 25.5 y tabla 25.2 (pp. 734–735 de la 5.ª ed. en español)',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: odeInputSchema,
  example: EXPONENTIAL_EXAMPLE,
  solve: (input) => solveOde(input, heunRule),
};

export const rungeKutta: OdeCalculator = {
  meta: {
    id: 'runge-kutta',
    title: 'Método de Runge-Kutta de cuarto orden',
    summary: 'Resuelve un problema de valor inicial con cuatro pendientes ponderadas por paso.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator: 'Cap. 25, sección 25.3.3, Ejemplo 25.7 (pp. 747–748 de la 5.ª ed. en español)',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: odeInputSchema,
  example: { ...EXPONENTIAL_EXAMPLE, h: 0.5 },
  solve: (input) => solveOde(input, rk4Rule),
};
