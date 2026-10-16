/**
 * Circuitos con amplificadores operacionales ideales dibujados en el constructor.
 *
 * El amplificador ideal (Boylestad y Nashelsky, 10.ª ed. en español, sec. 10.4 y 10.5; Malvino,
 * 6.ª ed., cap. 18) no toma corriente por sus entradas y, con realimentación negativa, mantiene
 * v₊ = v₋ (cortocircuito virtual). En el análisis de nodos su salida es una fuente controlada a
 * tierra: la corriente de salida es una incógnita y su ecuación es v₊ − v₋ = 0 (`solveMna`).
 *
 * Antes se verifica que cada amplificador tenga realimentación negativa: con las fuentes
 * independientes anuladas se aplica 1 V a su salida y se mide v₊ − v₋. Si sale negativo, el lazo
 * corrige el error y el modelo lineal vale; si sale cero (lazo abierto, un comparador) o positivo
 * (un disparador de Schmitt), la salida se satura y el cortocircuito virtual no vale.
 *
 * Con V_sat, una salida que pida más de ±V_sat se fija en ese valor y se vuelve a resolver.
 */
import { formatNumber, latexLines, toLatexNumber, toLatexText } from '@/lib/math/format';
import {
  componentLabel,
  type CircuitTopology,
  type MappedComponent,
} from '../circuitos-y-sistemas/circuit';
import { solveMna, type BranchResult, type MnaSolve } from '../circuitos-y-sistemas/mna';
import type { Notice, ResultTable, Step } from '../types';
import { engTex, engText } from './units';

const n = (v: number, d = 6) => toLatexNumber(v, d);
const volts = (v: number) => `${formatNumber(Math.abs(v) < 1e-12 ? 0 : v, 5).replace('-', '−')} V`;

export interface NetworkOpAmpResult {
  id: string;
  label: string;
  vplus: number;
  vminus: number;
  vout: number;
  /** Corriente que entrega la salida al circuito. */
  iout: number;
  /** v₊ − v₋ por cada volt aplicado a la salida, con las fuentes anuladas (negativo = realimentación negativa). */
  loop: number;
  /** +1 o −1 si la salida quedó saturada. */
  saturated?: 1 | -1;
  /** v_o/V_s cuando el circuito tiene una sola fuente de voltaje. */
  gain?: number;
}

export interface OpAmpNetworkValue {
  opamps: NetworkOpAmpResult[];
  nodeVoltages: number[];
  branches: BranchResult[];
}

export type OpAmpNetworkErrorCode = 'sin-realimentacion-negativa' | 'salida-a-tierra' | 'singular';

export type OpAmpNetworkOutcome =
  | { ok: true; value: OpAmpNetworkValue; steps: Step[]; tables: ResultTable[]; notices: Notice[] }
  | {
      ok: false;
      code: OpAmpNetworkErrorCode;
      message: string;
      steps: Step[];
      tables: ResultTable[];
    };

const v = (topology: CircuitTopology, node: number) =>
  node === topology.referenceNode ? '0' : `v_${node + 1}`;

/** Copia de la topología con algunos componentes cambiados (los nodos no cambian). */
function withComponents(topology: CircuitTopology, components: MappedComponent[]): CircuitTopology {
  return { ...topology, components };
}

/** Un amplificador reemplazado por una fuente de voltaje de su salida a tierra. */
function outputSource(
  topology: CircuitTopology,
  op: MappedComponent,
  value: number,
  label: string,
): MappedComponent {
  return {
    component: { ...op.component, id: op.component.id, kind: 'voltage-source', value, label },
    nodeA: op.nodeC!,
    nodeB: topology.referenceNode,
  };
}

export function solveOpAmpNetwork(topology: CircuitTopology, vsat?: number): OpAmpNetworkOutcome {
  const steps: Step[] = [];
  const notices: Notice[] = [];
  const opamps = topology.components.filter((c) => c.component.kind === 'opamp');
  const label = (op: MappedComponent) => componentLabel(op.component);

  steps.push({
    title: 'Amplificador operacional ideal',
    explanation:
      'Ganancia en lazo abierto infinita, impedancia de entrada infinita y de salida nula: no entra corriente por las entradas y, con realimentación negativa, la salida toma el valor que deja v₊ = v₋ (cortocircuito virtual). En el análisis de nodos, la salida es una fuente a tierra cuya corriente es una incógnita más.',
    formula: 'i_{+} = i_{-} = 0,\\qquad v_{+} = v_{-}',
  });

  const grounded = opamps.find((op) => op.nodeC === topology.referenceNode);
  if (grounded) {
    const message = `La salida de ${label(grounded)} está conectada a la referencia: así no puede fijar ningún voltaje. Revisa el cableado.`;
    return { ok: false, code: 'salida-a-tierra', message, steps, tables: [] };
  }

  // Realimentación: fuentes anuladas y 1 V de prueba en la salida de cada amplificador.
  const loops: number[] = [];
  for (const op of opamps) {
    const test = topology.components.map((c) => {
      if (c === op) return outputSource(topology, op, 1, `${label(op)} (prueba)`);
      if (c.component.kind === 'voltage-source' || c.component.kind === 'current-source') {
        return { ...c, component: { ...c.component, value: 0 } };
      }
      return c;
    });
    const solved = solveMna(withComponents(topology, test));
    const loop = solved.ok
      ? solved.result.nodeVoltages[op.nodeB]! - solved.result.nodeVoltages[op.nodeA]!
      : Number.NaN;
    loops.push(loop);
    const negative = loop < -1e-9;
    steps.push({
      title: `Realimentación de ${label(op)}`,
      explanation: Number.isNaN(loop)
        ? `No se pudo medir el lazo de ${label(op)}: revisa que su salida no esté unida a otra fuente.`
        : negative
          ? `Con las fuentes independientes anuladas se aplica 1 V a la salida de ${label(op)}: la diferencia v₊ − v₋ sale negativa, así que el lazo se opone al cambio (realimentación negativa) y el cortocircuito virtual vale.`
          : Math.abs(loop) <= 1e-9
            ? `Con las fuentes anuladas, 1 V en la salida de ${label(op)} no llega a sus entradas: no hay realimentación. Trabaja en lazo abierto, como comparador, y su salida se satura.`
            : `Con las fuentes anuladas, 1 V en la salida de ${label(op)} aumenta v₊ − v₋: la realimentación es positiva (disparador de Schmitt) y la salida se satura.`,
      formula: '\\left.(v_{+} - v_{-})\\right|_{v_o = 1\\ \\text{V}}',
      result: Number.isNaN(loop)
        ? undefined
        : `v_{+} - v_{-} = ${n(Math.abs(loop) < 1e-12 ? 0 : loop)}\\ \\text{V}\\ ${negative ? '< 0\\ \\checkmark' : '\\ge 0\\ \\times'}`,
    });
  }
  const bad = opamps.findIndex((_, i) => !(loops[i]! < -1e-9));
  if (bad >= 0) {
    const op = opamps[bad]!;
    const loop = loops[bad]!;
    const message = Number.isNaN(loop)
      ? `No se pudo resolver el lazo de ${label(op)}. Revisa que su salida no quede en paralelo con una fuente de voltaje o con otra salida.`
      : Math.abs(loop) <= 1e-9
        ? `${label(op)} no tiene realimentación (lazo abierto): funciona como comparador y su salida se satura. Usa el modo «configuración» para comparadores.`
        : `${label(op)} tiene realimentación positiva: no trabaja en la zona lineal (es un disparador de Schmitt). Conecta la realimentación a la entrada inversora (−) o usa el modo «configuración».`;
    return { ok: false, code: 'sin-realimentacion-negativa', message, steps, tables: [] };
  }

  // Resolución lineal y, si hace falta, saturación de las salidas.
  const saturated = new Map<MappedComponent, 1 | -1>();
  let mna: MnaSolve | null = null;
  for (let round = 0; round <= opamps.length; round++) {
    const components = topology.components.map((c) => {
      const sign = saturated.get(c);
      return sign ? outputSource(topology, c, sign * vsat!, label(c)) : c;
    });
    const solved = solveMna(withComponents(topology, components));
    if (!solved.ok) {
      return { ok: false, code: 'singular', message: solved.message, steps, tables: [] };
    }
    mna = solved;
    if (vsat === undefined) break;
    const over = opamps.filter(
      (op) => !saturated.has(op) && Math.abs(solved.result.nodeVoltages[op.nodeC!]!) > vsat + 1e-9,
    );
    if (!over.length) break;
    for (const op of over) {
      const vo = solved.result.nodeVoltages[op.nodeC!]!;
      const sign: 1 | -1 = vo > 0 ? 1 : -1;
      saturated.set(op, sign);
      steps.push({
        title: `Saturación de ${label(op)}`,
        explanation: `El modelo lineal pide v_o = ${volts(vo)}, más que la saturación de ±${volts(vsat)}. La salida queda fija en ${volts(sign * vsat)} y las entradas ya no son iguales; se vuelve a resolver con la salida como fuente.`,
        formula: '|v_o| \\le V_{sat}',
        result: `v_o = ${n(sign * vsat)}\\ \\text{V}`,
      });
      notices.push({
        level: 'warning',
        message: `${label(op)} se satura en ${volts(sign * vsat)}: fuera de la zona lineal, v₊ ≠ v₋.`,
      });
    }
  }
  const final = mna!;

  steps.push({
    title: 'Análisis de nodos',
    explanation:
      'Se plantea KCL en cada nodo; la salida de cada amplificador aporta su corriente i como incógnita y la ecuación del cortocircuito virtual.',
  });
  for (const s of final.steps) {
    const op = opamps.find((o) => saturated.has(o) && s.title === `Fuente de voltaje ${label(o)}`);
    steps.push(
      op
        ? {
            ...s,
            title: `${label(op)} saturado`,
            formula: `${v(topology, op.nodeC!)} = \\pm V_{sat}`,
          }
        : s,
    );
  }

  // Ganancia respecto de la única fuente de voltaje, si la hay.
  const sources = topology.components.filter(
    (c) => c.component.kind === 'voltage-source' || c.component.kind === 'current-source',
  );
  const single =
    sources.length === 1 &&
    sources[0]!.component.kind === 'voltage-source' &&
    sources[0]!.component.value !== 0
      ? sources[0]!
      : undefined;

  const nodeVoltages = final.result.nodeVoltages;
  const results: NetworkOpAmpResult[] = opamps.map((op, i) => {
    const vout = nodeVoltages[op.nodeC!]!;
    const branch = final.result.branchResults.find((b) => b.id === op.component.id);
    return {
      id: op.component.id,
      label: label(op),
      vplus: nodeVoltages[op.nodeB]!,
      vminus: nodeVoltages[op.nodeA]!,
      vout,
      iout: branch ? -branch.i : 0,
      loop: loops[i]!,
      saturated: saturated.get(op),
      gain: single ? vout / single.component.value : undefined,
    };
  });

  steps.push({
    title: 'Resultados de los amplificadores',
    explanation: `${single ? `Con una sola fuente (${componentLabel(single.component)}), la ganancia es A_v = v_o/${componentLabel(single.component)}. ` : ''}i_o es la corriente que entrega cada salida al circuito.`,
    result: latexLines(
      results.map(
        (r) =>
          `${toLatexText(r.label)}:\\ v_o = ${n(r.vout)}\\ \\text{V},\\ v_{+} = ${n(r.vplus)}\\ \\text{V},\\ v_{-} = ${n(r.vminus)}\\ \\text{V},\\ i_o = ${engTex(r.iout, 'A')}${
            r.gain !== undefined ? `,\\ A_v = ${n(r.gain)}` : ''
          }`,
      ),
    ),
  });

  const tables: ResultTable[] = [
    ...final.tables,
    {
      id: 'amplificadores',
      title: 'Amplificadores operacionales',
      columns: [
        { key: 'u', header: '\\text{Amplificador}', format: 'text' },
        { key: 'vp', header: 'v_{+}', format: 'text' },
        { key: 'vm', header: 'v_{-}', format: 'text' },
        { key: 'vo', header: 'v_o', format: 'text' },
        { key: 'io', header: 'i_o', format: 'text' },
        { key: 'av', header: 'A_v', format: 'text' },
      ],
      rows: results.map((r) => ({
        u: r.saturated ? `${r.label} (saturado)` : r.label,
        vp: volts(r.vplus),
        vm: volts(r.vminus),
        vo: volts(r.vout),
        io: engText(r.iout, 'A'),
        av: r.gain !== undefined ? formatNumber(r.gain, 5).replace('-', '−') : '—',
      })),
    },
  ];
  notices.push(...final.notices);

  return {
    ok: true,
    value: { opamps: results, nodeVoltages, branches: final.result.branchResults },
    steps,
    tables,
    notices,
  };
}
