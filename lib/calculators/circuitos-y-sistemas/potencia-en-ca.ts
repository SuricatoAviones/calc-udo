/**
 * Potencia en circuitos excitados por senoides (régimen permanente).
 *
 *   p(t) = v(t) i(t) = ½VmIm cos(θv − θi) + ½VmIm cos(2ωt + θv + θi)
 *   P = Vef Ief cos θ,   Q = Vef Ief sen θ,   |S| = Vef Ief,   S = V_ef I_ef* = P + jQ
 *   FP = cos θ, con θ = θv − θi (atrasado si θ > 0, carga inductiva)
 *
 * Fuente: Hayt, Kemmerly y Durbin, 8.ª ed., cap. 11 (sec. 11.1 a 11.5; ejemplos 11.3, 11.4 y
 * 11.8).
 */
import { z } from 'zod';
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, ResultTable, Series, Step } from '../types';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);
const rect = (zz: Complex) => C.toLatexRect(zz, DIGITS);
const polar = (zz: Complex) => C.toLatexPolar(zz, DIGITS);

const finite = (what: string) =>
  z.number({ error: `Escribe ${what}.` }).refine(Number.isFinite, `Escribe ${what}.`);

const inputSchema = z
  .object({
    given: z.enum(['vi', 'vz', 'iz']),
    values: z.enum(['amplitud', 'eficaz']),
    vMag: finite('|V|'),
    vAngle: finite('el ángulo de V'),
    iMag: finite('|I|'),
    iAngle: finite('el ángulo de I'),
    resistance: finite('R'),
    reactance: finite('X'),
    omega: finite('ω').refine((v) => v > 0, 'ω debe ser mayor que 0.'),
  })
  .superRefine((v, ctx) => {
    if (v.given !== 'iz' && v.vMag <= 0) {
      ctx.addIssue({ code: 'custom', path: ['vMag'], message: '|V| debe ser mayor que 0.' });
    }
    if (v.given !== 'vz' && v.iMag <= 0) {
      ctx.addIssue({ code: 'custom', path: ['iMag'], message: '|I| debe ser mayor que 0.' });
    }
    if (v.given !== 'vi') {
      if (v.resistance < 0) {
        ctx.addIssue({ code: 'custom', path: ['resistance'], message: 'R no puede ser negativa.' });
      }
      if (v.resistance === 0 && v.reactance === 0) {
        ctx.addIssue({ code: 'custom', path: ['resistance'], message: 'Z no puede ser 0.' });
      }
    }
  });

export type PowerInput = z.infer<typeof inputSchema>;

export interface PowerValue {
  /** Fasores eficaces. */
  vRms: Complex;
  iRms: Complex;
  average: number;
  reactive: number;
  apparent: number;
  complexPower: Complex;
  powerFactor: number;
  /** atrasado (inductivo), adelantado (capacitivo) o unitario. */
  character: 'atrasado' | 'adelantado' | 'unitario';
}

export type PowerErrorCode = never;

export function solvePower(input: PowerInput): CalculatorResult<PowerValue, PowerErrorCode> {
  const toRms = input.values === 'amplitud' ? 1 / Math.SQRT2 : 1;
  const label = input.values === 'amplitud' ? 'amplitud' : 'valor eficaz';
  const steps: Step[] = [];
  const zz = C.complex(input.resistance, input.reactance);

  let v = C.fromPolar(input.vMag, C.radians(input.vAngle));
  let i = C.fromPolar(input.iMag, C.radians(input.iAngle));
  if (input.given === 'vz') {
    i = C.div(v, zz);
    steps.push({
      title: 'Corriente',
      formula: '\\mathbf{I} = \\frac{\\mathbf{V}}{\\mathbf{Z}}',
      substitution: `\\mathbf{I} = \\frac{${polar(v)}}{${rect(zz)}}`,
      result: `\\mathbf{I} = ${polar(i)}`,
    });
  } else if (input.given === 'iz') {
    v = C.mul(i, zz);
    steps.push({
      title: 'Voltaje',
      formula: '\\mathbf{V} = \\mathbf{I}\\,\\mathbf{Z}',
      substitution: `\\mathbf{V} = (${polar(i)})(${rect(zz)})`,
      result: `\\mathbf{V} = ${polar(v)}`,
    });
  }

  const vRms = C.scale(v, toRms);
  const iRms = C.scale(i, toRms);
  const vm = C.abs(v) / toRms;
  const im = C.abs(i) / toRms;
  const thetaV = C.arg(v);
  const thetaI = C.arg(i);
  const theta = thetaV - thetaI;
  const thetaDeg = C.degrees(Math.atan2(Math.sin(theta), Math.cos(theta)));

  steps.unshift({
    title: 'Datos',
    explanation: `Los módulos dados son de ${label}. Convención pasiva: P > 0 significa potencia absorbida por la carga.`,
    result: `\\mathbf{V} = ${polar(v)},\\quad \\mathbf{I} = ${polar(i)}`,
  });
  steps.push({
    title: 'Valores eficaces',
    explanation:
      input.values === 'amplitud'
        ? 'Para una senoide, el valor eficaz es la amplitud dividida entre √2.'
        : 'Los módulos ya son eficaces; las amplitudes son √2 veces mayores.',
    formula: 'V_{ef} = \\frac{V_m}{\\sqrt{2}},\\quad I_{ef} = \\frac{I_m}{\\sqrt{2}}',
    result: `V_{ef} = ${n(C.abs(vRms))}\\ \\text{V},\\quad I_{ef} = ${n(C.abs(iRms))}\\ \\text{A}`,
  });
  steps.push({
    title: 'Ángulo del factor de potencia',
    explanation:
      'Es el ángulo por el que el voltaje adelanta a la corriente (el ángulo de la impedancia).',
    formula: '\\theta = \\theta_v - \\theta_i',
    substitution: `\\theta = ${n(C.degrees(thetaV))}^{\\circ} - (${n(C.degrees(thetaI))}^{\\circ})`,
    result: `\\theta = ${n(thetaDeg)}^{\\circ}`,
  });
  steps.push({
    title: 'Potencia instantánea',
    explanation:
      'Tiene un término constante (el promedio) y otro que oscila al doble de la frecuencia de la fuente.',
    formula:
      'p(t) = \\tfrac{1}{2}V_mI_m\\cos(\\theta_v - \\theta_i) + \\tfrac{1}{2}V_mI_m\\cos(2\\omega t + \\theta_v + \\theta_i)',
    result: `p(t) = ${n(((vm * im) / 2) * Math.cos(theta))} + ${n((vm * im) / 2)}\\cos\\left(${n(2 * input.omega)}t ${
      thetaV + thetaI < 0 ? '-' : '+'
    } ${n(Math.abs(C.degrees(thetaV + thetaI)))}^{\\circ}\\right)\\ \\text{W}`,
  });

  const apparent = C.abs(vRms) * C.abs(iRms);
  const average = apparent * Math.cos(theta);
  const reactive = apparent * Math.sin(theta);
  const complexPower = C.mul(vRms, C.conj(iRms));
  const powerFactor = Math.cos(theta);
  const character: PowerValue['character'] =
    Math.abs(thetaDeg) < 1e-9 ? 'unitario' : thetaDeg > 0 ? 'atrasado' : 'adelantado';

  steps.push({
    title: 'Potencia promedio (activa)',
    formula: 'P = V_{ef}\\,I_{ef}\\cos\\theta',
    substitution: `P = (${n(C.abs(vRms))})(${n(C.abs(iRms))})\\cos(${n(thetaDeg)}^{\\circ})`,
    result: `P = ${n(average)}\\ \\text{W}`,
  });
  if (input.given !== 'vi') {
    steps.push({
      title: 'Comprobación con la resistencia',
      explanation: 'Solo la parte real de Z absorbe potencia promedio; la reactancia no.',
      formula: 'P = I_{ef}^{2}\\,R',
      substitution: `P = (${n(C.abs(iRms))})^{2}(${n(input.resistance)})`,
      result: `P = ${n(C.abs(iRms) ** 2 * input.resistance)}\\ \\text{W}`,
    });
  }
  steps.push({
    title: 'Potencia reactiva',
    formula: 'Q = V_{ef}\\,I_{ef}\\sin\\theta',
    substitution: `Q = (${n(C.abs(vRms))})(${n(C.abs(iRms))})\\sin(${n(thetaDeg)}^{\\circ})`,
    result: `Q = ${n(reactive)}\\ \\text{VAR}`,
  });
  steps.push({
    title: 'Potencia aparente',
    formula: '|\\mathbf{S}| = V_{ef}\\,I_{ef} = \\sqrt{P^{2} + Q^{2}}',
    result: `|\\mathbf{S}| = ${n(apparent)}\\ \\text{VA}`,
  });
  steps.push({
    title: 'Potencia compleja',
    formula: '\\mathbf{S} = \\mathbf{V}_{ef}\\,\\mathbf{I}_{ef}^{*} = P + jQ',
    substitution: `\\mathbf{S} = (${polar(vRms)})(${polar(C.conj(iRms))})`,
    result: `\\mathbf{S} = ${rect(complexPower)} = ${polar(complexPower)}\\ \\text{VA}`,
  });
  steps.push({
    title: 'Factor de potencia',
    explanation:
      character === 'unitario'
        ? 'Voltaje y corriente están en fase: carga resistiva.'
        : character === 'atrasado'
          ? 'La corriente se atrasa respecto del voltaje: carga inductiva (FP atrasado).'
          : 'La corriente se adelanta al voltaje: carga capacitiva (FP adelantado).',
    formula: '\\text{FP} = \\frac{P}{|\\mathbf{S}|} = \\cos\\theta',
    result: `\\text{FP} = ${n(powerFactor)}\\ \\text{(${character})}`,
  });

  const table: ResultTable = {
    id: 'triangulo',
    title: 'Triángulo de potencias',
    columns: [
      { key: 'magnitud', header: '\\text{Magnitud}', format: 'latex' },
      { key: 'valor', header: '\\text{Valor}' },
      { key: 'unidad', header: '\\text{Unidad}', format: 'text' },
    ],
    rows: [
      { magnitud: 'P', valor: average, unidad: 'W' },
      { magnitud: 'Q', valor: reactive, unidad: 'VAR' },
      { magnitud: '|\\mathbf{S}|', valor: apparent, unidad: 'VA' },
      { magnitud: '\\text{FP}', valor: powerFactor, unidad: character },
      { magnitud: '\\theta', valor: thetaDeg, unidad: '°' },
    ],
  };

  const period = (2 * Math.PI) / input.omega;
  const samples = 400;
  const pts = (f: (t: number) => number) =>
    Array.from({ length: samples + 1 }, (_, k) => {
      const t = (2 * period * k) / samples;
      return { x: t, y: f(t) };
    });
  const vt = (t: number) => vm * Math.cos(input.omega * t + thetaV);
  const it = (t: number) => im * Math.cos(input.omega * t + thetaI);
  const series: Series[] = [
    {
      id: 'potencia',
      title: 'Potencia instantánea y potencia promedio',
      xLabel: 't (s)',
      yLabel: 'p (W)',
      label: 'p(t)',
      points: pts((t) => vt(t) * it(t)),
      others: [{ label: 'P', points: pts(() => average) }],
    },
    {
      id: 'senoides',
      title: 'Voltaje y corriente',
      xLabel: 't (s)',
      yLabel: 'v (V), i (A)',
      label: 'v(t)',
      points: pts(vt),
      others: [{ label: 'i(t)', points: pts(it) }],
    },
  ];

  return {
    ok: true,
    value: { vRms, iRms, average, reactive, apparent, complexPower, powerFactor, character },
    summary: [
      { label: 'P', value: `${n(average)}\\ \\text{W}`, emphasis: true },
      { label: 'Q', value: `${n(reactive)}\\ \\text{VAR}` },
      { label: '|S|', value: `${n(apparent)}\\ \\text{VA}` },
      { label: 'S', value: `${rect(complexPower)}\\ \\text{VA}` },
      { label: 'FP', value: `${n(powerFactor)}\\ \\text{(${character})}` },
    ],
    steps,
    tables: [table],
    series,
    notices:
      average < -1e-12
        ? [
            {
              level: 'info',
              message: `P = ${formatNumber(average, DIGITS)} W es negativa: con la convención pasiva, el elemento entrega potencia (es una fuente).`,
            },
          ]
        : [],
  };
}

export const potenciaEnCa: Calculator<PowerInput, PowerValue, PowerErrorCode> = {
  meta: {
    id: 'potencia-en-ca',
    title: 'Potencia en circuitos senoidales',
    summary:
      'Potencia instantánea, promedio, reactiva, aparente y compleja, y factor de potencia de una carga.',
    citations: [
      {
        sourceId: 'hayt-kemmerly-1993',
        locator: '8.ª ed. en inglés, cap. 11, ejemplos 11.3, 11.4 y 11.8',
      },
    ],
  },
  inputSchema,
  // Hayt, ejemplo 11.8: 60∠0° V eficaces sobre (2 − j1) + (1 + j5) = 3 + j4 Ω.
  example: {
    given: 'vz',
    values: 'eficaz',
    vMag: 60,
    vAngle: 0,
    iMag: 1,
    iAngle: 0,
    resistance: 3,
    reactance: 4,
    omega: 377,
  },
  solve: solvePower,
};
