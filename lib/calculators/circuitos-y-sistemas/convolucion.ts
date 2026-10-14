/**
 * Integral de convolución: respuesta y(t) de un sistema lineal e invariante a una entrada x(t) a
 * partir de su respuesta al impulso h(t).
 *
 *   y(t) = x(t) * h(t) = ∫₀ᵗ x(z) h(t − z) dz          (sistemas causales, Hayt ec. 15.5 [11])
 *
 * El resultado cerrado sale del teorema de convolución, Y(s) = X(s)·H(s), con la inversa por
 * fracciones parciales; los retardos e^{−as} se traducen en tramos de tiempo (la respuesta se
 * escribe también por intervalos, como en el método gráfico). La integral se evalúa además
 * numéricamente en varios instantes para contrastar.
 *
 * Fuentes: Hayt, Kemmerly y Durbin, 8.ª ed., sec. 15.5 (ejemplos 15.8 y 15.9 y el pulso de la
 * fig. 15.21); Dorf y Svoboda, 9.ª ed., sec. 14.9.
 */
import { z } from 'zod';
import * as C from '@/lib/math/complex';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { integrate } from '@/lib/math/quadrature';
import type { Calculator, CalculatorResult, ResultTable, Series, Step } from '../types';
import {
  DIGITS,
  binomial,
  groupToRational,
  laplaceOfSignal,
  multiplyTransforms,
  piecesLatexTerms,
  joinTerms,
  transformTex,
  type DelayedRational,
  type TimePiece,
} from './laplace';
import { inverseLaplace, type InverseGroup } from './laplace-inverse';
import {
  evaluateSignal,
  hasImpulses,
  parseSignal,
  plotHorizon,
  signalTex,
  type Signal,
} from './signal';
import { sampleSeries } from './transformada-inversa-de-laplace';

const n = (v: number) => toLatexNumber(v, DIGITS);
const CONTINUOUS = { variable: 't', discrete: false };

const signalField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Escribe ${label}.`)
    .max(200, 'La expresión es demasiado larga (máximo 200).');

const inputSchema = z.object({
  input: signalField('la entrada x(t)'),
  impulse: signalField('la respuesta al impulso h(t)'),
});

export type ConvolutionInput = z.infer<typeof inputSchema>;

export interface ConvolutionValue {
  /** y(t) cerrada (con escalones) en LaTeX. */
  tex: string;
  groups: InverseGroup[];
  /** y(t) por intervalos: [desde, hasta) y su expresión. */
  intervals: { from: number; to: number; tex: string; pieces: TimePiece[] }[];
}

export type ConvolutionErrorCode = 'expresion-invalida';

type Result = CalculatorResult<ConvolutionValue, ConvolutionErrorCode>;

function fail(message: string, steps: Step[] = []): Result {
  return {
    ok: false,
    error: { code: 'expresion-invalida', message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

function rationals(signal: Signal): DelayedRational[] {
  return laplaceOfSignal(signal).map((g) => ({ delay: g.delay, ...groupToRational(g) }));
}

/** Pasa una pieza en τ = t − a a tiempo absoluto: suma de piezas tʲ e^{σt}(A cos ωt + B sen ωt). */
function toAbsolute(piece: TimePiece, delay: number): TimePiece[] {
  if (delay === 0) return [piece];
  const p = C.complex(piece.sigma, piece.omega);
  // τⁿe^{pτ}(A − jB) con τ = t − a.
  const base = C.mul(C.complex(piece.a, -piece.b), C.exp(C.scale(p, -delay)));
  const out: TimePiece[] = [];
  for (let j = 0; j <= piece.power; j++) {
    const c = C.scale(base, binomial(piece.power, j) * (-delay) ** (piece.power - j));
    out.push({
      power: j,
      sigma: piece.sigma,
      omega: piece.omega,
      a: c.re,
      b: piece.omega === 0 ? 0 : -c.im,
    });
  }
  return out;
}

function combine(pieces: TimePiece[]): TimePiece[] {
  const out: TimePiece[] = [];
  for (const p of pieces) {
    const twin = out.find((x) => x.power === p.power && x.sigma === p.sigma && x.omega === p.omega);
    if (twin) {
      twin.a += p.a;
      twin.b += p.b;
    } else out.push({ ...p });
  }
  const size = Math.max(1e-300, ...out.map((x) => Math.hypot(x.a, x.b)));
  return out
    .map((x) => ({
      ...x,
      a: Math.abs(x.a) <= 1e-9 * size ? 0 : x.a,
      b: Math.abs(x.b) <= 1e-9 * size ? 0 : x.b,
    }))
    .filter((x) => x.a !== 0 || x.b !== 0)
    .sort((x, y) => y.sigma - x.sigma || x.omega - y.omega || x.power - y.power);
}

/** ∫₀ᵗ x(z) h(t − z) dz numérica, partida en los saltos de los escalones. */
function numericConvolution(x: Signal, h: Signal, t: number): number {
  if (t <= 0) return 0;
  const cuts = new Set<number>([0, t]);
  for (const term of x) if (term.shift > 0 && term.shift < t) cuts.add(term.shift);
  for (const term of h) if (term.shift > 0 && t - term.shift > 0) cuts.add(t - term.shift);
  const points = [...cuts].sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (b - a < 1e-12) continue;
    sum += integrate((z) => evaluateSignal(x, z) * evaluateSignal(h, t - z), a, b).value;
  }
  return sum;
}

function intervalLabel(from: number, to: number): string {
  if (!Number.isFinite(to)) return `t \\ge ${n(from)}`;
  return `${n(from)} \\le t < ${n(to)}`;
}

export function solveConvolution(input: ConvolutionInput): Result {
  const x = parseSignal(input.input, CONTINUOUS);
  if (!x.ok) return fail(`x(t): ${x.message}`);
  const h = parseSignal(input.impulse, CONTINUOUS);
  if (!h.ok) return fail(`h(t): ${h.message}`);
  const xTex = signalTex(input.input) ?? input.input;
  const hTex = signalTex(input.impulse) ?? input.impulse;

  const X = rationals(x.signal);
  const H = rationals(h.signal);
  const steps: Step[] = [
    {
      title: 'Integral de convolución',
      explanation:
        'Para un sistema causal con entrada que empieza en t = 0, la convolución solo acumula el intervalo 0 ≤ z ≤ t: se refleja h, se desplaza t unidades y se integra el producto con x.',
      formula: 'y(t) = x(t) * h(t) = \\int_{0}^{t} x(z)\\,h(t - z)\\,dz',
      substitution: `y(t) = \\int_{0}^{t} \\left[${xTex.replace(/\bt\b/g, 'z')}\\right]\\left[${hTex.replace(/\bt\b/g, '(t - z)')}\\right] dz`,
    },
    {
      title: 'Transformadas de la entrada y de la respuesta al impulso',
      children: [
        { title: 'Entrada', formula: `x(t) = ${xTex}`, result: `X(s) = ${transformTex(X)}` },
        {
          title: 'Respuesta al impulso',
          explanation:
            'La transformada de la respuesta al impulso es la función de transferencia H(s).',
          formula: `h(t) = ${hTex}`,
          result: `H(s) = ${transformTex(H)}`,
        },
      ],
    },
  ];

  if (X.length === 0 || H.length === 0) {
    steps.push({
      title: 'Resultado',
      explanation: 'Una de las dos funciones es 0.',
      result: 'y(t) = 0',
    });
    return {
      ok: true,
      value: { tex: '0', groups: [], intervals: [{ from: 0, to: Infinity, tex: '0', pieces: [] }] },
      summary: [{ label: 'y(t)', value: 'y(t) = 0', emphasis: true }],
      steps,
      tables: [],
      series: [],
      notices: [],
    };
  }

  const Y = multiplyTransforms(X, H).sort((a, b) => a.delay - b.delay);
  steps.push({
    title: 'Teorema de convolución',
    explanation:
      'La convolución en el tiempo es un producto en el dominio de s; los retardos e^(−as) se suman al multiplicar.',
    formula: '\\mathcal{L}\\{x(t) * h(t)\\} = X(s)\\,H(s)',
    result: `Y(s) = ${transformTex(Y)}`,
  });

  const inverse = inverseLaplace(Y, 'Y', 'y');
  if (!inverse.ok) return fail(inverse.message, steps);
  const { result } = inverse;
  steps.push({ title: 'Transformada inversa de Y(s)', children: result.steps });
  steps.push({ title: 'Respuesta cerrada', result: `y(t) = ${result.tex}` });

  // Por intervalos entre retardos consecutivos.
  const delays = [...new Set(result.groups.map((g) => g.delay))].sort((a, b) => a - b);
  if (delays[0] !== 0) delays.unshift(0);
  const intervals = delays.map((from, i) => {
    const to = delays[i + 1] ?? Infinity;
    const active = result.groups.filter((g) => g.delay <= from + 1e-12);
    const pieces = combine(active.flatMap((g) => g.pieces.flatMap((p) => toAbsolute(p, g.delay))));
    return { from, to, tex: joinTerms(piecesLatexTerms(pieces, 't')), pieces };
  });
  if (intervals.length > 1) {
    steps.push({
      title: 'Respuesta por intervalos',
      explanation:
        'En cada intervalo entre retardos consecutivos están activos los escalones que ya arrancaron; se suman y se simplifican, como en el método gráfico.',
      result: `y(t) = \\begin{cases} ${intervals
        .map((r) => `${r.tex} & ${intervalLabel(r.from, r.to)}`)
        .join(' \\\\ ')} \\end{cases}`,
    });
  }

  // Contraste numérico de la integral.
  const impulses = hasImpulses(x.signal) || hasImpulses(h.signal) || result.hasImpulses;
  const horizon = Math.max(
    plotHorizon([x.signal, h.signal]),
    ...result.groups.map((g) => g.delay * 1.5),
    1,
  );
  const tables: ResultTable[] = [result.table];
  if (!impulses) {
    const instants = [
      ...new Set([
        ...[0.25, 0.5, 0.75, 1].map((f) => f * horizon),
        // Un instante dentro de cada tramo (el punto medio de los finitos).
        ...intervals.map((r) => (Number.isFinite(r.to) ? (r.from + r.to) / 2 : r.from + 0.5)),
      ]),
    ]
      .sort((a, b) => a - b)
      .slice(0, 8);
    tables.push({
      id: 'verificacion',
      title: 'Verificación numérica de la integral',
      columns: [
        { key: 't', header: 't' },
        { key: 'cerrada', header: 'y(t)\\ \\text{cerrada}' },
        { key: 'numerica', header: '\\int_0^t x(z)h(t-z)\\,dz' },
      ],
      rows: instants.map((t) => ({
        t: Number(formatNumber(t, 4)),
        cerrada: result.evaluate(t),
        numerica: numericConvolution(x.signal, h.signal, t),
      })),
    });
  }

  const series: Series = {
    id: 'convolucion',
    title: 'Entrada, respuesta al impulso y salida',
    xLabel: 't (s)',
    yLabel: 'amplitud',
    label: 'y(t)',
    points: sampleSeries(result.evaluate, horizon),
    others: [
      { label: 'x(t)', points: sampleSeries((t) => evaluateSignal(x.signal, t), horizon) },
      { label: 'h(t)', points: sampleSeries((t) => evaluateSignal(h.signal, t), horizon) },
    ],
  };

  return {
    ok: true,
    value: { tex: result.tex, groups: result.groups, intervals },
    summary: [
      { label: 'Y(s)', value: `Y(s) = ${transformTex(Y)}` },
      { label: 'y(t)', value: `y(t) = ${result.tex}`, emphasis: true },
    ],
    steps,
    tables,
    series: [series],
    notices: impulses
      ? [
          {
            level: 'info',
            message:
              'Hay impulsos en x(t), h(t) o y(t): no se muestran en la gráfica ni se contrasta la integral numéricamente.',
          },
        ]
      : [],
  };
}

export const convolucion: Calculator<ConvolutionInput, ConvolutionValue, ConvolutionErrorCode> = {
  meta: {
    id: 'convolucion',
    title: 'Integral de convolución',
    summary:
      'Respuesta de un sistema a partir de su respuesta al impulso, con el teorema de convolución y por intervalos.',
    citations: [
      {
        sourceId: 'hayt-kemmerly-1993',
        locator: '8.ª ed. en inglés, sec. 15.5, fig. 15.21 y ejemplos 15.8 y 15.9',
      },
      { sourceId: 'dorf-svoboda-2000', locator: '9.ª ed. en inglés, sec. 14.9' },
    ],
  },
  inputSchema,
  // Hayt, sec. 15.5: pulso de 1 V y 1 s aplicado a h(t) = 2e^{−t}u(t) (fig. 15.21 y 15.22).
  example: { input: 'u(t) - u(t - 1)', impulse: '2e^(-t)' },
  solve: solveConvolution,
};
