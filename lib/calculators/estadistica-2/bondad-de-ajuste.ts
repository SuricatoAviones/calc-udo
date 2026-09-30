/**
 * Prueba de bondad de ajuste ji-cuadrada (Walpole, Myers, Myers y Ye, sec. 10.14; Canavos, cap. 10):
 *
 *   χ² = Σ (oᵢ − eᵢ)² / eᵢ,   eᵢ = n pᵢ,   ν = k − 1 − (parámetros estimados con la muestra)
 *
 * Se rechaza H₀ ("los datos siguen la distribución") si χ² > χ²_α. Como en el libro, las celdas con
 * frecuencia esperada menor que 5 se combinan con las vecinas antes de calcular χ².
 *
 * Modelos: probabilidades dadas (o categorías equiprobables), Poisson, binomial y normal (datos
 * agrupados en clases; la primera y la última clase se extienden a −∞ y +∞).
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, parseFraction, toLatexNumber } from '@/lib/math/format';
import { standardNormalCdf } from '@/lib/math/normal';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type SummaryItem,
} from '../types';
import { alphaField, testDecision } from './hypothesis';
import { binomialPmf, poissonPmf } from './probability';

export const fitDistributions = ['probabilidades', 'poisson', 'binomial', 'normal'] as const;
export type FitDistribution = (typeof fitDistributions)[number];

const MAX_CELLS = 100;

function parseCounts(text: string | undefined): number[] | string {
  const { values, invalid } = parseDataList(text ?? '');
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  if (values.length < 2) return 'Escribe al menos 2 frecuencias observadas.';
  if (values.length > MAX_CELLS) return `El máximo es ${MAX_CELLS} categorías.`;
  if (values.some((v) => !Number.isInteger(v) || v < 0)) {
    return 'Las frecuencias observadas son conteos: enteros no negativos.';
  }
  if (values.reduce((s, v) => s + v, 0) === 0) return 'El total de observaciones no puede ser 0.';
  return values;
}

function parseList(text: string | undefined): number[] | string {
  const { values, invalid } = parseDataList(text ?? '');
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  return values;
}

/** Probabilidades como texto ("1/6 1/6 …" o "0.2 0.3 …"); `[]` si está vacío (equiprobables). */
function parseProbabilities(text: string | undefined): number[] | string {
  const tokens = (text ?? '').split(/[\s;]+/).filter(Boolean);
  const values = tokens.map(parseFraction);
  const bad = tokens.filter((_, i) => !(values[i]! >= 0 && values[i]! <= 1));
  if (bad.length > 0) return `No son probabilidades válidas: ${bad.slice(0, 3).join(', ')}.`;
  return values;
}

export const goodnessOfFitInputSchema = z
  .object({
    distribution: z.enum(fitDistributions, { error: 'Elige la distribución.' }),
    observed: z.string(),
    probabilities: z.string().optional(),
    values: z.string().optional(),
    trials: z
      .number({ error: 'Ingresa el número de ensayos.' })
      .int('El número de ensayos debe ser entero.')
      .min(1, 'Debe haber al menos 1 ensayo.')
      .max(1000, 'El máximo es 1000 ensayos.')
      .optional(),
    boundaries: z.string().optional(),
    parameter1: z.number().refine(Number.isFinite, 'Debe ser un número finito.').optional(),
    parameter2: z
      .number()
      .refine((v) => Number.isFinite(v) && v > 0, 'σ debe ser mayor que 0.')
      .optional(),
    estimated: z.enum(['si', 'no'], {
      error: 'Indica si los parámetros se estimaron con la muestra.',
    }),
    merge: z.enum(['si', 'no'], { error: 'Indica si se combinan las celdas pequeñas.' }),
    alpha: alphaField,
  })
  .superRefine((v, ctx) => {
    const observed = parseCounts(v.observed);
    if (typeof observed === 'string') {
      ctx.addIssue({ code: 'custom', path: ['observed'], message: observed });
      return;
    }
    const k = observed.length;
    if (v.distribution === 'probabilidades') {
      const probs = parseProbabilities(v.probabilities);
      if (typeof probs === 'string') {
        ctx.addIssue({ code: 'custom', path: ['probabilities'], message: probs });
      } else if (probs.length > 0) {
        if (probs.length !== k) {
          ctx.addIssue({
            code: 'custom',
            path: ['probabilities'],
            message: `Hay ${k} frecuencias y ${probs.length} probabilidades: deben coincidir.`,
          });
        } else if (Math.abs(probs.reduce((s, p) => s + p, 0) - 1) > 1e-6) {
          ctx.addIssue({
            code: 'custom',
            path: ['probabilities'],
            message: 'Las probabilidades deben sumar 1.',
          });
        }
      }
    } else if (v.distribution === 'normal') {
      const bounds = parseList(v.boundaries);
      if (typeof bounds === 'string') {
        ctx.addIssue({ code: 'custom', path: ['boundaries'], message: bounds });
      } else if (bounds.length !== k + 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['boundaries'],
          message: `Con ${k} clases hacen falta ${k + 1} límites (el inicio de cada clase y el final de la última).`,
        });
      } else if (bounds.some((b, i) => i > 0 && !(b > bounds[i - 1]!))) {
        ctx.addIssue({
          code: 'custom',
          path: ['boundaries'],
          message: 'Los límites deben ir en orden creciente.',
        });
      }
    } else {
      const values = parseList(v.values);
      if (typeof values === 'string') {
        ctx.addIssue({ code: 'custom', path: ['values'], message: values });
      } else if (values.length !== k) {
        ctx.addIssue({
          code: 'custom',
          path: ['values'],
          message: `Hay ${k} frecuencias y ${values.length} valores de x: deben coincidir.`,
        });
      } else if (
        values.some((x, i) => !Number.isInteger(x) || x < 0 || (i > 0 && !(x > values[i - 1]!)))
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['values'],
          message: 'Los valores de x deben ser enteros no negativos en orden creciente.',
        });
      }
      if (v.distribution === 'binomial') {
        if (v.trials === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['trials'],
            message: 'Ingresa el número de ensayos n.',
          });
        } else if (typeof values !== 'string' && values.some((x) => x > v.trials!)) {
          ctx.addIssue({
            code: 'custom',
            path: ['values'],
            message: 'Ningún x puede ser mayor que el número de ensayos.',
          });
        }
        if (v.parameter1 !== undefined && !(v.parameter1 > 0 && v.parameter1 < 1)) {
          ctx.addIssue({
            code: 'custom',
            path: ['parameter1'],
            message: 'p debe estar entre 0 y 1.',
          });
        }
      }
      if (v.distribution === 'poisson' && v.parameter1 !== undefined && !(v.parameter1 > 0)) {
        ctx.addIssue({ code: 'custom', path: ['parameter1'], message: 'λ debe ser mayor que 0.' });
      }
    }
  });

export type GoodnessOfFitInput = z.infer<typeof goodnessOfFitInputSchema>;

export interface GoodnessOfFitValue {
  statistic: number;
  df: number;
  pValue: number;
  reject: boolean;
  critical: number;
  /** Frecuencias esperadas antes de combinar celdas. */
  expected: number[];
  /** Celdas después de combinar: observadas y esperadas. */
  cells: { label: string; observed: number; expected: number }[];
}

export type GoodnessOfFitErrorCode = 'no-degrees-of-freedom';

const n = (v: number) => toLatexNumber(v, 6);

interface Cell {
  /** Etiquetas de las celdas originales que forman esta (más de una si se combinaron). */
  labels: string[];
  observed: number;
  p: number;
}

function cellLabel(cell: Cell): string {
  return cell.labels.length === 1 ? cell.labels[0]! : `${cell.labels[0]} a ${cell.labels.at(-1)}`;
}

function join(a: Cell, b: Cell): Cell {
  return { labels: [...a.labels, ...b.labels], observed: a.observed + b.observed, p: a.p + b.p };
}

/** Combina celdas vecinas hasta que todas tengan frecuencia esperada ≥ 5. */
export function mergeCells(cells: Cell[], total: number): Cell[] {
  const merged: Cell[] = [];
  let current: Cell | null = null;
  for (const cell of cells) {
    current = current ? join(current, cell) : cell;
    if (current.p * total >= 5) {
      merged.push(current);
      current = null;
    }
  }
  if (current) {
    const last = merged.pop();
    merged.push(last ? join(last, current) : current);
  }
  return merged;
}

export function solveGoodnessOfFit(
  input: GoodnessOfFitInput,
): CalculatorResult<GoodnessOfFitValue, GoodnessOfFitErrorCode> {
  const observed = parseCounts(input.observed) as number[];
  const total = observed.reduce((s, v) => s + v, 0);
  const k = observed.length;
  const steps: Step[] = [];
  let cells: Cell[];
  let estimatedParams = 0;
  let hypothesis: string;

  if (input.distribution === 'probabilidades') {
    const given = parseProbabilities(input.probabilities) as number[];
    const probs = given.length === 0 ? observed.map(() => 1 / k) : given;
    hypothesis =
      given.length === 0
        ? `las ${k} categorías son igualmente probables (pᵢ = 1/${k})`
        : 'las categorías tienen las probabilidades dadas';
    cells = observed.map((o, i) => ({ labels: [`${i + 1}`], observed: o, p: probs[i]! }));
  } else if (input.distribution === 'normal') {
    const bounds = parseList(input.boundaries) as number[];
    const marks = observed.map((_, i) => (bounds[i]! + bounds[i + 1]!) / 2);
    let mu = input.parameter1;
    let sigma = input.parameter2;
    if (mu === undefined || sigma === undefined) {
      const m = marks.reduce((s, x, i) => s + x * observed[i]!, 0) / total;
      const s = Math.sqrt(
        marks.reduce((acc, x, i) => acc + observed[i]! * (x - m) ** 2, 0) / (total - 1),
      );
      mu ??= m;
      sigma ??= s;
      steps.push({
        title: 'Parámetros estimados con los datos agrupados',
        explanation:
          'Se usan las marcas de clase (puntos medios) como representantes de cada clase.',
        formula:
          '\\bar{x} = \\frac{\\sum f_i m_i}{n}, \\qquad s = \\sqrt{\\frac{\\sum f_i (m_i - \\bar{x})^2}{n - 1}}',
        result: `\\hat{\\mu} = ${n(mu)}, \\quad \\hat{\\sigma} = ${n(sigma)}`,
      });
    }
    if (
      input.estimated === 'si' ||
      input.parameter1 === undefined ||
      input.parameter2 === undefined
    ) {
      estimatedParams = 2;
    }
    hypothesis = `los datos provienen de una normal con μ = ${formatNumber(mu, 6)} y σ = ${formatNumber(sigma, 6)}`;
    const cdf = (x: number) => standardNormalCdf((x - mu!) / sigma!);
    cells = observed.map((o, i) => {
      const from = i === 0 ? -Infinity : bounds[i]!;
      const to = i === k - 1 ? Infinity : bounds[i + 1]!;
      return {
        labels: [`${formatNumber(bounds[i]!)}–${formatNumber(bounds[i + 1]!)}`],
        observed: o,
        p: (to === Infinity ? 1 : cdf(to)) - (from === -Infinity ? 0 : cdf(from)),
      };
    });
    steps.push({
      title: 'Probabilidad de cada clase',
      explanation:
        'Se estandarizan los límites con z = (x − μ)/σ. La primera clase se extiende hasta −∞ y la última hasta +∞ para que las probabilidades sumen 1.',
      formula:
        'p_i = \\Phi\\!\\left(\\frac{b_i - \\mu}{\\sigma}\\right) - \\Phi\\!\\left(\\frac{b_{i-1} - \\mu}{\\sigma}\\right)',
      result: cells.map((c, i) => `p_{${i + 1}} = ${n(c.p)}`).join(',\\ '),
    });
  } else {
    const values = parseList(input.values) as number[];
    const poisson = input.distribution === 'poisson';
    const trials = input.trials ?? 0;
    let param = input.parameter1;
    if (param === undefined) {
      const meanX = values.reduce((s, x, i) => s + x * observed[i]!, 0) / total;
      param = poisson ? meanX : meanX / trials;
      steps.push({
        title: `Parámetro estimado con la muestra`,
        formula: poisson
          ? '\\hat{\\lambda} = \\bar{x} = \\frac{\\sum x_i f_i}{n}'
          : '\\hat{p} = \\frac{\\bar{x}}{n_{\\text{ensayos}}} = \\frac{\\sum x_i f_i}{n \\cdot n_{\\text{ensayos}}}',
        result: poisson ? `\\hat{\\lambda} = ${n(param)}` : `\\hat{p} = ${n(param)}`,
      });
    }
    if (input.estimated === 'si' || input.parameter1 === undefined) estimatedParams = 1;
    const pmf = (x: number) => (poisson ? poissonPmf(x, param!) : binomialPmf(x, trials, param!));
    hypothesis = poisson
      ? `los datos siguen una Poisson con λ = ${formatNumber(param, 6)}`
      : `los datos siguen una binomial con n = ${trials} y p = ${formatNumber(param, 6)}`;
    cells = values.map((x, i) => {
      let p: number;
      if (i === k - 1) {
        // Última celda: x o más (la cola completa).
        let below = 0;
        for (let j = 0; j < x; j++) below += pmf(j);
        p = Math.max(0, 1 - below);
      } else if (i === 0) {
        p = 0;
        for (let j = 0; j <= x; j++) p += pmf(j);
      } else {
        p = pmf(x);
      }
      const label = i === k - 1 ? `≥ ${x}` : i === 0 && x > 0 ? `≤ ${x}` : `${x}`;
      return { labels: [label], observed: observed[i]!, p };
    });
    steps.push({
      title: 'Probabilidad de cada valor',
      explanation:
        'La última celda incluye todos los valores mayores, para que las probabilidades sumen 1.',
      formula: poisson
        ? 'p(x) = \\frac{e^{-\\lambda}\\lambda^x}{x!}'
        : 'p(x) = \\binom{n}{x} p^x (1 - p)^{n - x}',
      result: values
        .map((x, i) => {
          const relation = i === k - 1 ? '\\ge' : i === 0 && x > 0 ? '\\le' : '=';
          return `P(X ${relation} ${x}) = ${n(cells[i]!.p)}`;
        })
        .join(',\\ '),
    });
  }

  steps.unshift({
    title: 'Hipótesis',
    explanation: `H₀: ${hypothesis}. H₁: no la siguen.`,
    result: `n = ${total} \\text{ observaciones en } ${k} \\text{ celdas}`,
  });

  const expected = cells.map((c) => c.p * total);
  steps.push({
    title: 'Frecuencias esperadas',
    formula: 'e_i = n\\,p_i',
    result: expected.map((e, i) => `e_{${i + 1}} = ${n(e)}`).join(',\\ '),
  });

  let used = cells;
  if (input.merge === 'si' && expected.some((e) => e < 5)) {
    used = mergeCells(cells, total);
    steps.push({
      title: 'Combinar celdas con frecuencia esperada menor que 5',
      explanation: `Con frecuencias esperadas pequeñas la aproximación ji-cuadrada no es confiable, así que se suman celdas vecinas hasta que todas tengan eᵢ ≥ 5. Quedan ${used.length} celdas.`,
      result: used
        .map((c, j) => `\\text{celda ${j + 1}}: o = ${c.observed},\\ e = ${n(c.p * total)}`)
        .join(';\\ '),
    });
  }

  const statistic = used.reduce((s, c) => s + (c.observed - c.p * total) ** 2 / (c.p * total), 0);
  const df = used.length - 1 - estimatedParams;
  steps.push({
    title: 'Estadístico ji-cuadrada',
    formula: '\\chi^2 = \\sum_i \\frac{(o_i - e_i)^2}{e_i}',
    substitution: `\\chi^2 = ${used
      .slice(0, 8)
      .map((c) => `\\frac{(${c.observed} - ${n(c.p * total)})^2}{${n(c.p * total)}}`)
      .join(' + ')}${used.length > 8 ? ' + \\cdots' : ''}`,
    result: `\\chi^2 = ${n(statistic)}`,
  });
  steps.push({
    title: 'Grados de libertad',
    explanation:
      estimatedParams > 0
        ? `Se resta 1 por la restricción Σeᵢ = n y ${estimatedParams} por cada parámetro estimado con la muestra.`
        : 'Se resta 1 por la restricción Σeᵢ = n (no se estimaron parámetros con la muestra).',
    formula: `\\nu = k - 1${estimatedParams > 0 ? ` - ${estimatedParams}` : ''}`,
    substitution: `\\nu = ${used.length} - 1${estimatedParams > 0 ? ` - ${estimatedParams}` : ''}`,
    result: `\\nu = ${df}`,
  });

  const table = {
    id: 'frecuencias',
    title: 'Frecuencias observadas y esperadas',
    columns: [
      { key: 'label', header: '\\text{Celda}', format: 'text' as const },
      { key: 'o', header: 'o_i' },
      { key: 'p', header: 'p_i' },
      { key: 'e', header: 'e_i' },
      { key: 'term', header: '(o_i - e_i)^2/e_i' },
    ],
    rows: used.map((c) => ({
      label: cellLabel(c),
      o: c.observed,
      p: c.p,
      e: c.p * total,
      term: (c.observed - c.p * total) ** 2 / (c.p * total),
    })),
  };

  if (df < 1) {
    return {
      ok: false,
      error: {
        code: 'no-degrees-of-freedom',
        message: `Quedan ${used.length} celdas y ν = ${df}: no hay grados de libertad para la prueba. Hacen falta más categorías (o menos combinadas).`,
      },
      ...emptyTrace(),
      steps,
      tables: [table],
    };
  }

  const outcome = testDecision({
    statistic: { kind: 'chi2', df },
    value: statistic,
    alternative: 'mayor',
    alpha: input.alpha,
  });
  steps.push(...outcome.steps);
  const summary: SummaryItem[] = [
    {
      label: 'Estadístico',
      value: `\\chi^2 = ${n(statistic)} \\quad (\\nu = ${df})`,
      emphasis: true,
    },
    ...outcome.summary,
  ];
  return {
    ok: true,
    value: {
      statistic,
      df,
      pValue: outcome.pValue,
      reject: outcome.reject,
      critical: outcome.critical[0]!,
      expected,
      cells: used.map((c) => ({
        label: cellLabel(c),
        observed: c.observed,
        expected: c.p * total,
      })),
    },
    summary,
    ...emptyTrace(),
    steps,
    tables: [table],
    series: [outcome.series],
  };
}

export const goodnessOfFit: Calculator<
  GoodnessOfFitInput,
  GoodnessOfFitValue,
  GoodnessOfFitErrorCode
> = {
  meta: {
    id: 'bondad-de-ajuste',
    title: 'Prueba de bondad de ajuste',
    summary:
      'Contrasta con ji-cuadrada si los datos siguen probabilidades dadas o una distribución de Poisson, binomial o normal.',
    citations: [
      { sourceId: 'canavos-1995', locator: 'Cap. 10, prueba de bondad de ajuste ji-cuadrada' },
      {
        sourceId: 'walpole-1999',
        locator:
          'Sec. 10.14 (el dado lanzado 120 veces y la duración de 40 baterías ajustada a una normal), 9.ª ed.',
      },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: goodnessOfFitInputSchema,
  example: {
    distribution: 'probabilidades',
    observed: '20 22 17 18 19 24',
    probabilities: '',
    values: '',
    boundaries: '',
    estimated: 'no',
    merge: 'si',
    alpha: 0.05,
  },
  solve: solveGoodnessOfFit,
};
