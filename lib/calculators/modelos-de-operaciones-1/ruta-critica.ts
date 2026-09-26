/**
 * Ruta crítica (CPM): tiempos más próximos y más lejanos de cada actividad, holguras y rutas
 * críticas de un proyecto con duraciones conocidas (Hillier & Lieberman, cap. de administración
 * de proyectos con PERT/CPM; Taha, sec. 6.5).
 */
import { z } from 'zod';
import { latexLines, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Notice } from '../types';
import {
  activityNameField,
  analyzeNetwork,
  criticalPathLatex,
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

export const criticalPathInputSchema = z.object({
  activities: z
    .array(
      z.object({
        name: activityNameField,
        predecessors: predecessorsField,
        duration: timeField('la duración'),
      }),
    )
    .min(1, 'Agrega al menos una actividad.')
    .max(MAX_ACTIVITIES, `El máximo es ${MAX_ACTIVITIES} actividades.`),
});

export type CriticalPathInput = z.infer<typeof criticalPathInputSchema>;

export interface CriticalPathValue {
  duration: number;
  criticalPaths: string[][];
  activities: ScheduledActivity[];
}

export type CriticalPathErrorCode = NetworkErrorCode;

const n = toLatexNumber;

export function solveCriticalPath(
  input: CriticalPathInput,
): CalculatorResult<CriticalPathValue, CriticalPathErrorCode> {
  const analysis = analyzeNetwork(
    input.activities.map((a) => ({
      name: a.name,
      predecessors: parsePredecessors(a.predecessors),
      duration: a.duration,
    })),
    { durationSymbol: 't' },
  );
  if (!analysis.ok) {
    return { ok: false, error: analysis.error, ...emptyTrace(), steps: analysis.steps };
  }

  const { activities, duration, criticalPaths, steps } = analysis;
  const notices: Notice[] = [];
  if (criticalPaths.length > 1) {
    notices.push({ level: 'info', message: multiplePathsMessage(criticalPaths) });
  }
  const dummies = activities.filter((a) => a.duration === 0);
  if (dummies.length > 0) {
    notices.push({
      level: 'info',
      message: `${dummies.map((a) => a.name).join(', ')} ${dummies.length === 1 ? 'dura' : 'duran'} 0: funcionan como actividades ficticias, que solo transmiten precedencias.`,
    });
  }
  const critical = activities.filter((a) => a.critical);

  return {
    ok: true,
    value: { duration, criticalPaths, activities },
    summary: [
      { label: 'Duración del proyecto', value: `T = ${n(duration)}`, emphasis: true },
      {
        label: criticalPaths.length > 1 ? 'Rutas críticas' : 'Ruta crítica',
        value: latexLines(criticalPaths.map(criticalPathLatex)),
      },
      {
        label: 'Actividades críticas',
        value: `${critical.length}\\ \\text{de}\\ ${activities.length}`,
      },
    ],
    ...emptyTrace(),
    steps,
    notices,
    tables: [
      {
        id: 'actividades',
        title: 'Programación de las actividades',
        columns: [
          { key: 'name', header: '\\text{Actividad}', format: 'text' },
          { key: 'predecessors', header: '\\text{Predecesoras}', format: 'text' },
          { key: 'duration', header: 't' },
          ...scheduleColumns(),
        ],
        rows: activities.map((a) => ({
          name: a.name,
          predecessors: a.predecessors.join(', ') || '—',
          duration: a.duration,
          ...scheduleRow(a),
        })),
      },
    ],
  };
}

export const criticalPath: Calculator<CriticalPathInput, CriticalPathValue, CriticalPathErrorCode> =
  {
    meta: {
      id: 'ruta-critica',
      title: 'Ruta crítica (CPM)',
      summary: 'Tiempos de inicio y terminación, holguras y ruta crítica de un proyecto.',
      citations: [
        {
          sourceId: 'hillier-lieberman-2002',
          locator:
            'Proyecto de Reliable Construction Co., tablas 22.1–22.3 (cap. 22 de la 8.ª ed. en inglés; cap. 10 en la 7.ª ed.)',
        },
        { sourceId: 'taha', locator: 'Sec. 6.5, CPM y PERT (8.ª ed. en inglés)' },
        { sourceId: 'aquilano-1994' },
      ],
    },
    inputSchema: criticalPathInputSchema,
    // Hillier & Lieberman, tabla 22.1: construcción de una planta de Reliable Construction Co.
    // (duraciones en semanas).
    example: {
      activities: [
        { name: 'A', predecessors: '', duration: 2 },
        { name: 'B', predecessors: 'A', duration: 4 },
        { name: 'C', predecessors: 'B', duration: 10 },
        { name: 'D', predecessors: 'C', duration: 6 },
        { name: 'E', predecessors: 'C', duration: 4 },
        { name: 'F', predecessors: 'E', duration: 5 },
        { name: 'G', predecessors: 'D', duration: 7 },
        { name: 'H', predecessors: 'E, G', duration: 9 },
        { name: 'I', predecessors: 'C', duration: 7 },
        { name: 'J', predecessors: 'F, I', duration: 8 },
        { name: 'K', predecessors: 'J', duration: 4 },
        { name: 'L', predecessors: 'J', duration: 5 },
        { name: 'M', predecessors: 'H', duration: 2 },
        { name: 'N', predecessors: 'K, L', duration: 6 },
      ],
    },
    solve: solveCriticalPath,
  };
