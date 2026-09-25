/**
 * Suavizamiento exponencial simple (Anderson, Sweeney y Williams, cap. de pronósticos: ejemplo
 * de las ventas semanales de gasolina).
 *
 *   F_{t+1} = αY_t + (1 − α)F_t = F_t + α(Y_t − F_t),   0 < α ≤ 1
 *
 * El nuevo pronóstico corrige el anterior con una fracción α del error. Si no se da un
 * pronóstico inicial, se toma F₂ = Y₁ (como en el libro) y el primer error es el del periodo 2.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { emptyTrace, type Calculator, type Step } from '../types';
import {
  accuracy,
  accuracyNotices,
  accuracySteps,
  forecastOutput,
  nextForecastStep,
  timeSeriesField,
  type ForecastErrorCode,
  type ForecastPoint,
  type ForecastResult,
  type ForecastValue,
} from './forecasting';

export const exponentialSmoothingInputSchema = z.object({
  data: timeSeriesField,
  alpha: z
    .number({ error: 'Ingresa la constante de suavizamiento α.' })
    .refine(Number.isFinite, 'α debe ser un número finito.')
    .refine((v) => v > 0 && v <= 1, 'α debe estar entre 0 (sin incluir) y 1.'),
  initialForecast: z
    .number({ error: 'Escribe un número o deja el campo vacío.' })
    .refine(Number.isFinite, 'El pronóstico inicial debe ser un número finito.')
    .optional(),
});

export type ExponentialSmoothingInput = z.infer<typeof exponentialSmoothingInputSchema>;

const n = toLatexNumber;

export function solveExponentialSmoothing(input: ExponentialSmoothingInput): ForecastResult {
  const { values: data } = parseDataList(input.data);
  if (data.length < 3) {
    return {
      ok: false,
      error: { code: 'invalid-data', message: 'Ingresa al menos 3 datos de la serie.' },
      ...emptyTrace(),
    };
  }
  const { alpha } = input;
  const given = input.initialForecast !== undefined;
  // Primer periodo con pronóstico y su valor.
  const first = given ? 1 : 2;
  let forecast = given ? input.initialForecast! : data[0]!;

  const points: ForecastPoint[] = [{ period: first, actual: data[first - 1]!, forecast }];
  const children: Step[] = [];
  for (let t = first; t <= data.length; t++) {
    const y = data[t - 1]!;
    const next = alpha * y + (1 - alpha) * forecast;
    children.push({
      title: t < data.length ? `Periodo ${t + 1}` : `Periodo ${t + 1} (futuro)`,
      substitution: `F_{${t + 1}} = ${n(alpha)}(${n(y)}) + ${n(1 - alpha)}(${n(forecast, 6)}) = ${n(forecast, 6)} + ${n(alpha)}(${n(y)} - ${toLatexOperand(forecast, 6)})`,
      result: `F_{${t + 1}} = ${n(next, 6)}`,
    });
    forecast = next;
    points.push({ period: t + 1, actual: t + 1 <= data.length ? data[t]! : null, forecast });
  }

  const acc = accuracy(points);
  const next = points.at(-1)!;
  const steps: Step[] = [
    {
      title: 'Pronóstico inicial',
      explanation: given
        ? 'Se usa el pronóstico inicial dado para el periodo 1.'
        : 'Sin un pronóstico inicial, se toma el primer dato como pronóstico del periodo 2.',
      result: given ? `F_1 = ${n(input.initialForecast!, 6)}` : `F_2 = Y_1 = ${n(data[0]!)}`,
    },
    {
      title: 'Suavizamiento exponencial',
      explanation: `Cada pronóstico es un promedio ponderado del último dato y del último pronóstico: con α = ${alpha}, el nuevo pronóstico corrige el anterior con el ${formatNumber(alpha * 100)} % del error.`,
      formula: 'F_{t+1} = \\alpha Y_t + (1 - \\alpha) F_t = F_t + \\alpha\\,(Y_t - F_t)',
      children,
    },
    ...accuracySteps(points, acc),
    nextForecastStep(next, data.length),
  ];

  const value: ForecastValue = {
    ...acc,
    next: next.forecast,
    nextPeriod: next.period,
    forecasts: points,
  };
  return {
    ok: true,
    value,
    ...emptyTrace(),
    ...forecastOutput(data, points, acc, `α = ${alpha}`),
    steps,
    notices: accuracyNotices(acc),
  };
}

export const exponentialSmoothing: Calculator<
  ExponentialSmoothingInput,
  ForecastValue,
  ForecastErrorCode
> = {
  meta: {
    id: 'suavizamiento-exponencial',
    title: 'Suavizamiento exponencial simple',
    summary: 'Corrige el pronóstico anterior con una fracción α del error.',
    citations: [
      {
        sourceId: 'anderson-1993',
        locator:
          'Cap. de pronósticos: ventas semanales de gasolina con α = 0.2 (ediciones recientes, tabla 17.1)',
      },
      { sourceId: 'aquilano-1994' },
      { sourceId: 'bonini-2000' },
    ],
  },
  inputSchema: exponentialSmoothingInputSchema,
  // Anderson, Sweeney y Williams: ventas de gasolina (miles de galones), α = 0.2, F₂ = Y₁.
  example: { data: '17 21 19 23 18 16 20 18 22 20 15 22', alpha: 0.2 },
  solve: solveExponentialSmoothing,
};
