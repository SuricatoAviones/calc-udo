/**
 * Fuente de alimentación regulada por Zener, sección por sección: transformador, rectificador,
 * filtro con condensador (con resistencia de drenaje opcional) y regulador Zener con su
 * resistencia R_Z. Calcula las tensiones de cada sección, el rizado antes y después del regulador
 * y comprueba el punto límite de funcionamiento.
 *
 * Fuente: Malvino, 6.ª ed. en español, sec. 4-6 (ec. 4-10) y 5-2 a 5-4 (ejemplos 5-8 a 5-11; el
 * ejemplo 5-9 analiza esta misma fuente con un puente, 270 µF, 390 Ω, R_S = 270 Ω y un Zener de
 * 10 V con R_Z = 8.5 Ω).
 */
import { z } from 'zod';
import { toLatexNumber, TEX } from '@/lib/math/format';
import type {
  Calculator,
  CalculatorResult,
  Notice,
  ResultTable,
  Series,
  Step,
  SummaryItem,
} from '../types';
import { RECTIFIER_NAME, rectify, transformer } from '../electronica/rectifier';
import { engTex, engText } from '../electronica/units';
import { maxSeriesResistance, zenerFixed, zenerRipple } from '../electronica/zener';

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

const inputSchema = z.object({
  v1rms: positive('V₁(rms)'),
  ratio: positive('la relación de espiras'),
  f: positive('la frecuencia'),
  rectifier: z.enum(['media-onda', 'derivacion-central', 'puente']),
  vk: nonNegative('V_K'),
  c: positive('C'),
  bleeder: optionalPositive('la resistencia de drenaje'),
  rs: positive('R_S'),
  vz: positive('V_Z'),
  rz: optionalPositive('R_Z'),
  pzm: optionalPositive('P_ZM'),
  rl: positive('R_L'),
});

export type ZenerSupplyInput = z.infer<typeof inputSchema>;

export interface ZenerSupplyValue {
  vp2: number;
  /** Pico a la salida del rectificador (carga del condensador). */
  vp: number;
  /** Corriente que entrega el condensador: drenaje + R_S. */
  idc: number;
  vrpp: number;
  vdc: number;
  vmin: number;
  zenerOn: boolean;
  vl: number;
  iz: number;
  pz: number;
  vrOut?: number;
  rsMax: number;
  regulates: boolean;
}

export type ZenerSupplyErrorCode = 'sin-tension';

/**
 * Corriente que descarga el condensador entre picos, estimada con la tensión de pico (Malvino,
 * ejemplo 5-9): la de la resistencia de drenaje, si la hay, más la de la rama R_S–Zener–carga.
 */
function filterCurrent(input: ZenerSupplyInput, vp: number): { idc: number; step: Step } {
  const { rs, vz, rl, bleeder } = input;
  const zenerAtPeak = (vp * rl) / (rs + rl) >= vz;
  const is = zenerAtPeak ? (vp - vz) / rs : vp / (rs + rl);
  const ib = bleeder === undefined ? 0 : vp / bleeder;
  const idc = is + ib;
  const withBleeder = bleeder !== undefined;
  const bleederFormula = withBleeder ? [String.raw`I_{dren} = \frac{V_p}{R_{dren}}`] : [];
  const bleederSubstitution = withBleeder
    ? [String.raw`I_{dren} = \frac{${n(vp)}}{${n(bleeder)}}`]
    : [];
  const bleederResult = withBleeder ? String.raw`I_{dren} = ${engTex(ib, 'A')},\quad ` : '';
  const zenerNote = zenerAtPeak
    ? ''
    : ' Con el pico, el Zener no alcanza la ruptura: la rama es R_S en serie con R_L.';
  return {
    idc,
    step: {
      title: 'Sección 3: filtro (corriente que entrega el condensador)',
      explanation: `Se estima con la tensión de pico, como en Malvino (ejemplo 5-9): ${
        withBleeder ? 'la resistencia de drenaje y ' : ''
      }la rama R_S–Zener–carga descargan el condensador entre picos.${zenerNote}`,
      formula: [
        ...bleederFormula,
        zenerAtPeak
          ? String.raw`I_S = \frac{V_p - V_Z}{R_S}`
          : String.raw`I_S = \frac{V_p}{R_S + R_L}`,
        `I = ${withBleeder ? 'I_{dren} + ' : ''}I_S`,
      ].join(String.raw`,\qquad `),
      substitution: [
        ...bleederSubstitution,
        zenerAtPeak
          ? String.raw`I_S = \frac{${n(vp)} - ${n(vz)}}{${n(rs)}}`
          : String.raw`I_S = \frac{${n(vp)}}{${n(rs)} + ${n(rl)}}`,
      ].join(String.raw`,\qquad `),
      result: String.raw`${bleederResult}I_S = ${engTex(is, 'A')},\quad I = ${engTex(idc, 'A')}`,
    },
  };
}

/**
 * Rizado de salida: con R_Z, el divisor R_Z–R_S; sin R_Z, el Zener ideal lo elimina; con el
 * Zener apagado, el divisor R_S–R_L.
 */
function outputRipple(
  input: ZenerSupplyInput,
  on: boolean,
  vrpp: number,
): { vrOut?: number; step?: Step; notice?: Notice } {
  const { rs, rl } = input;
  if (!on) return { vrOut: (rl / (rs + rl)) * vrpp };
  if (input.rz === undefined) {
    return {
      notice: {
        level: 'info',
        message:
          'Sin R_Z el Zener ideal elimina todo el rizado. Escribe R_Z (hoja de datos) para estimar el rizado de salida.',
      },
    };
  }
  const rip = zenerRipple(vrpp, rs, input.rz, rl);
  return { vrOut: rip.approx, step: rip.step };
}

/** Potencia del Zener con carga y en el peor caso: la carga desconectada y la fuente en su pico. */
function zenerPowerCheck(input: ZenerSupplyInput, pzm: number, pz: number, vp: number) {
  const { vz, rs } = input;
  const notices: Notice[] = [];
  if (pz > pzm) {
    notices.push({
      level: 'warning',
      message: `P_Z = ${engText(pz, 'W')} supera la potencia nominal (${engText(pzm, 'W')}). Con la carga abierta sería aún mayor.`,
    });
  }
  const pzOpen = vz * ((vp - vz) / rs);
  const step: Step = {
    title: 'Potencia del Zener sin carga',
    explanation: 'Si se desconecta la carga, toda la corriente de R_S pasa por el Zener.',
    formula: String.raw`P_{Z(max)} \approx V_Z\frac{V_p - V_Z}{R_S}`,
    substitution: String.raw`P_{Z(max)} \approx (${n(vz)})\frac{${n(vp)} - ${n(vz)}}{${n(rs)}}`,
    result: String.raw`P_{Z(max)} \approx ${engTex(pzOpen, 'W')}\ ${pzOpen <= pzm ? TEX.le : '>'}\ P_{ZM} = ${engTex(pzm, 'W')}`,
  };
  if (pzOpen > pzm && pz <= pzm) {
    notices.push({
      level: 'warning',
      message: 'Sin carga, el Zener disiparía más que su potencia nominal.',
    });
  }
  return { step, notices };
}

export function solveZenerSupply(
  input: ZenerSupplyInput,
): CalculatorResult<ZenerSupplyValue, ZenerSupplyErrorCode> {
  const steps: Step[] = [];
  const notices: Notice[] = [];
  const { rs, vz, rl } = input;

  const tr = transformer(input.v1rms, input.ratio);
  steps.push(
    {
      title: 'Sección 1: transformador',
      explanation: `Reduce la tensión de la red (${engText(input.v1rms, 'V')} rms, ${engText(input.f, 'Hz')}) con una relación ${n(input.ratio, 4)}:1.`,
    },
    ...tr.steps,
  );

  const rect = rectify(tr.vp2, input.rectifier, input.vk, input.f);
  steps.push(
    {
      title: 'Sección 2: rectificador',
      explanation: `${RECTIFIER_NAME[input.rectifier][0]!.toUpperCase()}${RECTIFIER_NAME[input.rectifier].slice(1)}: convierte la alterna en pulsos de una sola polaridad con frecuencia ${engText(rect.fOut, 'Hz')}.`,
    },
    rect.step,
  );
  const vp = rect.vpOut;
  if (vp <= 0) {
    const message =
      'El pico del secundario no supera las caídas de los diodos: la fuente no entrega tensión.';
    return {
      ok: false,
      error: { code: 'sin-tension', message },
      steps,
      tables: [],
      series: [],
      notices: [{ level: 'error', message }],
    };
  }

  // Corriente que descarga el condensador entre picos (Malvino, ejemplo 5-9): drenaje + R_S.
  const filter = filterCurrent(input, vp);
  const idc = filter.idc;
  steps.push(filter.step);

  const vrpp = idc / (rect.fOut * input.c);
  const vmin = vp - vrpp;
  const vdc = vp - vrpp / 2;
  steps.push({
    title: 'Rizado y tensión de cd del filtro',
    explanation: `El condensador se descarga durante 1/f_r = ${engText(1 / rect.fOut, 's')} entre picos (Malvino, ec. 4-10). La tensión oscila entre V_p y V_p − V_r(pp).`,
    formula: String.raw`V_{r(pp)} = \frac{I}{f_r C},\qquad V_{cd} \approx V_p - \frac{V_{r(pp)}}{2},\qquad V_{min} = V_p - V_{r(pp)}`,
    substitution: String.raw`V_{r(pp)} = \frac{${n(idc)}}{(${n(rect.fOut)})(${n(input.c)})}`,
    result: String.raw`V_{r(pp)} = ${n(vrpp)}\ \text{V},\quad V_{cd} = ${n(vdc)}\ \text{V},\quad V_{min} = ${n(vmin)}\ \text{V}`,
  });
  if (vrpp > 0.25 * vp) {
    notices.push({
      level: 'warning',
      message: `El rizado (${engText(vrpp, 'V')} pp) es grande frente al pico: la estimación es solo aproximada. Aumenta C.`,
    });
  }

  steps.push({
    title: 'Sección 4: regulador Zener',
    explanation: `Con la tensión media del filtro (${engText(vdc, 'V')}) se determina el estado del Zener y sus corrientes.`,
  });
  const zr = zenerFixed(vdc, rs, rl, vz, input.rz ?? 0);
  steps.push(...zr.steps);
  const ripple = outputRipple(input, zr.on, vrpp);
  const vrOut = ripple.vrOut;
  if (ripple.step) steps.push(ripple.step);
  if (ripple.notice) notices.push(ripple.notice);

  const dropout = maxSeriesResistance(vmin, vz, rl);
  const regulates = vmin > vz && rs <= dropout.rsMax;
  steps.push(dropout.step, {
    title: 'Comprobación del diseño',
    explanation: regulates
      ? `R_S = ${engText(rs, 'Ω')} ≤ R_S(máx): el Zener sigue en ruptura incluso en el valle del rizado (V_min = ${engText(vmin, 'V')}).`
      : `R_S = ${engText(rs, 'Ω')} supera R_S(máx) o V_min no alcanza V_Z: en el valle del rizado el Zener sale de ruptura y la salida deja de estar regulada.`,
    formula: String.raw`R_S \le R_{S(max)}`,
    result: String.raw`${engTex(rs, 'Ω')}\ ${rs <= dropout.rsMax ? TEX.le : '>'}\ ${engTex(dropout.rsMax, 'Ω')}`,
  });
  if (!regulates) {
    notices.push({
      level: 'warning',
      message:
        'El regulador pierde la regulación en el valle del rizado: reduce R_S, aumenta C o usa un transformador con más tensión.',
    });
  }
  if (input.pzm !== undefined) {
    const power = zenerPowerCheck(input, input.pzm, zr.pz, vp);
    steps.push(power.step);
    notices.push(...power.notices);
  }

  const tables: ResultTable[] = [
    {
      id: 'secciones',
      title: 'Tensiones por sección',
      columns: [
        { key: 'section', header: String.raw`\text{Sección}`, format: 'text' },
        { key: 'quantity', header: String.raw`\text{Magnitud}`, format: 'latex' },
        { key: 'value', header: String.raw`\text{Valor}`, format: 'latex' },
      ],
      rows: [
        {
          section: 'Transformador',
          quantity: 'V_{p2}',
          value: String.raw`${n(tr.vp2, 5)}\ \text{V}`,
        },
        { section: 'Rectificador', quantity: 'V_p', value: String.raw`${n(vp, 5)}\ \text{V}` },
        {
          section: 'Rectificador',
          quantity: 'f_r',
          value: String.raw`${n(rect.fOut, 5)}\ \text{Hz}`,
        },
        { section: 'Filtro', quantity: 'V_{r(pp)}', value: String.raw`${n(vrpp, 5)}\ \text{V}` },
        { section: 'Filtro', quantity: 'V_{cd}', value: String.raw`${n(vdc, 5)}\ \text{V}` },
        { section: 'Regulador', quantity: 'V_L', value: String.raw`${n(zr.vl, 5)}\ \text{V}` },
        { section: 'Regulador', quantity: 'I_Z', value: engTex(zr.iz, 'A') },
        ...(vrOut !== undefined
          ? [{ section: 'Regulador', quantity: 'V_{r(out)}', value: engTex(vrOut, 'V') }]
          : []),
      ],
    },
  ];

  // Formas de onda aproximadas: diente de sierra en el condensador y salida regulada.
  const tr0 = 1 / rect.fOut;
  const points: { x: number; y: number }[] = [];
  const out: { x: number; y: number }[] = [];
  const half = (vrOut ?? 0) / 2;
  for (let k = 0; k < 3; k++) {
    points.push({ x: k * tr0, y: vp }, { x: (k + 1) * tr0 * 0.999, y: vmin });
    out.push({ x: k * tr0, y: zr.vl + half }, { x: (k + 1) * tr0 * 0.999, y: zr.vl - half });
  }
  const series: Series = {
    id: 'rizado',
    title: 'Tensión en el condensador y en la carga',
    xLabel: 't (s)',
    yLabel: 'v (V)',
    label: 'Condensador',
    points,
    others: [{ label: 'Carga (regulada)', points: out }],
  };

  const summary: SummaryItem[] = [
    { label: 'V_L', value: String.raw`${n(zr.vl, 5)}\ \text{V}`, emphasis: true },
    { label: 'V_r(pp) del filtro', value: String.raw`${n(vrpp, 4)}\ \text{V}`, emphasis: true },
    ...(vrOut !== undefined ? [{ label: 'V_r(out)', value: engTex(vrOut, 'V') }] : []),
    { label: 'V_cd del filtro', value: String.raw`${n(vdc, 5)}\ \text{V}` },
    { label: 'I_Z', value: engTex(zr.iz, 'A') },
    { label: 'R_S(máx)', value: engTex(dropout.rsMax, 'Ω') },
    { label: 'Regulación', value: regulates ? String.raw`\text{sí}` : String.raw`\text{no}` },
  ];

  return {
    ok: true,
    value: {
      vp2: tr.vp2,
      vp,
      idc,
      vrpp,
      vdc,
      vmin,
      zenerOn: zr.on,
      vl: zr.vl,
      iz: zr.iz,
      pz: zr.pz,
      vrOut,
      rsMax: dropout.rsMax,
      regulates,
    },
    summary,
    steps,
    tables,
    series: [series],
    notices,
  };
}

export const fuenteReguladaPorZener: Calculator<
  ZenerSupplyInput,
  ZenerSupplyValue,
  ZenerSupplyErrorCode
> = {
  meta: {
    id: 'fuente-regulada-por-zener',
    title: 'Fuente de alimentación regulada por Zener',
    summary:
      'Transformador, rectificador, filtro y regulador Zener: tensiones por sección, rizado antes y después del regulador y resistencia serie máxima.',
    citations: [
      {
        sourceId: 'malvino-1999',
        locator: 'Sec. 4-6 y 5-2 a 5-4, ejemplos 5-8 a 5-11 (fig. 5-13)',
      },
      { sourceId: 'boylestad-nashelsky-1997', locator: '10.ª ed. en español, sec. 2.10 y 15.3' },
    ],
  },
  inputSchema,
  // Malvino, ejemplo 5-9 (fig. 5-13).
  example: {
    v1rms: 120,
    ratio: 8,
    f: 60,
    rectifier: 'puente',
    vk: 0.7,
    c: 270e-6,
    bleeder: 390,
    rs: 270,
    vz: 10,
    rz: 8.5,
    rl: 1000,
  },
  solve: solveZenerSupply,
};
