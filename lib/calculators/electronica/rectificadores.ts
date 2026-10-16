/**
 * Rectificadores sin filtro: media onda, onda completa con derivación central y puente.
 *
 *   V_cd = V_p(out)/π (media onda)        V_cd = 2V_p(out)/π (onda completa)
 *   V_rms = V_p/2                         V_rms = V_p/√2
 *   Componente de ca: V_r(rms) = √(V_rms² − V_cd²) = 0.385V_p (media onda) o 0.308V_p (completa)
 *   Factor de rizo r = V_r(rms)/V_cd = 121 % (media onda) o 48 % (completa)
 *
 * Fuentes: Malvino, 6.ª ed. en español, sec. 4-1 a 4-4 y tabla 4-1 (ejemplos 4-1, 4-3 y 4-5);
 * Boylestad y Nashelsky, 10.ª ed. en español, sec. 2.6 y 2.7 (ejemplo 2.16) y sec. 15.2 (factor
 * de rizo).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, ResultTable, Series, Step } from '../types';
import { RECTIFIER_NAME, rectify, transformer, type RectifierType } from './rectifier';
import { engTex, engText } from './units';

const n = (v: number, d = 6) => toLatexNumber(v, d);

const finite = (what: string) =>
  z.number({ error: `Escribe ${what}.` }).refine(Number.isFinite, `Escribe ${what}.`);
const positive = (what: string) =>
  finite(what).refine((v) => v > 0, `${what} debe ser mayor que 0.`);

const inputSchema = z.object({
  type: z.enum(['media-onda', 'derivacion-central', 'puente']),
  input: z.enum(['transformador', 'pico']),
  v1rms: positive('V₁ (rms)'),
  ratio: positive('la relación N₁:N₂'),
  vp2: positive('V_p2'),
  vk: finite('V_K').refine((v) => v >= 0, 'V_K no puede ser negativo.'),
  f: positive('la frecuencia'),
  rl: z
    .number({ error: 'Escribe R_L o deja el campo vacío.' })
    .positive('R_L debe ser mayor que 0.')
    .optional(),
});

export type RectifierInput = z.infer<typeof inputSchema>;

export interface RectifierValue {
  vp2: number;
  vpOut: number;
  vdc: number;
  vrms: number;
  vripple: number;
  rippleFactor: number;
  fOut: number;
  piv: number;
  idc?: number;
}

export type RectifierErrorCode = 'sin-conduccion';

export function solveRectifier(
  input: RectifierInput,
): CalculatorResult<RectifierValue, RectifierErrorCode> {
  const type = input.type as RectifierType;
  const steps: Step[] = [];
  let vp2 = input.vp2;
  if (input.input === 'transformador') {
    const t = transformer(input.v1rms, input.ratio);
    vp2 = t.vp2;
    steps.push(...t.steps);
  } else {
    steps.push({
      title: 'Tensión de pico del secundario',
      result: `V_{p2} = ${n(vp2)}\\ \\text{V}`,
    });
  }

  const r = rectify(vp2, type, input.vk, input.f);
  steps.push(r.step);
  if (r.vpOut <= 0) {
    const message = 'La tensión de pico no alcanza a encender los diodos: no hay salida.';
    return {
      ok: false,
      error: { code: 'sin-conduccion', message },
      steps,
      tables: [],
      series: [],
      notices: [{ level: 'error', message }],
    };
  }

  const vp = r.vpOut;
  const vdc = r.fullWave ? (2 * vp) / Math.PI : vp / Math.PI;
  const vrms = r.fullWave ? vp / Math.SQRT2 : vp / 2;
  const vripple = Math.sqrt(vrms * vrms - vdc * vdc);
  const rippleFactor = vripple / vdc;

  steps.push({
    title: 'Valor de cd (promedio)',
    explanation: r.fullWave
      ? 'La onda completa aprovecha ambos semiciclos: el promedio es el doble que en media onda (63.6 % del pico).'
      : 'Solo pasa un semiciclo: el promedio es el 31.8 % del pico.',
    formula: r.fullWave
      ? 'V_{cd} = \\frac{2V_{p(out)}}{\\pi} = 0.636\\,V_{p(out)}'
      : 'V_{cd} = \\frac{V_{p(out)}}{\\pi} = 0.318\\,V_{p(out)}',
    substitution: r.fullWave
      ? `V_{cd} = \\frac{2(${n(vp)})}{\\pi}`
      : `V_{cd} = \\frac{${n(vp)}}{\\pi}`,
    result: `V_{cd} = ${n(vdc)}\\ \\text{V}`,
  });
  steps.push({
    title: 'Valor eficaz y rizo',
    explanation:
      'El factor de rizo compara el valor eficaz de la componente de ca con el de cd (Boylestad, sec. 15.2): sin filtro es grande, por eso se agrega un capacitor.',
    formula: `V_{rms} = ${r.fullWave ? '\\frac{V_p}{\\sqrt{2}}' : '\\frac{V_p}{2}'},\\qquad V_{r(rms)} = \\sqrt{V_{rms}^{2} - V_{cd}^{2}},\\qquad r = \\frac{V_{r(rms)}}{V_{cd}}`,
    substitution: `V_{rms} = ${n(vrms)}\\ \\text{V},\\quad V_{r(rms)} = \\sqrt{(${n(vrms)})^{2} - (${n(vdc)})^{2}}`,
    result: `V_{r(rms)} = ${n(vripple)}\\ \\text{V} = ${n(vripple / vp, 4)}\\,V_p,\\quad r = ${n(100 * rippleFactor, 4)}\\,\\%`,
  });
  steps.push({
    title: 'Frecuencia de salida y PIV',
    explanation: `${r.fullWave ? 'La salida tiene dos pulsos por ciclo de la red' : 'La salida tiene un pulso por ciclo de la red'}. Cada diodo debe soportar en inversa el pico ${
      type === 'derivacion-central' ? 'del secundario completo (2V_m)' : 'del secundario'
    } (valor ideal).`,
    formula: `f_{out} = ${r.fullWave ? '2f_{in}' : 'f_{in}'},\\qquad PIV = V_{p2}`,
    result: `f_{out} = ${n(r.fOut)}\\ \\text{Hz},\\quad PIV = ${n(r.piv)}\\ \\text{V}`,
  });

  let idc: number | undefined;
  if (input.rl !== undefined) {
    idc = vdc / input.rl;
    const idiode = r.fullWave ? idc / 2 : idc;
    steps.push({
      title: 'Corrientes en la carga y en los diodos',
      explanation: r.fullWave
        ? 'Cada diodo conduce medio ciclo: lleva la mitad de la corriente continua de la carga.'
        : 'El único diodo lleva toda la corriente de la carga.',
      formula: `I_{cd} = \\frac{V_{cd}}{R_L},\\qquad I_{diodo} = ${r.fullWave ? '\\frac{I_{cd}}{2}' : 'I_{cd}'},\\qquad I_p = \\frac{V_{p(out)}}{R_L}`,
      result: `I_{cd} = ${engTex(idc, 'A')},\\quad I_{diodo} = ${engTex(idiode, 'A')},\\quad I_p = ${engTex(vp / input.rl, 'A')}`,
    });
  }

  // Formas de onda: dos ciclos de la red.
  const period = 1 / input.f;
  const samples = 400;
  const out = (t: number) => {
    const s = Math.sin(2 * Math.PI * input.f * t);
    const raw = r.fullWave ? r.vpIn * Math.abs(s) : r.vpIn * s;
    return Math.max(0, raw - r.diodesInPath * input.vk);
  };
  const series: Series[] = [
    {
      id: 'salida',
      title: 'Tensión en la carga',
      xLabel: 't (s)',
      yLabel: 'v (V)',
      label: 'v_out',
      points: Array.from({ length: samples + 1 }, (_, k) => {
        const t = (2 * period * k) / samples;
        return { x: t, y: out(t) };
      }),
      others: [
        {
          label: 'v_in',
          points: Array.from({ length: samples + 1 }, (_, k) => {
            const t = (2 * period * k) / samples;
            return { x: t, y: r.vpIn * Math.sin(2 * Math.PI * input.f * t) };
          }),
        },
        {
          label: 'V_cd',
          points: [
            { x: 0, y: vdc },
            { x: 2 * period, y: vdc },
          ],
        },
      ],
    },
  ];

  const table: ResultTable = {
    id: 'resumen',
    title: 'Tabla 4-1 de Malvino con estos datos',
    columns: [
      { key: 'magnitud', header: '\\text{Magnitud}', format: 'latex' },
      { key: 'valor', header: '\\text{Valor}', format: 'latex' },
    ],
    rows: [
      {
        magnitud: '\\text{Diodos}',
        valor: type === 'media-onda' ? '1' : type === 'puente' ? '4' : '2',
      },
      { magnitud: 'V_{p2}', valor: `${n(vp2, 5)}\\ \\text{V}` },
      { magnitud: 'V_{p(in)}', valor: `${n(r.vpIn, 5)}\\ \\text{V}` },
      { magnitud: 'V_{p(out)}', valor: `${n(vp, 5)}\\ \\text{V}` },
      { magnitud: 'V_{cd}', valor: `${n(vdc, 5)}\\ \\text{V}` },
      { magnitud: 'f_{out}', valor: `${n(r.fOut, 5)}\\ \\text{Hz}` },
    ],
  };

  return {
    ok: true,
    value: { vp2, vpOut: vp, vdc, vrms, vripple, rippleFactor, fOut: r.fOut, piv: r.piv, idc },
    summary: [
      { label: 'V_p(out)', value: `${n(vp, 5)}\\ \\text{V}` },
      { label: 'V_cd', value: `${n(vdc, 5)}\\ \\text{V}`, emphasis: true },
      { label: 'V_rms', value: `${n(vrms, 5)}\\ \\text{V}` },
      { label: 'Rizo r', value: `${formatNumber(100 * rippleFactor, 3)}\\,\\%` },
      { label: 'f_out', value: `${n(r.fOut, 5)}\\ \\text{Hz}` },
      { label: 'PIV', value: `${n(r.piv, 5)}\\ \\text{V}` },
      ...(idc !== undefined ? [{ label: 'I_cd', value: engTex(idc, 'A') }] : []),
    ],
    steps: [
      {
        title: 'Circuito',
        explanation: `${RECTIFIER_NAME[type].replace(/^./, (c) => c.toUpperCase())} con ${
          input.vk === 0
            ? 'diodos ideales'
            : `diodos de V_K = ${engText(input.vk, 'V')} (segunda aproximación)`
        }.`,
      },
      ...steps,
    ],
    tables: [table],
    series,
    notices: [],
  };
}

export const rectificadores: Calculator<RectifierInput, RectifierValue, RectifierErrorCode> = {
  meta: {
    id: 'rectificadores',
    title: 'Rectificadores',
    summary:
      'Media onda, derivación central y puente: tensiones de pico, de cd y eficaz, rizo, frecuencia y PIV.',
    citations: [
      { sourceId: 'malvino-1999', locator: 'Sec. 4-1 a 4-4, tabla 4-1, ejemplos 4-1, 4-3 y 4-5' },
      {
        sourceId: 'boylestad-nashelsky-1997',
        locator: '10.ª ed. en español, sec. 2.6, 2.7 y 15.2, ejemplo 2.16',
      },
    ],
  },
  inputSchema,
  // Malvino, ejemplo 4-3: 120 V, 60 Hz, transformador 10:1 con derivación central y 1 kΩ.
  example: {
    type: 'derivacion-central',
    input: 'transformador',
    v1rms: 120,
    ratio: 10,
    vp2: 17,
    vk: 0.7,
    f: 60,
    rl: 1000,
  },
  solve: solveRectifier,
};
