/**
 * Pruebas de hipótesis sobre varianzas (Walpole, Myers, Myers y Ye, sec. 10.13; Canavos, cap. 9),
 * suponiendo poblaciones normales:
 *
 *   Una varianza:   χ² = (n − 1)s² / σ₀²        ~ ji-cuadrada con ν = n − 1
 *   Dos varianzas:  f = s₁² / s₂²              ~ F con ν₁ = n₁ − 1 y ν₂ = n₂ − 1
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type SummaryItem,
} from '../types';
import { alphaField, alternativeField, RELATION, testDecision } from './hypothesis';
import { parseSample, positive, refineSample, sampleSize, sampleVariance } from './samples';

export const varianceTestInputSchema = z
  .object({
    mode: z.enum(['una', 'dos'], { error: 'Elige cuántas poblaciones.' }),
    source: z.enum(['resumen', 'datos'], { error: 'Elige cómo das las muestras.' }),
    n1: sampleSize('n₁').optional(),
    s1: positive('s₁').optional(),
    data1: z.string().optional(),
    n2: sampleSize('n₂').optional(),
    s2: positive('s₂').optional(),
    data2: z.string().optional(),
    sigma0: positive('σ₀').optional(),
    alternative: alternativeField,
    alpha: alphaField,
  })
  .superRefine((v, ctx) => {
    const two = v.mode === 'dos';
    if (v.source === 'datos') {
      refineSample(v.data1, 'data1', ctx, 2, two ? 'la muestra 1' : 'la muestra');
      if (two) refineSample(v.data2, 'data2', ctx, 2, 'la muestra 2');
    } else {
      if (v.n1 === undefined) ctx.addIssue({ code: 'custom', path: ['n1'], message: 'Ingresa n.' });
      if (v.s1 === undefined) ctx.addIssue({ code: 'custom', path: ['s1'], message: 'Ingresa s.' });
      if (two && v.n2 === undefined)
        ctx.addIssue({ code: 'custom', path: ['n2'], message: 'Ingresa n₂.' });
      if (two && v.s2 === undefined)
        ctx.addIssue({ code: 'custom', path: ['s2'], message: 'Ingresa s₂.' });
    }
    if (!two && v.sigma0 === undefined) {
      ctx.addIssue({ code: 'custom', path: ['sigma0'], message: 'Ingresa σ₀.' });
    }
  });

export type VarianceTestInput = z.infer<typeof varianceTestInputSchema>;

export interface VarianceTestValue {
  statistic: number;
  pValue: number;
  reject: boolean;
  critical: number[];
}

export type VarianceTestErrorCode = never;

const n = (v: number) => toLatexNumber(v, 6);

function sampleOf(
  input: VarianceTestInput,
  which: 1 | 2,
): { size: number; s2: number; fromData: boolean } {
  if (input.source === 'datos') {
    const data = parseSample(which === 1 ? input.data1 : input.data2) as number[];
    return { size: data.length, s2: sampleVariance(data), fromData: true };
  }
  const s = which === 1 ? input.s1! : input.s2!;
  return { size: which === 1 ? input.n1! : input.n2!, s2: s * s, fromData: false };
}

export function solveVarianceTest(
  input: VarianceTestInput,
): CalculatorResult<VarianceTestValue, VarianceTestErrorCode> {
  const rel = RELATION[input.alternative];
  const steps: Step[] = [];
  let statistic: number;
  let outcome: ReturnType<typeof testDecision>;
  let statTex: string;

  if (input.mode === 'una') {
    const { size, s2, fromData } = sampleOf(input, 1);
    const sigma2 = input.sigma0! ** 2;
    const df = size - 1;
    steps.push({
      title: 'Hipótesis',
      explanation: `σ₀ = ${formatNumber(input.sigma0!)}, así que σ₀² = ${formatNumber(sigma2)}.`,
      result: `H_0\\!: \\sigma^2 = ${n(sigma2)}, \\qquad H_1\\!: \\sigma^2 ${rel} ${n(sigma2)}`,
    });
    steps.push({
      title: fromData ? 'Varianza de la muestra' : 'Datos',
      formula: fromData ? 's^2 = \\frac{\\sum (x_i - \\bar{x})^2}{n - 1}' : undefined,
      result: `n = ${size}, \\quad s^2 = ${n(s2)}, \\quad s = ${n(Math.sqrt(s2))}`,
    });
    statistic = (df * s2) / sigma2;
    statTex = `\\chi^2 = ${n(statistic)}`;
    steps.push({
      title: 'Estadístico ji-cuadrada',
      explanation: `Si la población es normal y H₀ es cierta, tiene distribución ji-cuadrada con ν = n − 1 = ${df} grados de libertad.`,
      formula: '\\chi^2 = \\frac{(n - 1)s^2}{\\sigma_0^2}',
      substitution: `\\chi^2 = \\frac{(${size} - 1)(${n(s2)})}{${n(sigma2)}}`,
      result: statTex,
    });
    outcome = testDecision({
      statistic: { kind: 'chi2', df },
      value: statistic,
      alternative: input.alternative,
      alpha: input.alpha,
    });
  } else {
    const a = sampleOf(input, 1);
    const b = sampleOf(input, 2);
    steps.push({
      title: 'Hipótesis',
      result: `H_0\\!: \\sigma_1^2 = \\sigma_2^2, \\qquad H_1\\!: \\sigma_1^2 ${rel} \\sigma_2^2`,
    });
    steps.push({
      title: a.fromData ? 'Varianzas de las muestras' : 'Datos',
      result: `n_1 = ${a.size},\\ s_1^2 = ${n(a.s2)}; \\qquad n_2 = ${b.size},\\ s_2^2 = ${n(b.s2)}`,
    });
    statistic = a.s2 / b.s2;
    statTex = `f = ${n(statistic)}`;
    steps.push({
      title: 'Estadístico F',
      explanation: `Si las poblaciones son normales y H₀ es cierta, tiene distribución F con ν₁ = ${a.size - 1} y ν₂ = ${b.size - 1} grados de libertad.`,
      formula: 'f = \\frac{s_1^2}{s_2^2}',
      substitution: `f = \\frac{${n(a.s2)}}{${n(b.s2)}}`,
      result: statTex,
    });
    outcome = testDecision({
      statistic: { kind: 'f', df1: a.size - 1, df2: b.size - 1 },
      value: statistic,
      alternative: input.alternative,
      alpha: input.alpha,
    });
    if (input.alternative !== 'mayor') {
      steps.push({
        title: 'Valor crítico inferior',
        explanation:
          'Las tablas solo traen la cola derecha de F; el valor de la cola izquierda se obtiene con f_{1−α}(ν₁, ν₂) = 1/f_α(ν₂, ν₁) (Walpole, teorema 8.7).',
      });
    }
  }
  steps.push(...outcome.steps);

  const summary: SummaryItem[] = [
    { label: 'Estadístico de prueba', value: statTex, emphasis: true },
    ...outcome.summary,
  ];
  return {
    ok: true,
    value: {
      statistic,
      pValue: outcome.pValue,
      reject: outcome.reject,
      critical: outcome.critical,
    },
    summary,
    ...emptyTrace(),
    steps,
    series: [outcome.series],
  };
}

export const varianceTest: Calculator<VarianceTestInput, VarianceTestValue, VarianceTestErrorCode> =
  {
    meta: {
      id: 'prueba-de-hipotesis-varianza',
      title: 'Prueba de hipótesis sobre la varianza',
      summary:
        'Contrasta hipótesis sobre σ² con el estadístico ji-cuadrada, o compara dos varianzas con F.',
      citations: [
        { sourceId: 'canavos-1995', locator: 'Cap. 9, pruebas sobre varianzas' },
        {
          sourceId: 'walpole-1999',
          locator:
            'Sec. 10.13 (una y dos varianzas: duración de las baterías y desgaste de los dos materiales), 9.ª ed.',
        },
        { sourceId: 'meyer-1998' },
      ],
    },
    inputSchema: varianceTestInputSchema,
    example: {
      mode: 'una',
      source: 'resumen',
      n1: 10,
      s1: 1.2,
      data1: '',
      n2: 10,
      s2: 5,
      data2: '',
      sigma0: 0.9,
      alternative: 'mayor',
      alpha: 0.05,
    },
    solve: solveVarianceTest,
  };
