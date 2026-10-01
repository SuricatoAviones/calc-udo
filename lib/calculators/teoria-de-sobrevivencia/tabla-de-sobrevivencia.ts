/**
 * Tabla de sobrevivencia y fallas (tabla de vida o método actuarial; Lee, Statistical Methods for
 * Survival Data Analysis, cap. 4; el programa la presenta en la Unidad IV). Los tiempos se agrupan
 * en intervalos [t_i, t_{i+1}) de amplitud h_i; en cada uno hay d_i fallas y w_i retiros
 * (censurados). Si n_i unidades entran al intervalo:
 *
 *   n′_i = n_i − w_i/2   (criterio de Elisa Lee: los retirados están, en promedio, medio intervalo)
 *   n′_i = n_i           (criterio de Kaplan-Meier: los retirados sobreviven todo el intervalo)
 *
 *   q_i = d_i / n′_i,   p_i = 1 − q_i,   S_1 = 1,   S_{i+1} = S_i p_i,   F_i = 1 − S_i
 *   f_i = S_i q_i / h_i          (densidad de fallas en el punto medio)
 *   λ_i = d_i / (h_i (n′_i − d_i/2)) = 2q_i / (h_i (1 + p_i))   (riesgo o tasa de fallas)
 *   EE(S_i) = S_i √(Σ_{j<i} q_j / (n′_j p_j))   (Greenwood)
 *
 * n_1 es el total de unidades (todas fallan o se retiran en algún intervalo) y n_{i+1} = n_i − d_i −
 * w_i. El último intervalo es abierto: no tiene densidad ni riesgo.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Series,
  type Step,
} from '../types';

export const censoringCriteria = ['actuarial', 'kaplan-meier'] as const;

const count = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .int(`${label} debe ser un número entero.`)
    .min(0, `${label} no puede ser negativo.`);

export const lifeTableInputSchema = z
  .object({
    intervals: z
      .array(
        z.object({
          start: z
            .number({ error: 'Ingresa el inicio del intervalo.' })
            .refine((v) => Number.isFinite(v) && v >= 0, 'El inicio no puede ser negativo.'),
          deaths: count('el número de fallas'),
          withdrawals: count('el número de retiros'),
        }),
      )
      .min(2, 'Agrega al menos dos intervalos.')
      .max(60, 'El máximo es 60 intervalos.'),
    criterion: z.enum(censoringCriteria, { error: 'Elige el criterio de censura.' }),
  })
  .superRefine((v, ctx) => {
    v.intervals.forEach((row, i) => {
      if (i > 0 && row.start <= v.intervals[i - 1]!.start) {
        ctx.addIssue({
          code: 'custom',
          path: ['intervals', i, 'start'],
          message: 'Los inicios de los intervalos deben ir en orden creciente.',
        });
      }
    });
    if (v.intervals.every((r) => r.deaths === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['intervals'],
        message: 'Hace falta al menos una falla.',
      });
    }
  });

export type LifeTableInput = z.infer<typeof lifeTableInputSchema>;

export interface LifeTableRow {
  start: number;
  end: number | null;
  entering: number;
  deaths: number;
  withdrawals: number;
  effective: number;
  q: number;
  p: number;
  survival: number;
  failure: number;
  standardError: number;
  density: number | null;
  hazard: number | null;
}

export interface LifeTableValue {
  rows: LifeTableRow[];
  /** Mediana interpolada linealmente dentro del intervalo donde S cruza 0.5. */
  median: number | null;
  total: number;
}

export type LifeTableErrorCode = never;

type Result = CalculatorResult<LifeTableValue, LifeTableErrorCode>;

const n = toLatexNumber;

export function solveLifeTable({ intervals, criterion }: LifeTableInput): Result {
  const total = intervals.reduce((acc, r) => acc + r.deaths + r.withdrawals, 0);
  const actuarial = criterion === 'actuarial';
  let entering = total;
  let survival = 1;
  let greenwood = 0;
  const rows: LifeTableRow[] = intervals.map((row, i) => {
    const end = intervals[i + 1]?.start ?? null;
    const effective = actuarial ? entering - row.withdrawals / 2 : entering;
    const q = effective > 0 ? row.deaths / effective : 0;
    const p = 1 - q;
    const width = end === null ? null : end - row.start;
    const result: LifeTableRow = {
      start: row.start,
      end,
      entering,
      deaths: row.deaths,
      withdrawals: row.withdrawals,
      effective,
      q,
      p,
      survival,
      failure: 1 - survival,
      standardError: survival * Math.sqrt(greenwood),
      density: width === null ? null : (survival * q) / width,
      hazard:
        width === null || effective - row.deaths / 2 <= 0
          ? null
          : row.deaths / (width * (effective - row.deaths / 2)),
    };
    if (effective > 0 && p > 0) greenwood += q / (effective * p);
    survival *= p;
    entering -= row.deaths + row.withdrawals;
    return result;
  });

  let median: number | null = null;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    if (a.survival > 0.5 && b.survival <= 0.5) {
      median = a.start + ((a.end! - a.start) * (a.survival - 0.5)) / (a.survival - b.survival);
      break;
    }
  }

  const first = rows[0]!;
  const second = rows[1]!;
  const steps: Step[] = [
    {
      title: 'Unidades que entran a cada intervalo',
      explanation: `Al primer intervalo entran todas las unidades (${formatNumber(total)} = suma de fallas y retiros). A cada intervalo siguiente entran las que no fallaron ni se retiraron.`,
      formula: 'n_{i+1} = n_i - d_i - w_i',
      substitution: `n_2 = ${n(first.entering)} - ${first.deaths} - ${first.withdrawals}`,
      result: `n_2 = ${n(second.entering)}`,
    },
    {
      title: 'Número efectivo en riesgo',
      explanation: actuarial
        ? 'Criterio de Elisa Lee (actuarial): un retiro está expuesto, en promedio, la mitad del intervalo.'
        : 'Criterio de Kaplan-Meier: los retiros se cuentan como expuestos durante todo el intervalo (salen al final).',
      formula: actuarial ? "n'_i = n_i - \\frac{w_i}{2}" : "n'_i = n_i",
      substitution: actuarial
        ? `n'_2 = ${n(second.entering)} - \\frac{${second.withdrawals}}{2}`
        : `n'_2 = ${n(second.entering)}`,
      result: `n'_2 = ${n(second.effective)}`,
    },
    {
      title: 'Probabilidad condicional de falla y sobrevivencia',
      formula: "q_i = \\frac{d_i}{n'_i}, \\qquad p_i = 1 - q_i, \\qquad S_{i+1} = S_i\\,p_i",
      substitution: `q_1 = \\frac{${first.deaths}}{${n(first.effective)}} = ${n(first.q, 6)}, \\qquad S_2 = 1 \\cdot ${n(first.p, 6)}`,
      result: `S_2 = ${n(second.survival, 6)}`,
    },
    {
      title: 'Densidad de fallas y función de riesgo',
      explanation:
        'Se estiman en el punto medio de cada intervalo; el riesgo es la tasa de fallas entre las unidades que siguen funcionando.',
      formula:
        "f_i = \\frac{S_i\\,q_i}{h_i}, \\qquad \\lambda_i = \\frac{d_i}{h_i\\left(n'_i - d_i/2\\right)}",
      substitution: `f_1 = \\frac{1 \\cdot ${n(first.q, 6)}}{${n(first.end! - first.start)}}, \\qquad \\lambda_1 = \\frac{${first.deaths}}{${n(first.end! - first.start)}(${n(first.effective)} - ${first.deaths}/2)}`,
      result: `f_1 = ${n(first.density!, 6)}, \\qquad \\lambda_1 = ${n(first.hazard!, 6)}`,
    },
    {
      title: 'Error estándar de la sobrevivencia (Greenwood)',
      formula: "\\operatorname{EE}(S_i) = S_i\\sqrt{\\sum_{j<i} \\frac{q_j}{n'_j\\,p_j}}",
      result: `\\operatorname{EE}(S_2) = ${n(second.standardError, 4)}`,
    },
    {
      title: 'Mediana',
      explanation:
        median === null
          ? 'La sobrevivencia no baja de 0.5 en la tabla.'
          : 'Se interpola linealmente en el intervalo donde la sobrevivencia cruza 0.5.',
      formula: 't_{0.5} = t_i + h_i\\,\\frac{S_i - 0.5}{S_i - S_{i+1}}',
      result: median === null ? '\\text{no estimable}' : `t_{0.5} = ${n(median, 6)}`,
    },
  ];

  const tableRows = rows.map((r): Record<string, CellValue> => ({
    interval:
      r.end === null
        ? `[${formatNumber(r.start)}, ∞)`
        : `[${formatNumber(r.start)}, ${formatNumber(r.end)})`,
    entering: r.entering,
    deaths: r.deaths,
    withdrawals: r.withdrawals,
    effective: r.effective,
    q: r.q,
    survival: r.survival,
    failure: r.failure,
    standardError: r.standardError,
    density: r.density,
    hazard: r.hazard,
  }));

  const series: Series[] = [
    {
      id: 'sobrevivencia',
      title: 'Funciones de sobrevivencia y falla',
      xLabel: 'Inicio del intervalo',
      yLabel: 'Probabilidad',
      label: 'Sobrevivencia S',
      points: rows.map((r) => ({ x: r.start, y: r.survival })),
      others: [
        { label: 'Falla F = 1 − S', points: rows.map((r) => ({ x: r.start, y: r.failure })) },
      ],
    },
    {
      id: 'riesgo',
      title: 'Función de riesgo (tasa de fallas)',
      xLabel: 'Punto medio del intervalo',
      yLabel: 'λ',
      points: rows
        .filter((r) => r.hazard !== null)
        .map((r) => ({ x: (r.start + r.end!) / 2, y: r.hazard! })),
    },
  ];

  return {
    ok: true,
    value: { rows, median, total },
    summary: [
      {
        label: 'Mediana de sobrevivencia',
        value: median === null ? '\\text{no estimable}' : `t_{0.5} = ${n(median, 6)}`,
        emphasis: true,
      },
      { label: 'Unidades', value: `${total}` },
      {
        label: 'Sobrevivencia al inicio del último intervalo',
        value: `S = ${n(rows.at(-1)!.survival, 6)}`,
      },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'tabla-de-vida',
        title: 'Tabla de sobrevivencia y fallas',
        columns: [
          { key: 'interval', header: '\\text{Intervalo}', format: 'text' },
          { key: 'entering', header: 'n_i' },
          { key: 'deaths', header: 'd_i' },
          { key: 'withdrawals', header: 'w_i' },
          { key: 'effective', header: "n'_i" },
          { key: 'q', header: 'q_i' },
          { key: 'survival', header: 'S_i' },
          { key: 'failure', header: 'F_i' },
          { key: 'standardError', header: '\\operatorname{EE}(S_i)' },
          { key: 'density', header: 'f_i' },
          { key: 'hazard', header: '\\lambda_i' },
        ],
        rows: tableRows,
      },
    ],
    series,
    notices: [
      {
        level: 'info',
        message:
          'El programa menciona también el criterio de censura de Ezio Bórean; no está disponible porque su descripción no está publicada en las fuentes consultadas.',
      },
    ],
  };
}

export const lifeTable: Calculator<LifeTableInput, LifeTableValue, LifeTableErrorCode> = {
  meta: {
    id: 'tabla-de-sobrevivencia',
    title: 'Tabla de sobrevivencia y fallas',
    summary:
      'Funciones de sobrevivencia, falla, densidad y riesgo por intervalo con datos censurados.',
    citations: [
      {
        sourceId: 'borean-ganuza-2001',
        locator: 'Tablas de vida con datos censurados',
      },
      { sourceId: 'borean-1995' },
    ],
  },
  inputSchema: lifeTableInputSchema,
  // Lee (1992), 2418 hombres con angina de pecho: fallas y retiros por año desde el diagnóstico.
  example: {
    criterion: 'actuarial',
    intervals: [
      [456, 0],
      [226, 39],
      [152, 22],
      [171, 23],
      [135, 24],
      [125, 107],
      [83, 133],
      [74, 102],
      [51, 68],
      [42, 64],
      [43, 45],
      [34, 53],
      [18, 33],
      [9, 27],
      [6, 23],
      [0, 30],
    ].map(([deaths, withdrawals], start) => ({
      start,
      deaths: deaths!,
      withdrawals: withdrawals!,
    })),
  },
  solve: solveLifeTable,
};
