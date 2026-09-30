/**
 * Coeficientes de correlación (Walpole, Myers, Myers y Ye, sec. 11.12 y 16.7; Canavos, cap. 13):
 *
 *   Pearson:   r = Sxy / √(Sxx Syy)
 *   Spearman:  r_s = coeficiente de Pearson de los rangos; sin empates, r_s = 1 − 6Σdᵢ² / [n(n² − 1)]
 *
 * Pruebas sobre ρ, suponiendo normalidad bivariada:
 *   ρ₀ = 0:  t = r√(n − 2) / √(1 − r²),   ν = n − 2
 *   ρ₀ ≠ 0:  z = (√(n − 3)/2) ln[(1 + r)(1 − ρ₀) / ((1 − r)(1 + ρ₀))]   (transformación de Fisher)
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
  type SummaryItem,
} from '../types';
import { pointsShape } from '../metodos-numericos/differences';
import { alphaField, alternativeField, hypothesesLatex, testDecision } from './hypothesis';
import { POLLUTION_X, POLLUTION_Y } from './regresion-lineal';
import { readPairs, refinePairs, regressionSums } from './regression';
import { averageRanks } from './samples';

export const correlationInputSchema = z
  .object({
    source: z.enum(['datos', 'resumen'], { error: 'Elige cómo das los datos.' }),
    method: z.enum(['pearson', 'spearman'], { error: 'Elige el coeficiente.' }),
    ...pointsShape,
    r: z
      .number({ error: 'Ingresa r.' })
      .refine(
        (v) => Number.isFinite(v) && v > -1 && v < 1,
        'r debe estar entre −1 y 1 (sin incluirlos).',
      )
      .optional(),
    n: z
      .number({ error: 'Ingresa n.' })
      .int('n debe ser un número entero.')
      .min(4, 'Hacen falta al menos 4 pares.')
      .max(1_000_000, 'n es demasiado grande.')
      .optional(),
    rho0: z
      .number({ error: 'Ingresa ρ₀.' })
      .refine(
        (v) => Number.isFinite(v) && v > -1 && v < 1,
        'ρ₀ debe estar entre −1 y 1 (sin incluirlos).',
      ),
    alternative: alternativeField,
    alpha: alphaField,
  })
  .superRefine((v, ctx) => {
    if (v.source === 'datos') {
      refinePairs(v, ctx, 4);
    } else {
      if (v.r === undefined) ctx.addIssue({ code: 'custom', path: ['r'], message: 'Ingresa r.' });
      if (v.n === undefined) ctx.addIssue({ code: 'custom', path: ['n'], message: 'Ingresa n.' });
    }
    if (v.method === 'spearman' && v.rho0 !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['rho0'],
        message: 'Con Spearman solo se prueba ρ = 0.',
      });
    }
  });

export type CorrelationInput = z.infer<typeof correlationInputSchema>;

export interface CorrelationValue {
  r: number;
  n: number;
  statistic: number;
  kind: 't' | 'z';
  pValue: number;
  reject: boolean;
}

export type CorrelationErrorCode = 'undefined-correlation';

const n = (v: number) => toLatexNumber(v, 6);
const op = (v: number) => toLatexOperand(v, 6);

function strength(r: number): string {
  const a = Math.abs(r);
  const sense = r > 0 ? 'positiva' : 'negativa';
  if (a >= 0.9) return `muy fuerte y ${sense}`;
  if (a >= 0.7) return `fuerte y ${sense}`;
  if (a >= 0.4) return `moderada y ${sense}`;
  if (a >= 0.2) return `débil y ${sense}`;
  return 'muy débil o nula';
}

export function solveCorrelation(
  input: CorrelationInput,
): CalculatorResult<CorrelationValue, CorrelationErrorCode> {
  const steps: Step[] = [];
  const series: Series[] = [];
  let r: number;
  let size: number;
  const spearman = input.method === 'spearman';
  const symbol = spearman ? 'r_s' : 'r';

  if (input.source === 'datos') {
    const { x, y } = readPairs(input.x, input.y);
    size = x.length;
    let xs = x;
    let ys = y;
    if (spearman) {
      xs = averageRanks(x);
      ys = averageRanks(y);
      const ties = new Set(x).size !== size || new Set(y).size !== size;
      const d2 = xs.reduce((s, rx, i) => s + (rx - ys[i]!) ** 2, 0);
      steps.push({
        title: 'Rangos',
        explanation: `Se ordena cada variable por separado y se reemplaza cada dato por su rango (1 al menor)${ties ? '; los empates reciben el rango promedio' : ''}.`,
        formula: 'd_i = \\text{rango}(x_i) - \\text{rango}(y_i)',
        result: `\\sum d_i^2 = ${n(d2)}`,
      });
      if (!ties) {
        const rs = 1 - (6 * d2) / (size * (size * size - 1));
        steps.push({
          title: 'Coeficiente de Spearman',
          explanation:
            'Sin empates, el coeficiente de Pearson de los rangos se simplifica a esta fórmula.',
          formula: 'r_s = 1 - \\frac{6\\sum d_i^2}{n(n^2 - 1)}',
          substitution: `r_s = 1 - \\frac{6(${n(d2)})}{${size}(${size}^2 - 1)}`,
          result: `r_s = ${n(rs)}`,
        });
      }
    }
    const sums = regressionSums(xs, ys);
    if (sums.sxx === 0 || sums.syy === 0) {
      return {
        ok: false,
        error: {
          code: 'undefined-correlation',
          message:
            'Una de las variables es constante: el coeficiente de correlación no está definido.',
        },
        ...emptyTrace(),
        steps,
      };
    }
    r = sums.sxy / Math.sqrt(sums.sxx * sums.syy);
    if (!spearman || new Set(x).size !== size || new Set(y).size !== size) {
      steps.push({
        title: spearman
          ? 'Coeficiente de Spearman (Pearson de los rangos)'
          : 'Coeficiente de correlación de Pearson',
        formula: `${symbol} = \\frac{S_{xy}}{\\sqrt{S_{xx} S_{yy}}}`,
        substitution: `${symbol} = \\frac{${n(sums.sxy)}}{\\sqrt{${n(sums.sxx)}(${n(sums.syy)})}}`,
        result: `${symbol} = ${n(r)}`,
      });
    }
    if (!spearman) {
      steps.push({
        title: 'Coeficiente de determinación',
        explanation: `r² = ${formatNumber(r * r, 4)}: el ${formatNumber(r * r * 100, 4)} % de la variación de y se explica por su relación lineal con x.`,
        result: `r^2 = ${n(r * r)}`,
      });
    }
    const b1 = sums.sxy / sums.sxx;
    const b0 = sums.meanY - b1 * sums.meanX;
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    series.push({
      id: 'dispersion',
      title: spearman ? 'Diagrama de dispersión de los rangos' : 'Diagrama de dispersión',
      xLabel: spearman ? 'rango de x' : 'x',
      yLabel: spearman ? 'rango de y' : 'y',
      label: 'Recta de mínimos cuadrados',
      points: [
        { x: lo, y: b0 + b1 * lo },
        { x: hi, y: b0 + b1 * hi },
      ],
      scatter: { label: 'Datos', points: xs.map((xi, i) => ({ x: xi, y: ys[i]! })) },
    });
  } else {
    r = input.r!;
    size = input.n!;
    steps.push({ title: 'Datos', result: `${symbol} = ${n(r)}, \\quad n = ${size}` });
  }

  steps.push({
    title: 'Interpretación',
    explanation: `La asociación ${spearman ? 'monótona' : 'lineal'} es ${strength(r)}. La correlación no implica causalidad.`,
  });

  const rho = input.rho0;
  steps.push({ title: 'Hipótesis', result: hypothesesLatex('\\rho', n(rho), input.alternative) });
  let statistic: number;
  let kind: 't' | 'z';
  if (rho === 0) {
    kind = 't';
    statistic = (r * Math.sqrt(size - 2)) / Math.sqrt(1 - r * r);
    steps.push({
      title: 'Estadístico t',
      explanation: `Si ρ = 0, tiene distribución t con ν = n − 2 = ${size - 2} grados de libertad.${spearman ? ' Para Spearman es una aproximación, adecuada con n ≥ 10.' : ''}`,
      formula: `t = \\frac{${symbol}\\sqrt{n - 2}}{\\sqrt{1 - ${symbol}^2}}`,
      substitution: `t = \\frac{${op(r)}\\sqrt{${size} - 2}}{\\sqrt{1 - ${op(r)}^2}}`,
      result: `t = ${n(statistic)}`,
    });
  } else {
    kind = 'z';
    statistic = (Math.sqrt(size - 3) / 2) * Math.log(((1 + r) * (1 - rho)) / ((1 - r) * (1 + rho)));
    steps.push({
      title: 'Estadístico z (transformación de Fisher)',
      explanation: 'Para ρ₀ ≠ 0 se usa la transformación de Fisher, aproximadamente normal.',
      formula:
        'z = \\frac{\\sqrt{n - 3}}{2}\\ln\\left[\\frac{(1 + r)(1 - \\rho_0)}{(1 - r)(1 + \\rho_0)}\\right]',
      substitution: `z = \\frac{\\sqrt{${size} - 3}}{2}\\ln\\left[\\frac{(1 + ${op(r)})(1 - ${op(rho)})}{(1 - ${op(r)})(1 + ${op(rho)})}\\right]`,
      result: `z = ${n(statistic)}`,
    });
  }
  const outcome = testDecision({
    statistic: kind === 't' ? { kind: 't', df: size - 2 } : { kind: 'z' },
    value: statistic,
    alternative: input.alternative,
    alpha: input.alpha,
  });
  steps.push(...outcome.steps);

  const summary: SummaryItem[] = [
    {
      label: spearman ? 'Coeficiente de Spearman' : 'Coeficiente de Pearson',
      value: `${symbol} = ${n(r)}`,
      emphasis: true,
    },
    ...(spearman ? [] : [{ label: 'Coeficiente de determinación', value: `r^2 = ${n(r * r)}` }]),
    { label: 'Estadístico', value: `${kind} = ${n(statistic)}` },
    ...outcome.summary,
  ];
  return {
    ok: true,
    value: { r, n: size, statistic, kind, pValue: outcome.pValue, reject: outcome.reject },
    summary,
    ...emptyTrace(),
    steps,
    series: [...series, outcome.series],
  };
}

export const correlation: Calculator<CorrelationInput, CorrelationValue, CorrelationErrorCode> = {
  meta: {
    id: 'coeficiente-de-correlacion',
    title: 'Coeficiente de correlación',
    summary:
      'Coeficiente de Pearson o de Spearman, con la prueba de hipótesis sobre la correlación poblacional ρ.',
    citations: [
      { sourceId: 'canavos-1995', locator: 'Cap. 13, correlación' },
      {
        sourceId: 'walpole-1999',
        locator:
          'Sec. 11.12 (correlación: datos de la tabla 11.1 y las 29 probetas de madera con r = 0.9435) y sec. 16.7 (correlación de rangos), 9.ª ed.',
      },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: correlationInputSchema,
  example: {
    source: 'resumen',
    method: 'pearson',
    x: POLLUTION_X,
    y: POLLUTION_Y,
    r: 0.9435,
    n: 29,
    rho0: 0.9,
    alternative: 'mayor',
    alpha: 0.05,
  },
  solve: solveCorrelation,
};
