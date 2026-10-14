/**
 * Respuesta de circuitos RLC (segundo orden) en serie y en paralelo, con fuente de cd que se
 * aplica en t = 0.
 *
 *   Paralelo: α = 1/(2RC)     Serie: α = R/(2L)      ω₀ = 1/√(LC)
 *   α > ω₀  sobreamortiguado:  x = x_f + A₁e^{s₁t} + A₂e^{s₂t},  s₁,₂ = −α ± √(α² − ω₀²)
 *   α = ω₀  crítico:           x = x_f + e^{−αt}(A₁t + A₂)
 *   α < ω₀  subamortiguado:    x = x_f + e^{−αt}(B₁ cos ω_d t + B₂ sen ω_d t),  ω_d = √(ω₀² − α²)
 *
 * Las constantes salen de x(0⁺) y dx/dt(0⁺), que se obtienen de v_C(0) e i_L(0) con LCK (paralelo)
 * o LVK (serie). Convención pasiva en los tres elementos: en el paralelo, v es el voltaje común e
 * i_L baja por el inductor; en la serie, i circula en sentido horario y v_C tiene su + por donde
 * entra i. La fuente es una corriente I_s que entra al nodo superior (paralelo) o un voltaje V_s
 * en serie (serie).
 *
 * Fuente: Hayt, Kemmerly y Durbin, 8.ª ed., cap. 9 (ejemplos 9.1, 9.2, 9.6, 9.7 y 9.10, y la
 * respuesta críticamente amortiguada de la fig. 9.11).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, Notice, Series, Step } from '../types';
import { joinTerms, piecesLatexTerms, type TimePiece } from './laplace';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

const finite = (what: string) =>
  z.number({ error: `Escribe ${what}.` }).refine(Number.isFinite, `Escribe ${what}.`);
const positive = (what: string) =>
  finite(what).refine((v) => v > 0, `${what} debe ser mayor que 0.`);

const inputSchema = z.object({
  circuit: z.enum(['paralelo', 'serie']),
  resistance: positive('R'),
  inductance: positive('L'),
  capacitance: positive('C'),
  mode: z.enum(['elementos', 'general']),
  vC0: finite('v_C(0)'),
  iL0: finite('i_L(0)'),
  source: finite('el valor de la fuente'),
  x0: finite('x(0)'),
  dx0: finite("x'(0)"),
  xInf: finite('x(∞)'),
  time: z.number().min(0, 'El instante debe ser t ≥ 0.').optional(),
});

export type SecondOrderInput = z.infer<typeof inputSchema>;

export type Damping = 'sobreamortiguado' | 'critico' | 'subamortiguado';

export interface ResponseValue {
  name: string;
  unit: string;
  x0: number;
  dx0: number;
  xInf: number;
  /** A₁, A₂ (sobre y crítico) o B₁, B₂ (sub). */
  constants: [number, number];
  tex: string;
  pieces: TimePiece[];
  atTime?: number;
}

export interface SecondOrderValue {
  alpha: number;
  omega0: number;
  damping: Damping;
  /** Raíces: reales s₁, s₂ o −α ± jω_d. */
  roots: { s1: number; s2: number } | { sigma: number; omegaD: number };
  responses: ResponseValue[];
}

export type SecondOrderErrorCode = never;

interface Natural {
  alpha: number;
  omega0: number;
  damping: Damping;
  s1: number;
  s2: number;
  omegaD: number;
}

function classify(alpha: number, omega0: number): Natural {
  const relative = (alpha - omega0) / omega0;
  if (Math.abs(relative) <= 1e-9) {
    return { alpha, omega0, damping: 'critico', s1: -alpha, s2: -alpha, omegaD: 0 };
  }
  if (alpha > omega0) {
    const root = Math.sqrt(alpha ** 2 - omega0 ** 2);
    return {
      alpha,
      omega0,
      damping: 'sobreamortiguado',
      s1: -alpha + root,
      s2: -alpha - root,
      omegaD: 0,
    };
  }
  return {
    alpha,
    omega0,
    damping: 'subamortiguado',
    s1: -alpha,
    s2: -alpha,
    omegaD: Math.sqrt(omega0 ** 2 - alpha ** 2),
  };
}

function response(
  natural: Natural,
  name: string,
  unit: string,
  x0: number,
  dx0: number,
  xInf: number,
  derivation: Step,
  time: number | undefined,
): { value: ResponseValue; step: Step } {
  const { alpha, s1, s2, omegaD, damping } = natural;
  const d = x0 - xInf;
  const children: Step[] = [derivation];
  let constants: [number, number];
  let pieces: TimePiece[];
  if (damping === 'sobreamortiguado') {
    const A1 = (dx0 - s2 * d) / (s1 - s2);
    const A2 = d - A1;
    constants = [A1, A2];
    pieces = [
      { power: 0, sigma: s1, omega: 0, a: A1, b: 0 },
      { power: 0, sigma: s2, omega: 0, a: A2, b: 0 },
    ];
    children.push({
      title: 'Constantes A₁ y A₂',
      explanation: 'Se evalúan x(t) y su derivada en t = 0⁺ y se resuelve el sistema.',
      formula: `\\begin{cases} A_1 + A_2 = x(0^{+}) - x_f \\\\ s_1A_1 + s_2A_2 = x'(0^{+}) \\end{cases}`,
      substitution: `\\begin{cases} A_1 + A_2 = ${n(d)} \\\\ ${n(s1)}A_1 + (${n(s2)})A_2 = ${n(dx0)} \\end{cases}`,
      result: `A_1 = ${n(A1)},\\quad A_2 = ${n(A2)}`,
    });
  } else if (damping === 'critico') {
    const A2 = d;
    const A1 = dx0 + alpha * A2;
    constants = [A1, A2];
    pieces = [
      { power: 1, sigma: -alpha, omega: 0, a: A1, b: 0 },
      { power: 0, sigma: -alpha, omega: 0, a: A2, b: 0 },
    ];
    children.push({
      title: 'Constantes A₁ y A₂',
      formula: `A_2 = x(0^{+}) - x_f,\\qquad A_1 - \\alpha A_2 = x'(0^{+})`,
      substitution: `A_2 = ${n(d)},\\qquad A_1 = ${n(dx0)} + (${n(alpha)})(${n(A2)})`,
      result: `A_1 = ${n(A1)},\\quad A_2 = ${n(A2)}`,
    });
  } else {
    const B1 = d;
    const B2 = (dx0 + alpha * B1) / omegaD;
    constants = [B1, B2];
    pieces = [{ power: 0, sigma: -alpha, omega: omegaD, a: B1, b: B2 }];
    children.push({
      title: 'Constantes B₁ y B₂',
      formula: `B_1 = x(0^{+}) - x_f,\\qquad -\\alpha B_1 + \\omega_d B_2 = x'(0^{+})`,
      substitution: `B_1 = ${n(d)},\\qquad B_2 = \\frac{${n(dx0)} + (${n(alpha)})(${n(B1)})}{${n(omegaD)}}`,
      result: `B_1 = ${n(B1)},\\quad B_2 = ${n(B2)}`,
    });
  }
  const all: TimePiece[] = [
    ...(xInf !== 0 ? [{ power: 0, sigma: 0, omega: 0, a: xInf, b: 0 }] : []),
    ...pieces,
  ].filter((p) => p.a !== 0 || p.b !== 0);
  const tex = joinTerms(piecesLatexTerms(all, 't'));
  const evaluate = (t: number) =>
    all.reduce(
      (s, p) =>
        s +
        t ** p.power *
          Math.exp(p.sigma * t) *
          (p.a * Math.cos(p.omega * t) + p.b * Math.sin(p.omega * t)),
      0,
    );
  const atTime = time === undefined ? undefined : evaluate(time);
  children.push({
    title: 'Respuesta',
    result: `${name}(t) = ${tex}\\ \\text{${unit}}${atTime === undefined ? '' : `,\\quad ${name}(${n(time!)}) = ${n(atTime)}\\ \\text{${unit}}`}`,
  });
  return {
    value: { name, unit, x0, dx0, xInf, constants, tex, pieces: all, atTime },
    step: { title: `Respuesta ${name}(t)`, children },
  };
}

export function solveSecondOrder(
  input: SecondOrderInput,
): CalculatorResult<SecondOrderValue, SecondOrderErrorCode> {
  const { resistance: R, inductance: L, capacitance: Cap } = input;
  const parallel = input.circuit === 'paralelo';
  const alpha = parallel ? 1 / (2 * R * Cap) : R / (2 * L);
  const omega0 = 1 / Math.sqrt(L * Cap);
  const natural = classify(alpha, omega0);
  const steps: Step[] = [];
  const notices: Notice[] = [];

  steps.push({
    title: parallel ? 'Circuito RLC en paralelo' : 'Circuito RLC en serie',
    explanation: parallel
      ? 'v es el voltaje común (+ arriba) e i_L baja por el inductor. La fuente de cd I_s, si la hay, entra al nodo superior a partir de t = 0.'
      : 'i circula en sentido horario por los tres elementos y v_C tiene su + por donde entra i. La fuente de cd V_s, si la hay, está en serie a partir de t = 0.',
    formula: parallel
      ? 'C\\frac{d^{2}v}{dt^{2}} + \\frac{1}{R}\\frac{dv}{dt} + \\frac{1}{L}v = 0'
      : 'L\\frac{d^{2}i}{dt^{2}} + R\\frac{di}{dt} + \\frac{1}{C}i = 0',
  });
  steps.push({
    title: 'Frecuencias α y ω₀',
    formula: parallel
      ? '\\alpha = \\frac{1}{2RC},\\qquad \\omega_0 = \\frac{1}{\\sqrt{LC}}'
      : '\\alpha = \\frac{R}{2L},\\qquad \\omega_0 = \\frac{1}{\\sqrt{LC}}',
    substitution: parallel
      ? `\\alpha = \\frac{1}{2(${n(R)})(${n(Cap)})},\\qquad \\omega_0 = \\frac{1}{\\sqrt{(${n(L)})(${n(Cap)})}}`
      : `\\alpha = \\frac{${n(R)}}{2(${n(L)})},\\qquad \\omega_0 = \\frac{1}{\\sqrt{(${n(L)})(${n(Cap)})}}`,
    result: `\\alpha = ${n(alpha)}\\ \\text{s}^{-1},\\quad \\omega_0 = ${n(omega0)}\\ \\text{rad/s}`,
  });

  const dampingText = {
    sobreamortiguado: 'α > ω₀: respuesta sobreamortiguada (dos exponenciales reales).',
    critico: 'α = ω₀: amortiguamiento crítico (raíz doble).',
    subamortiguado: 'α < ω₀: respuesta subamortiguada (senoide amortiguada).',
  }[natural.damping];
  steps.push({
    title: 'Tipo de respuesta',
    explanation: `${dampingText} Razón de amortiguamiento ζ = α/ω₀ = ${formatNumber(alpha / omega0, DIGITS)}.`,
    formula: 's_{1,2} = -\\alpha \\pm \\sqrt{\\alpha^{2} - \\omega_0^{2}}',
    result:
      natural.damping === 'sobreamortiguado'
        ? `s_1 = ${n(natural.s1)},\\quad s_2 = ${n(natural.s2)}`
        : natural.damping === 'critico'
          ? `s_1 = s_2 = -\\alpha = ${n(-alpha)}`
          : `s_{1,2} = ${n(-alpha)} \\pm j${n(natural.omegaD)},\\quad \\omega_d = \\sqrt{\\omega_0^{2} - \\alpha^{2}} = ${n(natural.omegaD)}\\ \\text{rad/s}`,
  });
  if (natural.damping !== 'critico' && Math.abs(alpha - omega0) / omega0 < 1e-3) {
    notices.push({
      level: 'info',
      message:
        'α y ω₀ son casi iguales: la respuesta es prácticamente la de amortiguamiento crítico (Hayt, sec. 9.3).',
    });
  }
  const form = {
    sobreamortiguado: 'x(t) = x_f + A_1e^{s_1t} + A_2e^{s_2t}',
    critico: 'x(t) = x_f + e^{-\\alpha t}(A_1t + A_2)',
    subamortiguado: 'x(t) = x_f + e^{-\\alpha t}(B_1\\cos\\omega_dt + B_2\\sin\\omega_dt)',
  }[natural.damping];
  steps.push({
    title: 'Forma de la respuesta',
    explanation:
      'x_f es la respuesta forzada (valor final con cd); el resto es la respuesta natural, con dos constantes que fijan las condiciones iniciales.',
    formula: form,
  });

  const responses: ResponseValue[] = [];
  const time = input.time;
  if (input.mode === 'general') {
    const derivation: Step = {
      title: 'Condiciones iniciales y valor final',
      result: `x(0^{+}) = ${n(input.x0)},\\quad x'(0^{+}) = ${n(input.dx0)},\\quad x_f = ${n(input.xInf)}`,
    };
    const r = response(natural, 'x', '', input.x0, input.dx0, input.xInf, derivation, time);
    responses.push(r.value);
    steps.push(r.step);
  } else if (parallel) {
    const { vC0, iL0, source: Is } = input;
    const dv0 = (Is - iL0 - vC0 / R) / Cap;
    const v = response(
      natural,
      'v',
      'V',
      vC0,
      dv0,
      0,
      {
        title: 'Condiciones iniciales (LCK en t = 0⁺)',
        explanation:
          'v(0⁺) = v_C(0) porque el voltaje del capacitor no cambia de golpe. La derivada sale de la corriente del capacitor: i_C = I_s − i_L − v/R. Con cd, en t → ∞ el inductor es un corto: v_f = 0.',
        formula: "v'(0^{+}) = \\frac{i_C(0^{+})}{C} = \\frac{I_s - i_L(0) - v(0)/R}{C}",
        substitution: `v'(0^{+}) = \\frac{${n(Is)} - (${n(iL0)}) - (${n(vC0)})/${n(R)}}{${n(Cap)}}`,
        result: `v(0^{+}) = ${n(vC0)},\\quad v'(0^{+}) = ${n(dv0)}\\ \\text{V/s},\\quad v_f = 0`,
      },
      time,
    );
    const diL0 = vC0 / L;
    const i = response(
      natural,
      'i_L',
      'A',
      iL0,
      diL0,
      Is,
      {
        title: 'Condiciones iniciales del inductor',
        explanation:
          'i_L(0⁺) = i_L(0) porque la corriente del inductor no cambia de golpe; su derivada es v/L. En t → ∞ toda la corriente de la fuente pasa por el inductor.',
        formula: "i_L'(0^{+}) = \\frac{v(0^{+})}{L}",
        substitution: `i_L'(0^{+}) = \\frac{${n(vC0)}}{${n(L)}}`,
        result: `i_L(0^{+}) = ${n(iL0)},\\quad i_L'(0^{+}) = ${n(diL0)}\\ \\text{A/s},\\quad i_{L,f} = ${n(Is)}`,
      },
      time,
    );
    responses.push(v.value, i.value);
    steps.push(v.step, i.step);
  } else {
    const { vC0, iL0, source: Vs } = input;
    const di0 = (Vs - R * iL0 - vC0) / L;
    const i = response(
      natural,
      'i',
      'A',
      iL0,
      di0,
      0,
      {
        title: 'Condiciones iniciales (LVK en t = 0⁺)',
        explanation:
          'i(0⁺) = i_L(0) porque la corriente del inductor no cambia de golpe. La derivada sale del voltaje del inductor: v_L = V_s − Ri − v_C. Con cd, en t → ∞ el capacitor es un abierto: i_f = 0.',
        formula: "i'(0^{+}) = \\frac{v_L(0^{+})}{L} = \\frac{V_s - R\\,i(0) - v_C(0)}{L}",
        substitution: `i'(0^{+}) = \\frac{${n(Vs)} - (${n(R)})(${n(iL0)}) - (${n(vC0)})}{${n(L)}}`,
        result: `i(0^{+}) = ${n(iL0)},\\quad i'(0^{+}) = ${n(di0)}\\ \\text{A/s},\\quad i_f = 0`,
      },
      time,
    );
    const dvC0 = iL0 / Cap;
    const v = response(
      natural,
      'v_C',
      'V',
      vC0,
      dvC0,
      Vs,
      {
        title: 'Condiciones iniciales del capacitor',
        explanation:
          'v_C(0⁺) = v_C(0); su derivada es i/C. En t → ∞ el capacitor queda cargado al voltaje de la fuente.',
        formula: "v_C'(0^{+}) = \\frac{i(0^{+})}{C}",
        substitution: `v_C'(0^{+}) = \\frac{${n(iL0)}}{${n(Cap)}}`,
        result: `v_C(0^{+}) = ${n(vC0)},\\quad v_C'(0^{+}) = ${n(dvC0)}\\ \\text{V/s},\\quad v_{C,f} = ${n(Vs)}`,
      },
      time,
    );
    responses.push(i.value, v.value);
    steps.push(i.step, v.step);
  }

  // Gráfica: unas cinco constantes de tiempo de la envolvente (o tres periodos de ω_d).
  const slowest =
    natural.damping === 'sobreamortiguado' ? Math.abs(natural.s1) : Math.max(alpha, 1e-12);
  let tEnd = 5 / slowest;
  if (natural.damping === 'subamortiguado')
    tEnd = Math.min(tEnd, (8 * 2 * Math.PI) / natural.omegaD);
  if (natural.damping === 'subamortiguado')
    tEnd = Math.max(tEnd, (2 * 2 * Math.PI) / natural.omegaD);
  if (time !== undefined) tEnd = Math.max(tEnd, time);
  const samples = 500;
  const series: Series[] = responses.map((r) => ({
    id: `respuesta-${r.name}`,
    title: `${r.name}(t)`,
    xLabel: 't (s)',
    yLabel: r.unit ? `${r.name} (${r.unit})` : r.name,
    points: Array.from({ length: samples + 1 }, (_, k) => {
      const t = (tEnd * k) / samples;
      const y = r.pieces.reduce(
        (s, p) =>
          s +
          t ** p.power *
            Math.exp(p.sigma * t) *
            (p.a * Math.cos(p.omega * t) + p.b * Math.sin(p.omega * t)),
        0,
      );
      return { x: t, y };
    }),
  }));

  return {
    ok: true,
    value: {
      alpha,
      omega0,
      damping: natural.damping,
      roots:
        natural.damping === 'subamortiguado'
          ? { sigma: -alpha, omegaD: natural.omegaD }
          : { s1: natural.s1, s2: natural.s2 },
      responses,
    },
    summary: [
      { label: 'α', value: `${n(alpha)}\\ \\text{s}^{-1}` },
      { label: 'ω₀', value: `${n(omega0)}\\ \\text{rad/s}` },
      {
        label: 'Tipo',
        value: `\\text{${{ sobreamortiguado: 'sobreamortiguado', critico: 'críticamente amortiguado', subamortiguado: 'subamortiguado' }[natural.damping]}}`,
      },
      ...responses.map((r, i) => ({
        label: `${r.name}(t)`,
        value: `${r.name}(t) = ${r.tex}${r.unit ? `\\ \\text{${r.unit}}` : ''}`,
        emphasis: i === 0,
      })),
    ],
    steps,
    tables: [],
    series,
    notices,
  };
}

export const respuestaSegundoOrden: Calculator<
  SecondOrderInput,
  SecondOrderValue,
  SecondOrderErrorCode
> = {
  meta: {
    id: 'respuesta-segundo-orden',
    title: 'Circuitos de segundo orden (RLC)',
    summary:
      'Respuesta sobreamortiguada, críticamente amortiguada o subamortiguada de un RLC en serie o en paralelo.',
    citations: [
      {
        sourceId: 'hayt-kemmerly-1993',
        locator: '8.ª ed. en inglés, cap. 9, ejemplos 9.1, 9.2, 9.6, 9.7 y 9.10',
      },
    ],
  },
  inputSchema,
  // Hayt, ejemplo 9.2: RLC paralelo con R = 200 Ω, L = 5 mH, C = 20 nF, v_C(0) = 60 V e
  // i_L(0) = −0.3 A.
  example: {
    circuit: 'paralelo',
    resistance: 200,
    inductance: 0.005,
    capacitance: 2e-8,
    mode: 'elementos',
    vC0: 60,
    iL0: -0.3,
    source: 0,
    x0: 0,
    dx0: 0,
    xInf: 0,
  },
  solve: solveSecondOrder,
};
