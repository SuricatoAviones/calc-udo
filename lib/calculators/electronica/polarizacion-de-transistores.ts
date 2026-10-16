/**
 * Polarización de cd (punto Q) de transistores de canal n / NPN.
 *
 * BJT: polarización fija, de emisor, por divisor de voltaje (análisis exacto y aproximado) y por
 * realimentación del colector, con la región de trabajo y la recta de carga de cd.
 * FET: JFET y MOSFET de empobrecimiento (ecuación de Shockley) con polarización fija,
 * autopolarización y divisor de voltaje; MOSFET de enriquecimiento con realimentación del drenaje
 * y divisor de voltaje. El punto Q es la intersección de la curva de transferencia con la recta de
 * polarización, que se resuelve como una ecuación de segundo grado.
 *
 * Fuente: Boylestad y Nashelsky, 10.ª ed. en español, cap. 4 (ejemplos 4.1 a 4.12) y cap. 7
 * (ejemplos 7.1 a 7.11).
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, Notice, ResultTable, Series, Step } from '../types';
import { bjtBias, solveFetBias, type BjtConfig } from './bias';
import { engTex, engText } from './units';

const n = (v: number, d = 6) => toLatexNumber(v, d);

const finite = (what: string) =>
  z.number({ error: `Escribe ${what}.` }).refine(Number.isFinite, `Escribe ${what}.`);
const positive = (what: string) =>
  finite(what).refine((v) => v > 0, `${what} debe ser mayor que 0.`);
const nonNegative = (what: string) =>
  finite(what).refine((v) => v >= 0, `${what} no puede ser negativo.`);

const inputSchema = z
  .object({
    device: z.enum(['bjt', 'jfet', 'mosfet-empobrecimiento', 'mosfet-enriquecimiento']),
    bjtConfig: z.enum(['fija', 'emisor', 'divisor', 'realimentacion']),
    method: z.enum(['exacto', 'aproximado']),
    fetConfig: z.enum(['fija', 'autopolarizacion', 'divisor', 'realimentacion']),
    vcc: positive('V_CC'),
    rb: positive('R_B'),
    r1: positive('R₁'),
    r2: positive('R₂'),
    rc: positive('R_C'),
    re: nonNegative('R_E'),
    beta: positive('β'),
    vbe: nonNegative('V_BE'),
    vdd: positive('V_DD'),
    vgg: nonNegative('V_GG'),
    rg1: positive('R₁'),
    rg2: positive('R₂'),
    rd: positive('R_D'),
    rs: positive('R_S'),
    idss: positive('I_DSS'),
    vp: finite('V_P').refine((v) => v < 0, 'En un dispositivo de canal n, V_P es negativo.'),
    idOn: positive('I_D(enc)'),
    vgsOn: finite('V_GS(enc)'),
    vt: positive('V_GS(Th)'),
  })
  .superRefine((v, ctx) => {
    if (v.device === 'bjt') {
      if ((v.bjtConfig === 'emisor' || v.bjtConfig === 'divisor') && v.re <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['re'],
          message: 'Esta configuración necesita R_E mayor que 0.',
        });
      }
      return;
    }
    if (v.device === 'mosfet-enriquecimiento') {
      if (v.fetConfig === 'fija' || v.fetConfig === 'autopolarizacion') {
        ctx.addIssue({
          code: 'custom',
          path: ['fetConfig'],
          message:
            'El MOSFET de enriquecimiento necesita V_GS > V_GS(Th) > 0: usa realimentación o divisor de voltaje.',
        });
      }
      if (v.vgsOn <= v.vt) {
        ctx.addIssue({
          code: 'custom',
          path: ['vgsOn'],
          message: 'V_GS(enc) debe ser mayor que V_GS(Th).',
        });
      }
    } else if (v.fetConfig === 'realimentacion') {
      ctx.addIssue({
        code: 'custom',
        path: ['fetConfig'],
        message:
          'La realimentación del drenaje (V_GS = V_DS > 0) es propia del MOSFET de enriquecimiento.',
      });
    }
  });

export type BiasInput = z.infer<typeof inputSchema>;

export type BiasValue =
  | {
      device: 'bjt';
      ib: number;
      ic: number;
      ie: number;
      vce: number;
      vb: number;
      vc: number;
      ve: number;
      vbc: number;
      icSat: number;
      region: 'activa' | 'saturacion' | 'corte';
      approxValid?: boolean;
    }
  | {
      device: 'fet';
      vgs: number;
      id: number;
      vds: number;
      vd: number;
      vs: number;
      vg: number;
      /** Constante del dispositivo: I_DSS/V_P² (Shockley) o k (enriquecimiento). */
      k: number;
      region: 'saturacion' | 'ohmica' | 'corte';
    };

export type BiasErrorCode = never;

const BJT_NAME: Record<BjtConfig, string> = {
  fija: 'polarización fija',
  emisor: 'polarización de emisor',
  divisor: 'polarización por divisor de voltaje',
  realimentacion: 'polarización por realimentación del colector',
};

const BJT_REGION: Record<'activa' | 'saturacion' | 'corte', string> = {
  activa: 'activa',
  saturacion: 'saturación',
  corte: 'corte',
};

function solveBjt(input: BiasInput): CalculatorResult<BiasValue, BiasErrorCode> {
  const config = input.bjtConfig;
  const r = bjtBias({
    config,
    method: input.method,
    vcc: input.vcc,
    rb: input.rb,
    r1: input.r1,
    r2: input.r2,
    rc: input.rc,
    re: input.re,
    beta: input.beta,
    vbe: input.vbe,
  });
  const notices: Notice[] = [];
  if (config === 'divisor' && input.method === 'aproximado' && r.approxValid === false) {
    notices.push({
      level: 'warning',
      message:
        'βR_E < 10R₂: el análisis aproximado puede diferir bastante del exacto (en el ejemplo 4.11 de Boylestad, I_C sale 30 % mayor).',
    });
  }
  if (r.region === 'saturacion') {
    notices.push({
      level: 'warning',
      message: 'El transistor está saturado: la señal amplificada se recortaría.',
    });
  } else if (r.region === 'corte') {
    notices.push({
      level: 'warning',
      message: 'El transistor está en corte: la unión base-emisor no alcanza V_BE.',
    });
  }

  const re = config === 'fija' ? 0 : input.re;
  const toMa = 1000;
  const series: Series = {
    id: 'recta-de-carga',
    title: 'Recta de carga de cd y punto Q',
    xLabel: 'V_CE (V)',
    yLabel: 'I_C (mA)',
    label: 'Recta de carga',
    points: [
      { x: 0, y: r.icSat * toMa },
      { x: input.vcc, y: 0 },
    ],
    scatter: { label: 'Punto Q', points: [{ x: r.vce, y: r.ic * toMa }] },
  };

  return {
    ok: true,
    value: {
      device: 'bjt',
      ib: r.ib,
      ic: r.ic,
      ie: r.ie,
      vce: r.vce,
      vb: r.vb,
      vc: r.vc,
      ve: r.ve,
      vbc: r.vbc,
      icSat: r.icSat,
      region: r.region,
      approxValid: r.approxValid,
    },
    summary: [
      { label: 'I_CQ', value: engTex(r.ic, 'A'), emphasis: true },
      { label: 'V_CEQ', value: `${n(r.vce, 5)}\\ \\text{V}`, emphasis: true },
      { label: 'I_B', value: engTex(r.ib, 'A') },
      { label: 'V_B', value: `${n(r.vb, 5)}\\ \\text{V}` },
      { label: 'V_C', value: `${n(r.vc, 5)}\\ \\text{V}` },
      { label: 'V_E', value: `${n(r.ve, 5)}\\ \\text{V}` },
      { label: 'V_BC', value: `${n(r.vbc, 5)}\\ \\text{V}` },
      { label: 'Región', value: `\\text{${BJT_REGION[r.region]}}` },
    ],
    steps: [
      {
        title: 'Configuración',
        explanation: `Transistor NPN con ${BJT_NAME[config]}${
          config === 'divisor' ? ` (análisis ${input.method})` : ''
        }, β = ${n(input.beta, 6)} y V_BE = ${engText(input.vbe, 'V')}. Para el análisis de cd los capacitores son circuitos abiertos.`,
      },
      ...r.steps,
      {
        title: 'Recta de carga de cd',
        explanation:
          'La malla de salida impone una recta en el plano I_C–V_CE: corta al eje de corriente en I_C(sat) (V_CE = 0) y al de voltaje en V_CC (I_C = 0). El punto Q está sobre ella.',
        formula:
          re > 0
            ? 'I_C = \\frac{V_{CC} - V_{CE}}{R_C + R_E}'
            : 'I_C = \\frac{V_{CC} - V_{CE}}{R_C}',
        result: `I_{C(sat)} = ${engTex(r.icSat, 'A')},\\quad V_{CE(\\text{corte})} = ${n(input.vcc)}\\ \\text{V}`,
      },
    ],
    tables: [],
    series: [series],
    notices,
  };
}

function solveFet(input: BiasInput): CalculatorResult<BiasValue, BiasErrorCode> {
  const steps: Step[] = [];
  const notices: Notice[] = [];
  const enhancement = input.device === 'mosfet-enriquecimiento';
  const name = input.device === 'jfet' ? 'JFET' : 'MOSFET';
  const config = input.fetConfig;
  const vdd = input.vdd;
  const rd = input.rd;
  const rs = config === 'divisor' || config === 'autopolarizacion' ? input.rs : 0;

  // Curva de transferencia: I_D = K(V_GS − V_x)² para V_GS > V_x.
  let k: number;
  let vx: number;
  let curveTop: number;
  if (enhancement) {
    vx = input.vt;
    k = input.idOn / (input.vgsOn - input.vt) ** 2;
    curveTop = input.idOn;
    steps.push({
      title: 'Constante del MOSFET de enriquecimiento',
      explanation: `Con el punto de la hoja de datos I_D(enc) = ${engText(input.idOn, 'A')} a V_GS(enc) = ${engText(input.vgsOn, 'V')} se despeja k.`,
      formula:
        'k = \\frac{I_{D(\\text{enc})}}{\\left(V_{GS(\\text{enc})} - V_{GS(\\text{Th})}\\right)^{2}},\\qquad I_D = k\\left(V_{GS} - V_{GS(\\text{Th})}\\right)^{2}',
      substitution: `k = \\frac{${n(input.idOn)}}{(${n(input.vgsOn)} - ${n(input.vt)})^{2}}`,
      result: `k = ${n(k)}\\ \\text{A/V}^{2}`,
    });
  } else {
    vx = input.vp;
    k = input.idss / (input.vp * input.vp);
    curveTop = input.idss;
    steps.push({
      title: `Curva de transferencia del ${name}`,
      explanation:
        'La ecuación de Shockley vale en la región de saturación (corriente constante) y para V_GS ≥ V_P. Equivale a I_D = (I_DSS/V_P²)(V_GS − V_P)², la forma que se usa abajo.',
      formula:
        'I_D = I_{DSS}\\left(1 - \\frac{V_{GS}}{V_P}\\right)^{2} = \\frac{I_{DSS}}{V_P^{2}}\\left(V_{GS} - V_P\\right)^{2}',
      substitution: `I_D = ${n(input.idss)}\\left(1 - \\frac{V_{GS}}{${n(input.vp)}}\\right)^{2}`,
      result: `\\frac{I_{DSS}}{V_P^{2}} = ${n(k)}\\ \\text{A/V}^{2}`,
    });
  }

  // Recta de polarización: V_GS = V₀ − R·I_D.
  let v0: number;
  let r: number;
  let vg: number;
  if (config === 'fija') {
    v0 = -input.vgg;
    r = 0;
    vg = v0;
    steps.push({
      title: 'Recta de polarización (fija)',
      explanation:
        'I_G = 0, así que R_G no tiene caída: la fuente V_GG queda entre compuerta y fuente. Es una recta vertical.',
      formula: 'V_{GS} = -V_{GG}',
      result: `V_{GSQ} = ${n(v0)}\\ \\text{V}`,
    });
  } else if (config === 'autopolarizacion') {
    v0 = 0;
    r = rs;
    vg = 0;
    steps.push({
      title: 'Recta de autopolarización',
      explanation:
        'La compuerta está a 0 V (I_G = 0) y la fuente a I_D R_S: la recta pasa por el origen.',
      formula: 'V_{GS} = -I_D R_S',
      substitution: `V_{GS} = -I_D(${n(rs)})`,
    });
  } else if (config === 'divisor') {
    vg = (input.rg2 * vdd) / (input.rg1 + input.rg2);
    v0 = vg;
    r = rs;
    steps.push({
      title: 'Voltaje de compuerta',
      explanation: 'I_G = 0, así que R₁ y R₂ forman un divisor de voltaje sin carga.',
      formula: 'V_G = \\frac{R_2 V_{DD}}{R_1 + R_2}',
      substitution: `V_G = \\frac{(${n(input.rg2)})(${n(vdd)})}{${n(input.rg1)} + ${n(input.rg2)}}`,
      result: `V_G = ${n(vg)}\\ \\text{V}`,
    });
    steps.push({
      title: 'Recta de polarización',
      explanation: `Corta al eje V_GS en V_G (I_D = 0) y al eje I_D en V_G/R_S = ${engText(vg / rs, 'A')} (V_GS = 0).`,
      formula: 'V_{GS} = V_G - I_D R_S',
      substitution: `V_{GS} = ${n(vg)} - I_D(${n(rs)})`,
    });
  } else {
    v0 = vdd;
    r = rd;
    vg = Number.NaN;
    steps.push({
      title: 'Recta de polarización (realimentación del drenaje)',
      explanation: 'I_G = 0, así que R_G no tiene caída: V_G = V_D y V_GS = V_DS.',
      formula: 'V_{GS} = V_{DS} = V_{DD} - I_D R_D',
      substitution: `V_{GS} = ${n(vdd)} - I_D(${n(rd)})`,
    });
  }

  let vgs: number;
  let id: number;
  let region: 'saturacion' | 'ohmica' | 'corte';
  if (v0 <= vx) {
    vgs = v0;
    id = 0;
    region = 'corte';
    steps.push({
      title: 'Punto de operación',
      explanation: `Con I_D = 0 el voltaje compuerta-fuente es ${engText(v0, 'V')}, que no supera ${
        enhancement ? 'V_GS(Th)' : 'V_P'
      } = ${engText(vx, 'V')}: el ${name} está en corte.`,
      result: `V_{GSQ} = ${n(vgs)}\\ \\text{V},\\quad I_{DQ} = 0`,
    });
  } else if (r === 0) {
    vgs = v0;
    id = k * (vgs - vx) ** 2;
    region = 'saturacion';
    steps.push({
      title: 'Punto de operación',
      explanation: 'V_GS queda fijo por la red: basta sustituirlo en la ecuación del dispositivo.',
      formula: 'I_{DQ} = I_{DSS}\\left(1 - \\frac{V_{GSQ}}{V_P}\\right)^{2}',
      substitution: `I_{DQ} = ${n(input.idss)}\\left(1 - \\frac{${n(vgs)}}{${n(input.vp)}}\\right)^{2}`,
      result: `I_{DQ} = ${engTex(id, 'A')}`,
    });
  } else {
    // v0 > vx garantiza una raíz con V_GS > V_x (ver solveFetBias).
    const q = solveFetBias(v0, r, k, vx, name)!;
    vgs = q.vgs;
    id = q.id;
    region = 'saturacion';
    steps.push(q.step);
  }

  const vs = id * rs;
  const vd = vdd - id * rd;
  const vds = vd - vs;
  if (config === 'realimentacion') vg = vd;
  steps.push({
    title: 'Voltaje drenaje-fuente',
    formula: rs > 0 ? 'V_{DS} = V_{DD} - I_D(R_D + R_S)' : 'V_{DS} = V_{DD} - I_D R_D',
    substitution:
      rs > 0
        ? `V_{DS} = ${n(vdd)} - (${n(id)})(${n(rd)} + ${n(rs)})`
        : `V_{DS} = ${n(vdd)} - (${n(id)})(${n(rd)})`,
    result: `V_{DS} = ${n(vds)}\\ \\text{V}`,
  });
  steps.push({
    title: 'Tensiones de los terminales',
    formula: 'V_S = I_D R_S,\\qquad V_D = V_{DD} - I_D R_D',
    result: `V_S = ${n(vs)}\\ \\text{V},\\ V_D = ${n(vd)}\\ \\text{V},\\ V_G = ${n(vg)}\\ \\text{V}`,
  });

  if (region === 'saturacion') {
    const limit = vgs - vx;
    if (vds < limit) region = 'ohmica';
    steps.push({
      title: 'Comprobación de la región de saturación',
      explanation:
        region === 'saturacion'
          ? `V_DS supera V_GS − ${enhancement ? 'V_GS(Th)' : 'V_P'}: el canal está estrangulado y la ecuación usada es válida.`
          : `V_DS no alcanza V_GS − ${enhancement ? 'V_GS(Th)' : 'V_P'}: el punto queda a la izquierda del lugar geométrico del estrangulamiento, en la región óhmica, donde la ecuación de saturación solo es una aproximación.`,
      formula: enhancement ? 'V_{DS} \\ge V_{GS} - V_{GS(\\text{Th})}' : 'V_{DS} \\ge V_{GS} - V_P',
      substitution: `${n(vds)} ${region === 'saturacion' ? '\\ge' : '<'} ${n(vgs)} - (${n(vx)})`,
      result: `${n(vds)}\\ \\text{V}\\ ${region === 'saturacion' ? '\\ge' : '<'}\\ ${n(limit)}\\ \\text{V}`,
    });
  }

  if (region === 'ohmica') {
    notices.push({
      level: 'warning',
      message: `V_DS es menor que V_GS − ${enhancement ? 'V_GS(Th)' : 'V_P'}: el ${name} estaría en la región óhmica y el punto Q es solo aproximado. Muchos ejercicios omiten esta comprobación; para un amplificador conviene reducir R_D.`,
    });
  } else if (region === 'corte') {
    notices.push({ level: 'warning', message: `El ${name} está en corte (I_D = 0).` });
  }
  if (input.device === 'jfet' && vgs > 0) {
    notices.push({
      level: 'warning',
      message:
        'V_GS > 0 polariza en directa la unión compuerta-canal del JFET: el análisis deja de ser válido.',
    });
  }

  // Tabla de puntos para trazar la curva, como en el libro.
  const toMa = 1000;
  const sample = enhancement
    ? [vx, (vx + input.vgsOn) / 2, input.vgsOn, input.vgsOn + (input.vgsOn - vx) / 2]
    : [vx, 0.5 * vx, 0.3 * vx, 0];
  const tables: ResultTable[] = [
    {
      id: 'curva',
      title: 'Puntos de la curva de transferencia',
      columns: [
        { key: 'vgs', header: 'V_{GS}\\ (\\text{V})' },
        { key: 'id', header: 'I_D\\ (\\text{mA})' },
      ],
      rows: sample.map((u) => ({ vgs: u, id: k * (u - vx) ** 2 * toMa })),
    },
  ];

  const yMax = 1.25 * Math.max(id, curveTop);
  const span = Math.abs(enhancement ? input.vgsOn - vx : vx);
  const xRight = enhancement
    ? Math.max(vgs, input.vgsOn) + span / 2
    : input.device === 'jfet'
      ? Math.max(0, vgs)
      : Math.max(0, vgs) + span / 3;
  const curve: { x: number; y: number }[] = [];
  for (let i = 0; i <= 80; i++) {
    const u = vx + ((xRight - vx) * i) / 80;
    const y = k * (u - vx) ** 2;
    if (y > yMax) break;
    curve.push({ x: u, y: y * toMa });
  }
  const others: Series['others'] = [];
  if (r > 0) {
    const left = Math.max(v0 - yMax * r, Math.min(vx, vgs));
    others.push({
      label: 'Recta de polarización',
      points: [
        { x: left, y: ((v0 - left) / r) * toMa },
        { x: v0, y: 0 },
      ],
    });
  }
  const series: Series = {
    id: 'transferencia',
    title: 'Curva de transferencia, recta de polarización y punto Q',
    xLabel: 'V_GS (V)',
    yLabel: 'I_D (mA)',
    label: name,
    points: curve,
    others,
    scatter: { label: 'Punto Q', points: [{ x: vgs, y: id * toMa }] },
  };

  return {
    ok: true,
    value: { device: 'fet', vgs, id, vds, vd, vs, vg, k, region },
    summary: [
      { label: 'I_DQ', value: engTex(id, 'A'), emphasis: true },
      { label: 'V_GSQ', value: `${n(vgs, 5)}\\ \\text{V}`, emphasis: true },
      { label: 'V_DS', value: `${n(vds, 5)}\\ \\text{V}` },
      { label: 'V_D', value: `${n(vd, 5)}\\ \\text{V}` },
      { label: 'V_S', value: `${n(vs, 5)}\\ \\text{V}` },
      {
        label: 'Región',
        value: `\\text{${region === 'saturacion' ? 'saturación' : region === 'ohmica' ? 'óhmica' : 'corte'}}`,
      },
    ],
    steps: [
      {
        title: 'Configuración',
        explanation: `${
          input.device === 'jfet'
            ? 'JFET'
            : enhancement
              ? 'MOSFET de enriquecimiento'
              : 'MOSFET de empobrecimiento'
        } de canal n con ${
          config === 'fija'
            ? 'polarización fija'
            : config === 'autopolarizacion'
              ? 'autopolarización'
              : config === 'divisor'
                ? 'divisor de voltaje'
                : 'realimentación del drenaje'
        }. La corriente de compuerta es nula (I_G = 0), así que I_S = I_D.`,
      },
      ...steps,
    ],
    tables,
    series: [series],
    notices,
  };
}

export function solveBias(input: BiasInput): CalculatorResult<BiasValue, BiasErrorCode> {
  return input.device === 'bjt' ? solveBjt(input) : solveFet(input);
}

export const polarizacionDeTransistores: Calculator<BiasInput, BiasValue, BiasErrorCode> = {
  meta: {
    id: 'polarizacion-de-transistores',
    title: 'Polarización de transistores (análisis DC)',
    summary:
      'Punto Q de BJT (fija, emisor, divisor y realimentación) y de JFET y MOSFET, con la recta de carga o de polarización.',
    citations: [
      {
        sourceId: 'boylestad-nashelsky-1997',
        locator: '10.ª ed. en español, caps. 4 y 7, ejemplos 4.1 a 4.12 y 7.1 a 7.11',
      },
    ],
  },
  inputSchema,
  // Boylestad, ejemplo 4.8: divisor de voltaje con β = 100 (análisis exacto).
  example: {
    device: 'bjt',
    bjtConfig: 'divisor',
    method: 'exacto',
    fetConfig: 'divisor',
    vcc: 22,
    rb: 240e3,
    r1: 39e3,
    r2: 3.9e3,
    rc: 10e3,
    re: 1.5e3,
    beta: 100,
    vbe: 0.7,
    vdd: 16,
    vgg: 2,
    rg1: 2.1e6,
    rg2: 270e3,
    rd: 2.4e3,
    rs: 1.5e3,
    idss: 8e-3,
    vp: -4,
    idOn: 3e-3,
    vgsOn: 10,
    vt: 5,
  },
  solve: solveBias,
};
