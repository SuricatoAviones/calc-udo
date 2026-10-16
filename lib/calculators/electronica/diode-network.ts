/**
 * Redes con diodos dibujadas en el constructor: el método de los estados supuestos de Boylestad y
 * Nashelsky (10.ª ed. en español, sec. 2.3 a 2.5).
 *
 * Cada diodo se reemplaza según su estado supuesto: encendido, por una fuente de V_K (0 V en el
 * modelo ideal; V_K en serie con r_B en la tercera aproximación); apagado, por un circuito
 * abierto. El circuito lineal que resulta se resuelve por análisis de nodos y se verifica cada
 * suposición: un diodo encendido debe conducir en el sentido de su flecha (I_D ≥ 0) y uno apagado
 * no debe alcanzar su umbral (V_AK ≤ V_K). Si algo falla se cambia el estado del diodo que más se
 * aleja de su suposición y se repite.
 *
 * Detalles:
 * - Se parte de todos los diodos apagados (el «circuito abierto» con que el libro determina el
 *   sentido de la corriente). Para comprobar las suposiciones, un diodo apagado se modela con una
 *   conductancia despreciable, así un nodo que solo une diodos apagados sigue teniendo voltaje.
 * - Diodos iguales en paralelo (mismos nodos y V_K) se tratan juntos y se reparten la corriente
 *   (Boylestad, ejemplo 2.10).
 * - Un diodo encendido que no lleva corriente (en serie con otro apagado) se toma como apagado con
 *   V_D = 0, como en el ejemplo 2.8: «cuando I_D = 0, V_D = 0».
 * - El análisis final se muestra con el motor MNA de Circuitos y Sistemas.
 */
import { formatNumber, latexLines, toLatexNumber, toLatexText } from '@/lib/math/format';
import {
  componentLabel,
  type CircuitComponent,
  type CircuitNode,
  type CircuitTopology,
  type MappedComponent,
} from '../circuitos-y-sistemas/circuit';
import { solveMna, type BranchResult } from '../circuitos-y-sistemas/mna';
import type { Notice, ResultTable, Step } from '../types';
import { engTex, engText } from './units';

const n = (v: number, d = 6) => toLatexNumber(v, d);

export type NetworkModel = 'ideal' | 'segunda' | 'tercera';

export interface NetworkDiodeResult {
  id: string;
  label: string;
  on: boolean;
  /** V_AK: ánodo menos cátodo; NaN si queda indeterminado. */
  vd: number;
  /** Corriente del ánodo al cátodo. */
  current: number;
  power: number;
}

export interface DiodeNetworkValue {
  diodes: NetworkDiodeResult[];
  /** Voltaje de cada nodo de la topología respecto de la referencia (NaN si indeterminado). */
  nodeVoltages: number[];
  /** Resistencias y fuentes. */
  branches: BranchResult[];
  /** Suposiciones evaluadas hasta la consistente. */
  assumptions: number;
}

export type DiodeNetworkErrorCode = 'sin-solucion' | 'demasiados-diodos' | 'singular';

export type DiodeNetworkOutcome =
  | {
      ok: true;
      value: DiodeNetworkValue;
      steps: Step[];
      tables: ResultTable[];
      notices: Notice[];
    }
  | {
      ok: false;
      code: DiodeNetworkErrorCode;
      message: string;
      steps: Step[];
      tables: ResultTable[];
    };

interface DiodeUnit {
  label: string;
  members: CircuitComponent[];
  anode: number;
  cathode: number;
  vk: number;
}

interface LinearSolution {
  /** Por nodo de la topología (la referencia vale 0). */
  v: number[];
  /** Corriente de cada unidad, del ánodo al cátodo (la del grupo completo). */
  current: number[];
}

const MAX_UNITS = 12;

const texLabel = (label: string) => toLatexText(label);

/** Voltajes en el texto como los escribe el libro: 0.7 V y no 700 mV. */
const volts = (v: number) => `${formatNumber(v, 4).replace('-', '−')} V`;

// ─── Álgebra: MNA numérica con equilibrado de filas ─────────────────────────

function gaussSolve(a: number[][], b: number[]): number[] | null {
  const size = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  // Equilibrado: cada fila se divide entre su mayor coeficiente. Así un nodo unido solo por
  // conductancias pequeñas no se confunde con una fila nula.
  for (const row of m) {
    let max = 0;
    for (let j = 0; j < size; j++) max = Math.max(max, Math.abs(row[j]!));
    if (max === 0) return null;
    for (let j = 0; j <= size; j++) row[j] = row[j]! / max;
  }
  for (let k = 0; k < size; k++) {
    let pivot = k;
    for (let i = k + 1; i < size; i++) if (Math.abs(m[i]![k]!) > Math.abs(m[pivot]![k]!)) pivot = i;
    if (Math.abs(m[pivot]![k]!) < 1e-11) return null;
    [m[k], m[pivot]] = [m[pivot]!, m[k]!];
    for (let i = k + 1; i < size; i++) {
      const f = m[i]![k]! / m[k]![k]!;
      if (f === 0) continue;
      for (let j = k; j <= size; j++) m[i]![j] = m[i]![j]! - f * m[k]![j]!;
    }
  }
  const x = Array<number>(size).fill(0);
  for (let i = size - 1; i >= 0; i--) {
    let s = m[i]![size]!;
    for (let j = i + 1; j < size; j++) s -= m[i]![j]! * x[j]!;
    x[i] = s / m[i]![i]!;
  }
  return x;
}

interface SolveOptions {
  /** Conductancia de un diodo apagado; `null` = circuito abierto. */
  offConductance: number;
  /** Unidades encendidas que se toman como fuentes de 0 V (sin corriente). */
  zeroVk?: ReadonlySet<number>;
}

function solveState(
  topology: CircuitTopology,
  units: DiodeUnit[],
  states: readonly boolean[],
  model: NetworkModel,
  rb: number,
  options: SolveOptions,
): LinearSolution | null {
  const { nodes, components, referenceNode } = topology;
  const row = new Map<number, number>();
  let size = 0;
  for (let i = 0; i < nodes.length; i++) if (i !== referenceNode) row.set(i, size++);
  const internal = new Map<number, number>();
  if (model === 'tercera' && rb > 0) {
    units.forEach((_, u) => {
      if (states[u]) internal.set(u, size++);
    });
  }
  const sources: { pos: number; neg: number; value: number; unit?: number }[] = [];
  for (const { component, nodeA, nodeB } of components) {
    if (component.kind === 'voltage-source') {
      sources.push({
        pos: row.get(nodeA) ?? -1,
        neg: row.get(nodeB) ?? -1,
        value: component.value,
      });
    }
  }
  units.forEach((unit, u) => {
    if (!states[u]) return;
    const vk = options.zeroVk?.has(u) ? 0 : unit.vk;
    const neg = internal.get(u) ?? row.get(unit.cathode) ?? -1;
    sources.push({ pos: row.get(unit.anode) ?? -1, neg, value: vk, unit: u });
  });
  const nV = size;
  const total = nV + sources.length;
  const a = Array.from({ length: total }, () => Array<number>(total).fill(0));
  const b = Array<number>(total).fill(0);
  const conductance = (g: number, p: number, q: number) => {
    if (p >= 0) a[p]![p]! += g;
    if (q >= 0) a[q]![q]! += g;
    if (p >= 0 && q >= 0) {
      a[p]![q]! -= g;
      a[q]![p]! -= g;
    }
  };
  for (const { component, nodeA, nodeB } of components) {
    const p = row.get(nodeA) ?? -1;
    const q = row.get(nodeB) ?? -1;
    if (component.kind === 'resistor') conductance(1 / component.value, p, q);
    else if (component.kind === 'current-source') {
      if (p >= 0) b[p]! -= component.value;
      if (q >= 0) b[q]! += component.value;
    }
  }
  units.forEach((unit, u) => {
    const k = internal.get(u);
    if (states[u] && k !== undefined)
      conductance(unit.members.length / rb, k, row.get(unit.cathode) ?? -1);
    if (!states[u])
      conductance(options.offConductance, row.get(unit.anode) ?? -1, row.get(unit.cathode) ?? -1);
  });
  sources.forEach((s, idx) => {
    const k = nV + idx;
    if (s.pos >= 0) {
      a[s.pos]![k]! += 1;
      a[k]![s.pos]! += 1;
    }
    if (s.neg >= 0) {
      a[s.neg]![k]! -= 1;
      a[k]![s.neg]! -= 1;
    }
    b[k] = s.value;
  });
  const x = gaussSolve(a, b);
  if (!x) return null;
  const v = nodes.map((_, i) => (i === referenceNode ? 0 : x[row.get(i)!]!));
  const current = units.map((unit, u) => {
    if (!states[u]) return options.offConductance * (v[unit.anode]! - v[unit.cathode]!);
    const idx = sources.findIndex((s) => s.unit === u);
    return x[nV + idx]!;
  });
  return { v, current };
}

// ─── Método de los estados supuestos ────────────────────────────────────────

interface Check {
  unit: number;
  on: boolean;
  /** I_D si está encendido; V_AK si está apagado. */
  value: number;
  ok: boolean;
  /** Cuánto se aleja de la suposición (para elegir qué diodo cambiar). */
  severity: number;
}

interface Evaluation {
  state: boolean[];
  solution: LinearSolution | null;
  checks: Check[];
  consistent: boolean;
  /** Suposición de la que sale esta (índice en la traza) y diodo que se cambió. */
  from?: number;
  flip?: number;
  /** Encontrada al probar las combinaciones restantes. */
  exhaustive?: boolean;
}

const stateKey = (state: readonly boolean[]) => state.map((s) => (s ? '1' : '0')).join('');

function describeState(units: DiodeUnit[], state: readonly boolean[]): string {
  return units.map((u, i) => `${u.label} ${state[i] ? 'encendido' : 'apagado'}`).join(', ');
}

export function solveDiodeNetwork(
  topology: CircuitTopology,
  model: NetworkModel,
  rb: number,
): DiodeNetworkOutcome {
  const { components } = topology;
  const steps: Step[] = [];
  const notices: Notice[] = [];

  // Escalas para las tolerancias.
  const resistors = components
    .filter((c) => c.component.kind === 'resistor')
    .map((c) => c.component.value);
  const gMin = resistors.length ? 1 / Math.max(...resistors) : 1e-3;
  const offConductance = gMin * 1e-9;
  const vScale = Math.max(
    1,
    ...components
      .filter((c) => c.component.kind === 'voltage-source')
      .map((c) => Math.abs(c.component.value)),
    ...components
      .filter((c) => c.component.kind === 'current-source')
      .map((c) => Math.abs(c.component.value) * (resistors.length ? Math.max(...resistors) : 1)),
  );
  const tolV = 1e-7 * vScale;
  const tolI = 1e-6 * vScale * gMin;

  // Unidades: diodos iguales en paralelo van juntos.
  const units: DiodeUnit[] = [];
  const shorted: CircuitComponent[] = [];
  for (const { component, nodeA, nodeB } of components) {
    if (component.kind !== 'diode') continue;
    if (nodeA === nodeB) {
      shorted.push(component);
      continue;
    }
    const vk = model === 'ideal' ? 0 : component.value;
    const same = units.find((u) => u.anode === nodeA && u.cathode === nodeB && u.vk === vk);
    if (same) {
      same.members.push(component);
      same.label = same.members.map(componentLabel).join(' ∥ ');
    } else {
      units.push({
        label: componentLabel(component),
        members: [component],
        anode: nodeA,
        cathode: nodeB,
        vk,
      });
    }
  }
  if (units.length > MAX_UNITS) {
    const message = `El circuito tiene ${units.length} diodos (o grupos en paralelo); el análisis admite hasta ${MAX_UNITS}.`;
    return { ok: false, code: 'demasiados-diodos', message, steps, tables: [] };
  }
  if (shorted.length) {
    notices.push({
      level: 'info',
      message: `${shorted.map(componentLabel).join(', ')} tiene sus dos terminales en el mismo nodo: queda en cortocircuito y no conduce.`,
    });
  }
  const grouped = units.filter((u) => u.members.length > 1);
  if (grouped.length) {
    notices.push({
      level: 'info',
      message: `${grouped.map((u) => u.label).join('; ')}: diodos iguales en paralelo. Se analizan como uno y se reparten la corriente por partes iguales (Boylestad, ejemplo 2.10).`,
    });
  }

  const modelText =
    model === 'ideal'
      ? 'Modelo ideal: encendido = cortocircuito (V_D = 0); apagado = circuito abierto.'
      : model === 'segunda'
        ? 'Segunda aproximación: encendido = fuente de V_K (el valor de cada diodo); apagado = circuito abierto.'
        : `Tercera aproximación: encendido = fuente de V_K en serie con r_B = ${engText(rb, 'Ω')}; apagado = circuito abierto.`;
  steps.push({
    title: 'Método de los estados supuestos',
    explanation: `${modelText} Se supone el estado de cada diodo, se resuelve el circuito lineal y se verifica: un diodo encendido debe conducir en el sentido de su flecha (I_D ≥ 0) y uno apagado no debe alcanzar su umbral (V_AK ≤ V_K). Se empieza con todos apagados.`,
    formula:
      model === 'ideal'
        ? '\\text{encendido: } I_D \\ge 0,\\qquad \\text{apagado: } V_{AK} \\le 0'
        : '\\text{encendido: } I_D \\ge 0,\\qquad \\text{apagado: } V_{AK} \\le V_K',
  });

  const solveFor = (state: readonly boolean[], zeroVk?: ReadonlySet<number>) =>
    solveState(topology, units, state, model, rb, { offConductance, zeroVk });

  const evaluate = (state: boolean[]): Evaluation => {
    const solution = solveFor(state);
    if (!solution) return { state, solution, checks: [], consistent: false };
    const checks: Check[] = units.map((unit, u) => {
      if (state[u]) {
        const i = solution.current[u]!;
        return {
          unit: u,
          on: true,
          value: i,
          ok: i >= -tolI,
          severity: -i / Math.max(tolI, 1e-300),
        };
      }
      const vak = solution.v[unit.anode]! - solution.v[unit.cathode]!;
      return {
        unit: u,
        on: false,
        value: vak,
        ok: vak <= unit.vk + tolV,
        severity: (vak - unit.vk) / vScale,
      };
    });
    return { state, solution, checks, consistent: checks.every((c) => c.ok) };
  };

  const trail: Evaluation[] = [];
  const visited = new Set<string>();
  let found: Evaluation | null = null;
  let pending: { state: boolean[]; from?: number; flip?: number } | null = {
    state: units.map(() => false),
  };
  let base: number | null = null;
  for (let guard = 0; pending && guard < 4 * units.length + 8; guard++) {
    const ev: Evaluation = { ...evaluate(pending.state), from: pending.from, flip: pending.flip };
    visited.add(stateKey(ev.state));
    trail.push(ev);
    if (ev.consistent) {
      found = ev;
      break;
    }
    if (ev.solution) base = trail.length - 1;
    if (base === null) break;
    // Candidatos: primero los encendidos con corriente al revés, luego los apagados que superan
    // su umbral; en cada grupo, del que más se aleja de su suposición al que menos.
    const origin = trail[base]!;
    const failing = origin.checks
      .filter((c) => !c.ok)
      .sort((x, y) => (x.on === y.on ? y.severity - x.severity : x.on ? -1 : 1));
    pending = null;
    for (const c of failing) {
      const candidate = origin.state.map((s, i) => (i === c.unit ? !s : s));
      if (!visited.has(stateKey(candidate))) {
        pending = { state: candidate, from: base, flip: c.unit };
        break;
      }
    }
  }

  if (!found) {
    // Respaldo: se prueban todas las combinaciones, de la más parecida a la última a la menos.
    const last = base !== null ? trail[base]!.state : units.map(() => false);
    const all: boolean[][] = [];
    for (let mask = 0; mask < 1 << units.length; mask++)
      all.push(units.map((_, i) => Boolean(mask & (1 << i))));
    const distance = (s: boolean[]) => s.reduce((d, x, i) => d + (x !== last[i] ? 1 : 0), 0);
    all.sort((x, y) => distance(x) - distance(y));
    for (const candidate of all) {
      if (visited.has(stateKey(candidate))) continue;
      const ev = evaluate(candidate);
      if (ev.consistent) {
        trail.push({ ...ev, exhaustive: true });
        found = ev;
        break;
      }
    }
  }

  // Traza de las suposiciones.
  const assumptionRows: Record<string, string>[] = [];
  trail.forEach((ev, k) => {
    const text = describeState(units, ev.state);
    if (!ev.solution) {
      steps.push({
        title: `Suposición ${k + 1}`,
        explanation: `Se supone ${text}. Con esa suposición quedan fuentes de voltaje (diodos encendidos) en paralelo con valores distintos o en un lazo sin resistencia: es imposible y se descarta.`,
      });
      assumptionRows.push({
        k: String(k + 1),
        estados: text,
        verificacion: 'Lazo de fuentes',
        resultado: 'Se descarta',
      });
      return;
    }
    // El diodo que se cambia es el que eligió el algoritmo (la suposición siguiente que sale de esta).
    const child = trail.find((x) => x.from === k);
    const chosen =
      child?.flip !== undefined ? ev.checks.find((c) => c.unit === child.flip) : undefined;
    const first = chosen ?? ev.checks.find((c) => !c.ok);
    const checkLines = ev.checks.map((c) => {
      const label = texLabel(units[c.unit]!.label);
      if (c.on) {
        const i = Math.abs(c.value) < tolI ? 0 : c.value;
        return `${label}:\\ I_D = ${engTex(i, 'A')}\\ ${c.ok ? '\\ge 0\\ \\checkmark' : '< 0\\ \\times'}`;
      }
      const vk = units[c.unit]!.vk;
      // Los residuos de la conductancia de los diodos apagados (10⁻⁸ V) se muestran como 0.
      const vak = Math.abs(c.value) < tolV ? 0 : c.value;
      return `${label}:\\ V_{AK} = ${n(vak, 5)}\\ \\text{V}\\ ${c.ok ? '\\le' : '>'}\\ ${n(vk, 4)}\\ ${c.ok ? '\\checkmark' : '\\times'}`;
    });
    const failText = first
      ? first.on
        ? `${units[first.unit]!.label} encendido llevaría corriente contra su flecha`
        : `${units[first.unit]!.label} apagado tendría V_AK = ${volts(first.value)}, más que su umbral de ${volts(units[first.unit]!.vk)}`
      : '';
    const intro = ev.exhaustive
      ? `Las suposiciones anteriores no llevaron a un estado consistente; probando las combinaciones restantes, se supone ${text}.`
      : `Se supone ${text}.`;
    steps.push({
      title: `Suposición ${k + 1}`,
      explanation: ev.consistent
        ? `${intro} Todas las verificaciones se cumplen: es el estado real de los diodos.`
        : `${intro} Falla: ${failText}. Se cambia el estado de ese diodo y se repite.`,
      formula: checkLines.length ? latexLines(checkLines) : undefined,
      result: ev.consistent
        ? '\\text{Suposición correcta}'
        : first
          ? `\\Rightarrow\\ \\text{se cambia } ${texLabel(units[first.unit]!.label)}`
          : undefined,
    });
    assumptionRows.push({
      k: String(k + 1),
      estados: text,
      verificacion: ev.consistent ? 'Todas se cumplen' : failText,
      resultado: ev.consistent ? 'Correcta' : first ? `Se cambia ${units[first.unit]!.label}` : '—',
    });
  });
  const tables: ResultTable[] = [
    {
      id: 'suposiciones',
      title: 'Suposiciones',
      columns: [
        { key: 'k', header: 'k', format: 'text' },
        { key: 'estados', header: '\\text{Estados supuestos}', format: 'text' },
        { key: 'verificacion', header: '\\text{Verificación}', format: 'text' },
        { key: 'resultado', header: '\\text{Resultado}', format: 'text' },
      ],
      rows: assumptionRows,
    },
  ];

  if (!found?.solution) {
    const message =
      'Ninguna combinación de estados es consistente: revisa si hay diodos encendidos en paralelo con fuentes de otro voltaje. Con la tercera aproximación (r_B > 0) el lazo deja de ser ideal.';
    return { ok: false, code: 'sin-solucion', message, steps, tables };
  }

  // Encendidos sin corriente: se toman como apagados con V_D = 0 (Boylestad, ejemplo 2.8).
  const finalState = [...found.state];
  const foundCurrents = found.solution.current;
  const zero = new Set<number>();
  units.forEach((_, u) => {
    if (finalState[u] && Math.abs(foundCurrents[u]!) <= tolI) zero.add(u);
  });
  let numeric = found.solution;
  if (zero.size) {
    const retry = solveFor(finalState, zero);
    if (retry && [...zero].every((u) => Math.abs(retry.current[u]!) <= tolI)) {
      numeric = retry;
      steps.push({
        title: 'Diodos sin corriente',
        explanation: `${[...zero].map((u) => units[u]!.label).join(', ')} quedan en serie con un diodo apagado: no circula corriente, así que se toman como apagados con V_D = 0 («cuando I_D = 0, V_D = 0», Boylestad, ejemplo 2.8). El diodo apagado soporta todo el voltaje.`,
      });
    } else {
      zero.clear();
    }
  }

  // Circuito equivalente exacto para la traza MNA: apagados abiertos, encendidos como fuentes.
  const exact = buildEquivalent(topology, units, finalState, zero, model, rb);
  const mna = solveMna(exact.topology);
  if (!mna.ok) {
    return { ok: false, code: 'singular', message: mna.message, steps, tables };
  }
  steps.push({
    title: 'Circuito equivalente',
    explanation: `Con los estados ya verificados, ${units
      .map((u, i) =>
        finalState[i] && !zero.has(i)
          ? `${u.label} es una fuente de ${volts(u.vk)}${model === 'tercera' && rb > 0 ? ' en serie con r_B' : ''}`
          : zero.has(i)
            ? `${u.label} es un cortocircuito sin corriente`
            : `${u.label} es un circuito abierto`,
      )
      .join(
        '; ',
      )}. Se resuelve por análisis de nodos.${exact.pruned.length ? ' Los nodos que solo unen diodos apagados quedan aislados y no entran en el sistema.' : ''}`,
  });
  const diodeIds = new Set(exact.diodeSources);
  for (const s of mna.steps) {
    const unit = units.findIndex((u) => s.title === `Fuente de voltaje ${u.label}`);
    steps.push(
      unit >= 0
        ? {
            ...s,
            title: zero.has(unit)
              ? `Diodo ${units[unit]!.label} sin corriente`
              : `Diodo ${units[unit]!.label} encendido`,
            // El MNA escribe «= E» para cualquier fuente; en un diodo es su V_K (o 0 sin corriente).
            formula: s.formula?.replace(/= E$/, zero.has(unit) ? '= 0' : '= V_K'),
          }
        : s,
    );
  }

  // Voltajes de nodo: los del sistema exacto; los aislados quedan indeterminados.
  const nodeVoltages = topology.nodes.map((_, i) => {
    const compact = exact.compactOf.get(i);
    return compact === undefined ? Number.NaN : mna.result.nodeVoltages[compact]!;
  });
  if (exact.pruned.length) {
    notices.push({
      level: 'info',
      message:
        'Hay nodos aislados entre diodos apagados: su voltaje no queda determinado por el circuito.',
    });
  }

  const diodes: NetworkDiodeResult[] = [];
  units.forEach((unit, u) => {
    const on = finalState[u]! && !zero.has(u);
    const sourceBranch = mna.result.branchResults.find((b) => b.id === `diodo-${u}`);
    const groupCurrent = on ? (sourceBranch?.i ?? numeric.current[u]!) : 0;
    const vd = nodeVoltages[unit.anode]! - nodeVoltages[unit.cathode]!;
    for (const member of unit.members) {
      const share = groupCurrent / unit.members.length;
      diodes.push({
        id: member.id,
        label: componentLabel(member),
        on,
        vd,
        current: share,
        power: Number.isFinite(vd) ? vd * share : 0,
      });
    }
  });
  for (const member of shorted) {
    diodes.push({
      id: member.id,
      label: componentLabel(member),
      on: false,
      vd: 0,
      current: 0,
      power: 0,
    });
  }

  const branches = mna.result.branchResults.filter((b) => !diodeIds.has(b.id));
  steps.push({
    title: 'Resultados de los diodos',
    explanation: 'V_D se mide del ánodo al cátodo e I_D en el sentido de la flecha.',
    result: latexLines(
      diodes.map(
        (d) =>
          `${texLabel(d.label)}:\\ ${d.on ? '\\text{encendido}' : '\\text{apagado}'},\\ V_D = ${
            Number.isFinite(d.vd) ? `${n(d.vd, 5)}\\ \\text{V}` : '\\text{indeterminado}'
          },\\ I_D = ${engTex(d.current, 'A')}`,
      ),
    ),
  });

  // La tabla de ramas del MNA trae los diodos como fuentes; van aparte, en la tabla de diodos.
  const diodeRow = (rama: unknown) =>
    units.some(
      (u) => String(rama).startsWith(`${u.label} (`) || String(rama).startsWith(`rB(${u.label})`),
    );
  tables.push(
    ...mna.tables.map((t) =>
      t.id === 'ramas' ? { ...t, rows: t.rows.filter((r) => !diodeRow(r.rama)) } : t,
    ),
  );
  tables.push({
    id: 'diodos',
    title: 'Diodos',
    columns: [
      { key: 'diodo', header: '\\text{Diodo}', format: 'text' },
      { key: 'estado', header: '\\text{Estado}', format: 'text' },
      { key: 'vd', header: 'V_D', format: 'text' },
      { key: 'id', header: 'I_D', format: 'text' },
      { key: 'pd', header: 'P_D', format: 'text' },
    ],
    rows: diodes.map((d) => ({
      diodo: d.label,
      estado: d.on ? 'encendido' : 'apagado',
      vd: Number.isFinite(d.vd) ? volts(Math.abs(d.vd) < tolV ? 0 : d.vd) : 'indeterminado',
      id: engText(d.current, 'A'),
      pd: engText(d.power, 'W'),
    })),
  });
  notices.push(...mna.notices);

  return {
    ok: true,
    value: { diodes, nodeVoltages, branches, assumptions: trail.length },
    steps,
    tables,
    notices,
  };
}

// ─── Circuito equivalente para la traza ─────────────────────────────────────

function buildEquivalent(
  topology: CircuitTopology,
  units: DiodeUnit[],
  state: readonly boolean[],
  zero: ReadonlySet<number>,
  model: NetworkModel,
  rb: number,
): {
  topology: CircuitTopology;
  compactOf: Map<number, number>;
  pruned: number[];
  diodeSources: string[];
} {
  const derived: { component: CircuitComponent; nodeA: number; nodeB: number }[] = [];
  for (const mc of topology.components) {
    if (mc.component.kind !== 'diode') derived.push(mc);
  }
  let nodeCount = topology.nodes.length;
  const extraNodes: number[] = [];
  const diodeSources: string[] = [];
  units.forEach((unit, u) => {
    if (!state[u]) return;
    const id = `diodo-${u}`;
    diodeSources.push(id);
    const vk = zero.has(u) ? 0 : unit.vk;
    const source: CircuitComponent = {
      ...unit.members[0]!,
      id,
      kind: 'voltage-source',
      value: vk,
      label: unit.label,
    };
    if (model === 'tercera' && rb > 0 && !zero.has(u)) {
      const k = nodeCount++;
      extraNodes.push(k);
      derived.push({ component: source, nodeA: unit.anode, nodeB: k });
      const rbId = `rb-${u}`;
      diodeSources.push(rbId);
      derived.push({
        component: {
          ...unit.members[0]!,
          id: rbId,
          kind: 'resistor',
          value: rb / unit.members.length,
          label: `rB(${unit.label})`,
        },
        nodeA: k,
        nodeB: unit.cathode,
      });
    } else {
      derived.push({ component: source, nodeA: unit.anode, nodeB: unit.cathode });
    }
  });

  // Nodos que determinan su voltaje: unidos a la referencia por resistencias o fuentes de voltaje.
  const adjacency = Array.from({ length: nodeCount }, () => new Set<number>());
  for (const { component, nodeA, nodeB } of derived) {
    if (component.kind === 'current-source') continue;
    adjacency[nodeA]!.add(nodeB);
    adjacency[nodeB]!.add(nodeA);
  }
  const reached = new Set<number>([topology.referenceNode]);
  const stack = [topology.referenceNode];
  while (stack.length) {
    const x = stack.pop()!;
    for (const y of adjacency[x]!) {
      if (!reached.has(y)) {
        reached.add(y);
        stack.push(y);
      }
    }
  }
  const used = new Set<number>();
  for (const { nodeA, nodeB } of derived) {
    used.add(nodeA);
    used.add(nodeB);
  }
  const keep = [...Array(nodeCount).keys()].filter(
    (i) => reached.has(i) && (used.has(i) || i === topology.referenceNode),
  );
  const pruned = topology.nodes
    .map((_, i) => i)
    .filter((i) => !reached.has(i) && topology.nodes[i]!.terminals.length > 0);
  const compactOf = new Map<number, number>();
  keep.forEach((i, idx) => compactOf.set(i, idx));

  const components: MappedComponent[] = derived
    .filter(({ nodeA, nodeB }) => compactOf.has(nodeA) && compactOf.has(nodeB))
    .map(({ component, nodeA, nodeB }) => ({
      component,
      nodeA: compactOf.get(nodeA)!,
      nodeB: compactOf.get(nodeB)!,
    }));
  const nodes: CircuitNode[] = keep.map((i, idx) => ({
    index: idx,
    points: i < topology.nodes.length ? topology.nodes[i]!.points : [],
    terminals: [],
    isGround: i === topology.referenceNode,
  }));
  for (const mc of components) {
    nodes[mc.nodeA]!.terminals.push({ component: mc.component, terminal: 'a' });
    nodes[mc.nodeB]!.terminals.push({ component: mc.component, terminal: 'b' });
  }
  return {
    topology: {
      nodes,
      nodeOf: new Map(),
      components,
      referenceNode: compactOf.get(topology.referenceNode)!,
    },
    compactOf,
    pruned,
    diodeSources,
  };
}
