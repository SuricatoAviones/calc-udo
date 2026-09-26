/**
 * Núcleo de las redes de proyectos PERT-CPM (Hillier & Lieberman, cap. de administración de
 * proyectos; Taha, sec. de CPM y PERT): red de actividades en los nodos, recorrido hacia adelante
 * (tiempos más próximos), recorrido hacia atrás (tiempos más lejanos), holguras y rutas críticas.
 *
 *   ES = máx{EF de las predecesoras} (0 si no tiene),   EF = ES + t
 *   LF = mín{LS de las sucesoras} (T si no tiene),      LS = LF − t
 *   holgura total = LS − ES,   holgura libre = mín{ES de las sucesoras} − EF
 *
 * Una actividad es crítica si su holgura total es 0; la ruta crítica es una cadena de
 * actividades críticas desde el inicio hasta el fin del proyecto.
 */
import { z } from 'zod';
import { latexLines, toLatexNumber, toLatexText } from '@/lib/math/format';
import type { CalculatorError, ResultTable, Step } from '../types';

export const MAX_ACTIVITIES = 60;

export const activityNameField = z
  .string({ error: 'Escribe el nombre de la actividad.' })
  .trim()
  .min(1, 'Escribe el nombre de la actividad.')
  .max(24, 'Usa un nombre de hasta 24 caracteres.')
  .regex(/^[^\s,;]+$/, 'El nombre no puede tener espacios, comas ni punto y coma.');

export const predecessorsField = z
  .string({ error: 'Escribe las predecesoras o deja la celda vacía.' })
  .max(300, 'La lista de predecesoras es demasiado larga.');

/** Tiempo no negativo (duración o estimación de una actividad). */
export const timeField = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`)
    .refine((v) => v >= 0, `${label} no puede ser negativa.`);

/**
 * Lista de predecesoras escrita por el estudiante → nombres. Acepta espacios, comas o punto y
 * coma como separadores, y un guion (o nada) para «ninguna».
 */
export function parsePredecessors(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t !== '' && !/^[-–—]+$/.test(t));
}

export interface NetworkActivity {
  name: string;
  /** Nombres tal como los escribió el estudiante (se comparan sin distinguir mayúsculas). */
  predecessors: string[];
  duration: number;
}

export interface ScheduledActivity {
  name: string;
  predecessors: string[];
  successors: string[];
  duration: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  totalSlack: number;
  freeSlack: number;
  critical: boolean;
}

export type NetworkErrorCode = 'duplicate-activity' | 'unknown-predecessor' | 'cycle';

export type NetworkAnalysis =
  | {
      ok: true;
      /** En orden topológico (cada actividad después de sus predecesoras). */
      activities: ScheduledActivity[];
      duration: number;
      /** Rutas críticas como listas de nombres (hasta `MAX_PATHS`). */
      criticalPaths: string[][];
      steps: Step[];
    }
  | { ok: false; error: CalculatorError<NetworkErrorCode>; steps: Step[] };

const MAX_PATHS = 20;

const n = toLatexNumber;
const name = toLatexText;
const at = (symbol: string, activity: string) => `\\mathrm{${symbol}}_{${name(activity)}}`;

/** Opciones de presentación: CPM usa t (duración); PERT, μ (tiempo esperado). */
export interface NetworkOptions {
  durationSymbol: 't' | '\\mu';
}

const key = (activityName: string) => activityName.toUpperCase();

function fail(
  code: NetworkErrorCode,
  message: string,
  steps: Step[] = [],
): Extract<NetworkAnalysis, { ok: false }> {
  return { ok: false, error: { code, message }, steps };
}

/** Orden topológico estable (respeta el orden de entrada) o `null` si hay un ciclo. */
function topologicalOrder(
  activities: NetworkActivity[],
  predecessorsOf: Map<string, string[]>,
): { order: NetworkActivity[] } | { cycle: string[] } {
  const pending = new Map(activities.map((a) => [key(a.name), a]));
  const done = new Set<string>();
  const order: NetworkActivity[] = [];
  while (pending.size > 0) {
    const next = [...pending.values()].find((a) =>
      (predecessorsOf.get(key(a.name)) ?? []).every((p) => done.has(key(p))),
    );
    if (!next) return { cycle: [...pending.values()].map((a) => a.name) };
    pending.delete(key(next.name));
    done.add(key(next.name));
    order.push(next);
  }
  return { order };
}

export function analyzeNetwork(
  input: NetworkActivity[],
  { durationSymbol }: NetworkOptions,
): NetworkAnalysis {
  const t = (activity: string) => `${durationSymbol}_{${name(activity)}}`;

  // ── Validación de la red ────────────────────────────────────────────────
  const byKey = new Map<string, NetworkActivity>();
  for (const activity of input) {
    if (byKey.has(key(activity.name))) {
      return fail(
        'duplicate-activity',
        `La actividad «${activity.name}» aparece más de una vez. Cada actividad debe tener un nombre distinto.`,
      );
    }
    byKey.set(key(activity.name), activity);
  }
  const predecessorsOf = new Map<string, string[]>();
  for (const activity of input) {
    const names: string[] = [];
    for (const p of activity.predecessors) {
      const target = byKey.get(key(p));
      if (!target) {
        return fail(
          'unknown-predecessor',
          `La actividad «${activity.name}» tiene como predecesora a «${p}», que no está en la lista de actividades.`,
        );
      }
      if (key(target.name) === key(activity.name)) {
        return fail(
          'cycle',
          `La actividad «${activity.name}» no puede ser predecesora de sí misma.`,
        );
      }
      if (!names.includes(target.name)) names.push(target.name);
    }
    predecessorsOf.set(key(activity.name), names);
  }

  const sorted = topologicalOrder(input, predecessorsOf);
  if ('cycle' in sorted) {
    return fail(
      'cycle',
      `Las relaciones de precedencia forman un ciclo entre ${sorted.cycle.map((a) => `«${a}»`).join(', ')}: ninguna de esas actividades podría empezar nunca. Revisa las predecesoras.`,
    );
  }
  const order = sorted.order;
  const successorsOf = new Map<string, string[]>(order.map((a) => [key(a.name), []]));
  for (const activity of order) {
    for (const p of predecessorsOf.get(key(activity.name)) ?? []) {
      successorsOf.get(key(p))!.push(activity.name);
    }
  }
  const preds = (a: NetworkActivity) => predecessorsOf.get(key(a.name)) ?? [];
  const succs = (a: NetworkActivity) => successorsOf.get(key(a.name)) ?? [];

  const initial = order.filter((a) => preds(a).length === 0).map((a) => a.name);
  const final = order.filter((a) => succs(a).length === 0).map((a) => a.name);
  const steps: Step[] = [
    {
      title: 'Construir la red del proyecto',
      explanation:
        'Cada actividad es un nodo y cada relación de precedencia es una flecha de la predecesora a la actividad (representación de actividades en los nodos). En esta representación no hacen falta actividades ficticias; en la de actividades en las flechas se agregan para expresar precedencias que comparten eventos.',
      result: `\\text{Iniciales: } ${initial.map(name).join(',\\ ')} \\qquad \\text{Finales: } ${final.map(name).join(',\\ ')}`,
    },
  ];

  // ── Recorrido hacia adelante ────────────────────────────────────────────
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  const forward: Step[] = [];
  for (const activity of order) {
    const a = activity.name;
    const p = preds(activity);
    const start = p.length === 0 ? 0 : Math.max(...p.map((x) => ef.get(key(x))!));
    const finish = start + activity.duration;
    es.set(key(a), start);
    ef.set(key(a), finish);
    const esFormula =
      p.length === 0
        ? `${at('ES', a)} = 0`
        : p.length === 1
          ? `${at('ES', a)} = ${at('EF', p[0]!)}`
          : `${at('ES', a)} = \\max\\{${p.map((x) => at('EF', x)).join(',\\ ')}\\}`;
    const esSubstitution =
      p.length === 0
        ? `${at('ES', a)} = 0`
        : p.length === 1
          ? `${at('ES', a)} = ${n(start)}`
          : `${at('ES', a)} = \\max\\{${p.map((x) => n(ef.get(key(x))!)).join(',\\ ')}\\} = ${n(start)}`;
    forward.push({
      title:
        p.length === 0
          ? `${a} (sin predecesoras)`
          : `${a} (${p.length === 1 ? 'predecesora' : 'predecesoras'}: ${p.join(', ')})`,
      formula: `${esFormula}, \\qquad ${at('EF', a)} = ${at('ES', a)} + ${t(a)}`,
      substitution: `${esSubstitution}, \\qquad ${at('EF', a)} = ${n(start)} + ${n(activity.duration)}`,
      result: `${at('ES', a)} = ${n(start)}, \\qquad ${at('EF', a)} = ${n(finish)}`,
    });
  }
  steps.push({
    title: 'Recorrido hacia adelante (tiempos más próximos)',
    explanation:
      'Una actividad puede empezar en cuanto terminan todas sus predecesoras: su inicio más próximo ES es el mayor de los tiempos de terminación más próximos EF de sus predecesoras. Las actividades iniciales empiezan en 0.',
    formula: `\\mathrm{ES} = \\max\\{\\mathrm{EF}\\ \\text{de las predecesoras}\\}, \\qquad \\mathrm{EF} = \\mathrm{ES} + ${durationSymbol}`,
    children: forward,
  });

  const duration = Math.max(...final.map((a) => ef.get(key(a))!));
  steps.push({
    title: 'Duración del proyecto',
    explanation: 'El proyecto termina cuando terminan todas las actividades finales.',
    formula: `T = \\max\\{\\mathrm{EF}\\ \\text{de las actividades finales}\\}`,
    substitution:
      final.length === 1
        ? `T = ${at('EF', final[0]!)}`
        : `T = \\max\\{${final.map((a) => n(ef.get(key(a))!)).join(',\\ ')}\\}`,
    result: `T = ${n(duration)}`,
  });

  // ── Recorrido hacia atrás ───────────────────────────────────────────────
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  const backward: Step[] = [];
  for (const activity of [...order].reverse()) {
    const a = activity.name;
    const s = succs(activity);
    const finish = s.length === 0 ? duration : Math.min(...s.map((x) => ls.get(key(x))!));
    const start = finish - activity.duration;
    lf.set(key(a), finish);
    ls.set(key(a), start);
    const lfFormula =
      s.length === 0
        ? `${at('LF', a)} = T`
        : s.length === 1
          ? `${at('LF', a)} = ${at('LS', s[0]!)}`
          : `${at('LF', a)} = \\min\\{${s.map((x) => at('LS', x)).join(',\\ ')}\\}`;
    const lfSubstitution =
      s.length === 0 || s.length === 1
        ? `${at('LF', a)} = ${n(finish)}`
        : `${at('LF', a)} = \\min\\{${s.map((x) => n(ls.get(key(x))!)).join(',\\ ')}\\} = ${n(finish)}`;
    backward.push({
      title:
        s.length === 0
          ? `${a} (sin sucesoras)`
          : `${a} (${s.length === 1 ? 'sucesora' : 'sucesoras'}: ${s.join(', ')})`,
      formula: `${lfFormula}, \\qquad ${at('LS', a)} = ${at('LF', a)} - ${t(a)}`,
      substitution: `${lfSubstitution}, \\qquad ${at('LS', a)} = ${n(finish)} - ${n(activity.duration)}`,
      result: `${at('LS', a)} = ${n(start)}, \\qquad ${at('LF', a)} = ${n(finish)}`,
    });
  }
  steps.push({
    title: 'Recorrido hacia atrás (tiempos más lejanos)',
    explanation:
      'Partiendo de T, se retrocede desde las actividades finales: una actividad debe terminar a más tardar cuando la primera de sus sucesoras tiene que empezar. Así se obtienen los tiempos más lejanos que no retrasan el proyecto.',
    formula: `\\mathrm{LF} = \\min\\{\\mathrm{LS}\\ \\text{de las sucesoras}\\}, \\qquad \\mathrm{LS} = \\mathrm{LF} - ${durationSymbol}`,
    children: backward,
  });

  // ── Holguras ────────────────────────────────────────────────────────────
  const tolerance = 1e-9 * Math.max(1, Math.abs(duration));
  const scheduled: ScheduledActivity[] = order.map((activity) => {
    const k = key(activity.name);
    const s = succs(activity);
    const nextStart = s.length === 0 ? duration : Math.min(...s.map((x) => es.get(key(x))!));
    const totalSlack = ls.get(k)! - es.get(k)!;
    return {
      name: activity.name,
      predecessors: preds(activity),
      successors: s,
      duration: activity.duration,
      es: es.get(k)!,
      ef: ef.get(k)!,
      ls: ls.get(k)!,
      lf: lf.get(k)!,
      totalSlack: Math.abs(totalSlack) <= tolerance ? 0 : totalSlack,
      freeSlack: Math.max(0, nextStart - ef.get(k)!),
      critical: Math.abs(totalSlack) <= tolerance,
    };
  });
  steps.push({
    title: 'Holguras',
    explanation:
      'La holgura total es cuánto puede retrasarse una actividad sin retrasar el proyecto; la holgura libre, cuánto puede retrasarse sin retrasar el inicio más próximo de ninguna sucesora. Las actividades con holgura total 0 son críticas.',
    formula: `\\mathrm{HT} = \\mathrm{LS} - \\mathrm{ES} = \\mathrm{LF} - \\mathrm{EF}, \\qquad \\mathrm{HL} = \\min\\{\\mathrm{ES}\\ \\text{de las sucesoras}\\} - \\mathrm{EF}`,
    children: scheduled.map((a) => {
      const nextStarts = a.successors.map((s) => n(es.get(key(s))!));
      const free =
        a.successors.length === 0
          ? `T - ${at('EF', a.name)} = ${n(duration)} - ${n(a.ef)}`
          : a.successors.length === 1
            ? `${nextStarts[0]} - ${n(a.ef)}`
            : `\\min\\{${nextStarts.join(',\\ ')}\\} - ${n(a.ef)}`;
      return {
        title: `${a.name}${a.critical ? ' (crítica)' : ''}`,
        substitution: `${at('HT', a.name)} = ${n(a.ls)} - ${n(a.es)}, \\qquad ${at('HL', a.name)} = ${free}`,
        result: `${at('HT', a.name)} = ${n(a.totalSlack)}, \\qquad ${at('HL', a.name)} = ${n(a.freeSlack)}`,
      };
    }),
  });

  // ── Rutas críticas ──────────────────────────────────────────────────────
  const scheduledByKey = new Map(scheduled.map((a) => [key(a.name), a]));
  const tight = (from: ScheduledActivity, to: ScheduledActivity) =>
    to.critical && Math.abs(to.es - from.ef) <= tolerance;
  const criticalPaths: string[][] = [];
  const extend = (path: ScheduledActivity[]) => {
    if (criticalPaths.length >= MAX_PATHS) return;
    const last = path.at(-1)!;
    const next = last.successors
      .map((s) => scheduledByKey.get(key(s))!)
      .filter((s) => tight(last, s));
    if (next.length === 0) {
      if (Math.abs(last.ef - duration) <= tolerance) criticalPaths.push(path.map((a) => a.name));
      return;
    }
    for (const s of next) extend([...path, s]);
  };
  for (const start of scheduled) {
    const hasTightPredecessor = start.predecessors.some((p) =>
      tight(scheduledByKey.get(key(p))!, start),
    );
    if (start.critical && !hasTightPredecessor && start.es <= tolerance) extend([start]);
  }

  steps.push({
    title: criticalPaths.length > 1 ? 'Rutas críticas' : 'Ruta crítica',
    explanation:
      'La ruta crítica encadena actividades con holgura total 0 desde el inicio hasta el fin del proyecto. Es la ruta más larga de la red: cualquier retraso en una de sus actividades retrasa el proyecto completo.',
    result: latexLines(
      criticalPaths.map((path) => `${criticalPathLatex(path)} \\quad (T = ${n(duration)})`),
    ),
  });

  return { ok: true, activities: scheduled, duration, criticalPaths, steps };
}

/** Ruta en LaTeX: `\text{A} \to \text{B} \to …`. */
export function criticalPathLatex(path: string[]): string {
  return path.map(name).join(' \\to ');
}

/** Ruta en texto plano: «A → B → C». */
export function criticalPathText(path: string[]): string {
  return path.join(' → ');
}

/** Columnas de tiempos comunes a CPM y PERT. */
export function scheduleColumns(): ResultTable['columns'] {
  return [
    { key: 'es', header: '\\mathrm{ES}' },
    { key: 'ef', header: '\\mathrm{EF}' },
    { key: 'ls', header: '\\mathrm{LS}' },
    { key: 'lf', header: '\\mathrm{LF}' },
    { key: 'totalSlack', header: '\\mathrm{HT}' },
    { key: 'freeSlack', header: '\\mathrm{HL}' },
    { key: 'critical', header: '\\text{¿Crítica?}', format: 'text' },
  ];
}

export function scheduleRow(a: ScheduledActivity) {
  return {
    es: a.es,
    ef: a.ef,
    ls: a.ls,
    lf: a.lf,
    totalSlack: a.totalSlack,
    freeSlack: a.freeSlack,
    critical: a.critical ? 'Sí' : 'No',
  };
}

/** Aviso cuando hay varias rutas críticas. */
export function multiplePathsMessage(paths: string[][]): string {
  return `Hay ${paths.length} rutas críticas${paths.length >= MAX_PATHS ? ` (se muestran las primeras ${MAX_PATHS})` : ''}: ${paths.map(criticalPathText).join('; ')}. Todas duran lo mismo; un retraso en cualquiera de ellas retrasa el proyecto.`;
}
