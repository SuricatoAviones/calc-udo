/**
 * Transformada Z: de una sucesión a X(z), de X(z) a la sucesión (fracciones parciales de X(z)/z,
 * contrastadas con la división larga) y solución de ecuaciones en diferencias lineales.
 *
 *   aₙy(k + n) + … + a₁y(k + 1) + a₀y(k) = x(k),   con y(0), …, y(n − 1)
 *   Z{y(k + i)} = zⁱY(z) − Σ_{j<i} y(j)·z^{i−j}          (traslación real, adelanto)
 *
 * Fuente: Kuo, *Sistemas de Control Automático*, 7.ª ed., sec. 2-11 (ejemplos 2-21, 2-26 y la
 * división larga de la sec. 2-11-4) y sec. 2-12 (ecuación en diferencias de segundo orden).
 */
import { z } from 'zod';
import * as C from '@/lib/math/complex';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  addPoly,
  isZeroPoly,
  mulPoly,
  polyRoots,
  reduceRational,
  trimPoly,
  type Poly,
} from '@/lib/math/polynomials';
import type { Calculator, CalculatorResult, ResultTable, Series, Step } from '../types';
import { DIGITS, factoredTex, joinTerms, parseTransform, polyTex, rationalTex } from './laplace';
import { expansionTemplate, expansionTex, residueSteps } from './laplace-inverse';
import { partialFractions } from './partial-fractions';
import {
  parseSignal,
  signalNodeTex,
  signalOfNode,
  signalTex,
  splitTerms,
  type Signal,
} from './signal';
import {
  evaluateSequence,
  sequenceTerms,
  sequenceTermsTex,
  sequenceTex,
  signalAt,
  zFormOfSignal,
  zRational,
  type SequenceTerm,
} from './z-transform';

const n = (v: number) => toLatexNumber(v, DIGITS);
const DISCRETE = { variable: 'k', discrete: true };
const MAX_ORDER = 6;

const inputSchema = z
  .object({
    mode: z.enum(['sucesion', 'inversa', 'ecuacion']),
    expression: z.string().trim().max(300, 'La expresión es demasiado larga (máximo 300).'),
    coefficients: z.string(),
    initial: z.string(),
    samples: z
      .number({ error: 'Escribe un número entero.' })
      .int('Debe ser un entero.')
      .min(5, 'Al menos 5 muestras.')
      .max(60, 'Como máximo 60 muestras.'),
  })
  .superRefine((input, ctx) => {
    if (input.expression === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['expression'],
        message:
          input.mode === 'inversa'
            ? 'Escribe X(z).'
            : input.mode === 'sucesion'
              ? 'Escribe x(k).'
              : 'Escribe la excitación x(k) (0 si no hay).',
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
        message: 'El coeficiente de y(k + n) no puede ser 0.',
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
        message: `Una ecuación de orden ${order} necesita ${order} valores iniciales: y(0) … y(${order - 1}).`,
      });
    }
  });

export type ZInput = z.infer<typeof inputSchema>;

export interface ZValue {
  num: Poly;
  den: Poly;
  /** Sucesión cerrada (modos inversa y ecuación). */
  tex?: string;
  terms?: SequenceTerm[];
}

export type ZErrorCode = 'expresion-invalida' | 'fuera-de-tabla' | 'no-causal';

type Result = CalculatorResult<ZValue, ZErrorCode>;

function fail(code: ZErrorCode, message: string, steps: Step[] = []): Result {
  return {
    ok: false,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

/** Coeficientes de X(z) en potencias de z⁻¹ por división larga (Kuo, sec. 2-11-4). */
export function powerSeries(num: Poly, den: Poly, count: number): number[] {
  const d = trimPoly(den);
  const degree = d.length - 1;
  const N = trimPoly(num);
  const aligned = [...Array<number>(Math.max(0, d.length - N.length)).fill(0), ...N];
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    let acc = aligned[k] ?? 0;
    for (let i = 1; i <= Math.min(k, degree); i++) acc -= d[i]! * out[k - i]!;
    out.push(acc / d[0]!);
  }
  return out;
}

/** Lo que es solo ruido de coma flotante frente al tamaño de la sucesión se muestra como 0. */
function denoise(values: number[]): number[] {
  const scale = Math.max(1e-300, ...values.map(Math.abs));
  return values.map((v) => (Math.abs(v) <= 1e-12 * scale ? 0 : v));
}

function zTex(num: Poly, den: Poly): string {
  return rationalTex(num, den, 'z');
}

/** Par de la tabla de un sumando, según su forma. */
function describeZPair(signal: Signal): { name: string; formula: string } {
  const generic = {
    name: 'Linealidad y tabla de pares',
    formula: '\\mathcal{Z}\\{a x_1(k) + b x_2(k)\\} = a X_1(z) + b X_2(z)',
  };
  if (signal.length === 0) return generic;
  const shifted = signal.some((t) => t.shift > 0);
  const withShift = (base: { name: string; formula: string }) =>
    shifted
      ? {
          name: `${base.name} con traslación real`,
          formula: `${base.formula},\\quad x(k - m)u(k - m) \\leftrightarrow z^{-m}X(z)`,
        }
      : base;
  if (signal.every((t) => t.kind === 'impulse')) {
    return { name: 'Impulso', formula: '\\delta(k - m) \\leftrightarrow z^{-m}' };
  }
  if (signal.some((t) => t.kind === 'impulse')) return generic;
  const poles = signal.map((t) => (t.kind === 'exp' ? C.clean(C.exp(t.rate), 1e-12) : C.ZERO));
  const powers = signal.map((t) => (t.kind === 'exp' ? t.power : 0));
  const real = poles.every((p) => p.im === 0);
  const samePole = poles.every((p) => C.abs(C.sub(p, poles[0]!)) < 1e-12);
  if (real && samePole) {
    const a = poles[0]!.re;
    if (powers.every((p) => p === 0)) {
      return withShift(
        a === 1
          ? { name: 'Escalón', formula: 'u(k) \\leftrightarrow \\frac{z}{z - 1}' }
          : { name: 'Sucesión geométrica', formula: 'a^{k} \\leftrightarrow \\frac{z}{z - a}' },
      );
    }
    return withShift({
      name: 'Multiplicación por k',
      formula:
        '\\mathcal{Z}\\{k\\,x(k)\\} = -z\\frac{dX}{dz},\\quad k\\,a^{k} \\leftrightarrow \\frac{az}{(z - a)^{2}}',
    });
  }
  if (!real && powers.every((p) => p === 0) && poles.length <= 4) {
    return withShift({
      name: 'Seno y coseno muestreados',
      formula:
        'a^{k}\\sin\\Omega k \\leftrightarrow \\frac{az\\sin\\Omega}{z^{2} - 2az\\cos\\Omega + a^{2}},\\quad a^{k}\\cos\\Omega k \\leftrightarrow \\frac{z(z - a\\cos\\Omega)}{z^{2} - 2az\\cos\\Omega + a^{2}}',
    });
  }
  return withShift(generic);
}

/** Transformada de una sucesión, con un paso por sumando. */
function forwardSteps(
  source: string,
): { steps: Step[]; num: Poly; den: Poly; signal: Signal } | { code: ZErrorCode; message: string } {
  const parsed = parseSignal(source, DISCRETE);
  if (!parsed.ok) return { code: 'fuera-de-tabla', message: parsed.message };
  const split = splitTerms(source);
  if (!split.ok) return { code: 'expresion-invalida', message: split.message };
  const children: Step[] = [];
  for (const { node, sign } of split.terms) {
    const term = signalOfNode(node, DISCRETE);
    if (!term.ok) return { code: 'fuera-de-tabla', message: term.message };
    const { num, den } = zRational(zFormOfSignal(term.signal));
    const pair = describeZPair(term.signal);
    children.push({
      title: pair.name,
      formula: pair.formula,
      result: `\\mathcal{Z}\\left\\{${sign < 0 ? '-' : ''}${signalNodeTex(node)}\\right\\} = ${sign < 0 ? `-\\left(${zTex(num, den)}\\right)` : zTex(num, den)}`,
    });
  }
  const { num, den } = zRational(zFormOfSignal(parsed.signal));
  const steps: Step[] = [
    {
      title: split.terms.length > 1 ? 'Transformada de cada término' : 'Par de la tabla',
      explanation:
        split.terms.length > 1
          ? 'Por linealidad, la transformada de la suma es la suma de las transformadas.'
          : undefined,
      children,
    },
  ];
  return { steps, num, den, signal: parsed.signal };
}

/** Inversa por fracciones parciales de X(z)/z. */
function inverseZ(
  num: Poly,
  den: Poly,
  fn: string,
  seq: string,
): { steps: Step[]; terms: SequenceTerm[]; tex: string } {
  // X(z)/z sin factores comunes: si X(z) tiene z en el numerador, se cancela.
  const reduced = reduceRational(num, mulPoly(den, [1, 0]));
  const zNum = reduced.num;
  const zDen = reduced.den;
  const pf = partialFractions(zNum, zDen);
  const roots = polyRoots(zDen);
  const steps: Step[] = [
    {
      title: `Se expande ${fn}(z)/z`,
      explanation:
        'Casi todos los pares de la tabla tienen z en el numerador, así que se expande X(z)/z en fracciones parciales y al final se multiplica por z (Kuo, sec. 2-11-4).',
      formula: `\\frac{${fn}(z)}{z} = ${rationalTex(zNum, zDen, 'z')}`,
    },
    {
      title: 'Polos',
      formula: `${polyTex(zDen, 'z')} = 0`,
      result: `${polyTex(zDen, 'z')} = ${factoredTex(roots, zDen[0]!, 'z')}`,
      explanation: `Polos: ${roots
        .map(
          (r) =>
            `${C.toTextRect(r.value, DIGITS)}${r.multiplicity > 1 ? ` (multiplicidad ${r.multiplicity})` : ''}`,
        )
        .join(', ')}.`,
    },
    {
      title: 'Forma de la expansión',
      formula: `\\frac{${fn}(z)}{z} = ${expansionTemplate(pf.poles, 'z', [])}`,
    },
    {
      title: 'Cálculo de los residuos',
      children: residueSteps(pf.remainder, zDen, pf.poles, 'z', `\\tfrac{${fn}}{z}`),
    },
    {
      title: `Expansión de ${fn}(z)`,
      explanation: 'Se multiplica por z cada fracción.',
      result: `${fn}(z) = z\\left[${expansionTex(pf.poles, 'z', [])}\\right]`,
    },
  ];
  const terms = sequenceTerms(pf.poles);
  const children: Step[] = terms.map((t) => {
    const tex = joinTerms(sequenceTermsTex([t]));
    if (C.isZero(t.pole)) {
      return {
        title: 'Polo en z = 0',
        formula: 'z^{-m} \\leftrightarrow \\delta(k - m)',
        result: tex,
      };
    }
    if (t.pole.im === 0) {
      return {
        title: `Polo real ${C.toTextRect(t.pole, DIGITS)}${t.order > 1 ? `, orden ${t.order}` : ''}`,
        formula:
          t.order === 1
            ? '\\frac{Kz}{z - p} \\leftrightarrow K\\,p^{k}'
            : '\\frac{Kz}{(z - p)^{r}} \\leftrightarrow K\\binom{k}{r - 1}p^{k - r + 1}',
        result: tex,
      };
    }
    return {
      title: `Par complejo ${C.toTextRect(t.pole, DIGITS)} y su conjugado`,
      explanation: `p = ${formatNumber(C.abs(t.pole), DIGITS)}∠${formatNumber(C.arg(t.pole), DIGITS)} rad y K = ${formatNumber(C.abs(t.residue), DIGITS)}∠${formatNumber(C.arg(t.residue), DIGITS)} rad.`,
      formula:
        '\\frac{Kz}{z - p} + \\frac{K^{*}z}{z - p^{*}} \\leftrightarrow 2|K|\\,|p|^{k}\\cos(\\Omega k + \\theta)',
      result: tex,
    };
  });
  const tex = sequenceTex(terms);
  steps.push({
    title: 'Transformada inversa término a término',
    children,
    result: `${seq}(k) = ${tex}`,
  });
  return { steps, terms, tex };
}

function sequenceSeries(values: number[], name: string): Series {
  return {
    id: 'sucesion',
    title: `${name}(k)`,
    xLabel: 'k',
    yLabel: `${name}(k)`,
    kind: 'bar',
    points: values.map((y, k) => ({ x: k, y })),
  };
}

function solveSequence(input: ZInput): Result {
  const forward = forwardSteps(input.expression);
  if ('message' in forward) return fail(forward.code, forward.message);
  const { num, den, signal } = forward;
  const xTex = signalTex(input.expression) ?? input.expression;
  const count = input.samples;
  const values = denoise(Array.from({ length: count }, (_, k) => signalAt(signal, k)));
  const series = denoise(powerSeries(num, den, count));
  const steps: Step[] = [
    {
      title: 'Definición',
      explanation:
        'La transformada Z convierte la sucesión x(k), k = 0, 1, 2, …, en una función de la variable compleja z.',
      formula: `X(z) = \\sum_{k=0}^{\\infty} x(k)\\,z^{-k},\\qquad x(k) = ${xTex}`,
    },
    ...forward.steps,
    {
      title: 'Transformada',
      result: `X(z) = ${zTex(num, den)}`,
    },
    {
      title: 'Comprobación por división larga',
      explanation:
        'Al dividir el numerador entre el denominador en potencias de z⁻¹, el coeficiente de z⁻ᵏ es x(k) (tabla de abajo).',
      result: `X(z) = ${series
        .slice(0, 4)
        .map((v, k) => `${n(v)}${k === 0 ? '' : k === 1 ? 'z^{-1}' : `z^{-${k}}`}`)
        .join(' + ')
        .replace(/\+ -/g, '- ')} + \\cdots`,
    },
  ];
  const table: ResultTable = {
    id: 'muestras',
    title: 'Muestras de la sucesión',
    columns: [
      { key: 'k', header: 'k' },
      { key: 'x', header: 'x(k)' },
      { key: 'serie', header: '\\text{coef. de } z^{-k}' },
    ],
    rows: values.map((x, k) => ({ k, x, serie: series[k]! })),
  };
  return {
    ok: true,
    value: { num, den },
    summary: [
      { label: 'x(k)', value: xTex },
      { label: 'X(z)', value: `X(z) = ${zTex(num, den)}`, emphasis: true },
    ],
    steps,
    tables: [table],
    series: [sequenceSeries(values, 'x')],
    notices: [],
  };
}

function solveInverse(input: ZInput): Result {
  const parsed = parseTransform(input.expression, 'z');
  if (!parsed.ok) return fail('expresion-invalida', parsed.message);
  if (parsed.groups.length !== 1 || parsed.groups[0]!.delay !== 0) {
    return fail(
      'expresion-invalida',
      'X(z) debe ser un cociente de polinomios en z (sin e^(−az)).',
    );
  }
  const { num, den } = parsed.groups[0]!;
  if (trimPoly(num).length > trimPoly(den).length) {
    return fail(
      'no-causal',
      'El grado del numerador es mayor que el del denominador: la sucesión no sería causal (empezaría antes de k = 0).',
    );
  }
  const inverse = inverseZ(num, den, 'X', 'x');
  const count = input.samples;
  const closed = denoise(
    Array.from({ length: count }, (_, k) => evaluateSequence(inverse.terms, k)),
  );
  const division = denoise(powerSeries(num, den, count));
  const steps: Step[] = [
    { title: 'Función a invertir', formula: `X(z) = ${zTex(num, den)}` },
    ...inverse.steps,
    {
      title: 'Comprobación por división larga',
      explanation:
        'Los coeficientes de z⁻ᵏ de la división larga coinciden con x(k) (tabla de abajo).',
      result: `x(k) = ${inverse.tex},\\quad k = 0, 1, 2, \\ldots`,
    },
  ];
  return {
    ok: true,
    value: { num, den, tex: inverse.tex, terms: inverse.terms },
    summary: [
      { label: 'X(z)', value: `X(z) = ${zTex(num, den)}` },
      { label: 'x(k)', value: `x(k) = ${inverse.tex}`, emphasis: true },
    ],
    steps,
    tables: [
      {
        id: 'muestras',
        title: 'Muestras de x(k)',
        columns: [
          { key: 'k', header: 'k' },
          { key: 'cerrada', header: 'x(k)\\ \\text{cerrada}' },
          { key: 'division', header: '\\text{división larga}' },
        ],
        rows: closed.map((x, k) => ({ k, cerrada: x, division: division[k]! })),
      },
    ],
    series: [sequenceSeries(closed, 'x')],
    notices: [],
  };
}

function shiftName(i: number): string {
  return i === 0 ? 'y(k)' : `y(k + ${i})`;
}

function solveEquation(input: ZInput): Result {
  const a = parseDataList(input.coefficients).values; // aₙ … a₀
  const order = a.length - 1;
  const ic = parseDataList(input.initial).values;
  const initial = ic.length === 0 ? Array<number>(order).fill(0) : ic;
  const forward = forwardSteps(input.expression);
  if ('message' in forward) return fail(forward.code, forward.message);

  const lhs = a
    .map((c, i) => ({ c, shift: order - i }))
    .filter(({ c }) => c !== 0)
    .map(({ c, shift }, i) => {
      const abs = Math.abs(c);
      const term = `${abs === 1 ? '' : n(abs)}${shiftName(shift)}`;
      if (i === 0) return c < 0 ? `-${term}` : term;
      return c < 0 ? ` - ${term}` : ` + ${term}`;
    })
    .join('');
  const xTex = signalTex(input.expression) ?? input.expression;
  const steps: Step[] = [
    {
      title: 'Ecuación en diferencias',
      formula: `${lhs} = ${xTex}`,
      result: initial.map((v, k) => `y(${k}) = ${n(v)}`).join(',\\ '),
    },
  ];

  const shiftSteps: Step[] = [];
  for (let i = order; i >= 1; i--) {
    const terms = Array.from({ length: i }, (_, j) => {
      const power = i - j;
      return `y(${j})${power === 1 ? 'z' : `z^{${power}}`}`;
    });
    shiftSteps.push({
      title: `Z{y(k + ${i})}`,
      formula: `\\mathcal{Z}\\{${shiftName(i)}\\} = ${i === 1 ? 'z' : `z^{${i}}`}Y(z) - ${terms.join(' - ')}`,
    });
  }
  steps.push({
    title: 'Traslación real (adelanto)',
    explanation:
      'Cada adelanto multiplica por z y descuenta las muestras iniciales que quedan antes de k = 0.',
    children: shiftSteps,
  });
  steps.push({
    title: 'Transformada de la excitación',
    children:
      forward.steps.length === 1 && forward.steps[0]!.children
        ? forward.steps[0]!.children
        : forward.steps,
    result: `X(z) = ${zTex(forward.num, forward.den)}`,
  });

  // P(z) = Σ aᵢ zⁱ; I(z) = Σ_i aᵢ Σ_{j<i} y(j) z^{i−j}.
  const p: Poly = trimPoly(a.slice());
  let ip: Poly = [0];
  for (let i = 1; i <= order; i++) {
    const ai = a[order - i]!;
    if (ai === 0) continue;
    // Coeficientes de z^i … z^1 (y(0) … y(i − 1)), más el término independiente 0.
    const poly: Poly = [...Array.from({ length: i }, (_, j) => ai * initial[j]!), 0];
    ip = addPoly(ip, poly);
  }
  ip = trimPoly(ip);

  const num = trimPoly(addPoly(forward.num, mulPoly(ip, forward.den)));
  const den = trimPoly(mulPoly(forward.den, p));
  steps.push({
    title: 'Ecuación algebraica en z',
    formula: `\\left(${polyTex(p, 'z')}\\right)Y(z) - \\left(${polyTex(ip, 'z')}\\right) = X(z)`,
    result: `Y(z) = ${zTex(num, den)}`,
  });

  if (isZeroPoly(num)) {
    steps.push({ title: 'Solución', result: 'y(k) = 0' });
    return {
      ok: true,
      value: { num, den, tex: '0', terms: [] },
      summary: [{ label: 'y(k)', value: 'y(k) = 0', emphasis: true }],
      steps,
      tables: [],
      series: [],
      notices: [],
    };
  }

  const inverse = inverseZ(num, den, 'Y', 'y');
  steps.push({ title: 'Transformada Z inversa de Y(z)', children: inverse.steps });

  // Contraste con la recursión directa.
  const count = input.samples;
  const recursion: number[] = [...initial];
  for (let k = 0; recursion.length < count; k++) {
    let acc = signalAt(forward.signal, k);
    for (let i = 0; i < order; i++) acc -= a[order - i]! * recursion[k + i]!;
    recursion.push(acc / a[0]!);
  }
  const closed = denoise(
    Array.from({ length: count }, (_, k) => evaluateSequence(inverse.terms, k)),
  );
  steps.push({
    title: 'Solución',
    explanation:
      'La tabla compara la solución cerrada con la recursión de la ecuación (despejando y(k + n) muestra por muestra).',
    result: `y(k) = ${inverse.tex}`,
  });

  return {
    ok: true,
    value: { num, den, tex: inverse.tex, terms: inverse.terms },
    summary: [
      { label: 'Y(z)', value: `Y(z) = ${zTex(num, den)}` },
      { label: 'y(k)', value: `y(k) = ${inverse.tex}`, emphasis: true },
    ],
    steps,
    tables: [
      {
        id: 'muestras',
        title: 'Solución muestra por muestra',
        columns: [
          { key: 'k', header: 'k' },
          { key: 'cerrada', header: 'y(k)\\ \\text{cerrada}' },
          { key: 'recursion', header: 'y(k)\\ \\text{por recursión}' },
        ],
        rows: closed.map((y, k) => ({ k, cerrada: y, recursion: recursion[k]! })),
      },
    ],
    series: [sequenceSeries(closed, 'y')],
    notices:
      ic.length === 0
        ? [{ level: 'info', message: 'Se tomaron los valores iniciales iguales a 0.' }]
        : [],
  };
}

export function solveZ(input: ZInput): Result {
  if (input.mode === 'sucesion') return solveSequence(input);
  if (input.mode === 'inversa') return solveInverse(input);
  return solveEquation(input);
}

export const transformadaZ: Calculator<ZInput, ZValue, ZErrorCode> = {
  meta: {
    id: 'transformada-z',
    title: 'Transformada Z',
    summary:
      'Transforma sucesiones, invierte X(z) por fracciones parciales y resuelve ecuaciones en diferencias.',
    citations: [
      {
        sourceId: 'kuo-1996',
        locator: 'Sec. 2-11 (ejemplos 2-21 y 2-26) y sec. 2-12 (ecuaciones en diferencias)',
      },
    ],
  },
  inputSchema,
  // Kuo, 7.ª ed., sec. 2-12: y(k + 2) + 0.5y(k + 1) + 0.2y(k) = u(k), y(0) = y(1) = 0.
  example: {
    mode: 'ecuacion',
    expression: 'u(k)',
    coefficients: '1 0.5 0.2',
    initial: '0 0',
    samples: 12,
  },
  solve: solveZ,
};
