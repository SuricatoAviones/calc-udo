/**
 * Transformada de Laplace de funciones del tiempo y solución de ecuaciones diferenciales lineales
 * con coeficientes constantes.
 *
 * Función: se separa f(t) en sumandos (linealidad) y cada uno se transforma con la tabla de pares
 * y propiedades (desplazamiento en frecuencia, multiplicación por tⁿ, desplazamiento en el tiempo).
 *
 * Ecuación: aₙy⁽ⁿ⁾ + … + a₁y′ + a₀y = f(t) con y(0), y′(0), …. Cada derivada se transforma con
 * ℒ{y⁽ᵏ⁾} = sᵏY(s) − sᵏ⁻¹y(0) − … − y⁽ᵏ⁻¹⁾(0), se despeja Y(s) y se invierte por fracciones
 * parciales.
 *
 * Fuentes: Hayt, Kemmerly y Durbin, 8.ª ed., sec. 14.4 a 14.6 (ejemplos 14.7 y 14.10); Dorf y
 * Svoboda, 9.ª ed., sec. 14.2, 14.3 y 14.6 (ejemplos 14.2-4, 14.2-5, 14.3-1 y 14.6-1).
 */
import { z } from 'zod';
import * as C from '@/lib/math/complex';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { addPoly, mulPoly, trimPoly, type Poly } from '@/lib/math/polynomials';
import type { Calculator, CalculatorResult, Notice, Series, Step } from '../types';
import {
  DIGITS,
  groupToRational,
  laplaceOfSignal,
  polyTex,
  transformTex,
  type DelayedRational,
  type LaplaceGroup,
} from './laplace';
import { inverseLaplace, type InverseGroup } from './laplace-inverse';
import {
  evaluateSignal,
  hasImpulses,
  parseSignal,
  plotHorizon,
  signalNodeTex,
  signalOfNode,
  signalTex,
  splitTerms,
} from './signal';
import { sampleSeries } from './transformada-inversa-de-laplace';

const n = (v: number) => toLatexNumber(v, DIGITS);
const CONTINUOUS = { variable: 't', discrete: false };
const MAX_ORDER = 6;

const inputSchema = z
  .object({
    mode: z.enum(['funcion', 'ecuacion']),
    expression: z.string().trim().max(200, 'La expresión es demasiado larga (máximo 200).'),
    coefficients: z.string(),
    initial: z.string(),
  })
  .superRefine((input, ctx) => {
    if (input.expression === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['expression'],
        message:
          input.mode === 'funcion' ? 'Escribe f(t).' : 'Escribe la excitación f(t) (0 si no hay).',
      });
    }
    if (input.mode !== 'ecuacion') return;
    const coefficients = parseDataList(input.coefficients);
    if (coefficients.invalid.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['coefficients'],
        message: `No son números: ${coefficients.invalid.slice(0, 3).join(', ')}.`,
      });
      return;
    }
    const order = coefficients.values.length - 1;
    if (order < 1 || order > MAX_ORDER) {
      ctx.addIssue({
        code: 'custom',
        path: ['coefficients'],
        message: `Escribe entre 2 y ${MAX_ORDER + 1} coeficientes (orden 1 a ${MAX_ORDER}).`,
      });
      return;
    }
    if (coefficients.values[0] === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['coefficients'],
        message: 'El coeficiente de la derivada de mayor orden no puede ser 0.',
      });
    }
    const initial = parseDataList(input.initial);
    if (initial.invalid.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['initial'],
        message: `No son números: ${initial.invalid.slice(0, 3).join(', ')}.`,
      });
    } else if (initial.values.length !== 0 && initial.values.length !== order) {
      ctx.addIssue({
        code: 'custom',
        path: ['initial'],
        message: `Una ecuación de orden ${order} necesita ${order} condiciones iniciales (o ninguna si todas son 0).`,
      });
    }
  });

export type LaplaceInput = z.infer<typeof inputSchema>;

export interface LaplaceValue {
  /** F(s) o Y(s) por grupos de retardo. */
  transform: DelayedRational[];
  /** Solo en el modo ecuación: la inversa y(t). */
  solution?: { tex: string; groups: InverseGroup[] };
}

export type LaplaceErrorCode = 'expresion-invalida' | 'fuera-de-tabla';

type Result = CalculatorResult<LaplaceValue, LaplaceErrorCode>;

function fail(code: LaplaceErrorCode, message: string, steps: Step[] = []): Result {
  return {
    ok: false,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

function toRationals(groups: LaplaceGroup[]): DelayedRational[] {
  return groups.map((g) => ({ delay: g.delay, ...groupToRational(g) }));
}

/** Par de la tabla que se usa para un sumando, según la forma de su transformada. */
function describePair(groups: LaplaceGroup[]): { name: string; formula: string } {
  const generic = {
    name: 'Linealidad y tabla de pares',
    formula: '\\mathcal{L}\\{a f_1(t) + b f_2(t)\\} = a F_1(s) + b F_2(s)',
  };
  if (groups.length !== 1) return generic;
  const g = groups[0]!;
  const delay = g.delay;
  let base: { name: string; formula: string } | null = null;
  const poles = g.poles.filter((p) => p.residues.some((r) => !C.isZero(r, 1e-14)));
  if (poles.length === 0 && !C.isZero(g.impulse)) {
    base = { name: 'Impulso', formula: '\\delta(t) \\leftrightarrow 1' };
  } else if (C.isZero(g.impulse)) {
    const nonzero = (p: (typeof poles)[number]) =>
      p.residues.map((r, k) => (C.isZero(r, 1e-14) ? -1 : k + 1)).filter((k) => k > 0);
    if (poles.length === 1 && poles[0]!.pole.im === 0 && nonzero(poles[0]!).length === 1) {
      const p = poles[0]!.pole.re;
      const k = nonzero(poles[0]!)[0]!;
      if (p === 0 && k === 1)
        base = { name: 'Escalón', formula: 'K\\,u(t) \\leftrightarrow \\frac{K}{s}' };
      else if (p === 0) {
        base = {
          name: 'Potencia de t (rampa)',
          formula: 't^{n} \\leftrightarrow \\frac{n!}{s^{n+1}}',
        };
      } else if (k === 1) {
        base = { name: 'Exponencial', formula: 'e^{-at} \\leftrightarrow \\frac{1}{s + a}' };
      } else {
        base = {
          name: 'Potencia de t por exponencial',
          formula: 't^{n}e^{-at} \\leftrightarrow \\frac{n!}{(s + a)^{n+1}}',
        };
      }
    } else if (
      poles.length === 2 &&
      poles[0]!.pole.im !== 0 &&
      poles.every((p) => nonzero(p).every((k) => k === 1))
    ) {
      const damped = poles[0]!.pole.re !== 0;
      base = damped
        ? {
            name: 'Seno y coseno amortiguados (desplazamiento en frecuencia)',
            formula:
              'e^{-at}\\sin\\omega t \\leftrightarrow \\frac{\\omega}{(s + a)^{2} + \\omega^{2}},\\quad e^{-at}\\cos\\omega t \\leftrightarrow \\frac{s + a}{(s + a)^{2} + \\omega^{2}}',
          }
        : {
            name: 'Seno y coseno',
            formula:
              '\\sin\\omega t \\leftrightarrow \\frac{\\omega}{s^{2} + \\omega^{2}},\\quad \\cos\\omega t \\leftrightarrow \\frac{s}{s^{2} + \\omega^{2}}',
          };
    }
  }
  if (!base) {
    base = {
      name: 'Linealidad y desplazamiento en frecuencia',
      formula:
        '\\mathcal{L}\\{e^{-at}f(t)\\} = F(s + a),\\quad \\mathcal{L}\\{t^{n}f(t)\\} = (-1)^{n}\\frac{d^{n}F}{ds^{n}}',
    };
  }
  if (delay === 0) return base;
  return {
    name: `${base.name} con desplazamiento en el tiempo`,
    formula: `${base.formula},\\quad f(t - a)u(t - a) \\leftrightarrow e^{-as}F(s)`,
  };
}

/** Pasos de la transformada de una señal, sumando por sumando. */
function transformSteps(
  source: string,
  name: string,
): { steps: Step[]; groups: LaplaceGroup[] } | { message: string; code: LaplaceErrorCode } {
  const parsed = parseSignal(source, CONTINUOUS);
  if (!parsed.ok) return { message: parsed.message, code: 'fuera-de-tabla' };
  const split = splitTerms(source);
  if (!split.ok) return { message: split.message, code: 'expresion-invalida' };
  const steps: Step[] = [];
  const tex = signalTex(source) ?? source;
  const children: Step[] = [];
  for (const { node, sign } of split.terms) {
    const signal = signalOfNode(node, CONTINUOUS);
    if (!signal.ok) return { message: signal.message, code: 'fuera-de-tabla' };
    const groups = laplaceOfSignal(signal.signal);
    const pair = describePair(groups);
    const termTex = `${sign < 0 ? '-' : ''}${signalNodeTex(node)}`;
    const transform = toRationals(groups);
    children.push({
      title: pair.name,
      formula: pair.formula,
      result: `\\mathcal{L}\\left\\{${termTex}\\right\\} = ${sign < 0 ? `-\\left(${transformTex(transform)}\\right)` : transformTex(transform)}`,
    });
  }
  if (split.terms.length > 1) {
    steps.push({
      title: 'Linealidad',
      explanation:
        'La transformada de una suma es la suma de las transformadas; las constantes salen como factor.',
      formula: `\\mathcal{L}\\{${name}(t)\\} = \\mathcal{L}\\left\\{${tex}\\right\\}`,
    });
  }
  steps.push({
    title: split.terms.length > 1 ? 'Transformada de cada término' : 'Par de la tabla',
    children,
  });
  return { steps, groups: laplaceOfSignal(parsed.signal) };
}

function solveFunction(input: LaplaceInput): Result {
  const built = transformSteps(input.expression, 'f');
  if ('message' in built) return fail(built.code, built.message);
  const parsed = parseSignal(input.expression, CONTINUOUS);
  if (!parsed.ok) return fail('fuera-de-tabla', parsed.message);
  const transform = toRationals(built.groups);
  const fTex = signalTex(input.expression) ?? input.expression;
  const steps: Step[] = [
    {
      title: 'Función del tiempo',
      explanation:
        'La transformada es unilateral: se trabaja con f(t) para t ≥ 0 (como si estuviera multiplicada por u(t)).',
      formula: `f(t) = ${fTex}`,
    },
    ...built.steps,
    {
      title: 'Transformada',
      explanation:
        transform.length > 1
          ? 'Los términos con el mismo retardo e^(−as) se agrupan sobre un denominador común.'
          : 'Se suman los términos sobre un denominador común.',
      result: `F(s) = ${transformTex(transform)}`,
    },
  ];
  const horizon = plotHorizon([parsed.signal]);
  const series: Series = {
    id: 'f',
    title: 'f(t)',
    xLabel: 't (s)',
    yLabel: 'f(t)',
    points: sampleSeries((t) => evaluateSignal(parsed.signal, t), horizon),
  };
  const notices: Notice[] = hasImpulses(parsed.signal)
    ? [{ level: 'info', message: 'La gráfica no muestra los impulsos δ(t − a).' }]
    : [];
  return {
    ok: true,
    value: { transform },
    summary: [
      { label: 'f(t)', value: fTex },
      { label: 'F(s)', value: `F(s) = ${transformTex(transform)}`, emphasis: true },
    ],
    steps,
    tables: [],
    series: [series],
    notices,
  };
}

/** `y''(t)`, `y'(t)`, `y(t)`. */
function derivativeName(k: number, fn = 'y'): string {
  if (k === 0) return `${fn}(t)`;
  if (k <= 3) return `${fn}${"'".repeat(k)}(t)`;
  return `${fn}^{(${k})}(t)`;
}

function initialName(k: number): string {
  if (k === 0) return 'y(0)';
  if (k <= 3) return `y${"'".repeat(k)}(0)`;
  return `y^{(${k})}(0)`;
}

function solveEquation(input: LaplaceInput): Result {
  const a = parseDataList(input.coefficients).values; // aₙ … a₀
  const order = a.length - 1;
  const ic = parseDataList(input.initial).values;
  const initial = ic.length === 0 ? Array<number>(order).fill(0) : ic;

  const built = transformSteps(input.expression, 'f');
  if ('message' in built) return fail(built.code, built.message);
  const forcing = toRationals(built.groups);

  // Ecuación en LaTeX.
  const lhs = a
    .map((c, i) => ({ c, k: order - i }))
    .filter(({ c }) => c !== 0)
    .map(({ c, k }, i) => {
      const abs = Math.abs(c);
      const coef = abs === 1 ? '' : n(abs);
      const term = `${coef}${derivativeName(k)}`;
      if (i === 0) return c < 0 ? `-${term}` : term;
      return c < 0 ? ` - ${term}` : ` + ${term}`;
    })
    .join('');
  const fTex = signalTex(input.expression) ?? input.expression;
  const steps: Step[] = [
    {
      title: 'Ecuación diferencial',
      formula: `${lhs} = ${fTex}`,
      result: initial.map((v, k) => `${initialName(k)} = ${n(v)}`).join(',\\ '),
    },
  ];

  // ℒ{y⁽ᵏ⁾} = sᵏY − Σ_{j<k} s^{k−1−j} y⁽ʲ⁾(0).
  const derivativeSteps: Step[] = [];
  for (let k = order; k >= 1; k--) {
    const terms = Array.from({ length: k }, (_, j) => {
      const power = k - 1 - j;
      const s = power === 0 ? '' : power === 1 ? 's' : `s^{${power}}`;
      return `${s}${initialName(j)}`;
    });
    const values = Array.from({ length: k }, (_, j) => {
      const power = k - 1 - j;
      const s = power === 0 ? '' : power === 1 ? 's' : `s^{${power}}`;
      const v = initial[j]!;
      return `${n(v)}${s}`;
    });
    derivativeSteps.push({
      title: `ℒ{${k === 1 ? "y'" : k === 2 ? "y''" : `y^(${k})`}}`,
      formula: `\\mathcal{L}\\{${derivativeName(k)}\\} = ${k === 1 ? '' : `s^{${k}}`}${k === 1 ? 's' : ''}Y(s) - ${terms.join(' - ')}`,
      substitution: `= ${k === 1 ? 's' : `s^{${k}}`}Y(s) - \\left(${values.join(' + ')}\\right)`,
    });
  }
  steps.push({
    title: 'Transformada de cada derivada',
    explanation: 'Propiedad de derivación: cada derivada aporta las condiciones iniciales.',
    children: derivativeSteps,
  });

  const forcingSteps =
    built.steps.length === 1 && built.steps[0]!.children ? built.steps[0]!.children : built.steps;
  steps.push({ title: 'Transformada de la excitación', children: forcingSteps });

  // P(s) = Σ aᵢ s^{order − i}; I(s) = Σ_k a_k Σ_{j<k} s^{k−1−j} y⁽ʲ⁾(0).
  const p: Poly = trimPoly(a.slice());
  let ip: Poly = [0];
  for (let k = 1; k <= order; k++) {
    const ak = a[order - k]!;
    if (ak === 0) continue;
    const poly: Poly = Array.from({ length: k }, (_, j) => initial[j]! * ak);
    ip = addPoly(ip, poly);
  }
  ip = trimPoly(ip);

  // Y(s) = [F(s) + I(s)] / P(s), grupo por retardo.
  const groups: DelayedRational[] = [];
  const zeroDelay = forcing.find((g) => g.delay === 0);
  if (zeroDelay) {
    groups.push({
      delay: 0,
      num: addPoly(zeroDelay.num, mulPoly(ip, zeroDelay.den)),
      den: mulPoly(zeroDelay.den, p),
    });
  } else if (!(ip.length === 1 && ip[0] === 0)) {
    groups.push({ delay: 0, num: ip, den: p });
  }
  for (const g of forcing) {
    if (g.delay === 0) continue;
    groups.push({ delay: g.delay, num: g.num, den: mulPoly(g.den, p) });
  }
  groups.sort((x, y) => x.delay - y.delay);

  steps.push({
    title: 'Ecuación algebraica en s',
    explanation:
      'Se reemplaza cada transformada y se agrupan los términos con Y(s): el polinomio característico multiplica a Y(s) y las condiciones iniciales pasan al lado derecho.',
    formula: `\\left(${polyTex(p)}\\right)Y(s) - \\left(${polyTex(ip)}\\right) = F(s)`,
    result: `Y(s) = \\frac{F(s) + ${polyTex(ip).startsWith('-') ? `\\left(${polyTex(ip)}\\right)` : polyTex(ip)}}{${polyTex(p)}} = ${transformTex(groups)}`,
  });

  if (groups.length === 0) {
    steps.push({
      title: 'Solución',
      explanation:
        'Sin excitación y con condiciones iniciales nulas, la solución es idénticamente 0.',
      result: 'y(t) = 0',
    });
    return {
      ok: true,
      value: { transform: [], solution: { tex: '0', groups: [] } },
      summary: [{ label: 'y(t)', value: 'y(t) = 0', emphasis: true }],
      steps,
      tables: [],
      series: [],
      notices: [],
    };
  }

  const inverse = inverseLaplace(groups, 'Y', 'y');
  if (!inverse.ok) return fail('expresion-invalida', inverse.message, steps);
  const { result } = inverse;
  steps.push({ title: 'Transformada inversa de Y(s)', children: result.steps });

  // Verificación de y(0) con la solución obtenida (cuando no hay impulsos).
  const notices: Notice[] = [];
  if (ic.length === 0) {
    notices.push({
      level: 'info',
      message: 'Se tomaron todas las condiciones iniciales iguales a 0.',
    });
  }
  if (!result.hasImpulses) {
    const y0 = result.evaluate(0);
    steps.push({
      title: 'Verificación',
      explanation: `Evaluando la solución en t = 0 se recupera la condición inicial y(0) = ${formatNumber(initial[0]!, DIGITS)}.`,
      result: `y(0) = ${n(y0)}`,
    });
  }
  steps.push({ title: 'Solución', result: `y(t) = ${result.tex}` });

  const horizon = Math.max(
    ...result.groups.map((g) =>
      g.pieces.reduce((h, piece) => {
        let next = h;
        if (piece.sigma < -1e-9) next = Math.max(next, g.delay + 5 / -piece.sigma);
        else next = Math.max(next, g.delay + 5);
        if (piece.omega > 1e-9) next = Math.max(next, g.delay + (6 * Math.PI) / piece.omega);
        return next;
      }, g.delay * 1.5),
    ),
    1,
  );
  const series: Series = {
    id: 'y',
    title: 'Solución y(t)',
    xLabel: 't (s)',
    yLabel: 'y(t)',
    points: sampleSeries(result.evaluate, horizon),
  };

  return {
    ok: true,
    value: { transform: groups, solution: { tex: result.tex, groups: result.groups } },
    summary: [
      { label: 'Y(s)', value: `Y(s) = ${transformTex(groups)}` },
      { label: 'y(t)', value: `y(t) = ${result.tex}`, emphasis: true },
    ],
    steps,
    tables: [result.table],
    series: [series],
    notices,
  };
}

export function solveLaplace(input: LaplaceInput): Result {
  return input.mode === 'funcion' ? solveFunction(input) : solveEquation(input);
}

export const transformadaDeLaplace: Calculator<LaplaceInput, LaplaceValue, LaplaceErrorCode> = {
  meta: {
    id: 'transformada-de-laplace',
    title: 'Transformada de Laplace',
    summary:
      'Transforma funciones del tiempo con la tabla de pares y resuelve ecuaciones diferenciales lineales.',
    citations: [
      {
        sourceId: 'hayt-kemmerly-1993',
        locator: '8.ª ed. en inglés, sec. 14.4 a 14.6, ejemplos 14.7 y 14.10',
      },
      {
        sourceId: 'dorf-svoboda-2000',
        locator:
          '9.ª ed. en inglés, sec. 14.2, 14.3 y 14.6, ejemplos 14.2-4, 14.2-5, 14.3-1 y 14.6-1',
      },
    ],
  },
  inputSchema,
  // Dorf y Svoboda, 9.ª ed., ejemplo 14.2-4.
  example: {
    mode: 'funcion',
    expression: '5 - 5e^(-2t)(1 + 2t)',
    coefficients: '1 4 4',
    initial: '0 0',
  },
  solve: solveLaplace,
};
