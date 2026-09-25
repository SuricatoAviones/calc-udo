/**
 * Piezas comunes a los métodos de raíces (bisección, falsa posición, secante, Newton-Raphson):
 * campos de entrada, el paso del error aproximado, gráficas y resumen. Cada método conserva su
 * propio algoritmo y su propia traza; esto solo evita repetir lo que es idéntico en todos.
 *
 * Criterio de parada común (Chapra & Canale, sec. 3.3, ec. 3.5):
 *   ε_a = |(x_nuevo − x_anterior) / x_nuevo| × 100 % < ε_s
 */
import { z } from 'zod';
import { relativeErrorPercent } from '@/lib/math/error-metrics';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import type { Series, Step, SummaryItem } from '../types';

// ─── Campos de entrada ──────────────────────────────────────────────────────

export const finiteNumber = (label: string) =>
  z
    .number({ error: `Ingresa un número para ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`);

export const expressionField = z
  .string()
  .trim()
  .min(1, 'Escribe la función f(x).')
  .max(200, 'La expresión es demasiado larga.');

export const toleranceField = finiteNumber('la tolerancia')
  .refine((v) => v > 0, 'La tolerancia debe ser mayor que 0.')
  .refine((v) => v <= 100, 'La tolerancia es un porcentaje: no puede superar 100 %.');

export const maxIterationsField = z
  .number({ error: 'Ingresa el número máximo de iteraciones.' })
  .int('El máximo de iteraciones debe ser un número entero.')
  .min(1, 'Debe haber al menos 1 iteración.')
  .max(100, 'El máximo permitido es 100 iteraciones.');

// ─── Error aproximado ───────────────────────────────────────────────────────

export interface ApproximateError {
  /** ε_a en %, o `null` si no está definido (el valor nuevo es 0). */
  ea: number | null;
  converged: boolean;
  step: Step;
}

/**
 * Calcula ε_a entre dos aproximaciones sucesivas y arma el paso que lo explica.
 * `newLabel`/`oldLabel` son los nombres LaTeX de las aproximaciones, p. ej. `x_{3}` y `x_{2}`.
 */
export function approximateError(
  xNew: number,
  xOld: number,
  tolerance: number,
  newLabel: string,
  oldLabel: string,
): ApproximateError {
  const ea = relativeErrorPercent(xNew, xOld);
  if (ea === null) {
    return {
      ea,
      converged: false,
      step: {
        title: 'Error relativo aproximado',
        explanation: `No está definido porque ${formatNumber(xNew)} = 0. Se continúa iterando.`,
      },
    };
  }
  const converged = ea < tolerance;
  const n = toLatexNumber;
  return {
    ea,
    converged,
    step: {
      title: 'Error relativo aproximado',
      explanation: converged
        ? `εₐ = ${formatNumber(ea, 4)} % es menor que la tolerancia εₛ = ${String(tolerance)} %: el método convergió.`
        : `εₐ = ${formatNumber(ea, 4)} % no es menor que la tolerancia εₛ = ${String(tolerance)} %: se sigue iterando.`,
      formula: `\\varepsilon_a = \\left| \\frac{${newLabel} - ${oldLabel}}{${newLabel}} \\right| \\times 100\\%`,
      substitution: `\\varepsilon_a = \\left| \\frac{${n(xNew)} - ${toLatexOperand(xOld)}}{${n(xNew)}} \\right| \\times 100\\%`,
      result: `\\varepsilon_a = ${n(ea, 6)}\\,\\%`,
    },
  };
}

// ─── Gráficas y resumen ─────────────────────────────────────────────────────

export interface ConvergencePoint {
  /** Número de iteración (1, 2, …). */
  iteration: number;
  /** Aproximación obtenida en esa iteración. */
  approximation: number;
  /** ε_a (%) en esa iteración, si está definido. */
  ea: number | null;
}

/** Aproximación vs. iteración y error vs. iteración (escala log), comunes a todos los métodos. */
export function convergenceSeries(
  points: ConvergencePoint[],
  approximationLabel: string,
): Series[] {
  if (points.length === 0) return [];
  return [
    {
      id: 'aproximacion',
      title: 'Aproximación a la raíz por iteración',
      xLabel: 'Iteración',
      yLabel: approximationLabel,
      points: points.map((p) => ({ x: p.iteration, y: p.approximation })),
    },
    {
      id: 'error',
      title: 'Error relativo aproximado por iteración',
      xLabel: 'Iteración',
      yLabel: 'εa (%)',
      yScale: 'log',
      points: points.flatMap((p) => (p.ea === null ? [] : [{ x: p.iteration, y: p.ea }])),
    },
  ];
}

export function rootSummary(
  root: number,
  iterations: number,
  ea: number | null,
  residual: number,
): SummaryItem[] {
  const n = toLatexNumber;
  return [
    { label: 'Raíz aproximada', value: `x_r \\approx ${n(root)}`, emphasis: true },
    { label: 'Iteraciones', value: String(iterations) },
    {
      label: 'Error relativo aproximado',
      value: ea === null ? '\\text{—}' : `\\varepsilon_a = ${n(ea, 4)}\\,\\%`,
    },
    { label: 'Comprobación', value: `f(x_r) = ${n(residual, 4)}` },
  ];
}

/** Paso de evaluación de f en un punto: `f(x_l) = f(12) = 6.0666`. */
export function evaluationStep(label: string, x: number, fx: number): Step {
  return {
    title: `Evaluar f en ${formatNumber(x)}`,
    result: `f(${label}) = f(${toLatexNumber(x)}) = ${toLatexNumber(fx)}`,
  };
}

/** Mensaje para cuando f no tiene un valor real finito en un punto. */
export function nonFiniteMessage(x: number): string {
  return `f(x) no tiene un valor real finito en x = ${formatNumber(x)} (por ejemplo, una división entre cero o la raíz de un negativo).`;
}
