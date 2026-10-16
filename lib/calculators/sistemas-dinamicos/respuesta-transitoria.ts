/**
 * Respuesta transitoria de sistemas de primer y segundo orden (y de una G(s) cualquiera) ante el
 * impulso, el escalón, la rampa y la parábola unitarios, con las especificaciones de la respuesta
 * al escalón.
 *
 *   Primer orden:  G(s) = K/(Ts + 1);  c(t) = K(1 − e^{−t/T}),  t_s = 4T (2 %), 3T (5 %)
 *   Segundo orden: G(s) = Kω_n²/(s² + 2ζω_ns + ω_n²), con 0 < ζ < 1:
 *     ω_d = ω_n√(1 − ζ²),  σ = ζω_n,  β = tan⁻¹(ω_d/σ)
 *     t_r = (π − β)/ω_d,  t_p = π/ω_d,  M_p = e^{−(σ/ω_d)π},  t_s = 4/σ (2 %), 3/σ (5 %)
 *
 * Fuentes: Ogata, 3.ª ed., sec. 4-2 y 4-3 (ec. 4-3 a 4-6 y 4-27 a 4-32, ejemplo 4-2); Kuo,
 * 7.ª ed., ejemplo 7-5 (respuesta al escalón de un sistema de cuarto orden, ec. 7-56).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { addPoly, polyRoots, scalePoly, trimPoly } from '@/lib/math/polynomials';
import type {
  Calculator,
  CalculatorResult,
  Notice,
  ResultTable,
  Series,
  Step,
  SummaryItem,
} from '../types';
import {
  parseTf,
  rootsText,
  tfTex,
  zeroMultiplicity,
  type TransferFunction,
} from './transfer-function';
import {
  INPUT_INFO,
  horizonFor,
  sample,
  stepSpecs,
  timeResponse,
  type StepSpecs,
} from './time-response';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);
const positive = (what: string) =>
  z
    .number({ error: `Escribe ${what}.` })
    .refine(Number.isFinite, `Escribe ${what}.`)
    .refine((v) => v > 0, `${what} debe ser mayor que 0.`);

const inputSchema = z.object({
  order: z.enum(['primer-orden', 'segundo-orden', 'general']),
  input: z.enum(['impulso', 'escalon', 'rampa', 'aceleracion']),
  gain: z
    .number({ error: 'Escribe K.' })
    .refine(Number.isFinite, 'Escribe K.')
    .refine((v) => v !== 0, 'K no puede ser 0.'),
  timeConstant: positive('T'),
  zeta: z
    .number({ error: 'Escribe ζ.' })
    .refine(Number.isFinite, 'Escribe ζ.')
    .refine((v) => v >= 0, 'ζ no puede ser negativo.'),
  omegaN: positive('ωₙ'),
  transfer: z.string().max(200),
});

export type TransientInput = z.infer<typeof inputSchema>;

export interface TransientValue {
  tf: TransferFunction;
  responseTex: string;
  specs: StepSpecs | null;
  /** Fórmulas de Ogata para el segundo orden subamortiguado. */
  formulas: {
    omegaD: number;
    sigma: number;
    beta: number;
    rise: number;
    peak: number;
    overshoot: number;
    settling2: number;
    settling5: number;
  } | null;
  /** Error en estado estacionario ante la rampa o la parábola (si el sistema es estable). */
  steadyError: number | null;
}

export type TransientErrorCode = 'funcion-invalida' | 'inversa-fallida';

function fail(
  code: TransientErrorCode,
  message: string,
  steps: Step[] = [],
): CalculatorResult<TransientValue, TransientErrorCode> {
  return {
    ok: false,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

const optional = (v: number | null, unit = 's') =>
  v === null ? '\\text{—}' : `${n(v)}\\ \\text{${unit}}`;

export function solveTransient(
  input: TransientInput,
): CalculatorResult<TransientValue, TransientErrorCode> {
  const steps: Step[] = [];
  const notices: Notice[] = [];
  const info = INPUT_INFO[input.input];
  let tf: TransferFunction;
  let formulas: TransientValue['formulas'] = null;
  const K = input.gain;

  if (input.order === 'primer-orden') {
    const T = input.timeConstant;
    tf = { num: [K / T], den: [1, 1 / T] };
    steps.push({
      title: 'Sistema de primer orden',
      explanation: `T = ${formatNumber(T, DIGITS)} s es la constante de tiempo: el polo está en s = −1/T = ${formatNumber(-1 / T, DIGITS)}.`,
      formula: 'G(s) = \\frac{K}{Ts + 1}',
      substitution: `G(s) = \\frac{${n(K)}}{${n(T)}s + 1}`,
      result: `G(s) = ${tfTex(tf)}`,
    });
  } else if (input.order === 'segundo-orden') {
    const { zeta, omegaN: wn } = input;
    tf = { num: [K * wn * wn], den: [1, 2 * zeta * wn, wn * wn] };
    const kind =
      zeta === 0
        ? 'sin amortiguamiento (ζ = 0): oscila sin decaer'
        : zeta < 1
          ? 'subamortiguado (0 < ζ < 1): polos complejos conjugados'
          : zeta === 1
            ? 'críticamente amortiguado (ζ = 1): polo doble real'
            : 'sobreamortiguado (ζ > 1): dos polos reales distintos';
    const poles = polyRoots(tf.den);
    steps.push({
      title: 'Sistema de segundo orden',
      explanation: `ζ = ${formatNumber(zeta, DIGITS)} es el factor de amortiguamiento relativo y ω_n = ${formatNumber(wn, DIGITS)} rad/s la frecuencia natural no amortiguada. El sistema es ${kind}. Polos: ${rootsText(poles)}.`,
      formula: 'G(s) = \\frac{K\\omega_n^2}{s^2 + 2\\zeta\\omega_ns + \\omega_n^2}',
      substitution: `G(s) = \\frac{${n(K)}(${n(wn)})^{2}}{s^{2} + 2(${n(zeta)})(${n(wn)})s + (${n(wn)})^{2}}`,
      result: `G(s) = ${tfTex(tf)}`,
    });
    if (zeta > 0 && zeta < 1) {
      const omegaD = wn * Math.sqrt(1 - zeta * zeta);
      const sigma = zeta * wn;
      const beta = Math.atan2(omegaD, sigma);
      formulas = {
        omegaD,
        sigma,
        beta,
        rise: (Math.PI - beta) / omegaD,
        peak: Math.PI / omegaD,
        overshoot: Math.exp(-(sigma / omegaD) * Math.PI),
        settling2: 4 / sigma,
        settling5: 3 / sigma,
      };
    }
  } else {
    const parsed = parseTf(input.transfer);
    if (!parsed.ok) return fail('funcion-invalida', parsed.message);
    tf = parsed.tf;
    const poles = polyRoots(tf.den);
    steps.push({
      title: 'Sistema',
      explanation: `Polos: ${rootsText(poles)}.`,
      result: `G(s) = ${tfTex(tf)}`,
    });
  }

  const poles = polyRoots(tf.den);
  const stable = poles.every((p) => p.value.re < -1e-9);
  const response = timeResponse(tf, input.input);
  if (!response) return fail('inversa-fallida', 'No se pudo invertir C(s).', steps);
  steps.push({
    title: `Respuesta al ${info.name}`,
    explanation:
      'Con condiciones iniciales cero, C(s) = G(s)R(s); se invierte por fracciones parciales.',
    formula: `C(s) = G(s)\\,${info.R}`,
    children: response.steps,
    result: `c(t) = ${response.tex},\\quad t \\ge 0`,
  });

  // Especificaciones de la respuesta al escalón.
  let specs: StepSpecs | null = null;
  const tables: ResultTable[] = [];
  const horizon = horizonFor(tf);
  if (stable) {
    const stepResponse = timeResponse(tf, 'escalon');
    // Valor final ante el escalón: G(0) (el sistema es estable, así que D(0) ≠ 0).
    const final = tf.num.at(-1)! / tf.den.at(-1)!;
    if (stepResponse && Math.abs(final) > 1e-12) {
      specs = stepSpecs(stepResponse.evaluate, final, horizon * 1.5);
    }
  } else {
    notices.push({
      level: 'warning',
      message:
        'El sistema no es estable: la respuesta no se asienta y no hay especificaciones de respuesta transitoria.',
    });
  }

  if (input.order === 'primer-orden' && input.input === 'escalon') {
    const T = input.timeConstant;
    steps.push({
      title: 'Especificaciones del primer orden',
      explanation: `En t = T la respuesta alcanza el 63.2 % de su valor final; en 4T, el 98.2 % (Ogata, sec. 4-2).`,
      formula:
        'c(T) = K(1 - e^{-1}) = 0.632K,\\quad t_s = 4T\\ (2\\,\\%),\\quad t_s = 3T\\ (5\\,\\%)',
      result: `c(T) = ${n(K * (1 - Math.exp(-1)))},\\quad t_s = ${n(4 * T)}\\ \\text{s}\\ (2\\,\\%),\\quad ${n(3 * T)}\\ \\text{s}\\ (5\\,\\%)`,
    });
  }
  if (formulas && input.input === 'escalon') {
    const { zeta, omegaN: wn } = input;
    steps.push({
      title: 'Especificaciones del segundo orden subamortiguado',
      explanation:
        'Fórmulas de Ogata (sec. 4-3) para la respuesta al escalón; t_s es una estimación con la envolvente e^{−σt}.',
      children: [
        {
          title: 'Frecuencia amortiguada y atenuación',
          formula:
            '\\omega_d = \\omega_n\\sqrt{1 - \\zeta^2},\\quad \\sigma = \\zeta\\omega_n,\\quad \\beta = \\tan^{-1}\\frac{\\omega_d}{\\sigma}',
          substitution: `\\omega_d = ${n(wn)}\\sqrt{1 - ${n(zeta)}^{2}},\\quad \\sigma = (${n(zeta)})(${n(wn)})`,
          result: `\\omega_d = ${n(formulas.omegaD)}\\ \\text{rad/s},\\quad \\sigma = ${n(formulas.sigma)},\\quad \\beta = ${n(formulas.beta)}\\ \\text{rad}`,
        },
        {
          title: 'Tiempo de levantamiento',
          formula: 't_r = \\frac{\\pi - \\beta}{\\omega_d}',
          substitution: `t_r = \\frac{\\pi - ${n(formulas.beta)}}{${n(formulas.omegaD)}}`,
          result: `t_r = ${n(formulas.rise)}\\ \\text{s}`,
        },
        {
          title: 'Tiempo pico',
          formula: 't_p = \\frac{\\pi}{\\omega_d}',
          substitution: `t_p = \\frac{\\pi}{${n(formulas.omegaD)}}`,
          result: `t_p = ${n(formulas.peak)}\\ \\text{s}`,
        },
        {
          title: 'Sobrepaso máximo',
          formula: 'M_p = e^{-(\\sigma/\\omega_d)\\pi}',
          substitution: `M_p = e^{-(${n(formulas.sigma)}/${n(formulas.omegaD)})\\pi}`,
          result: `M_p = ${n(formulas.overshoot)} = ${n(100 * formulas.overshoot)}\\,\\%`,
        },
        {
          title: 'Tiempo de asentamiento',
          formula:
            't_s = \\frac{4}{\\sigma}\\ (2\\,\\%),\\quad t_s = \\frac{3}{\\sigma}\\ (5\\,\\%)',
          result: `t_s = ${n(formulas.settling2)}\\ \\text{s}\\ (2\\,\\%),\\quad ${n(formulas.settling5)}\\ \\text{s}\\ (5\\,\\%)`,
        },
      ],
    });
  }
  if (specs) {
    tables.push({
      id: 'especificaciones',
      title: 'Especificaciones medidas sobre la respuesta al escalón',
      columns: [
        { key: 'especificacion', header: '\\text{Especificación}', format: 'latex' },
        { key: 'valor', header: '\\text{Valor}', format: 'latex' },
      ],
      rows: [
        { especificacion: 'c(\\infty)', valor: n(specs.final) },
        { especificacion: 't_d\\ (50\\,\\%)', valor: optional(specs.delay) },
        {
          especificacion: `t_r\\ (${specs.riseCriterion === '0-100' ? '0\\text{ a }100' : '10\\text{ a }90'}\\,\\%)`,
          valor: optional(specs.rise),
        },
        { especificacion: 't_p', valor: optional(specs.peak) },
        { especificacion: 'M_p', valor: `${n(100 * specs.overshoot)}\\,\\%` },
        { especificacion: 't_s\\ (2\\,\\%)', valor: optional(specs.settling2) },
        { especificacion: 't_s\\ (5\\,\\%)', valor: optional(specs.settling5) },
      ],
    });
    if (input.input === 'escalon') {
      steps.push({
        title: 'Medición sobre la curva',
        explanation:
          'Las especificaciones también se miden directamente sobre c(t): el levantamiento de 0 a 100 % si hay sobrepaso (de 10 a 90 % si no), el primer pico y el último instante en que la respuesta sale de la banda del 2 % o del 5 % del valor final. El tiempo de asentamiento medido puede diferir de la estimación 4/σ.',
      });
    }
  }

  // Error en estado estacionario ante la rampa y la parábola: lím [r(t) − c(t)].
  let steadyError: number | null = null;
  if (stable && (input.input === 'rampa' || input.input === 'aceleracion')) {
    // Teorema del valor final: e_ss = lím s·R(s)[1 − G(s)] = lím (D − N)/(s^{k} D), k = 1 o 2.
    const P = trimPoly(addPoly(tf.den, scalePoly(tf.num, -1)));
    const k = info.power - 1;
    const z0 = zeroMultiplicity(P);
    const d0 = tf.den.at(-1)!;
    steadyError = z0 > k ? 0 : z0 === k ? (P[P.length - 1 - k] ?? 0) / d0 : Infinity;
    steps.push({
      title: 'Error en estado estacionario',
      explanation:
        steadyError === Infinity
          ? 'La salida no sigue a la entrada: el error crece sin límite.'
          : `Cuando t → ∞, la diferencia entre la entrada y la salida tiende a una constante${input.order === 'primer-orden' && K === 1 ? ' (para el primer orden con K = 1 es T, Ogata ec. 4-5)' : ''}.`,
      formula: 'e_{ss} = \\lim_{t \\to \\infty}\\left[r(t) - c(t)\\right]',
      result: `e_{ss} = ${steadyError === Infinity ? '\\infty' : n(steadyError)}`,
    });
  }

  const points = sample(response.evaluate, horizon);
  const series: Series[] = [
    {
      id: 'respuesta',
      title: `Respuesta al ${info.name}`,
      xLabel: 't (s)',
      yLabel: 'c(t)',
      label: 'c(t)',
      points,
      ...(input.input !== 'impulso'
        ? { reference: { label: 'r(t)', points: points.map(({ x }) => ({ x, y: info.at(x) })) } }
        : {}),
      ...(specs?.peak && input.input === 'escalon'
        ? {
            scatter: {
              label: 'Pico',
              points: [{ x: specs.peak, y: specs.final * (1 + specs.overshoot) }],
            },
          }
        : {}),
    },
  ];

  const summary: SummaryItem[] = [
    { label: 'Respuesta', value: `c(t) = ${response.tex}`, emphasis: true },
    { label: 'Función de transferencia', value: `G(s) = ${tfTex(tf)}` },
  ];
  if (specs && input.input === 'escalon') {
    summary.push(
      { label: 'Sobrepaso máximo', value: `M_p = ${n(100 * specs.overshoot)}\\,\\%` },
      {
        label: 'Tiempos',
        value: `t_r = ${optional(specs.rise)},\\ t_p = ${optional(specs.peak)},\\ t_s = ${optional(specs.settling2)}\\ (2\\,\\%)`,
      },
    );
  }
  if (steadyError !== null)
    summary.push({
      label: 'Error en estado estacionario',
      value: `e_{ss} = ${steadyError === Infinity ? '\\infty' : n(steadyError)}`,
    });

  return {
    ok: true,
    value: { tf, responseTex: response.tex, specs, formulas, steadyError },
    summary,
    steps,
    tables,
    series,
    notices,
  };
}

export const respuestaTransitoria: Calculator<TransientInput, TransientValue, TransientErrorCode> =
  {
    meta: {
      id: 'respuesta-transitoria',
      title: 'Respuesta transitoria de primer y segundo orden',
      summary:
        'Respuestas al escalón, la rampa y el impulso y especificaciones como el sobreimpulso.',
      citations: [
        {
          sourceId: 'ogata-1998',
          locator: 'Sec. 4-2 y 4-3 (ec. 4-3 a 4-6 y 4-27 a 4-32), ejemplo 4-2',
        },
        { sourceId: 'kuo-1996', locator: 'Ejemplo 7-5, ec. 7-56' },
      ],
    },
    inputSchema,
    // Ogata, ejemplo 4-2: ζ = 0.6 y ω_n = 5 rad/s.
    example: {
      order: 'segundo-orden',
      input: 'escalon',
      gain: 1,
      timeConstant: 1,
      zeta: 0.6,
      omegaN: 5,
      transfer: '(s + 5)/(s^4 + 17s^3 + 60s^2 + 5s + 5)',
    },
    solve: solveTransient,
  };
