/**
 * Distribución muestral de la media de una población finita pequeña, enumerando TODAS las muestras
 * posibles de tamaño n (Spiegel, teoría elemental del muestreo; Walpole, Myers, Myers y Ye,
 * sec. 8.4):
 *
 *   μ = Σx / N,   σ² = Σ(x − μ)² / N                     (parámetros de la población)
 *   con reemplazo (Nⁿ muestras ordenadas):     μ_X̄ = μ,   σ²_X̄ = σ²/n
 *   sin reemplazo (C(N, n) muestras):          μ_X̄ = μ,   σ²_X̄ = (σ²/n)(N − n)/(N − 1)
 *
 * Se calculan μ_X̄ y σ²_X̄ directamente con las medias de las muestras y se comparan con las
 * fórmulas, que es el objetivo del ejercicio clásico.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber, toLatexRational } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';

export const replacementTypes = ['con', 'sin'] as const;

const MAX_POPULATION = 20;
const MAX_SAMPLES = 20_000;
const MAX_LISTED = 200;

function sampleCount(size: number, n: number, withReplacement: boolean): number {
  if (withReplacement) return size ** n;
  let result = 1;
  for (let i = 1; i <= n; i++) result = (result * (size - n + i)) / i;
  return Math.round(result);
}

export const samplingInputSchema = z
  .object({
    population: z.string().superRefine((text, ctx) => {
      const { values, invalid } = parseDataList(text);
      if (invalid.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `No son números: ${invalid.slice(0, 3).join(', ')}.`,
        });
      } else if (values.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'La población necesita al menos 2 elementos.' });
      } else if (values.length > MAX_POPULATION) {
        ctx.addIssue({
          code: 'custom',
          message: `Para enumerar las muestras, la población puede tener hasta ${MAX_POPULATION} elementos.`,
        });
      }
    }),
    n: z
      .number({ error: 'Ingresa el tamaño de la muestra n.' })
      .int('n debe ser un número entero.')
      .min(1, 'n debe ser al menos 1.'),
    replacement: z.enum(replacementTypes, {
      error: 'Elige si el muestreo es con o sin reemplazo.',
    }),
  })
  .superRefine((v, ctx) => {
    const { values } = parseDataList(v.population);
    if (values.length < 2 || values.length > MAX_POPULATION) return;
    const withReplacement = v.replacement === 'con';
    if (!withReplacement && v.n > values.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['n'],
        message: `Sin reemplazo la muestra no puede ser mayor que la población (N = ${values.length}).`,
      });
    } else if (sampleCount(values.length, v.n, withReplacement) > MAX_SAMPLES) {
      ctx.addIssue({
        code: 'custom',
        path: ['n'],
        message: `Hay más de ${formatNumber(MAX_SAMPLES)} muestras posibles; usa una población o una muestra más pequeña.`,
      });
    }
  });

export type SamplingInput = z.infer<typeof samplingInputSchema>;

export interface SamplingValue {
  populationMean: number;
  populationVariance: number;
  samples: number;
  meanOfMeans: number;
  varianceOfMeans: number;
  standardError: number;
}

export type SamplingErrorCode = 'invalid-input';

const n = toLatexNumber;

/** Todas las muestras: ordenadas con reemplazo, combinaciones sin reemplazo (índices). */
function enumerate(size: number, n: number, withReplacement: boolean): number[][] {
  const result: number[][] = [];
  const current: number[] = [];
  const visit = (from: number) => {
    if (current.length === n) {
      result.push([...current]);
      return;
    }
    for (let i = withReplacement ? 0 : from; i < size; i++) {
      current.push(i);
      visit(i + 1);
      current.pop();
    }
  };
  visit(0);
  return result;
}

export function solveSampling(
  input: SamplingInput,
): CalculatorResult<SamplingValue, SamplingErrorCode> {
  const { values } = parseDataList(input.population);
  const size = values.length;
  const withReplacement = input.replacement === 'con';
  const k = input.n;
  if (
    size < 2 ||
    (!withReplacement && k > size) ||
    sampleCount(size, k, withReplacement) > MAX_SAMPLES
  ) {
    return {
      ok: false,
      error: { code: 'invalid-input', message: 'Revisa la población y el tamaño de la muestra.' },
      ...emptyTrace(),
    };
  }

  const mu = values.reduce((s, v) => s + v, 0) / size;
  const sigma2 = values.reduce((s, v) => s + (v - mu) ** 2, 0) / size;
  const samples = enumerate(size, k, withReplacement).map((indices) => {
    const items = indices.map((i) => values[i]!);
    return { items, mean: items.reduce((s, v) => s + v, 0) / k };
  });
  const count = samples.length;
  const meanOfMeans = samples.reduce((s, x) => s + x.mean, 0) / count;
  const varianceOfMeans = samples.reduce((s, x) => s + (x.mean - meanOfMeans) ** 2, 0) / count;
  const correction = withReplacement ? 1 : (size - k) / (size - 1);
  const theoretical = (sigma2 / k) * correction;

  const steps: Step[] = [
    {
      title: 'Parámetros de la población',
      explanation: `La población tiene N = ${size} elementos: ${values
        .slice(0, 12)
        .map((v) => formatNumber(v))
        .join(
          ', ',
        )}${size > 12 ? ', …' : ''}. Como es toda la población, la varianza se divide entre N (no entre N − 1).`,
      formula: '\\mu = \\frac{\\sum x}{N}, \\qquad \\sigma^2 = \\frac{\\sum (x - \\mu)^2}{N}',
      substitution: `\\mu = \\frac{${n(values.reduce((s, v) => s + v, 0))}}{${size}}, \\qquad \\sigma^2 = \\frac{${n(values.reduce((s, v) => s + (v - mu) ** 2, 0))}}{${size}}`,
      result: `\\mu = ${n(mu)}, \\qquad \\sigma^2 = ${n(sigma2)}, \\qquad \\sigma = ${n(Math.sqrt(sigma2))}`,
    },
    {
      title: 'Muestras posibles',
      explanation: withReplacement
        ? `Con reemplazo, cada una de las n = ${k} extracciones puede ser cualquiera de los N elementos (y el orden cuenta): Nⁿ muestras.`
        : `Sin reemplazo, se eligen n = ${k} elementos distintos sin importar el orden: C(N, n) muestras.`,
      formula: withReplacement ? 'N^n' : '\\binom{N}{n}',
      substitution: withReplacement ? `${size}^{${k}}` : `\\binom{${size}}{${k}}`,
      result: `${count}\\ \\text{muestras}`,
    },
    {
      title: 'Media de cada muestra',
      explanation: `Se calcula x̄ para cada muestra; la tabla las lista${count > MAX_LISTED ? ` (las primeras ${MAX_LISTED})` : ''} y la gráfica muestra su distribución.`,
      result:
        samples
          .slice(0, 4)
          .map((s) => `(${s.items.map((v) => n(v)).join(', ')}) \\to ${n(s.mean)}`)
          .join(',\\quad ') + (count > 4 ? ',\\ \\ldots' : ''),
    },
    {
      title: 'Media de la distribución muestral',
      explanation:
        'El promedio de todas las medias muestrales coincide con la media de la población.',
      formula: '\\mu_{\\bar{X}} = \\frac{\\sum \\bar{x}}{M} = \\mu',
      substitution: `\\mu_{\\bar{X}} = \\frac{${n(samples.reduce((s, x) => s + x.mean, 0))}}{${count}}`,
      result: `\\mu_{\\bar{X}} = ${n(meanOfMeans)}`,
    },
    {
      title: 'Varianza de la distribución muestral',
      explanation:
        'Se calcula con las medias de todas las muestras (divididas entre M, porque son todas).',
      formula: '\\sigma^2_{\\bar{X}} = \\frac{\\sum (\\bar{x} - \\mu_{\\bar{X}})^2}{M}',
      substitution: `\\sigma^2_{\\bar{X}} = \\frac{${n(varianceOfMeans * count)}}{${count}}`,
      result: `\\sigma^2_{\\bar{X}} = ${n(varianceOfMeans)}`,
    },
    {
      title: 'Comparar con la fórmula',
      explanation: withReplacement
        ? 'Con reemplazo las extracciones son independientes: la varianza de la media es σ²/n.'
        : 'Sin reemplazo se multiplica σ²/n por el factor de corrección para población finita (N − n)/(N − 1).',
      formula: withReplacement
        ? '\\sigma^2_{\\bar{X}} = \\frac{\\sigma^2}{n}'
        : '\\sigma^2_{\\bar{X}} = \\frac{\\sigma^2}{n} \\cdot \\frac{N - n}{N - 1}',
      substitution: withReplacement
        ? `\\sigma^2_{\\bar{X}} = \\frac{${n(sigma2)}}{${k}}`
        : `\\sigma^2_{\\bar{X}} = \\frac{${n(sigma2)}}{${k}} \\cdot \\frac{${size} - ${k}}{${size} - 1}`,
      result: `\\sigma^2_{\\bar{X}} = ${n(theoretical)}, \\qquad \\sigma_{\\bar{X}} = ${n(Math.sqrt(theoretical))}`,
    },
  ];

  // Distribución de x̄: valores distintos con su frecuencia.
  const key = (v: number) => Number(v.toPrecision(12));
  const distribution = new Map<number, number>();
  for (const s of samples) distribution.set(key(s.mean), (distribution.get(key(s.mean)) ?? 0) + 1);
  const rows = [...distribution.entries()].sort(([a], [b]) => a - b);

  return {
    ok: true,
    value: {
      populationMean: mu,
      populationVariance: sigma2,
      samples: count,
      meanOfMeans,
      varianceOfMeans,
      standardError: Math.sqrt(varianceOfMeans),
    },
    summary: [
      {
        label: 'Media de las medias',
        value: `\\mu_{\\bar{X}} = ${n(meanOfMeans, 6)}`,
        emphasis: true,
      },
      {
        label: 'Error estándar',
        value: `\\sigma_{\\bar{X}} = ${n(Math.sqrt(varianceOfMeans), 6)}`,
        emphasis: true,
      },
      {
        label: 'Población',
        value: `\\mu = ${n(mu, 6)}, \\quad \\sigma = ${n(Math.sqrt(sigma2), 6)}`,
      },
      { label: 'Muestras', value: `M = ${count}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'distribucion',
        title: 'Distribución muestral de la media',
        columns: [
          { key: 'mean', header: '\\bar{x}' },
          { key: 'frequency', header: 'f' },
          { key: 'probability', header: 'P(\\bar{X} = \\bar{x})', format: 'latex' },
        ],
        rows: rows.map(([mean, frequency]) => ({
          mean,
          frequency,
          probability: toLatexRational(frequency / count),
        })),
      },
      {
        id: 'muestras',
        title:
          count > MAX_LISTED ? `Primeras ${MAX_LISTED} muestras de ${count}` : 'Todas las muestras',
        columns: [
          { key: 'index', header: '\\#' },
          { key: 'sample', header: '\\text{Muestra}', format: 'latex' },
          { key: 'mean', header: '\\bar{x}' },
        ],
        rows: samples.slice(0, MAX_LISTED).map((s, i) => ({
          index: i + 1,
          sample: `(${s.items.map((v) => n(v)).join(',\\ ')})`,
          mean: s.mean,
        })),
      },
    ],
    series: [
      {
        id: 'distribucion',
        title: `Distribución de x̄ en las ${count} muestras`,
        xLabel: 'x̄',
        yLabel: 'Probabilidad',
        kind: 'bar',
        points: rows.map(([mean, frequency]) => ({ x: mean, y: frequency / count })),
      },
    ],
  };
}

export const samplingDistributions: Calculator<SamplingInput, SamplingValue, SamplingErrorCode> = {
  meta: {
    id: 'distribuciones-muestrales',
    title: 'Distribuciones muestrales',
    summary:
      'Enumera las muestras de una población pequeña y obtiene la media y el error estándar de x̄.',
    citations: [
      {
        sourceId: 'spiegel-1991',
        locator: 'Teoría del muestreo: problemas resueltos de la población 2, 3, 6, 8, 11',
      },
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 8.4, distribución muestral de medias (9.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
    ],
  },
  inputSchema: samplingInputSchema,
  // Spiegel: población 2, 3, 6, 8, 11; todas las muestras de tamaño 2 con reemplazo.
  example: { population: '2 3 6 8 11', n: 2, replacement: 'con' },
  solve: solveSampling,
};
