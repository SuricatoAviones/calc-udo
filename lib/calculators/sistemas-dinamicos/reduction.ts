/**
 * Reducción de un diagrama de bloques con el álgebra de bloques (Ogata, 3.ª ed., tabla 3-1 y
 * ejemplo 3-1), sobre su flujograma equivalente. Cada operación es una regla de la tabla:
 *
 *   - bloques en cascada:      G₁ y G₂ en serie → G₁G₂
 *   - bloques en paralelo:     G₁ y G₂ entre las mismas señales → G₁ + G₂
 *   - lazo de realimentación:  una señal que se realimenta a sí misma con ganancia de lazo L
 *                              → cada bloque que llega a ella se divide entre (1 − L); con
 *                              realimentación negativa L = −GH y queda G/(1 + GH)
 *   - mover un punto suma o de bifurcación: una señal intermedia que recibe o reparte varias
 *     ramas desaparece y sus ramas se combinan de dos en dos (producto de las ganancias).
 *
 * El resultado se compara con la fórmula de Mason, que da la misma función con el numerador y el
 * denominador desarrollados.
 */
import type { Step } from '../types';
import { chainTex, mason, mergeParallel, nodeTex, type Sfg, type SfgBranch } from './signal-flow';
import {
  FR_ONE,
  frConst,
  frDiv,
  frEquivalent,
  frMul,
  frOperandTex,
  frSub,
  frTex,
  type FRat,
} from './symbolic';

const MAX_STEPS = 80;

export interface ReductionResult {
  transfer: FRat;
  /** La forma de Mason (numerador y Δ desarrollados), si difiere de la reducción. */
  canonical: FRat;
  steps: Step[];
}

export type ReductionOutcome =
  { ok: true; result: ReductionResult } | { ok: false; message: string; steps: Step[] };

function reach(graph: Sfg, start: string, forward: boolean): Set<string> {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const u = stack.pop()!;
    for (const b of graph.branches) {
      const [a, c] = forward ? [b.from, b.to] : [b.to, b.from];
      if (a === u && !seen.has(c)) {
        seen.add(c);
        stack.push(c);
      }
    }
  }
  return seen;
}

const branchTex = (b: SfgBranch) => String.raw`${nodeTex(b.from)} \to ${nodeTex(b.to)}`;

/** ¿La ganancia es +1 o −1 (una entrada de un punto suma)? */
function isUnit(f: FRat): boolean {
  return Math.abs(f.coef) === 1 && f.mono.length === 0 && f.factors.length === 0;
}

/** Quita las señales que no están en ningún camino de la entrada a la salida. */
function pruneUseless(
  original: Sfg,
  input: string,
  output: string,
  steps: Step[],
): Sfg | { message: string } {
  const g: Sfg = { nodes: [...original.nodes], branches: [...original.branches] };
  const fromInput = reach(g, input, true);
  const toOutput = reach(g, output, false);
  const useful = new Set(g.nodes.filter((n) => fromInput.has(n) && toOutput.has(n)));
  const dropped = g.nodes.filter((n) => !useful.has(n));
  if (!useful.has(output)) {
    return { message: `La salida ${output} no depende de la entrada ${input}.` };
  }
  if (dropped.length === 0) return g;
  const plural = dropped.length > 1 ? 'n' : '';
  steps.push({
    title: 'Señales que no influyen',
    explanation: `${dropped.join(', ')} no está${plural} en ningún camino de ${input} a ${output}: se descartan con sus bloques.`,
  });
  return {
    nodes: g.nodes.filter((n) => useful.has(n)),
    branches: g.branches.filter((b) => useful.has(b.from) && useful.has(b.to)),
  };
}

/** 1. Bloques en paralelo: se suman. */
function parallelStep(g: Sfg, steps: Step[]): Sfg | null {
  const { graph: merged, merged: pairs } = mergeParallel(g);
  if (pairs.length === 0) return null;
  for (const p of pairs) {
    steps.push({
      title: 'Bloques en paralelo',
      explanation: `Hay ${p.parts.length} bloques de ${p.from} a ${p.to}: sus salidas se suman.`,
      formula: 'G_a + G_b',
      substitution: p.parts.map(frOperandTex).join(' + ').replaceAll('+ -', '- '),
      result: String.raw`${nodeTex(p.from)} \to ${nodeTex(p.to)}:\ ${frTex(p.total)}`,
    });
  }
  return merged;
}

/** 2. Lazos de una señal sobre sí misma: realimentación. */
function feedbackStep(g: Sfg, steps: Step[]): Sfg | null {
  const self = g.branches.find((b) => b.from === b.to);
  if (!self) return null;
  const node = self.to;
  const L = self.gain;
  const factor = frSub(frConst(1), L);
  const incoming = g.branches.filter((b) => b.to === node && b.from !== node);
  const updated = incoming.map((b) => ({ ...b, gain: frDiv(b.gain, factor) }));
  steps.push({
    title: `Eliminación del lazo de realimentación en ${node}`,
    explanation: `La señal ${node} vuelve sobre sí misma: la ganancia de lazo L es el producto de los bloques del lazo con el signo del punto suma. Cada bloque que llega a ${node} se divide entre 1 − L (con realimentación negativa, L = −GH y queda G/(1 + GH)).`,
    formula: String.raw`\frac{G}{1 - L}`,
    substitution: String.raw`L = ${frTex(L)},\quad 1 - L = ${frTex(factor)}`,
    children: updated.map((b, i) => ({
      title: `Bloque ${b.from} → ${b.to}`,
      formula: String.raw`\frac{${frTex(incoming[i]!.gain)}}{${frTex(factor)}}`,
      result: String.raw`${branchTex(b)}:\ ${frTex(b.gain)}`,
    })),
  });
  return {
    nodes: g.nodes,
    branches: [
      ...g.branches.filter((b) => b !== self && !(b.to === node && b.from !== node)),
      ...updated,
    ],
  };
}

/** Una sola rama de entrada y una de salida, y alguna de las dos es ±1. */
function isDirect(g: Sfg, n: string): boolean {
  const ins = g.branches.filter((b) => b.to === n);
  const outs = g.branches.filter((b) => b.from === n);
  return ins.length === 1 && outs.length === 1 && (isUnit(ins[0]!.gain) || isUnit(outs[0]!.gain));
}

/**
 * 3. Conexiones directas: una señal que entra o sale por una rama ±1 (el signo de un punto suma) y
 * no se ramifica se une a la siguiente sin cambiar nada más.
 */
function directStep(g: Sfg, candidates: string[], steps: Step[]): Sfg | null {
  const trivial = candidates.filter((n) => isDirect(g, n));
  if (trivial.length === 0) return null;
  let current = g;
  const children: Step[] = [];
  for (const node of trivial) {
    const ins = current.branches.filter((b) => b.to === node);
    const outs = current.branches.filter((b) => b.from === node);
    const a = ins[0];
    const c = outs[0];
    if (ins.length !== 1 || outs.length !== 1 || !a || !c || a.from === node) continue;
    if (!isUnit(a.gain) && !isUnit(c.gain)) continue;
    const joined: SfgBranch = { from: a.from, to: c.to, gain: frMul(a.gain, c.gain) };
    children.push({
      title: chainTex([a.from, node, c.to]),
      result: String.raw`${branchTex(joined)}:\ ${frTex(joined.gain)}`,
    });
    current = {
      nodes: current.nodes.filter((n) => n !== node),
      branches: [...current.branches.filter((b) => b !== a && b !== c), joined],
    };
  }
  steps.push({
    title: 'Conexiones directas',
    explanation:
      'Cada señal que solo une un bloque con un punto suma (o un punto suma con un bloque) se elimina: el bloque queda conectado directamente y toma el signo de esa entrada del punto suma.',
    children,
  });
  return current;
}

/** Nombre de la regla de la tabla 3-1 que elimina la señal y su explicación. */
function eliminationText(
  node: string,
  ins: SfgBranch[],
  outs: SfgBranch[],
): { title: string; explanation: string } {
  if (ins.length === 1 && outs.length === 1) {
    return {
      title: 'Bloques en cascada',
      explanation: `La señal ${node} solo pasa de un bloque al siguiente: los dos bloques en serie se multiplican.`,
    };
  }
  if (outs.length === 1 && isUnit(outs[0]!.gain)) {
    return {
      title: `Puntos suma consecutivos (señal ${node})`,
      explanation: `La señal ${node} sale de un punto suma y entra directamente a otro: los dos puntos suma se combinan en uno y cada entrada conserva su signo.`,
    };
  }
  if (ins.length === 1) {
    return {
      title: `Punto de bifurcación movido (señal ${node})`,
      explanation: `La señal ${node} se reparte a ${outs.length} bloques. Se mueve el punto de bifurcación antes del bloque que la produce: cada rama queda multiplicada por ese bloque.`,
    };
  }
  if (outs.length === 1) {
    return {
      title: `Punto suma movido (señal ${node})`,
      explanation: `La señal ${node} suma ${ins.length} ramas y pasa a un solo bloque. Se mueve el punto suma después de ese bloque: cada rama que llega queda multiplicada por él.`,
    };
  }
  return {
    title: `Eliminación de la señal ${node}`,
    explanation: `La señal ${node} recibe ${ins.length} ramas y se reparte a ${outs.length}: se mueven a la vez su punto suma y su punto de bifurcación, y cada par de ramas que pasaba por ${node} se reemplaza por el producto de sus ganancias.`,
  };
}

/** 4. Se elimina la señal más barata: cada par de ramas que pasaba por ella se multiplica. */
function eliminationStep(g: Sfg, candidates: string[], steps: Step[]): Sfg {
  const score = (n: string) => {
    const ins = g.branches.filter((b) => b.to === n).length;
    const outs = g.branches.filter((b) => b.from === n).length;
    return { n, ins, outs, cost: ins === 1 && outs === 1 ? 0 : ins * outs };
  };
  const choice = candidates.map(score).sort((a, b) => a.cost - b.cost)[0]!;
  const node = choice.n;
  const ins = g.branches.filter((b) => b.to === node);
  const outs = g.branches.filter((b) => b.from === node);
  const created: SfgBranch[] = [];
  for (const a of ins)
    for (const b of outs) created.push({ from: a.from, to: b.to, gain: frMul(a.gain, b.gain) });

  const { title, explanation } = eliminationText(node, ins, outs);
  const merging = outs.length === 1 && isUnit(outs[0]!.gain);
  steps.push({
    title,
    explanation,
    formula: merging ? undefined : String.raw`G_a\,G_b`,
    children: created.map((b, k) => {
      const a = ins[Math.floor(k / outs.length)]!;
      const c = outs[k % outs.length]!;
      return {
        title: `${chainTex([a.from, node, c.to])}`,
        substitution: merging
          ? undefined
          : String.raw`${frOperandTex(a.gain)}\,${frOperandTex(c.gain)}`,
        result: String.raw`${branchTex(b)}:\ ${frTex(b.gain)}`,
      };
    }),
  });
  return {
    nodes: g.nodes.filter((n) => n !== node),
    branches: [...g.branches.filter((b) => b.to !== node && b.from !== node), ...created],
  };
}

/** Reduce el flujograma entre `input` y `output` y devuelve la traza. */
export function reduceDiagram(original: Sfg, input: string, output: string): ReductionOutcome {
  const steps: Step[] = [];
  // Lo que no está en un camino de la entrada a la salida no influye en C/R.
  const pruned = pruneUseless(original, input, output, steps);
  if ('message' in pruned) return { ok: false, message: pruned.message, steps };
  let g = pruned;
  let source = input;
  if (g.branches.some((b) => b.to === input)) {
    source = `${input}'`;
    g = {
      nodes: [source, ...g.nodes],
      branches: [{ from: source, to: input, gain: FR_ONE }, ...g.branches],
    };
  }

  const keep = new Set([source, output]);
  for (let guard = 0; guard < MAX_STEPS; guard++) {
    const next = parallelStep(g, steps) ?? feedbackStep(g, steps);
    if (next) {
      g = next;
      continue;
    }
    const candidates = g.nodes.filter((n) => !keep.has(n));
    if (candidates.length === 0) break;
    g = directStep(g, candidates, steps) ?? eliminationStep(g, candidates, steps);
  }

  const finalBranch = g.branches.find((b) => b.from === source && b.to === output);
  if (!finalBranch || g.nodes.some((n) => !keep.has(n))) {
    return { ok: false, message: 'No se pudo reducir el diagrama a un solo bloque.', steps };
  }
  const transfer = finalBranch.gain;

  // Comparación con la forma desarrollada de Mason.
  const m = mason(original, input, output);
  let canonical = transfer;
  if (m.ok) {
    canonical = m.result.transfer;
    if (!frEquivalent(transfer, canonical)) {
      return { ok: false, message: 'La reducción no coincide con la fórmula de Mason.', steps };
    }
  }
  return { ok: true, result: { transfer, canonical, steps } };
}
