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
import { parseForSolve, solveLpSilently } from './lp-solve';

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
    .map((t) => t.trim().replace(/_/g, ''))
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

export function solveBranchAndBound(input: BranchAndBoundInput): Result {
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
  const names = integerNames(input.integers);
  const integer =
    names.length === 0 ? lp.variables.map((_, j) => j) : names.map((n) => lp.variables.indexOf(n));
  const vars = lp.variables.map(variableLatex);
  const max = lp.sense === 'max';
  trace.steps.push({
    title: 'Variables enteras',
    explanation:
      integer.length === lp.variables.length
        ? 'Programación entera pura: todas las variables deben ser enteras.'
        : 'Programación entera mixta: solo estas variables deben ser enteras; las demás pueden tomar valores fraccionarios.',
    result: integer.map((j) => vars[j]).join(',\\ ') + '\\ \\in \\mathbb{Z}',
  });

  const boundLatex = (b: Bound) =>
    `${vars[b.variable]} ${b.relation === '<=' ? '\\le' : '\\ge'} ${b.value.toLatex()}`;
  const pointLatex = (x: Rational[]) => x.map((v, j) => `${vars[j]} = ${v.toLatex()}`).join(',\\ ');

  const nodes: BranchNode[] = [];
  /** Solución exacta de cada nodo, para la tabla. */
  const exact: { x: Rational[] | null; z: Rational | null }[] = [];
  const nodeSteps: Step[] = [];
  let incumbent: { z: Rational; x: Rational[] } | null = null;
  let relaxation: Rational | null = null;
  const stack: { bounds: Bound[]; parent: number | null }[] = [{ bounds: [], parent: null }];

  while (stack.length > 0) {
    if (nodes.length >= MAX_NODES) {
      trace.steps.push(...nodeSteps);
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
    const { bounds, parent } = stack.pop()!;
    const id = nodes.length;
    const solved = solveLpSilently(withBounds(lp, bounds));
    const title = `Nodo ${id}${bounds.length > 0 ? `: ${bounds.map((b) => `${lp.variables[b.variable]} ${b.relation === '<=' ? '≤' : '≥'} ${b.value.toText()}`).join(', ')}` : ' (relajación lineal)'}`;
    const boundsText = bounds.map(boundLatex);

    if (solved.status === 'unbounded' && id === 0) {
      trace.steps.push({ title, explanation: 'La relajación lineal es no acotada.' });
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
    if (solved.status !== 'optimal') {
      nodes.push({ id, parent, bounds: boundsText, outcome: 'infactible', z: null, x: null });
      exact.push({ x: null, z: null });
      nodeSteps.push({
        title,
        explanation: 'La relajación con estas cotas no tiene solución: el nodo se poda.',
      });
      continue;
    }
    if (id === 0) relaxation = solved.z;
    exact.push({ x: solved.x, z: solved.z });
    const fractional = integer.find((j) => !solved.x[j]!.isInteger());
    const base = {
      id,
      parent,
      bounds: boundsText,
      z: solved.z.toNumber(),
      x: solved.x.map((v) => v.toNumber()),
    };
    const solution = `${pointLatex(solved.x)},\\quad z = ${solved.z.toLatex()}`;

    const current = incumbent as { z: Rational; x: Rational[] } | null;
    const noBetter =
      current !== null && (max ? solved.z.cmp(current.z) <= 0 : solved.z.cmp(current.z) >= 0);
    if (noBetter) {
      nodes.push({ ...base, outcome: 'podado' });
      nodeSteps.push({
        title,
        substitution: solution,
        explanation: `z = ${solved.z.toText()} no es mejor que la cota z = ${current!.z.toText()} de la mejor solución entera: el nodo se poda (ninguna rama suya puede mejorarla).`,
      });
      continue;
    }
    if (fractional === undefined) {
      incumbent = { z: solved.z, x: solved.x };
      nodes.push({ ...base, outcome: 'entera' });
      nodeSteps.push({
        title,
        substitution: solution,
        explanation: `Todas las variables enteras tienen valor entero: es una solución candidata y la nueva cota es z = ${solved.z.toText()}.`,
      });
      continue;
    }
    const value = solved.x[fractional]!;
    const floor = value.floor();
    nodes.push({ ...base, outcome: 'ramificado' });
    nodeSteps.push({
      title,
      substitution: solution,
      explanation: `${lp.variables[fractional]} = ${value.toText()} no es entera: se ramifica con ${lp.variables[fractional]} ≤ ${floor.toText()} y ${lp.variables[fractional]} ≥ ${floor.add(Rational.ONE).toText()}.`,
      result: `${vars[fractional]} \\le ${floor.toLatex()} \\quad \\text{o} \\quad ${vars[fractional]} \\ge ${floor.add(Rational.ONE).toLatex()}`,
    });
    stack.push(
      {
        bounds: [
          ...bounds,
          { variable: fractional, relation: '>=', value: floor.add(Rational.ONE) },
        ],
        parent: id,
      },
      { bounds: [...bounds, { variable: fractional, relation: '<=', value: floor }], parent: id },
    );
  }

  trace.steps.push({
    title: 'Árbol de ramificación',
    explanation:
      'Cada nodo resuelve la relajación lineal (sin exigir enteros) con las cotas de su rama. Se exploran en profundidad, primero la rama ≤.',
    children: nodeSteps,
  });
  const tables = [
    {
      id: 'nodos',
      title: 'Nodos explorados',
      columns: [
        { key: 'node', header: '\\text{Nodo}' },
        { key: 'parent', header: '\\text{Padre}' },
        { key: 'bounds', header: '\\text{Cotas}', format: 'latex' as const },
        { key: 'solution', header: '\\text{Solución}', format: 'latex' as const },
        { key: 'z', header: 'z', format: 'latex' as const },
        { key: 'outcome', header: '\\text{Resultado}', format: 'text' as const },
      ],
      rows: nodes.map((n) => ({
        node: n.id,
        parent: n.parent,
        bounds: n.bounds.length > 0 ? n.bounds.join(',\\ ') : '\\text{—}',
        solution: exact[n.id]!.x ? pointLatex(exact[n.id]!.x!) : '\\text{—}',
        z: exact[n.id]!.z?.toLatex() ?? '\\text{—}',
        outcome:
          n.outcome === 'entera'
            ? 'Entera (candidata)'
            : n.outcome === 'podado'
              ? 'Podado por la cota'
              : n.outcome === 'infactible'
                ? 'Infactible'
                : 'Se ramifica',
      })),
    },
  ];

  const best = incumbent as { z: Rational; x: Rational[] } | null;
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
    result: `${pointLatex(best.x)},\\quad z^* = ${best.z.toLatex()}`,
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
