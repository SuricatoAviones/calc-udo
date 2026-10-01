/**
 * Estimador producto límite de Kaplan-Meier para datos censurados (Kaplan y Meier, 1958; el
 * programa lo presenta en la Unidad III). Con los tiempos de falla distintos t₁ < t₂ < …, n_j las
 * unidades en riesgo justo antes de t_j (las que no han fallado ni salido) y d_j las fallas en t_j:
 *
 *   Ŝ(t) = Π_{t_j ≤ t} (1 − d_j / n_j),     F̂(t) = 1 − Ŝ(t)
 *   Var[Ŝ(t)] ≈ Ŝ(t)² Σ_{t_j ≤ t} d_j / (n_j (n_j − d_j))   (fórmula de Greenwood)
 *
 * Una observación censurada (marcada con +) cuenta en riesgo hasta su tiempo y después sale sin
 * fallar; si coincide con una falla, se considera en riesgo en ese instante. Ŝ es escalonada y solo
 * cambia en los tiempos de falla. La mediana es el menor tiempo con Ŝ(t) ≤ 0.5.
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

const MAX_OBSERVATIONS = 2000;

interface Observation {
  time: number;
  censored: boolean;
}

/** «6, 6, 6+, 7» → observaciones (el + marca censura). */
export function parseSurvivalTimes(text: string): Observation[] | string {
  const tokens = text
    .split(/[\s;]+|,(?=\s)/)
    .map((t) => t.trim())
    .filter((t) => t !== '' && t !== ',');
  if (tokens.length === 0) return 'Escribe los tiempos observados.';
  if (tokens.length > MAX_OBSERVATIONS) return `El máximo es ${MAX_OBSERVATIONS} observaciones.`;
  const observations: Observation[] = [];
  for (const token of tokens) {
    const censored = token.endsWith('+') || token.endsWith('*');
    const number = Number(token.replace(/[+*]$/, '').replace(',', '.'));
    if (!Number.isFinite(number) || number < 0) return `«${token}» no es un tiempo válido.`;
    observations.push({ time: number, censored });
  }
  if (observations.every((o) => o.censored))
    return 'Hace falta al menos una falla (un tiempo sin +).';
  return observations;
}

export const kaplanMeierInputSchema = z.object({
  times: z.string().superRefine((text, ctx) => {
    const parsed = parseSurvivalTimes(text);
    if (typeof parsed === 'string') ctx.addIssue({ code: 'custom', message: parsed });
  }),
});

export type KaplanMeierInput = z.infer<typeof kaplanMeierInputSchema>;

export interface KaplanMeierRow {
  time: number;
  atRisk: number;
  failures: number;
  /** Censurados después de esta falla y antes de la siguiente. */
  censored: number;
  conditional: number;
  survival: number;
  failure: number;
  standardError: number;
}

export interface KaplanMeierValue {
  rows: KaplanMeierRow[];
  median: number | null;
  observations: number;
  censoredTotal: number;
}

export type KaplanMeierErrorCode = 'invalid-data';

type Result = CalculatorResult<KaplanMeierValue, KaplanMeierErrorCode>;

const n = toLatexNumber;

export function solveKaplanMeier({ times }: KaplanMeierInput): Result {
  const parsed = parseSurvivalTimes(times);
  if (typeof parsed === 'string') {
    return { ok: false, error: { code: 'invalid-data', message: parsed }, ...emptyTrace() };
  }
  const data = [...parsed].sort(
    (a, b) => a.time - b.time || Number(a.censored) - Number(b.censored),
  );
  const total = data.length;
  const failureTimes = [...new Set(data.filter((o) => !o.censored).map((o) => o.time))].sort(
    (a, b) => a - b,
  );

  let survival = 1;
  let greenwood = 0;
  const rows: KaplanMeierRow[] = failureTimes.map((t, j) => {
    const atRisk = data.filter((o) => o.time >= t).length;
    const failures = data.filter((o) => !o.censored && o.time === t).length;
    const next = failureTimes[j + 1] ?? Infinity;
    const censored = data.filter((o) => o.censored && o.time >= t && o.time < next).length;
    const conditional = 1 - failures / atRisk;
    survival *= conditional;
    if (atRisk > failures) greenwood += failures / (atRisk * (atRisk - failures));
    return {
      time: t,
      atRisk,
      failures,
      censored,
      conditional,
      survival,
      failure: 1 - survival,
      standardError: survival * Math.sqrt(greenwood),
    };
  });
  const censoredBefore = data.filter(
    (o) => o.censored && o.time < (failureTimes[0] ?? Infinity),
  ).length;
  const median = rows.find((r) => r.survival <= 0.5 + 1e-12)?.time ?? null;

  const steps: Step[] = [
    {
      title: 'Ordenar las observaciones',
      explanation: `${total} observaciones, ${data.filter((o) => o.censored).length} censuradas (marcadas con +). Solo los tiempos de falla cambian la estimación; los censurados reducen el número en riesgo.`,
      result: data
        .slice(0, 30)
        .map((o) => `${n(o.time)}${o.censored ? '^{+}' : ''}`)
        .join(',\\ ')
        .concat(total > 30 ? ',\\ \\ldots' : ''),
    },
    {
      title: 'Producto límite',
      explanation:
        'En cada tiempo de falla se multiplica la supervivencia anterior por la proporción de las unidades en riesgo que no fallan.',
      formula: '\\hat S(t_j) = \\hat S(t_{j-1})\\left(1 - \\frac{d_j}{n_j}\\right)',
      substitution: rows
        .slice(0, 12)
        .map(
          (r, j) =>
            `\\hat S(${n(r.time)}) = ${j === 0 ? '1' : n(rows[j - 1]!.survival, 6)}\\left(1 - \\frac{${r.failures}}{${r.atRisk}}\\right) = ${n(r.survival, 6)}`,
        )
        .join(' \\\\ '),
    },
    {
      title: 'Error estándar (Greenwood)',
      formula:
        '\\operatorname{EE}[\\hat S(t)] = \\hat S(t)\\sqrt{\\sum_{t_j \\le t} \\frac{d_j}{n_j(n_j - d_j)}}',
      result: rows
        .slice(0, 8)
        .map((r) => `\\operatorname{EE}(${n(r.time)}) = ${n(r.standardError, 4)}`)
        .join(',\\ '),
    },
    {
      title: 'Mediana de supervivencia',
      explanation:
        median === null
          ? 'Ŝ(t) no baja de 0.5 en el periodo observado: la mediana no se puede estimar.'
          : 'Es el menor tiempo en que la supervivencia estimada llega a 0.5 o menos.',
      result: median === null ? '\\text{no estimable}' : `t_{0.5} = ${n(median)}`,
    },
  ];

  // Escalones de Ŝ(t) para la gráfica.
  const last = data.at(-1)!.time;
  const points: { x: number; y: number }[] = [{ x: 0, y: 1 }];
  let current = 1;
  for (const r of rows) {
    points.push({ x: r.time, y: current }, { x: r.time, y: r.survival });
    current = r.survival;
  }
  points.push({ x: Math.max(last, rows.at(-1)!.time), y: current });
  const series: Series[] = [
    {
      id: 'supervivencia',
      title: 'Función de supervivencia estimada (Kaplan-Meier)',
      xLabel: 'Tiempo t',
      yLabel: 'Ŝ(t)',
      points,
    },
  ];

  return {
    ok: true,
    value: {
      rows,
      median,
      observations: total,
      censoredTotal: data.filter((o) => o.censored).length,
    },
    summary: [
      {
        label: 'Mediana de supervivencia',
        value: median === null ? '\\text{no estimable}' : `t_{0.5} = ${n(median)}`,
        emphasis: true,
      },
      {
        label: 'Supervivencia al último tiempo de falla',
        value: `\\hat S(${n(rows.at(-1)!.time)}) = ${n(rows.at(-1)!.survival, 6)}`,
      },
      {
        label: 'Observaciones',
        value: `${total}\\ (${data.filter((o) => o.censored).length} \\text{ censuradas})`,
      },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'kaplan-meier',
        title: 'Estimación producto límite',
        columns: [
          { key: 'time', header: 't_j' },
          { key: 'atRisk', header: 'n_j' },
          { key: 'failures', header: 'd_j' },
          { key: 'censored', header: 'c_j' },
          { key: 'conditional', header: '1 - d_j/n_j' },
          { key: 'survival', header: '\\hat S(t_j)' },
          { key: 'failure', header: '\\hat F(t_j)' },
          { key: 'standardError', header: '\\operatorname{EE}' },
        ],
        rows: rows.map((r): Record<string, CellValue> => ({ ...r })),
      },
    ],
    series,
    notices:
      censoredBefore > 0
        ? [
            {
              level: 'info',
              message: `${formatNumber(censoredBefore)} observación(es) censurada(s) antes de la primera falla solo reducen el número en riesgo.`,
            },
          ]
        : [],
  };
}

export const kaplanMeier: Calculator<KaplanMeierInput, KaplanMeierValue, KaplanMeierErrorCode> = {
  meta: {
    id: 'kaplan-meier',
    title: 'Estimador de Kaplan-Meier',
    summary:
      'Función de supervivencia (producto límite) con datos censurados y error de Greenwood.',
    citations: [
      {
        sourceId: 'borean-1995',
        locator: 'El producto límite (Kaplan-Meier) con datos censurados',
      },
      { sourceId: 'borean-ganuza-2001' },
    ],
  },
  inputSchema: kaplanMeierInputSchema,
  // Freireich et al. (1963), grupo tratado con 6-MP: semanas de remisión de 21 pacientes (+ =
  // censurado), el ejemplo clásico del producto límite.
  example: {
    times: '6 6 6 6+ 7 9+ 10 10+ 11+ 13 16 17+ 19+ 20+ 22 23 25+ 32+ 32+ 34+ 35+',
  },
  solve: solveKaplanMeier,
};
