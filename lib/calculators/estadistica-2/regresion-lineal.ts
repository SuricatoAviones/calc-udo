/**
 * Regresión lineal simple por mínimos cuadrados con inferencia (Walpole, Myers, Myers y Ye,
 * sec. 11.3 a 11.6; Canavos, cap. 13):
 *
 *   ŷ = b₀ + b₁x,   s² = SSE/(n − 2)
 *   IC para β₁:        b₁ ± t_{α/2} s/√Sxx
 *   IC para β₀:        b₀ ± t_{α/2} s √(Σxᵢ² / (n Sxx))
 *   Prueba β₁ = 0:     t = b₁ / (s/√Sxx),  ν = n − 2
 *   IC para μ_{Y|x₀}:  ŷ₀ ± t_{α/2} s √(1/n + (x₀ − x̄)²/Sxx)
 *   Predicción de y₀:  ŷ₀ ± t_{α/2} s √(1 + 1/n + (x₀ − x̄)²/Sxx)
 */
import { z } from 'zod';
import { studentTQuantile } from '@/lib/math/distributions';
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
import { alphaField, testDecision } from './hypothesis';
import { readPairs, refinePairs, regressionSums } from './regression';

export const linearRegressionInputSchema = z
  .object({
    ...pointsShape,
    alpha: alphaField,
    x0: z.number().refine(Number.isFinite, 'x₀ debe ser un número finito.').optional(),
  })
  .superRefine((v, ctx) => {
    refinePairs(v, ctx);
  });

export type LinearRegressionInput = z.infer<typeof linearRegressionInputSchema>;

export interface LinearRegressionValue {
  b0: number;
  b1: number;
  sxx: number;
  sxy: number;
  syy: number;
  sse: number;
  s: number;
  r2: number;
  tCritical: number;
  slopeInterval: [number, number];
  interceptInterval: [number, number];
  slopeTest: { t: number; pValue: number; reject: boolean };
  prediction: {
    x0: number;
    y0: number;
    meanInterval: [number, number];
    predictionInterval: [number, number];
  } | null;
}

export type LinearRegressionErrorCode = never;

const n = (v: number) => toLatexNumber(v, 6);
const op = (v: number) => toLatexOperand(v, 6);

export function solveLinearRegression(
  input: LinearRegressionInput,
): CalculatorResult<LinearRegressionValue, LinearRegressionErrorCode> {
  const { x, y } = readPairs(input.x, input.y);
  const sums = regressionSums(x, y);
  const { n: size, sxx, sxy, syy, meanX, meanY } = sums;
  const b1 = sxy / sxx;
  const b0 = meanY - b1 * meanX;
  const sse = Math.max(0, syy - b1 * sxy);
  const df = size - 2;
  const s2 = sse / df;
  const s = Math.sqrt(s2);
  const r2 = syy === 0 ? 1 : 1 - sse / syy;
  const alpha = input.alpha;
  const level = formatNumber((1 - alpha) * 100);
  const t = studentTQuantile(1 - alpha / 2, df);
  const seSlope = s / Math.sqrt(sxx);
  const seIntercept = s * Math.sqrt(sums.sumX2 / (size * sxx));
  const slopeInterval: [number, number] = [b1 - t * seSlope, b1 + t * seSlope];
  const interceptInterval: [number, number] = [b0 - t * seIntercept, b0 + t * seIntercept];
  const line = `\\hat{y} = ${n(b0)} ${b1 < 0 ? '-' : '+'} ${n(Math.abs(b1))}x`;

  const steps: Step[] = [
    {
      title: 'Sumas',
      result: `n = ${size},\\ \\sum x_i = ${n(sums.sumX)},\\ \\sum y_i = ${n(sums.sumY)},\\ \\sum x_i y_i = ${n(sums.sumXY)},\\ \\sum x_i^2 = ${n(sums.sumX2)},\\ \\sum y_i^2 = ${n(sums.sumY2)}`,
    },
    {
      title: 'Sumas de cuadrados y productos',
      formula:
        'S_{xx} = \\sum x_i^2 - \\frac{(\\sum x_i)^2}{n}, \\quad S_{xy} = \\sum x_i y_i - \\frac{\\sum x_i \\sum y_i}{n}, \\quad S_{yy} = \\sum y_i^2 - \\frac{(\\sum y_i)^2}{n}',
      substitution: `S_{xx} = ${n(sums.sumX2)} - \\frac{${op(sums.sumX)}^2}{${size}}, \\quad S_{xy} = ${n(sums.sumXY)} - \\frac{${op(sums.sumX)}${op(sums.sumY)}}{${size}}`,
      result: `S_{xx} = ${n(sxx)}, \\quad S_{xy} = ${n(sxy)}, \\quad S_{yy} = ${n(syy)}`,
    },
    {
      title: 'Recta de mínimos cuadrados',
      formula: 'b_1 = \\frac{S_{xy}}{S_{xx}}, \\qquad b_0 = \\bar{y} - b_1\\bar{x}',
      substitution: `b_1 = \\frac{${n(sxy)}}{${n(sxx)}}, \\qquad b_0 = ${n(meanY)} - ${op(b1)}${op(meanX)}`,
      result: `b_1 = ${n(b1)}, \\quad b_0 = ${n(b0)} \\qquad ${line}`,
    },
    {
      title: 'Error estándar de la estimación',
      explanation:
        'SSE es la suma de los cuadrados de los residuos; s² estima la varianza σ² de los errores con n − 2 grados de libertad.',
      formula: 'SSE = S_{yy} - b_1 S_{xy}, \\qquad s^2 = \\frac{SSE}{n - 2}',
      substitution: `SSE = ${n(syy)} - ${op(b1)}${op(sxy)}, \\qquad s^2 = \\frac{${n(sse)}}{${df}}`,
      result: `s^2 = ${n(s2)}, \\quad s = ${n(s)}`,
    },
    {
      title: 'Coeficiente de determinación',
      explanation: `El modelo explica el ${formatNumber(r2 * 100, 4)} % de la variación de y.`,
      formula: 'R^2 = 1 - \\frac{SSE}{S_{yy}}',
      substitution: `R^2 = 1 - \\frac{${n(sse)}}{${n(syy)}}`,
      result: `R^2 = ${n(r2)}`,
    },
    {
      title: `Intervalo de confianza de ${level} % para la pendiente β₁`,
      formula: 'b_1 \\pm t_{\\alpha/2}\\,\\frac{s}{\\sqrt{S_{xx}}}',
      substitution: `${n(b1)} \\pm ${n(t)}\\,\\frac{${n(s)}}{\\sqrt{${n(sxx)}}}, \\qquad t_{${formatNumber(alpha / 2)}} \\text{ con } \\nu = ${df}`,
      result: `${n(slopeInterval[0])} < \\beta_1 < ${n(slopeInterval[1])}`,
    },
    {
      title: `Intervalo de confianza de ${level} % para la ordenada β₀`,
      formula: 'b_0 \\pm t_{\\alpha/2}\\, s\\sqrt{\\frac{\\sum x_i^2}{n S_{xx}}}',
      substitution: `${n(b0)} \\pm ${n(t)}(${n(s)})\\sqrt{\\frac{${n(sums.sumX2)}}{${size}(${n(sxx)})}}`,
      result: `${n(interceptInterval[0])} < \\beta_0 < ${n(interceptInterval[1])}`,
    },
  ];

  const tSlope = b1 / seSlope;
  steps.push({
    title: '¿Es significativa la regresión? Prueba de β₁ = 0',
    explanation: 'Si β₁ = 0, x no ayuda a predecir y linealmente.',
    formula:
      'H_0\\!: \\beta_1 = 0,\\quad H_1\\!: \\beta_1 \\neq 0, \\qquad t = \\frac{b_1}{s/\\sqrt{S_{xx}}}',
    substitution: `t = \\frac{${n(b1)}}{${n(s)}/\\sqrt{${n(sxx)}}}`,
    result: `t = ${n(tSlope)}`,
  });
  const test = testDecision({
    statistic: { kind: 't', df },
    value: tSlope,
    alternative: 'distinto',
    alpha,
  });
  steps.push({ title: 'Decisión sobre β₁', children: test.steps });

  let prediction: LinearRegressionValue['prediction'] = null;
  if (input.x0 !== undefined) {
    const x0 = input.x0;
    const y0 = b0 + b1 * x0;
    const meanHalf = t * s * Math.sqrt(1 / size + (x0 - meanX) ** 2 / sxx);
    const predHalf = t * s * Math.sqrt(1 + 1 / size + (x0 - meanX) ** 2 / sxx);
    prediction = {
      x0,
      y0,
      meanInterval: [y0 - meanHalf, y0 + meanHalf],
      predictionInterval: [y0 - predHalf, y0 + predHalf],
    };
    steps.push({
      title: `Respuesta media en x₀ = ${formatNumber(x0)}`,
      formula:
        '\\hat{y}_0 \\pm t_{\\alpha/2}\\, s\\sqrt{\\frac{1}{n} + \\frac{(x_0 - \\bar{x})^2}{S_{xx}}}',
      substitution: `\\hat{y}_0 = ${n(b0)} + ${op(b1)}${op(x0)} = ${n(y0)}; \\quad ${n(y0)} \\pm ${n(t)}(${n(s)})\\sqrt{\\frac{1}{${size}} + \\frac{(${n(x0)} - ${op(meanX)})^2}{${n(sxx)}}}`,
      result: `${n(prediction.meanInterval[0])} < \\mu_{Y|${n(x0)}} < ${n(prediction.meanInterval[1])}`,
    });
    steps.push({
      title: `Intervalo de predicción para una nueva observación en x₀ = ${formatNumber(x0)}`,
      explanation:
        'Es más ancho que el de la media: además de la incertidumbre de la recta incluye la variación de una observación individual.',
      formula:
        '\\hat{y}_0 \\pm t_{\\alpha/2}\\, s\\sqrt{1 + \\frac{1}{n} + \\frac{(x_0 - \\bar{x})^2}{S_{xx}}}',
      result: `${n(prediction.predictionInterval[0])} < y_0 < ${n(prediction.predictionInterval[1])}`,
    });
  }

  // Gráfica: datos, recta y bandas de confianza para la media.
  const lo = Math.min(...x, input.x0 ?? Infinity);
  const hi = Math.max(...x, input.x0 ?? -Infinity);
  const pad = 0.05 * (hi - lo);
  const grid = Array.from({ length: 81 }, (_, i) => lo - pad + ((hi - lo + 2 * pad) * i) / 80);
  const band = (sign: 1 | -1) =>
    grid.map((g) => ({
      x: g,
      y: b0 + b1 * g + sign * t * s * Math.sqrt(1 / size + (g - meanX) ** 2 / sxx),
    }));
  const series: Series[] = [
    {
      id: 'regresion',
      title: 'Datos y recta de regresión',
      xLabel: 'x',
      yLabel: 'y',
      label: 'Recta de regresión',
      points: grid.map((g) => ({ x: g, y: b0 + b1 * g })),
      scatter: { label: 'Datos', points: x.map((xi, i) => ({ x: xi, y: y[i]! })) },
      others: [
        { label: `Límite inferior del IC de ${level} % para la media`, points: band(-1) },
        { label: `Límite superior del IC de ${level} % para la media`, points: band(1) },
      ],
    },
  ];

  const summary: SummaryItem[] = [
    { label: 'Recta de regresión', value: line, emphasis: true },
    { label: 'Coeficiente de determinación', value: `R^2 = ${n(r2)}` },
    {
      label: `IC de ${level} % para β₁`,
      value: `(${n(slopeInterval[0])},\\ ${n(slopeInterval[1])})`,
    },
    {
      label: 'Prueba β₁ = 0',
      value: test.reject
        ? `\\text{Se rechaza } (P = ${toLatexNumber(test.pValue, 4)})`
        : `\\text{No se rechaza } (P = ${toLatexNumber(test.pValue, 4)})`,
    },
  ];
  if (prediction) {
    summary.push({
      label: `Predicción en x₀ = ${formatNumber(prediction.x0)}`,
      value: `\\hat{y}_0 = ${n(prediction.y0)}`,
    });
  }

  return {
    ok: true,
    value: {
      b0,
      b1,
      sxx,
      sxy,
      syy,
      sse,
      s,
      r2,
      tCritical: t,
      slopeInterval,
      interceptInterval,
      slopeTest: { t: tSlope, pValue: test.pValue, reject: test.reject },
      prediction,
    },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'residuos',
        title: 'Valores ajustados y residuos',
        columns: [
          { key: 'i', header: 'i' },
          { key: 'x', header: 'x_i' },
          { key: 'y', header: 'y_i' },
          { key: 'fit', header: '\\hat{y}_i' },
          { key: 'e', header: 'e_i = y_i - \\hat{y}_i' },
        ],
        rows: x.map((xi, i) => ({
          i: i + 1,
          x: xi,
          y: y[i]!,
          fit: b0 + b1 * xi,
          e: y[i]! - (b0 + b1 * xi),
        })),
      },
    ],
    series,
  };
}

/** Walpole, tabla 11.1: reducción de sólidos (x, %) y de la demanda química de oxígeno (y, %). */
export const POLLUTION_X =
  '3 7 11 15 18 27 29 30 30 31 31 32 33 33 34 36 36 36 37 38 39 39 39 40 41 42 42 43 44 45 46 47 50';
export const POLLUTION_Y =
  '5 11 21 16 16 28 27 25 35 30 40 32 34 32 34 37 38 34 36 38 37 36 45 39 41 40 44 37 44 46 46 49 51';

export const linearRegression: Calculator<
  LinearRegressionInput,
  LinearRegressionValue,
  LinearRegressionErrorCode
> = {
  meta: {
    id: 'regresion-lineal',
    title: 'Regresión lineal simple',
    summary:
      'Recta de mínimos cuadrados con R², intervalos de confianza para β₀ y β₁, prueba de la pendiente y predicción.',
    citations: [
      { sourceId: 'canavos-1995', locator: 'Cap. 13, regresión lineal simple' },
      {
        sourceId: 'walpole-1999',
        locator:
          'Cap. 11, tabla 11.1 y ejemplos 11.1 a 11.3 (reducción de la contaminación química), secs. 11.5 y 11.6, 9.ª ed.',
      },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: linearRegressionInputSchema,
  example: { x: POLLUTION_X, y: POLLUTION_Y, alpha: 0.05, x0: 20 },
  solve: solveLinearRegression,
};
