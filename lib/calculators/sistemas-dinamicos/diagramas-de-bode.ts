/**
 * Diagramas de Bode de G(jω)H(jω): forma normalizada con sus factores (ganancia, integradores y
 * derivadores, primer orden y cuadráticos), frecuencias de esquina, curva asintótica y exacta,
 * márgenes de ganancia y de fase y, con realimentación unitaria, el pico de resonancia, su
 * frecuencia y el ancho de banda.
 *
 * Fuentes: Ogata, 3.ª ed., sec. 8-2 (ejemplo 8-1), 8-9 (márgenes, ejemplo 8-20) y 8-10
 * (ec. 8-6 y 8-7, ancho de banda); Ogata, 5.ª ed. en español, ejemplo 7-21 (márgenes con MATLAB).
 */
import { z } from 'zod';
import * as C from '@/lib/math/complex';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { polyRoots } from '@/lib/math/polynomials';
import type {
  Calculator,
  CalculatorResult,
  Notice,
  ResultTable,
  Series,
  Step,
  SummaryItem,
} from '../types';
import {
  asymptoticDb,
  bodeForm,
  closedLoopFrequency,
  frequencyRange,
  logGrid,
  magnitudeDb,
  margins,
  phaseDeg,
  unityClosedLoop,
  type BodeFactor,
  type BodeForm,
  type ClosedLoopFrequency,
  type Margins,
} from './frequency';
import { parseTf, tfTex, type TransferFunction } from './transfer-function';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

const inputSchema = z.object({
  openLoop: z
    .string()
    .trim()
    .min(1, 'Escribe G(s)H(s).')
    .max(200, 'La expresión es demasiado larga.'),
});

export type BodeInput = z.infer<typeof inputSchema>;

export interface BodeValue {
  gain: number;
  factors: {
    kind: BodeFactor['kind'];
    zero: boolean;
    multiplicity: number;
    corner: number;
    zeta: number;
  }[];
  phaseMargin: number | null;
  gainCrossover: number | null;
  gainMarginDb: number | null;
  phaseCrossover: number | null;
  /** Lazo cerrado con realimentación unitaria (si es estable). */
  closed: { peak: number | null; peakFrequency: number | null; bandwidth: number | null } | null;
}

export type BodeErrorCode = 'funcion-invalida' | 'raices-en-eje-imaginario';

function fail(code: BodeErrorCode, message: string): CalculatorResult<BodeValue, BodeErrorCode> {
  return {
    ok: false,
    error: { code, message },
    steps: [],
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

/** Factor en la forma de Bode: `\left(1 + \frac{j\omega}{3}\right)`, `(j\omega)`. */
function factorTex(f: BodeFactor): string {
  if (f.kind === 'origen') return String.raw`(j\omega)`;
  if (f.kind === 'primer-orden') {
    return String.raw`\left(1 ${f.rightHalf ? '-' : '+'} \frac{j\omega}{${n(f.corner)}}\right)`;
  }
  const c2 = 1 / (f.corner * f.corner);
  const c1 = (2 * f.zeta) / f.corner;
  const sign1 = c1 < 0 ? '-' : '+';
  const term1 = c1 === 0 ? '' : String.raw` ${sign1} ${n(Math.abs(c1))}j\omega`;
  return String.raw`\left[${n(c2)}(j\omega)^{2}${term1} + 1\right]`;
}

function powered(f: BodeFactor): string {
  const base = factorTex(f);
  return f.multiplicity > 1 ? `${base}^{${f.multiplicity}}` : base;
}

/** El factor como aparece en G(jω): en el numerador tal cual, en el denominador como 1/(…). */
function signedFactorTex(f: BodeFactor): string {
  return f.zero ? powered(f) : String.raw`\frac{1}{${powered(f)}}`;
}

export function bodeFormTex(form: BodeForm): string {
  const top = form.factors
    .filter((f) => f.zero)
    .map(powered)
    .join('');
  const bottom = form.factors
    .filter((f) => !f.zero)
    .map(powered)
    .join('');
  const k = n(form.gain);
  if (!bottom) return `${k}${top}`;
  return String.raw`\frac{${k}${top}}{${bottom}}`;
}

function originName(f: BodeFactor): string {
  if (f.multiplicity === 1) return f.zero ? 'Derivador' : 'Integrador';
  return `${f.multiplicity} ${f.zero ? 'derivadores' : 'integradores'}`;
}

function describe(f: BodeFactor): string {
  const what = f.zero ? 'cero' : 'polo';
  const sign = f.zero ? '+' : '−';
  const m = f.multiplicity;
  if (f.kind === 'origen') {
    return `${originName(f)} (${what} en el origen): pendiente ${sign}${20 * m} dB/década en todas las frecuencias y fase constante de ${sign}${90 * m}°.`;
  }
  if (f.kind === 'primer-orden') {
    const rightHalf = f.rightHalf ? ', semiplano derecho: fase no mínima' : '';
    const phaseSign = f.zero !== f.rightHalf ? '+' : '−';
    return `Factor de primer orden (${what} en s = ${formatNumber(f.root.re, DIGITS)}${rightHalf}): esquina en ω = ${formatNumber(f.corner, DIGITS)} rad/s; la pendiente cambia ${sign}${20 * m} dB/década y la fase va de 0° a ${phaseSign}${90 * m}°.`;
  }
  const rightHalf = f.rightHalf ? ', semiplano derecho' : '';
  return `Factor cuadrático (${what}s complejos ${C.toTextRect(f.root, DIGITS)} y su conjugado${rightHalf}): ω_n = ${formatNumber(f.corner, DIGITS)} rad/s y ζ = ${formatNumber(f.zeta, 4)}; la pendiente cambia ${sign}${40 * m} dB/década y la fase va de 0° a ${sign}${180 * m}°. Cerca de ω_n la curva exacta se aparta de la asintótica según ζ.`;
}

/** Cambio de pendiente (dB/década) que aporta un factor en su esquina. */
function slopeOf(f: BodeFactor): number {
  return (f.zero ? 1 : -1) * f.multiplicity * (f.kind === 'cuadratico' ? 40 : 20);
}

/** Pendientes de la asintótica por tramos: la inicial y el cambio en cada esquina. */
function slopeSteps(form: BodeForm, corners: number[]): Step[] {
  const nOrigin = form.factors
    .filter((f) => f.kind === 'origen')
    .reduce((s, f) => s + (f.zero ? 1 : -1) * f.multiplicity, 0);
  let slope = 20 * nOrigin;
  const children: Step[] = [
    {
      title: 'Baja frecuencia',
      explanation: `Pendiente inicial de ${slope} dB/década (de los factores en el origen).`,
    },
  ];
  for (const w of corners) {
    const change = form.factors
      .filter((f) => f.kind !== 'origen' && Math.abs(f.corner - w) < 1e-12)
      .reduce((s, f) => s + slopeOf(f), 0);
    slope += change;
    children.push({
      title: `En ω = ${formatNumber(w, DIGITS)} rad/s`,
      explanation: `La pendiente cambia ${change > 0 ? '+' : ''}${change} dB/década y queda en ${slope} dB/década.`,
    });
  }
  return children;
}

function phaseMarginStep(m: Margins): Step {
  if (m.gainCrossover === null) {
    return {
      title: 'Margen de fase',
      explanation: 'La magnitud no cruza 0 dB: el margen de fase no está definido (es infinito).',
    };
  }
  const gc = m.gainCrossovers.at(-1)!;
  const highest =
    m.gainCrossovers.length > 1
      ? ' (la más alta de las frecuencias de cruce de ganancia, como indica Ogata)'
      : '';
  return {
    title: 'Margen de fase',
    explanation: `La magnitud vale 0 dB en ω_c = ${formatNumber(gc.w, DIGITS)} rad/s${highest}.`,
    formula: String.raw`\gamma = 180^{\circ} + \angle G(j\omega_c)`,
    substitution: String.raw`\gamma = 180^{\circ} + (${n(gc.phase)}^{\circ})`,
    result: String.raw`\gamma = ${n(gc.margin)}^{\circ}`,
  };
}

function gainMarginStep(m: Margins): Step {
  if (m.phaseCrossover === null) {
    return {
      title: 'Margen de ganancia',
      explanation: 'La fase nunca llega a −180°: el margen de ganancia es infinito.',
    };
  }
  const pc = m.phaseCrossovers.find((p) => p.w === m.phaseCrossover)!;
  return {
    title: 'Margen de ganancia',
    explanation: `La fase vale −180° en ω₁ = ${formatNumber(pc.w, DIGITS)} rad/s.`,
    formula: String.raw`K_g = \frac{1}{|G(j\omega_1)|},\qquad K_g\ \text{dB} = -20\log_{10}|G(j\omega_1)|`,
    substitution: String.raw`K_g\ \text{dB} = -(${n(pc.magnitudeDb)})`,
    result: String.raw`K_g = ${n(10 ** (pc.margin / 20))} = ${n(pc.margin)}\ \text{dB}`,
  };
}

function marginsStep(m: Margins, form: BodeForm): Step {
  const stableMargins = (m.phaseMargin ?? 1) > 0 && (m.gainMarginDb ?? 1) > 0;
  const minimumPhase = !form.factors.some((f) => f.rightHalf) && form.gain > 0;
  const verdict = stableMargins ? 'Aquí lo son.' : 'Aquí no: el lazo cerrado es inestable.';
  return {
    title: 'Márgenes de estabilidad',
    explanation: minimumPhase
      ? `Para un sistema de fase mínima, los dos márgenes positivos indican que el lazo cerrado es estable. ${verdict} Ogata recomienda un margen de fase entre 30° y 60° y un margen de ganancia mayor que 6 dB.`
      : 'El sistema tiene factores de fase no mínima: los márgenes por sí solos no deciden la estabilidad (se requiere el criterio de Nyquist).',
    children: [phaseMarginStep(m), gainMarginStep(m)],
  };
}

function closedLoopExplanation(cl: ClosedLoopFrequency): string {
  const peak = cl.peak
    ? `Tiene un pico de resonancia M_r = ${formatNumber(cl.peak.magnitude, DIGITS)} (${formatNumber(20 * Math.log10(cl.peak.magnitude), DIGITS)} dB) en ω_r = ${formatNumber(cl.peak.w, DIGITS)} rad/s.`
    : 'La magnitud no tiene pico de resonancia (decrece desde ω = 0).';
  const bandwidth = cl.bandwidth
    ? `El ancho de banda (|M| cae 3 dB por debajo de |M(j0)|) es ω_b = ${formatNumber(cl.bandwidth, DIGITS)} rad/s.`
    : '';
  return `Con realimentación unitaria, M(jω) = G/(1 + G). ${peak} ${bandwidth}`.trim();
}

/** Magnitud (exacta y asintótica) y fase, con los cruces marcados. */
function bodeSeries(
  tf: TransferFunction,
  form: BodeForm,
  m: Margins,
  range: [number, number],
): Series[] {
  const grid = logGrid(range[0], range[1], 500);
  const magPoints = grid.map((w) => ({ x: w, y: magnitudeDb(tf, w) }));
  const asymPoints = grid.map((w) => ({ x: w, y: asymptoticDb(form, w) }));
  const phasePoints = grid.map((w) => ({ x: w, y: phaseDeg(form, w) }));
  const gainMark =
    m.gainCrossover === null
      ? {}
      : { scatter: { label: 'Cruce de ganancia', points: [{ x: m.gainCrossover, y: 0 }] } };
  const phaseMark =
    m.phaseCrossover === null
      ? {}
      : {
          scatter: {
            label: 'Cruce de fase',
            points: [{ x: m.phaseCrossover, y: phaseDeg(form, m.phaseCrossover) }],
          },
        };
  return [
    {
      id: 'magnitud',
      title: 'Diagrama de Bode: magnitud',
      xLabel: 'ω (rad/s)',
      yLabel: '|G(jω)| (dB)',
      label: 'Exacta',
      xScale: 'log',
      points: magPoints,
      reference: { label: 'Asintótica', points: asymPoints },
      ...gainMark,
    },
    {
      id: 'fase',
      title: 'Diagrama de Bode: fase',
      xLabel: 'ω (rad/s)',
      yLabel: '∠G(jω) (°)',
      label: 'Fase',
      xScale: 'log',
      points: phasePoints,
      ...phaseMark,
    },
  ];
}

function bodeTables(
  tf: TransferFunction,
  form: BodeForm,
  m: Margins,
  corners: number[],
): ResultTable[] {
  const frequencies = [
    ...corners,
    ...(m.gainCrossover ? [m.gainCrossover] : []),
    ...(m.phaseCrossover ? [m.phaseCrossover] : []),
  ].sort((a, b) => a - b);
  return [
    {
      id: 'factores',
      title: 'Factores de la forma de Bode',
      columns: [
        { key: 'factor', header: String.raw`\text{Factor}`, format: 'latex' },
        { key: 'esquina', header: String.raw`\omega_c\ (\text{rad/s})` },
        { key: 'pendiente', header: String.raw`\text{Pendiente (dB/déc)}` },
      ],
      rows: [
        { factor: n(form.gain), esquina: '—', pendiente: 0 },
        ...form.factors.map((f) => ({
          factor: signedFactorTex(f),
          esquina: f.kind === 'origen' ? '—' : f.corner,
          pendiente: slopeOf(f),
        })),
      ],
    },
    {
      id: 'valores',
      title: 'Magnitud y fase en las frecuencias de esquina',
      columns: [
        { key: 'w', header: String.raw`\omega\ (\text{rad/s})` },
        { key: 'mag', header: String.raw`|G|\ (\text{dB})` },
        { key: 'asin', header: String.raw`\text{Asintótica (dB)}` },
        { key: 'fase', header: String.raw`\angle G\ (^{\circ})` },
      ],
      rows: frequencies.map((w) => ({
        w,
        mag: magnitudeDb(tf, w),
        asin: asymptoticDb(form, w),
        fase: phaseDeg(form, w),
      })),
    },
  ];
}

function bodeSummary(form: BodeForm, m: Margins, closed: BodeValue['closed']): SummaryItem[] {
  const summary: SummaryItem[] = [
    {
      label: 'Margen de fase',
      value:
        m.phaseMargin === null
          ? String.raw`\infty`
          : String.raw`\gamma = ${n(m.phaseMargin)}^{\circ}\ (\omega_c = ${n(m.gainCrossover!)})`,
      emphasis: true,
    },
    {
      label: 'Margen de ganancia',
      value:
        m.gainMarginDb === null
          ? String.raw`\infty`
          : String.raw`K_g = ${n(m.gainMarginDb)}\ \text{dB}\ (\omega_1 = ${n(m.phaseCrossover!)})`,
    },
    { label: 'Forma de Bode', value: bodeFormTex(form) },
  ];
  if (closed?.peak)
    summary.push({
      label: 'Pico de resonancia',
      value: String.raw`M_r = ${n(closed.peak)}\ (\omega_r = ${n(closed.peakFrequency!)})`,
    });
  if (closed?.bandwidth)
    summary.push({
      label: 'Ancho de banda',
      value: String.raw`\omega_b = ${n(closed.bandwidth)}\ \text{rad/s}`,
    });
  return summary;
}

export function solveBode(input: BodeInput): CalculatorResult<BodeValue, BodeErrorCode> {
  const parsed = parseTf(input.openLoop, 'G(s)H(s)');
  if (!parsed.ok) return fail('funcion-invalida', parsed.message);
  const tf: TransferFunction = parsed.tf;
  const onAxis = [...polyRoots(tf.num), ...polyRoots(tf.den)].find(
    (r) => Math.abs(r.value.re) <= 1e-12 && Math.abs(r.value.im) > 1e-12,
  );
  if (onAxis) {
    return fail(
      'raices-en-eje-imaginario',
      `G(s)H(s) tiene polos o ceros sobre el eje imaginario (s = ±j${formatNumber(Math.abs(onAxis.value.im), DIGITS)}): la magnitud se hace infinita o cero en esa frecuencia y la fase salta 180°.`,
    );
  }
  const form = bodeForm(tf);
  const steps: Step[] = [];
  const notices: Notice[] = [];

  steps.push(
    {
      title: 'Forma de Bode',
      explanation:
        'Se escribe G(jω) con factores cuyas asíntotas de baja frecuencia son la recta de 0 dB: (1 + jω/ω_c) para cada raíz real y [(jω/ω_n)² + 2ζ(jω/ω_n) + 1] para cada par complejo. La ganancia K es el valor de sᴺG(s) en s → 0.',
      formula: `G(s)H(s) = ${tfTex(tf)}`,
      result: String.raw`G(j\omega)H(j\omega) = ${bodeFormTex(form)}`,
    },
    {
      title: 'Factores y frecuencias de esquina',
      children: [
        {
          title: `Ganancia K = ${formatNumber(form.gain, DIGITS)}`,
          explanation: `Aporta 20 log|K| = ${formatNumber(20 * Math.log10(Math.abs(form.gain)), DIGITS)} dB a todas las frecuencias y una fase de ${form.gain < 0 ? '−180°' : '0°'}.`,
        },
        ...form.factors.map((f) => ({
          title:
            f.kind === 'origen'
              ? 'Factor en el origen'
              : `Esquina en ω = ${formatNumber(f.corner, DIGITS)} rad/s`,
          explanation: describe(f),
          result: signedFactorTex(f),
        })),
      ],
    },
  );

  const corners = [
    ...new Set(form.factors.filter((f) => f.kind !== 'origen').map((f) => f.corner)),
  ].sort((a, b) => a - b);
  steps.push(
    {
      title: 'Curva asintótica de magnitud',
      explanation:
        'Las pendientes solo cambian en las frecuencias de esquina; la curva exacta se obtiene sumando las correcciones de cada factor.',
      children: slopeSteps(form, corners),
    },
    {
      title: 'Magnitud y fase exactas',
      formula: String.raw`|G(j\omega)|_{\text{dB}} = 20\log_{10}|G(j\omega)|,\qquad \angle G(j\omega) = \sum \angle(\text{ceros}) - \sum \angle(\text{polos})`,
    },
  );

  const m = margins(tf, form);
  steps.push(marginsStep(m, form));

  // Lazo cerrado con realimentación unitaria.
  const M = unityClosedLoop(tf);
  const closedStable = polyRoots(M.den).every((r) => r.value.re < -1e-9);
  let closed: BodeValue['closed'] = null;
  const range = frequencyRange(form, [m.gainCrossover ?? 0, m.phaseCrossover ?? 0]);
  if (closedStable) {
    const cl = closedLoopFrequency(M, range);
    closed = {
      peak: cl.peak?.magnitude ?? null,
      peakFrequency: cl.peak?.w ?? null,
      bandwidth: cl.bandwidth,
    };
    steps.push({
      title: 'Respuesta en frecuencia en lazo cerrado',
      explanation: closedLoopExplanation(cl),
      formula: String.raw`M(s) = \frac{G(s)}{1 + G(s)}`,
      result: `M(s) = ${tfTex(M)}`,
    });
  } else {
    notices.push({
      level: 'info',
      message:
        'Con realimentación unitaria el lazo cerrado no es estable: no se calculan M_r ni el ancho de banda.',
    });
  }

  return {
    ok: true,
    value: {
      gain: form.gain,
      factors: form.factors.map(({ kind, zero, multiplicity, corner, zeta }) => ({
        kind,
        zero,
        multiplicity,
        corner,
        zeta,
      })),
      phaseMargin: m.phaseMargin,
      gainCrossover: m.gainCrossover,
      gainMarginDb: m.gainMarginDb,
      phaseCrossover: m.phaseCrossover,
      closed,
    },
    summary: bodeSummary(form, m, closed),
    steps,
    tables: bodeTables(tf, form, m, corners),
    series: bodeSeries(tf, form, m, range),
    notices,
  };
}

export const diagramasDeBode: Calculator<BodeInput, BodeValue, BodeErrorCode> = {
  meta: {
    id: 'diagramas-de-bode',
    title: 'Diagramas de Bode',
    summary: 'Gráficas de magnitud y fase y márgenes de ganancia y de fase.',
    citations: [
      {
        sourceId: 'ogata-1998',
        locator: 'Sec. 8-2 (ejemplo 8-1), sec. 8-9 (ejemplo 8-20) y sec. 8-10 (ec. 8-6 y 8-7)',
      },
      { sourceId: 'ogata-1998', locator: '5.ª ed. en español (2010), ejemplo 7-21' },
    ],
  },
  inputSchema,
  // Ogata, ejemplo 8-1.
  example: { openLoop: '10(s + 3)/(s(s + 2)(s^2 + s + 2))' },
  solve: solveBode,
};
