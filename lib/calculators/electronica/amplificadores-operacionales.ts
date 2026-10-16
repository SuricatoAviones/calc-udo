/**
 * Circuitos con amplificador operacional ideal (tierra virtual, I de entrada nula), en dos modos:
 *
 * - Circuito: la red se dibuja en el constructor (resistencias, fuentes y amplificadores) y se
 *   resuelve por análisis de nodos con el cortocircuito virtual (`opamp-network.ts`), después de
 *   verificar que cada amplificador tenga realimentación negativa.
 * - Configuración: las configuraciones de los libros con sus fórmulas, descritas abajo.
 *
 * Lineales (Boylestad y Nashelsky, 10.ª ed. en español, sec. 10.5, 11.1 a 11.3):
 *   Inversor:      V_o = −(R_f/R₁)V₁                        (ec. 10.8)
 *   No inversor:   V_o = (1 + R_f/R₁)V₁                     (ec. 10.9)
 *   Seguidor:      V_o = V₁                                 (ec. 10.10)
 *   Sumador:       V_o = −(R_f/R₁·V₁ + R_f/R₂·V₂ + R_f/R₃·V₃) (ec. 10.11)
 *   Restador:      V_o = R₃/(R₁ + R₃)·(R₂ + R₄)/R₂·V₁ − (R₄/R₂)V₂ (ec. 11.5)
 * con la salida limitada a ±V_sat si se da.
 *
 * No lineales (Malvino, 6.ª ed. en español, sec. 22-1 a 22-3):
 *   Comparador con referencia: salida +V_sat si v_in > V_ref (no inversor); con una senoidal de pico
 *   V_p, ciclo de trabajo D = (180° − 2·arcsen(V_ref/V_p))/360° (ejemplos 22-4 y 22-5).
 *   Disparador de Schmitt inversor: B = R₁/(R₁ + R₂), PCS = BV_sat, PCI = −BV_sat, H = 2BV_sat;
 *   no inversor: PCS = (R₁/R₂)V_sat, PCI = −(R₁/R₂)V_sat (ecs. 22-4 a 22-11, ejemplo 22-6).
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import {
  buildTopology,
  circuitDocumentSchema,
  validateTopology,
  type CircuitErrorCode,
} from '../circuitos-y-sistemas/circuit';
import type { Calculator, CalculatorResult, Notice, Series, Step, SummaryItem } from '../types';
import {
  solveOpAmpNetwork,
  type OpAmpNetworkErrorCode,
  type OpAmpNetworkValue,
} from './opamp-network';
import { engText } from './units';

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

const LINEAR = ['inversor', 'no-inversor', 'seguidor', 'sumador', 'diferencial'] as const;

const inputSchema = z
  .object({
    analysis: z.enum(['circuito', 'configuracion']),
    network: circuitDocumentSchema,
    circuit: z.enum([...LINEAR, 'comparador', 'schmitt']),
    v1: finite('V₁'),
    v2: finite('V₂'),
    v3: z
      .number({ error: 'Escribe V₃ o deja el campo vacío.' })
      .refine(Number.isFinite, 'Escribe V₃.')
      .optional(),
    r1: positive('R₁'),
    r2: positive('R₂'),
    r3: optionalPositive('R₃'),
    r4: positive('R₄'),
    rf: positive('R_f'),
    vsat: optionalPositive('V_sat'),
    mode: z.enum(['no-inversor', 'inversor']),
    vref: finite('V_ref'),
    vp: optionalPositive('el pico de la senoidal'),
  })
  .superRefine((v, ctx) => {
    if (v.analysis === 'circuito') return;
    if ((v.circuit === 'comparador' || v.circuit === 'schmitt') && v.vsat === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['vsat'],
        message: 'Escribe V_sat: es el nivel de la salida.',
      });
    }
    if (v.circuit === 'sumador' && (v.v3 === undefined) !== (v.r3 === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: [v.v3 === undefined ? 'v3' : 'r3'],
        message: 'Para una tercera entrada escribe V₃ y R₃ (o deja ambos vacíos).',
      });
    }
    if (v.circuit === 'diferencial' && v.r3 === undefined) {
      ctx.addIssue({ code: 'custom', path: ['r3'], message: 'El restador necesita R₃.' });
    }
  });

export type OpAmpInput = z.infer<typeof inputSchema>;

export type OpAmpValue =
  | { kind: 'lineal'; vo: number; gain?: number; saturated: boolean }
  | { kind: 'comparador'; vo: number; vref: number; duty?: number }
  | { kind: 'schmitt'; b?: number; pcs: number; pci: number; h: number }
  | ({ kind: 'red' } & OpAmpNetworkValue);

export type OpAmpErrorCode = OpAmpNetworkErrorCode | CircuitErrorCode;

const NAMES: Record<OpAmpInput['circuit'], string> = {
  inversor: 'Amplificador inversor',
  'no-inversor': 'Amplificador no inversor',
  seguidor: 'Seguidor de voltaje',
  sumador: 'Amplificador sumador',
  diferencial: 'Restador (amplificador diferencial)',
  comparador: 'Comparador',
  schmitt: 'Disparador de Schmitt',
};

const volts = (v: number) => `${n(v)}\\ \\text{V}`;

function clip(vo: number, vsat: number | undefined) {
  if (vsat === undefined || Math.abs(vo) <= vsat) return { vo, saturated: false };
  return { vo: Math.sign(vo) * vsat, saturated: true };
}

function transferSeries(gain: number, vsat: number | undefined, vin: number, vo: number): Series {
  const limit = vsat ?? Math.max(Math.abs(vo), 1) * 1.5;
  const knee = gain !== 0 ? limit / Math.abs(gain) : Infinity;
  const span = Math.max(Math.abs(vin) * 1.5, Number.isFinite(knee) ? knee * 1.5 : 1);
  const points: { x: number; y: number }[] = [];
  const f = (x: number) => Math.max(-limit, Math.min(limit, gain * x));
  const xs = new Set([-span, span, 0]);
  if (vsat !== undefined && Number.isFinite(knee)) {
    xs.add(-knee);
    xs.add(knee);
  }
  for (const x of [...xs].sort((a, b) => a - b)) points.push({ x, y: f(x) });
  return {
    id: 'transferencia',
    title: 'Función de transferencia',
    xLabel: 'V₁ (V)',
    yLabel: 'V_o (V)',
    label: 'V_o',
    points,
    scatter: { label: 'Punto de trabajo', points: [{ x: vin, y: vo }] },
  };
}

function solveLinear(input: OpAmpInput): CalculatorResult<OpAmpValue, OpAmpErrorCode> {
  const { circuit, v1, v2, r1, r2, rf, vsat } = input;
  const steps: Step[] = [];
  let ideal: number;
  let gain: number | undefined;

  steps.push({
    title: NAMES[circuit],
    explanation:
      'Amplificador operacional ideal con realimentación negativa: la ganancia en lazo abierto tan grande obliga a que las dos entradas tengan casi el mismo voltaje (tierra virtual o cortocircuito virtual) y no entra corriente a ellas.',
  });

  if (circuit === 'inversor') {
    gain = -rf / r1;
    ideal = gain * v1;
    steps.push({
      title: 'Ganancia del inversor',
      explanation:
        'La entrada inversora está a 0 V: la corriente V₁/R₁ pasa toda por R_f, y la salida queda con la polaridad opuesta.',
      formula: 'A_v = -\\frac{R_f}{R_1},\\qquad V_o = A_v V_1',
      substitution: `A_v = -\\frac{${n(rf)}}{${n(r1)}}`,
      result: `A_v = ${n(gain)},\\quad V_o = ${volts(ideal)}`,
    });
  } else if (circuit === 'no-inversor') {
    gain = 1 + rf / r1;
    ideal = gain * v1;
    steps.push({
      title: 'Ganancia del no inversor',
      explanation:
        'La entrada inversora sigue a V₁; el divisor R₁–R_f devuelve una fracción de V_o igual a V₁.',
      formula: 'A_v = 1 + \\frac{R_f}{R_1},\\qquad V_o = A_v V_1',
      substitution: `A_v = 1 + \\frac{${n(rf)}}{${n(r1)}}`,
      result: `A_v = ${n(gain)},\\quad V_o = ${volts(ideal)}`,
    });
  } else if (circuit === 'seguidor') {
    gain = 1;
    ideal = v1;
    steps.push({
      title: 'Seguidor de voltaje',
      explanation:
        'La salida está unida a la entrada inversora: ganancia unitaria, sin inversión, con impedancia de entrada muy alta y de salida muy baja.',
      formula: 'V_o = V_1',
      result: `V_o = ${volts(ideal)}`,
    });
  } else if (circuit === 'sumador') {
    const terms = [
      { v: v1, r: r1, k: 1 },
      { v: v2, r: r2, k: 2 },
      ...(input.v3 !== undefined && input.r3 !== undefined
        ? [{ v: input.v3, r: input.r3, k: 3 }]
        : []),
    ];
    ideal = -terms.reduce((s, t) => s + (rf / t.r) * t.v, 0);
    steps.push({
      title: 'Suma ponderada',
      explanation:
        'Cada entrada aporta una corriente V_k/R_k hacia la tierra virtual; todas pasan por R_f.',
      formula: `V_o = -\\left(${terms.map((t) => `\\frac{R_f}{R_${t.k}}V_${t.k}`).join(' + ')}\\right)`,
      substitution: `V_o = -\\left(${terms.map((t) => `\\frac{${n(rf)}}{${n(t.r)}}(${n(t.v)})`).join(' + ')}\\right)`,
      result: `V_o = ${volts(ideal)}`,
    });
  } else {
    const r3 = input.r3!;
    const r4 = input.r4;
    const k1 = (r3 / (r1 + r3)) * ((r2 + r4) / r2);
    const k2 = r4 / r2;
    ideal = k1 * v1 - k2 * v2;
    steps.push({
      title: 'Restador con un solo amplificador',
      explanation:
        'Por superposición: V₁ llega a la entrada no inversora por el divisor R₁–R₃ y se amplifica como en el no inversor; V₂ se amplifica como en el inversor.',
      formula: 'V_o = \\frac{R_3}{R_1 + R_3}\\cdot\\frac{R_2 + R_4}{R_2}V_1 - \\frac{R_4}{R_2}V_2',
      substitution: `V_o = \\frac{${n(r3)}}{${n(r1)} + ${n(r3)}}\\cdot\\frac{${n(r2)} + ${n(r4)}}{${n(r2)}}(${n(v1)}) - \\frac{${n(r4)}}{${n(r2)}}(${n(v2)})`,
      result: `V_o = ${n(k1)}V_1 - ${n(k2)}V_2 = ${volts(ideal)}`,
    });
  }

  const { vo, saturated } = clip(ideal, vsat);
  const notices: Notice[] = [];
  if (saturated) {
    steps.push({
      title: 'Saturación',
      explanation: `La salida ideal (${engText(ideal, 'V')}) supera el nivel de saturación: el amplificador queda recortado en ${engText(vo, 'V')}.`,
      formula: '|V_o| \\le V_{sat}',
      result: `V_o = ${volts(vo)}`,
    });
    notices.push({
      level: 'warning',
      message: `La salida se satura en ${engText(vo, 'V')}: la relación lineal ya no vale.`,
    });
  }

  const summary: SummaryItem[] = [
    { label: 'V_o', value: volts(vo), emphasis: true },
    ...(gain !== undefined ? [{ label: 'A_v', value: n(gain) }] : []),
  ];
  return {
    ok: true,
    value: { kind: 'lineal', vo, gain, saturated },
    summary,
    steps,
    tables: [],
    series: gain !== undefined ? [transferSeries(gain, vsat, v1, vo)] : [],
    notices,
  };
}

function solveComparator(input: OpAmpInput): CalculatorResult<OpAmpValue, OpAmpErrorCode> {
  const vsat = input.vsat!;
  const { vref, v1: vin, mode } = input;
  const inverting = mode === 'inversor';
  const high = inverting ? vin < vref : vin > vref;
  const vo = high ? vsat : -vsat;
  const steps: Step[] = [
    {
      title: 'Comparador sin realimentación',
      explanation: `Sin realimentación, la ganancia en lazo abierto es tan grande que basta una diferencia de microvoltios entre las entradas para saturar la salida. El punto de conmutación es V_ref = ${engText(vref, 'V')}, aplicada en la entrada ${
        inverting
          ? 'no inversora (la señal entra por la inversora)'
          : 'inversora (la señal entra por la no inversora)'
      }.`,
      formula: inverting
        ? 'v_{in} < V_{ref} \\Rightarrow V_o = +V_{sat},\\qquad v_{in} > V_{ref} \\Rightarrow V_o = -V_{sat}'
        : 'v_{in} > V_{ref} \\Rightarrow V_o = +V_{sat},\\qquad v_{in} < V_{ref} \\Rightarrow V_o = -V_{sat}',
      substitution: `v_{in} = ${n(vin)}\\ ${vin > vref ? '>' : vin < vref ? '<' : '='}\\ V_{ref} = ${n(vref)}`,
      result: `V_o = ${volts(vo)}`,
    },
  ];
  let duty: number | undefined;
  const notices: Notice[] = [];
  if (input.vp !== undefined) {
    const vp = input.vp;
    if (Math.abs(vref) >= vp) {
      duty = vref >= vp ? (inverting ? 1 : 0) : inverting ? 0 : 1;
      notices.push({
        level: 'info',
        message: 'La senoidal nunca cruza V_ref: la salida no conmuta.',
      });
    } else {
      const theta = (Math.asin(vref / vp) * 180) / Math.PI;
      const above = (180 - 2 * theta) / 360;
      duty = inverting ? 1 - above : above;
      steps.push({
        title: 'Ciclo de trabajo con una entrada senoidal',
        explanation: `Con v_in = ${engText(vp, 'V')}·sen θ, la salida cambia cuando la senoidal cruza V_ref, en θ y 180° − θ. Ciclo de trabajo = ancho del pulso alto / periodo (Malvino, ejemplo 22-5).`,
        formula: inverting
          ? '\\theta = \\operatorname{arcsen}\\frac{V_{ref}}{V_p},\\qquad D = 1 - \\frac{180^\\circ - 2\\theta}{360^\\circ}'
          : '\\theta = \\operatorname{arcsen}\\frac{V_{ref}}{V_p},\\qquad D = \\frac{180^\\circ - 2\\theta}{360^\\circ}',
        substitution: `\\theta = \\operatorname{arcsen}\\frac{${n(vref)}}{${n(vp)}} = ${n(theta, 5)}^\\circ`,
        result: `D = ${n(duty, 5)} = ${n(100 * duty, 4)}\\,\\%`,
      });
    }
  }
  const span = Math.max(Math.abs(vref) * 2, Math.abs(vin) * 1.5, input.vp ?? 0, 1);
  const eps = span * 1e-6;
  const lowSide = inverting ? vsat : -vsat;
  const series: Series = {
    id: 'transferencia',
    title: 'Función de transferencia del comparador',
    xLabel: 'v_in (V)',
    yLabel: 'V_o (V)',
    label: 'V_o',
    points: [
      { x: -span, y: lowSide },
      { x: vref, y: lowSide },
      { x: vref + eps, y: -lowSide },
      { x: span, y: -lowSide },
    ],
    scatter: { label: 'Punto de trabajo', points: [{ x: vin, y: vo }] },
  };
  return {
    ok: true,
    value: { kind: 'comparador', vo, vref, duty },
    summary: [
      { label: 'V_o', value: volts(vo), emphasis: true },
      { label: 'V_ref', value: volts(vref) },
      ...(duty !== undefined
        ? [{ label: 'Ciclo de trabajo', value: `${n(100 * duty, 4)}\\,\\%` }]
        : []),
    ],
    steps,
    tables: [],
    series: [series],
    notices,
  };
}

function solveSchmitt(input: OpAmpInput): CalculatorResult<OpAmpValue, OpAmpErrorCode> {
  const vsat = input.vsat!;
  const { r1, r2, mode } = input;
  const inverting = mode === 'inversor';
  const steps: Step[] = [
    {
      title: 'Realimentación positiva',
      explanation:
        'La salida se devuelve a la entrada no inversora: refuerza el estado actual y crea dos puntos de conmutación separados, lo que evita que el ruido produzca falsos disparos.',
    },
  ];
  let b: number | undefined;
  let pcs: number;
  if (inverting) {
    b = r1 / (r1 + r2);
    pcs = b * vsat;
    steps.push({
      title: 'Fracción de realimentación',
      formula: 'B = \\frac{R_1}{R_1 + R_2}',
      substitution: `B = \\frac{${n(r1)}}{${n(r1)} + ${n(r2)}}`,
      result: `B = ${n(b)}`,
    });
    steps.push({
      title: 'Puntos de conmutación',
      explanation: 'Con la salida en +V_sat la referencia es +BV_sat; con −V_sat es −BV_sat.',
      formula: '\\text{PCS} = BV_{sat},\\qquad \\text{PCI} = -BV_{sat}',
      substitution: `\\text{PCS} = (${n(b)})(${n(vsat)})`,
      result: `\\text{PCS} = ${volts(pcs)},\\quad \\text{PCI} = ${volts(-pcs)}`,
    });
  } else {
    pcs = (r1 / r2) * vsat;
    steps.push({
      title: 'Puntos de conmutación (no inversor)',
      explanation:
        'La salida cambia cuando la entrada no inversora cruza 0 V: el divisor R₁–R₂ entre v_in y V_o fija los umbrales.',
      formula:
        '\\text{PCS} = \\frac{R_1}{R_2}V_{sat},\\qquad \\text{PCI} = -\\frac{R_1}{R_2}V_{sat}',
      substitution: `\\text{PCS} = \\frac{${n(r1)}}{${n(r2)}}(${n(vsat)})`,
      result: `\\text{PCS} = ${volts(pcs)},\\quad \\text{PCI} = ${volts(-pcs)}`,
    });
  }
  const pci = -pcs;
  const h = pcs - pci;
  steps.push({
    title: 'Histéresis',
    explanation: `El circuito tolera ruido pico a pico menor que ${engText(h, 'V')} sin falsos disparos.`,
    formula: 'H = \\text{PCS} - \\text{PCI}',
    substitution: `H = ${n(pcs)} - (${n(pci)})`,
    result: `H = ${volts(h)}`,
  });

  const span = Math.max(pcs * 3, 0.5);
  const eps = span * 1e-6;
  const start = inverting ? vsat : -vsat;
  const series: Series = {
    id: 'histeresis',
    title: 'Función de transferencia con histéresis',
    xLabel: 'v_in (V)',
    yLabel: 'V_o (V)',
    label: 'v_in creciente',
    points: [
      { x: -span, y: start },
      { x: pcs, y: start },
      { x: pcs + eps, y: -start },
      { x: span, y: -start },
    ],
    others: [
      {
        label: 'v_in decreciente',
        points: [
          { x: -span, y: start },
          { x: pci - eps, y: start },
          { x: pci, y: -start },
          { x: span, y: -start },
        ],
      },
    ],
  };
  return {
    ok: true,
    value: { kind: 'schmitt', b, pcs, pci, h },
    summary: [
      { label: 'PCS', value: volts(pcs), emphasis: true },
      { label: 'PCI', value: volts(pci), emphasis: true },
      { label: 'Histéresis H', value: volts(h) },
      ...(b !== undefined ? [{ label: 'B', value: n(b) }] : []),
    ],
    steps,
    tables: [],
    series: [series],
    notices: [],
  };
}

function solveNetwork(input: OpAmpInput): CalculatorResult<OpAmpValue, OpAmpErrorCode> {
  const fail = (code: OpAmpErrorCode, message: string, steps: Step[] = []) => ({
    ok: false as const,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error' as const, message }],
  });
  const topology = buildTopology(input.network);
  const structural = validateTopology(topology, { allow: ['opamp'] });
  if (structural) return fail(structural.code, structural.message);
  const notices: Notice[] = [];
  if (!input.network.components.some((c) => c.kind === 'opamp')) {
    notices.push({
      level: 'info',
      message: 'El circuito no tiene amplificadores: se resuelve como un análisis de nodos común.',
    });
  }
  const outcome = solveOpAmpNetwork(topology, input.vsat);
  if (!outcome.ok) return fail(outcome.code, outcome.message, outcome.steps);
  const summary: SummaryItem[] = outcome.value.opamps.flatMap((op) => [
    {
      label: `${op.label}: salida`,
      value: `v_o = ${volts(op.vout)}${op.saturated ? '\\ (\\text{saturado})' : ''}`,
      emphasis: true,
    },
    ...(op.gain !== undefined
      ? [{ label: `${op.label}: ganancia`, value: `A_v = ${n(op.gain)}` }]
      : []),
  ]);
  return {
    ok: true,
    value: { kind: 'red', ...outcome.value },
    summary,
    steps: outcome.steps,
    tables: outcome.tables,
    series: [],
    notices: [...notices, ...outcome.notices],
  };
}

export function solveOpAmp(input: OpAmpInput): CalculatorResult<OpAmpValue, OpAmpErrorCode> {
  if (input.analysis === 'circuito') return solveNetwork(input);
  if (input.circuit === 'comparador') return solveComparator(input);
  if (input.circuit === 'schmitt') return solveSchmitt(input);
  return solveLinear(input);
}

export const amplificadoresOperacionales: Calculator<OpAmpInput, OpAmpValue, OpAmpErrorCode> = {
  meta: {
    id: 'amplificadores-operacionales',
    title: 'Amplificadores operacionales',
    summary:
      'Inversor, no inversor, seguidor, sumador y restador con el amplificador ideal; comparador y disparador de Schmitt.',
    citations: [
      {
        sourceId: 'boylestad-nashelsky-1997',
        locator: '10.ª ed. en español, sec. 10.5 y 11.1 a 11.3, ejemplos 10.5 a 10.7 y 11.1 a 11.8',
      },
      { sourceId: 'malvino-1999', locator: 'Sec. 22-1 a 22-3, ejemplos 22-4 a 22-6' },
    ],
  },
  inputSchema,
  // Boylestad, ejemplo 10.5: inversor con R₁ = 100 kΩ, R_f = 500 kΩ y V₁ = 2 V.
  example: {
    analysis: 'circuito',
    // Inversor dibujado en el tablero: V1 = 2 V, R1 = 100 kΩ, Rf = 500 kΩ (ejemplo 10.5).
    network: {
      components: [
        {
          id: 'v1',
          kind: 'voltage-source',
          a: { x: 0, y: 0 },
          b: { x: 0, y: 4 },
          value: 2,
          label: 'V1',
        },
        {
          id: 'r1',
          kind: 'resistor',
          a: { x: 0, y: 0 },
          b: { x: 4, y: 0 },
          value: 100e3,
          label: 'R1',
        },
        {
          id: 'rf',
          kind: 'resistor',
          a: { x: 4, y: -2 },
          b: { x: 8, y: -2 },
          value: 500e3,
          label: 'Rf',
        },
        {
          id: 'u1',
          kind: 'opamp',
          a: { x: 4, y: 0 },
          b: { x: 4, y: 2 },
          c: { x: 8, y: 1 },
          value: 0,
          label: 'U1',
        },
      ],
      wires: [
        {
          id: 'w1',
          points: [
            { x: 4, y: 0 },
            { x: 4, y: -2 },
          ],
        },
        {
          id: 'w2',
          points: [
            { x: 8, y: -2 },
            { x: 8, y: 1 },
          ],
        },
        {
          id: 'w3',
          points: [
            { x: 4, y: 2 },
            { x: 4, y: 4 },
          ],
        },
        {
          id: 'w4',
          points: [
            { x: 0, y: 4 },
            { x: 4, y: 4 },
          ],
        },
      ],
      ground: { x: 0, y: 4 },
    },
    // Configuración: el mismo inversor con sus fórmulas.
    circuit: 'inversor',
    v1: 2,
    v2: 1,
    r1: 100e3,
    r2: 100e3,
    r4: 100e3,
    rf: 500e3,
    mode: 'no-inversor',
    vref: 0,
  },
  solve: solveOpAmp,
};
