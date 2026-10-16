/**
 * Gráficas de flujo de señal (flujogramas) y fórmula de ganancia de Mason (Kuo, 7.ª ed.,
 * sec. 3-7 a 3-9):
 *
 *   M = y_sal/y_ent = Σ_k M_k Δ_k / Δ
 *   Δ = 1 − Σ L_i + Σ L_iL_j − Σ L_iL_jL_k + …   (productos de lazos que no se tocan)
 *
 * Δ_k es Δ de la parte del flujograma que no toca la trayectoria directa k.
 *
 * Los nodos se identifican por su nombre (`R`, `x1`, `E`…) y las ganancias son expresiones
 * simbólicas (`symbolic.ts`). Las ramas en paralelo se suman antes de buscar trayectorias.
 */
import { toLatexText } from '@/lib/math/format';
import type { ResultTable, Step } from '../types';
import {
  FR_ONE,
  FR_ZERO,
  frAdd,
  frDiv,
  frMul,
  frNeg,
  frOperandTex,
  frTex,
  frToUnivariate,
  symbolTex,
  SymbolicError,
  type FRat,
} from './symbolic';

export const MAX_NODES = 30;
const MAX_PATHS = 120;
const MAX_LOOPS = 120;
const MAX_COMBINATIONS = 4000;

export interface SfgBranch {
  from: string;
  to: string;
  gain: FRat;
}

export interface Sfg {
  nodes: string[];
  branches: SfgBranch[];
}

export interface Chain {
  nodes: string[];
  gain: FRat;
}

/** Nombre de nodo en LaTeX: `x1` → `x_{1}`, `R` → `R`; los nombres libres van como texto. */
export function nodeTex(name: string): string {
  if (/^[A-Za-z]+_?\d*$/.test(name)) return symbolTex(name);
  return toLatexText(name);
}

/** `R \to x_{1} \to C`. */
export function chainTex(nodes: string[]): string {
  return nodes.map(nodeTex).join(' \\to ');
}

/** Suma las ramas con el mismo origen y destino. Devuelve también los pares sumados. */
export function mergeParallel(graph: Sfg): {
  graph: Sfg;
  merged: { from: string; to: string; parts: FRat[]; total: FRat }[];
} {
  const groups = new Map<string, SfgBranch[]>();
  for (const b of graph.branches) {
    const key = `${b.from}\u0001${b.to}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const branches: SfgBranch[] = [];
  const merged: { from: string; to: string; parts: FRat[]; total: FRat }[] = [];
  for (const group of groups.values()) {
    const total = group.reduce<FRat>((acc, b) => frAdd(acc, b.gain), FR_ZERO);
    if (group.length > 1) {
      merged.push({
        from: group[0]!.from,
        to: group[0]!.to,
        parts: group.map((b) => b.gain),
        total,
      });
    }
    if (total.coef !== 0) branches.push({ from: group[0]!.from, to: group[0]!.to, gain: total });
  }
  return { graph: { nodes: graph.nodes, branches }, merged };
}

function adjacency(graph: Sfg): Map<string, SfgBranch[]> {
  const out = new Map<string, SfgBranch[]>(graph.nodes.map((n) => [n, []]));
  for (const b of graph.branches) out.get(b.from)?.push(b);
  return out;
}

class LimitError extends Error {}

/** Trayectorias directas (sin repetir nodos) de `input` a `output`. */
export function forwardPaths(graph: Sfg, input: string, output: string): Chain[] {
  const adj = adjacency(graph);
  const paths: Chain[] = [];
  const visit = (node: string, nodes: string[], gain: FRat, seen: Set<string>) => {
    if (node === output) {
      paths.push({ nodes, gain });
      if (paths.length > MAX_PATHS) throw new LimitError();
      return;
    }
    for (const b of adj.get(node) ?? []) {
      if (seen.has(b.to)) continue;
      seen.add(b.to);
      visit(b.to, [...nodes, b.to], frMul(gain, b.gain), seen);
      seen.delete(b.to);
    }
  };
  visit(input, [input], FR_ONE, new Set([input]));
  return paths;
}

/**
 * Lazos individuales: cada ciclo se busca desde su nodo de menor índice, recorriendo solo nodos
 * de índice mayor, así que aparece una sola vez.
 */
export function loopsOf(graph: Sfg): Chain[] {
  const index = new Map(graph.nodes.map((n, i) => [n, i]));
  const adj = adjacency(graph);
  const loops: Chain[] = [];
  graph.nodes.forEach((start, i) => {
    const visit = (node: string, nodes: string[], gain: FRat, seen: Set<string>) => {
      for (const b of adj.get(node) ?? []) {
        const j = index.get(b.to)!;
        if (b.to === start) {
          loops.push({ nodes: [...nodes, start], gain: frMul(gain, b.gain) });
          if (loops.length > MAX_LOOPS) throw new LimitError();
          continue;
        }
        if (j < i || seen.has(b.to)) continue;
        seen.add(b.to);
        visit(b.to, [...nodes, b.to], frMul(gain, b.gain), seen);
        seen.delete(b.to);
      }
    };
    visit(start, [start], FR_ONE, new Set([start]));
  });
  return loops;
}

function touches(a: string[], b: string[]): boolean {
  const set = new Set(a);
  return b.some((n) => set.has(n));
}

/** Combinaciones de 2 o más lazos que no se tocan entre sí (índices en `loops`). */
export function nonTouchingCombinations(loops: Chain[], allowed?: number[]): number[][] {
  const candidates = allowed ?? loops.map((_, i) => i);
  const combos: number[][] = [];
  const extend = (combo: number[], used: Set<string>, from: number) => {
    for (let k = from; k < candidates.length; k++) {
      const idx = candidates[k]!;
      const loop = loops[idx]!;
      if (loop.nodes.some((n) => used.has(n))) continue;
      const next = [...combo, idx];
      if (next.length >= 2) {
        combos.push(next);
        if (combos.length > MAX_COMBINATIONS) throw new LimitError();
      }
      const nextUsed = new Set(used);
      for (const n of loop.nodes) nextUsed.add(n);
      extend(next, nextUsed, k + 1);
    }
  };
  extend([], new Set(), 0);
  return combos;
}

const subL = (i: number) => `L_{${i + 1}}`;

/** Δ = 1 − ΣL + ΣLL − … sobre los lazos permitidos, con su fórmula y sustitución. */
function determinant(
  loops: Chain[],
  allowed: number[],
): { value: FRat; symbolic: string; substitution: string; combos: number[][] } {
  const combos = nonTouchingCombinations(loops, allowed);
  let value: FRat = FR_ONE;
  const symbolicParts = ['1'];
  const substitutionParts = ['1'];
  const singles = allowed.map((i) => ({ combo: [i], gain: loops[i]!.gain }));
  const byOrder = new Map<number, { combo: number[]; gain: FRat }[]>([[1, singles]]);
  for (const combo of combos) {
    const gain = combo.reduce<FRat>((acc, i) => frMul(acc, loops[i]!.gain), FR_ONE);
    byOrder.set(combo.length, [...(byOrder.get(combo.length) ?? []), { combo, gain }]);
  }
  for (const [order, items] of [...byOrder.entries()].sort((a, b) => a[0] - b[0])) {
    if (items.length === 0) continue;
    const sign = order % 2 === 1 ? -1 : 1;
    const sum = items.reduce<FRat>((acc, x) => frAdd(acc, x.gain), FR_ZERO);
    value = frAdd(value, sign === 1 ? sum : frNeg(sum));
    const op = sign === 1 ? '+' : '-';
    symbolicParts.push(
      `${op} \\left(${items.map((x) => x.combo.map(subL).join('')).join(' + ')}\\right)`,
    );
    substitutionParts.push(
      `${op} \\left(${items
        .map((x) =>
          x.combo.length === 1
            ? frTex(x.gain)
            : x.combo.map((i) => frOperandTex(loops[i]!.gain)).join(''),
        )
        .join(' + ')}\\right)`,
    );
  }
  return {
    value,
    symbolic: symbolicParts.join(' '),
    substitution: substitutionParts.join(' ').replace(/\+ -/g, '- '),
    combos,
  };
}

export type MasonErrorCode =
  | 'flujograma-vacio'
  | 'nodo-inexistente'
  | 'entrada-igual-a-salida'
  | 'sin-trayectoria'
  | 'flujograma-muy-grande'
  | 'ganancia-invalida';

export interface MasonResult {
  paths: Chain[];
  loops: Chain[];
  combos: number[][];
  delta: FRat;
  cofactors: FRat[];
  numerator: FRat;
  transfer: FRat;
  /** M(s) como cociente de polinomios si las ganancias solo dependen de s. */
  rational: { num: number[]; den: number[] } | null;
  steps: Step[];
  tables: ResultTable[];
}

export type MasonOutcome =
  | { ok: true; result: MasonResult }
  | { ok: false; code: MasonErrorCode; message: string; steps: Step[]; tables: ResultTable[] };

/**
 * Fórmula de ganancia de Mason entre `input` y `output`. Si el nodo de entrada recibe ramas, se
 * agrega un nodo fuente con una rama de ganancia 1 (la fórmula solo vale desde un nodo de entrada).
 */
export function mason(graph: Sfg, input: string, output: string, ratioTex?: string): MasonOutcome {
  const steps: Step[] = [];
  const tables: ResultTable[] = [];
  const fail = (code: MasonErrorCode, message: string): MasonOutcome => ({
    ok: false,
    code,
    message,
    steps,
    tables,
  });
  if (graph.branches.length === 0) return fail('flujograma-vacio', 'El flujograma no tiene ramas.');
  if (!graph.nodes.includes(input)) {
    return fail('nodo-inexistente', `El nodo de entrada «${input}» no está en el flujograma.`);
  }
  if (!graph.nodes.includes(output)) {
    return fail('nodo-inexistente', `El nodo de salida «${output}» no está en el flujograma.`);
  }
  if (input === output) {
    return fail('entrada-igual-a-salida', 'El nodo de entrada y el de salida deben ser distintos.');
  }
  if (graph.nodes.length > MAX_NODES) {
    return fail('flujograma-muy-grande', `El flujograma admite como máximo ${MAX_NODES} nodos.`);
  }

  try {
    const { graph: g0, merged } = mergeParallel(graph);
    let g = g0;
    let source = input;
    if (merged.length > 0) {
      steps.push({
        title: 'Ramas en paralelo',
        explanation:
          'Las ramas que van del mismo nodo al mismo nodo se suman en una sola (sus señales llegan sumadas).',
        children: merged.map((m) => ({
          title: `${m.from} → ${m.to}`,
          result: `${m.parts.map(frOperandTex).join(' + ')} = ${frTex(m.total)}`.replace(
            /\+ -/g,
            '- ',
          ),
        })),
      });
    }
    if (g.branches.some((b) => b.to === input)) {
      source = `${input}'`;
      g = {
        nodes: [source, ...g.nodes],
        branches: [{ from: source, to: input, gain: FR_ONE }, ...g.branches],
      };
      steps.push({
        title: 'Nodo de entrada',
        explanation: `El nodo ${input} recibe ramas, así que no es un nodo de entrada. Se agrega el nodo ${source} con una rama de ganancia 1 hacia ${input}: la fórmula de Mason solo se aplica desde un nodo que no recibe ramas (Kuo, sec. 3-8).`,
      });
    }

    const paths = forwardPaths(g, source, output);
    const loops = loopsOf(g);
    const tex = ratioTex ?? `\\frac{${nodeTex(output)}}{${nodeTex(input)}}`;

    steps.push({
      title: 'Trayectorias directas',
      explanation:
        paths.length === 0
          ? `No hay ninguna trayectoria de ${input} a ${output}.`
          : 'Caminos de la entrada a la salida que no pasan dos veces por el mismo nodo; su ganancia es el producto de las ganancias de sus ramas.',
      children: paths.map((p, k) => ({
        title: `Trayectoria ${k + 1}`,
        formula: chainTex(p.nodes),
        result: `P_{${k + 1}} = ${frTex(p.gain)}`,
      })),
    });
    if (paths.length === 0) {
      return fail(
        'sin-trayectoria',
        `No hay ninguna trayectoria directa de ${input} a ${output}: la ganancia es 0.`,
      );
    }

    steps.push({
      title: 'Lazos individuales',
      explanation:
        loops.length === 0
          ? 'El flujograma no tiene lazos: Δ = 1.'
          : 'Caminos cerrados que empiezan y terminan en el mismo nodo sin repetir otro; su ganancia es el producto de sus ramas.',
      children: loops.map((l, i) => ({
        title: `Lazo ${i + 1}`,
        formula: chainTex(l.nodes),
        result: `${subL(i)} = ${frTex(l.gain)}`,
      })),
    });

    const all = loops.map((_, i) => i);
    const D = determinant(loops, all);
    if (loops.length > 1) {
      steps.push({
        title: 'Lazos que no se tocan',
        explanation:
          D.combos.length === 0
            ? 'Todos los lazos comparten algún nodo: no hay productos de lazos que no se tocan.'
            : 'Combinaciones de lazos que no comparten ningún nodo; sus productos entran en Δ con signos alternados.',
        children: D.combos.map((combo) => ({
          title: combo.map((i) => `L${i + 1}`).join(' · '),
          result: `${combo.map(subL).join('')} = ${frTex(combo.reduce<FRat>((acc, i) => frMul(acc, loops[i]!.gain), FR_ONE))}`,
        })),
      });
    }
    steps.push({
      title: 'Determinante del flujograma',
      formula: `\\Delta = ${D.symbolic}`,
      substitution: loops.length ? `\\Delta = ${D.substitution}` : undefined,
      result: `\\Delta = ${frTex(D.value)}`,
    });

    const cofactorSteps: Step[] = [];
    const cofactors: FRat[] = [];
    const pathRows: ResultTable['rows'] = [];
    paths.forEach((p, k) => {
      const free = all.filter((i) => !touches(p.nodes, loops[i]!.nodes));
      const Dk = determinant(loops, free);
      cofactors.push(Dk.value);
      cofactorSteps.push({
        title: `Δ${k + 1}`,
        explanation:
          free.length === 0
            ? `Todos los lazos tocan la trayectoria ${k + 1}.`
            : `Lazos que no tocan la trayectoria ${k + 1}: ${free.map((i) => `L${i + 1}`).join(', ')}.`,
        formula: free.length ? `\\Delta_{${k + 1}} = ${Dk.symbolic}` : undefined,
        result: `\\Delta_{${k + 1}} = ${frTex(Dk.value)}`,
      });
      pathRows.push({
        k: k + 1,
        nodos: chainTex(p.nodes),
        ganancia: frTex(p.gain),
        cofactor: frTex(Dk.value),
      });
    });
    steps.push({
      title: 'Cofactores de las trayectorias',
      explanation: 'Δ_k se calcula como Δ, pero solo con los lazos que no tocan la trayectoria k.',
      children: cofactorSteps,
    });

    const numerator = paths.reduce<FRat>(
      (acc, p, k) => frAdd(acc, frMul(p.gain, cofactors[k]!)),
      FR_ZERO,
    );
    const transfer = frDiv(numerator, D.value);
    steps.push({
      title: 'Fórmula de ganancia de Mason',
      formula: `${tex} = \\frac{\\sum_k P_k\\Delta_k}{\\Delta} = \\frac{${paths.map((_, k) => `P_{${k + 1}}\\Delta_{${k + 1}}`).join(' + ')}}{\\Delta}`,
      substitution: `${tex} = \\frac{${paths
        .map((p, k) => {
          const c = cofactors[k]!;
          const isOne = c.coef === 1 && c.mono.length === 0 && c.factors.length === 0;
          return isOne ? frTex(p.gain) : `${frOperandTex(p.gain)}${frOperandTex(c)}`;
        })
        .join(' + ')
        .replace(/\+ -/g, '- ')}}{${frTex(D.value)}}`,
      result: `${tex} = ${frTex(transfer)}`,
    });

    tables.push({
      id: 'trayectorias',
      title: 'Trayectorias directas',
      columns: [
        { key: 'k', header: 'k' },
        { key: 'nodos', header: '\\text{Nodos}', format: 'latex' },
        { key: 'ganancia', header: 'P_k', format: 'latex' },
        { key: 'cofactor', header: '\\Delta_k', format: 'latex' },
      ],
      rows: pathRows,
    });
    if (loops.length) {
      tables.push({
        id: 'lazos',
        title: 'Lazos individuales',
        columns: [
          { key: 'i', header: 'i' },
          { key: 'nodos', header: '\\text{Nodos}', format: 'latex' },
          { key: 'ganancia', header: 'L_i', format: 'latex' },
        ],
        rows: loops.map((l, i) => ({
          i: i + 1,
          nodos: chainTex(l.nodes),
          ganancia: frTex(l.gain),
        })),
      });
    }

    return {
      ok: true,
      result: {
        paths,
        loops,
        combos: D.combos,
        delta: D.value,
        cofactors,
        numerator,
        transfer,
        rational: frToUnivariate(transfer, 's'),
        steps,
        tables,
      },
    };
  } catch (error) {
    if (error instanceof LimitError) {
      return fail(
        'flujograma-muy-grande',
        'El flujograma tiene demasiadas trayectorias, lazos o combinaciones para mostrarlas paso a paso.',
      );
    }
    if (error instanceof SymbolicError) return fail('ganancia-invalida', error.message);
    throw error;
  }
}
