/**
 * Formulación y solución de las ecuaciones de estado de una red RLC con fuentes de cd.
 *
 * Formulación (Dorf y Svoboda, sec. 9.9; Hayt y Kemmerly; Bobrow): las variables de estado son
 * los voltajes de los capacitores y las corrientes de los inductores. Se elige un árbol normal
 * (fuentes de voltaje, capacitores, resistencias, inductores y fuentes de corriente, en ese orden
 * de preferencia): en una red propia todos los capacitores quedan en el árbol y todos los
 * inductores en el coárbol. La LCK del corte fundamental de cada capacitor da C·dv_C/dt = i_C y
 * la LVK del lazo fundamental de cada inductor da L·di_L/dt = v_L. Para eliminar las variables de
 * las resistencias se sustituye cada capacitor por una fuente de voltaje v_C y cada inductor por
 * una fuente de corriente i_L, y se resuelve la red resistiva (análisis nodal modificado) una vez
 * por variable o fuente con valor 1 y las demás en 0 (superposición): así i_C y v_L quedan como
 * combinaciones lineales de x y u, que son las filas de A y B.
 *
 * Solución: con fuentes de cd que actúan desde t = 0, X(s) = (sI − A)⁻¹[x(0) + B·u/s]. La inversa
 * (sI − A)⁻¹ = adj(sI − A)/det(sI − A) se obtiene con el algoritmo de Faddeev-LeVerrier y cada
 * X_k(s) se invierte por fracciones parciales.
 */
import { solveLinearSystem } from '@/lib/math/linear-algebra';
import { toLatexMatrix, toLatexNumber } from '@/lib/math/format';
import { snap, type Poly } from '@/lib/math/polynomials';
import type { Step } from '../types';
import {
  buildTopology,
  componentLabel,
  validateTopology,
  type CircuitComponent,
  type CircuitDocument,
  type CircuitTopology,
} from './circuit';
import { polyTex } from './laplace';
import { solveMna } from './mna';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);
export const MAX_STATES = 6;

export interface StateVariable {
  id: string;
  label: string;
  kind: 'capacitor' | 'inductor';
  /** C en F o L en H. */
  value: number;
  initial: number;
  /** `v_{C1}`, `i_{L1}`. */
  tex: string;
}

export interface InputSource {
  id: string;
  label: string;
  kind: 'voltage-source' | 'current-source';
  value: number;
  tex: string;
}

export interface StateSpaceModel {
  states: StateVariable[];
  inputs: InputSource[];
  A: number[][];
  B: number[][];
  u: number[];
  x0: number[];
  tree: string[];
  links: string[];
}

export type StateSpaceErrorCode =
  | 'sin-elementos-almacenadores'
  | 'demasiadas-variables'
  | 'valores-invalidos'
  | 'red-impropia'
  | 'circuito-invalido'
  | 'singular';

export type FormulationOutcome =
  | { ok: true; model: StateSpaceModel; steps: Step[] }
  | { ok: false; code: StateSpaceErrorCode; message: string; steps: Step[] };

/** `C1` → `C_{1}`; etiquetas libres van como texto. */
function labelTex(label: string): string {
  const m = /^([A-Za-z]+)(\d+)$/.exec(label);
  if (m) return `${m[1]}_{${m[2]}}`;
  return `\\text{${label.replace(/[\\{}$&#%_^~]/g, '')}}`;
}

function stateTex(c: CircuitComponent): string {
  const label = componentLabel(c);
  const m = /^([A-Za-z]+)(\d+)$/.exec(label);
  const sub = m ? `${m[1]}${m[2]}` : label.replace(/[\\{}$&#%_^~]/g, '');
  return c.kind === 'capacitor' ? `v_{${sub}}` : `i_{${sub}}`;
}

/**
 * Limpia ruido de coma flotante (los coeficientes vienen de resolver sistemas): lo despreciable
 * frente a la escala es 0 y lo que está a un pelo de un decimal corto se ajusta a él.
 */
function tidy(v: number, scale: number): number {
  if (Math.abs(v) <= 1e-12 * Math.max(scale, 1e-300)) return 0;
  return snap(v);
}

const PRIORITY: Record<string, number> = {
  'voltage-source': 0,
  capacitor: 1,
  resistor: 2,
  inductor: 3,
  'current-source': 4,
};

interface TreeResult {
  inTree: Set<string>;
  adjacency: Map<number, { id: string; to: number }[]>;
}

/** Árbol normal por Kruskal con la prioridad V, C, R, L, I. */
function normalTree(topology: CircuitTopology): TreeResult {
  const parent = topology.nodes.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  const ordered = [...topology.components].sort(
    (a, b) => PRIORITY[a.component.kind]! - PRIORITY[b.component.kind]!,
  );
  const inTree = new Set<string>();
  const adjacency = new Map<number, { id: string; to: number }[]>();
  for (const { component, nodeA, nodeB } of ordered) {
    const ra = find(nodeA);
    const rb = find(nodeB);
    if (ra === rb) continue;
    parent[ra] = rb;
    inTree.add(component.id);
    if (!adjacency.has(nodeA)) adjacency.set(nodeA, []);
    if (!adjacency.has(nodeB)) adjacency.set(nodeB, []);
    adjacency.get(nodeA)!.push({ id: component.id, to: nodeB });
    adjacency.get(nodeB)!.push({ id: component.id, to: nodeA });
  }
  return { inTree, adjacency };
}

/** Nodos alcanzables desde `start` por el árbol sin usar la rama `skip`. */
function reachable(tree: TreeResult, start: number, skip: string): Set<number> {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const u = stack.pop()!;
    for (const e of tree.adjacency.get(u) ?? []) {
      if (e.id === skip || seen.has(e.to)) continue;
      seen.add(e.to);
      stack.push(e.to);
    }
  }
  return seen;
}

/** Ramas del camino por el árbol entre dos nodos. */
function treePath(tree: TreeResult, from: number, to: number): string[] {
  const prev = new Map<number, { node: number; id: string }>();
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const u = queue.shift()!;
    if (u === to) break;
    for (const e of tree.adjacency.get(u) ?? []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, { node: u, id: e.id });
      queue.push(e.to);
    }
  }
  const path: string[] = [];
  let cur = to;
  while (cur !== from && prev.has(cur)) {
    const p = prev.get(cur)!;
    path.push(p.id);
    cur = p.node;
  }
  return path;
}

function equationTex(name: string, row: number[], vars: string[]): string {
  const terms = row
    .map((c, j) => ({ c, v: vars[j]! }))
    .filter(({ c }) => c !== 0)
    .map(({ c, v }, i) => {
      const abs = Math.abs(c);
      const body = `${abs === 1 ? '' : n(abs)}${v}`;
      if (i === 0) return c < 0 ? `-${body}` : body;
      return c < 0 ? ` - ${body}` : ` + ${body}`;
    })
    .join('');
  return `${name} = ${terms || '0'}`;
}

/**
 * Sustitución: cada capacitor pasa a ser una fuente de voltaje y cada inductor una fuente de
 * corriente. La variable o fuente `active` vale 1 y las demás 0 (superposición).
 */
function substituteStorage(doc: CircuitDocument, active: string | null): CircuitDocument {
  return {
    ...doc,
    components: doc.components.map((c) => {
      const value = c.id === active ? 1 : 0;
      if (c.kind === 'capacitor') return { ...c, kind: 'voltage-source' as const, value };
      if (c.kind === 'inductor') return { ...c, kind: 'current-source' as const, value };
      if (c.kind === 'voltage-source' || c.kind === 'current-source') return { ...c, value };
      return c;
    }),
  };
}

/**
 * Ecuación de salida y = Cx + Du para el voltaje (v_a − v_b) o la corriente (de a hacia b) de un
 * componente, con la misma sustitución y superposición que la formulación de A y B.
 */
export function outputEquation(
  doc: CircuitDocument,
  model: StateSpaceModel,
  componentId: string,
  quantity: 'v' | 'i',
): { ok: true; C: number[]; D: number[] } | { ok: false; message: string } {
  const columns = [...model.states.map((s) => s.id), ...model.inputs.map((u) => u.id)];
  const row: number[] = [];
  for (const id of columns) {
    const outcome = solveMna(buildTopology(substituteStorage(doc, id)));
    if (!outcome.ok) return { ok: false, message: outcome.message };
    const branch = outcome.result.branchResults.find((b) => b.id === componentId);
    if (!branch) return { ok: false, message: 'El componente de salida no está en el circuito.' };
    row.push(quantity === 'v' ? branch.v : branch.i);
  }
  const scale = Math.max(1e-300, ...row.map(Math.abs));
  const clean = row.map((v) => tidy(v, scale));
  return { ok: true, C: clean.slice(0, model.states.length), D: clean.slice(model.states.length) };
}

/** Formula ẋ = Ax + Bu a partir del circuito dibujado. */
export function formulateStateEquations(doc: CircuitDocument): FormulationOutcome {
  const steps: Step[] = [];
  const fail = (code: StateSpaceErrorCode, message: string): FormulationOutcome => ({
    ok: false,
    code,
    message,
    steps,
  });

  const storage = doc.components.filter((c) => c.kind === 'capacitor' || c.kind === 'inductor');
  if (storage.length === 0) {
    return fail(
      'sin-elementos-almacenadores',
      'El circuito no tiene capacitores ni inductores: no hay variables de estado.',
    );
  }
  if (storage.length > MAX_STATES) {
    return fail('demasiadas-variables', `Como máximo ${MAX_STATES} capacitores e inductores.`);
  }
  const bad = doc.components.find(
    (c) =>
      (c.kind === 'resistor' || c.kind === 'capacitor' || c.kind === 'inductor') && !(c.value > 0),
  );
  if (bad) {
    return fail('valores-invalidos', `${componentLabel(bad)} debe tener un valor mayor que 0.`);
  }

  const byLabel = (a: CircuitComponent, b: CircuitComponent) =>
    componentLabel(a).localeCompare(componentLabel(b), 'es', { numeric: true });
  const capacitors = storage.filter((c) => c.kind === 'capacitor').sort(byLabel);
  const inductors = storage.filter((c) => c.kind === 'inductor').sort(byLabel);
  const states: StateVariable[] = [...capacitors, ...inductors].map((c) => ({
    id: c.id,
    label: componentLabel(c),
    kind: c.kind as 'capacitor' | 'inductor',
    value: c.value,
    initial: c.initial ?? 0,
    tex: stateTex(c),
  }));
  const inputs: InputSource[] = doc.components
    .filter((c) => c.kind === 'voltage-source' || c.kind === 'current-source')
    .sort(byLabel)
    .map((c) => ({
      id: c.id,
      label: componentLabel(c),
      kind: c.kind as 'voltage-source' | 'current-source',
      value: c.value,
      tex: labelTex(componentLabel(c)),
    }));

  steps.push({
    title: 'Variables de estado y entradas',
    explanation:
      'Las variables de estado son los voltajes de los capacitores (+ en el terminal marcado) y las corrientes de los inductores (del terminal marcado hacia el otro): describen la energía almacenada. Las entradas son las fuentes independientes, de cd a partir de t = 0.',
    formula: `\\mathbf{x} = \\begin{bmatrix} ${states.map((s) => s.tex).join(' \\\\ ')} \\end{bmatrix}${
      inputs.length
        ? `,\\quad \\mathbf{u} = \\begin{bmatrix} ${inputs.map((s) => s.tex).join(' \\\\ ')} \\end{bmatrix}`
        : ''
    }`,
    result: `\\mathbf{x}(0) = ${toLatexMatrix(
      states.map((s) => [s.initial]),
      DIGITS,
    )}${
      inputs.length
        ? `,\\quad \\mathbf{u} = ${toLatexMatrix(
            inputs.map((s) => [s.value]),
            DIGITS,
          )}`
        : ''
    }`,
  });

  // Grafo y árbol normal.
  const topology = buildTopology(doc);
  const tree = normalTree(topology);
  const labelOf = new Map(doc.components.map((c) => [c.id, componentLabel(c)]));
  const treeLabels = doc.components
    .filter((c) => tree.inTree.has(c.id))
    .map((c) => componentLabel(c));
  const linkLabels = doc.components
    .filter((c) => !tree.inTree.has(c.id))
    .map((c) => componentLabel(c));
  const usedNodes = topology.nodes.filter((nd) => nd.terminals.length > 0).length;
  steps.push({
    title: 'Grafo y árbol normal',
    explanation: `El grafo tiene ${usedNodes} nodos y ${doc.components.length} ramas, así que el árbol tiene ${usedNodes - 1} ramas. Se eligen primero las fuentes de voltaje, luego los capacitores, las resistencias, los inductores y al final las fuentes de corriente, sin cerrar lazos. Ramas del árbol: ${treeLabels.join(', ') || '—'}. Cuerdas (coárbol): ${linkLabels.join(', ') || '—'}.`,
  });

  const capOutside = capacitors.filter((c) => !tree.inTree.has(c.id));
  const indInside = inductors.filter((c) => tree.inTree.has(c.id));
  if (capOutside.length > 0 || indInside.length > 0) {
    const parts = [
      capOutside.length > 0 &&
        `${capOutside.map(componentLabel).join(', ')} no cabe${capOutside.length > 1 ? 'n' : ''} en el árbol (forma un lazo solo con capacitores y fuentes de voltaje)`,
      indInside.length > 0 &&
        `${indInside.map(componentLabel).join(', ')} queda${indInside.length > 1 ? 'n' : ''} en el árbol (hay un corte formado solo por inductores y fuentes de corriente)`,
    ].filter(Boolean);
    steps.push({
      title: 'Red impropia',
      explanation: `${parts.join('; ')}. Sus variables no son independientes, así que no todas pueden ser variables de estado.`,
    });
    return fail(
      'red-impropia',
      'La red es impropia: hay un lazo de capacitores y fuentes de voltaje o un corte de inductores y fuentes de corriente. Agrega una resistencia en ese lazo o en paralelo con ese corte.',
    );
  }
  steps.push({
    title: 'Red propia',
    explanation:
      'Todos los capacitores están en el árbol y todos los inductores en el coárbol: cada variable de estado es independiente y hay una ecuación por cada una.',
  });

  const nodeOfId = new Map(topology.components.map((m) => [m.component.id, m]));
  const cutSteps: Step[] = capacitors.map((c) => {
    const mapped = nodeOfId.get(c.id)!;
    const side = reachable(tree, mapped.nodeA, c.id);
    const members = topology.components
      .filter((m) => side.has(m.nodeA) !== side.has(m.nodeB))
      .map((m) => labelOf.get(m.component.id)!);
    const st = states.find((s) => s.id === c.id)!;
    return {
      title: `Capacitor ${componentLabel(c)}`,
      explanation: `Conjunto de corte fundamental: {${members.join(', ')}}. Por LCK, la corriente del capacitor es la suma con signo de las corrientes de las cuerdas del corte.`,
      formula: `${labelTex(componentLabel(c))}\\frac{d${st.tex}}{dt} = i_{${st.label.replace(/[\\{}$&#%_^~]/g, '')}}`,
    };
  });
  const loopSteps: Step[] = inductors.map((c) => {
    const mapped = nodeOfId.get(c.id)!;
    const path = treePath(tree, mapped.nodeA, mapped.nodeB).map((id) => labelOf.get(id)!);
    const st = states.find((s) => s.id === c.id)!;
    return {
      title: `Inductor ${componentLabel(c)}`,
      explanation: `Lazo fundamental: {${[componentLabel(c), ...path].join(', ')}}. Por LVK, el voltaje del inductor es la suma con signo de los voltajes de las ramas del árbol del lazo.`,
      formula: `${labelTex(componentLabel(c))}\\frac{d${st.tex}}{dt} = v_{${st.label.replace(/[\\{}$&#%_^~]/g, '')}}`,
    };
  });
  if (cutSteps.length) {
    steps.push({ title: 'Cortes fundamentales de los capacitores (LCK)', children: cutSteps });
  }
  if (loopSteps.length) {
    steps.push({ title: 'Lazos fundamentales de los inductores (LVK)', children: loopSteps });
  }

  const substitute = (active: string | null) => substituteStorage(doc, active);
  const structural = validateTopology(buildTopology(substitute(null)));
  if (structural) {
    if (
      structural.code === 'lazo-de-fuentes-de-voltaje' ||
      structural.code === 'corte-de-fuentes-de-corriente'
    ) {
      return fail(
        'red-impropia',
        'Hay un lazo formado solo por capacitores y fuentes de voltaje o un nodo con solo inductores y fuentes de corriente: la red es impropia.',
      );
    }
    return fail('circuito-invalido', structural.message);
  }

  const columns = [...states.map((s) => s.id), ...inputs.map((u) => u.id)];
  const raw: number[][] = states.map(() => Array<number>(columns.length).fill(0));
  for (let j = 0; j < columns.length; j++) {
    const outcome = solveMna(buildTopology(substitute(columns[j]!)));
    if (!outcome.ok) return fail('singular', outcome.message);
    states.forEach((s, k) => {
      const branch = outcome.result.branchResults.find((b) => b.id === s.id)!;
      // Capacitor: corriente que entra por su + (i_C); inductor: v_a − v_b (v_L).
      const response = s.kind === 'capacitor' ? branch.i : branch.v;
      raw[k]![j] = response / s.value;
    });
  }
  const scale = Math.max(1e-300, ...raw.flat().map(Math.abs));
  const A = raw.map((row) => row.slice(0, states.length).map((v) => tidy(v, scale)));
  const B = raw.map((row) => row.slice(states.length).map((v) => tidy(v, scale)));
  const vars = [...states.map((s) => s.tex), ...inputs.map((u) => u.tex)];

  steps.push({
    title: 'Eliminación de las variables de las resistencias',
    explanation:
      'Cada capacitor se reemplaza por una fuente de voltaje de valor v_C y cada inductor por una fuente de corriente de valor i_L. La red que queda es resistiva: se resuelve por análisis nodal con cada variable o fuente en 1 y las demás en 0, y por superposición i_C y v_L quedan como combinaciones de x y u.',
    children: states.map((s, k) => {
      const response = s.kind === 'capacitor' ? `i_{${s.label}}` : `v_{${s.label}}`;
      const coefficients = raw[k]!.map((v) => tidy(v * s.value, scale));
      return {
        title: s.kind === 'capacitor' ? `Corriente de ${s.label}` : `Voltaje de ${s.label}`,
        result: equationTex(response, coefficients, vars),
      };
    }),
  });

  steps.push({
    title: 'Ecuaciones de estado',
    explanation: 'Se divide cada ecuación entre C o L.',
    children: states.map((s, k) => ({
      title: s.label,
      result: equationTex(
        `\\frac{d${s.tex}}{dt}`,
        raw[k]!.map((v) => tidy(v, scale)),
        vars,
      ),
    })),
    formula: '\\dot{\\mathbf{x}} = A\\,\\mathbf{x} + B\\,\\mathbf{u}',
    result: `A = ${toLatexMatrix(A, DIGITS)}${inputs.length ? `,\\quad B = ${toLatexMatrix(B, DIGITS)}` : ''}`,
  });

  return {
    ok: true,
    model: {
      states,
      inputs,
      A,
      B,
      u: inputs.map((i) => i.value),
      x0: states.map((s) => s.initial),
      tree: treeLabels,
      links: linkLabels,
    },
    steps,
  };
}

// ─── Solución ───────────────────────────────────────────────────────────────

function matMul(a: number[][], b: number[][]): number[][] {
  return a.map((row) => b[0]!.map((_, j) => row.reduce((s, v, k) => s + v * b[k]![j]!, 0)));
}

/**
 * Faddeev-LeVerrier: det(sI − A) = sⁿ + c₁sⁿ⁻¹ + … + cₙ y adj(sI − A) = Σ M_k s^{n−1−k}, con
 * M₀ = I, c_k = −tr(A·M_{k−1})/k y M_k = A·M_{k−1} + c_k·I.
 */
export function faddeevLeverrier(A: number[][]): { charPoly: Poly; M: number[][][] } {
  const size = A.length;
  const identity = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
  const M: number[][][] = [identity];
  const charPoly: Poly = [1];
  for (let k = 1; k <= size; k++) {
    const AM = matMul(A, M[k - 1]!);
    const trace = AM.reduce((s, row, i) => s + row[i]!, 0);
    const c = -trace / k;
    charPoly.push(c);
    if (k < size) M.push(AM.map((row, i) => row.map((v, j) => v + (i === j ? c : 0))));
  }
  const scale = Math.max(1, ...charPoly.map(Math.abs));
  return { charPoly: charPoly.map((c) => tidy(c, scale)), M };
}

/** Matriz de polinomios adj(sI − A) en LaTeX. */
export function adjugateTex(M: number[][][]): string {
  const size = M[0]!.length;
  const rows = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => {
      const poly = M.map((m) => m[i]![j]!);
      return polyTex(poly, 's');
    }).join(' & '),
  );
  return `\\begin{bmatrix} ${rows.join(' \\\\ ')} \\end{bmatrix}`;
}

/** sI − A en LaTeX. */
export function sIminusATex(A: number[][]): string {
  const rows = A.map((row, i) =>
    row
      .map((v, j) => {
        if (i === j) return polyTex([1, -v], 's');
        return v === 0 ? '0' : n(-v);
      })
      .join(' & '),
  );
  return `\\begin{bmatrix} ${rows.join(' \\\\ ')} \\end{bmatrix}`;
}

/** Numerador y denominador de X_i(s) = [adj(sI − A)(x(0)·s + B·u)]_i / [s·det(sI − A)]. */
export function stateTransforms(
  model: StateSpaceModel,
  charPoly: Poly,
  M: number[][][],
): { num: Poly; den: Poly }[] {
  const size = model.A.length;
  const Bu = model.B.map((row) => row.reduce((s, b, j) => s + b * model.u[j]!, 0));
  const forced = Bu.some((v) => v !== 0);
  return Array.from({ length: size }, (_, i) => {
    // Σ_k (M_k x0)_i s^{n−k} + (M_k Bu)_i s^{n−1−k}; sin entradas se cancela una s.
    const num = Array<number>(size + 1).fill(0);
    M.forEach((m, k) => {
      const mx = m[i]!.reduce((s, v, j) => s + v * model.x0[j]!, 0);
      const mb = m[i]!.reduce((s, v, j) => s + v * Bu[j]!, 0);
      num[k] = num[k]! + mx;
      num[k + 1] = num[k + 1]! + mb;
    });
    if (!forced) return { num: num.slice(0, size), den: charPoly };
    return { num, den: [...charPoly, 0] };
  });
}

/** x(∞) = −A⁻¹Bu, si A es invertible. */
export function steadyState(model: StateSpaceModel): number[] | null {
  const Bu = model.B.map((row) => row.reduce((s, b, j) => s + b * model.u[j]!, 0));
  const solution = solveLinearSystem(
    model.A,
    Bu.map((v) => -v),
  );
  return solution ? solution.map((v) => snap(v)) : null;
}
