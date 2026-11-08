/**
 * Análisis de nodos modificado (MNA) para circuitos con resistencias y fuentes independientes de
 * voltaje y corriente. Produce la traza del procedimiento: identificación de nodos, KCL por nodo,
 * sistema aumentado, eliminación gaussiana paso a paso y sustitución hacia atrás.
 *
 * También admite amplificadores operacionales ideales (calculadora de Electrónica): no entra
 * corriente por sus entradas, la corriente de la salida es una incógnita más (va a tierra por la
 * alimentación) y su ecuación es el cortocircuito virtual v₊ − v₋ = 0.
 *
 * Fuentes:
 * - Hayt, Kemmerly & Durbin, *Análisis de Circuitos en Ingeniería*, 7.ª ed., cap. 4 (análisis de
 *   nodos y supernodos).
 * - Swarthmore, "Modified Nodal Analysis" (lpsa.swarthmore.edu), para el estampado algorítmico.
 */
import {
  backSubstitution,
  forwardElimination,
  texAugmented,
} from '@/lib/calculators/metodos-numericos/matrix';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Notice, ResultTable, Step } from '../types';
import {
  componentLabel,
  componentUnit,
  type CircuitTopology,
  type ComponentKind,
  type MappedComponent,
  type TerminalName,
} from './circuit';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

function addAt(m: number[][], r: number, c: number, v: number) {
  m[r]![c] = m[r]![c]! + v;
}

function setAt(m: number[][], r: number, c: number, v: number) {
  m[r]![c] = v;
}

export interface BranchResult {
  /** Id del componente en el documento; permite mapear el resultado al dibujo. */
  id: string;
  label: string;
  kind: ComponentKind;
  nodeA: number;
  nodeB: number;
  v: number; // voltaje a - b
  i: number; // corriente a → b por convención pasiva
  p: number; // potencia (pasiva: >0 absorbe, <0 entrega)
}

export interface MnaResult {
  /** Índices según topology.nodes; el nodo de referencia tiene voltaje 0. */
  nodeVoltages: number[];
  /** Corrientes a través de las fuentes de voltaje, en el orden de voltageSources. */
  sourceCurrents: number[];
  branchResults: BranchResult[];
}

export interface MnaSolve {
  ok: true;
  result: MnaResult;
  /** Traza lista para devolver en `solve()` (steps, tables, series, notices). */
  steps: Step[];
  tables: ResultTable[];
  notices: Notice[];
}

export type MnaErrorCode = 'singular';

export interface MnaFailure {
  ok: false;
  code: MnaErrorCode;
  message: string;
}

export type MnaOutcome = MnaSolve | MnaFailure;

const OPAMP_TERMINALS: Record<TerminalName, string> = {
  a: 'entrada −',
  b: 'entrada +',
  c: 'salida',
};

/** Nombre del terminal en la tabla de nodos: (+)/(−), o las entradas y la salida del amplificador. */
function terminalText(kind: ComponentKind, terminal: TerminalName): string {
  if (kind === 'opamp') return OPAMP_TERMINALS[terminal];
  return terminal === 'a' ? '+' : '-';
}

function voltageSourceIndex(topology: CircuitTopology): Map<string, number> {
  const map = new Map<string, number>();
  let idx = 0;
  for (const { component } of topology.components) {
    if (component.kind === 'voltage-source') {
      map.set(component.id, idx++);
    }
  }
  return map;
}

/** Posición de cada incógnita en el sistema aumentado. */
interface Layout {
  /** Fila de cada nodo que no es la referencia. */
  nodeToRow: Map<number, number>;
  /** Nodos que no son la referencia, en el orden de sus filas. */
  rows: number[];
  vsrcIndex: Map<string, number>;
  opamps: MappedComponent[];
  nUnknowns: number;
  nVsrc: number;
  size: number;
}

function layoutOf(topology: CircuitTopology): Layout {
  const nodeToRow = new Map<number, number>();
  const rows: number[] = [];
  for (let i = 0; i < topology.nodes.length; i++) {
    if (i === topology.referenceNode) continue;
    nodeToRow.set(i, rows.length);
    rows.push(i);
  }
  const vsrcIndex = voltageSourceIndex(topology);
  const opamps = topology.components.filter(
    (c) => c.component.kind === 'opamp' && c.nodeC !== undefined,
  );
  const nUnknowns = rows.length;
  const nVsrc = vsrcIndex.size;
  return {
    nodeToRow,
    rows,
    vsrcIndex,
    opamps,
    nUnknowns,
    nVsrc,
    size: nUnknowns + nVsrc + opamps.length,
  };
}

/** Conductancia g entre las filas i y j (`undefined` es el nodo de referencia). */
function stampConductance(a: number[][], i: number | undefined, j: number | undefined, g: number) {
  if (i !== undefined) addAt(a, i, i, g);
  if (j !== undefined) addAt(a, j, j, g);
  if (i !== undefined && j !== undefined) {
    addAt(a, i, j, -g);
    addAt(a, j, i, -g);
  }
}

/**
 * Fuente de corriente (positiva: fluye de a a b). En el lado derecho va la corriente inyectada en
 * cada nodo: la flecha a→b sale de A e ingresa a B.
 */
function stampCurrentSource(
  a: number[][],
  i: number | undefined,
  j: number | undefined,
  value: number,
  rhs: number,
) {
  if (i !== undefined) addAt(a, i, rhs, -value);
  if (j !== undefined) addAt(a, j, rhs, value);
}

/**
 * Fuente de voltaje en la fila k: su corriente i_k ingresa por el terminal positivo (nodo A) y su
 * ecuación es v_A − v_B = E.
 */
function stampVoltageSource(
  a: number[][],
  i: number | undefined,
  j: number | undefined,
  k: number,
  value: number,
) {
  if (i !== undefined) {
    addAt(a, i, k, 1);
    addAt(a, k, i, 1);
  }
  if (j !== undefined) {
    addAt(a, j, k, -1);
    addAt(a, k, j, -1);
  }
  setAt(a, k, a.length, value);
}

/**
 * Amplificador operacional ideal en la fila k: la corriente que entra por su salida es la
 * incógnita (KCL en la salida) y su ecuación es el cortocircuito virtual v₊ − v₋ = 0 (a es la
 * entrada −; b, la +).
 */
function stampOpAmp(a: number[][], layout: Layout, opamp: MappedComponent, k: number) {
  const out = layout.nodeToRow.get(opamp.nodeC!);
  if (out !== undefined) addAt(a, out, k, 1);
  const minus = layout.nodeToRow.get(opamp.nodeA);
  const plus = layout.nodeToRow.get(opamp.nodeB);
  if (plus !== undefined) addAt(a, k, plus, 1);
  if (minus !== undefined) addAt(a, k, minus, -1);
}

function stampMatrix(topology: CircuitTopology, layout: Layout): number[][] {
  const { nodeToRow, vsrcIndex, nUnknowns, nVsrc, size } = layout;
  const a: number[][] = Array.from({ length: size }, () => new Array(size + 1).fill(0));
  for (const { component, nodeA, nodeB } of topology.components) {
    const i = nodeToRow.get(nodeA);
    const j = nodeToRow.get(nodeB);
    if (component.kind === 'resistor') stampConductance(a, i, j, 1 / component.value);
    else if (component.kind === 'current-source')
      stampCurrentSource(a, i, j, component.value, size);
    else if (component.kind === 'voltage-source')
      stampVoltageSource(a, i, j, vsrcIndex.get(component.id)! + nUnknowns, component.value);
  }
  layout.opamps.forEach((opamp, idx) => stampOpAmp(a, layout, opamp, nUnknowns + nVsrc + idx));
  return a;
}

/** El otro extremo de la rama (a, b) vista desde `node`, o −1 si no la toca. */
function otherEnd(nodeA: number, nodeB: number, node: number): number {
  if (nodeA === node) return nodeB;
  return nodeB === node ? nodeA : -1;
}

/** Términos G·(v_i − v_j) de las resistencias conectadas al nodo (una por par de nodos). */
function conductanceTerms(topology: CircuitTopology, nodeIdx: number) {
  const terms: string[] = [];
  const subs: string[] = [];
  const seen = new Set<string>();
  for (const { component, nodeA, nodeB } of topology.components) {
    if (component.kind !== 'resistor') continue;
    const other = otherEnd(nodeA, nodeB, nodeIdx);
    if (other === -1) continue;
    const g = 1 / component.value;
    const label = componentLabel(component);
    if (other === topology.referenceNode) {
      terms.push(`G_{${label}} v_${nodeIdx + 1}`);
      subs.push(`${n(g)} v_${nodeIdx + 1}`);
      continue;
    }
    const pair = [nodeIdx, other].sort((a, b) => a - b).join('-');
    if (seen.has(pair)) continue;
    seen.add(pair);
    terms.push(`G_{${label}} (v_${nodeIdx + 1} - v_${other + 1})`);
    subs.push(`${n(g)} (v_${nodeIdx + 1} - v_${other + 1})`);
  }
  return { terms, subs };
}

/** Corrientes de las fuentes que salen (−) o entran (+) al nodo. */
function injectedCurrents(topology: CircuitTopology, nodeIdx: number): string[] {
  const currents: string[] = [];
  for (const { component, nodeA, nodeB } of topology.components) {
    if (component.kind !== 'current-source') continue;
    if (nodeA === nodeIdx) currents.push(String.raw`-${component.value}\text{ A}`);
    else if (nodeB === nodeIdx) currents.push(String.raw`+${component.value}\text{ A}`);
  }
  return currents;
}

/** KCL simbólica y con números en un nodo; `null` si no hay nada conectado. */
function kclStep(topology: CircuitTopology, layout: Layout, nodeIdx: number): Step | null {
  const { terms, subs } = conductanceTerms(topology, nodeIdx);
  // Corriente que entra a la salida de un amplificador operacional conectado aquí.
  for (const { component, nodeC } of layout.opamps) {
    if (nodeC !== nodeIdx) continue;
    terms.push(`i_{${componentLabel(component)}}`);
    subs.push(`i_{${componentLabel(component)}}`);
  }
  const currents = injectedCurrents(topology, nodeIdx);
  if (terms.length === 0 && currents.length === 0) return null;
  const rhs = currents.length ? ` = ${currents.join(' ')}` : ' = 0';
  return {
    title: `KCL en el nodo ${nodeIdx + 1}`,
    formula: terms.join(' + ') + rhs,
    substitution: subs.join(' + ') + rhs,
  };
}

/** KCL por nodo, la ecuación de cada fuente de voltaje y la de cada amplificador. */
function equationSteps(topology: CircuitTopology, layout: Layout): Step[] {
  const steps: Step[] = [];
  for (const nodeIdx of layout.rows) {
    const step = kclStep(topology, layout, nodeIdx);
    if (step) steps.push(step);
  }
  for (const { component, nodeA, nodeB } of topology.components) {
    if (component.kind !== 'voltage-source') continue;
    steps.push({
      title: `Fuente de voltaje ${componentLabel(component)}`,
      formula: `v_${nodeA + 1} - v_${nodeB + 1} = E`,
      substitution: String.raw`v_${nodeA + 1} - v_${nodeB + 1} = ${n(component.value)}\text{ V}`,
    });
  }
  const v = (node: number) => (node === topology.referenceNode ? '0' : `v_${node + 1}`);
  for (const { component, nodeA, nodeB } of layout.opamps) {
    steps.push({
      title: `Amplificador ${componentLabel(component)}`,
      explanation:
        'Ideal y con realimentación negativa: no entra corriente por sus entradas y ambas quedan al mismo voltaje (cortocircuito virtual).',
      formula: 'v_{+} - v_{-} = 0',
      substitution: `${v(nodeB)} - ${v(nodeA)} = 0`,
    });
  }
  return steps;
}

/** Estado de una rama según el signo de su potencia (convención pasiva). */
export function powerState(p: number): string {
  if (Math.abs(p) < 1e-12) return 'cero';
  return p > 0 ? 'absorbe' : 'entrega';
}

/** Corriente de la rama (a → b, convención pasiva). */
function branchCurrent(
  mapped: MappedComponent,
  layout: Layout,
  x: number[],
  opamp: number,
  v: number,
): number {
  const { component } = mapped;
  if (opamp >= 0) return x[layout.nUnknowns + layout.nVsrc + opamp]!;
  if (component.kind === 'resistor') return v / component.value;
  // i_k está definida como la corriente que entra por el terminal positivo (nodo A).
  if (component.kind === 'voltage-source')
    return x[layout.nUnknowns + layout.vsrcIndex.get(component.id)!]!;
  if (component.kind === 'current-source') return component.value;
  return 0;
}

/**
 * Voltaje, corriente y potencia de cada rama. La salida de un amplificador operacional es una
 * rama de la salida a tierra: la potencia que entrega sale de su alimentación.
 */
function branchResultsOf(
  topology: CircuitTopology,
  layout: Layout,
  x: number[],
  nodeVoltages: number[],
): { results: BranchResult[]; table: ResultTable } {
  const results: BranchResult[] = [];
  const table: ResultTable = {
    id: 'ramas',
    title: 'Corrientes y potencias por rama',
    columns: [
      { key: 'rama', header: 'Rama' },
      { key: 'v', header: 'V (V)' },
      { key: 'i', header: 'I (A)' },
      { key: 'p', header: 'P (W)' },
      { key: 'estado', header: 'Estado' },
    ],
    rows: [],
  };
  for (const mapped of topology.components) {
    const { component } = mapped;
    const opamp = component.kind === 'opamp' ? layout.opamps.indexOf(mapped) : -1;
    if (component.kind === 'opamp' && opamp < 0) continue;
    const nodeA = opamp >= 0 ? mapped.nodeC! : mapped.nodeA;
    const nodeB = opamp >= 0 ? topology.referenceNode : mapped.nodeB;
    const v = nodeVoltages[nodeA]! - nodeVoltages[nodeB]!;
    const i = branchCurrent(mapped, layout, x, opamp, v);
    const p = v * i;
    const label = componentLabel(component);
    results.push({ id: component.id, label, kind: component.kind, nodeA, nodeB, v, i, p });
    const unit = opamp >= 0 ? 'salida' : componentUnit(component.kind);
    table.rows.push({
      rama: `${label} (${unit})`,
      v: formatNumber(v, DIGITS),
      i: formatNumber(i, DIGITS),
      p: formatNumber(p, DIGITS),
      estado: powerState(p),
    });
  }
  return { results, table };
}

/** Tabla de nodos: terminales conectadas y voltaje de cada uno. */
function nodeTableOf(
  topology: CircuitTopology,
  layout: Layout,
  nodeVoltages: number[],
): ResultTable {
  const rows: ResultTable['rows'] = layout.rows.map((nodeIdx) => ({
    nodo: `Nodo ${nodeIdx + 1}`,
    componentes: topology.nodes[nodeIdx]!.terminals.map(
      (t) => `${componentLabel(t.component)} (${terminalText(t.component.kind, t.terminal)})`,
    ).join(', '),
    voltaje: formatNumber(nodeVoltages[nodeIdx]!, DIGITS),
  }));
  if (layout.nVsrc > 0) rows.push({ nodo: 'Referencia', componentes: '(tierra)', voltaje: '0' });
  return {
    id: 'nodos',
    title: 'Nodos del circuito',
    columns: [
      { key: 'nodo', header: 'Nodo' },
      { key: 'componentes', header: 'Terminales conectadas' },
      { key: 'voltaje', header: 'Voltaje (V)' },
    ],
    rows,
  };
}

/**
 * Resuelve el circuito por MNA. Devuelve la traza completa o un fallo `singular`.
 */
export function solveMna(topology: CircuitTopology): MnaOutcome {
  const { nodes, referenceNode } = topology;
  const layout = layoutOf(topology);
  const { nodeToRow, rows, nUnknowns, size, opamps } = layout;
  const a = stampMatrix(topology, layout);
  const kclSteps = equationSteps(topology, layout);

  const elim = forwardElimination(a, {
    pivotColumns: size,
    pivoting: true,
    augmentedColumns: 1,
  });
  if (elim.zeroPivotColumn !== null) {
    return {
      ok: false,
      code: 'singular',
      message:
        'El sistema de ecuaciones es singular. Revisa que no haya un lazo de fuentes de voltaje sin resistencia, un corte de fuentes de corriente o nodos desconectados.',
    };
  }
  const { x, steps: backSteps } = backSubstitution(elim.upper);

  const nodeVoltages = nodes.map((_, i) => (i === referenceNode ? 0 : x[nodeToRow.get(i)!]!));
  const sourceCurrents = x.slice(nUnknowns);
  const nodeTable = nodeTableOf(topology, layout, nodeVoltages);
  const { results: branchResults, table: branchTable } = branchResultsOf(
    topology,
    layout,
    x,
    nodeVoltages,
  );

  const totalPower = branchResults.reduce((s, b) => s + b.p, 0);
  const notices: Notice[] = [];
  if (Math.abs(totalPower) > 1e-6) {
    notices.push({
      level: 'warning',
      message: `Balance de potencias desviado (${formatNumber(totalPower, DIGITS)} W); revisa los valores o la precisión.`,
    });
  }

  const opampNote = opamps.length ? ' y de los amplificadores operacionales' : '';
  const steps: Step[] = [
    {
      title: 'Identificación de nodos',
      explanation: `Se elige el nodo ${referenceNode + 1} como referencia (tierra). Los demás nodos se numeran a partir de 1.`,
    },
    ...kclSteps,
    {
      title: 'Sistema de ecuaciones aumentado',
      explanation: `Las primeras filas son KCL en cada nodo desconocido; las últimas filas son las ecuaciones de las fuentes de voltaje${opampNote}. La última columna es el lado derecho.`,
      result: texAugmented(a, 1, DIGITS),
    },
    ...elim.steps,
    ...backSteps,
    {
      title: 'Voltajes de nodo',
      explanation: 'Se despejan los voltajes de cada nodo respecto a la referencia.',
      result: rows
        .map((idx) => String.raw`v_${idx + 1} = ${n(nodeVoltages[idx]!)}\text{ V}`)
        .join(String.raw`,\ `),
    },
  ];

  return {
    ok: true,
    result: { nodeVoltages, sourceCurrents, branchResults },
    steps,
    tables: [nodeTable, branchTable],
    notices,
  };
}
