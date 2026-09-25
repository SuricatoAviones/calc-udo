/**
 * Medidas de tendencia central y de dispersión de una muestra (Walpole, Myers y Myers, sec. 1.4,
 * 1.5 y 8.2):
 *
 *   x̄ = Σxᵢ / n
 *   mediana: el valor central de los datos ordenados (promedio de los dos centrales si n es par)
 *   moda: el valor más frecuente
 *   s² = Σ(xᵢ − x̄)² / (n − 1) = [nΣxᵢ² − (Σxᵢ)²] / [n(n − 1)]      (teorema 8.1)
 *   s = √s²,   rango = máx − mín
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';

const MAX_VALUES = 1000;

export const descriptiveInputSchema = z.object({
  data: z.string().superRefine((text, ctx) => {
    const { values, invalid } = parseDataList(text);
    if (invalid.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `No son números: ${invalid
          .slice(0, 3)
          .map((t) => `«${t}»`)
          .join(
            ', ',
          )}${invalid.length > 3 ? '…' : ''}. Separa los datos con espacios, saltos de línea o punto y coma.`,
      });
    } else if (values.length < 2) {
      ctx.addIssue({ code: 'custom', message: 'Ingresa al menos 2 datos.' });
    } else if (values.length > MAX_VALUES) {
      ctx.addIssue({ code: 'custom', message: `El máximo es ${MAX_VALUES} datos.` });
    }
  }),
});

export type DescriptiveInput = z.infer<typeof descriptiveInputSchema>;

export interface DescriptiveValue {
  n: number;
  sum: number;
  sumOfSquares: number;
  mean: number;
  median: number;
  /** Valores más frecuentes; vacío si ningún valor se repite. */
  modes: number[];
  min: number;
  max: number;
  range: number;
  variance: number;
  standardDeviation: number;
}

export type DescriptiveErrorCode = 'invalid-data';

const n = toLatexNumber;

function listOrSummary(values: number[], max = 12): string {
  const shown = values
    .slice(0, max)
    .map((v) => n(v))
    .join(',\\ ');
  return values.length > max ? `${shown},\\ \\ldots` : shown;
}

export function solveDescriptive(
  input: DescriptiveInput,
): CalculatorResult<DescriptiveValue, DescriptiveErrorCode> {
  const { values, invalid } = parseDataList(input.data);
  if (invalid.length > 0 || values.length < 2) {
    return {
      ok: false,
      error: { code: 'invalid-data', message: 'Ingresa al menos 2 datos numéricos.' },
      ...emptyTrace(),
    };
  }

  const count = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((s, v) => s + v, 0);
  const sumOfSquares = values.reduce((s, v) => s + v * v, 0);
  const mean = sum / count;

  const middle = Math.floor(count / 2);
  const median = count % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;

  const frequencies = new Map<number, number>();
  for (const v of values) frequencies.set(v, (frequencies.get(v) ?? 0) + 1);
  const topFrequency = Math.max(...frequencies.values());
  const modes =
    topFrequency === 1
      ? []
      : [...frequencies.entries()]
          .filter(([, f]) => f === topFrequency)
          .map(([v]) => v)
          .sort((a, b) => a - b);

  const min = sorted[0]!;
  const max = sorted.at(-1)!;
  // Se usa la definición con desviaciones (numéricamente más estable) y se muestra también la
  // fórmula abreviada del teorema 8.1 de Walpole, que es la que se usa a mano.
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (count - 1);
  const standardDeviation = Math.sqrt(variance);

  const steps: Step[] = [
    {
      title: 'Ordenar los datos',
      explanation: `Hay n = ${count} datos. Ordenarlos facilita hallar la mediana, la moda y el rango.`,
      result: `${listOrSummary(sorted)}`,
    },
    {
      title: 'Sumas',
      formula: '\\sum x_i, \\qquad \\sum x_i^2',
      result: `\\sum x_i = ${n(sum)}, \\qquad \\sum x_i^2 = ${n(sumOfSquares)}`,
    },
    {
      title: 'Media muestral',
      formula: '\\bar{x} = \\frac{\\sum x_i}{n}',
      substitution: `\\bar{x} = \\frac{${n(sum)}}{${count}}`,
      result: `\\bar{x} = ${n(mean)}`,
    },
    {
      title: 'Mediana',
      explanation:
        count % 2 === 1
          ? `n es impar: la mediana es el dato en la posición (n + 1)/2 = ${middle + 1} de la lista ordenada.`
          : `n es par: la mediana es el promedio de los datos en las posiciones ${middle} y ${middle + 1} de la lista ordenada.`,
      formula:
        count % 2 === 1
          ? '\\tilde{x} = x_{((n+1)/2)}'
          : '\\tilde{x} = \\frac{x_{(n/2)} + x_{(n/2+1)}}{2}',
      substitution:
        count % 2 === 1
          ? undefined
          : `\\tilde{x} = \\frac{${n(sorted[middle - 1]!)} + ${n(sorted[middle]!)}}{2}`,
      result: `\\tilde{x} = ${n(median)}`,
    },
    {
      title: 'Moda',
      explanation:
        modes.length === 0
          ? 'Ningún valor se repite, así que la muestra no tiene moda.'
          : `${modes.length === 1 ? 'El valor que más se repite aparece' : 'Los valores que más se repiten aparecen'} ${topFrequency} veces.`,
      result:
        modes.length === 0 ? undefined : `\\text{Moda} = ${modes.map((m) => n(m)).join(',\\ ')}`,
    },
    {
      title: 'Rango',
      formula: 'R = x_{\\max} - x_{\\min}',
      substitution: `R = ${n(max)} - ${n(min)}`,
      result: `R = ${n(max - min)}`,
    },
    {
      title: 'Varianza muestral',
      explanation:
        'Se divide entre n − 1 (no entre n) porque la media se estimó con los mismos datos. La fórmula abreviada evita calcular cada desviación.',
      formula:
        's^2 = \\frac{\\sum (x_i - \\bar{x})^2}{n - 1} = \\frac{n\\sum x_i^2 - \\left(\\sum x_i\\right)^2}{n(n - 1)}',
      substitution: `s^2 = \\frac{${count}(${n(sumOfSquares)}) - (${n(sum)})^2}{${count}(${count - 1})}`,
      result: `s^2 = ${n(variance)}`,
    },
    {
      title: 'Desviación estándar muestral',
      formula: 's = \\sqrt{s^2}',
      substitution: `s = \\sqrt{${n(variance)}}`,
      result: `s = ${n(standardDeviation)}`,
    },
  ];

  const frequencyRows = [...frequencies.entries()]
    .sort(([a], [b]) => a - b)
    .map(([value, frequency]) => ({ value, frequency, relative: frequency / count }));

  return {
    ok: true,
    value: {
      n: count,
      sum,
      sumOfSquares,
      mean,
      median,
      modes,
      min,
      max,
      range: max - min,
      variance,
      standardDeviation,
    },
    summary: [
      { label: 'Media', value: `\\bar{x} = ${n(mean, 6)}`, emphasis: true },
      { label: 'Mediana', value: `\\tilde{x} = ${n(median, 6)}` },
      {
        label: 'Moda',
        value: modes.length === 0 ? '\\text{no hay}' : modes.map((m) => n(m, 6)).join(',\\ '),
      },
      { label: 'Desviación estándar', value: `s = ${n(standardDeviation, 6)}` },
      { label: 'Varianza', value: `s^2 = ${n(variance, 6)}` },
      { label: 'Rango', value: `R = ${n(max - min, 6)}` },
      { label: 'Datos', value: `n = ${count}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'frecuencias',
        title: 'Frecuencia de cada valor',
        columns: [
          { key: 'value', header: 'x' },
          { key: 'frequency', header: 'f' },
          { key: 'relative', header: 'f/n' },
        ],
        rows: frequencyRows,
      },
    ],
    series:
      frequencyRows.length <= 40
        ? [
            {
              id: 'frecuencias',
              title: 'Frecuencia de cada valor',
              xLabel: 'x',
              yLabel: 'Frecuencia',
              kind: 'bar',
              points: frequencyRows.map((r) => ({ x: r.value, y: r.frequency })),
            },
          ]
        : [],
    notices:
      count < 3
        ? [
            {
              level: 'info',
              message: `Con solo ${formatNumber(count)} datos las medidas de dispersión son poco confiables.`,
            },
          ]
        : [],
  };
}

export const descriptiveMeasures: Calculator<
  DescriptiveInput,
  DescriptiveValue,
  DescriptiveErrorCode
> = {
  meta: {
    id: 'medidas-descriptivas',
    title: 'Medidas de tendencia central y dispersión',
    summary: 'Media, mediana, moda, rango, varianza y desviación estándar de una muestra.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Secciones 1.4 y 1.5; sec. 8.2, Ejemplo 8.2 (numeración de la 8.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'mendenhall-sincich-1997' },
    ],
  },
  inputSchema: descriptiveInputSchema,
  // Walpole, ejemplo 8.2: truchas atrapadas por 6 pescadores.
  example: { data: '3, 4, 5, 6, 6, 7' },
  solve: solveDescriptive,
};
