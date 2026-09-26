/**
 * Método gráfico para modelos de dos variables (Taha, sec. 2.2; Hillier & Lieberman, cap. 3):
 *
 * 1. Cada restricción se dibuja como la recta a₁x₁ + a₂x₂ = b y se elige el semiplano que la
 *    cumple (se prueba con el origen, o con (1, 1) si la recta pasa por él).
 * 2. Los vértices de la región factible son las intersecciones de dos rectas (restricciones o
 *    ejes) que cumplen todas las restricciones.
 * 3. Si hay óptimo, está en un vértice: se evalúa z en cada uno. Si dos vértices empatan, todo el
 *    lado que los une es óptimo (soluciones múltiples).
 *
 * Si la región es no acotada, el solucionador simplex decide si z mejora sin límite.
 */
import { Rational } from '@/lib/math/rational';
import { emptyTrace, type Calculator, type CalculatorResult, type Series } from '../types';
import {
  linearLatex,
  relationLatex,
  variableLatex,
  type LinearProgram,
  type Relation,
} from './lp-model';
import { parseForSolve, solveLpSilently, type LpInput } from './lp-solve';
import { lpInputSchema } from './simplex';

export interface GraphVertex {
  label: string;
  x: number;
  y: number;
  z: number;
  /** Coordenadas exactas en texto: 3, 1.5, 2/3. */
  exact: [string, string];
}

export interface GraphicalValue {
  z: number;
  zExact: string;
  x: number;
  y: number;
  vertices: GraphVertex[];
  /** Hay más de un vértice óptimo: todo el lado que los une es óptimo. */
  multiple: boolean;
}

export type GraphicalErrorCode = 'invalid-model' | 'not-two-variables' | 'infeasible' | 'unbounded';

type Result = CalculatorResult<GraphicalValue, GraphicalErrorCode>;

interface Line {
  a: Rational;
  b: Rational;
  c: Rational;
  /** Nombre corto: R1, eje x₁… */
  label: string;
  latex: string;
}

interface Point {
  x: Rational;
  y: Rational;
}

const key = (p: Point) => `${p.x.toString()},${p.y.toString()}`;
const pointLatex = (p: Point) => `(${p.x.toLatex()},\\ ${p.y.toLatex()})`;

function intersect(l1: Line, l2: Line): Point | null {
  const det = l1.a.mul(l2.b).sub(l2.a.mul(l1.b));
  if (det.isZero()) return null;
  return {
    x: l1.c.mul(l2.b).sub(l2.c.mul(l1.b)).div(det),
    y: l1.a.mul(l2.c).sub(l2.a.mul(l1.c)).div(det),
  };
}

function satisfies(lhs: Rational, relation: Relation, rhs: Rational): boolean {
  const c = lhs.cmp(rhs);
  return relation === '<=' ? c <= 0 : relation === '>=' ? c >= 0 : c === 0;
}

function feasible(
  lp: LinearProgram,
  p: Point,
  extra: { a: Rational; b: Rational; c: Rational }[] = [],
) {
  if (p.x.sign() < 0 || p.y.sign() < 0) return false;
  const inConstraints = lp.constraints.every((k) =>
    satisfies(k.coefficients[0]!.mul(p.x).add(k.coefficients[1]!.mul(p.y)), k.relation, k.rhs),
  );
  return inConstraints && extra.every((k) => k.a.mul(p.x).add(k.b.mul(p.y)).cmp(k.c) <= 0);
}

/** Vértices de la región definida por el modelo (y cotas extra), con las rectas que los forman. */
function vertices(
  lp: LinearProgram,
  lines: Line[],
  extra: { a: Rational; b: Rational; c: Rational }[] = [],
): { point: Point; lines: Line[] }[] {
  const found = new Map<string, { point: Point; lines: Line[] }>();
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const p = intersect(lines[i]!, lines[j]!);
      if (!p || !feasible(lp, p, extra)) continue;
      const k = key(p);
      const entry = found.get(k) ?? { point: p, lines: [] };
      for (const l of [lines[i]!, lines[j]!]) if (!entry.lines.includes(l)) entry.lines.push(l);
      found.set(k, entry);
    }
  return [...found.values()];
}

/** Ordena puntos de un polígono convexo por ángulo alrededor de su centroide. */
function orderConvex<T extends { point: Point }>(items: T[]): T[] {
  if (items.length < 3) return items;
  const cx = items.reduce((s, v) => s + v.point.x.toNumber(), 0) / items.length;
  const cy = items.reduce((s, v) => s + v.point.y.toNumber(), 0) / items.length;
  const angle = (v: T) => Math.atan2(v.point.y.toNumber() - cy, v.point.x.toNumber() - cx);
  const sorted = [...items].sort((a, b) => angle(a) - angle(b));
  // Se empieza por el vértice más cercano al origen (antihorario), como en los libros.
  const size = (v: T) => v.point.x.add(v.point.y);
  let start = 0;
  sorted.forEach((v, i) => {
    const best = sorted[start]!;
    if (size(v).lt(size(best)) || (size(v).eq(size(best)) && v.point.x.lt(best.point.x))) start = i;
  });
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

/** Tramo de la recta ax + by = c dentro de [0, X] × [0, Y], o `null` si no cruza la ventana. */
function clip(line: { a: number; b: number; c: number }, X: number, Y: number) {
  const { a, b, c } = line;
  const eps = 1e-9 * Math.max(X, Y);
  const pts: { x: number; y: number }[] = [];
  if (b !== 0) {
    for (const x of [0, X]) pts.push({ x, y: (c - a * x) / b });
  }
  if (a !== 0) {
    for (const y of [0, Y]) pts.push({ x: (c - b * y) / a, y });
  }
  const inside = pts
    .filter((p) => p.x >= -eps && p.x <= X + eps && p.y >= -eps && p.y <= Y + eps)
    .sort((p, q) => p.x - q.x || p.y - q.y);
  if (inside.length < 2) return null;
  const first = inside[0]!;
  const last = inside.at(-1)!;
  if (Math.hypot(last.x - first.x, last.y - first.y) <= eps) return null;
  // Una recta vertical tendría dos puntos con el mismo x: se inclina lo mínimo para dibujarla.
  if (last.x === first.x) return [first, { ...last, x: last.x + eps }];
  return [first, last];
}

export function solveGraphical(input: LpInput): Result {
  const parsed = parseForSolve(input);
  if (!parsed.ok) {
    const failure = parsed.result;
    return {
      ok: false,
      error: { code: 'invalid-model', message: failure.ok ? '' : failure.error.message },
      ...emptyTrace(),
    };
  }
  const { lp, trace } = parsed;
  if (lp.variables.length !== 2) {
    return {
      ok: false,
      error: {
        code: 'not-two-variables',
        message: `El método gráfico necesita exactamente dos variables; el modelo tiene ${lp.variables.length}. Usa el método simplex.`,
      },
      ...emptyTrace(),
      ...trace,
    };
  }
  const [vx, vy] = lp.variables.map(variableLatex) as [string, string];
  const zero = Rational.ZERO;
  const one = Rational.ONE;

  // ── Rectas ──────────────────────────────────────────────────────────────
  const constraintLines: Line[] = lp.constraints.map((k, i) => ({
    a: k.coefficients[0]!,
    b: k.coefficients[1]!,
    c: k.rhs,
    label: `R${i + 1}`,
    latex: `${linearLatex(k.coefficients, [vx, vy])} = ${k.rhs.toLatex()}`,
  }));
  const axes: Line[] = [
    { a: one, b: zero, c: zero, label: `eje ${lp.variables[1]}`, latex: `${vx} = 0` },
    { a: zero, b: one, c: zero, label: `eje ${lp.variables[0]}`, latex: `${vy} = 0` },
  ];
  const lines = [...constraintLines, ...axes];

  trace.steps.push({
    title: 'Graficar las restricciones',
    explanation:
      'Cada restricción se dibuja como una recta (con signo =) y se conserva el semiplano que la cumple. Para saber cuál, se prueba un punto que no esté sobre la recta.',
    children: lp.constraints.map((k, i) => {
      const line = constraintLines[i]!;
      const cuts: string[] = [];
      if (!line.a.isZero()) cuts.push(`(${line.c.div(line.a).toLatex()},\\ 0)`);
      if (!line.b.isZero()) cuts.push(`(0,\\ ${line.c.div(line.b).toLatex()})`);
      const test: Point = line.c.isZero() ? { x: one, y: one } : { x: zero, y: zero };
      const lhs = line.a.mul(test.x).add(line.b.mul(test.y));
      const holds = satisfies(lhs, k.relation, k.rhs);
      return {
        title: `R${i + 1}: ${k.relation === '=' ? 'recta' : `semiplano ${k.relation === '<=' ? '≤' : '≥'}`}`,
        substitution: `${line.latex} \\quad \\text{corta los ejes en } ${cuts.join(' \\text{ y } ')}`,
        result:
          k.relation === '='
            ? '\\text{La región factible está sobre la recta.}'
            : `${pointLatex(test)}:\\ ${lhs.toLatex()} ${relationLatex[k.relation]} ${k.rhs.toLatex()} \\ \\text{es ${holds ? 'verdadero' : 'falso'}: la región ${holds ? 'contiene' : 'no contiene'} ese punto}`,
      };
    }),
  });

  // ── Vértices ────────────────────────────────────────────────────────────
  const found = orderConvex(vertices(lp, lines));
  const labelled = found.map((v, i) => ({ ...v, label: String.fromCharCode(65 + (i % 26)) }));
  const zOf = (p: Point) => lp.objective[0]!.mul(p.x).add(lp.objective[1]!.mul(p.y));

  // Ventana de la gráfica: abarca los vértices y los cortes con los ejes, con un margen.
  const coordinates = [
    ...labelled.flatMap((v) => [v.point.x.toNumber(), v.point.y.toNumber()]),
    ...constraintLines.flatMap((l) => [
      l.a.isZero() ? 0 : l.c.div(l.a).toNumber(),
      l.b.isZero() ? 0 : l.c.div(l.b).toNumber(),
    ]),
  ].filter((v) => Number.isFinite(v) && v > 0);
  const extent = Math.max(1, ...coordinates) * 1.2;
  const [X, Y] = [extent, extent];

  const series = (bestZ: Rational | null, highlightLabel: string): Series => {
    const box = [
      { a: one, b: zero, c: Rational.fromNumber(X) },
      { a: zero, b: one, c: Rational.fromNumber(Y) },
    ];
    const boxLines: Line[] = box.map((b, i) => ({ ...b, label: `box${i}`, latex: '' }));
    const polygon = orderConvex(vertices(lp, [...lines, ...boxLines], box));
    const xs = [...new Set(polygon.map((v) => v.point.x.toNumber()))].sort((a, b) => a - b);
    const numeric = polygon.map((v) => ({ x: v.point.x.toNumber(), y: v.point.y.toNumber() }));
    const band = xs.map((x) => {
      const ys: number[] = [];
      numeric.forEach((p, i) => {
        const q = numeric[(i + 1) % numeric.length]!;
        if (p.x === q.x) {
          if (p.x === x) ys.push(p.y, q.y);
        } else if ((p.x - x) * (q.x - x) <= 0) {
          ys.push(p.y + ((x - p.x) * (q.y - p.y)) / (q.x - p.x));
        }
      });
      return { x, low: Math.min(...ys), high: Math.max(...ys) };
    });
    const objective = { a: lp.objective[0]!.toNumber(), b: lp.objective[1]!.toNumber() };
    const zLine =
      clip(
        { ...objective, c: bestZ?.toNumber() ?? objective.a * (X / 2) + objective.b * (Y / 2) },
        X,
        Y,
      ) ?? [];
    return {
      id: 'grafico',
      title: `Región factible, restricciones y recta de z (${highlightLabel})`,
      xLabel: lp.variables[0]!,
      yLabel: lp.variables[1]!,
      label: bestZ === null ? 'z' : `z = ${bestZ.toText()}`,
      points: zLine,
      region: polygon.length >= 3 ? { label: 'Región factible', points: band } : undefined,
      others: constraintLines.flatMap((l) => {
        const seg = clip({ a: l.a.toNumber(), b: l.b.toNumber(), c: l.c.toNumber() }, X, Y);
        return seg ? [{ label: l.label, points: seg }] : [];
      }),
    };
  };

  if (labelled.length === 0) {
    trace.steps.push({
      title: 'Región factible',
      explanation:
        'Ningún punto cumple todas las restricciones a la vez (ninguna intersección de rectas es factible): los semiplanos no tienen una zona común.',
    });
    return {
      ok: false,
      error: {
        code: 'infeasible',
        message:
          'Problema infactible: la región factible está vacía; ningún punto cumple todas las restricciones.',
      },
      ...emptyTrace(),
      ...trace,
      series: [series(null, 'sin región factible')],
    };
  }

  trace.steps.push({
    title: 'Vértices de la región factible',
    explanation:
      'Cada vértice es la intersección de dos rectas (restricciones o ejes) que además cumple todas las restricciones. Se resuelve el sistema de dos ecuaciones de cada par.',
    children: labelled.map((v) => {
      const [l1, l2] = v.lines as [Line, Line];
      return {
        title: `Vértice ${v.label}: ${v.lines.map((l) => l.label).join(' ∩ ')}`,
        substitution: `\\begin{cases} ${l1.latex} \\\\ ${l2.latex} \\end{cases}`,
        result: `${v.label} = ${pointLatex(v.point)}`,
      };
    }),
  });

  const zValues = labelled.map((v) => zOf(v.point));
  const best = zValues.reduce((b, z) => (lp.sense === 'max' ? (z.gt(b) ? z : b) : z.lt(b) ? z : b));
  const optimal = labelled.filter((_, i) => zValues[i]!.eq(best));
  const objectiveLatex = linearLatex(lp.objective, [vx, vy]);
  trace.steps.push({
    title: 'Evaluar z en cada vértice',
    explanation: `Si el problema tiene óptimo, se alcanza en un vértice: se toma el de ${lp.sense === 'max' ? 'mayor' : 'menor'} valor de z.`,
    formula: `z = ${objectiveLatex}`,
    substitution: labelled
      .map((v, i) => `z(${v.label}) = ${zValues[i]!.toLatex()}`)
      .join(',\\quad '),
    result: `z^* = ${best.toLatex()} \\ \\text{en } ${optimal.map((v) => v.label).join(',\\ ')}`,
  });

  const vertexRows = labelled.map((v, i) => ({
    vertex: v.label,
    lines: v.lines.map((l) => l.label).join(' ∩ '),
    x: v.point.x.toLatex(),
    y: v.point.y.toLatex(),
    z: zValues[i]!.toLatex(),
    optimal: optimal.includes(v) ? 'Sí' : '',
  }));
  const tables = [
    {
      id: 'vertices',
      title: 'Vértices de la región factible',
      columns: [
        { key: 'vertex', header: '\\text{Vértice}', format: 'text' as const },
        { key: 'lines', header: '\\text{Rectas}', format: 'text' as const },
        { key: 'x', header: vx, format: 'latex' as const },
        { key: 'y', header: vy, format: 'latex' as const },
        { key: 'z', header: 'z', format: 'latex' as const },
        { key: 'optimal', header: '\\text{¿Óptimo?}', format: 'text' as const },
      ],
      rows: vertexRows,
    },
  ];

  // La región puede ser no acotada: el simplex decide si z mejora sin límite.
  const status = solveLpSilently(lp).status;
  if (status === 'unbounded') {
    trace.steps.push({
      title: 'Tipo de solución: no acotada',
      explanation: `La región factible es no acotada en la dirección en que z ${lp.sense === 'max' ? 'aumenta' : 'disminuye'}: la recta de z se puede desplazar sin salir de la región. Los vértices no dan el óptimo.`,
    });
    return {
      ok: false,
      error: {
        code: 'unbounded',
        message: `Solución no acotada: z ${lp.sense === 'max' ? 'crece' : 'decrece'} sin límite dentro de la región factible.`,
      },
      ...emptyTrace(),
      ...trace,
      tables,
      series: [series(best, 'no acotada')],
    };
  }

  const multiple = optimal.length > 1;
  const point = optimal[0]!.point;
  trace.steps.push({
    title: multiple ? 'Tipo de solución: óptimos múltiples' : 'Tipo de solución: óptimo único',
    explanation: multiple
      ? `La recta de z es paralela al lado ${optimal.map((v) => v.label).join('')} de la región: todos los puntos de ese lado dan z = ${best.toText()}.`
      : 'La recta de z toca la región en un solo vértice.',
    result: multiple
      ? `z^* = ${best.toLatex()} \\ \\text{en todo el segmento } ${optimal.map((v) => `${v.label} = ${pointLatex(v.point)}`).join(' \\text{ a } ')}`
      : `${vx} = ${point.x.toLatex()},\\ ${vy} = ${point.y.toLatex()},\\quad z^* = ${best.toLatex()}`,
  });

  return {
    ok: true,
    value: {
      z: best.toNumber(),
      zExact: best.toText(),
      x: point.x.toNumber(),
      y: point.y.toNumber(),
      vertices: labelled.map((v, i) => ({
        label: v.label,
        x: v.point.x.toNumber(),
        y: v.point.y.toNumber(),
        z: zValues[i]!.toNumber(),
        exact: [v.point.x.toText(), v.point.y.toText()],
      })),
      multiple,
    },
    summary: [
      { label: 'Valor óptimo', value: `z^* = ${best.toLatex()}`, emphasis: true },
      {
        label: multiple ? 'Soluciones (extremos del segmento)' : 'Solución',
        value: optimal.map((v) => `${v.label} = ${pointLatex(v.point)}`).join(',\\ '),
      },
      { label: 'Vértices de la región', value: String(labelled.length) },
    ],
    ...emptyTrace(),
    ...trace,
    tables,
    series: [series(best, multiple ? 'óptimos múltiples' : 'óptimo')],
  };
}

export const graphical: Calculator<LpInput, GraphicalValue, GraphicalErrorCode> = {
  meta: {
    id: 'metodo-grafico',
    title: 'Método gráfico',
    summary: 'Resuelve un modelo de dos variables sobre el plano y clasifica la solución.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 2.2, Ejemplos 2.2-1 (Reddy Mikks) y 2.2-2 (dieta), 9.ª ed. en inglés',
      },
      { sourceId: 'taha', locator: 'Sec. 3.5, casos especiales (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
    ],
  },
  inputSchema: lpInputSchema,
  // Taha, ejemplo 2.2-1: modelo de Reddy Mikks.
  example: {
    sense: 'max',
    objective: '5x1 + 4x2',
    constraints: '6x1 + 4x2 <= 24\nx1 + 2x2 <= 6\n-x1 + x2 <= 1\nx2 <= 2',
  },
  solve: solveGraphical,
};
