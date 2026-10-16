/**
 * Diodo en serie con una resistencia y una fuente de cd: estado del diodo, recta de carga, punto
 * de operación y potencias, con los modelos de los libros.
 *
 *   Ideal:              V_D = 0 al conducir (interruptor cerrado).
 *   Segunda aproximación: V_D = V_K (0.7 V el silicio, 0.3 V el germanio).
 *   Tercera aproximación (lineal por segmentos): V_D = V_K + I_D·r_B.
 *   Característica real (Shockley): I_D = I_S(e^{V_D/(nV_T)} − 1), resuelta con la recta de carga
 *   por el método de Newton.
 *
 * Con varios diodos en serie se suman sus V_K (p. ej. silicio + LED = 0.7 + 1.8 V).
 *
 * Fuentes: Boylestad y Nashelsky, 10.ª ed. en español, sec. 2.2 y 2.3 (ejemplos 2.1 a 2.7);
 * Malvino, 6.ª ed. en español, sec. 3-2 a 3-4 (ejemplos 3-6, 3-8 y 3-9).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, ResultTable, Series, Step } from '../types';
import { engTex, engText } from './units';

const n = (v: number, d = 6) => toLatexNumber(v, d);

const finite = (what: string) =>
  z.number({ error: `Escribe ${what}.` }).refine(Number.isFinite, `Escribe ${what}.`);
const positive = (what: string) =>
  finite(what).refine((v) => v > 0, `${what} debe ser mayor que 0.`);
const nonNegative = (what: string) =>
  finite(what).refine((v) => v >= 0, `${what} no puede ser negativo.`);

const inputSchema = z.object({
  source: finite('E'),
  resistance: positive('R'),
  orientation: z.enum(['directa', 'inversa']),
  model: z.enum(['ideal', 'segunda', 'tercera', 'real']),
  vk: nonNegative('V_K'),
  rb: nonNegative('r_B'),
  is: positive('I_S'),
  n: finite('n').refine(
    (v) => v >= 1 && v <= 3,
    'n debe estar entre 1 y 3 (suele estar entre 1 y 2).',
  ),
  vt: positive('V_T'),
});

export type DiodeInput = z.infer<typeof inputSchema>;

export interface DiodeValue {
  conducting: boolean;
  /** Corriente en el sentido de la flecha del diodo. */
  id: number;
  /** Voltaje ánodo − cátodo. */
  vd: number;
  vr: number;
  pd: number;
  pr: number;
  iterations?: number;
}

export type DiodeErrorCode = 'no-converge';

const MODEL_NAME: Record<DiodeInput['model'], string> = {
  ideal: 'modelo ideal',
  segunda: 'segunda aproximación (modelo aproximado)',
  tercera: 'tercera aproximación (lineal por segmentos)',
  real: 'característica real (ecuación de Shockley)',
};

/** Resuelve I_S(e^{V/(nV_T)} − 1) = (E − V)/R por Newton con respaldo de bisección. */
function solveShockley(input: DiodeInput, e: number) {
  const { resistance: R, is, n: ideality, vt } = input;
  const nvt = ideality * vt;
  const f = (v: number) => is * Math.expm1(v / nvt) - (e - v) / R;
  const df = (v: number) => (is / nvt) * Math.exp(v / nvt) + 1 / R;
  let lo = Math.min(0, e);
  let hi = Math.max(0, e);
  // Arranque: si toda la corriente fuera E/R, el diodo tendría nV_T·ln(E/(R·I_S) + 1).
  let v = e > 0 ? Math.min(e, nvt * Math.log(e / (R * is) + 1)) : e;
  const rows: { k: number; v: number; idiode: number; inet: number; f: number }[] = [];
  for (let k = 0; k < 100; k++) {
    const fv = f(v);
    rows.push({ k, v, idiode: is * Math.expm1(v / nvt), inet: (e - v) / R, f: fv });
    if (fv > 0) hi = v;
    else lo = v;
    let next = v - fv / df(v);
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    if (Math.abs(next - v) <= 1e-13 * Math.max(1, Math.abs(v))) {
      rows.push({
        k: k + 1,
        v: next,
        idiode: is * Math.expm1(next / nvt),
        inet: (e - next) / R,
        f: f(next),
      });
      return { ok: true as const, v: next, rows };
    }
    v = next;
  }
  return { ok: false as const, v, rows };
}

export function solveDiode(input: DiodeInput): CalculatorResult<DiodeValue, DiodeErrorCode> {
  const { resistance: R, model } = input;
  // Voltaje que polariza el diodo en directa (con la orientación elegida).
  const e = input.orientation === 'directa' ? input.source : -input.source;
  const vk = model === 'ideal' || model === 'real' ? 0 : input.vk;
  const rb = model === 'tercera' ? input.rb : 0;
  const steps: Step[] = [];
  const tables: ResultTable[] = [];

  steps.push({
    title: 'Circuito',
    explanation: `Diodo en serie con R = ${engText(R, 'Ω')} y una fuente de ${engText(input.source, 'V')}${
      input.orientation === 'inversa'
        ? ', con el diodo invertido respecto del sentido en que la fuente empuja la corriente'
        : ''
    }. Se usa el ${MODEL_NAME[model]}.`,
    formula: 'E - V_D - V_R = 0,\\qquad V_R = I_D R',
    result: `E_{\\text{directa}} = ${n(e)}\\ \\text{V}`,
  });

  steps.push({
    title: 'Recta de carga',
    explanation:
      'La red impone I_D = (E − V_D)/R: corta al eje de corriente en E/R (V_D = 0) y al de voltaje en E (I_D = 0).',
    formula: 'I_D = \\frac{E - V_D}{R}',
    substitution: `I_D\\big|_{V_D = 0} = \\frac{${n(e)}}{${n(R)}},\\qquad V_D\\big|_{I_D = 0} = ${n(e)}\\ \\text{V}`,
    result: `I_D\\big|_{V_D = 0} = ${engTex(e / R, 'A')}`,
  });

  let conducting: boolean;
  let id: number;
  let vd: number;
  let iterations: number | undefined;

  if (model === 'real') {
    const solved = solveShockley(input, e);
    if (!solved.ok) {
      const message = 'El método de Newton no convergió; revisa I_S, n y V_T.';
      return {
        ok: false,
        error: { code: 'no-converge', message },
        steps,
        tables,
        series: [],
        notices: [{ level: 'error', message }],
      };
    }
    vd = solved.v;
    id = (e - vd) / R;
    conducting = id > 0 && vd > 0;
    iterations = solved.rows.length - 1;
    const nvt = input.n * input.vt;
    steps.push({
      title: 'Característica del diodo',
      explanation: `Ecuación de Shockley con I_S = ${engText(input.is, 'A')}, n = ${formatNumber(input.n, 4)} y V_T = ${engText(input.vt, 'V')}.`,
      formula: 'I_D = I_S\\left(e^{V_D/(nV_T)} - 1\\right)',
      substitution: `I_D = ${n(input.is)}\\left(e^{V_D/${n(nvt)}} - 1\\right)`,
    });
    steps.push({
      title: 'Punto de operación (Newton)',
      explanation: `El punto Q cumple a la vez la ecuación del diodo y la recta de carga. Se resuelve f(V_D) = 0 con el método de Newton; convergió en ${iterations} iteraciones (tabla de abajo).`,
      formula:
        "f(V_D) = I_S\\left(e^{V_D/(nV_T)} - 1\\right) - \\frac{E - V_D}{R},\\qquad V_{k+1} = V_k - \\frac{f(V_k)}{f'(V_k)}",
      result: `V_{DQ} = ${n(vd, 6)}\\ \\text{V},\\quad I_{DQ} = ${engTex(id, 'A', 6)}`,
    });
    tables.push({
      id: 'newton',
      title: 'Iteraciones de Newton',
      columns: [
        { key: 'k', header: 'k' },
        { key: 'v', header: 'V_D\\ (\\text{V})' },
        { key: 'idiode', header: 'I_{\\text{diodo}}\\ (\\text{A})' },
        { key: 'inet', header: 'I_{\\text{red}}\\ (\\text{A})' },
        { key: 'f', header: 'f(V_D)' },
      ],
      rows: solved.rows.map((r) => ({ ...r })),
    });
  } else {
    conducting = e > vk;
    steps.push({
      title: 'Estado del diodo',
      explanation: conducting
        ? `La fuente empuja la corriente en el sentido de la flecha y supera el umbral (${engText(e, 'V')} > ${engText(vk, 'V')}): el diodo está encendido.`
        : e > 0
          ? `El voltaje aplicado (${engText(e, 'V')}) no alcanza el umbral V_K = ${engText(vk, 'V')}: el diodo está apagado (circuito abierto).`
          : 'La corriente que impone la fuente va contra la flecha del diodo: está polarizado en inversa y se comporta como circuito abierto.',
      formula:
        model === 'ideal'
          ? 'E > 0\\ \\Rightarrow\\ \\text{encendido}'
          : 'E > V_K\\ \\Rightarrow\\ \\text{encendido}',
      result: conducting ? '\\text{Diodo encendido}' : '\\text{Diodo apagado}',
    });
    if (conducting) {
      id = (e - vk) / (R + rb);
      vd = vk + id * rb;
      steps.push({
        title: 'Corriente del diodo',
        explanation:
          model === 'ideal'
            ? 'El diodo ideal encendido es un cortocircuito: toda la fuente queda en R.'
            : model === 'segunda'
              ? 'Se reemplaza el diodo por una fuente de V_K: la caída es fija para cualquier corriente.'
              : 'Se reemplaza el diodo por V_K en serie con su resistencia interna r_B.',
        formula:
          model === 'tercera'
            ? 'I_D = \\frac{E - V_K}{R + r_B}'
            : model === 'segunda'
              ? 'I_D = \\frac{E - V_K}{R}'
              : 'I_D = \\frac{E}{R}',
        substitution:
          model === 'tercera'
            ? `I_D = \\frac{${n(e)} - ${n(vk)}}{${n(R)} + ${n(rb)}}`
            : model === 'segunda'
              ? `I_D = \\frac{${n(e)} - ${n(vk)}}{${n(R)}}`
              : `I_D = \\frac{${n(e)}}{${n(R)}}`,
        result: `I_D = ${engTex(id, 'A', 6)}`,
      });
      steps.push({
        title: 'Voltaje del diodo',
        formula:
          model === 'tercera'
            ? 'V_D = V_K + I_D r_B'
            : model === 'segunda'
              ? 'V_D = V_K'
              : 'V_D = 0',
        substitution: model === 'tercera' ? `V_D = ${n(vk)} + (${n(id)})(${n(rb)})` : undefined,
        result: `V_D = ${n(vd)}\\ \\text{V}`,
      });
    } else {
      id = 0;
      vd = e;
      steps.push({
        title: 'Voltajes con el diodo apagado',
        explanation:
          'Un circuito abierto puede tener cualquier voltaje entre sus terminales, pero su corriente es 0: toda la fuente queda en el diodo.',
        formula: 'I_D = 0,\\qquad V_R = I_D R = 0,\\qquad V_D = E',
        result: `V_D = ${n(vd)}\\ \\text{V}`,
      });
    }
  }

  const vr = id * R;
  const pd = vd * id;
  const pr = id * id * R;
  steps.push({
    title: 'Voltaje en la resistencia y potencias',
    formula: 'V_R = I_D R,\\qquad P_D = V_D I_D,\\qquad P_R = I_D^{2} R',
    result: `V_R = ${n(vr)}\\ \\text{V},\\quad P_D = ${engTex(pd, 'W')},\\quad P_R = ${engTex(pr, 'W')}`,
  });

  // Gráfica: recta de carga, característica del modelo y punto Q.
  const vMin = Math.min(0, e) - 0.1 * Math.max(1, Math.abs(e));
  const vMax = Math.max(e, vk + 0.2, 0.9) * 1.05;
  const iMax = Math.max(Math.abs(e) / R, Math.abs(id)) * 1.2 || 1e-3;
  const characteristic: { x: number; y: number }[] = [];
  if (model === 'real') {
    const nvt = input.n * input.vt;
    const vTop = Math.min(vMax, nvt * Math.log(iMax / input.is + 1));
    for (let k = 0; k <= 200; k++) {
      const v = vMin + ((vTop - vMin) * k) / 200;
      characteristic.push({ x: v, y: input.is * Math.expm1(v / nvt) });
    }
  } else {
    const vTop = rb > 0 ? Math.min(vMax, vk + iMax * rb) : vk;
    characteristic.push(
      { x: vMin, y: 0 },
      { x: vk, y: 0 },
      { x: vTop, y: rb > 0 ? (vTop - vk) / rb : iMax },
    );
  }
  const series: Series[] = [
    {
      id: 'recta-de-carga',
      title: 'Recta de carga y característica del diodo',
      xLabel: 'V_D (V)',
      yLabel: 'I_D (A)',
      label: 'Recta de carga',
      points: [
        { x: 0, y: e / R },
        { x: e, y: 0 },
      ].sort((a, b) => a.x - b.x),
      others: [{ label: 'Diodo', points: characteristic }],
      scatter: { label: 'Punto Q', points: [{ x: vd, y: id }] },
    },
  ];

  const notices: CalculatorResult<DiodeValue, DiodeErrorCode>['notices'] = [];
  if (model === 'tercera' && rb < 0.01 * R) {
    notices.push({
      level: 'info',
      message: `r_B (${engText(rb, 'Ω')}) es menor que el 1 % de R: según Malvino (ec. 3-6) se puede ignorar y usar la segunda aproximación.`,
    });
  }

  return {
    ok: true,
    value: { conducting, id, vd, vr, pd, pr, iterations },
    summary: [
      { label: 'Estado', value: conducting ? '\\text{encendido}' : '\\text{apagado}' },
      { label: 'I_D', value: engTex(id, 'A', 5), emphasis: true },
      { label: 'V_D', value: `${n(vd, 5)}\\ \\text{V}` },
      { label: 'V_R', value: `${n(vr, 5)}\\ \\text{V}` },
      { label: 'P_D', value: engTex(pd, 'W') },
    ],
    steps,
    tables,
    series,
    notices,
  };
}

export const circuitosConDiodos: Calculator<DiodeInput, DiodeValue, DiodeErrorCode> = {
  meta: {
    id: 'circuitos-con-diodos',
    title: 'Circuitos con diodos',
    summary:
      'Diodo en serie: estado, recta de carga y punto Q con el modelo ideal, las aproximaciones y la ecuación de Shockley.',
    citations: [
      {
        sourceId: 'boylestad-nashelsky-1997',
        locator: '10.ª ed. en español, sec. 2.2 y 2.3, ejemplos 2.1 a 2.7',
      },
      { sourceId: 'malvino-1999', locator: 'Sec. 3-2 a 3-4, ejemplos 3-6, 3-8 y 3-9' },
    ],
  },
  inputSchema,
  // Boylestad, ejemplo 2.4: E = 8 V, R = 2.2 kΩ y un diodo de silicio.
  example: {
    source: 8,
    resistance: 2200,
    orientation: 'directa',
    model: 'segunda',
    vk: 0.7,
    rb: 0,
    is: 1e-11,
    n: 1.5,
    vt: 0.026,
  },
  solve: solveDiode,
};
