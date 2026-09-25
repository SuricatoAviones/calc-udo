/**
 * Núcleo común de los métodos de un paso para problemas de valor inicial
 * (Chapra & Canale, cap. 25):
 *
 *   dy/dx = f(x, y),   y(x₀) = y₀,   x_i = x₀ + i·h,   y_{i+1} = y_i + φ·h
 *
 * Cada método (Euler, Euler modificado, Runge-Kutta) aporta cómo estima la pendiente φ. Si el
 * estudiante da la solución exacta, se compara punto por punto con el error relativo porcentual
 * verdadero global ε_t = (verdadero − aproximado)/verdadero × 100 % (tablas 25.1 y 25.2).
 */
import { z } from 'zod';
import { parseFunction, type ParsedExpression } from '@/lib/math/expression';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type CalculatorResult,
  type Series,
  type Step,
  type SummaryItem,
  type TableColumn,
} from '../types';
import { finiteNumber } from './root-finding';

const MAX_STEPS = 1000;
/** Con más pasos que esto, solo se detallan los primeros y el último. */
const DETAILED_STEPS = 10;

export const odeInputSchema = z
  .object({
    expression: z
      .string()
      .trim()
      .min(1, 'Escribe f(x, y).')
      .max(200, 'La expresión es demasiado larga.'),
    x0: finiteNumber('x₀'),
    y0: finiteNumber('y₀'),
    h: finiteNumber('el tamaño de paso h').refine((v) => v > 0, 'h debe ser mayor que 0.'),
    xf: finiteNumber('el valor final de x'),
    exact: z.string().trim().max(200, 'La expresión es demasiado larga.').optional(),
  })
  .refine((v) => v.xf > v.x0, {
    message: 'El valor final de x debe ser mayor que x₀.',
    path: ['xf'],
  })
  .refine(
    (v) => {
      const steps = (v.xf - v.x0) / v.h;
      return Math.abs(steps - Math.round(steps)) < 1e-9 * Math.max(1, steps);
    },
    { message: 'h debe dividir el intervalo [x₀, x_f] en un número entero de pasos.', path: ['h'] },
  )
  .refine((v) => (v.xf - v.x0) / v.h <= MAX_STEPS + 1e-9, {
    message: `Son demasiados pasos (máximo ${MAX_STEPS}). Aumenta h.`,
    path: ['h'],
  });

export type OdeInput = z.infer<typeof odeInputSchema>;

export interface OdeValue {
  xs: number[];
  ys: number[];
  /** y aproximada en x_f. */
  yFinal: number;
  /** Solución exacta en cada nodo, si se dio. */
  trueValues: number[] | null;
  /** ε_t (%) global en cada nodo, si se dio la solución exacta. */
  trueRelativeErrors: (number | null)[] | null;
}

export type OdeErrorCode = 'invalid-expression' | 'non-finite';
export type OdeResult = CalculatorResult<OdeValue, OdeErrorCode>;

/** Una pendiente calculada dentro de un paso (k₁, k₂…). */
export interface Slope {
  key: string;
  value: number;
  step: Step;
}

export interface OdeRule {
  /** Columnas de pendientes en la tabla, en orden. */
  slopeColumns: TableColumn[];
  /** Calcula y_{i+1} a partir de (x_i, y_i) y explica el paso. */
  advance(
    f: ParsedExpression,
    i: number,
    x: number,
    y: number,
    h: number,
  ): { yNext: number; slopes: Slope[]; update: Step };
}

const n = toLatexNumber;

/** Paso que evalúa f(x, y) en un punto: `k_1 = f(0, 2) = 3`. */
export function slopeStep(
  title: string,
  name: string,
  x: number,
  y: number,
  value: number,
  formula?: string,
): Step {
  return {
    title,
    formula,
    result: `${name} = f(${n(x)},\\ ${n(y)}) = ${n(value)}`,
  };
}

export function solveOde(input: OdeInput, rule: OdeRule): OdeResult {
  const { x0, y0, h } = input;
  const parsed = parseFunction(input.expression, ['x', 'y']);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: parsed.message },
      ...emptyTrace(),
    };
  }
  const f = parsed.expr;

  let exact: ParsedExpression | null = null;
  if (input.exact) {
    const parsedExact = parseFunction(input.exact, 'x');
    if (!parsedExact.ok) {
      return {
        ok: false,
        error: { code: 'invalid-expression', message: `Solución exacta: ${parsedExact.message}` },
        ...emptyTrace(),
      };
    }
    exact = parsedExact.expr;
  }

  const count = Math.round((input.xf - x0) / h);
  const xs = Array.from({ length: count + 1 }, (_, i) => x0 + i * h);
  const ys: number[] = [y0];
  const slopeRows: Record<string, number>[] = [];

  const steps: Step[] = [
    {
      title: 'Problema de valor inicial',
      explanation: `Se avanza desde x₀ = ${formatNumber(x0)} hasta x = ${formatNumber(input.xf)} en ${count} pasos de tamaño h = ${formatNumber(h)}.`,
      formula: `\\frac{dy}{dx} = ${f.tex}, \\qquad y(${n(x0)}) = ${n(y0)}`,
      result: exact ? `y_{\\text{exacta}}(x) = ${exact.tex}` : undefined,
    },
  ];

  const trueValues = exact ? xs.map((x) => exact.evaluate(x)) : null;
  const trueErrors = trueValues
    ? (index: number, y: number) => {
        const t = trueValues[index]!;
        return t === 0 ? null : ((t - y) / t) * 100;
      }
    : null;

  const buildTrace = () => {
    const rows = ys.map((y, i) => ({
      i,
      x: xs[i]!,
      y,
      ...(trueValues ? { yTrue: trueValues[i]!, et: trueErrors!(i, y) } : {}),
      ...(slopeRows[i] ?? {}),
    }));
    const columns: TableColumn[] = [
      { key: 'i', header: 'i' },
      { key: 'x', header: 'x_i' },
      { key: 'y', header: 'y_i' },
      ...(trueValues
        ? [
            { key: 'yTrue', header: 'y_{\\text{verdadero}}' },
            { key: 'et', header: '\\varepsilon_t\\,(\\%)' },
          ]
        : []),
      ...rule.slopeColumns,
    ];
    const series: Series[] = [
      {
        id: 'solucion',
        title: 'Solución aproximada',
        xLabel: 'x',
        yLabel: 'y',
        label: 'Aproximación',
        points: ys.map((y, i) => ({ x: xs[i]!, y })),
        reference: exact
          ? {
              label: 'Solución exacta',
              points: Array.from({ length: 121 }, (_, k) => {
                const x = x0 + ((input.xf - x0) * k) / 120;
                return { x, y: exact.evaluate(x) };
              }),
            }
          : undefined,
      },
    ];
    return {
      ...emptyTrace(),
      steps,
      tables: [{ id: 'solucion', title: 'Solución paso a paso', columns, rows }],
      series,
    };
  };

  for (let i = 0; i < count; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    const { yNext, slopes, update } = rule.advance(f, i, x, y, h);
    slopeRows[i] = Object.fromEntries(slopes.map((s) => [s.key, s.value]));

    const detailed = count <= 2 * DETAILED_STEPS || i < DETAILED_STEPS || i === count - 1;
    if (detailed) {
      steps.push({
        title: `Paso ${i + 1}: de x = ${formatNumber(x)} a x = ${formatNumber(xs[i + 1]!)}`,
        children: [...slopes.map((s) => s.step), update],
      });
    } else if (i === DETAILED_STEPS) {
      steps.push({
        title: `Pasos ${DETAILED_STEPS + 1} a ${count - 1}`,
        explanation:
          'Se repite el mismo procedimiento en cada paso. Los valores de cada uno están en la tabla de resultados.',
      });
    }

    const bad = slopes.find((s) => !Number.isFinite(s.value));
    if (bad || !Number.isFinite(yNext)) {
      return {
        ok: false,
        error: {
          code: 'non-finite',
          message: `f(x, y) no tiene un valor real finito en el paso ${i + 1} (x = ${formatNumber(x)}). La solución puede haber divergido o f no está definida ahí.`,
        },
        ...buildTrace(),
      };
    }
    ys.push(yNext);
  }

  const yFinal = ys.at(-1)!;
  const xf = xs.at(-1)!;
  const summary: SummaryItem[] = [
    {
      label: `Solución aproximada en x = ${formatNumber(xf)}`,
      value: `y(${n(xf)}) \\approx ${n(yFinal)}`,
      emphasis: true,
    },
    { label: 'Pasos', value: `${count} \\text{ pasos de } h = ${n(h)}` },
  ];
  const trueRelativeErrors = trueValues ? ys.map((y, i) => trueErrors!(i, y)) : null;
  if (trueValues) {
    const et = trueRelativeErrors!.at(-1);
    summary.push({ label: 'Valor verdadero', value: `y(${n(xf)}) = ${n(trueValues.at(-1)!)}` });
    if (et !== null && et !== undefined) {
      summary.push({
        label: 'Error relativo verdadero',
        value: `\\varepsilon_t = ${n(et, 4)}\\,\\%`,
      });
    }
  }
  steps.push({
    title: 'Resultado',
    explanation: `Después de ${count} pasos se llega a x = ${formatNumber(xf)}.`,
    result: `y(${n(xf)}) \\approx ${n(yFinal)}`,
  });

  return {
    ok: true,
    value: { xs, ys, yFinal, trueValues, trueRelativeErrors },
    summary,
    ...buildTrace(),
  };
}
