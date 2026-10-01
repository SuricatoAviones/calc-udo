/**
 * Optimización no restringida de una variable (Taha, sec. 20.1.1; Hillier & Lieberman, sec. 13.4
 * y apéndice 3):
 *
 * - Condición necesaria: en un extremo interior f′(x₀) = 0 (punto estacionario).
 * - Condición suficiente (Taha, teorema 20.1-3): si f′(x₀) = … = f^{(n−1)}(x₀) = 0 y
 *   f^{(n)}(x₀) ≠ 0, entonces con n par x₀ es un mínimo si f^{(n)}(x₀) > 0 y un máximo si
 *   f^{(n)}(x₀) < 0; con n impar es un punto de inflexión.
 *
 * Los puntos estacionarios se buscan en el intervalo [a, b] dado: se evalúa f′ en una malla, se
 * refinan los cambios de signo por bisección y los mínimos de |f′| cercanos a cero (raíces dobles,
 * como la de x³ en 0). Al final se comparan con los extremos del intervalo para el máximo y el
 * mínimo absolutos en [a, b].
 */
import { z } from 'zod';
import { differentiate, parseFunction, type ParsedExpression } from '@/lib/math/expression';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Series,
  type Step,
} from '../types';

const GRID = 4000;
const MAX_ORDER = 8;

export const oneVariableInputSchema = z
  .object({
    expression: z
      .string()
      .trim()
      .min(1, 'Escribe la función f(x).')
      .max(200, 'La expresión es demasiado larga.')
      .superRefine((text, ctx) => {
        const parsed = parseFunction(text, 'x');
        if (!parsed.ok) ctx.addIssue({ code: 'custom', message: parsed.message });
      }),
    a: z
      .number({ error: 'Ingresa el extremo a.' })
      .refine(Number.isFinite, 'a debe ser un número finito.'),
    b: z
      .number({ error: 'Ingresa el extremo b.' })
      .refine(Number.isFinite, 'b debe ser un número finito.'),
  })
  .refine((v) => v.b > v.a, { message: 'Debe cumplirse a < b.', path: ['b'] });

export type OneVariableInput = z.infer<typeof oneVariableInputSchema>;

export type StationaryKind =
  'mínimo local' | 'máximo local' | 'punto de inflexión' | 'no concluyente';

export interface StationaryPoint {
  x: number;
  f: number;
  /** Orden de la primera derivada no nula (≥ 2), o `null` si no se encontró hasta el orden 8. */
  order: number | null;
  derivative: number | null;
  kind: StationaryKind;
}

export interface OneVariableValue {
  stationary: StationaryPoint[];
  globalMax: { x: number; f: number };
  globalMin: { x: number; f: number };
}

export type OneVariableErrorCode = 'invalid-expression' | 'non-finite';

type Result = CalculatorResult<OneVariableValue, OneVariableErrorCode>;

const n = toLatexNumber;

/** Raíz de g en [lo, hi] con g(lo)·g(hi) < 0, por bisección hasta la precisión de la máquina. */
function bisect(g: (x: number) => number, lo: number, hi: number): number {
  let glo = g(lo);
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const gm = g(mid);
    if (gm === 0 || hi - lo < 1e-15 * Math.max(1, Math.abs(mid))) return mid;
    if (Math.sign(gm) === Math.sign(glo)) {
      lo = mid;
      glo = gm;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Mínimo de h en [lo, hi] por la sección dorada. */
function goldenMin(h: (x: number) => number, lo: number, hi: number): number {
  const r = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - r * (hi - lo);
  let x2 = lo + r * (hi - lo);
  let h1 = h(x1);
  let h2 = h(x2);
  for (let k = 0; k < 200 && hi - lo > 1e-14 * Math.max(1, Math.abs(lo)); k++) {
    if (h1 < h2) {
      hi = x2;
      x2 = x1;
      h2 = h1;
      x1 = hi - r * (hi - lo);
      h1 = h(x1);
    } else {
      lo = x1;
      x1 = x2;
      h1 = h2;
      x2 = lo + r * (hi - lo);
      h2 = h(x2);
    }
  }
  return (lo + hi) / 2;
}

/** Redondea para mostrar y comparar: 0.4999999999 → 0.5, 1e−16 → 0. */
function tidy(x: number): number {
  if (Math.abs(x) < 1e-10) return 0;
  return Number(x.toPrecision(11));
}

export function solveOneVariable({ expression, a, b }: OneVariableInput): Result {
  const parsed = parseFunction(expression, 'x');
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: parsed.message },
      ...emptyTrace(),
    };
  }
  const f = parsed.expr;
  const derivatives: ParsedExpression[] = [f];
  for (let k = 1; k <= MAX_ORDER; k++) {
    const d = differentiate(derivatives[k - 1]!, 'x');
    if (!d.ok) {
      return {
        ok: false,
        error: { code: 'invalid-expression', message: d.message },
        ...emptyTrace(),
      };
    }
    derivatives.push(d.expr);
  }
  const d1 = derivatives[1]!;
  const steps: Step[] = [
    {
      title: 'Primera y segunda derivada',
      formula: "f'(x), \\qquad f''(x)",
      result: `f'(x) = ${d1.tex}, \\qquad f''(x) = ${derivatives[2]!.tex}`,
    },
  ];

  // Malla de f′.
  const h = (b - a) / GRID;
  const xs = Array.from({ length: GRID + 1 }, (_, i) => a + i * h);
  const g = xs.map((x) => d1.evaluate(x));
  if (g.every((v) => !Number.isFinite(v))) {
    return {
      ok: false,
      error: {
        code: 'non-finite',
        message: `f′(x) no es un número real en [${formatNumber(a)}, ${formatNumber(b)}].`,
      },
      ...emptyTrace(),
      steps,
    };
  }
  const scale = Math.max(1, ...g.filter(Number.isFinite).map(Math.abs));
  const candidates: number[] = [];
  for (let i = 0; i <= GRID; i++) {
    const gi = g[i]!;
    if (!Number.isFinite(gi)) continue;
    if (gi === 0) {
      candidates.push(xs[i]!);
      continue;
    }
    const next = g[i + 1];
    if (next !== undefined && Number.isFinite(next) && Math.sign(gi) * Math.sign(next) < 0) {
      candidates.push(bisect((x) => d1.evaluate(x), xs[i]!, xs[i + 1]!));
    }
    const prev = g[i - 1];
    if (
      prev !== undefined &&
      next !== undefined &&
      Number.isFinite(prev) &&
      Number.isFinite(next) &&
      Math.abs(gi) <= Math.abs(prev) &&
      Math.abs(gi) <= Math.abs(next) &&
      Math.sign(prev) === Math.sign(gi) &&
      Math.sign(next) === Math.sign(gi)
    ) {
      const x = goldenMin((t) => Math.abs(d1.evaluate(t)), xs[i - 1]!, xs[i + 1]!);
      if (Math.abs(d1.evaluate(x)) < 1e-7 * scale) candidates.push(x);
    }
  }
  const unique: number[] = [];
  for (const x of candidates.sort((p, q) => p - q)) {
    if (x <= a || x >= b) continue;
    if (unique.every((u) => Math.abs(u - x) > 10 * h)) unique.push(x);
  }

  const stationary: StationaryPoint[] = unique.map((raw) => {
    const x = tidy(raw);
    const fx = f.evaluate(x);
    for (let k = 2; k <= MAX_ORDER; k++) {
      const value = derivatives[k]!.evaluate(x);
      const size = Math.max(
        1,
        Math.abs(fx),
        ...derivatives.slice(1, k).map((d) => Math.abs(d.evaluate(x))),
      );
      if (Number.isFinite(value) && Math.abs(value) > 1e-6 * size) {
        const kind: StationaryKind =
          k % 2 === 1 ? 'punto de inflexión' : value > 0 ? 'mínimo local' : 'máximo local';
        return { x, f: fx, order: k, derivative: value, kind };
      }
    }
    return { x, f: fx, order: null, derivative: null, kind: 'no concluyente' as const };
  });

  steps.push({
    title: 'Puntos estacionarios (condición necesaria)',
    explanation: `Se resuelve f′(x) = 0 en [${formatNumber(a)}, ${formatNumber(b)}] numéricamente: se buscan cambios de signo de f′ y los puntos donde |f′| toca cero.`,
    formula: "f'(x_0) = 0",
    result:
      stationary.length === 0
        ? '\\text{No hay puntos estacionarios en el intervalo}'
        : stationary.map((p, i) => `x_{${i + 1}} = ${n(p.x)}`).join(',\\ '),
  });

  stationary.forEach((p, i) => {
    const children: Step[] = [];
    for (let k = 2; k <= (p.order ?? MAX_ORDER); k++) {
      const value = derivatives[k]!.evaluate(p.x);
      children.push({
        title: `Derivada de orden ${k}`,
        formula: `f^{(${k})}(x_0)`,
        substitution: `f^{(${k})}(${n(p.x)})`,
        result: `f^{(${k})}(${n(p.x, 6)}) = ${n(tidy(value))}`,
      });
    }
    steps.push({
      title: `Clasificar x = ${formatNumber(p.x, 8)}`,
      explanation:
        p.order === null
          ? `Las derivadas hasta el orden ${MAX_ORDER} se anulan: el criterio no concluye.`
          : p.order === 2
            ? `f″ ${p.derivative! > 0 ? '> 0' : '< 0'}: ${p.kind}.`
            : `La primera derivada no nula es la de orden ${p.order} (${p.order % 2 === 0 ? 'par' : 'impar'}): ${p.kind}.`,
      children,
      result: `x_{${i + 1}} = ${n(p.x)}: \\ \\text{${p.kind}}, \\quad f(x_{${i + 1}}) = ${n(p.f)}`,
    });
  });

  // Extremos absolutos en [a, b].
  const points = [
    { x: a, f: f.evaluate(a) },
    ...stationary.map((p) => ({ x: p.x, f: p.f })),
    { x: b, f: f.evaluate(b) },
  ].filter((p) => Number.isFinite(p.f));
  const globalMax = points.reduce((p, q) => (q.f > p.f ? q : p));
  const globalMin = points.reduce((p, q) => (q.f < p.f ? q : p));
  steps.push({
    title: 'Extremos absolutos en el intervalo',
    explanation:
      'Se compara f en los puntos estacionarios y en los extremos a y b: el mayor valor es el máximo absoluto en [a, b] y el menor, el mínimo absoluto.',
    substitution: points.map((p) => `f(${n(p.x, 6)}) = ${n(p.f, 6)}`).join(',\\ '),
    result: `\\max = f(${n(globalMax.x, 6)}) = ${n(globalMax.f, 6)}, \\qquad \\min = f(${n(globalMin.x, 6)}) = ${n(globalMin.f, 6)}`,
  });

  const plot = Array.from({ length: 201 }, (_, i) => {
    const x = a + ((b - a) * i) / 200;
    return { x, y: f.evaluate(x) };
  }).filter((p) => Number.isFinite(p.y));
  const series: Series[] = [
    {
      id: 'funcion',
      title: 'Gráfica de f(x) y puntos estacionarios',
      xLabel: 'x',
      yLabel: 'f(x)',
      label: 'f(x)',
      points: plot,
      scatter:
        stationary.length > 0
          ? { label: 'Puntos estacionarios', points: stationary.map((p) => ({ x: p.x, y: p.f })) }
          : undefined,
    },
  ];

  const rows = stationary.map((p): Record<string, CellValue> => ({
    x: p.x,
    f: p.f,
    order: p.order,
    derivative: p.derivative,
    kind: p.kind,
  }));

  return {
    ok: true,
    value: { stationary, globalMax, globalMin },
    summary: [
      ...stationary.slice(0, 4).map((p, i) => ({
        label: p.kind[0]!.toUpperCase() + p.kind.slice(1),
        value: `x = ${n(p.x, 8)}, \\ f = ${n(p.f, 8)}`,
        emphasis: i === 0,
      })),
      {
        label: `Máximo absoluto en [a, b]`,
        value: `f(${n(globalMax.x, 6)}) = ${n(globalMax.f, 6)}`,
      },
      {
        label: `Mínimo absoluto en [a, b]`,
        value: `f(${n(globalMin.x, 6)}) = ${n(globalMin.f, 6)}`,
      },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'estacionarios',
        title: 'Puntos estacionarios',
        columns: [
          { key: 'x', header: 'x_0' },
          { key: 'f', header: 'f(x_0)' },
          { key: 'order', header: 'n' },
          { key: 'derivative', header: 'f^{(n)}(x_0)' },
          { key: 'kind', header: '\\text{Tipo}', format: 'text' },
        ],
        rows,
      },
    ],
    series,
    notices: [
      {
        level: 'info',
        message:
          'Los puntos estacionarios se buscan solo dentro del intervalo [a, b]: amplíalo si esperas otros.',
      },
    ],
  };
}

export const oneVariable: Calculator<OneVariableInput, OneVariableValue, OneVariableErrorCode> = {
  meta: {
    id: 'optimizacion-una-variable',
    title: 'Optimización no restringida de una variable',
    summary: 'Puntos estacionarios y criterio de las derivadas de orden superior.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 20.1.1, teorema 20.1-3 y Ejemplo 20.1-2 (10.ª ed.)',
      },
      { sourceId: 'hillier-lieberman-2002', locator: 'Sec. 13.4 y apéndice 3 (7.ª ed.)' },
      { sourceId: 'rao-1999' },
    ],
  },
  inputSchema: oneVariableInputSchema,
  // Hillier, sec. 13.4: f(x) = 12x − 3x⁴ − 2x⁶, con máximo cerca de 0.836.
  example: { expression: '12x - 3x^4 - 2x^6', a: 0, b: 2 },
  solve: solveOneVariable,
};
