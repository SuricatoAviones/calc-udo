/**
 * Sintonizado de controladores P, PI y PID con las reglas de Ziegler-Nichols (Ogata, 3.ª ed.,
 * sec. 10-2, tablas 10-1 y 10-2, ejemplo 10-1):
 *
 *   primer método (curva de reacción con L y T):  P: Kp = T/L;  PI: 0.9T/L, Ti = L/0.3;
 *                                                  PID: 1.2T/L, Ti = 2L, Td = 0.5L
 *   segundo método (ganancia y periodo críticos):  P: 0.5Kcr;  PI: 0.45Kcr, Ti = Pcr/1.2;
 *                                                  PID: 0.6Kcr, Ti = 0.5Pcr, Td = 0.125Pcr
 *   Gc(s) = Kp(1 + 1/(Ti s) + Td s)
 *
 * Con la planta G(s), Kcr sale del arreglo de Routh con control proporcional y ωcr del polinomio
 * auxiliar (Pcr = 2π/ωcr). Luego se simula la respuesta al escalón en lazo cerrado.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { addPoly, mulPoly, polyRoots, trimPoly } from '@/lib/math/polynomials';
import type {
  Calculator,
  CalculatorResult,
  Notice,
  ResultTable,
  Series,
  Step,
  SummaryItem,
} from '../types';
import { parameterStability, routhArray, routhTable } from './routh';
import { horizonFor, sample, stepSpecs, timeResponse } from './time-response';
import { parseTf, polyTex, tfTex, zpkTex, type TransferFunction } from './transfer-function';
import { uFromPoly } from './urat';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);
const positive = (what: string) =>
  z
    .number({ error: `Escribe ${what}.` })
    .refine(Number.isFinite, `Escribe ${what}.`)
    .refine((v) => v > 0, `${what} debe ser mayor que 0.`);

const inputSchema = z.object({
  method: z.enum(['curva', 'oscilacion', 'planta']),
  controller: z.enum(['P', 'PI', 'PID']),
  delay: positive('L'),
  timeConstant: positive('T'),
  criticalGain: positive('K_cr'),
  criticalPeriod: positive('P_cr'),
  plant: z.string().max(200),
});

export type PidInput = z.infer<typeof inputSchema>;

export interface PidSettings {
  kp: number;
  /** Infinity para P (sin acción integral). */
  ti: number;
  td: number;
}

export interface PidValue {
  settings: PidSettings;
  table: Record<'P' | 'PI' | 'PID', PidSettings>;
  controller: TransferFunction;
  criticalGain: number | null;
  criticalPeriod: number | null;
  closedLoop: TransferFunction | null;
  overshoot: number | null;
}

export type PidErrorCode = 'funcion-invalida' | 'sin-ganancia-critica' | 'planta-con-retardo';

function fail(
  code: PidErrorCode,
  message: string,
  steps: Step[] = [],
): CalculatorResult<PidValue, PidErrorCode> {
  return {
    ok: false,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

export function firstMethod(L: number, T: number): Record<'P' | 'PI' | 'PID', PidSettings> {
  return {
    P: { kp: T / L, ti: Infinity, td: 0 },
    PI: { kp: (0.9 * T) / L, ti: L / 0.3, td: 0 },
    PID: { kp: (1.2 * T) / L, ti: 2 * L, td: 0.5 * L },
  };
}

export function secondMethod(kcr: number, pcr: number): Record<'P' | 'PI' | 'PID', PidSettings> {
  return {
    P: { kp: 0.5 * kcr, ti: Infinity, td: 0 },
    PI: { kp: 0.45 * kcr, ti: pcr / 1.2, td: 0 },
    PID: { kp: 0.6 * kcr, ti: 0.5 * pcr, td: 0.125 * pcr },
  };
}

/** Gc(s) = Kp(1 + 1/(Ti s) + Td s) = (Kp Td s² + Kp s + Kp/Ti)/s. */
export function controllerTf({ kp, ti, td }: PidSettings): TransferFunction {
  if (!Number.isFinite(ti))
    return td === 0 ? { num: [kp], den: [1] } : { num: [kp * td, kp], den: [1] };
  return { num: trimPoly([kp * td, kp, kp / ti]), den: [1, 0] };
}

const tiTex = (ti: number) => (Number.isFinite(ti) ? n(ti) : '\\infty');

export function solvePid(input: PidInput): CalculatorResult<PidValue, PidErrorCode> {
  const steps: Step[] = [];
  const notices: Notice[] = [];
  const tables: ResultTable[] = [];
  let table: Record<'P' | 'PI' | 'PID', PidSettings>;
  let kcr: number | null = null;
  let pcr: number | null = null;
  let plant: TransferFunction | null = null;

  if (input.method === 'curva') {
    const { delay: L, timeConstant: T } = input;
    steps.push({
      title: 'Primer método: curva de reacción',
      explanation:
        'La respuesta de la planta al escalón tiene forma de S. Con la tangente en el punto de inflexión se miden el tiempo de retardo L y la constante de tiempo T, y la planta se aproxima por Ke^{−Ls}/(Ts + 1) (Ogata, fig. 10-4).',
      result: `L = ${n(L)}\\ \\text{s},\\quad T = ${n(T)}\\ \\text{s}`,
    });
    table = firstMethod(L, T);
    steps.push({
      title: 'Tabla 10-1 de Ziegler-Nichols',
      formula:
        'P:\\ K_p = \\frac{T}{L};\\quad PI:\\ K_p = 0.9\\frac{T}{L},\\ T_i = \\frac{L}{0.3};\\quad PID:\\ K_p = 1.2\\frac{T}{L},\\ T_i = 2L,\\ T_d = 0.5L',
      substitution: `K_p = 1.2\\frac{${n(T)}}{${n(L)}},\\ T_i = 2(${n(L)}),\\ T_d = 0.5(${n(L)})`,
      result: `\\text{PID: } K_p = ${n(table.PID.kp)},\\ T_i = ${n(table.PID.ti)},\\ T_d = ${n(table.PID.td)}`,
    });
  } else {
    if (input.method === 'oscilacion') {
      kcr = input.criticalGain;
      pcr = input.criticalPeriod;
      steps.push({
        title: 'Segundo método: oscilación sostenida',
        explanation:
          'Con Ti = ∞ y Td = 0 se aumenta Kp desde 0 hasta que la salida oscila con amplitud constante: esa es la ganancia crítica Kcr y el periodo de la oscilación es Pcr (Ogata, fig. 10-5 y 10-6).',
        result: `K_{cr} = ${n(kcr)},\\quad P_{cr} = ${n(pcr)}\\ \\text{s}`,
      });
    } else {
      const parsed = parseTf(input.plant, 'G(s)');
      if (!parsed.ok) return fail('funcion-invalida', parsed.message);
      plant = parsed.tf;
      // Ecuación característica con control proporcional: D(s) + Kp N(s) = 0.
      const D = trimPoly(plant.den);
      const N = trimPoly(plant.num);
      const size = Math.max(D.length, N.length);
      const pad = (p: number[]) => [...Array<number>(size - p.length).fill(0), ...p];
      const coefs = pad(D).map((d, i) => uFromPoly([pad(N)[i]!, d]));
      steps.push({
        title: 'Segundo método con la planta',
        explanation:
          'Con control proporcional (Ti = ∞, Td = 0) la ecuación característica en lazo cerrado es D(s) + Kp N(s) = 0. La ganancia crítica es el valor de Kp que hace al sistema marginalmente estable; se obtiene con el criterio de Routh (Ogata, ejemplo 10-1).',
        formula: '1 + K_pG(s) = 0',
        result: `G(s) = ${tfTex(plant)},\\quad ${polyTex(D)} + K_p\\left(${polyTex(N)}\\right) = 0`,
      });
      const routh = routhArray(coefs, 'Kp');
      if (!routh.ok) return fail('sin-ganancia-critica', routh.message, [...steps, ...routh.steps]);
      steps.push(...routh.array.steps);
      tables.push(routhTable(routh.array));
      const stability = parameterStability(coefs, routh.array, 'Kp');
      steps.push(...stability.steps);
      // La ganancia crítica es el borde superior del intervalo estable que contiene Kp → 0⁺.
      const near = stability.intervals.find(
        ([lo, hi]) => (lo ?? -Infinity) <= 1e-9 && (hi ?? Infinity) > 1e-9,
      );
      const upper = near?.[1] ?? null;
      const info =
        upper === null
          ? undefined
          : stability.criticalInfo.find((c) => Math.abs(c.value - upper) < 1e-9);
      if (upper === null || !info || info.omega.length === 0) {
        return fail(
          'sin-ganancia-critica',
          'El lazo cerrado con control proporcional no llega a una oscilación sostenida para ningún Kp positivo: no existe la ganancia crítica y el segundo método no se aplica (Ogata, sec. 10-2).',
          steps,
        );
      }
      kcr = upper;
      const omega = info.omega[0]!;
      pcr = (2 * Math.PI) / omega;
      steps.push({
        title: 'Ganancia y periodo críticos',
        formula: 'P_{cr} = \\frac{2\\pi}{\\omega_{cr}}',
        substitution: `P_{cr} = \\frac{2\\pi}{${n(omega)}}`,
        result: `K_{cr} = ${n(kcr)},\\quad \\omega_{cr} = ${n(omega)}\\ \\text{rad/s},\\quad P_{cr} = ${n(pcr)}\\ \\text{s}`,
      });
    }
    table = secondMethod(kcr, pcr);
    steps.push({
      title: 'Tabla 10-2 de Ziegler-Nichols',
      formula:
        'P:\\ K_p = 0.5K_{cr};\\quad PI:\\ K_p = 0.45K_{cr},\\ T_i = \\frac{P_{cr}}{1.2};\\quad PID:\\ K_p = 0.6K_{cr},\\ T_i = 0.5P_{cr},\\ T_d = 0.125P_{cr}',
      substitution: `K_p = 0.6(${n(kcr)}),\\ T_i = 0.5(${n(pcr)}),\\ T_d = 0.125(${n(pcr)})`,
      result: `\\text{PID: } K_p = ${n(table.PID.kp)},\\ T_i = ${n(table.PID.ti)},\\ T_d = ${n(table.PID.td)}`,
    });
  }

  const settings = table[input.controller];
  const controller = controllerTf(settings);
  tables.push({
    id: 'ziegler-nichols',
    title:
      input.method === 'curva'
        ? 'Primer método de Ziegler-Nichols'
        : 'Segundo método de Ziegler-Nichols',
    columns: [
      { key: 'tipo', header: '\\text{Controlador}', format: 'latex' },
      { key: 'kp', header: 'K_p' },
      { key: 'ti', header: 'T_i', format: 'latex' },
      { key: 'td', header: 'T_d' },
    ],
    rows: (['P', 'PI', 'PID'] as const).map((k) => ({
      tipo: `\\text{${k}}`,
      kp: table[k].kp,
      ti: tiTex(table[k].ti),
      td: table[k].td,
    })),
  });
  const zeroNote =
    input.controller === 'PID'
      ? input.method === 'curva'
        ? `El PID del primer método es 0.6T(s + 1/L)²/s: un polo en el origen y un cero doble en s = −1/L = ${formatNumber(-1 / input.delay, DIGITS)}.`
        : `El PID del segundo método es 0.075KcrPcr(s + 4/Pcr)²/s: un polo en el origen y un cero doble en s = −4/Pcr = ${formatNumber(-4 / pcr!, DIGITS)}.`
      : undefined;
  steps.push({
    title: `Controlador ${input.controller}`,
    explanation: zeroNote,
    formula: 'G_c(s) = K_p\\left(1 + \\frac{1}{T_is} + T_ds\\right)',
    substitution: `G_c(s) = ${n(settings.kp)}\\left(1${Number.isFinite(settings.ti) ? ` + \\frac{1}{${n(settings.ti)}s}` : ''}${settings.td ? ` + ${n(settings.td)}s` : ''}\\right)`,
    result: `G_c(s) = ${tfTex(controller)}${input.controller === 'PID' ? ` = ${zpkTex(controller)}` : ''}`,
  });

  const series: Series[] = [];
  let closedLoop: TransferFunction | null = null;
  let overshoot: number | null = null;
  if (plant) {
    const open: TransferFunction = {
      num: mulPoly(controller.num, plant.num),
      den: mulPoly(controller.den, plant.den),
    };
    closedLoop = { num: trimPoly(open.num), den: trimPoly(addPoly(open.den, open.num)) };
    const stable = polyRoots(closedLoop.den).every((r) => r.value.re < -1e-9);
    steps.push({
      title: 'Lazo cerrado con el controlador',
      explanation: stable ? undefined : 'El lazo cerrado con este controlador no es estable.',
      formula: '\\frac{C(s)}{R(s)} = \\frac{G_c(s)G(s)}{1 + G_c(s)G(s)}',
      result: `\\frac{C(s)}{R(s)} = ${tfTex(closedLoop)}`,
    });
    if (stable) {
      const response = timeResponse(closedLoop, 'escalon');
      if (response) {
        const horizon = horizonFor(closedLoop, 2);
        const final = closedLoop.num.at(-1)! / closedLoop.den.at(-1)!;
        const specs = stepSpecs(response.evaluate, final, horizon * 1.5);
        overshoot = specs.overshoot;
        steps.push({
          title: 'Respuesta al escalón unitario',
          explanation: `Sobrepaso máximo ≈ ${formatNumber(100 * specs.overshoot, 4)} %. Las reglas de Ziegler-Nichols suelen dar entre 10 y 60 % (25 % en promedio); si es excesivo se hace una sintonización fina (Ogata, sec. 10-2).`,
          result: `M_p = ${n(100 * specs.overshoot)}\\,\\%${specs.peak ? `,\\quad t_p = ${n(specs.peak)}\\ \\text{s}` : ''}${specs.settling2 ? `,\\quad t_s = ${n(specs.settling2)}\\ \\text{s}\\ (2\\,\\%)` : ''}`,
        });
        if (specs.overshoot > 0.4)
          notices.push({
            level: 'info',
            message:
              'El sobrepaso supera el 40 %: conviene una sintonización fina del controlador.',
          });
        series.push({
          id: 'respuesta',
          title: 'Respuesta al escalón en lazo cerrado',
          xLabel: 't (s)',
          yLabel: 'c(t)',
          label: 'c(t)',
          points: sample(response.evaluate, horizon),
          reference: { label: 'r(t)', points: sample(() => 1, horizon) },
        });
      }
    }
  }

  const summary: SummaryItem[] = [
    {
      label: `Controlador ${input.controller}`,
      value: `G_c(s) = ${tfTex(controller)}`,
      emphasis: true,
    },
    {
      label: 'Parámetros',
      value: `K_p = ${n(settings.kp)},\\ T_i = ${tiTex(settings.ti)},\\ T_d = ${n(settings.td)}`,
    },
  ];
  if (kcr !== null && pcr !== null)
    summary.push({
      label: 'Críticos',
      value: `K_{cr} = ${n(kcr)},\\ P_{cr} = ${n(pcr)}\\ \\text{s}`,
    });
  if (overshoot !== null)
    summary.push({
      label: 'Sobrepaso en lazo cerrado',
      value: `M_p = ${n(100 * overshoot)}\\,\\%`,
    });

  return {
    ok: true,
    value: {
      settings,
      table,
      controller,
      criticalGain: kcr,
      criticalPeriod: pcr,
      closedLoop,
      overshoot,
    },
    summary,
    steps,
    tables,
    series,
    notices,
  };
}

export const sintonizacionPid: Calculator<PidInput, PidValue, PidErrorCode> = {
  meta: {
    id: 'sintonizacion-pid',
    title: 'Sintonizado de controladores PID',
    summary: 'Parámetros PID con las reglas de Ziegler-Nichols.',
    citations: [
      { sourceId: 'ogata-1998', locator: 'Sec. 10-2, tablas 10-1 y 10-2 y ejemplo 10-1' },
    ],
  },
  inputSchema,
  // Ogata, ejemplo 10-1: planta 1/[s(s + 1)(s + 5)] con un PID del segundo método.
  example: {
    method: 'planta',
    controller: 'PID',
    delay: 1,
    timeConstant: 10,
    criticalGain: 30,
    criticalPeriod: 2.8099,
    plant: '1/(s(s + 1)(s + 5))',
  },
  solve: solvePid,
};
