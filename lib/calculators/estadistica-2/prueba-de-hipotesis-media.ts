/**
 * Prueba de hipótesis sobre la media μ de una población (Walpole, Myers, Myers y Ye, sec. 10.4;
 * Canavos, cap. 9):
 *
 *   σ conocida:     z = (x̄ − μ₀) / (σ/√n)            ~ normal estándar
 *   σ desconocida:  t = (x̄ − μ₀) / (s/√n)            ~ t con ν = n − 1 grados de libertad
 *
 * Con la alternativa bilateral se agrega el intervalo de confianza de (1 − α)100 % para μ, que
 * contiene a μ₀ exactamente cuando no se rechaza H₀ (sec. 10.4, relación con la estimación).
 */
import { z } from 'zod';
import { studentTQuantile } from '@/lib/math/distributions';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { standardNormalQuantile } from '@/lib/math/normal';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type SummaryItem,
} from '../types';
import {
  alphaField,
  alternativeField,
  hypothesesLatex,
  testDecision,
  type Alternative,
} from './hypothesis';
import {
  finite,
  mean,
  parseSample,
  positive,
  refineSample,
  sampleSize,
  sampleVariance,
} from './samples';

export const meanTestInputSchema = z
  .object({
    source: z.enum(['resumen', 'datos'], { error: 'Elige cómo das la muestra.' }),
    data: z.string().optional(),
    mean: finite('la media muestral x̄').optional(),
    n: sampleSize().optional(),
    variance: z.enum(['conocida', 'desconocida'], { error: 'Indica si σ es conocida.' }),
    sd: positive('la desviación estándar').optional(),
    mu0: finite('μ₀'),
    alternative: alternativeField,
    alpha: alphaField,
  })
  .superRefine((v, ctx) => {
    if (v.source === 'datos') {
      refineSample(v.data, 'data', ctx);
    } else {
      if (v.mean === undefined)
        ctx.addIssue({ code: 'custom', path: ['mean'], message: 'Ingresa x̄.' });
      if (v.n === undefined) ctx.addIssue({ code: 'custom', path: ['n'], message: 'Ingresa n.' });
    }
    if (v.sd === undefined && (v.variance === 'conocida' || v.source === 'resumen')) {
      ctx.addIssue({
        code: 'custom',
        path: ['sd'],
        message:
          v.variance === 'conocida' ? 'Ingresa σ.' : 'Ingresa la desviación estándar muestral s.',
      });
    }
  });

export type MeanTestInput = z.infer<typeof meanTestInputSchema>;

export interface MeanTestValue {
  statistic: number;
  kind: 'z' | 't';
  df: number | null;
  pValue: number;
  reject: boolean;
  critical: number[];
  mean: number;
  n: number;
  sd: number;
  /** Intervalo de confianza (solo con H₁ bilateral). */
  interval: [number, number] | null;
}

const n = (v: number) => toLatexNumber(v, 6);
const op = (v: number) => toLatexOperand(v, 6);

const SIGMA = String.raw`\sigma`;

/** x̄, n y la desviación que se usa (σ si es conocida, s si no), desde los datos o el resumen. */
function sampleSummary(
  input: MeanTestInput,
  known: boolean,
  steps: Step[],
): { xbar: number; size: number; sd: number } {
  if (input.source !== 'datos') {
    const xbar = input.mean!;
    const size = input.n!;
    const sd = input.sd!;
    steps.push({
      title: 'Datos',
      result: String.raw`n = ${size}, \quad \bar{x} = ${n(xbar)}, \quad ${known ? SIGMA : 's'} = ${n(sd)}`,
    });
    return { xbar, size, sd };
  }
  const data = parseSample(input.data) as number[];
  const size = data.length;
  const xbar = mean(data);
  const s = Math.sqrt(sampleVariance(data));
  const sd = known ? input.sd! : s;
  const knownNote = known ? String.raw`, \quad \sigma = ${n(sd)} \text{ (conocida)}` : '';
  steps.push({
    title: 'Medidas de la muestra',
    formula: String.raw`\bar{x} = \frac{\sum x_i}{n}, \qquad s = \sqrt{\frac{\sum (x_i - \bar{x})^2}{n - 1}}`,
    result: String.raw`n = ${size}, \quad \bar{x} = ${n(xbar)}, \quad s = ${n(s)}${knownNote}`,
  });
  return { xbar, size, sd };
}

/** Intervalo de confianza bilateral para μ, que acompaña a la prueba con H₁: μ ≠ μ₀. */
function confidenceInterval(
  input: MeanTestInput,
  known: boolean,
  { xbar, size, sd }: { xbar: number; size: number; sd: number },
  df: number | null,
): { interval: [number, number]; step: Step } {
  const se = sd / Math.sqrt(size);
  const q = known
    ? standardNormalQuantile(1 - input.alpha / 2)
    : studentTQuantile(1 - input.alpha / 2, df!);
  const interval: [number, number] = [xbar - q * se, xbar + q * se];
  const level = formatNumber((1 - input.alpha) * 100);
  const margin = known
    ? String.raw`z_{\alpha/2}\,\frac{\sigma}{\sqrt{n}}`
    : String.raw`t_{\alpha/2}\,\frac{s}{\sqrt{n}}`;
  return {
    interval,
    step: {
      title: `Intervalo de confianza de ${level} % para μ`,
      explanation: `La prueba bilateral no rechaza H₀ exactamente cuando μ₀ = ${formatNumber(input.mu0)} está dentro de este intervalo.`,
      formula: String.raw`\bar{x} \pm ${margin}`,
      substitution: String.raw`${n(xbar)} \pm ${n(q)}\,\frac{${n(sd)}}{\sqrt{${size}}}`,
      result: String.raw`${n(interval[0])} < \mu < ${n(interval[1])}`,
    },
  };
}

export function solveMeanTest(input: MeanTestInput): CalculatorResult<MeanTestValue, never> {
  const known = input.variance === 'conocida';
  const steps: Step[] = [
    {
      title: 'Hipótesis',
      result: hypothesesLatex(String.raw`\mu`, n(input.mu0), input.alternative as Alternative),
    },
  ];

  const sample = sampleSummary(input, known, steps);
  const { xbar, size, sd } = sample;
  const se = sd / Math.sqrt(size);
  const statistic = (xbar - input.mu0) / se;
  const df = known ? null : size - 1;
  const symbol = known ? 'z' : 't';
  const sdSymbol = known ? SIGMA : 's';
  steps.push({
    title: known ? 'Estadístico z (σ conocida)' : 'Estadístico t (σ desconocida)',
    explanation: known
      ? 'Con σ conocida, (x̄ − μ₀)/(σ/√n) tiene distribución normal estándar si H₀ es cierta.'
      : `Con σ desconocida se usa s y el estadístico tiene distribución t con ν = n − 1 = ${df} grados de libertad.`,
    formula: String.raw`${symbol} = \frac{\bar{x} - \mu_0}{${sdSymbol}/\sqrt{n}}`,
    substitution: String.raw`${symbol} = \frac{${n(xbar)} - ${op(input.mu0)}}{${n(sd)}/\sqrt{${size}}}`,
    result: `${symbol} = ${n(statistic)}`,
  });

  const outcome = testDecision({
    statistic: known ? { kind: 'z' } : { kind: 't', df: df! },
    value: statistic,
    alternative: input.alternative,
    alpha: input.alpha,
  });
  steps.push(...outcome.steps);

  let interval: [number, number] | null = null;
  if (input.alternative === 'distinto') {
    const ci = confidenceInterval(input, known, sample, df);
    interval = ci.interval;
    steps.push(ci.step);
  }

  const summary: SummaryItem[] = [
    { label: 'Estadístico de prueba', value: `${symbol} = ${n(statistic)}`, emphasis: true },
    ...outcome.summary,
  ];
  if (interval) {
    summary.push({
      label: `Intervalo de ${formatNumber((1 - input.alpha) * 100)} %`,
      value: String.raw`${n(interval[0])} < \mu < ${n(interval[1])}`,
    });
  }

  return {
    ok: true,
    value: {
      statistic,
      kind: symbol,
      df,
      pValue: outcome.pValue,
      reject: outcome.reject,
      critical: outcome.critical,
      mean: xbar,
      n: size,
      sd,
      interval,
    },
    summary,
    ...emptyTrace(),
    steps,
    series: [outcome.series],
  };
}

export const meanTest: Calculator<MeanTestInput, MeanTestValue, never> = {
  meta: {
    id: 'prueba-de-hipotesis-media',
    title: 'Prueba de hipótesis sobre la media',
    summary: 'Contrasta hipótesis sobre μ con el estadístico z (σ conocida) o t (σ desconocida).',
    citations: [
      { sourceId: 'canavos-1995', locator: 'Cap. 9, pruebas de hipótesis sobre la media' },
      {
        sourceId: 'walpole-1999',
        locator:
          'Sec. 10.4, ejemplos 10.3 (vida media de 71.8 años), 10.4 (resistencia del sedal) y 10.5 (consumo de las aspiradoras), 9.ª ed.',
      },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: meanTestInputSchema,
  example: {
    source: 'resumen',
    data: '',
    mean: 71.8,
    n: 100,
    variance: 'conocida',
    sd: 8.9,
    mu0: 70,
    alternative: 'mayor',
    alpha: 0.05,
  },
  solve: solveMeanTest,
};
