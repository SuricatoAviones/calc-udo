/**
 * Fasores e impedancia: una fuente senoidal aplicada a R, L y C en serie o en paralelo.
 *
 *   v(t) = Vm cos(ωt + θ)  →  V = Vm∠θ
 *   Z_R = R,   Z_L = jωL,   Z_C = 1/(jωC) = −j/(ωC)
 *   Serie: Z = Z_R + Z_L + Z_C        Paralelo: 1/Z = 1/Z_R + 1/Z_L + 1/Z_C
 *   I = V/Z  →  i(t) = |I| cos(ωt + ∠I)
 *
 * Fuente: Hayt, Kemmerly y Durbin, 8.ª ed., cap. 10 (sec. 10.4 y 10.5; ejemplos 10.1, 10.3, 10.4 y
 * 10.7).
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
const element = (what: string) => finite(what).refine((v) => v >= 0, 'No puede ser negativo.');

const inputSchema = z
  .object({
    amplitude: finite('la amplitud').refine((v) => v !== 0, 'La amplitud no puede ser 0.'),
    phase: finite('el ángulo de fase'),
    form: z.enum(['cos', 'sin']),
    omega: finite('la frecuencia angular').refine((v) => v > 0, 'ω debe ser mayor que 0.'),
    connection: z.enum(['serie', 'paralelo']),
    resistance: element('R'),
    inductance: element('L'),
    capacitance: element('C'),
  })
  .refine((v) => v.resistance > 0 || v.inductance > 0 || v.capacitance > 0, {
    path: ['resistance'],
    message: 'Escribe al menos un elemento (R, L o C mayor que 0).',
  });

export type PhasorInput = z.infer<typeof inputSchema>;

export interface PhasorValue {
  voltage: Complex;
  impedance: Complex;
  current: Complex;
  elements: { name: 'R' | 'L' | 'C'; impedance: Complex; voltage: Complex; current: Complex }[];
}

export type PhasorErrorCode = 'impedancia-nula' | 'impedancia-infinita';

/** Ángulo en grados llevado a (−180°, 180°]. */
function wrapDegrees(deg: number): number {
  let a = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (a === -180) a = 180;
  return Math.abs(a) < 1e-12 ? 0 : a;
}

function sinusoidTex(
  fn: 'cos' | 'sin',
  amplitude: number,
  omega: number,
  angleDeg: number,
): string {
  const angle = Math.abs(angleDeg) < 1e-12 ? 0 : angleDeg;
  const sign = angle < 0 ? '-' : '+';
  const phase = angle === 0 ? '' : String.raw` ${sign} ${n(Math.abs(angle))}^{\circ}`;
  return `${n(amplitude)}\\${fn}\\left(${n(omega)}t${phase}\\right)`;
}

function timeTex(magnitude: number, omega: number, angleDeg: number): string {
  return sinusoidTex('cos', magnitude, omega, wrapDegrees(angleDeg));
}

/** `(a + jb)`: un complejo entre paréntesis, para sumarlo con otros. */
const parenthesized = (zz: Complex) => `(${rect(zz)})`;
const reciprocalTex = (x: string) => String.raw`\frac{1}{${x}}`;

const ELEMENT_TITLES = { R: 'Resistencia', L: 'Inductor', C: 'Capacitor' } as const;

/**
 * La senoide como coseno con amplitud positiva: sen x = cos(x − 90°) y −cos x = cos(x + 180°).
 * Devuelve también las conversiones hechas, para la traza.
 */
function cosineForm(input: PhasorInput) {
  const { omega } = input;
  let magnitude = input.amplitude;
  let angle = input.phase;
  const conversions: string[] = [];
  if (input.form === 'sin') {
    angle -= 90;
    conversions.push(
      `${sinusoidTex('sin', input.amplitude, omega, input.phase)} = ${sinusoidTex('cos', input.amplitude, omega, angle)}`,
    );
  }
  if (magnitude < 0) {
    magnitude = -magnitude;
    conversions.push(
      `${sinusoidTex('cos', -magnitude, omega, angle)} = ${sinusoidTex('cos', magnitude, omega, angle + 180)}`,
    );
    angle += 180;
  }
  return { magnitude, angle: wrapDegrees(angle), conversions };
}

type PhasorElement = PhasorValue['elements'][number];

/** Impedancia de cada elemento presente (R, L y C mayores que 0) y su paso. */
function elementImpedances(input: PhasorInput) {
  const { omega } = input;
  const elements: Omit<PhasorElement, 'voltage' | 'current'>[] = [];
  const steps: Step[] = [];
  if (input.resistance > 0) {
    elements.push({ name: 'R', impedance: C.complex(input.resistance) });
    steps.push({
      title: 'Resistencia',
      formula: String.raw`\mathbf{Z}_R = R`,
      result: String.raw`\mathbf{Z}_R = ${n(input.resistance)}\ \Omega`,
    });
  }
  if (input.inductance > 0) {
    const zl = C.complex(0, omega * input.inductance);
    elements.push({ name: 'L', impedance: zl });
    steps.push({
      title: 'Inductor',
      explanation: 'La corriente se atrasa 90° respecto del voltaje.',
      formula: String.raw`\mathbf{Z}_L = j\omega L`,
      substitution: String.raw`\mathbf{Z}_L = j(${n(omega)})(${n(input.inductance)})`,
      result: String.raw`\mathbf{Z}_L = ${rect(zl)}\ \Omega`,
    });
  }
  if (input.capacitance > 0) {
    const zc = C.complex(0, -1 / (omega * input.capacitance));
    elements.push({ name: 'C', impedance: zc });
    steps.push({
      title: 'Capacitor',
      explanation: 'La corriente se adelanta 90° respecto del voltaje.',
      formula: String.raw`\mathbf{Z}_C = \frac{1}{j\omega C} = -\frac{j}{\omega C}`,
      substitution: String.raw`\mathbf{Z}_C = -\frac{j}{(${n(omega)})(${n(input.capacitance)})}`,
      result: String.raw`\mathbf{Z}_C = ${rect(zc)}\ \Omega`,
    });
  }
  return { elements, steps };
}

/** Impedancia equivalente: suma en serie; en paralelo, recíproco de la suma de admitancias. */
function equivalentImpedance(
  connection: PhasorInput['connection'],
  elements: Omit<PhasorElement, 'voltage' | 'current'>[],
): { impedance: Complex; step: Step } {
  const names = elements.map((e) => String.raw`\mathbf{Z}_${e.name}`);
  if (connection === 'serie') {
    const impedance = elements.reduce((s, e) => C.add(s, e.impedance), C.ZERO);
    return {
      impedance,
      step: {
        title: 'Impedancia equivalente (serie)',
        formula: String.raw`\mathbf{Z} = ${names.join(' + ')}`,
        substitution: String.raw`\mathbf{Z} = ${elements.map((e) => parenthesized(e.impedance)).join(' + ')}`,
        result: String.raw`\mathbf{Z} = ${rect(impedance)} = ${polar(impedance)}\ \Omega`,
      },
    };
  }
  const admittance = elements.reduce((s, e) => C.add(s, C.div(C.ONE, e.impedance)), C.ZERO);
  const impedance = C.div(C.ONE, admittance);
  const admittances = elements.map((e) => parenthesized(C.div(C.ONE, e.impedance)));
  return {
    impedance,
    step: {
      title: 'Impedancia equivalente (paralelo)',
      explanation: 'En paralelo se suman las admitancias Y = 1/Z.',
      formula: String.raw`\frac{1}{\mathbf{Z}} = ${names.map(reciprocalTex).join(' + ')}`,
      substitution: String.raw`\mathbf{Y} = ${admittances.join(' + ')} = ${rect(admittance)}\ \text{S}`,
      result: String.raw`\mathbf{Z} = \frac{1}{\mathbf{Y}} = ${rect(impedance)} = ${polar(impedance)}\ \Omega`,
    },
  };
}

/** Voltaje (en serie) o corriente (en paralelo) de un elemento, como fasor y en el tiempo. */
function elementStep(e: PhasorElement, connection: PhasorInput['connection'], omega: number): Step {
  const title = ELEMENT_TITLES[e.name];
  if (connection === 'serie') {
    return {
      title,
      formula: String.raw`\mathbf{V}_${e.name} = \mathbf{I}\,\mathbf{Z}_${e.name}`,
      result: String.raw`\mathbf{V}_${e.name} = ${polar(e.voltage)}\ \text{V} \;\rightarrow\; v_${e.name}(t) = ${timeTex(C.abs(e.voltage), omega, C.degrees(C.arg(e.voltage)))}`,
    };
  }
  return {
    title,
    formula: String.raw`\mathbf{I}_${e.name} = \frac{\mathbf{V}}{\mathbf{Z}_${e.name}}`,
    result: String.raw`\mathbf{I}_${e.name} = ${polar(e.current)}\ \text{A} \;\rightarrow\; i_${e.name}(t) = ${timeTex(C.abs(e.current), omega, C.degrees(C.arg(e.current)))}`,
  };
}

/** Carácter del circuito según el ángulo de la impedancia, y cómo queda la corriente. */
function phaseRelation(zAngle: number): { character: string; relation: string } {
  if (Math.abs(zAngle) < 1e-9)
    return { character: 'resistivo', relation: 'está en fase con el voltaje' };
  const degrees = formatNumber(Math.abs(zAngle), DIGITS);
  return zAngle > 0
    ? { character: 'inductivo', relation: `se atrasa ${degrees}° respecto del voltaje` }
    : { character: 'capacitivo', relation: `se adelanta ${degrees}° respecto del voltaje` };
}

export function solvePhasor(input: PhasorInput): CalculatorResult<PhasorValue, PhasorErrorCode> {
  const { omega } = input;
  const steps: Step[] = [];

  // 1. La senoide como coseno con amplitud positiva.
  const { magnitude, angle, conversions } = cosineForm(input);
  const voltage = C.fromPolar(magnitude, C.radians(angle));
  steps.push(
    {
      title: 'Senoide en forma de coseno',
      explanation:
        'El fasor se define a partir de un coseno con amplitud positiva: sen x = cos(x − 90°) y −cos x = cos(x ± 180°).',
      formula: conversions.length > 0 ? conversions.join(String.raw`,\quad `) : undefined,
      result: String.raw`v(t) = ${timeTex(magnitude, omega, angle)}\ \text{V}`,
    },
    {
      title: 'Fasor de voltaje',
      explanation: 'Se suprime la frecuencia: el fasor guarda la amplitud y el ángulo.',
      formula: String.raw`V_m\cos(\omega t + \theta) \;\rightarrow\; \mathbf{V} = V_m\angle\theta`,
      result: String.raw`\mathbf{V} = ${polar(voltage)} = ${rect(voltage)}\ \text{V}`,
    },
  );

  // 2. Impedancias de cada elemento.
  const { elements, steps: impedanceSteps } = elementImpedances(input);
  steps.push({ title: 'Impedancia de cada elemento', children: impedanceSteps });

  // 3. Impedancia equivalente.
  const { impedance, step: equivalentStep } = equivalentImpedance(input.connection, elements);
  steps.push(equivalentStep);

  const scale = Math.max(...elements.map((e) => C.abs(e.impedance)));
  const infinite = !Number.isFinite(C.abs(impedance)) || C.abs(impedance) > 1e9 * scale;
  if (C.abs(impedance) <= 1e-9 * scale || infinite) {
    const code: PhasorErrorCode = infinite ? 'impedancia-infinita' : 'impedancia-nula';
    const message = infinite
      ? 'La admitancia equivalente es 0 (resonancia paralelo LC sin resistencia): la impedancia es infinita y la corriente total, 0.'
      : 'La impedancia equivalente es 0 (resonancia serie LC sin resistencia): la corriente sería infinita.';
    return {
      ok: false,
      error: { code, message },
      steps,
      tables: [],
      series: [],
      notices: [{ level: 'error', message }],
    };
  }

  // 4. Corriente total y fasores de cada elemento.
  const current = C.div(voltage, impedance);
  steps.push({
    title: 'Corriente (ley de Ohm fasorial)',
    explanation: 'Se dividen las magnitudes y se restan los ángulos.',
    formula: String.raw`\mathbf{I} = \frac{\mathbf{V}}{\mathbf{Z}}`,
    substitution: String.raw`\mathbf{I} = \frac{${polar(voltage)}}{${polar(impedance)}}`,
    result: String.raw`\mathbf{I} = ${polar(current)} = ${rect(current)}\ \text{A}`,
  });

  const serie = input.connection === 'serie';
  const full: PhasorElement[] = elements.map((e) =>
    serie
      ? { ...e, current, voltage: C.mul(current, e.impedance) }
      : { ...e, voltage, current: C.div(voltage, e.impedance) },
  );
  steps.push({
    title: serie ? 'Voltaje en cada elemento' : 'Corriente en cada elemento',
    explanation: serie
      ? 'La misma corriente pasa por todos: V_k = I·Z_k. La suma de los fasores es V (LVK).'
      : 'Todos tienen el voltaje de la fuente: I_k = V/Z_k. La suma de los fasores es I (LCK).',
    children: full.map((e) => elementStep(e, input.connection, omega)),
  });

  const iMag = C.abs(current);
  const iAngle = C.degrees(C.arg(current));
  const zAngle = C.degrees(C.arg(impedance));
  const { character, relation } = phaseRelation(zAngle);
  steps.push({
    title: 'Corriente en el tiempo',
    explanation: `El circuito es ${character}: la corriente ${relation}.`,
    formula: String.raw`\mathbf{I} = I_m\angle\phi \;\rightarrow\; i(t) = I_m\cos(\omega t + \phi)`,
    result: String.raw`i(t) = ${timeTex(iMag, omega, iAngle)}\ \text{A}`,
  });

  const table: ResultTable = {
    id: 'elementos',
    title: 'Fasores por elemento',
    columns: [
      { key: 'elemento', header: String.raw`\text{Elemento}`, format: 'latex' },
      { key: 'z', header: String.raw`\mathbf{Z}\ (\Omega)`, format: 'latex' },
      { key: 'v', header: String.raw`\mathbf{V}\ (\text{V})`, format: 'latex' },
      { key: 'i', header: String.raw`\mathbf{I}\ (\text{A})`, format: 'latex' },
    ],
    rows: [
      ...full.map((e) => ({
        elemento: e.name,
        z: rect(e.impedance),
        v: polar(e.voltage),
        i: polar(e.current),
      })),
      {
        elemento: String.raw`\text{Total}`,
        z: rect(impedance),
        v: polar(voltage),
        i: polar(current),
      },
    ],
  };

  const period = (2 * Math.PI) / omega;
  const samples = 400;
  const v = (t: number) => magnitude * Math.cos(omega * t + C.radians(angle));
  const i = (t: number) => iMag * Math.cos(omega * t + C.arg(current));
  const points = (f: (t: number) => number) =>
    Array.from({ length: samples + 1 }, (_, k) => {
      const t = (2 * period * k) / samples;
      return { x: t, y: f(t) };
    });
  const series: Series = {
    id: 'senoides',
    title: 'Voltaje y corriente en el tiempo (dos periodos)',
    xLabel: 't (s)',
    yLabel: 'v (V), i (A)',
    label: 'v(t)',
    points: points(v),
    others: [{ label: 'i(t)', points: points(i) }],
  };

  return {
    ok: true,
    value: { voltage, impedance, current, elements: full },
    summary: [
      { label: 'V', value: String.raw`${polar(voltage)}\ \text{V}` },
      { label: 'Z', value: String.raw`${rect(impedance)} = ${polar(impedance)}\ \Omega` },
      { label: 'I', value: String.raw`${polar(current)}\ \text{A}` },
      {
        label: 'i(t)',
        value: String.raw`i(t) = ${timeTex(iMag, omega, iAngle)}\ \text{A}`,
        emphasis: true,
      },
    ],
    steps,
    tables: [table],
    series: [series],
    notices: [],
  };
}

export const fasoresEImpedancia: Calculator<PhasorInput, PhasorValue, PhasorErrorCode> = {
  meta: {
    id: 'fasores-e-impedancia',
    title: 'Fasores e impedancia',
    summary:
      'Pasa una senoide a fasor, calcula la impedancia de R, L y C en serie o en paralelo y la corriente.',
    citations: [
      {
        sourceId: 'hayt-kemmerly-1993',
        locator: '8.ª ed. en inglés, sec. 10.4 y 10.5, ejemplos 10.1, 10.3, 10.4 y 10.7',
      },
    ],
  },
  inputSchema,
  // Hayt, ejemplo 10.1: 8 cos 1000t V sobre R = 20 Ω en serie con L = 30 mH.
  example: {
    amplitude: 8,
    phase: 0,
    form: 'cos',
    omega: 1000,
    connection: 'serie',
    resistance: 20,
    inductance: 0.03,
    capacitance: 0,
  },
  solve: solvePhasor,
};
