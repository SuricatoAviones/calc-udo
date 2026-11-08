/**
 * Resonancia en circuitos RLC serie, paralelo y paralelo práctico (bobina con resistencia).
 *
 *   ω₀ = 1/√(LC);  serie: Q₀ = ω₀L/R, α = R/(2L);  paralelo: Q₀ = ω₀RC, α = 1/(2RC)
 *   B = ω₀/Q₀;  ω₁,₂ = ω₀[√(1 + (1/2Q₀)²) ∓ 1/(2Q₀)] (exactas) ≈ ω₀ ∓ B/2 (Q₀ ≥ 5)
 *   ω_d = √(ω₀² − α²), ζ = α/ω₀ = 1/(2Q₀)
 *   Cerca de resonancia (Q₀ alto): Z_serie ≈ R(1 + jN), Y_paralelo ≈ (1/R)(1 + jN), N = (ω − ω₀)/(B/2)
 *   Paralelo práctico (R₁ en serie con L, C y R₂ en paralelo): ω₀ = √(1/(LC) − (R₁/L)²); la bobina
 *   se convierte a su equivalente en paralelo R_p = R₁(1 + Q²), L_p = L(1 + 1/Q²).
 *
 * Fuente: Hayt, Kemmerly y Durbin, 8.ª ed. en inglés, sec. 16.1 a 16.4 (ejemplos 16.1 a 16.5).
 */
import { z } from 'zod';
import {
  abs,
  add,
  arg,
  complex,
  degrees,
  div,
  ONE,
  toLatexPolar,
  type Complex,
} from '@/lib/math/complex';
import { toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, Notice, Series, Step, SummaryItem } from '../types';
import { engTex, engText, parallel } from '../electronica/units';

const n = (v: number, d = 6) => toLatexNumber(v, d);
const TWO_PI = 2 * Math.PI;

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
    type: z.enum(['serie', 'paralelo', 'paralelo-practico']),
    r: optionalPositive('R'),
    l: positive('L'),
    c: positive('C'),
    rl: positive('R₁'),
    source: optionalPositive('la amplitud de la fuente'),
    freq: optionalPositive('la frecuencia'),
    freqUnit: z.enum(['rad/s', 'Hz']),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'paralelo-practico' && v.r === undefined) {
      ctx.addIssue({ code: 'custom', path: ['r'], message: 'Escribe R.' });
    }
    if (v.type === 'paralelo-practico' && v.rl * v.rl >= v.l / v.c) {
      ctx.addIssue({
        code: 'custom',
        path: ['rl'],
        message:
          'Con R₁ ≥ √(L/C) la parte imaginaria de la admitancia nunca se anula: no hay resonancia.',
      });
    }
  });

export type ResonanceInput = z.infer<typeof inputSchema>;

export interface ResonanceValue {
  w0: number;
  f0: number;
  q0: number;
  /** Ancho de banda en rad/s. */
  bw: number;
  w1: number;
  w2: number;
  w1Approx: number;
  w2Approx: number;
  alpha: number;
  wd: number;
  zeta: number;
  /** Impedancia de entrada a la frecuencia de resonancia. */
  z0: Complex;
  /** A la frecuencia de análisis: impedancia exacta y aproximada (N), y respuesta. */
  zAt?: Complex;
  zApprox?: Complex;
  n?: number;
  response?: Complex;
  /** Paralelo práctico. */
  qCoil?: number;
  wm?: number;
  zMax?: number;
}

function impedance(input: ResonanceInput, w: number): Complex {
  const zl = complex(0, w * input.l);
  const zc = complex(0, -1 / (w * input.c));
  if (input.type === 'serie') return add(add(complex(input.r!), zl), zc);
  let y: Complex = complex(0, w * input.c);
  y = add(y, input.type === 'paralelo' ? div(ONE, zl) : div(ONE, add(complex(input.rl), zl)));
  const rp = input.type === 'paralelo' ? input.r! : input.r;
  if (rp !== undefined) y = add(y, complex(1 / rp));
  return div(ONE, y);
}

/**
 * Forma polar sin los residuos de redondeo: en resonancia la parte imaginaria sale del orden de
 * 10⁻¹⁵ y su ángulo (10⁻¹³ °) produciría un doble superíndice en LaTeX.
 */
const polar = (z: Complex) => {
  const m = abs(z);
  const tidy = complex(
    Math.abs(z.re) < 1e-10 * m ? 0 : z.re,
    Math.abs(z.im) < 1e-10 * m ? 0 : z.im,
  );
  return toLatexPolar(tidy, 5);
};

/** ω₀, Q₀, α y la resistencia equivalente de cada circuito. */
interface ResonancePoint {
  w0: number;
  q0: number;
  alpha: number;
  rEq: number;
  qCoil?: number;
}

/** Bobina real en paralelo con C (y R₂): R₁ desplaza la resonancia y se pasa a R_p ∥ L_p. */
function practicalResonance(input: ResonanceInput, steps: Step[]): ResonancePoint {
  const { l, c } = input;
  const w0 = Math.sqrt(1 / (l * c) - (input.rl / l) ** 2);
  steps.push({
    title: 'Frecuencia de resonancia',
    explanation:
      'La resistencia R₁ de la bobina desplaza la resonancia: se anula la parte imaginaria de Y = 1/R₂ + jωC + 1/(R₁ + jωL).',
    formula: String.raw`\omega_0 = \sqrt{\frac{1}{LC} - \left(\frac{R_1}{L}\right)^{2}}`,
    substitution: String.raw`\omega_0 = \sqrt{\frac{1}{(${n(l)})(${n(c)})} - \left(\frac{${n(input.rl)}}{${n(l)}}\right)^{2}}`,
    result: String.raw`\omega_0 = ${n(w0)}\ \text{rad/s},\quad f_0 = ${n(w0 / TWO_PI)}\ \text{Hz}`,
  });
  const qCoil = (w0 * l) / input.rl;
  const rp = input.rl * (1 + qCoil * qCoil);
  const lp = l * (1 + 1 / (qCoil * qCoil));
  const withR2 = input.r !== undefined;
  const rEq = withR2 ? parallel(rp, input.r!) : rp;
  const q0 = w0 * rEq * c;
  steps.push(
    {
      title: 'Equivalente en paralelo de la bobina',
      explanation:
        'A la frecuencia de resonancia, R₁ en serie con L equivale a R_p en paralelo con L_p, con el mismo Q (Hayt, ecs. 22 y 23). Así el circuito queda como un RLC paralelo ideal.',
      formula: String.raw`Q = \frac{\omega_0 L}{R_1},\qquad R_p = R_1(1 + Q^{2}),\qquad L_p = L\left(1 + \frac{1}{Q^{2}}\right)`,
      substitution: String.raw`Q = \frac{(${n(w0)})(${n(l)})}{${n(input.rl)}}`,
      result: String.raw`Q = ${n(qCoil)},\quad R_p = ${engTex(rp, 'Ω')},\quad L_p = ${engTex(lp, 'H')}`,
    },
    {
      title: 'Factor de calidad del circuito',
      explanation: withR2
        ? 'R_p queda en paralelo con R₂.'
        : 'Sin resistencia en paralelo, toda la pérdida está en la bobina.',
      formula: withR2
        ? String.raw`R = R_p \parallel R_2,\qquad Q_0 = \omega_0 R C`
        : String.raw`Q_0 = \omega_0 R_p C`,
      substitution: `Q_0 = (${n(w0)})(${n(rEq)})(${n(c)})`,
      result: String.raw`R = ${engTex(rEq, 'Ω')},\quad Q_0 = ${n(q0)}`,
    },
  );
  return { w0, q0, alpha: 1 / (2 * rEq * c), rEq, qCoil };
}

/** RLC serie o paralelo ideal: ω₀ = 1/√(LC). */
function idealResonance(input: ResonanceInput, steps: Step[]): ResonancePoint {
  const { type, l, c } = input;
  const r = input.r!;
  const w0 = 1 / Math.sqrt(l * c);
  steps.push({
    title: 'Frecuencia de resonancia',
    explanation:
      type === 'serie'
        ? 'La reactancia de la bobina y la del condensador se cancelan: la impedancia es puramente resistiva y mínima.'
        : 'Las susceptancias de la bobina y del condensador se cancelan: la admitancia es puramente conductiva y mínima (impedancia máxima).',
    formula: String.raw`\omega_0 = \frac{1}{\sqrt{LC}},\qquad f_0 = \frac{\omega_0}{2\pi}`,
    substitution: String.raw`\omega_0 = \frac{1}{\sqrt{(${n(l)})(${n(c)})}}`,
    result: String.raw`\omega_0 = ${n(w0)}\ \text{rad/s},\quad f_0 = ${n(w0 / TWO_PI)}\ \text{Hz}`,
  });
  if (type === 'serie') {
    const q0 = (w0 * l) / r;
    const alpha = r / (2 * l);
    steps.push({
      title: 'Factor de calidad',
      formula: String.raw`Q_0 = \frac{\omega_0 L}{R} = \frac{1}{R}\sqrt{\frac{L}{C}},\qquad \alpha = \frac{R}{2L}`,
      substitution: String.raw`Q_0 = \frac{(${n(w0)})(${n(l)})}{${n(r)}}`,
      result: String.raw`Q_0 = ${n(q0)},\quad \alpha = ${n(alpha)}\ \text{Np/s}`,
    });
    return { w0, q0, alpha, rEq: r };
  }
  const q0 = w0 * r * c;
  const alpha = 1 / (2 * r * c);
  steps.push({
    title: 'Factor de calidad',
    formula: String.raw`Q_0 = \omega_0 R C = R\sqrt{\frac{C}{L}},\qquad \alpha = \frac{1}{2RC}`,
    substitution: `Q_0 = (${n(w0)})(${n(r)})(${n(c)})`,
    result: String.raw`Q_0 = ${n(q0)},\quad \alpha = ${n(alpha)}\ \text{Np/s}`,
  });
  return { w0, q0, alpha, rEq: r };
}

const RESONANT_IMPEDANCE: Record<ResonanceInput['type'], string> = {
  serie:
    'En resonancia la impedancia serie es solo R; V_L y V_C valen Q₀ veces la tensión de la fuente.',
  paralelo:
    'En resonancia la impedancia paralelo es solo R; I_L e I_C valen Q₀ veces la corriente de la fuente.',
  'paralelo-practico':
    'En resonancia la impedancia es real, pero no es la máxima: el máximo está en ω_m (ver abajo).',
};

/** Máximo de |Z| por búsqueda de sección áurea entre ω₀/4 y 4/√(LC) (|Z| es unimodal ahí). */
function maxImpedance(input: ResonanceInput, w0: number): number {
  let lo = w0 / 4;
  let hi = 4 / Math.sqrt(input.l * input.c);
  const g = (Math.sqrt(5) - 1) / 2;
  const f = (w: number) => abs(impedance(input, w));
  let x1 = hi - g * (hi - lo);
  let x2 = lo + g * (hi - lo);
  for (let i = 0; i < 200; i++) {
    if (f(x1) < f(x2)) {
      lo = x1;
      x1 = x2;
      x2 = lo + g * (hi - lo);
    } else {
      hi = x2;
      x2 = x1;
      x1 = hi - g * (hi - lo);
    }
  }
  return (lo + hi) / 2;
}

/**
 * Respuesta a la frecuencia pedida: impedancia exacta, aproximación de alto Q con N y, si hay
 * fuente, la corriente (serie) o la tensión (paralelo).
 */
function responseAt(
  input: ResonanceInput,
  point: { w0: number; bw: number; rEq: number },
  steps: Step[],
) {
  const { type } = input;
  const { w0, bw, rEq } = point;
  const freq = input.freq!;
  const w = input.freqUnit === 'Hz' ? freq * TWO_PI : freq;
  const zAt = impedance(input, w);
  const nOff = (w - w0) / (bw / 2);
  const zApprox = type === 'serie' ? complex(rEq, rEq * nOff) : div(complex(rEq), complex(1, nOff));
  const yAt = div(ONE, zAt);
  const unit = input.freqUnit === 'Hz' ? 'Hz' : '';
  const radSuffix = input.freqUnit === 'Hz' ? '' : ' rad/s';
  steps.push({
    title: `Respuesta a ${engText(freq, unit)}${radSuffix}`,
    explanation:
      'Valor exacto con la impedancia de los tres elementos, y aproximación de alto Q con N, el número de medios anchos de banda que separan ω de ω₀.',
    formula:
      type === 'serie'
        ? String.raw`N = \frac{\omega - \omega_0}{B/2},\qquad Z \approx R(1 + jN) = R\sqrt{1 + N^{2}}\angle \tan^{-1}N`
        : String.raw`N = \frac{\omega - \omega_0}{B/2},\qquad Y \approx \frac{1}{R}(1 + jN) = \frac{1}{R}\sqrt{1 + N^{2}}\angle \tan^{-1}N`,
    substitution: String.raw`N = \frac{${n(w)} - ${n(w0)}}{${n(bw / 2)}} = ${n(nOff)}`,
    result:
      type === 'serie'
        ? String.raw`Z = ${polar(zAt)}\ \Omega\quad(\text{aprox.: } ${polar(zApprox)}\ \Omega)`
        : String.raw`Y = ${polar(yAt)}\ \text{S}\quad(\text{aprox.: } ${polar(div(ONE, zApprox))}\ \text{S})`,
  });
  if (input.source === undefined) return { zAt, zApprox, nOff, response: undefined };
  if (type === 'serie') {
    const response = div(complex(input.source), zAt);
    steps.push({
      title: 'Corriente',
      formula: String.raw`I = \frac{V}{Z}`,
      substitution: String.raw`I = \frac{${n(input.source)}}{${polar(zAt)}}`,
      result: String.raw`I = ${polar(response)}\ \text{A}\quad(|I| \approx ${engTex(input.source / abs(zApprox), 'A')}\ \text{con la aproximación})`,
    });
    return { zAt, zApprox, nOff, response };
  }
  const response = div(complex(input.source), yAt);
  steps.push({
    title: 'Tensión',
    formula: String.raw`V = \frac{I}{Y}`,
    substitution: String.raw`V = \frac{${n(input.source)}}{${polar(yAt)}}`,
    result: String.raw`V = ${polar(response)}\ \text{V}`,
  });
  return { zAt, zApprox, nOff, response };
}

/** En resonancia el serie amplifica la tensión en L y C, y el paralelo la corriente. */
function amplificationStep(type: ResonanceInput['type'], amplified: number): Step {
  if (type === 'serie') {
    return {
      title: 'Tensiones en L y C en resonancia',
      explanation: 'El circuito serie amplifica la tensión: Q₀ veces la de la fuente.',
      formula: '|V_L| = |V_C| = Q_0|V|',
      result: `|V_L| = |V_C| = ${engTex(amplified, 'V')}`,
    };
  }
  return {
    title: 'Corrientes en L y C en resonancia',
    explanation: 'El circuito paralelo amplifica la corriente: Q₀ veces la de la fuente.',
    formula: '|I_L| = |I_C| = Q_0|I|',
    result: `|I_L| = |I_C| = ${engTex(amplified, 'A')}`,
  };
}

/** |Z| alrededor de la resonancia, con ω₀, ω₁ y ω₂ marcados. */
function impedanceSeries(
  input: ResonanceInput,
  band: { w0: number; bw: number; w1: number; w2: number },
  toUnit: (w: number) => number,
): Series {
  const { w0, bw, w1, w2 } = band;
  const span = Math.max(3 * bw, 0.6 * w0);
  const from = Math.max(w0 - span, w0 / 20);
  const to = w0 + span;
  const points = Array.from({ length: 161 }, (_, i) => {
    const w = from + ((to - from) * i) / 160;
    return { x: toUnit(w), y: abs(impedance(input, w)) };
  });
  const marks = [w0, w1, w2].map((w) => ({ x: toUnit(w), y: abs(impedance(input, w)) }));
  return {
    id: 'impedancia',
    title: 'Magnitud de la impedancia de entrada',
    xLabel: input.freqUnit === 'Hz' ? 'f (Hz)' : 'ω (rad/s)',
    yLabel: '|Z| (Ω)',
    label: '|Z|',
    points,
    scatter: { label: 'ω₀, ω₁ y ω₂', points: marks },
  };
}

/** Corriente (serie) o tensión (paralelo) a la frecuencia pedida, para el resumen. */
function responseSummary(type: ResonanceInput['type'], response: Complex): SummaryItem {
  if (type === 'serie') {
    return { label: 'Corriente', value: String.raw`I = ${polar(response)}\ \text{A}` };
  }
  return { label: 'Tensión', value: String.raw`V = ${polar(response)}\ \text{V}` };
}

export function solveResonance(input: ResonanceInput): CalculatorResult<ResonanceValue, never> {
  const { type } = input;
  const steps: Step[] = [];
  const notices: Notice[] = [];
  const toUnit = (w: number) => (input.freqUnit === 'Hz' ? w / TWO_PI : w);
  const unitTex = input.freqUnit === 'Hz' ? String.raw`\text{Hz}` : String.raw`\text{rad/s}`;
  const freqTex = (w: number) => String.raw`${n(toUnit(w), 6)}\ ${unitTex}`;

  const { w0, q0, alpha, rEq, qCoil } =
    type === 'paralelo-practico' ? practicalResonance(input, steps) : idealResonance(input, steps);

  const zeta = alpha / w0;
  const wd = alpha < w0 ? Math.sqrt(w0 * w0 - alpha * alpha) : 0;
  steps.push({
    title: 'Amortiguamiento',
    explanation: 'Los ceros de la admitancia (o de la impedancia) están en s = −α ± jω_d.',
    formula: String.raw`\omega_d = \sqrt{\omega_0^{2} - \alpha^{2}},\qquad \zeta = \frac{\alpha}{\omega_0} = \frac{1}{2Q_0}`,
    result: String.raw`\omega_d = ${n(wd)}\ \text{rad/s},\quad \zeta = ${n(zeta)}`,
  });

  const bw = w0 / q0;
  const k = 1 / (2 * q0);
  const w1 = w0 * (Math.sqrt(1 + k * k) - k);
  const w2 = w0 * (Math.sqrt(1 + k * k) + k);
  const w1Approx = w0 - bw / 2;
  const w2Approx = w0 + bw / 2;
  steps.push({
    title: 'Ancho de banda y frecuencias de media potencia',
    explanation: `En ω₁ y ω₂ la ${type === 'serie' ? 'corriente' : 'tensión'} cae al 70.7 % del máximo (la potencia, a la mitad). Si Q₀ ≥ 5 cada una está a medio ancho de banda de ω₀.`,
    formula: String.raw`B = \frac{\omega_0}{Q_0},\qquad \omega_{1,2} = \omega_0\left[\sqrt{1 + \left(\frac{1}{2Q_0}\right)^{2}} \mp \frac{1}{2Q_0}\right] \approx \omega_0 \mp \frac{B}{2}`,
    substitution: String.raw`B = \frac{${n(w0)}}{${n(q0)}}`,
    result: String.raw`B = ${freqTex(bw)},\quad \omega_1 = ${freqTex(w1)},\quad \omega_2 = ${freqTex(w2)}\quad(\text{aprox.: } ${n(toUnit(w1Approx))},\ ${n(toUnit(w2Approx))})`,
  });
  if (q0 < 5) {
    notices.push({
      level: 'info',
      message: `Q₀ = ${n(q0, 4).replace('-', '−')} es menor que 5: las aproximaciones de alto Q (ω₀ ∓ B/2 y N) pierden precisión; usa los valores exactos.`,
    });
  }

  const z0 = impedance(input, w0);
  steps.push({
    title: 'Impedancia de entrada en resonancia',
    explanation: RESONANT_IMPEDANCE[type],
    formula:
      type === 'serie' ? String.raw`Z(j\omega_0) = R` : String.raw`Z(j\omega_0) = 1/Y(j\omega_0)`,
    result: String.raw`Z(j\omega_0) = ${polar(z0)}\ \Omega`,
  });

  let wm: number | undefined;
  let zMax: number | undefined;
  if (type === 'paralelo-practico') {
    wm = maxImpedance(input, w0);
    zMax = abs(impedance(input, wm));
    steps.push({
      title: 'Impedancia máxima',
      explanation:
        'Con la bobina real, |Z| alcanza su máximo en una frecuencia ω_m distinta de ω₀ y de 1/√(LC). Se busca numéricamente (sección áurea).',
      formula: String.raw`\omega_m = \arg\max_{\omega} |Z(j\omega)|`,
      result: String.raw`\omega_m = ${freqTex(wm)},\quad Z(j\omega_m) = ${polar(impedance(input, wm))}\ \Omega`,
    });
  }

  const at = input.freq === undefined ? undefined : responseAt(input, { w0, bw, rEq }, steps);
  const response = at?.response;

  if (input.source !== undefined && type !== 'paralelo-practico') {
    steps.push(amplificationStep(type, q0 * input.source));
  }

  const series = impedanceSeries(input, { w0, bw, w1, w2 }, toUnit);
  const responseItem = response === undefined ? [] : [responseSummary(type, response)];
  // Las etiquetas del resumen se muestran en mayúsculas (ω se vería como Ω): el símbolo va en el valor.
  const summary: SummaryItem[] = [
    { label: 'Resonancia', value: String.raw`\omega_0 = ${n(w0)}\ \text{rad/s}`, emphasis: true },
    {
      label: 'Frecuencia de resonancia',
      value: String.raw`f_0 = ${n(w0 / TWO_PI)}\ \text{Hz}`,
      emphasis: true,
    },
    { label: 'Factor de calidad', value: `Q_0 = ${n(q0)}` },
    { label: 'Ancho de banda', value: `B = ${freqTex(bw)}` },
    {
      label: 'Media potencia',
      value: String.raw`\omega_1 = ${n(toUnit(w1))},\ \omega_2 = ${n(toUnit(w2))}\ ${unitTex}`,
    },
    { label: 'Impedancia en resonancia', value: String.raw`Z(j\omega_0) = ${polar(z0)}\ \Omega` },
    ...(wm === undefined
      ? []
      : [{ label: 'Impedancia máxima', value: String.raw`\omega_m = ${freqTex(wm)}` }]),
    ...responseItem,
  ];

  return {
    ok: true,
    value: {
      w0,
      f0: w0 / TWO_PI,
      q0,
      bw,
      w1,
      w2,
      w1Approx,
      w2Approx,
      alpha,
      wd,
      zeta,
      z0,
      zAt: at?.zAt,
      zApprox: at?.zApprox,
      n: at?.nOff,
      response,
      qCoil,
      wm,
      zMax,
    },
    summary,
    steps,
    tables: [],
    series: [series],
    notices,
  };
}

/** Ángulo en grados, para las pruebas y la UI. */
export const angleDeg = (z: Complex) => degrees(arg(z));

export const resonanciaRlc: Calculator<ResonanceInput, ResonanceValue, never> = {
  meta: {
    id: 'resonancia-rlc',
    title: 'Resonancia en circuitos RLC',
    summary:
      'Frecuencia de resonancia, factor de calidad, ancho de banda y frecuencias de media potencia de circuitos RLC serie, paralelo y con bobina real.',
    citations: [
      {
        sourceId: 'hayt-kemmerly-1993',
        locator: '8.ª ed. en inglés, sec. 16.1 a 16.4, ejemplos 16.1 a 16.5',
      },
    ],
  },
  inputSchema,
  // Hayt, ejemplo 16.3: serie con R = 10 Ω, L = 2 mH, C = 200 nF, 100 mV a 48 krad/s.
  example: {
    type: 'serie',
    r: 10,
    l: 2e-3,
    c: 200e-9,
    rl: 2,
    source: 0.1,
    freq: 48e3,
    freqUnit: 'rad/s',
  },
  solve: solveResonance,
};
