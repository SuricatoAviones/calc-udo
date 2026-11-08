/**
 * Amplificador en emisor común polarizado por divisor de voltaje, con la resistencia de emisor
 * partida: R_E1 sin puentear (estabiliza la ganancia) y R_E2 puenteada por C_E.
 *
 * Cd: divisor exacto o aproximado con R_E = R_E1 + R_E2 (Boylestad y Nashelsky, 10.ª ed. en
 * español, sec. 4.5). Ca: modelo r_e con r_e = V_T/I_E, Z_b = βr_e + (β + 1)R_E1,
 * Z_i = R₁ ∥ R₂ ∥ Z_b, Z_o = R_C, A_v = −β(R_C ∥ R_L)/Z_b (sec. 5.6, 5.7 y 5.13, fig. 5.36).
 * Excursión: recta de carga de ca con r_c = R_C ∥ R_L y salida máxima sin recorte
 * MPP = 2·mín(I_CQ·r_c, V_CEQ) (Malvino, 6.ª ed. en español, sec. 11-2, ecs. 11-4 y 11-5). Con
 * R_E1 sin puentear la saturación llega antes: el colector solo baja V_CEQ·r_c/(r_c + R_E1).
 */
import { z } from 'zod';
import { toLatexNumber, TEX } from '@/lib/math/format';
import type { Calculator, CalculatorResult, Notice, Series, Step, SummaryItem } from '../types';
import { bjtBias } from '../electronica/bias';
import { approxAmplifier } from '../electronica/small-signal';
import { engTex, engText, parallel } from '../electronica/units';

const n = (v: number, d = 6) => toLatexNumber(v, d);

const finite = (what: string) =>
  z.number({ error: `Escribe ${what}.` }).refine(Number.isFinite, `Escribe ${what}.`);
const positive = (what: string) =>
  finite(what).refine((v) => v > 0, `${what} debe ser mayor que 0.`);
const nonNegative = (what: string) =>
  finite(what).refine((v) => v >= 0, `${what} no puede ser negativo.`);
const optionalPositive = (what: string) =>
  z
    .number({ error: `Escribe ${what} o deja el campo vacío.` })
    .positive(`${what} debe ser mayor que 0.`)
    .optional();

const inputSchema = z
  .object({
    vcc: positive('V_CC'),
    r1: positive('R₁'),
    r2: positive('R₂'),
    rc: positive('R_C'),
    re1: nonNegative('R_E1'),
    re2: nonNegative('R_E2'),
    beta: positive('β'),
    vbe: nonNegative('V_BE'),
    method: z.enum(['exacto', 'aproximado']),
    vt: positive('V_T'),
    ro: optionalPositive('r_o'),
    rl: optionalPositive('R_L'),
    rs: optionalPositive('R_s'),
    vin: optionalPositive('la señal de entrada'),
  })
  .superRefine((v, ctx) => {
    if (v.re1 + v.re2 <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['re2'],
        message: 'El amplificador necesita resistencia de emisor (R_E1 + R_E2 > 0).',
      });
    }
  });

export type CeAmplifierInput = z.infer<typeof inputSchema>;

export interface CeAmplifierValue {
  ic: number;
  ie: number;
  vce: number;
  region: 'activa' | 'saturacion' | 'corte';
  re: number;
  zi: number;
  zo: number;
  av: number;
  avNL: number;
  avs?: number;
  ai: number;
  rcAc: number;
  mpp: number;
  vout?: number;
}

export type CeAmplifierErrorCode = 'sin-region-activa';

const INACTIVE_MESSAGE = {
  corte: 'El transistor está en corte: no hay amplificación. Revisa el divisor de voltaje.',
  saturacion: 'El transistor está saturado: no hay amplificación lineal. Reduce R_C o aumenta R_E.',
} as const;

/** Red de ca del modelo híbrido aproximado: h_ie = βr_e y R_E1 sin puentear si la hay. */
function acNetwork(input: CeAmplifierInput, re: number) {
  const { beta, r1, r2, rc, re1, rl } = input;
  return {
    config: re1 > 0 ? ('emisor-sin-puentear' as const) : ('emisor-comun' as const),
    h: { hi: beta * re, hr: 0, hf: beta, ho: input.ro === undefined ? 0 : 1 / input.ro },
    rin: parallel(r1, r2),
    rinTex: "R'",
    rc,
    re: re1,
    rl,
    rs: input.rs,
  };
}

/**
 * Excursión máxima sin recorte sobre la recta de carga de ca: hacia el corte la salida sube
 * I_CQ·r_c; hacia la saturación baja V_CEQ (parte queda en R_E1 sin puentear).
 */
function maxSwing(dc: { ic: number; vce: number }, rcAc: number, re1: number, withLoad: boolean) {
  const byCutoff = dc.ic * rcAc;
  const bySaturation = (dc.vce * rcAc) / (rcAc + re1);
  const mp = Math.min(byCutoff, bySaturation);
  const mpp = 2 * mp;
  const unbypassed = re1 > 0;
  const toSaturation = unbypassed
    ? ', v_CE solo puede bajar V_CEQ y parte de esa caída queda en R_E1'
    : ' puede bajar V_CEQ';
  const saturationTerm = unbypassed
    ? String.raw`V_{CEQ}\frac{r_c}{r_c + R_{E1}} = ${n(bySaturation)}`
    : `V_{CEQ} = ${n(dc.vce)}`;
  const step: Step = {
    title: 'Excursión máxima sin recorte',
    explanation: `La señal se mueve por la recta de carga de ca (r_c = ${withLoad ? 'R_C ∥ R_L' : 'R_C'}). Hacia el corte la salida puede subir I_CQ·r_c; hacia la saturación${toSaturation}. El pico máximo es el menor de los dos.`,
    formula: unbypassed
      ? String.raw`MP = \min\left(I_{CQ}r_c,\ V_{CEQ}\frac{r_c}{r_c + R_{E1}}\right),\qquad MPP = 2\,MP`
      : String.raw`MP = \min\left(I_{CQ}r_c,\ V_{CEQ}\right),\qquad MPP = 2\,MP`,
    substitution: String.raw`I_{CQ}r_c = (${n(dc.ic)})(${n(rcAc)}) = ${n(byCutoff)}\ \text{V},\quad ${saturationTerm}\ \text{V}`,
    result: String.raw`MP = ${n(mp)}\ \text{V},\quad MPP = ${n(mpp)}\ \text{V}`,
  };
  return { byCutoff, bySaturation, mp, mpp, step };
}

/** Dónde queda el punto Q respecto del centro de la recta de carga de ca. */
function centeringMessage(byCutoff: number, bySaturation: number): string {
  if (Math.abs(byCutoff - bySaturation) <= 0.1 * Math.max(byCutoff, bySaturation))
    return 'El punto Q está cerca del centro de la recta de carga de ca: la excursión es casi simétrica.';
  return byCutoff < bySaturation
    ? 'El punto Q está por debajo del centro de la recta de carga de ca: una señal grande se recorta primero por corte. Para centrarlo, aumenta I_CQ.'
    : 'El punto Q está por encima del centro de la recta de carga de ca: una señal grande se recorta primero por saturación. Para centrarlo, reduce I_CQ.';
}

/** Señal de salida pico a pico con la ganancia desde la fuente (o desde la base). */
function outputSignal(input: CeAmplifierInput, gain: number, vin: number, mpp: number) {
  const vout = Math.abs(gain) * vin;
  const fromSource = input.rs !== undefined;
  const step: Step = {
    title: 'Señal de salida',
    explanation: `Con ${engText(vin, 'V')} pico a pico ${fromSource ? 'en la fuente' : 'en la base'}.`,
    formula: fromSource
      ? String.raw`v_{o(pp)} = |A_{v_s}|\,v_{s(pp)}`
      : String.raw`v_{o(pp)} = |A_v|\,v_{i(pp)}`,
    substitution: `v_{o(pp)} = (${n(Math.abs(gain))})(${n(vin)})`,
    result: String.raw`v_{o(pp)} = ${n(vout)}\ \text{V}\ ${vout <= mpp ? TEX.le : '>'}\ MPP`,
  };
  return { vout, step };
}

export function solveCeAmplifier(
  input: CeAmplifierInput,
): CalculatorResult<CeAmplifierValue, CeAmplifierErrorCode> {
  const { vcc, r1, r2, rc, re1, re2, beta, vbe, rl } = input;
  const steps: Step[] = [];
  const notices: Notice[] = [];
  const reDc = re1 + re2;

  steps.push({
    title: 'Análisis de cd',
    explanation: `Los capacitores son circuitos abiertos: para la polarización la resistencia de emisor es R_E1 + R_E2 = ${engText(reDc, 'Ω')}. Se usa el análisis ${input.method} del divisor de voltaje.`,
  });
  const dc = bjtBias({
    config: 'divisor',
    method: input.method,
    vcc,
    rb: 0,
    r1,
    r2,
    rc,
    re: reDc,
    beta,
    vbe,
  });
  steps.push(...dc.steps);
  if (dc.region !== 'activa') {
    const message = INACTIVE_MESSAGE[dc.region];
    return {
      ok: false,
      error: { code: 'sin-region-activa', message },
      steps,
      tables: [],
      series: [],
      notices: [{ level: 'error', message }],
    };
  }
  if (dc.approxValid === false) {
    notices.push({
      level: input.method === 'aproximado' ? 'warning' : 'info',
      message:
        'βR_E < 10R₂: el punto Q depende bastante de β. Para un diseño estable en cd conviene βR_E ≥ 10R₂.',
    });
  }

  const re = input.vt / dc.ie;
  steps.push(
    {
      title: 'Resistencia dinámica del emisor',
      explanation:
        'Con la corriente de emisor de cd se obtiene la resistencia de ca de la unión base-emisor.',
      formula: String.raw`r_e = \frac{V_T}{I_E}`,
      substitution: String.raw`r_e = \frac{${n(input.vt)}}{${n(dc.ie)}}`,
      result: String.raw`r_e = ${engTex(re, 'Ω')},\quad \beta r_e = ${engTex(beta * re, 'Ω')}`,
    },
    {
      title: 'Análisis de ca',
      explanation: `Para la señal, C_E cortocircuita R_E2${re1 > 0 ? ' y R_E1 queda sin puentear en el emisor' : ''}; R₁ y R₂ quedan en paralelo (R′ = ${engText(parallel(r1, r2), 'Ω')}).`,
    },
  );
  const ac = approxAmplifier(acNetwork(input, re));
  steps.push(...ac.steps);
  if (re1 > 0 && input.ro !== undefined) {
    notices.push({
      level: 'info',
      message: 'Con R_E1 sin puentear el modelo aproximado ignora r_o (Boylestad, sec. 5.7).',
    });
  }

  // Recta de carga de ca y excursión máxima (Malvino, sec. 11-2).
  const rcAc = rl === undefined ? rc : parallel(rc, rl);
  const swing = maxSwing(dc, rcAc, re1, rl !== undefined);
  steps.push(swing.step);
  const { byCutoff, bySaturation, mpp } = swing;
  notices.push({ level: 'info', message: centeringMessage(byCutoff, bySaturation) });

  let vout: number | undefined;
  if (input.vin !== undefined) {
    const output = outputSignal(input, ac.avs ?? ac.av, input.vin, mpp);
    vout = output.vout;
    steps.push(output.step);
    if (vout > mpp) {
      notices.push({
        level: 'warning',
        message: `La salida (${engText(vout, 'V')} pp) supera el MPP (${engText(mpp, 'V')}): se recortará.`,
      });
    }
  }

  const toMa = 1000;
  const acSat = dc.ic + dc.vce / (rcAc + re1);
  const acCut = dc.vce + dc.ic * (rcAc + re1);
  const series: Series = {
    id: 'rectas-de-carga',
    title: 'Rectas de carga de cd y de ca',
    xLabel: 'V_CE (V)',
    yLabel: 'I_C (mA)',
    label: 'Recta de cd',
    points: [
      { x: 0, y: dc.icSat * toMa },
      { x: vcc, y: 0 },
    ],
    others: [
      {
        label: 'Recta de ca',
        points: [
          { x: 0, y: acSat * toMa },
          { x: acCut, y: 0 },
        ],
      },
    ],
    scatter: { label: 'Punto Q', points: [{ x: dc.vce, y: dc.ic * toMa }] },
  };

  const summary: SummaryItem[] = [
    { label: 'I_CQ', value: engTex(dc.ic, 'A'), emphasis: true },
    { label: 'V_CEQ', value: String.raw`${n(dc.vce, 5)}\ \text{V}`, emphasis: true },
    { label: rl !== undefined ? 'A_vL' : 'A_v', value: n(ac.av, 5), emphasis: true },
    ...(ac.avs !== undefined ? [{ label: 'A_vs', value: n(ac.avs, 5) }] : []),
    { label: 'Z_i', value: engTex(ac.zi, 'Ω') },
    { label: 'Z_o', value: engTex(ac.zo, 'Ω') },
    { label: 'MPP', value: String.raw`${n(mpp, 5)}\ \text{V}` },
  ];

  return {
    ok: true,
    value: {
      ic: dc.ic,
      ie: dc.ie,
      vce: dc.vce,
      region: dc.region,
      re,
      zi: ac.zi,
      zo: ac.zo,
      av: ac.av,
      avNL: ac.avNL,
      avs: ac.avs,
      ai: ac.ai,
      rcAc,
      mpp,
      vout,
    },
    summary,
    steps,
    tables: [],
    series: [series],
    notices,
  };
}

export const amplificadorEmisorComun: Calculator<
  CeAmplifierInput,
  CeAmplifierValue,
  CeAmplifierErrorCode
> = {
  meta: {
    id: 'amplificador-emisor-comun',
    title: 'Amplificador emisor común',
    summary:
      'Punto Q por divisor de voltaje, r_e, impedancias y ganancia con R_E parcialmente puenteada, rectas de carga y máxima salida sin recorte.',
    citations: [
      {
        sourceId: 'boylestad-nashelsky-1997',
        locator: '10.ª ed. en español, sec. 4.5, 5.6, 5.7 y 5.13, ejemplos 5.2, 5.5 y 5.6',
      },
      { sourceId: 'malvino-1999', locator: 'Sec. 11-2, ejemplos 11-1 a 11-3' },
    ],
  },
  inputSchema,
  // Boylestad, ejemplo 5.2: divisor de voltaje con R_E puenteada y β = 90.
  example: {
    vcc: 22,
    r1: 56e3,
    r2: 8.2e3,
    rc: 6.8e3,
    re1: 0,
    re2: 1.5e3,
    beta: 90,
    vbe: 0.7,
    method: 'aproximado',
    vt: 0.026,
  },
  solve: solveCeAmplifier,
};
