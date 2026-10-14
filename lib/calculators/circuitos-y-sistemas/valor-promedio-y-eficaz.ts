/**
 * Valor promedio y valor eficaz (rms) de una señal periódica definida por tramos en un periodo.
 *
 *   F_prom = (1/T) ∫₀ᵀ f(t) dt          F_ef = √[(1/T) ∫₀ᵀ f²(t) dt]
 *
 * El valor eficaz es el valor de cd que entregaría la misma potencia promedio a una resistencia:
 * P = I_ef²·R o P = V_ef²/R. Las integrales se evalúan con cuadratura adaptativa de
 * Gauss-Kronrod en cada tramo (lib/math/quadrature.ts).
 *
 * Fuentes: Hayt, Kemmerly y Durbin, 8.ª ed., sec. 11.2 y 11.3 (problema de práctica 11.7);
 * Dorf y Svoboda, 9.ª ed., sec. 11.4 (ejemplo 11.4-1, onda diente de sierra).
 */
import { z } from 'zod';
import { parseFunction, type ParsedExpression } from '@/lib/math/expression';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { integrate } from '@/lib/math/quadrature';
import type { Calculator, CalculatorResult, ResultTable, Series, Step } from '../types';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);
const MAX_SEGMENTS = 8;

/** Constante escrita como expresión (`2*pi/25`). */
function parseConstant(text: string): number | string {
  const parsed = parseFunction(text, []);
  if (!parsed.ok) return 'Escribe un número o una expresión con pi (p. ej. 2*pi/25).';
  const value = parsed.expr.evaluateAt({});
  return Number.isFinite(value) ? value : 'No es un número real.';
}

const segmentSchema = z.object({
  end: z.string().trim().min(1, 'Escribe el final del tramo.'),
  expression: z.string().trim().min(1, 'Escribe f(t).').max(200, 'Máximo 200 caracteres.'),
});

const inputSchema = z
  .object({
    quantity: z.enum(['voltaje', 'corriente']),
    segments: z
      .array(segmentSchema)
      .min(1, 'Agrega al menos un tramo.')
      .max(MAX_SEGMENTS, `Como máximo ${MAX_SEGMENTS} tramos.`),
    resistance: z.number().positive('R debe ser mayor que 0.').optional(),
  })
  .superRefine((input, ctx) => {
    let previous = 0;
    input.segments.forEach((segment, i) => {
      const end = parseConstant(segment.end);
      if (typeof end === 'string') {
        ctx.addIssue({ code: 'custom', path: ['segments', i, 'end'], message: end });
        return;
      }
      if (end <= previous) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments', i, 'end'],
          message:
            i === 0
              ? 'El primer tramo debe terminar después de t = 0.'
              : 'Los finales deben ir en aumento.',
        });
      }
      previous = end;
      const parsed = parseFunction(segment.expression, ['t']);
      if (!parsed.ok) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments', i, 'expression'],
          message: parsed.message,
        });
      }
    });
  });

export type AverageRmsInput = z.infer<typeof inputSchema>;

export interface AverageRmsValue {
  period: number;
  average: number;
  rms: number;
  power?: number;
}

export type AverageRmsErrorCode = 'expresion-invalida' | 'integral-no-converge';

interface Segment {
  from: number;
  to: number;
  expr: ParsedExpression;
}

export function solveAverageRms(
  input: AverageRmsInput,
): CalculatorResult<AverageRmsValue, AverageRmsErrorCode> {
  const fail = (code: AverageRmsErrorCode, message: string, steps: Step[] = []) => ({
    ok: false as const,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error' as const, message }],
  });

  const segments: Segment[] = [];
  let from = 0;
  for (const segment of input.segments) {
    const end = parseConstant(segment.end);
    const parsed = parseFunction(segment.expression, ['t']);
    if (typeof end === 'string' || end <= from)
      return fail('expresion-invalida', 'Revisa los finales de los tramos.');
    if (!parsed.ok) return fail('expresion-invalida', parsed.message);
    segments.push({ from, to: end, expr: parsed.expr });
    from = end;
  }
  const period = from;
  const symbol = input.quantity === 'voltaje' ? 'v' : 'i';
  const upper = input.quantity === 'voltaje' ? 'V' : 'I';
  const unit = input.quantity === 'voltaje' ? 'V' : 'A';

  const steps: Step[] = [
    {
      title: 'Forma de onda en un periodo',
      explanation:
        segments.length > 1
          ? 'La señal se repite cada T segundos; en un periodo se define por tramos.'
          : 'La señal se repite cada T segundos.',
      formula: `${symbol}(t) = ${
        segments.length === 1
          ? segments[0]!.expr.tex
          : `\\begin{cases} ${segments.map((s) => `${s.expr.tex} & ${n(s.from)} \\le t < ${n(s.to)}`).join(' \\\\ ')} \\end{cases}`
      }`,
      result: `T = ${n(period)}\\ \\text{s}`,
    },
  ];

  const integralOf = (f: (t: number) => number, s: Segment) => integrate(f, s.from, s.to);
  const first = segments.map((s) => integralOf((t) => s.expr.evaluateAt({ t }), s));
  const second = segments.map((s) => integralOf((t) => s.expr.evaluateAt({ t }) ** 2, s));
  if ([...first, ...second].some((r) => !r.converged || !Number.isFinite(r.value))) {
    return fail(
      'integral-no-converge',
      'Una integral no converge en el periodo: revisa que la función esté definida y sea finita en todo el tramo.',
      steps,
    );
  }

  const sum1 = first.reduce((s, r) => s + r.value, 0);
  const sum2 = second.reduce((s, r) => s + r.value, 0);
  const average = sum1 / period;
  const rms = Math.sqrt(sum2 / period);

  steps.push({
    title: 'Valor promedio',
    explanation: 'Es el área bajo la curva en un periodo, dividida entre T (la componente de cd).',
    formula: `${upper}_{prom} = \\frac{1}{T}\\int_{0}^{T} ${symbol}(t)\\,dt`,
    children: segments.map((s, k) => ({
      title: `Tramo ${k + 1}`,
      formula: `\\int_{${n(s.from)}}^{${n(s.to)}} ${s.expr.tex}\\,dt`,
      result: `= ${n(first[k]!.value)}`,
    })),
    substitution: `${upper}_{prom} = \\frac{${n(sum1)}}{${n(period)}}`,
    result: `${upper}_{prom} = ${n(average)}\\ \\text{${unit}}`,
  });
  steps.push({
    title: 'Valor eficaz (rms)',
    explanation:
      'Se eleva la señal al cuadrado, se promedia en un periodo y se saca la raíz: raíz de la media de los cuadrados.',
    formula: `${upper}_{ef} = \\sqrt{\\frac{1}{T}\\int_{0}^{T} ${symbol}^{2}(t)\\,dt}`,
    children: segments.map((s, k) => ({
      title: `Tramo ${k + 1}`,
      formula: `\\int_{${n(s.from)}}^{${n(s.to)}} \\left(${s.expr.tex}\\right)^{2}dt`,
      result: `= ${n(second[k]!.value)}`,
    })),
    substitution: `${upper}_{ef} = \\sqrt{\\frac{${n(sum2)}}{${n(period)}}}`,
    result: `${upper}_{ef} = ${n(rms)}\\ \\text{${unit}}`,
  });

  let power: number | undefined;
  if (input.resistance !== undefined) {
    const r = input.resistance;
    power = input.quantity === 'corriente' ? rms ** 2 * r : rms ** 2 / r;
    steps.push({
      title: 'Potencia promedio en la resistencia',
      explanation:
        'El valor eficaz entrega a una resistencia la misma potencia promedio que un valor de cd igual.',
      formula: input.quantity === 'corriente' ? 'P = I_{ef}^{2}R' : 'P = \\frac{V_{ef}^{2}}{R}',
      substitution:
        input.quantity === 'corriente'
          ? `P = (${n(rms)})^{2}(${n(r)})`
          : `P = \\frac{(${n(rms)})^{2}}{${n(r)}}`,
      result: `P = ${n(power)}\\ \\text{W}`,
    });
  }

  // Muestras para la gráfica: dos periodos.
  const valueAt = (t: number) => {
    const tau = ((t % period) + period) % period;
    const s = segments.find((x) => tau >= x.from && tau < x.to) ?? segments.at(-1)!;
    const y = s.expr.evaluateAt({ t: tau });
    return Number.isFinite(y) ? y : 0;
  };
  const samples = 600;
  const points = Array.from({ length: samples + 1 }, (_, k) => {
    const t = (2 * period * k) / samples;
    return { x: t, y: valueAt(Math.min(t, 2 * period - 1e-12)) };
  });
  const line = (y: number) => [
    { x: 0, y },
    { x: 2 * period, y },
  ];
  const series: Series = {
    id: 'onda',
    title: 'Forma de onda (dos periodos), valor promedio y valor eficaz',
    xLabel: 't (s)',
    yLabel: `${symbol}(t) (${unit})`,
    label: `${symbol}(t)`,
    points,
    others: [
      { label: `${upper} prom`, points: line(average) },
      { label: `${upper} ef`, points: line(rms) },
    ],
  };

  const table: ResultTable = {
    id: 'tramos',
    title: 'Integrales por tramo',
    columns: [
      { key: 'tramo', header: '\\text{Tramo}' },
      { key: 'desde', header: 't_0' },
      { key: 'hasta', header: 't_1' },
      { key: 'i1', header: `\\int ${symbol}\\,dt` },
      { key: 'i2', header: `\\int ${symbol}^{2}\\,dt` },
    ],
    rows: segments.map((s, k) => ({
      tramo: k + 1,
      desde: s.from,
      hasta: s.to,
      i1: first[k]!.value,
      i2: second[k]!.value,
    })),
  };

  return {
    ok: true,
    value: { period, average, rms, power },
    summary: [
      { label: 'T', value: `${n(period)}\\ \\text{s}` },
      { label: `${upper} prom`, value: `${n(average)}\\ \\text{${unit}}` },
      { label: `${upper} ef`, value: `${n(rms)}\\ \\text{${unit}}`, emphasis: true },
      ...(power !== undefined ? [{ label: 'P', value: `${n(power)}\\ \\text{W}` }] : []),
    ],
    steps,
    tables: [table],
    series: [series],
    notices: [
      {
        level: 'info',
        message: `Las integrales se calcularon numéricamente (Gauss-Kronrod adaptativa); el error estimado es menor que ${formatNumber(
          Math.max(...[...first, ...second].map((r) => r.error), 1e-14),
          2,
        )}.`,
      },
    ],
  };
}

export const valorPromedioYEficaz: Calculator<
  AverageRmsInput,
  AverageRmsValue,
  AverageRmsErrorCode
> = {
  meta: {
    id: 'valor-promedio-y-eficaz',
    title: 'Valor promedio y valor eficaz',
    summary:
      'Promedio y valor eficaz (rms) de señales periódicas definidas por tramos, y la potencia en R.',
    citations: [
      {
        sourceId: 'hayt-kemmerly-1993',
        locator: '8.ª ed. en inglés, sec. 11.2 y 11.3, problema 11.7',
      },
      { sourceId: 'dorf-svoboda-2000', locator: '9.ª ed. en inglés, sec. 11.4, ejemplo 11.4-1' },
    ],
  },
  inputSchema,
  // Dorf y Svoboda, ejemplo 11.4-1: diente de sierra i = I_m t/T con I_m = 6 A y T = 2 s.
  example: {
    quantity: 'corriente',
    segments: [{ end: '2', expression: '3t' }],
    resistance: 10,
  },
  solve: solveAverageRms,
};
