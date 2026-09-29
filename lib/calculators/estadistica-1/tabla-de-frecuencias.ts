/**
 * Distribución de frecuencias de datos agrupados en clases e histograma (Walpole, Myers, Myers y
 * Ye, sec. 1.6: tablas 1.4 a 1.7 de la vida de baterías; Canavos, cap. 1):
 *
 *   número de clases (Sturges):   k = ⌈1 + 3.322 log₁₀ n⌉
 *   ancho de clase:               c = rango / k, redondeado hacia arriba a la precisión de los datos
 *   límites de clase:             Lᵢ = inicio + (i − 1)c,   Uᵢ = Lᵢ + c − u   (u = precisión)
 *   fronteras:                    Lᵢ − u/2 y Uᵢ + u/2;   marca de clase: (Lᵢ + Uᵢ)/2
 *   media de datos agrupados:     x̄ ≈ Σ fᵢmᵢ / n
 *
 * El número de clases, el inicio y el ancho se pueden fijar para reproducir la tabla de un libro.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';

const MAX_VALUES = 1000;
const MAX_CLASSES = 30;

const dataField = z.string().superRefine((text, ctx) => {
  const { values, invalid } = parseDataList(text);
  if (invalid.length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: `No son números: ${invalid
        .slice(0, 3)
        .map((t) => `«${t}»`)
        .join(', ')}${invalid.length > 3 ? '…' : ''}.`,
    });
  } else if (values.length < 2) {
    ctx.addIssue({ code: 'custom', message: 'Ingresa al menos 2 datos.' });
  } else if (values.length > MAX_VALUES) {
    ctx.addIssue({ code: 'custom', message: `El máximo es ${MAX_VALUES} datos.` });
  }
});

export const frequencyTableInputSchema = z.object({
  data: dataField,
  classes: z
    .number({ error: 'Ingresa el número de clases.' })
    .int('Debe ser un número entero.')
    .min(1, 'Hace falta al menos 1 clase.')
    .max(MAX_CLASSES, `El máximo es ${MAX_CLASSES} clases.`)
    .optional(),
  start: z
    .number({ error: 'Ingresa el límite inferior de la primera clase.' })
    .refine(Number.isFinite, 'Debe ser un número finito.')
    .optional(),
  width: z
    .number({ error: 'Ingresa el ancho de clase.' })
    .refine((v) => Number.isFinite(v) && v > 0, 'El ancho debe ser mayor que 0.')
    .optional(),
});

export type FrequencyTableInput = z.infer<typeof frequencyTableInputSchema>;

export interface FrequencyClass {
  lower: number;
  upper: number;
  midpoint: number;
  frequency: number;
  relative: number;
  cumulative: number;
}

export interface FrequencyTableValue {
  n: number;
  width: number;
  classes: FrequencyClass[];
  /** Σ fᵢmᵢ / n */
  groupedMean: number;
  /** [Σ fᵢmᵢ² − (Σ fᵢmᵢ)²/n] / (n − 1) */
  groupedVariance: number;
  /** Media calculada con los datos originales, para comparar. */
  mean: number;
}

export type FrequencyTableErrorCode = 'invalid-data' | 'data-outside';

type Result = CalculatorResult<FrequencyTableValue, FrequencyTableErrorCode>;

const n = toLatexNumber;

/** Decimales de un dato tal como se escribió ("3.40" → 2, "12" → 0). */
function decimalsOf(token: string): number {
  const match = /[.,](\d+)/.exec(token.replace(/e.*$/i, ''));
  return match ? match[1]!.length : 0;
}

export function solveFrequencyTable(input: FrequencyTableInput): Result {
  const { values, invalid } = parseDataList(input.data);
  const fail = (code: FrequencyTableErrorCode, message: string, steps: Step[] = []): Result => ({
    ok: false,
    error: { code, message },
    ...emptyTrace(),
    steps,
  });
  if (invalid.length > 0 || values.length < 2) {
    return fail('invalid-data', 'Ingresa al menos 2 datos numéricos.');
  }

  const tokens = input.data.split(/[\s;]+|,(?=\s)/).filter((t) => t.trim() !== '');
  const decimals = Math.min(6, Math.max(0, ...tokens.map(decimalsOf)));
  const unit = 10 ** -decimals;
  const round = (v: number) => Number(v.toFixed(decimals + 4));
  const tidy = (v: number) => Number(v.toFixed(Math.min(10, decimals + 2)));
  /** Con los decimales de los datos (+ `extra`): "2.0", no "2", para los límites de clase. */
  const fixed = (v: number, extra = 0) => v.toFixed(decimals + extra);

  const count = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const start = input.start ?? min;
  const range = max - start;

  const steps: Step[] = [
    {
      title: 'Datos',
      explanation: `Hay n = ${count} datos, registrados con ${decimals === 0 ? 'precisión de enteros' : `${decimals} decimal${decimals === 1 ? '' : 'es'}`} (u = ${formatNumber(unit)}).`,
      formula: 'R = x_{\\max} - x_{\\min}',
      substitution: `R = ${n(max)} - ${n(min)}`,
      result: `R = ${n(round(max - min))}`,
    },
  ];

  if (start > min) {
    return fail(
      'data-outside',
      `El inicio de la primera clase (${formatNumber(start)}) es mayor que el dato más pequeño (${formatNumber(min)}).`,
      steps,
    );
  }

  // Número de clases.
  let k: number;
  if (input.classes !== undefined) {
    k = input.classes;
    steps.push({
      title: 'Número de clases',
      explanation: 'Se usa el número de clases indicado.',
      result: `k = ${k}`,
    });
  } else if (input.width !== undefined) {
    k = Math.floor(round(range / input.width)) + 1;
    steps.push({
      title: 'Número de clases',
      explanation:
        'Con el ancho indicado, hacen falta las clases necesarias para llegar al dato más grande.',
      result: `k = ${k}`,
    });
  } else {
    const sturges = 1 + 3.322 * Math.log10(count);
    k = Math.min(MAX_CLASSES, Math.max(1, Math.ceil(sturges)));
    steps.push({
      title: 'Número de clases (regla de Sturges)',
      explanation:
        'Una guía común: entre 5 y 20 clases, menos cuantos menos datos haya. La regla de Sturges da un valor inicial; se redondea hacia arriba.',
      formula: 'k = 1 + 3.322 \\log_{10} n',
      substitution: `k = 1 + 3.322 \\log_{10} ${count} = ${n(sturges, 4)}`,
      result: `k = ${k}`,
    });
  }

  // Ancho de clase.
  let width: number;
  if (input.width !== undefined) {
    width = input.width;
    steps.push({
      title: 'Ancho de clase',
      explanation: 'Se usa el ancho indicado.',
      result: `c = ${n(width)}`,
    });
  } else {
    // Múltiplo de u con k·c > R, para que el dato mayor quepa en la última clase.
    width = tidy((Math.floor(round(range / (k * unit))) + 1) * unit);
    steps.push({
      title: 'Ancho de clase',
      explanation: `Se divide el rango entre el número de clases y se redondea hacia arriba a la precisión de los datos (u = ${formatNumber(unit)}), de modo que las k clases cubran todos los datos.`,
      formula: 'c \\ge \\frac{R}{k}',
      substitution: `\\frac{${n(round(range))}}{${k}} = ${n(range / k, 6)}`,
      result: `c = ${n(width)}`,
    });
  }

  const lowers = Array.from({ length: k }, (_, i) => tidy(start + i * width));
  const uppers = lowers.map((l) => tidy(l + width - unit));
  const lastBoundary = uppers.at(-1)! + unit / 2;
  if (max >= lastBoundary + 1e-9 * Math.max(1, Math.abs(max))) {
    return fail(
      'data-outside',
      `Con ${k} clases de ancho ${formatNumber(width)} desde ${formatNumber(start)}, el dato ${formatNumber(max)} queda fuera de la última clase. Aumenta el número de clases o el ancho.`,
      steps,
    );
  }

  steps.push({
    title: 'Límites y fronteras de clase',
    explanation: `La primera clase empieza en ${formatNumber(start)}. Cada límite superior es el inferior más c − u, para que ningún dato caiga en dos clases; las fronteras están a media unidad (u/2) de los límites, y la marca de clase es el punto medio.`,
    formula: 'L_i = L_1 + (i - 1)c, \\qquad U_i = L_i + c - u, \\qquad m_i = \\frac{L_i + U_i}{2}',
    substitution: `L_1 = ${fixed(lowers[0]!)}, \\quad U_1 = ${fixed(lowers[0]!)} + ${n(width)} - ${n(unit)} = ${fixed(uppers[0]!)}, \\quad m_1 = ${n(tidy((lowers[0]! + uppers[0]!) / 2))}`,
  });

  const frequencies = Array<number>(k).fill(0);
  const firstBoundary = start - unit / 2;
  for (const v of values) {
    const index = Math.min(k - 1, Math.max(0, Math.floor(round((v - firstBoundary) / width))));
    frequencies[index]!++;
  }
  let cumulative = 0;
  const classes: FrequencyClass[] = lowers.map((lower, i) => {
    cumulative += frequencies[i]!;
    return {
      lower,
      upper: uppers[i]!,
      midpoint: tidy((lower + uppers[i]!) / 2),
      frequency: frequencies[i]!,
      relative: frequencies[i]! / count,
      cumulative,
    };
  });

  steps.push({
    title: 'Contar las frecuencias',
    explanation:
      'Se cuenta cuántos datos caen en cada clase (entre sus fronteras). La frecuencia relativa es f/n y la acumulada suma las frecuencias hasta esa clase.',
    formula: 'f_i, \\qquad \\frac{f_i}{n}, \\qquad F_i = f_1 + \\cdots + f_i',
    result: `f = ${frequencies.join(',\\ ')}, \\qquad \\sum f_i = ${count}`,
  });

  const sumFm = classes.reduce((s, c) => s + c.frequency * c.midpoint, 0);
  const sumFm2 = classes.reduce((s, c) => s + c.frequency * c.midpoint ** 2, 0);
  const groupedMean = sumFm / count;
  const groupedVariance = (sumFm2 - sumFm ** 2 / count) / (count - 1);
  const mean = values.reduce((s, v) => s + v, 0) / count;
  steps.push(
    {
      title: 'Media de los datos agrupados',
      explanation:
        'Si solo se tuviera la tabla, cada dato se representa con la marca de su clase. Es una aproximación de la media de los datos originales.',
      formula: '\\bar{x} \\approx \\frac{\\sum f_i m_i}{n}',
      substitution: `\\bar{x} \\approx \\frac{${n(tidy(sumFm))}}{${count}}`,
      result: `\\bar{x} \\approx ${n(groupedMean)} \\quad (\\text{con los datos: } ${n(mean)})`,
    },
    {
      title: 'Varianza de los datos agrupados',
      formula: 's^2 \\approx \\frac{\\sum f_i m_i^2 - \\left(\\sum f_i m_i\\right)^2 / n}{n - 1}',
      substitution: `s^2 \\approx \\frac{${n(tidy(sumFm2))} - (${n(tidy(sumFm))})^2 / ${count}}{${count - 1}}`,
      result: `s^2 \\approx ${n(groupedVariance)}, \\qquad s \\approx ${n(Math.sqrt(Math.max(0, groupedVariance)))}`,
    },
  );

  const label = (a: number, b: number, extra = 0) =>
    `${fixed(a, extra)}\\text{–}${fixed(b, extra)}`;
  return {
    ok: true,
    value: { n: count, width, classes, groupedMean, groupedVariance, mean },
    summary: [
      { label: 'Clases', value: `k = ${k}, \\quad c = ${n(width)}`, emphasis: true },
      { label: 'Media agrupada', value: `\\bar{x} \\approx ${n(groupedMean, 6)}` },
      { label: 'Media de los datos', value: `\\bar{x} = ${n(mean, 6)}` },
      { label: 'Datos', value: `n = ${count}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'frecuencias',
        title: 'Distribución de frecuencias',
        columns: [
          { key: 'limits', header: '\\text{Clase}', format: 'latex' },
          { key: 'boundaries', header: '\\text{Fronteras}', format: 'latex' },
          { key: 'midpoint', header: 'm_i' },
          { key: 'frequency', header: 'f_i' },
          { key: 'relative', header: 'f_i / n' },
          { key: 'cumulative', header: 'F_i' },
          { key: 'cumulativeRelative', header: 'F_i / n' },
        ],
        rows: classes.map((c) => ({
          limits: label(c.lower, c.upper),
          boundaries: label(c.lower - unit / 2, c.upper + unit / 2, 1),
          midpoint: c.midpoint,
          frequency: c.frequency,
          relative: c.relative,
          cumulative: c.cumulative,
          cumulativeRelative: c.cumulative / count,
        })),
      },
    ],
    series: [
      {
        id: 'histograma',
        title: 'Histograma de frecuencias relativas',
        xLabel: 'Marca de clase',
        yLabel: 'Frecuencia relativa',
        kind: 'bar',
        points: classes.map((c) => ({ x: c.midpoint, y: c.relative })),
      },
    ],
  };
}

export const frequencyTable: Calculator<
  FrequencyTableInput,
  FrequencyTableValue,
  FrequencyTableErrorCode
> = {
  meta: {
    id: 'tabla-de-frecuencias',
    title: 'Tabla de frecuencias e histograma',
    summary:
      'Agrupa datos en clases, calcula frecuencias relativas y acumuladas y dibuja el histograma.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 1.6, tablas 1.4 a 1.7 y figura 1.6 (9.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'mendenhall-sincich-1997' },
    ],
  },
  inputSchema: frequencyTableInputSchema,
  // Walpole, tablas 1.4 y 1.7: vida de 40 baterías, 7 clases de ancho 0.5 desde 1.5.
  example: {
    data: [
      '2.2 4.1 3.5 4.5 3.2 3.7 3.0 2.6',
      '3.4 1.6 3.1 3.3 3.8 3.1 4.7 3.7',
      '2.5 4.3 3.4 3.6 2.9 3.3 3.9 3.1',
      '3.3 3.1 3.7 4.4 3.2 4.1 1.9 3.4',
      '4.7 3.8 3.2 2.6 3.9 3.0 4.2 3.5',
    ].join('\n'),
    classes: 7,
    start: 1.5,
    width: 0.5,
  },
  solve: solveFrequencyTable,
};
