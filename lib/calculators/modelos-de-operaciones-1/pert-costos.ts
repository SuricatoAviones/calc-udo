/**
 * PERT-Costos: compresión del proyecto al menor costo (Hillier & Lieberman, sec. 10.5, «Time-cost
 * trade-offs»; Anderson, Sweeney y Williams, sec. 9.3). Cada actividad tiene un punto normal
 * (tiempo y costo) y uno de compresión máxima; entre ambos el costo crece linealmente:
 *
 *   costo de compresión por unidad = (costo comprimido − costo normal) / (tiempo normal − tiempo comprimido)
 *
 * Análisis de costo marginal: se acorta el proyecto una unidad de tiempo a la vez. Para hacerlo
 * hay que acortar todas las rutas críticas; se elige el conjunto de actividades críticas (que aún
 * se pueden comprimir) más barato que toca cada ruta crítica. Ese conjunto es un corte mínimo de
 * vértices en la subred de actividades críticas y se obtiene con un flujo máximo (Ford-Fulkerson).
 * Se repite hasta llegar a la duración deseada o hasta que alguna ruta crítica ya no se pueda
 * acortar. Si se da un costo indirecto por unidad de tiempo, se busca además la duración con el
 * menor costo total.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexText } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type ResultTable,
  type Series,
  type Step,
} from '../types';
import {
  activityNameField,
  analyzeNetwork,
  criticalPathText,
  MAX_ACTIVITIES,
  parsePredecessors,
  predecessorsField,
  timeField,
  type NetworkErrorCode,
} from './network';

const cost = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`)
    .refine((v) => v >= 0, `${label} no puede ser negativo.`);

export const crashingInputSchema = z
  .object({
    activities: z
      .array(
        z.object({
          name: activityNameField,
          predecessors: predecessorsField,
          normalTime: timeField('el tiempo normal'),
          crashTime: timeField('el tiempo comprimido'),
          normalCost: cost('el costo normal'),
          crashCost: cost('el costo comprimido'),
        }),
      )
      .min(1, 'Agrega al menos una actividad.')
      .max(MAX_ACTIVITIES, `El máximo es ${MAX_ACTIVITIES} actividades.`),
    target: z
      .number({ error: 'La duración deseada debe ser un número.' })
      .refine((v) => Number.isFinite(v) && v >= 0, 'La duración deseada no puede ser negativa.')
      .optional(),
    indirectCost: cost('el costo indirecto por unidad de tiempo').optional(),
  })
  .superRefine((v, ctx) => {
    v.activities.forEach((a, i) => {
      if (a.crashTime > a.normalTime) {
        ctx.addIssue({
          code: 'custom',
          path: ['activities', i, 'crashTime'],
          message: 'El tiempo comprimido no puede ser mayor que el normal.',
        });
      }
      if (a.crashCost < a.normalCost) {
        ctx.addIssue({
          code: 'custom',
          path: ['activities', i, 'crashCost'],
          message: 'Comprimir no puede costar menos que el costo normal.',
        });
      }
      if (!Number.isInteger(a.normalTime) || !Number.isInteger(a.crashTime)) {
        ctx.addIssue({
          code: 'custom',
          path: ['activities', i, 'normalTime'],
          message: 'Usa tiempos enteros: el proyecto se acorta una unidad de tiempo a la vez.',
        });
      }
    });
  });

export type CrashingInput = z.infer<typeof crashingInputSchema>;

export interface CrashStep {
  /** Duración del proyecto después del paso. */
  duration: number;
  /** Actividades acortadas una unidad en este paso. */
  crashed: string[];
  stepCost: number;
  directCost: number;
  criticalPaths: string[][];
}

export interface CrashingValue {
  normalDuration: number;
  finalDuration: number;
  normalCost: number;
  crashingCost: number;
  directCost: number;
  /** Tiempo final de cada actividad. */
  durations: Record<string, number>;
  steps: CrashStep[];
  /** Duración con el menor costo total, si se dio el costo indirecto. */
  optimalDuration: number | null;
  reachedTarget: boolean;
}

export type CrashingErrorCode = NetworkErrorCode;

type Result = CalculatorResult<CrashingValue, CrashingErrorCode>;

const n = toLatexNumber;
const MAX_LISTED_PATHS = 12;

/** Flujo máximo (Edmonds-Karp) y el conjunto alcanzable desde la fuente en el residual. */
function minCut(
  nodes: number,
  edges: { from: number; to: number; capacity: number }[],
  source: number,
  sink: number,
): { value: number; reachable: boolean[] } {
  const capacity = Array.from({ length: nodes }, () => new Array<number>(nodes).fill(0));
  for (const e of edges) capacity[e.from]![e.to]! += e.capacity;
  let value = 0;
  for (;;) {
    const parent = new Array<number>(nodes).fill(-1);
    parent[source] = source;
    const queue = [source];
    while (queue.length > 0 && parent[sink] === -1) {
      const u = queue.shift()!;
      for (let v = 0; v < nodes; v++) {
        if (parent[v] === -1 && capacity[u]![v]! > 1e-12) {
          parent[v] = u;
          queue.push(v);
        }
      }
    }
    if (parent[sink] === -1) break;
    let bottleneck = Infinity;
    for (let v = sink; v !== source; v = parent[v]!) {
      bottleneck = Math.min(bottleneck, capacity[parent[v]!]![v]!);
    }
    if (!Number.isFinite(bottleneck)) return { value: Infinity, reachable: [] };
    for (let v = sink; v !== source; v = parent[v]!) {
      capacity[parent[v]!]![v]! -= bottleneck;
      capacity[v]![parent[v]!]! += bottleneck;
    }
    value += bottleneck;
  }
  const reachable = new Array<boolean>(nodes).fill(false);
  reachable[source] = true;
  const queue = [source];
  while (queue.length > 0) {
    const u = queue.shift()!;
    for (let v = 0; v < nodes; v++) {
      if (!reachable[v] && capacity[u]![v]! > 1e-12) {
        reachable[v] = true;
        queue.push(v);
      }
    }
  }
  return { value, reachable };
}

/** Todas las rutas de inicio a fin (para la tabla de longitudes), o `null` si son muchas. */
function allPaths(names: string[], predecessors: string[][]): string[][] | null {
  const successors = new Map<string, string[]>(names.map((a) => [a, []]));
  predecessors.forEach((preds, i) => preds.forEach((p) => successors.get(p)?.push(names[i]!)));
  const starts = names.filter((_, i) => predecessors[i]!.length === 0);
  const paths: string[][] = [];
  const walk = (node: string, path: string[]): boolean => {
    const next = successors.get(node) ?? [];
    if (next.length === 0) {
      paths.push([...path, node]);
      return paths.length <= MAX_LISTED_PATHS;
    }
    return next.every((s) => walk(s, [...path, node]));
  };
  for (const s of starts) if (!walk(s, [])) return null;
  return paths;
}

export function solveCrashing(input: CrashingInput): Result {
  const activities = input.activities;
  const names = activities.map((a) => a.name);
  const keyOf = (name: string) =>
    activities.find((a) => a.name.toUpperCase() === name.toUpperCase())?.name ?? name;
  const predecessors = activities.map((a) => parsePredecessors(a.predecessors).map(keyOf));
  const slope = activities.map((a) =>
    a.normalTime > a.crashTime ? (a.crashCost - a.normalCost) / (a.normalTime - a.crashTime) : 0,
  );
  const durations = activities.map((a) => a.normalTime);

  const analyze = () =>
    analyzeNetwork(
      activities.map((a, i) => ({
        name: a.name,
        predecessors: predecessors[i]!,
        duration: durations[i]!,
      })),
      { durationSymbol: 't' },
    );
  const first = analyze();
  if (!first.ok) return { ok: false, error: first.error, ...emptyTrace(), steps: first.steps };

  const normalCost = activities.reduce((acc, a) => acc + a.normalCost, 0);
  const steps: Step[] = [
    {
      title: 'Costo de compresión por unidad de tiempo',
      explanation:
        'Entre el punto normal y el de compresión máxima se supone que el costo crece en línea recta.',
      formula:
        '\\text{Costo por unidad} = \\frac{\\text{costo comprimido} - \\text{costo normal}}{\\text{tiempo normal} - \\text{tiempo comprimido}}',
      substitution: activities
        .filter((a) => a.normalTime > a.crashTime)
        .slice(0, 8)
        .map(
          (a) =>
            `${toLatexText(a.name)}: \\frac{${n(a.crashCost)} - ${n(a.normalCost)}}{${n(a.normalTime)} - ${n(a.crashTime)}} = ${n(slope[names.indexOf(a.name)]!)}`,
        )
        .join(' \\\\ '),
    },
    {
      title: 'Duración normal',
      explanation:
        'Con todas las actividades en su tiempo normal (recorridos hacia adelante y hacia atrás).',
      result: `T = ${n(first.duration)}, \\qquad \\text{costo directo} = ${n(normalCost)}`,
    },
  ];

  const paths = allPaths(names, predecessors);
  const pathLength = (path: string[]) =>
    path.reduce((acc, a) => acc + durations[names.indexOf(a)]!, 0);
  const pathRows: Record<string, CellValue>[] = [];
  const recordPaths = (label: string, stepCost: number | null) => {
    if (!paths) return;
    const row: Record<string, CellValue> = { crashed: label, cost: stepCost };
    paths.forEach((p, k) => {
      row[`p${k}`] = pathLength(p);
    });
    pathRows.push(row);
  };
  recordPaths('—', null);

  const target = input.target ?? 0;
  const history: CrashStep[] = [];
  let current = first;
  let directCost = normalCost;
  let crashingCost = 0;
  let reachedTarget = current.duration <= target;
  const crashSteps: Step[] = [];

  while (current.ok && current.duration > target + 1e-9) {
    // Subred crítica: actividades con holgura total 0 y arcos entre ellas.
    const critical = current.activities.filter((a) => a.critical).map((a) => a.name);
    const index = new Map(critical.map((a, i) => [a, i]));
    const source = 2 * critical.length;
    const sink = source + 1;
    const edges: { from: number; to: number; capacity: number }[] = [];
    critical.forEach((a, i) => {
      const k = names.indexOf(a);
      const canCrash = durations[k]! > activities[k]!.crashTime;
      // Nodo dividido: entrada 2i → salida 2i+1 con capacidad = costo por unidad.
      edges.push({ from: 2 * i, to: 2 * i + 1, capacity: canCrash ? slope[k]! || 1e-9 : Infinity });
      const preds = predecessors[k]!.filter((p) => index.has(p));
      const scheduled = current.ok ? current.activities.find((s) => s.name === a)! : null;
      const criticalPreds = preds.filter((p) => {
        const ps = current.ok ? current.activities.find((s) => s.name === p)! : null;
        return ps !== null && scheduled !== null && Math.abs(ps.ef - scheduled.es) < 1e-9;
      });
      if (criticalPreds.length === 0 && scheduled && Math.abs(scheduled.es) < 1e-9) {
        edges.push({ from: source, to: 2 * i, capacity: Infinity });
      }
      for (const p of criticalPreds) {
        edges.push({ from: 2 * index.get(p)! + 1, to: 2 * i, capacity: Infinity });
      }
      if (scheduled && Math.abs(scheduled.ef - current.duration) < 1e-9) {
        edges.push({ from: 2 * i + 1, to: sink, capacity: Infinity });
      }
    });
    const cut = minCut(sink + 1, edges, source, sink);
    if (!Number.isFinite(cut.value)) {
      crashSteps.push({
        title: `No se puede bajar de T = ${formatNumber(current.duration)}`,
        explanation: `Alguna ruta crítica (${current.criticalPaths
          .slice(0, 3)
          .map(criticalPathText)
          .join('; ')}) ya tiene todas sus actividades en el tiempo comprimido.`,
      });
      break;
    }
    const chosen = critical.filter((_, i) => cut.reachable[2 * i] && !cut.reachable[2 * i + 1]);
    chosen.forEach((a) => {
      durations[names.indexOf(a)]! -= 1;
    });
    const stepCost = chosen.reduce((acc, a) => acc + slope[names.indexOf(a)]!, 0);
    crashingCost += stepCost;
    directCost += stepCost;
    const next = analyze();
    if (!next.ok) break;
    history.push({
      duration: next.duration,
      crashed: chosen,
      stepCost,
      directCost,
      criticalPaths: next.criticalPaths,
    });
    crashSteps.push({
      title: `Reducción ${history.length}: T = ${formatNumber(current.duration)} → ${formatNumber(next.duration)}`,
      explanation: `Rutas críticas: ${current.criticalPaths.slice(0, 4).map(criticalPathText).join('; ')}. Se elige el conjunto más barato de actividades críticas comprimibles que acorta todas: ${chosen.join(', ')}.`,
      substitution: chosen
        .map((a) => `${toLatexText(a)}: ${n(slope[names.indexOf(a)]!)} \\text{ por unidad}`)
        .join(',\\ '),
      result: `\\text{costo del paso} = ${n(stepCost)}, \\qquad \\text{costo directo} = ${n(directCost)}`,
    });
    recordPaths(chosen.join(', '), stepCost);
    current = next;
    reachedTarget = current.duration <= target + 1e-9;
  }
  steps.push({
    title: 'Análisis de costo marginal',
    explanation:
      'En cada paso el proyecto se acorta una unidad de tiempo. Hay que acortar todas las rutas críticas a la vez, así que se busca la combinación más barata de actividades (aún comprimibles) que toque cada ruta crítica.',
    children: crashSteps,
  });

  const finalAnalysis = current.ok ? current : first;
  const finalDurations = Object.fromEntries(names.map((a, i) => [a, durations[i]!]));

  let optimalDuration: number | null = null;
  const tables: ResultTable[] = [];
  const series: Series[] = [];
  const curve = [
    { duration: first.duration, direct: normalCost },
    ...history.map((h) => ({ duration: h.duration, direct: h.directCost })),
  ];
  if (input.indirectCost !== undefined) {
    const totals = curve.map((c) => ({ ...c, total: c.direct + input.indirectCost! * c.duration }));
    const best = totals.reduce((a, b) => (b.total < a.total - 1e-9 ? b : a));
    optimalDuration = best.duration;
    steps.push({
      title: 'Duración de costo total mínimo',
      explanation:
        'El costo total es el costo directo (normal más compresión) más el costo indirecto, proporcional a la duración. Al comprimir, el costo directo sube y el indirecto baja.',
      formula: '\\text{CT}(T) = \\text{costo directo}(T) + c_{\\text{ind}}\\,T',
      substitution: totals
        .slice(0, 10)
        .map(
          (t) =>
            `\\text{CT}(${n(t.duration)}) = ${n(t.direct)} + ${n(input.indirectCost!)}(${n(t.duration)}) = ${n(t.total)}`,
        )
        .join(' \\\\ '),
      result: `T^* = ${n(best.duration)}, \\qquad \\text{CT}(T^*) = ${n(best.total)}`,
    });
    series.push({
      id: 'costos',
      title: 'Costos según la duración del proyecto',
      xLabel: 'Duración T',
      yLabel: 'Costo',
      label: 'Costo total',
      points: totals.map((t) => ({ x: t.duration, y: t.total })),
      others: [
        { label: 'Costo directo', points: totals.map((t) => ({ x: t.duration, y: t.direct })) },
        {
          label: 'Costo indirecto',
          points: totals.map((t) => ({ x: t.duration, y: input.indirectCost! * t.duration })),
        },
      ],
    });
  } else {
    series.push({
      id: 'costos',
      title: 'Costo directo según la duración del proyecto',
      xLabel: 'Duración T',
      yLabel: 'Costo directo',
      points: curve.map((c) => ({ x: c.duration, y: c.direct })),
    });
  }

  if (paths && pathRows.length > 1) {
    tables.push({
      id: 'rutas',
      title: 'Longitud de cada ruta (tabla de costo marginal)',
      columns: [
        { key: 'crashed', header: '\\text{Se comprime}', format: 'text' },
        { key: 'cost', header: '\\text{Costo}' },
        ...paths.map((p, k) => ({
          key: `p${k}`,
          header: toLatexText(p.every((a) => a.length === 1) ? p.join('') : p.join('-')),
        })),
      ],
      rows: pathRows,
    });
  }
  tables.push({
    id: 'actividades',
    title: 'Tiempos y costos de las actividades',
    columns: [
      { key: 'name', header: '\\text{Actividad}', format: 'text' },
      { key: 'normalTime', header: '\\text{T. normal}' },
      { key: 'crashTime', header: '\\text{T. comprimido}' },
      { key: 'slope', header: '\\text{Costo por unidad}' },
      { key: 'final', header: '\\text{T. final}' },
      { key: 'extra', header: '\\text{Costo de compresión}' },
    ],
    rows: activities.map((a, i) => ({
      name: a.name,
      normalTime: a.normalTime,
      crashTime: a.crashTime,
      slope: a.normalTime > a.crashTime ? slope[i]! : null,
      final: durations[i]!,
      extra: (a.normalTime - durations[i]!) * slope[i]!,
    })),
  });

  const notices: Result['notices'] = [];
  if (input.target !== undefined && !reachedTarget) {
    notices.push({
      level: 'warning',
      message: `No se puede llegar a ${formatNumber(input.target)}: la duración mínima alcanzable es ${formatNumber(finalAnalysis.duration)}.`,
    });
  }
  if (finalAnalysis.criticalPaths.length > 1) {
    notices.push({
      level: 'info',
      message: `Al final hay ${finalAnalysis.criticalPaths.length} rutas críticas: ${finalAnalysis.criticalPaths.slice(0, 4).map(criticalPathText).join('; ')}.`,
    });
  }

  return {
    ok: true,
    value: {
      normalDuration: first.duration,
      finalDuration: finalAnalysis.duration,
      normalCost,
      crashingCost,
      directCost,
      durations: finalDurations,
      steps: history,
      optimalDuration,
      reachedTarget,
    },
    summary: [
      {
        label: 'Duración final',
        value: `T = ${n(finalAnalysis.duration)} \\ (\\text{normal } ${n(first.duration)})`,
        emphasis: true,
      },
      { label: 'Costo de compresión', value: n(crashingCost) },
      { label: 'Costo directo total', value: n(directCost) },
      ...(optimalDuration === null
        ? []
        : [{ label: 'Duración de costo total mínimo', value: `T^* = ${n(optimalDuration)}` }]),
    ],
    ...emptyTrace(),
    steps,
    tables,
    series,
    notices,
  };
}

export const crashing: Calculator<CrashingInput, CrashingValue, CrashingErrorCode> = {
  meta: {
    id: 'pert-costos',
    title: 'PERT-Costos (compresión del proyecto)',
    summary: 'Acorta la duración del proyecto al menor costo de compresión.',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 10.5, Reliable Construction Co., tablas 10.7 a 10.9 (7.ª ed.)',
      },
      { sourceId: 'anderson-1993', locator: 'Sec. 9.3, compresión de actividades (13.ª ed.)' },
      { sourceId: 'taha' },
    ],
  },
  inputSchema: crashingInputSchema,
  // Hillier, tabla 10.7 (en miles de dólares): proyecto de Reliable Construction, de 44 a 40
  // semanas.
  example: {
    activities: [
      { name: 'A', predecessors: '', normalTime: 2, crashTime: 1, normalCost: 180, crashCost: 280 },
      {
        name: 'B',
        predecessors: 'A',
        normalTime: 4,
        crashTime: 2,
        normalCost: 320,
        crashCost: 420,
      },
      {
        name: 'C',
        predecessors: 'B',
        normalTime: 10,
        crashTime: 7,
        normalCost: 620,
        crashCost: 860,
      },
      {
        name: 'D',
        predecessors: 'C',
        normalTime: 6,
        crashTime: 4,
        normalCost: 260,
        crashCost: 340,
      },
      {
        name: 'E',
        predecessors: 'C',
        normalTime: 4,
        crashTime: 3,
        normalCost: 410,
        crashCost: 570,
      },
      {
        name: 'F',
        predecessors: 'E',
        normalTime: 5,
        crashTime: 3,
        normalCost: 180,
        crashCost: 260,
      },
      {
        name: 'G',
        predecessors: 'D',
        normalTime: 7,
        crashTime: 4,
        normalCost: 900,
        crashCost: 1020,
      },
      {
        name: 'H',
        predecessors: 'E, G',
        normalTime: 9,
        crashTime: 6,
        normalCost: 200,
        crashCost: 380,
      },
      {
        name: 'I',
        predecessors: 'C',
        normalTime: 7,
        crashTime: 5,
        normalCost: 210,
        crashCost: 270,
      },
      {
        name: 'J',
        predecessors: 'F, I',
        normalTime: 8,
        crashTime: 6,
        normalCost: 430,
        crashCost: 490,
      },
      {
        name: 'K',
        predecessors: 'J',
        normalTime: 4,
        crashTime: 3,
        normalCost: 160,
        crashCost: 200,
      },
      {
        name: 'L',
        predecessors: 'J',
        normalTime: 5,
        crashTime: 3,
        normalCost: 250,
        crashCost: 350,
      },
      {
        name: 'M',
        predecessors: 'H',
        normalTime: 2,
        crashTime: 1,
        normalCost: 100,
        crashCost: 200,
      },
      {
        name: 'N',
        predecessors: 'K, L',
        normalTime: 6,
        crashTime: 3,
        normalCost: 330,
        crashCost: 510,
      },
    ],
    target: 40,
  },
  solve: solveCrashing,
};
