/**
 * Análisis de nodos modificado (MNA) para circuitos con resistencias y fuentes independientes de
 * voltaje y corriente. Produce la traza del procedimiento: identificación de nodos, KCL por nodo,
 * sistema aumentado, eliminación gaussiana paso a paso y sustitución hacia atrás.
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
import { componentLabel, componentUnit, type CircuitTopology } from './circuit';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

function addAt(m: number[][], r: number, c: number, v: number) {
  m[r]![c] = m[r]![c]! + v;
}

function setAt(m: number[][], r: number, c: number, v: number) {
  m[r]![c] = v;
}

export interface BranchResult {
  label: string;
  kind: 'resistor' | 'voltage-source' | 'current-source';
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

/**
 * Resuelve el circuito por MNA. Devuelve la traza completa o un fallo `singular`.
 */
export function solveMna(topology: CircuitTopology): MnaOutcome {
  const { nodes, components, referenceNode } = topology;
  const nNodes = nodes.length;
  const nodeToRow = new Map<number, number>();
  const rows: number[] = [];
  for (let i = 0; i < nNodes; i++) {
    if (i === referenceNode) continue;
    nodeToRow.set(i, rows.length);
    rows.push(i);
  }
  const nUnknowns = rows.length;
  const vsrcIndex = voltageSourceIndex(topology);
  const nVsrc = vsrcIndex.size;
  const size = nUnknowns + nVsrc;

  const a: number[][] = Array.from({ length: size }, () => Array(size + 1).fill(0));

  // Estampado.
  for (const { component, nodeA, nodeB } of components) {
    const i = nodeToRow.get(nodeA);
    const j = nodeToRow.get(nodeB);
    if (component.kind === 'resistor') {
      const g = 1 / component.value;
      if (i !== undefined && j !== undefined) {
        addAt(a, i, i, g);
        addAt(a, j, j, g);
        addAt(a, i, j, -g);
        addAt(a, j, i, -g);
      } else if (i !== undefined) {
        addAt(a, i, i, g);
      } else if (j !== undefined) {
        addAt(a, j, j, g);
      }
    } else if (component.kind === 'current-source') {
      const value = component.value; // positivo: fluye de nodeA a nodeB
      // RHS: inyectado en el nodo (corriente entrante positiva).
      // La flecha a→b sale de A e ingresa a B.
      if (i !== undefined) addAt(a, i, size, -value);
      if (j !== undefined) addAt(a, j, size, value);
    } else if (component.kind === 'voltage-source') {
      const k = vsrcIndex.get(component.id)! + nUnknowns;
      // Corriente i_k ingresa por el terminal positivo (nodeA).
      if (i !== undefined) addAt(a, i, k, 1);
      if (j !== undefined) addAt(a, j, k, -1);
      // Ecuación de la fuente: v_A - v_B = E.
      if (i !== undefined) addAt(a, k, i, 1);
      if (j !== undefined) addAt(a, k, j, -1);
      setAt(a, k, size, component.value);
    }
  }

  // Identificación de nodos.
  const nodeRows = rows.map((nodeIdx, row) => ({
    nodo: nodeIdx,
    fila: row,
    componentes: nodes[nodeIdx]!.terminals.map(
      (t) => `${componentLabel(t.component)} (${t.terminal === 'a' ? '+' : '-'})`,
    ).join(', '),
  }));

  const nodeTable: ResultTable = {
    id: 'nodos',
    title: 'Nodos del circuito',
    columns: [
      { key: 'nodo', header: 'Nodo' },
      { key: 'componentes', header: 'Terminales conectadas' },
      { key: 'voltaje', header: 'Voltaje (V)' },
    ],
    rows: [],
  };

  // Sistema simbólico por nodo (KCL) para la traza.
  const kclSteps: Step[] = [];
  for (let r = 0; r < nUnknowns; r++) {
    const nodeIdx = rows[r]!;
    const terms: string[] = [];
    const subs: string[] = [];
    // Conductancias conectadas a este nodo.
    const seen = new Set<string>();
    for (const { component, nodeA, nodeB } of components) {
      if (component.kind !== 'resistor') continue;
      const other = nodeA === nodeIdx ? nodeB : nodeB === nodeIdx ? nodeA : -1;
      if (other === -1) continue;
      const g = 1 / component.value;
      const label = componentLabel(component);
      if (other === referenceNode) {
        terms.push(`G_{${label}} v_${nodeIdx + 1}`);
        subs.push(`${n(g)} v_${nodeIdx + 1}`);
      } else {
        const pair = [nodeIdx, other].sort().join('-');
        if (!seen.has(pair)) {
          seen.add(pair);
          terms.push(`G_{${label}} (v_${nodeIdx + 1} - v_${other + 1})`);
          subs.push(`${n(g)} (v_${nodeIdx + 1} - v_${other + 1})`);
        }
      }
    }
    // Fuentes de corriente incidentes.
    const currents: string[] = [];
    for (const { component, nodeA, nodeB } of components) {
      if (component.kind !== 'current-source') continue;
      if (nodeA === nodeIdx) {
        currents.push(`-${component.value}\\text{ A}`);
      } else if (nodeB === nodeIdx) {
        currents.push(`+${component.value}\\text{ A}`);
      }
    }
    if (terms.length || currents.length) {
      kclSteps.push({
        title: `KCL en el nodo ${nodeIdx + 1}`,
        formula: terms.join(' + ') + (currents.length ? ` = ${currents.join(' ')}` : ' = 0'),
        substitution: subs.join(' + ') + (currents.length ? ` = ${currents.join(' ')}` : ' = 0'),
      });
    }
  }
  // Ecuaciones de fuentes de voltaje.
  for (const { component, nodeA, nodeB } of components) {
    if (component.kind !== 'voltage-source') continue;
    const label = componentLabel(component);
    kclSteps.push({
      title: `Fuente de voltaje ${label}`,
      formula: `v_${nodeA + 1} - v_${nodeB + 1} = E`,
      substitution: `v_${nodeA + 1} - v_${nodeB + 1} = ${n(component.value)}\\text{ V}`,
    });
  }

  // Resolver.
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

  // Tabla de nodos con voltajes reales.
  nodeTable.rows = rows.map((nodeIdx, r) => ({
    nodo: `Nodo ${nodeIdx + 1}`,
    componentes: nodeRows[r]!.componentes,
    voltaje: formatNumber(nodeVoltages[nodeIdx]!, DIGITS),
  }));
  if (nVsrc > 0) {
    nodeTable.rows.push({
      nodo: 'Referencia',
      componentes: '(tierra)',
      voltaje: '0',
    });
  }

  // Resultados por rama.
  const branchResults: BranchResult[] = [];
  const branchTable: ResultTable = {
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

  for (const { component, nodeA, nodeB } of components) {
    const v = nodeVoltages[nodeA]! - nodeVoltages[nodeB]!;
    let i = 0;
    if (component.kind === 'resistor') {
      i = v / component.value;
    } else if (component.kind === 'voltage-source') {
      const idx = vsrcIndex.get(component.id)!;
      // i_k definido como corriente que entra por el terminal positivo (nodeA).
      i = sourceCurrents[idx]!;
    } else if (component.kind === 'current-source') {
      i = component.value;
    }
    const p = v * i;
    branchResults.push({
      label: componentLabel(component),
      kind: component.kind,
      nodeA,
      nodeB,
      v,
      i,
      p,
    });
    branchTable.rows.push({
      rama: `${componentLabel(component)} (${componentUnit(component.kind)})`,
      v: formatNumber(v, DIGITS),
      i: formatNumber(i, DIGITS),
      p: formatNumber(p, DIGITS),
      estado: Math.abs(p) < 1e-12 ? 'cero' : p > 0 ? 'absorbe' : 'entrega',
    });
  }

  const totalPower = branchResults.reduce((s, b) => s + b.p, 0);
  const notices: Notice[] = [];
  if (Math.abs(totalPower) > 1e-6) {
    notices.push({
      level: 'warning',
      message: `Balance de potencias desviado (${formatNumber(totalPower, DIGITS)} W); revisa los valores o la precisión.`,
    });
  }

  const steps: Step[] = [
    {
      title: 'Identificación de nodos',
      explanation: `Se elige el nodo ${referenceNode + 1} como referencia (tierra). Los demás nodos se numeran a partir de 1.`,
    },
    ...kclSteps,
    {
      title: 'Sistema de ecuaciones aumentado',
      explanation:
        'Las primeras filas son KCL en cada nodo desconocido; las últimas filas son las ecuaciones de las fuentes de voltaje. La última columna es el lado derecho.',
      result: texAugmented(a, 1, DIGITS),
    },
    ...elim.steps,
    ...backSteps,
    {
      title: 'Voltajes de nodo',
      explanation: 'Se despejan los voltajes de cada nodo respecto a la referencia.',
      result: rows.map((idx) => `v_${idx + 1} = ${n(nodeVoltages[idx]!)}\\text{ V}`).join(',\\ '),
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
