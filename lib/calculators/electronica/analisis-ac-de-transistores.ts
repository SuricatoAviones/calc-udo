/**
 * Análisis de ca de amplificadores con BJT con parámetros híbridos: impedancias de entrada y de
 * salida y ganancias de voltaje y de corriente, con el modelo aproximado (emisor común, emisor
 * sin puentear, seguidor de emisor y base común) o con el modelo completo (h_r y h_o).
 *
 * Fuente: Boylestad y Nashelsky, 10.ª ed. en español, cap. 5 (sec. 5.5 a 5.13 con el modelo r_e,
 * que equivale al híbrido con h_ie = βr_e y h_fe = β; sec. 5.19 a 5.21 y apéndice A).
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, Notice } from '../types';
import { approxAmplifier, completeAmplifier, type AcConfig } from './small-signal';
import { engTex, engText, parallel } from './units';

const n = (v: number, d = 6) => toLatexNumber(v, d);
const ohm = (v: number) => (Number.isFinite(v) ? engTex(v, 'Ω') : '\\infty');

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
    model: z.enum(['aproximado', 'completo']),
    config: z.enum(['emisor-comun', 'emisor-sin-puentear', 'seguidor', 'base-comun']),
    bias: z.enum(['fija', 'divisor']),
    hie: positive('h_ie'),
    hre: nonNegative('h_re'),
    hfe: positive('h_fe'),
    hoe: nonNegative('h_oe'),
    rb: positive('R_B'),
    r1: positive('R₁'),
    r2: positive('R₂'),
    rc: positive('R_C'),
    re: positive('R_E'),
    rl: optionalPositive('R_L'),
    rs: optionalPositive('R_s'),
  })
  .superRefine((v, ctx) => {
    if (v.model === 'completo' && (v.config === 'emisor-sin-puentear' || v.config === 'seguidor')) {
      ctx.addIssue({
        code: 'custom',
        path: ['config'],
        message:
          'El modelo completo (Boylestad, sec. 5.21) se aplica al transistor como bipuerto: usa emisor común o base común.',
      });
    }
  });

export type AcInput = z.infer<typeof inputSchema>;

export interface AcValue {
  zi: number;
  zo: number;
  av: number;
  avNL: number;
  avs?: number;
  ai: number;
  zb?: number;
  /** Del transistor solo, con el modelo completo. */
  ziT?: number;
  zoT?: number;
  aiT?: number;
}

export type AcErrorCode = never;

const CONFIG_NAME: Record<AcConfig, string> = {
  'emisor-comun': 'emisor común con R_E puenteada',
  'emisor-sin-puentear': 'emisor común con R_E sin puentear',
  seguidor: 'seguidor de emisor (colector común)',
  'base-comun': 'base común',
};

export function solveAc(input: AcInput): CalculatorResult<AcValue, AcErrorCode> {
  const { config } = input;
  const commonBase = config === 'base-comun';
  const divider = !commonBase && input.bias === 'divisor';
  const rin = commonBase ? input.re : divider ? parallel(input.r1, input.r2) : input.rb;
  const rinTex = commonBase ? 'R_E' : divider ? "R'" : 'R_B';
  const net = {
    config,
    h: {
      hi: input.hie,
      hr: input.model === 'completo' ? input.hre : 0,
      hf: input.hfe,
      ho: input.hoe,
    },
    rin,
    rinTex,
    rc: input.rc,
    re: input.re,
    rl: input.rl,
    rs: input.rs,
  };
  const r = input.model === 'completo' ? completeAmplifier(net) : approxAmplifier(net);

  const notices: Notice[] = [];
  const ro = input.hoe > 0 ? 1 / input.hoe : Infinity;
  if (
    input.model === 'aproximado' &&
    config === 'emisor-sin-puentear' &&
    ro < 10 * (input.rc + input.re)
  ) {
    notices.push({
      level: 'warning',
      message: `r_o = 1/h_oe = ${engText(ro, 'Ω')} no cumple r_o ≥ 10(R_C + R_E): el modelo aproximado, que ignora r_o, pierde precisión.`,
    });
  }

  const steps = [
    {
      title: 'Circuito equivalente de ca',
      explanation: `Configuración en ${CONFIG_NAME[config]}${
        commonBase
          ? ''
          : divider
            ? ', polarizada por divisor de voltaje'
            : ', con polarización fija'
      }; modelo híbrido ${input.model === 'completo' ? 'completo' : 'aproximado'}. Para la señal, los capacitores y la fuente de cd son cortocircuitos, así que ${
        commonBase
          ? 'R_E queda entre el emisor y tierra'
          : divider
            ? 'R₁ y R₂ quedan en paralelo'
            : 'R_B queda entre la base y tierra'
      }.`,
      ...(divider
        ? {
            formula: "R' = R_1 \\parallel R_2",
            substitution: `R' = ${n(input.r1)} \\parallel ${n(input.r2)}`,
            result: `R' = ${ohm(rin)}`,
          }
        : {}),
    },
    ...r.steps,
  ];

  const summary = [
    { label: 'Z_i', value: ohm(r.zi), emphasis: true },
    { label: 'Z_o', value: ohm(r.zo), emphasis: true },
    { label: input.rl !== undefined ? 'A_vL' : 'A_v', value: n(r.av, 5), emphasis: true },
    ...(input.rl !== undefined ? [{ label: 'A_vNL', value: n(r.avNL, 5) }] : []),
    ...(r.avs !== undefined ? [{ label: 'A_vs', value: n(r.avs, 5) }] : []),
    { label: 'A_i', value: n(r.ai, 5) },
    ...(r.zb !== undefined ? [{ label: 'Z_b', value: ohm(r.zb) }] : []),
    ...(r.zoT !== undefined ? [{ label: "Z_o'", value: ohm(r.zoT) }] : []),
  ];

  return {
    ok: true,
    value: {
      zi: r.zi,
      zo: r.zo,
      av: r.av,
      avNL: r.avNL,
      avs: r.avs,
      ai: r.ai,
      zb: r.zb,
      ziT: r.ziT,
      zoT: r.zoT,
      aiT: r.aiT,
    },
    summary,
    steps,
    tables: [],
    series: [],
    notices,
  };
}

export const analisisAcDeTransistores: Calculator<AcInput, AcValue, AcErrorCode> = {
  meta: {
    id: 'analisis-ac-de-transistores',
    title: 'Análisis AC con parámetros híbridos',
    summary:
      'Z_i, Z_o, A_v y A_i de un amplificador con BJT en emisor común, seguidor de emisor o base común, con el modelo híbrido aproximado o completo.',
    citations: [
      {
        sourceId: 'boylestad-nashelsky-1997',
        locator: '10.ª ed. en español, cap. 5 y apéndice A, ejemplos 5.1 a 5.8, 5.11 y 5.20 a 5.23',
      },
    ],
  },
  inputSchema,
  // Boylestad, ejemplo 5.20: polarización fija con h_fe = 120, h_ie = 1.175 kΩ y h_oe = 20 µS.
  example: {
    model: 'aproximado',
    config: 'emisor-comun',
    bias: 'fija',
    hie: 1175,
    hre: 2e-4,
    hfe: 120,
    hoe: 20e-6,
    rb: 330e3,
    r1: 56e3,
    r2: 8.2e3,
    rc: 2.7e3,
    re: 1.5e3,
  },
  solve: solveAc,
};
