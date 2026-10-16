/**
 * Filtrado con condensador y regulación con diodo Zener.
 *
 * Filtro: rizado pico a pico y eficaz, tensión de cd y factor de rizo de un rectificador de media
 * onda u onda completa con filtro de condensador.
 * Regulador Zener: los tres casos de Boylestad (V_i y R_L fijos, R_L variable y V_i variable),
 * con la segunda aproximación (R_Z) y la atenuación del rizado de Malvino.
 *
 * Fuentes: Boylestad y Nashelsky, 10.ª ed. en español, sec. 2.10 (ejemplos 2.26 a 2.28) y 15.3
 * (ejemplos 15.3 a 15.5); Malvino, 6.ª ed. en español, sec. 4-6 (ejemplos 4-6 a 4-8) y 5-3
 * (ejemplos 5-7 y 5-8).
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, Notice, Series, Step, SummaryItem } from '../types';
import { capacitorFilter } from './filter';
import { engTex, engText } from './units';
import { zenerFixed, zenerInputRange, zenerLoadRange, zenerRipple } from './zener';

const n = (v: number, d = 6) => toLatexNumber(v, d);

const finite = (what: string) =>
  z.number({ error: `Escribe ${what}.` }).refine(Number.isFinite, `Escribe ${what}.`);
const positive = (what: string) =>
  finite(what).refine((v) => v > 0, `${what} debe ser mayor que 0.`);
const optionalPositive = (what: string) =>
  z
    .number({ error: `Escribe ${what} o deja el campo vacío.` })
    .positive(`${what} debe ser mayor que 0.`)
    .optional();

const inputSchema = z
  .object({
    part: z.enum(['filtro', 'zener']),
    rectifier: z.enum(['media-onda', 'onda-completa']),
    vm: positive('V_m'),
    f: positive('la frecuencia'),
    c: positive('C'),
    load: z.enum(['corriente', 'resistencia']),
    idc: positive('I_cd'),
    rl: positive('R_L'),
    zenerCase: z.enum(['fijo', 'rl-variable', 'vi-variable']),
    vi: positive('V_i'),
    rs: positive('R_S'),
    vz: positive('V_Z'),
    izm: positive('I_ZM'),
    pzm: optionalPositive('P_ZM'),
    rz: optionalPositive('R_Z'),
    vrin: optionalPositive('el rizado de entrada'),
  })
  .superRefine((v, ctx) => {
    if (v.part === 'zener' && v.zenerCase !== 'vi-variable' && v.vi <= v.vz) {
      ctx.addIssue({ code: 'custom', path: ['vi'], message: 'V_i debe ser mayor que V_Z.' });
    }
  });

export type FilterRegulationInput = z.infer<typeof inputSchema>;

export type FilterRegulationValue =
  | { part: 'filtro'; vrpp: number; vrrms: number; vdc: number; ripple: number; idc: number }
  | {
      part: 'zener';
      case: 'fijo';
      on: boolean;
      vl: number;
      iz: number;
      pz: number;
      il: number;
      ir: number;
      rippleOut?: number;
    }
  | {
      part: 'zener';
      case: 'rl-variable';
      rlMin: number;
      rlMax: number;
      ilMin: number;
      ilMax: number;
      ir: number;
      pMax: number;
    }
  | { part: 'zener'; case: 'vi-variable'; viMin: number; viMax: number; il: number; irMax: number };

export type FilterRegulationErrorCode = never;

function solveFilter(
  input: FilterRegulationInput,
): CalculatorResult<FilterRegulationValue, FilterRegulationErrorCode> {
  const fullWave = input.rectifier === 'onda-completa';
  const filter = capacitorFilter({
    vm: input.vm,
    fullWave,
    f: input.f,
    c: input.c,
    load:
      input.load === 'corriente'
        ? { kind: 'corriente', idc: input.idc }
        : { kind: 'resistencia', rl: input.rl },
  });
  // Forma de onda aproximada: carga hasta V_m y descarga lineal durante 1/f_r.
  const tr = 1 / filter.fr;
  const points: { x: number; y: number }[] = [];
  for (let k = 0; k <= 3; k++) {
    points.push({ x: k * tr, y: input.vm }, { x: (k + 1) * tr * 0.999, y: filter.vmin });
  }
  const series: Series = {
    id: 'rizado',
    title: 'Tensión en el condensador (aproximación en diente de sierra)',
    xLabel: 't (s)',
    yLabel: 'v (V)',
    label: 'v_C',
    points,
    others: [
      {
        label: 'V_cd',
        points: [
          { x: 0, y: filter.vdc },
          { x: 4 * tr, y: filter.vdc },
        ],
      },
    ],
  };
  const notices: Notice[] = [];
  if (filter.vrpp > 0.2 * input.vm) {
    notices.push({
      level: 'warning',
      message:
        'El rizado supera el 20 % del pico: las fórmulas suponen un rizado pequeño, así que el resultado es solo aproximado.',
    });
  }
  return {
    ok: true,
    value: {
      part: 'filtro',
      vrpp: filter.vrpp,
      vrrms: filter.vrrms,
      vdc: filter.vdc,
      ripple: filter.ripple,
      idc: filter.idc,
    },
    summary: [
      { label: 'V_r(pp)', value: `${n(filter.vrpp, 5)}\\ \\text{V}`, emphasis: true },
      { label: 'V_r(rms)', value: `${n(filter.vrrms, 5)}\\ \\text{V}` },
      { label: 'V_cd', value: `${n(filter.vdc, 5)}\\ \\text{V}` },
      { label: 'Rizo r', value: `${n(100 * filter.ripple, 4)}\\,\\%` },
    ],
    steps: [
      {
        title: 'Filtro con condensador a la entrada',
        explanation: `${fullWave ? 'Rectificador de onda completa' : 'Rectificador de media onda'} con pico V_m = ${engText(input.vm, 'V')} y C = ${engText(input.c, 'F')}. El condensador se carga hasta el pico y se descarga por la carga entre picos.`,
      },
      ...filter.steps,
    ],
    tables: [],
    series: [series],
    notices,
  };
}

function solveZener(
  input: FilterRegulationInput,
): CalculatorResult<FilterRegulationValue, FilterRegulationErrorCode> {
  const notices: Notice[] = [];
  const steps: Step[] = [];
  let summary: SummaryItem[];
  let value: FilterRegulationValue;

  if (input.zenerCase === 'fijo') {
    const z0 = zenerFixed(input.vi, input.rs, input.rl, input.vz, input.rz ?? 0);
    steps.push(...z0.steps);
    let rippleOut: number | undefined;
    if (input.pzm !== undefined && z0.on) {
      const ok = z0.pz <= input.pzm;
      notices.push({
        level: ok ? 'info' : 'warning',
        message: ok
          ? `P_Z = ${engText(z0.pz, 'W')} es menor que la nominal P_ZM = ${engText(input.pzm, 'W')}.`
          : `P_Z = ${engText(z0.pz, 'W')} supera la nominal P_ZM = ${engText(input.pzm, 'W')}: el Zener se dañaría.`,
      });
    }
    if (input.vrin !== undefined && input.rz !== undefined && z0.on) {
      const r = zenerRipple(input.vrin, input.rs, input.rz, input.rl);
      steps.push(r.step);
      rippleOut = r.approx;
    }
    value = {
      part: 'zener',
      case: 'fijo',
      on: z0.on,
      vl: z0.vl,
      iz: z0.iz,
      pz: z0.pz,
      il: z0.il,
      ir: z0.ir,
      rippleOut,
    };
    summary = [
      { label: 'Zener', value: z0.on ? '\\text{encendido}' : '\\text{apagado}' },
      { label: 'V_L', value: `${n(z0.vl, 5)}\\ \\text{V}`, emphasis: true },
      { label: 'I_Z', value: engTex(z0.iz, 'A') },
      { label: 'I_L', value: engTex(z0.il, 'A') },
      { label: 'P_Z', value: engTex(z0.pz, 'W') },
      ...(rippleOut !== undefined ? [{ label: 'V_r(out)', value: engTex(rippleOut, 'V') }] : []),
    ];
  } else if (input.zenerCase === 'rl-variable') {
    const r = zenerLoadRange(input.vi, input.rs, input.vz, input.izm);
    steps.push(...r.steps);
    if (r.ilMin === 0) {
      notices.push({
        level: 'info',
        message: 'I_R no supera I_ZM: el Zener soporta incluso la carga abierta.',
      });
    }
    value = {
      part: 'zener',
      case: 'rl-variable',
      rlMin: r.rlMin,
      rlMax: r.rlMax,
      ilMin: r.ilMin,
      ilMax: r.ilMax,
      ir: r.ir,
      pMax: r.pMax,
    };
    summary = [
      {
        label: 'R_L',
        value: `${engTex(r.rlMin, 'Ω')} \\le R_L \\le ${Number.isFinite(r.rlMax) ? engTex(r.rlMax, 'Ω') : '\\infty'}`,
        emphasis: true,
      },
      { label: 'I_L', value: `${engTex(r.ilMin, 'A')} \\le I_L \\le ${engTex(r.ilMax, 'A')}` },
      { label: 'P_max', value: engTex(r.pMax, 'W') },
    ];
  } else {
    const r = zenerInputRange(input.rl, input.rs, input.vz, input.izm);
    steps.push(...r.steps);
    value = {
      part: 'zener',
      case: 'vi-variable',
      viMin: r.viMin,
      viMax: r.viMax,
      il: r.il,
      irMax: r.irMax,
    };
    summary = [
      {
        label: 'V_i',
        value: `${n(r.viMin, 5)}\\ \\text{V} \\le V_i \\le ${n(r.viMax, 5)}\\ \\text{V}`,
        emphasis: true,
      },
      { label: 'I_L', value: engTex(r.il, 'A') },
    ];
  }

  return {
    ok: true,
    value,
    summary,
    steps: [
      {
        title: 'Regulador Zener',
        explanation:
          input.zenerCase === 'fijo'
            ? 'V_i, R_S y R_L fijos: se determina el estado del Zener y luego las corrientes (Boylestad, sec. 2.10).'
            : input.zenerCase === 'rl-variable'
              ? 'V_i fija y R_L variable: se busca el intervalo de cargas que mantiene al Zener en regulación.'
              : 'R_L fija y V_i variable: se busca el intervalo de tensiones de entrada que mantiene al Zener en regulación.',
      },
      ...steps,
    ],
    tables: [],
    series: [],
    notices,
  };
}

export function solveFilterRegulation(
  input: FilterRegulationInput,
): CalculatorResult<FilterRegulationValue, FilterRegulationErrorCode> {
  return input.part === 'filtro' ? solveFilter(input) : solveZener(input);
}

export const filtroYRegulacion: Calculator<
  FilterRegulationInput,
  FilterRegulationValue,
  FilterRegulationErrorCode
> = {
  meta: {
    id: 'filtro-y-regulacion',
    title: 'Filtrado y regulación',
    summary:
      'Rizado del filtro con condensador y regulador con diodo Zener (estado, intervalos de carga y de entrada).',
    citations: [
      {
        sourceId: 'boylestad-nashelsky-1997',
        locator: '10.ª ed. en español, sec. 2.10 y 15.3, ejemplos 2.26 a 2.28 y 15.3 a 15.5',
      },
      { sourceId: 'malvino-1999', locator: 'Sec. 4-6 y 5-3, ejemplos 4-6 a 4-8, 5-7 y 5-8' },
    ],
  },
  inputSchema,
  // Boylestad, ejemplos 15.3 y 15.4: onda completa, C = 100 µF, I_cd = 50 mA y V_m = 30 V.
  example: {
    part: 'filtro',
    rectifier: 'onda-completa',
    vm: 30,
    f: 60,
    c: 100e-6,
    load: 'corriente',
    idc: 0.05,
    rl: 1200,
    zenerCase: 'fijo',
    vi: 16,
    rs: 1000,
    vz: 10,
    izm: 0.032,
  },
  solve: solveFilterRegulation,
};
