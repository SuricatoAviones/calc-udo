/**
 * Error en estado estacionario de un sistema realimentado ante entradas escalón, rampa y parábola.
 *
 *   Realimentación unitaria (Ogata, 3.ª ed., sec. 5-10):
 *     Kp = lím G(s),  Kv = lím sG(s),  Ka = lím s²G(s)   (s → 0)
 *     e_escalón = R/(1 + Kp),  e_rampa = R/Kv,  e_parábola = R/Ka
 *   Realimentación no unitaria con H(0) = K_H (Kuo, 7.ª ed., sec. 7-3, ec. 7-36 a 7-48):
 *     e(t) = r(t)/K_H − y(t),  E(s) = R(s)[1 − K_H M(s)]/K_H,  e_ss = lím sE(s)
 *
 * Antes se verifica que el lazo cerrado sea estable: si no, el teorema del valor final no aplica.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  addPoly,
  isZeroPoly,
  mulPoly,
  polyRoots,
  scalePoly,
  trimPoly,
  type Poly,
} from '@/lib/math/polynomials';
import type {
  Calculator,
  CalculatorResult,
  Notice,
  ResultTable,
  Series,
  Step,
  SummaryItem,
} from '../types';
import { inverseLaplace } from '../circuitos-y-sistemas/laplace-inverse';
import {
  lowFrequencyGain,
  parseTf,
  polyTex,
  rootsText,
  stripZeroRoots,
  systemType,
  tfFeedback,
  tfMul,
  tfReduce,
  tfTex,
  zeroMultiplicity,
} from './transfer-function';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

const tfField = (what: string) =>
  z.string().trim().min(1, `Escribe ${what}.`).max(200, `${what} es demasiado larga.`);

const inputSchema = z.object({
  forward: tfField('G(s)'),
  feedback: tfField('H(s)'),
  amplitude: z
    .number({ error: 'Escribe la amplitud R.' })
    .refine(Number.isFinite, 'Escribe la amplitud R.')
    .refine((v) => v > 0, 'La amplitud debe ser positiva.'),
});

export type SteadyStateInput = z.infer<typeof inputSchema>;

export interface SteadyStateValue {
  type: number;
  unity: boolean;
  /** Constantes de error estático (Infinity si son infinitas); solo con realimentación unitaria. */
  kp: number | null;
  kv: number | null;
  ka: number | null;
  /** Errores ante R·u(t), R·t y R·t²/2. */
  errors: { step: number; ramp: number; parabola: number };
}

export type SteadyStateErrorCode =
  'funcion-invalida' | 'lazo-cerrado-inestable' | 'realimentacion-singular';

const INPUTS = [
  { key: 'step', name: 'escalón', r: 'R\\,u(t)', R: '\\frac{R}{s}', power: 1 },
  { key: 'ramp', name: 'rampa', r: 'R\\,t', R: '\\frac{R}{s^{2}}', power: 2 },
  { key: 'parabola', name: 'parábola', r: 'R\\,\\frac{t^{2}}{2}', R: '\\frac{R}{s^{3}}', power: 3 },
] as const;

/** Coeficiente de s^k de un polinomio (0 si no existe). */
function coefficientOf(p: Poly, k: number): number {
  const q = trimPoly(p);
  return q[q.length - 1 - k] ?? 0;
}

function valueTex(v: number): string {
  return v === Infinity ? '\\infty' : n(v);
}

function fail(
  code: SteadyStateErrorCode,
  message: string,
  steps: Step[] = [],
): CalculatorResult<SteadyStateValue, SteadyStateErrorCode> {
  return {
    ok: false,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

export function solveSteadyState(
  input: SteadyStateInput,
): CalculatorResult<SteadyStateValue, SteadyStateErrorCode> {
  const G = parseTf(input.forward, 'G(s)');
  if (!G.ok) return fail('funcion-invalida', G.message);
  const H = parseTf(input.feedback, 'H(s)');
  if (!H.ok) return fail('funcion-invalida', H.message);
  const R = input.amplitude;
  const steps: Step[] = [];
  const notices: Notice[] = [];

  const unityH =
    trimPoly(H.tf.num).length === 1 &&
    trimPoly(H.tf.den).length === 1 &&
    H.tf.num[0]! / H.tf.den[0]! === 1;
  const closed = tfReduce(tfFeedback(G.tf, H.tf, -1)).tf;
  const characteristic = addPoly(mulPoly(G.tf.den, H.tf.den), mulPoly(G.tf.num, H.tf.num));
  const roots = polyRoots(characteristic);
  steps.push({
    title: 'Estabilidad en lazo cerrado',
    explanation: `El teorema del valor final solo vale si el lazo cerrado es estable. Raíces de la ecuación característica: ${rootsText(roots)}.`,
    formula: '1 + G(s)H(s) = 0',
    result: `${polyTex(characteristic)} = 0`,
  });
  const unstable = roots.filter((r) => r.value.re >= -1e-9);
  if (unstable.length > 0) {
    return fail(
      'lazo-cerrado-inestable',
      `El lazo cerrado no es estable (hay raíces en ${rootsText(unstable)}): el error crece sin límite y el análisis del error en estado estable no tiene sentido (Kuo, ejemplo 7-2(b)).`,
      steps,
    );
  }

  const GH = tfMul(G.tf, H.tf);
  const type = systemType(GH);
  const tables: ResultTable[] = [];
  const summary: SummaryItem[] = [];
  const errors = { step: 0, ramp: 0, parabola: 0 };
  let kp: number | null = null;
  let kv: number | null = null;
  let ka: number | null = null;

  steps.push({
    title: 'Tipo del sistema',
    explanation: `${unityH ? 'G(s)' : 'G(s)H(s)'} tiene ${type === 1 ? 'un polo' : `${Math.max(type, 0)} polos`} en el origen: es un sistema de tipo ${Math.max(type, 0)} (Ogata, sec. 5-10).`,
    formula: `${unityH ? 'G(s)' : 'G(s)H(s)'} = ${tfTex(unityH ? G.tf : GH)}`,
  });

  if (unityH) {
    const K = lowFrequencyGain(G.tf);
    const constant = (power: number) => (type > power ? Infinity : type === power ? K : 0);
    kp = constant(0);
    kv = constant(1);
    ka = constant(2);
    const sNTex = (k: number) => (k === 0 ? '' : k === 1 ? 's' : `s^{${k}}`);
    const constSteps: Step[] = [
      { name: 'K_p', k: 0, value: kp },
      { name: 'K_v', k: 1, value: kv },
      { name: 'K_a', k: 2, value: ka },
    ].map(({ name, k, value }) => ({
      title: `Constante ${name}`,
      formula: `${name} = \\lim_{s \\to 0} ${sNTex(k)}G(s)`,
      result: `${name} = ${valueTex(value)}`,
    }));
    steps.push({ title: 'Constantes de error estático', children: constSteps });
    errors.step = R / (1 + kp);
    errors.ramp = kv === 0 ? Infinity : R / kv;
    errors.parabola = ka === 0 ? Infinity : R / ka;
    if (kp === Infinity) errors.step = 0;
    if (kv === Infinity) errors.ramp = 0;
    if (ka === Infinity) errors.parabola = 0;
    steps.push({
      title: 'Errores en estado estacionario',
      children: [
        {
          title: 'Escalón R·u(t)',
          formula: 'e_{ss} = \\frac{R}{1 + K_p}',
          substitution: `e_{ss} = \\frac{${n(R)}}{1 + ${valueTex(kp)}}`,
          result: `e_{ss} = ${valueTex(errors.step)}`,
        },
        {
          title: 'Rampa R·t',
          formula: 'e_{ss} = \\frac{R}{K_v}',
          substitution: `e_{ss} = \\frac{${n(R)}}{${valueTex(kv)}}`,
          result: `e_{ss} = ${valueTex(errors.ramp)}`,
        },
        {
          title: 'Parábola R·t²/2',
          formula: 'e_{ss} = \\frac{R}{K_a}',
          substitution: `e_{ss} = \\frac{${n(R)}}{${valueTex(ka)}}`,
          result: `e_{ss} = ${valueTex(errors.parabola)}`,
        },
      ],
    });
    summary.push(
      { label: 'Tipo', value: `${Math.max(type, 0)}` },
      {
        label: 'Constantes',
        value: `K_p = ${valueTex(kp)},\\ K_v = ${valueTex(kv)},\\ K_a = ${valueTex(ka)}`,
      },
    );
  } else {
    // Kuo, sec. 7-3: H(0) = K_H constante.
    const Hnum = stripZeroRoots(H.tf.num);
    const Hden = stripZeroRoots(H.tf.den);
    if (Hnum.k !== Hden.k || isZeroPoly(H.tf.num)) {
      return fail(
        'realimentacion-singular',
        'H(s) tiene un polo o un cero en s = 0: H(0) debe ser una constante distinta de 0 para definir el error (Kuo, ec. 7-35).',
        steps,
      );
    }
    const KH = lowFrequencyGain(H.tf);
    const M = closed;
    // 1 − K_H M = (D_M − K_H N_M)/D_M.
    const P = addPoly(M.den, scalePoly(M.num, -KH));
    steps.push({
      title: 'Error con realimentación no unitaria',
      explanation: `H(0) = K_H = ${formatNumber(KH, DIGITS)}. La señal que se compara con la entrada en estado estable es K_H veces la salida, así que el error se define como e(t) = r(t)/K_H − y(t) (Kuo, ec. 7-36).`,
      formula:
        'E(s) = \\frac{1}{K_H}\\left[1 - K_HM(s)\\right]R(s),\\quad M(s) = \\frac{G(s)}{1 + G(s)H(s)}',
      result: `M(s) = ${tfTex(M)},\\quad 1 - K_HM(s) = \\frac{${polyTex(P)}}{${polyTex(M.den)}}`,
    });
    const z0 = zeroMultiplicity(P);
    const d0 = coefficientOf(M.den, 0);
    for (const item of INPUTS) {
      const k = item.power - 1;
      const value = z0 > k ? 0 : z0 === k ? (R * coefficientOf(P, k)) / (KH * d0) : Infinity;
      errors[item.key] = value === Infinity ? Infinity : value;
    }
    steps.push({
      title: 'Teorema del valor final',
      formula: 'e_{ss} = \\lim_{s \\to 0} sE(s)',
      children: INPUTS.map((item) => ({
        title: `Entrada ${item.name}`,
        formula: `e_{ss} = \\lim_{s \\to 0} s\\,\\frac{1 - K_HM(s)}{K_H}\\,${item.R}`,
        result: `e_{ss} = ${valueTex(errors[item.key])}`,
      })),
    });
    summary.push({ label: 'Tipo de G(s)H(s)', value: `${Math.max(type, 0)}` });
  }

  for (const item of INPUTS) {
    summary.push({
      label: `Error ante ${item.name}`,
      value: `e_{ss} = ${valueTex(errors[item.key])}`,
      emphasis: item.key === 'step',
    });
  }
  tables.push({
    id: 'errores',
    title: 'Errores en estado estacionario',
    columns: [
      { key: 'entrada', header: '\\text{Entrada}', format: 'latex' },
      { key: 'transformada', header: 'R(s)', format: 'latex' },
      ...(unityH
        ? [{ key: 'constante', header: '\\text{Constante}', format: 'latex' as const }]
        : []),
      { key: 'error', header: 'e_{ss}', format: 'latex' },
    ],
    rows: INPUTS.map((item, i) => ({
      entrada: item.r.replace('R', formatNumber(R, DIGITS)),
      transformada: item.R.replace('R', formatNumber(R, DIGITS)),
      ...(unityH
        ? {
            constante: [
              `K_p = ${valueTex(kp!)}`,
              `K_v = ${valueTex(kv!)}`,
              `K_a = ${valueTex(ka!)}`,
            ][i]!,
          }
        : {}),
      error: valueTex(errors[item.key]),
    })),
  });

  // Respuestas al escalón y a la rampa para ver el error.
  const series: Series[] = [];
  const slowest = Math.min(...roots.map((r) => Math.abs(r.value.re)).filter((v) => v > 1e-9), 1e9);
  const horizon = Math.min(Math.max(6 / Math.max(slowest, 1e-6), 1), 200);
  for (const item of INPUTS.slice(0, 2)) {
    const den = [...closed.den, ...Array<number>(item.power).fill(0)];
    const inverse = inverseLaplace([{ delay: 0, num: scalePoly(closed.num, R), den }], 'C', 'c');
    if (!inverse.ok) continue;
    const samples = 300;
    const points = Array.from({ length: samples + 1 }, (_, i) => {
      const t = (horizon * i) / samples;
      return { x: t, y: inverse.result.evaluate(t) };
    });
    series.push({
      id: `respuesta-${item.key}`,
      title: `Respuesta a la ${item.name}`,
      xLabel: 't (s)',
      yLabel: 'c(t)',
      label: 'c(t)',
      points,
      reference: {
        label: 'r(t)',
        points: points.map(({ x }) => ({ x, y: item.power === 1 ? R : R * x })),
      },
    });
  }
  if (!unityH) {
    notices.push({
      level: 'info',
      message:
        'Con realimentación no unitaria, la salida en estado estable se compara con r(t)/K_H.',
    });
  }
  return {
    ok: true,
    value: { type: Math.max(type, 0), unity: unityH, kp, kv, ka, errors },
    summary,
    steps,
    tables,
    series,
    notices,
  };
}

export const errorEnEstadoEstacionario: Calculator<
  SteadyStateInput,
  SteadyStateValue,
  SteadyStateErrorCode
> = {
  meta: {
    id: 'error-en-estado-estacionario',
    title: 'Error en estado estacionario',
    summary: 'Errores de posición, velocidad y aceleración según el tipo de sistema.',
    citations: [
      { sourceId: 'ogata-1998', locator: 'Sec. 5-10 (constantes de error estático y tabla 5-2)' },
      { sourceId: 'kuo-1996', locator: 'Sec. 7-3, ejemplos 7-2 a 7-5' },
    ],
  },
  inputSchema,
  // Kuo, ejemplo 7-2(c): sistema de tipo 2 estable, K_a = 1/12.
  example: { forward: '5(s + 1)/(s^2 (s + 12)(s + 5))', feedback: '1', amplitude: 1 },
  solve: solveSteadyState,
};
