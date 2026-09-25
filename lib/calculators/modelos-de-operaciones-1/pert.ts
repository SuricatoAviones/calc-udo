/**
 * PERT con tres estimaciones de tiempo (Hillier & Lieberman, sec. «Dealing with uncertain
 * activity durations»; Taha, sec. 6.5):
 *
 *   μ = (a + 4m + b)/6,   σ² = ((b − a)/6)²                 (distribución beta de cada actividad)
 *   μ_p = Σ μ,  σ_p² = Σ σ²  sobre la ruta crítica media
 *   P(T ≤ d) ≈ Φ((d − μ_p)/σ_p)
 *
 * La probabilidad descansa en tres aproximaciones (Hillier): la ruta crítica media resulta ser la
 * más larga, las duraciones son independientes y la duración del proyecto es normal.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { normalDensity, standardNormalCdf } from '@/lib/math/normal';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Notice,
  type Step,
} from '../types';
import {
  activityNameField,
  analyzeNetwork,
  criticalPathLatex,
  criticalPathText,
  MAX_ACTIVITIES,
  multiplePathsMessage,
  parsePredecessors,
  predecessorsField,
  scheduleColumns,
  scheduleRow,
  timeField,
  type NetworkErrorCode,
  type ScheduledActivity,
} from './network';

export const pertInputSchema = z.object({
  activities: z
    .array(
      z
        .object({
          name: activityNameField,
          predecessors: predecessorsField,
          optimistic: timeField('el tiempo optimista'),
          mostLikely: timeField('el tiempo más probable'),
          pessimistic: timeField('el tiempo pesimista'),
        })
        .superRefine((a, ctx) => {
          if (a.mostLikely < a.optimistic) {
            ctx.addIssue({
              code: 'custom',
              path: ['mostLikely'],
              message: 'm no puede ser menor que el tiempo optimista a.',
            });
          }
          if (a.pessimistic < a.mostLikely) {
            ctx.addIssue({
              code: 'custom',
              path: ['pessimistic'],
              message: 'b no puede ser menor que el tiempo más probable m.',
            });
          }
        }),
    )
    .min(1, 'Agrega al menos una actividad.')
    .max(MAX_ACTIVITIES, `El máximo es ${MAX_ACTIVITIES} actividades.`),
  deadline: timeField('la fecha de terminación d'),
});

export type PertInput = z.infer<typeof pertInputSchema>;

export interface PertActivity extends ScheduledActivity {
  optimistic: number;
  mostLikely: number;
  pessimistic: number;
  variance: number;
}

export interface PertValue {
  /** Media y varianza de la duración del proyecto (sobre la ruta crítica media elegida). */
  mean: number;
  variance: number;
  sd: number;
  /** `null` si σ_p = 0 (ruta crítica sin incertidumbre). */
  z: number | null;
  probability: number;
  criticalPath: string[];
  activities: PertActivity[];
}

export type PertErrorCode = NetworkErrorCode;

const n = toLatexNumber;

export function solvePert(input: PertInput): CalculatorResult<PertValue, PertErrorCode> {
  const estimates = input.activities.map((a) => {
    const mean = (a.optimistic + 4 * a.mostLikely + a.pessimistic) / 6;
    const variance = ((a.pessimistic - a.optimistic) / 6) ** 2;
    return { ...a, mean, variance };
  });

  const steps: Step[] = [
    {
      title: 'Tiempo esperado y varianza de cada actividad',
      explanation:
        'Con las estimaciones optimista (a), más probable (m) y pesimista (b), PERT supone una distribución beta para la duración de cada actividad y aproxima su media y su varianza así.',
      formula:
        '\\mu = \\frac{a + 4m + b}{6}, \\qquad \\sigma^2 = \\left(\\frac{b - a}{6}\\right)^2',
      children: estimates.map((a) => ({
        title: a.name,
        substitution: `\\mu = \\frac{${n(a.optimistic)} + 4(${n(a.mostLikely)}) + ${n(a.pessimistic)}}{6}, \\qquad \\sigma^2 = \\left(\\frac{${n(a.pessimistic)} - ${n(a.optimistic)}}{6}\\right)^2`,
        result: `\\mu = ${n(a.mean, 6)}, \\qquad \\sigma^2 = ${n(a.variance, 6)}`,
      })),
    },
  ];

  const analysis = analyzeNetwork(
    estimates.map((a) => ({
      name: a.name,
      predecessors: parsePredecessors(a.predecessors),
      duration: a.mean,
    })),
    { durationSymbol: '\\mu' },
  );
  if (!analysis.ok) {
    return {
      ok: false,
      error: analysis.error,
      ...emptyTrace(),
      steps: [...steps, ...analysis.steps],
    };
  }
  steps.push(...analysis.steps);

  const byName = new Map(estimates.map((a) => [a.name.toUpperCase(), a]));
  const activities: PertActivity[] = analysis.activities.map((a) => {
    const e = byName.get(a.name.toUpperCase())!;
    return {
      ...a,
      optimistic: e.optimistic,
      mostLikely: e.mostLikely,
      pessimistic: e.pessimistic,
      variance: e.variance,
    };
  });
  const varianceOf = new Map(activities.map((a) => [a.name, a.variance]));
  const meanOf = new Map(activities.map((a) => [a.name, a.duration]));
  const pathVariance = (path: string[]) => path.reduce((s, a) => s + varianceOf.get(a)!, 0);

  // Con varias rutas críticas medias se toma la de mayor varianza: da la estimación más
  // conservadora de la probabilidad.
  const paths = analysis.criticalPaths;
  const path = paths.reduce((best, p) => (pathVariance(p) > pathVariance(best) ? p : best));
  const mean = analysis.duration;
  const variance = pathVariance(path);
  const sd = Math.sqrt(variance);
  const d = input.deadline;

  steps.push({
    title: 'Media y varianza de la duración del proyecto',
    explanation:
      'Se suman las medias y las varianzas de las actividades de la ruta crítica media, suponiendo que sus duraciones son independientes.',
    formula:
      '\\mu_p = \\sum_{\\text{ruta crítica}} \\mu, \\qquad \\sigma_p^2 = \\sum_{\\text{ruta crítica}} \\sigma^2',
    substitution: `\\mu_p = ${path.map((a) => n(meanOf.get(a)!, 6)).join(' + ')}, \\qquad \\sigma_p^2 = ${path.map((a) => n(varianceOf.get(a)!, 6)).join(' + ')}`,
    result: `\\mu_p = ${n(mean, 6)}, \\qquad \\sigma_p^2 = ${n(variance, 6)}, \\qquad \\sigma_p = ${n(sd, 6)}`,
  });

  const notices: Notice[] = [];
  if (paths.length > 1) {
    notices.push({
      level: 'info',
      message: `${multiplePathsMessage(paths)} Para la varianza se usa la de mayor varianza (${criticalPathText(path)}), que da la probabilidad más conservadora.`,
    });
  }

  let z: number | null = null;
  let probability: number;
  if (sd === 0) {
    probability = d >= mean ? 1 : 0;
    steps.push({
      title: 'Probabilidad de terminar a tiempo',
      explanation:
        'Las actividades de la ruta crítica no tienen incertidumbre (a = b), así que la duración del proyecto es exactamente μ_p.',
      result: `P(T \\le ${n(d)}) = ${probability}`,
    });
    notices.push({
      level: 'warning',
      message:
        'σ_p = 0: la ruta crítica no tiene incertidumbre y la probabilidad es 0 o 1. Revisa si las estimaciones a, m y b son correctas.',
    });
  } else {
    z = (d - mean) / sd;
    probability = standardNormalCdf(z);
    steps.push({
      title: 'Probabilidad de terminar a tiempo',
      explanation:
        'La duración del proyecto se aproxima con una normal N(μ_p, σ_p): se estandariza la fecha d y se busca el área a la izquierda en la tabla de la normal.',
      formula: 'z = \\frac{d - \\mu_p}{\\sigma_p}, \\qquad P(T \\le d) \\approx \\Phi(z)',
      substitution: `z = \\frac{${n(d)} - ${toLatexOperand(mean, 6)}}{${n(sd, 6)}}`,
      result: `z = ${n(z, 6)}, \\qquad P(T \\le ${n(d)}) \\approx \\Phi(${n(z, 4)}) = ${n(probability, 4)}`,
    });
  }
  notices.push({
    level: 'info',
    message:
      'La probabilidad es aproximada: supone que la ruta crítica media será la más larga, que las duraciones son independientes y que la duración del proyecto es normal. Suele resultar algo optimista.',
  });

  const series =
    sd > 0
      ? [
          {
            id: 'duracion',
            title: `Duración del proyecto ≈ N(${formatNumber(mean, 4)}, ${formatNumber(sd, 4)}) y P(T ≤ ${formatNumber(d, 4)})`,
            xLabel: 'T',
            yLabel: 'densidad',
            points: Array.from({ length: 161 }, (_, k) => {
              const x = mean - 4 * sd + (8 * sd * k) / 160;
              return { x, y: normalDensity(x, mean, sd) };
            }),
            highlight: { from: mean - 4 * sd, to: Math.min(d, mean + 4 * sd) },
          },
        ]
      : [];

  return {
    ok: true,
    value: { mean, variance, sd, z, probability, criticalPath: path, activities },
    summary: [
      {
        label: `Probabilidad de terminar en ${formatNumber(d)} o menos`,
        value: `P(T \\le ${n(d)}) \\approx ${n(probability, 4)}`,
        emphasis: true,
      },
      { label: 'Duración esperada', value: `\\mu_p = ${n(mean, 6)}` },
      {
        label: 'Varianza y desviación',
        value: `\\sigma_p^2 = ${n(variance, 6)}, \\quad \\sigma_p = ${n(sd, 6)}`,
      },
      { label: 'Ruta crítica media', value: criticalPathLatex(path) },
    ],
    ...emptyTrace(),
    steps,
    notices,
    tables: [
      {
        id: 'estimaciones',
        title: 'Estimaciones de tiempo de las actividades',
        columns: [
          { key: 'name', header: '\\text{Actividad}', format: 'text' },
          { key: 'predecessors', header: '\\text{Predecesoras}', format: 'text' },
          { key: 'a', header: 'a' },
          { key: 'm', header: 'm' },
          { key: 'b', header: 'b' },
          { key: 'mean', header: '\\mu' },
          { key: 'variance', header: '\\sigma^2' },
        ],
        rows: activities.map((a) => ({
          name: a.name,
          predecessors: a.predecessors.join(', ') || '—',
          a: a.optimistic,
          m: a.mostLikely,
          b: a.pessimistic,
          mean: a.duration,
          variance: a.variance,
        })),
      },
      {
        id: 'programacion',
        title: 'Programación con los tiempos esperados',
        columns: [
          { key: 'name', header: '\\text{Actividad}', format: 'text' },
          { key: 'mean', header: '\\mu' },
          ...scheduleColumns(),
        ],
        rows: activities.map((a) => ({ name: a.name, mean: a.duration, ...scheduleRow(a) })),
      },
    ],
    series,
  };
}

export const pert: Calculator<PertInput, PertValue, PertErrorCode> = {
  meta: {
    id: 'pert',
    title: 'PERT con tres estimaciones de tiempo',
    summary: 'Tiempo esperado, varianza y probabilidad de terminar un proyecto en una fecha.',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator:
          'Proyecto de Reliable Construction Co., tablas 22.4 y 22.6 (cap. 22 de la 8.ª ed. en inglés; cap. 10 en la 7.ª ed.)',
      },
      { sourceId: 'taha', locator: 'Sec. 6.5, CPM y PERT (8.ª ed. en inglés)' },
      { sourceId: 'aquilano-1994' },
    ],
  },
  inputSchema: pertInputSchema,
  // Hillier & Lieberman, tabla 22.4: estimaciones (optimista, más probable, pesimista) en semanas
  // y plazo de 47 semanas para evitar la penalización del contrato.
  example: {
    activities: [
      { name: 'A', predecessors: '', optimistic: 1, mostLikely: 2, pessimistic: 3 },
      { name: 'B', predecessors: 'A', optimistic: 2, mostLikely: 3.5, pessimistic: 8 },
      { name: 'C', predecessors: 'B', optimistic: 6, mostLikely: 9, pessimistic: 18 },
      { name: 'D', predecessors: 'C', optimistic: 4, mostLikely: 5.5, pessimistic: 10 },
      { name: 'E', predecessors: 'C', optimistic: 1, mostLikely: 4.5, pessimistic: 5 },
      { name: 'F', predecessors: 'E', optimistic: 4, mostLikely: 4, pessimistic: 10 },
      { name: 'G', predecessors: 'D', optimistic: 5, mostLikely: 6.5, pessimistic: 11 },
      { name: 'H', predecessors: 'E, G', optimistic: 5, mostLikely: 8, pessimistic: 17 },
      { name: 'I', predecessors: 'C', optimistic: 3, mostLikely: 7.5, pessimistic: 9 },
      { name: 'J', predecessors: 'F, I', optimistic: 3, mostLikely: 9, pessimistic: 9 },
      { name: 'K', predecessors: 'J', optimistic: 4, mostLikely: 4, pessimistic: 4 },
      { name: 'L', predecessors: 'J', optimistic: 1, mostLikely: 5.5, pessimistic: 7 },
      { name: 'M', predecessors: 'H', optimistic: 1, mostLikely: 2, pessimistic: 3 },
      { name: 'N', predecessors: 'K, L', optimistic: 5, mostLikely: 5.5, pessimistic: 9 },
    ],
    deadline: 47,
  },
  solve: solvePert,
};
