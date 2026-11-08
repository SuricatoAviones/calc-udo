/**
 * Respuesta de circuitos de primer orden (RC y RL) con fuentes de cd que cambian en t = 0.
 *
 *   τ = R·C  o  τ = L/R          (R: resistencia de Thévenin vista por el capacitor o el inductor)
 *   x(t) = x(∞) + [x(0⁺) − x(∞)]·e^{−t/τ},   t > 0
 *
 * x es la variable que no cambia de golpe: v_C en un RC e i_L en un RL. Es el procedimiento de
 * Hayt (sec. 8.7, pasos 1 a 6): constante de tiempo, valor inicial, valor final y respuesta
 * completa = forzada + natural.
 *
 * Fuente: Hayt, Kemmerly y Durbin, 8.ª ed., cap. 8 (ejemplos 8.2, 8.7, 8.8 y 8.10).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, ResultTable, Series, Step } from '../types';
import { joinTerms, piecesLatexTerms, type TimePiece } from './laplace';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

const finite = (what: string) =>
  z.number({ error: `Escribe ${what}.` }).refine(Number.isFinite, `Escribe ${what}.`);
const positive = (what: string) =>
  finite(what).refine((v) => v > 0, `${what} debe ser mayor que 0.`);

const inputSchema = z.object({
  circuit: z.enum(['rc', 'rl']),
  resistance: positive('R'),
  storage: positive('el valor de C o L'),
  initial: finite('el valor inicial'),
  final: finite('el valor final'),
  time: z.number().min(0, 'El instante debe ser t ≥ 0.').optional(),
});

export type FirstOrderInput = z.infer<typeof inputSchema>;

export interface FirstOrderValue {
  tau: number;
  /** x(t) en LaTeX (variable de estado). */
  tex: string;
  /** Variable complementaria (i_C o v_L) en LaTeX. */
  otherTex: string;
  atTime?: { t: number; x: number; other: number };
}

/** Lo que cambia entre un circuito RC (variable v_C) y uno RL (variable i_L). */
interface CircuitProfile {
  x: string;
  other: string;
  unit: string;
  otherUnit: string;
  element: string;
  stateExplanation: string;
  tauFormula: string;
  tau: (R: number, S: number) => number;
  tauSubstitution: (R: number, S: number) => string;
  finalExplanation: string;
  /** Amplitud de la variable complementaria: i_C = (x∞ − x0)/R, v_L = R(x∞ − x0). */
  otherAmplitude: (R: number, change: number) => number;
  otherTitle: string;
  otherExplanation: string;
  otherFormula: string;
  energyFormula: string;
  seriesTitle: string;
}

const PROFILES: Record<FirstOrderInput['circuit'], CircuitProfile> = {
  rc: {
    x: 'v_C',
    other: 'i_C',
    unit: 'V',
    otherUnit: 'A',
    element: 'capacitor',
    stateExplanation:
      'En un circuito RC se trabaja con el voltaje del capacitor: no puede cambiar instantáneamente, así que v_C(0⁺) = v_C(0⁻).',
    tauFormula: String.raw`\tau = R\,C`,
    tau: (R, S) => R * S,
    tauSubstitution: (R, S) => String.raw`\tau = (${n(R)})(${n(S)})`,
    finalExplanation: 'Con cd y t → ∞, el capacitor se comporta como un circuito abierto.',
    otherAmplitude: (R, change) => change / R,
    otherTitle: 'Corriente del capacitor',
    otherExplanation:
      'Se deriva el voltaje: i_C = C dv_C/dt. A diferencia de v_C, sí salta en t = 0.',
    otherFormula: String.raw`i_C(t) = C\frac{dv_C}{dt} = \frac{v_C(\infty) - v_C(0^{+})}{R}e^{-t/\tau}`,
    energyFormula: String.raw`w_C = \tfrac{1}{2}Cv_C^{2}`,
    seriesTitle: 'Voltaje del capacitor',
  },
  rl: {
    x: 'i_L',
    other: 'v_L',
    unit: 'A',
    otherUnit: 'V',
    element: 'inductor',
    stateExplanation:
      'En un circuito RL se trabaja con la corriente del inductor: no puede cambiar instantáneamente, así que i_L(0⁺) = i_L(0⁻).',
    tauFormula: String.raw`\tau = \frac{L}{R}`,
    tau: (R, S) => S / R,
    tauSubstitution: (R, S) => String.raw`\tau = \frac{${n(S)}}{${n(R)}}`,
    finalExplanation: 'Con cd y t → ∞, el inductor se comporta como un cortocircuito.',
    otherAmplitude: (R, change) => R * change,
    otherTitle: 'Voltaje del inductor',
    otherExplanation:
      'Se deriva la corriente: v_L = L di_L/dt. A diferencia de i_L, sí salta en t = 0.',
    otherFormula: String.raw`v_L(t) = L\frac{di_L}{dt} = R\left[i_L(\infty) - i_L(0^{+})\right]e^{-t/\tau}`,
    energyFormula: String.raw`w_L = \tfrac{1}{2}Li_L^{2}`,
    seriesTitle: 'Corriente del inductor',
  },
};

export function solveFirstOrder(input: FirstOrderInput): CalculatorResult<FirstOrderValue, never> {
  const profile = PROFILES[input.circuit];
  const R = input.resistance;
  const S = input.storage;
  const x0 = input.initial;
  const xInf = input.final;
  const tau = profile.tau(R, S);
  const rate = 1 / tau;
  const { x, other, unit, otherUnit } = profile;

  const steps: Step[] = [];
  steps.push(
    {
      title: 'Variable de estado',
      explanation: profile.stateExplanation,
      result: String.raw`${x}(0^{+}) = ${x}(0^{-}) = ${n(x0)}\ \text{${unit}}`,
    },
    {
      title: 'Constante de tiempo',
      explanation: `R es la resistencia equivalente (de Thévenin) que ve el ${profile.element} con las fuentes independientes apagadas.`,
      formula: profile.tauFormula,
      substitution: profile.tauSubstitution(R, S),
      result: String.raw`\tau = ${n(tau)}\ \text{s}`,
    },
    {
      title: 'Valor final (respuesta forzada)',
      explanation: profile.finalExplanation,
      result: String.raw`${x}(\infty) = ${n(xInf)}\ \text{${unit}}`,
    },
  );

  const delta = x0 - xInf;
  const pieces: TimePiece[] = [
    { power: 0, sigma: 0, omega: 0, a: xInf, b: 0 },
    { power: 0, sigma: -rate, omega: 0, a: delta, b: 0 },
  ].filter((p) => p.a !== 0);
  const tex = joinTerms(piecesLatexTerms(pieces, 't'));
  const tauForm = joinTerms(
    [
      { coef: xInf, body: '' },
      { coef: delta, body: `e^{-t/${n(tau)}}` },
    ].filter((term) => term.coef !== 0),
  );
  steps.push(
    {
      title: 'Respuesta completa',
      explanation:
        'Es la suma de la respuesta forzada (el valor final) y la natural, una exponencial que arranca en x(0⁺) − x(∞) y se extingue con la constante de tiempo.',
      formula: String.raw`${x}(t) = ${x}(\infty) + \left[${x}(0^{+}) - ${x}(\infty)\right]e^{-t/\tau}`,
      substitution: String.raw`${x}(t) = ${n(xInf)} + \left[${n(x0)} - (${n(xInf)})\right]e^{-t/${n(tau)}}`,
      result: String.raw`${x}(t) = ${tauForm} = ${tex}\ \text{${unit}},\quad t > 0`,
    },
    {
      title: 'Respuesta natural y forzada',
      result: String.raw`${x}_{f} = ${n(xInf)},\qquad ${x}_{n}(t) = ${joinTerms(
        piecesLatexTerms(
          pieces.filter((p) => p.sigma !== 0),
          't',
        ),
      )}`,
    },
  );

  // i_C = C dv_C/dt = (x∞ − x0)/R e^{−t/τ};  v_L = L di_L/dt = R(x∞ − x0) e^{−t/τ}.
  const otherAmplitude = profile.otherAmplitude(R, xInf - x0);
  const otherPieces: TimePiece[] =
    otherAmplitude === 0 ? [] : [{ power: 0, sigma: -rate, omega: 0, a: otherAmplitude, b: 0 }];
  const otherTex = joinTerms(piecesLatexTerms(otherPieces, 't'));
  steps.push({
    title: profile.otherTitle,
    explanation: profile.otherExplanation,
    formula: profile.otherFormula,
    result: String.raw`${other}(t) = ${otherTex}\ \text{${otherUnit}}`,
  });

  const energy0 = 0.5 * S * x0 ** 2;
  const energyInf = 0.5 * S * xInf ** 2;
  steps.push({
    title: 'Energía almacenada',
    formula: profile.energyFormula,
    result: String.raw`w(0^{+}) = ${n(energy0)}\ \text{J},\quad w(\infty) = ${n(energyInf)}\ \text{J}`,
  });

  const evaluate = (t: number) => xInf + delta * Math.exp(-t / tau);
  const evaluateOther = (t: number) => otherAmplitude * Math.exp(-t / tau);
  let atTime: FirstOrderValue['atTime'];
  if (input.time !== undefined) {
    const t = input.time;
    atTime = { t, x: evaluate(t), other: evaluateOther(t) };
    steps.push({
      title: `Valor en t = ${formatNumber(t, DIGITS)} s`,
      substitution: `${x}(${n(t)}) = ${n(xInf)} + (${n(delta)})e^{-${n(t)}/${n(tau)}}`,
      result: String.raw`${x}(${n(t)}) = ${n(atTime.x)}\ \text{${unit}},\quad ${other}(${n(t)}) = ${n(atTime.other)}\ \text{${otherUnit}}`,
    });
  }

  const table: ResultTable = {
    id: 'constantes-de-tiempo',
    title: 'Respuesta en múltiplos de τ',
    columns: [
      { key: 't', header: 't' },
      { key: 'tau', header: String.raw`t/\tau` },
      { key: 'x', header: `${x}(t)` },
      { key: 'avance', header: String.raw`\text{Cambio completado (\%)}` },
    ],
    rows: [0, 1, 2, 3, 4, 5].map((k) => ({
      t: k * tau,
      tau: k,
      x: evaluate(k * tau),
      avance: 100 * (1 - Math.exp(-k)),
    })),
  };

  const tEnd = Math.max(5 * tau, input.time ?? 0);
  const samples = 400;
  const points = Array.from({ length: samples + 1 }, (_, k) => {
    const t = (tEnd * k) / samples;
    return { x: t, y: evaluate(t) };
  });
  const series: Series[] = [
    {
      id: 'estado',
      title: `${profile.seriesTitle} y valor final`,
      xLabel: 't (s)',
      yLabel: `${x} (${unit})`,
      label: `${x}(t)`,
      points,
      others: [
        {
          label: `${x}(∞)`,
          points: [
            { x: 0, y: xInf },
            { x: tEnd, y: xInf },
          ],
        },
      ],
    },
  ];

  return {
    ok: true,
    value: { tau, tex, otherTex, atTime },
    summary: [
      { label: 'τ', value: String.raw`${n(tau)}\ \text{s}` },
      { label: x, value: String.raw`${x}(t) = ${tex}\ \text{${unit}}`, emphasis: true },
      { label: other, value: String.raw`${other}(t) = ${otherTex}\ \text{${otherUnit}}` },
      ...(atTime
        ? [
            {
              label: `${x}(t₁)`,
              value: String.raw`${x}(${n(atTime.t)}) = ${n(atTime.x)}\ \text{${unit}}`,
            },
          ]
        : []),
    ],
    steps,
    tables: [table],
    series,
    notices: [],
  };
}

export const respuestaPrimerOrden: Calculator<FirstOrderInput, FirstOrderValue, never> = {
  meta: {
    id: 'respuesta-primer-orden',
    title: 'Circuitos de primer orden (RC y RL)',
    summary: 'Constante de tiempo, respuesta natural, forzada y completa de un circuito RC o RL.',
    citations: [
      {
        sourceId: 'hayt-kemmerly-1993',
        locator: '8.ª ed. en inglés, cap. 8, ejemplos 8.2, 8.7, 8.8 y 8.10',
      },
    ],
  },
  inputSchema,
  // Hayt, ejemplo 8.10: R_eq = 24 Ω, C = 50 mF, v_C(0) = 100 V y v_C(∞) = 20 V.
  example: { circuit: 'rc', resistance: 24, storage: 0.05, initial: 100, final: 20, time: 1.2 },
  solve: solveFirstOrder,
};
