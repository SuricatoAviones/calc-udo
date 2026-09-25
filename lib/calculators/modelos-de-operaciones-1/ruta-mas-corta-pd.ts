/**
 * Ruta más corta por programación dinámica (Taha, sec. 10.1–10.2; Hillier & Lieberman,
 * sec. 10.1 de la 9.ª ed., problema de la diligencia).
 *
 * Las etapas agrupan los nodos por su nivel: el número de arcos del camino más largo desde el
 * origen (en una red por etapas, todos los caminos a un nodo tienen el mismo número de arcos).
 *
 *   En reversa:  f*(s) = mín_x { c(s, x) + f*(x) },          f*(destino) = 0
 *   En avance:   f(x)  = mín_s { f(s) + c(s, x) },           f(origen) = 0
 *
 * Por el principio de optimalidad de Bellman, cada etapa solo necesita los valores óptimos de
 * la etapa anterior, no las decisiones que llevaron a ellos.
 */
import { z } from 'zod';
import { toLatexNumber, toLatexText } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Notice,
  type ResultTable,
  type Step,
} from '../types';
import { argOptimum, optimumLatex, stageTable, type StageRow } from './dynamic-programming';
import { latexLines } from './network';

const MAX_ARCS = 80;
const MAX_ROUTES = 20;

const nodeField = (label: string) =>
  z
    .string({ error: `Escribe ${label}.` })
    .trim()
    .min(1, `Escribe ${label}.`)
    .max(24, 'Usa un nombre de hasta 24 caracteres.');

export const recursionTypes = ['reversa', 'avance'] as const;

export const shortestRouteInputSchema = z.object({
  arcs: z
    .array(
      z.object({
        from: nodeField('el nodo de salida'),
        to: nodeField('el nodo de llegada'),
        distance: z
          .number({ error: 'Ingresa la distancia.' })
          .refine(Number.isFinite, 'La distancia debe ser un número finito.'),
      }),
    )
    .min(1, 'Agrega al menos un arco.')
    .max(MAX_ARCS, `El máximo es ${MAX_ARCS} arcos.`),
  origin: nodeField('el nodo de origen'),
  destination: nodeField('el nodo de destino'),
  recursion: z.enum(recursionTypes, { error: 'Elige el tipo de recursión.' }),
});

export type ShortestRouteInput = z.infer<typeof shortestRouteInputSchema>;

export interface ShortestRouteValue {
  distance: number;
  /** Rutas óptimas como listas de nodos (hasta 20). */
  routes: string[][];
  /** Valor óptimo de cada nodo: distancia al destino (reversa) o desde el origen (avance). */
  f: Record<string, number>;
  stages: number;
}

export type ShortestRouteErrorCode =
  'same-node' | 'self-loop' | 'duplicate-arc' | 'unknown-node' | 'cycle' | 'no-route';

type Result = CalculatorResult<ShortestRouteValue, ShortestRouteErrorCode>;

const n = toLatexNumber;
const t = toLatexText;
const key = (node: string) => node.toUpperCase();

function fail(code: ShortestRouteErrorCode, message: string, steps: Step[] = []): Result {
  return { ok: false, error: { code, message }, ...emptyTrace(), steps };
}

interface Arc {
  from: string;
  to: string;
  distance: number;
}

export function solveShortestRoute(input: ShortestRouteInput): Result {
  // ── Red: nombres de nodos sin distinguir mayúsculas ────────────────────────
  const display = new Map<string, string>();
  const nodeName = (raw: string) => {
    if (!display.has(key(raw))) display.set(key(raw), raw);
    return display.get(key(raw))!;
  };
  const arcs: Arc[] = [];
  const seen = new Set<string>();
  for (const arc of input.arcs) {
    const from = nodeName(arc.from);
    const to = nodeName(arc.to);
    if (key(from) === key(to)) {
      return fail('self-loop', `El arco ${from} → ${to} sale y llega al mismo nodo.`);
    }
    const id = `${key(from)}→${key(to)}`;
    if (seen.has(id)) {
      return fail(
        'duplicate-arc',
        `El arco ${from} → ${to} aparece más de una vez. Deja solo el de la distancia correcta.`,
      );
    }
    seen.add(id);
    arcs.push({ from, to, distance: arc.distance });
  }
  for (const [label, raw] of [
    ['origen', input.origin],
    ['destino', input.destination],
  ] as const) {
    if (!display.has(key(raw))) {
      return fail(
        'unknown-node',
        `El nodo de ${label} «${raw}» no aparece en ningún arco de la red.`,
      );
    }
  }
  const origin = display.get(key(input.origin))!;
  const destination = display.get(key(input.destination))!;
  if (key(origin) === key(destination)) {
    return fail('same-node', 'El origen y el destino son el mismo nodo.');
  }

  const out = new Map<string, Arc[]>();
  const into = new Map<string, Arc[]>();
  for (const arc of arcs) {
    out.set(key(arc.from), [...(out.get(key(arc.from)) ?? []), arc]);
    into.set(key(arc.to), [...(into.get(key(arc.to)) ?? []), arc]);
  }
  const reach = (start: string, next: (k: string) => string[]) => {
    const found = new Set([key(start)]);
    const stack = [key(start)];
    while (stack.length > 0) {
      for (const k of next(stack.pop()!)) {
        if (!found.has(k)) {
          found.add(k);
          stack.push(k);
        }
      }
    }
    return found;
  };
  const fromOrigin = reach(origin, (k) => (out.get(k) ?? []).map((a) => key(a.to)));
  const toDestination = reach(destination, (k) => (into.get(k) ?? []).map((a) => key(a.from)));
  if (!fromOrigin.has(key(destination))) {
    return fail(
      'no-route',
      `No hay ninguna ruta de ${origin} a ${destination}: revisa el sentido de los arcos.`,
    );
  }
  // Solo cuentan los nodos que están en alguna ruta del origen al destino.
  const relevant = new Set([...fromOrigin].filter((k) => toDestination.has(k)));
  const ignored = [...display.keys()].filter((k) => !relevant.has(k)).map((k) => display.get(k)!);
  const outR = (k: string) => (out.get(k) ?? []).filter((a) => relevant.has(key(a.to)));
  const inR = (k: string) => (into.get(k) ?? []).filter((a) => relevant.has(key(a.from)));

  // Orden topológico (Kahn) y nivel de cada nodo = arcos del camino más largo desde el origen.
  const indegree = new Map([...relevant].map((k) => [k, inR(k).length]));
  const queue = [key(origin)];
  const order: string[] = [];
  while (queue.length > 0) {
    const k = queue.shift()!;
    order.push(k);
    for (const arc of outR(k)) {
      const next = key(arc.to);
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (order.length < relevant.size) {
    const stuck = [...relevant].filter((k) => !order.includes(k)).map((k) => display.get(k)!);
    return fail(
      'cycle',
      `La red tiene un ciclo entre ${stuck.join(', ')}. La programación dinámica por etapas necesita una red sin ciclos.`,
    );
  }
  const level = new Map<string, number>([[key(origin), 0]]);
  for (const k of order) {
    for (const arc of outR(k)) {
      const next = key(arc.to);
      level.set(next, Math.max(level.get(next) ?? 0, level.get(k)! + 1));
    }
  }
  const stages = level.get(key(destination))!;
  const nodesAt = (l: number) => order.filter((k) => level.get(k) === l);
  const name = (k: string) => display.get(k)!;

  const backward = input.recursion === 'reversa';
  const notices: Notice[] = [];
  if (ignored.length > 0) {
    notices.push({
      level: 'info',
      message: `${ignored.length === 1 ? 'Se ignora el nodo' : 'Se ignoran los nodos'} ${ignored.join(', ')}: no ${ignored.length === 1 ? 'está' : 'están'} en ninguna ruta de ${origin} a ${destination}.`,
    });
  }

  const steps: Step[] = [
    {
      title: 'Etapas, estados y alternativas',
      explanation: backward
        ? `La red se divide en ${stages} etapas. En la etapa n, el estado s es el nodo donde se está y la alternativa x es el siguiente nodo. Se empieza por la última etapa y se retrocede hasta el origen (recursión en reversa).`
        : `La red se divide en ${stages} etapas. En la etapa i, el estado es el nodo al que se llega y la alternativa, el nodo desde el que se llega. Se empieza desde el origen y se avanza hasta el destino (recursión en avance).`,
      formula: backward
        ? 'f_n^*(s) = \\min_{x_n} \\left\\{ c_{s,x_n} + f_{n+1}^*(x_n) \\right\\}, \\qquad f^*(\\text{destino}) = 0'
        : 'f_i(x_i) = \\min_{x_{i-1}} \\left\\{ d(x_{i-1}, x_i) + f_{i-1}(x_{i-1}) \\right\\}, \\qquad f_0(\\text{origen}) = 0',
      result: latexLines(
        Array.from({ length: stages + 1 }, (_, l) => {
          const label = backward ? `\\text{Etapa } ${l + 1}` : `\\text{Nivel } ${l}`;
          return `${label}:\\ ${nodesAt(l)
            .map((k) => t(name(k)))
            .join(',\\ ')}`;
        }),
      ),
    },
  ];

  const f = new Map<string, number>();
  const choice = new Map<string, string[]>();
  const tables: ResultTable[] = [];

  if (backward) {
    // f*_{n}(s) con n = nivel + 1; el destino está en la etapa N + 1.
    f.set(key(destination), 0);
    for (let l = stages - 1; l >= 0; l--) {
      const stage = l + 1;
      const states = nodesAt(l);
      const decisionKeys = [...new Set(states.flatMap((s) => outR(s).map((a) => key(a.to))))];
      const decisions = order.filter((k) => decisionKeys.includes(k));
      const rows: StageRow[] = [];
      const children: Step[] = [];
      for (const s of states) {
        const options = outR(s).sort((a, b) => order.indexOf(key(a.to)) - order.indexOf(key(b.to)));
        const values = options.map((a) => a.distance + f.get(key(a.to))!);
        const best = argOptimum('min', values);
        const bestValue = values[best[0]!]!;
        f.set(s, bestValue);
        choice.set(
          s,
          best.map((k) => key(options[k]!.to)),
        );
        rows.push({
          state: name(s),
          values: new Map(options.map((a, k) => [key(a.to), values[k]!])),
          best: bestValue,
          argBest: best.map((k) => name(key(options[k]!.to))),
        });
        const next = (a: Arc) => `f_{${level.get(key(a.to))! + 1}}^*(${t(a.to)})`;
        children.push({
          title: `Estado ${name(s)}`,
          formula: `f_{${stage}}^*(${t(name(s))}) = ${
            options.length === 1
              ? `c_{${t(name(s))},${t(options[0]!.to)}} + ${next(options[0]!)}`
              : `\\min\\{${options.map((a) => `c_{${t(name(s))},${t(a.to)}} + ${next(a)}`).join(',\\ ')}\\}`
          }`,
          substitution: `f_{${stage}}^*(${t(name(s))}) = ${
            options.length === 1
              ? `${n(options[0]!.distance)} + ${n(f.get(key(options[0]!.to))!)}`
              : `\\min\\{${options.map((a) => `${n(a.distance)} + ${n(f.get(key(a.to))!)}`).join(',\\ ')}\\} = ${optimumLatex('min', values)}`
          }`,
          result: `f_{${stage}}^*(${t(name(s))}) = ${n(bestValue)}, \\qquad x_{${stage}}^* = ${best.map((k) => t(options[k]!.to)).join('\\ \\text{o}\\ ')}`,
        });
      }
      steps.push({
        title: `Etapa ${stage}`,
        explanation:
          l === stages - 1
            ? 'Desde cada estado de la última etapa se llega al destino; f* es la distancia de ese tramo.'
            : 'Para cada estado se suma la distancia del tramo y la distancia mínima que ya se conoce desde el nodo siguiente hasta el destino, y se toma la menor.',
        children,
      });
      tables.push(
        stageTable({
          id: `etapa-${stage}`,
          title: `Etapa ${stage}: costo de cada alternativa desde cada estado`,
          stateHeader: 's',
          decisions: decisions.map((k) => ({ key: k, header: `x = ${t(name(k))}` })),
          rows,
          bestHeader: `f_{${stage}}^*(s)`,
          argHeader: `x_{${stage}}^*`,
        }),
      );
    }
  } else {
    f.set(key(origin), 0);
    for (let l = 1; l <= stages; l++) {
      const states = nodesAt(l);
      const decisionKeys = [...new Set(states.flatMap((x) => inR(x).map((a) => key(a.from))))];
      const decisions = order.filter((k) => decisionKeys.includes(k));
      const rows: StageRow[] = [];
      const children: Step[] = [];
      for (const x of states) {
        const options = inR(x).sort(
          (a, b) => order.indexOf(key(a.from)) - order.indexOf(key(b.from)),
        );
        const values = options.map((a) => a.distance + f.get(key(a.from))!);
        const best = argOptimum('min', values);
        const bestValue = values[best[0]!]!;
        f.set(x, bestValue);
        choice.set(
          x,
          best.map((k) => key(options[k]!.from)),
        );
        rows.push({
          state: name(x),
          values: new Map(options.map((a, k) => [key(a.from), values[k]!])),
          best: bestValue,
          argBest: best.map((k) => name(key(options[k]!.from))),
        });
        const previous = (a: Arc) => `f_{${level.get(key(a.from))!}}(${t(a.from)})`;
        children.push({
          title: `Nodo ${name(x)}`,
          formula: `f_{${l}}(${t(name(x))}) = ${
            options.length === 1
              ? `d(${t(options[0]!.from)}, ${t(name(x))}) + ${previous(options[0]!)}`
              : `\\min\\{${options.map((a) => `d(${t(a.from)}, ${t(name(x))}) + ${previous(a)}`).join(',\\ ')}\\}`
          }`,
          substitution: `f_{${l}}(${t(name(x))}) = ${
            options.length === 1
              ? `${n(options[0]!.distance)} + ${n(f.get(key(options[0]!.from))!)}`
              : `\\min\\{${options.map((a) => `${n(a.distance)} + ${n(f.get(key(a.from))!)}`).join(',\\ ')}\\} = ${optimumLatex('min', values)}`
          }`,
          result: `f_{${l}}(${t(name(x))}) = ${n(bestValue)} \\quad (\\text{desde } ${best.map((k) => t(options[k]!.from)).join('\\ \\text{o}\\ ')})`,
        });
      }
      steps.push({
        title: `Etapa ${l}`,
        explanation:
          l === 1
            ? 'Distancia más corta desde el origen a cada nodo de la primera etapa.'
            : 'Para cada nodo se suma la distancia más corta ya conocida hasta el nodo anterior y la del tramo que falta, y se toma la menor.',
        children,
      });
      tables.push(
        stageTable({
          id: `etapa-${l}`,
          title: `Etapa ${l}: distancia desde el origen por cada nodo anterior`,
          stateHeader: `x_{${l}}`,
          decisions: decisions.map((k) => ({ key: k, header: `s = ${t(name(k))}` })),
          rows,
          bestHeader: `f_{${l}}(x_{${l}})`,
          argHeader: `x_{${l - 1}}^*`,
        }),
      );
    }
  }

  // ── Rutas óptimas: se siguen las decisiones óptimas (todas, si hay empates) ──
  const routes: string[][] = [];
  const walk = (path: string[]) => {
    if (routes.length >= MAX_ROUTES) return;
    const last = path.at(-1)!;
    const end = backward ? key(destination) : key(origin);
    if (last === end) {
      routes.push((backward ? path : [...path].reverse()).map(name));
      return;
    }
    for (const next of choice.get(last) ?? []) walk([...path, next]);
  };
  walk([backward ? key(origin) : key(destination)]);
  const distance = backward ? f.get(key(origin))! : f.get(key(destination))!;

  steps.push({
    title: routes.length > 1 ? 'Rutas óptimas' : 'Ruta óptima',
    explanation: backward
      ? 'Se parte del origen y se sigue en cada etapa la decisión óptima x* del estado en que se está.'
      : 'Se parte del destino y se retrocede por el nodo desde el que se llegó con la distancia mínima.',
    result: latexLines(routes.map((r) => `${r.map(t).join(' \\to ')} \\quad (${n(distance)})`)),
  });
  if (routes.length > 1) {
    notices.push({
      level: 'info',
      message: `Hay ${routes.length} rutas óptimas${routes.length >= MAX_ROUTES ? ` (se muestran las primeras ${MAX_ROUTES})` : ''}, todas con distancia ${distance}: ${routes.map((r) => r.join(' → ')).join('; ')}.`,
    });
  }

  return {
    ok: true,
    value: {
      distance,
      routes,
      f: Object.fromEntries([...f.entries()].map(([k, v]) => [name(k), v])),
      stages,
    },
    summary: [
      { label: 'Distancia mínima', value: n(distance), emphasis: true },
      {
        label: routes.length > 1 ? 'Rutas óptimas' : 'Ruta óptima',
        value: latexLines(routes.map((r) => r.map(t).join(' \\to '))),
      },
      { label: 'Etapas', value: `${stages}` },
    ],
    ...emptyTrace(),
    steps,
    notices,
    tables,
  };
}

export const shortestRoute: Calculator<
  ShortestRouteInput,
  ShortestRouteValue,
  ShortestRouteErrorCode
> = {
  meta: {
    id: 'ruta-mas-corta-pd',
    title: 'Ruta más corta por programación dinámica',
    summary: 'Recursión en reversa o en avance sobre una red por etapas.',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 10.1, problema de la diligencia (9.ª ed. en inglés)',
      },
      {
        sourceId: 'taha',
        locator: 'Ejemplos 10.1-1 (en avance) y 10.2-1 (en reversa), 8.ª ed. en inglés',
      },
      { sourceId: 'winston-1994' },
    ],
  },
  inputSchema: shortestRouteInputSchema,
  // Hillier & Lieberman, figura 10.1: problema de la diligencia (costo de la póliza de seguro de
  // cada tramo, de Missouri (A) a California (J)).
  example: {
    arcs: [
      { from: 'A', to: 'B', distance: 2 },
      { from: 'A', to: 'C', distance: 4 },
      { from: 'A', to: 'D', distance: 3 },
      { from: 'B', to: 'E', distance: 7 },
      { from: 'B', to: 'F', distance: 4 },
      { from: 'B', to: 'G', distance: 6 },
      { from: 'C', to: 'E', distance: 3 },
      { from: 'C', to: 'F', distance: 2 },
      { from: 'C', to: 'G', distance: 4 },
      { from: 'D', to: 'E', distance: 4 },
      { from: 'D', to: 'F', distance: 1 },
      { from: 'D', to: 'G', distance: 5 },
      { from: 'E', to: 'H', distance: 1 },
      { from: 'E', to: 'I', distance: 4 },
      { from: 'F', to: 'H', distance: 6 },
      { from: 'F', to: 'I', distance: 3 },
      { from: 'G', to: 'H', distance: 3 },
      { from: 'G', to: 'I', distance: 3 },
      { from: 'H', to: 'J', distance: 3 },
      { from: 'I', to: 'J', distance: 4 },
    ],
    origin: 'A',
    destination: 'J',
    recursion: 'reversa',
  },
  solve: solveShortestRoute,
};
