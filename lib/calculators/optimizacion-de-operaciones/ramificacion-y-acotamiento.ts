/**
 * Ramificación y acotamiento para programación entera pura o mixta (Taha, sec. 8.2.1; Hillier &
 * Lieberman, cap. 12). Cada nodo resuelve la relajación lineal con las cotas acumuladas:
 *
 * - Si es infactible, o su z no mejora la mejor solución entera encontrada (la cota), se poda.
 * - Si todas las variables enteras toman valores enteros, es candidata y actualiza la cota.
 * - Si no, se ramifica en la primera variable entera fraccionaria xⱼ = v:
 *   xⱼ ≤ ⌊v⌋ y xⱼ ≥ ⌊v⌋ + 1 (se explora primero la rama ≤, en profundidad).
 *
 * Las variables binarias se modelan como enteras con la restricción xⱼ ≤ 1.
 */
import { z } from 'zod';
import { Rational } from '@/lib/math/rational';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import {
  lpInputShape,
  parseLinearProgram,
  refineLp,
  variableLatex,
  type LinearProgram,
  type LpConstraint,
} from './lp-model';
import { invalidModelMessage, parseForSolve, solveLpSilently } from './lp-solve';
import { TEX } from '@/lib/math/format';

const MAX_NODES = 60;

export const branchAndBoundInputSchema = z
  .object({
    ...lpInputShape,
    integers: z.string().max(300, 'La lista es demasiado larga.'),
  })
  .superRefine((v, ctx) => {
    refineLp(v, ctx);
    const parsed = parseLinearProgram(v.sense, v.objective, v.constraints);
    if (!parsed.ok) return;
    const unknown = integerNames(v.integers).find((n) => !parsed.lp.variables.includes(n));
    if (unknown) {
      ctx.addIssue({
        code: 'custom',
        path: ['integers'],
        message: `«${unknown}» no es una variable del modelo.`,
      });
    }
  });

export type BranchAndBoundInput = z.infer<typeof branchAndBoundInputSchema>;

function integerNames(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((t) => t.trim().replaceAll('_', ''))
    .filter(Boolean);
}

export type NodeOutcome = 'infactible' | 'entera' | 'podado' | 'ramificado';

export interface BranchNode {
  id: number;
  parent: number | null;
  /** Cotas agregadas en este nodo y sus ancestros, en LaTeX. */
  bounds: string[];
  outcome: NodeOutcome;
  z: number | null;
  x: number[] | null;
}

export interface BranchAndBoundValue {
  z: number;
  variables: Record<string, number>;
  relaxation: number;
  nodes: BranchNode[];
}

export type BranchAndBoundErrorCode =
  'invalid-model' | 'unbounded' | 'infeasible' | 'too-many-nodes';

type Result = CalculatorResult<BranchAndBoundValue, BranchAndBoundErrorCode>;

interface Bound {
  variable: number;
  relation: '<=' | '>=';
  value: Rational;
}

function withBounds(lp: LinearProgram, bounds: Bound[]): LinearProgram {
  const extra: LpConstraint[] = bounds.map((b) => ({
    coefficients: lp.variables.map((_, j) => (j === b.variable ? Rational.ONE : Rational.ZERO)),
    relation: b.relation,
    rhs: b.value,
  }));
  return { ...lp, constraints: [...lp.constraints, ...extra] };
}

const OUTCOME_TEXT: Record<NodeOutcome, string> = {
  entera: 'Entera (candidata)',
  podado: 'Podado por la cota',
  infactible: 'Infactible',
  ramificado: 'Se ramifica',
};

/** Estado de la búsqueda en profundidad del árbol. */
interface Search {
  lp: LinearProgram;
  integer: number[];
  vars: string[];
  nodes: BranchNode[];
  /** Solución exacta de cada nodo, para la tabla. */
  exact: { x: Rational[] | null; z: Rational | null }[];
  nodeSteps: Step[];
  incumbent: { z: Rational; x: Rational[] } | null;
  relaxation: Rational | null;
  stack: { bounds: Bound[]; parent: number | null }[];
}

function boundTex(b: Bound, vars: string[]): string {
  return `${vars[b.variable]} ${b.relation === '<=' ? TEX.le : TEX.ge} ${b.value.toLatex()}`;
}

function pointTex(x: Rational[], vars: string[]): string {
  return x.map((v, j) => `${vars[j]} = ${v.toLatex()}`).join(String.raw`,\ `);
}

/** «Nodo 2: x1 ≤ 3, x2 ≥ 1» o «Nodo 0 (relajación lineal)». */
function nodeTitle(id: number, bounds: Bound[], variables: string[]): string {
  if (bounds.length === 0) return `Nodo ${id} (relajación lineal)`;
  const list = bounds
    .map((b) => `${variables[b.variable]} ${b.relation === '<=' ? '≤' : '≥'} ${b.value.toText()}`)
    .join(', ');
  return `Nodo ${id}: ${list}`;
}

/** ¿z mejora la cota de la mejor solución entera? (Mayor al maximizar, menor al minimizar). */
function improves(z: Rational, bound: Rational, sense: LinearProgram['sense']): boolean {
  const direction = sense === 'max' ? 1 : -1;
  return direction * z.cmp(bound) > 0;
}

/**
 * Resuelve la relajación del siguiente nodo de la pila y lo poda, lo acepta como candidato o
 * ramifica. Devuelve el título del nodo si la relajación inicial es no acotada.
 */
function visitNode(s: Search): string | null {
  const { lp, vars } = s;
  const { bounds, parent } = s.stack.pop()!;
  const id = s.nodes.length;
  const solved = solveLpSilently(withBounds(lp, bounds));
  const title = nodeTitle(id, bounds, lp.variables);
  const boundsText = bounds.map((b) => boundTex(b, vars));

  if (solved.status === 'unbounded' && id === 0) return title;
  if (solved.status !== 'optimal') {
    s.nodes.push({ id, parent, bounds: boundsText, outcome: 'infactible', z: null, x: null });
    s.exact.push({ x: null, z: null });
    s.nodeSteps.push({
      title,
      explanation: 'La relajación con estas cotas no tiene solución: el nodo se poda.',
    });
    return null;
  }
  if (id === 0) s.relaxation = solved.z;
  s.exact.push({ x: solved.x, z: solved.z });
  const fractional = s.integer.find((j) => !solved.x[j]!.isInteger());
  const base = {
    id,
    parent,
    bounds: boundsText,
    z: solved.z.toNumber(),
    x: solved.x.map((v) => v.toNumber()),
  };
  const solution = String.raw`${pointTex(solved.x, vars)},\quad z = ${solved.z.toLatex()}`;

  const current = s.incumbent;
  if (current !== null && !improves(solved.z, current.z, lp.sense)) {
    s.nodes.push({ ...base, outcome: 'podado' });
    s.nodeSteps.push({
      title,
      substitution: solution,
      explanation: `z = ${solved.z.toText()} no es mejor que la cota z = ${current.z.toText()} de la mejor solución entera: el nodo se poda (ninguna rama suya puede mejorarla).`,
    });
    return null;
  }
  if (fractional === undefined) {
    s.incumbent = { z: solved.z, x: solved.x };
    s.nodes.push({ ...base, outcome: 'entera' });
    s.nodeSteps.push({
      title,
      substitution: solution,
      explanation: `Todas las variables enteras tienen valor entero: es una solución candidata y la nueva cota es z = ${solved.z.toText()}.`,
    });
    return null;
  }
  const value = solved.x[fractional]!;
  const floor = value.floor();
  const ceil = floor.add(Rational.ONE);
  const name = lp.variables[fractional];
  s.nodes.push({ ...base, outcome: 'ramificado' });
  s.nodeSteps.push({
    title,
    substitution: solution,
    explanation: `${name} = ${value.toText()} no es entera: se ramifica con ${name} ≤ ${floor.toText()} y ${name} ≥ ${ceil.toText()}.`,
    result: String.raw`${vars[fractional]} \le ${floor.toLatex()} \quad \text{o} \quad ${vars[fractional]} \ge ${ceil.toLatex()}`,
  });
  s.stack.push(
    { bounds: [...bounds, { variable: fractional, relation: '>=', value: ceil }], parent: id },
    { bounds: [...bounds, { variable: fractional, relation: '<=', value: floor }], parent: id },
  );
  return null;
}

function nodesTable(s: Search) {
  return {
    id: 'nodos',
    title: 'Nodos explorados',
    columns: [
      { key: 'node', header: String.raw`\text{Nodo}` },
      { key: 'parent', header: String.raw`\text{Padre}` },
      { key: 'bounds', header: String.raw`\text{Cotas}`, format: 'latex' as const },
      { key: 'solution', header: String.raw`\text{Solución}`, format: 'latex' as const },
      { key: 'z', header: 'z', format: 'latex' as const },
      { key: 'outcome', header: String.raw`\text{Resultado}`, format: 'text' as const },
    ],
    rows: s.nodes.map((n) => {
      const { x, z } = s.exact[n.id]!;
      return {
        node: n.id,
        parent: n.parent,
        bounds: n.bounds.length > 0 ? n.bounds.join(String.raw`,\ `) : String.raw`\text{—}`,
        solution: x ? pointTex(x, s.vars) : String.raw`\text{—}`,
        z: z?.toLatex() ?? String.raw`\text{—}`,
        outcome: OUTCOME_TEXT[n.outcome],
      };
    }),
  };
}

export function solveBranchAndBound(input: BranchAndBoundInput): Result {
  const parsed = parseForSolve(input);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'invalid-model', message: invalidModelMessage(parsed.result) },
      ...emptyTrace(),
    };
  }
  const { lp, trace } = parsed;
  const names = integerNames(input.integers);
  const integer =
    names.length === 0 ? lp.variables.map((_, j) => j) : names.map((n) => lp.variables.indexOf(n));
  const vars = lp.variables.map(variableLatex);
  trace.steps.push({
    title: 'Variables enteras',
    explanation:
      integer.length === lp.variables.length
        ? 'Programación entera pura: todas las variables deben ser enteras.'
        : 'Programación entera mixta: solo estas variables deben ser enteras; las demás pueden tomar valores fraccionarios.',
    result: integer.map((j) => vars[j]).join(String.raw`,\ `) + String.raw`\ \in \mathbb{Z}`,
  });

  const search: Search = {
    lp,
    integer,
    vars,
    nodes: [],
    exact: [],
    nodeSteps: [],
    incumbent: null,
    relaxation: null,
    stack: [{ bounds: [], parent: null }],
  };

  while (search.stack.length > 0) {
    if (search.nodes.length >= MAX_NODES) {
      trace.steps.push(...search.nodeSteps);
      return {
        ok: false,
        error: {
          code: 'too-many-nodes',
          message: `Se exploraron ${MAX_NODES} nodos sin terminar. El árbol es muy grande para resolverlo a mano.`,
        },
        ...emptyTrace(),
        ...trace,
      };
    }
    const unboundedTitle = visitNode(search);
    if (unboundedTitle !== null) {
      trace.steps.push({
        title: unboundedTitle,
        explanation: 'La relajación lineal es no acotada.',
      });
      return {
        ok: false,
        error: {
          code: 'unbounded',
          message:
            'La relajación lineal es no acotada: ramificación y acotamiento necesita un modelo acotado.',
        },
        ...emptyTrace(),
        ...trace,
      };
    }
  }

  const { nodes, nodeSteps, relaxation } = search;
  trace.steps.push({
    title: 'Árbol de ramificación',
    explanation:
      'Cada nodo resuelve la relajación lineal (sin exigir enteros) con las cotas de su rama. Se exploran en profundidad, primero la rama ≤.',
    children: nodeSteps,
  });
  const tables = [nodesTable(search)];
  const pointLatex = (x: Rational[]) => pointTex(x, vars);

  const best = search.incumbent;
  if (best === null) {
    return {
      ok: false,
      error: {
        code: 'infeasible',
        message: 'El modelo no tiene ninguna solución entera factible.',
      },
      ...emptyTrace(),
      ...trace,
      tables,
    };
  }
  trace.steps.push({
    title: 'Solución entera óptima',
    explanation: 'Ya no quedan nodos por explorar: la mejor solución candidata es la óptima.',
    result: String.raw`${pointLatex(best.x)},\quad z^* = ${best.z.toLatex()}`,
  });
  return {
    ok: true,
    value: {
      z: best.z.toNumber(),
      variables: Object.fromEntries(lp.variables.map((v, j) => [v, best.x[j]!.toNumber()])),
      relaxation: relaxation!.toNumber(),
      nodes,
    },
    summary: [
      { label: 'Valor óptimo entero', value: `z^* = ${best.z.toLatex()}`, emphasis: true },
      { label: 'Solución', value: pointLatex(best.x) },
      { label: 'Relajación lineal', value: `z = ${relaxation!.toLatex()}` },
      { label: 'Nodos explorados', value: String(nodes.length) },
    ],
    ...emptyTrace(),
    ...trace,
    tables,
  };
}

export const branchAndBound: Calculator<
  BranchAndBoundInput,
  BranchAndBoundValue,
  BranchAndBoundErrorCode
> = {
  meta: {
    id: 'ramificacion-y-acotamiento',
    title: 'Ramificación y acotamiento',
    summary: 'Resuelve modelos enteros puros o mixtos explorando un árbol de subproblemas.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 8.2.1, Ejemplo 8.2-1 (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'gould-eppen-schmidt' },
    ],
  },
  inputSchema: branchAndBoundInputSchema,
  // Taha, ejemplo 8.2-1.
  example: {
    sense: 'max',
    objective: '5x1 + 4x2',
    constraints: 'x1 + x2 <= 5\n10x1 + 6x2 <= 45',
    integers: '',
  },
  solve: solveBranchAndBound,
};
