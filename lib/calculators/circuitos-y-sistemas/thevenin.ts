/**
 * Equivalentes de Thévenin y Norton y máxima transferencia de potencia.
 *
 * Se elige una resistencia de carga. Su equivalente de Thévenin se calcula:
 *  - V_th: tensión en circuito abierto entre los terminales de la carga (se quita la carga y se
 *    resuelve por MNA).
 *  - R_th: resistencia vista desde esos terminales con todas las fuentes independientes apagadas
 *    (V → 0 V, I → 0 A), aplicando una fuente de prueba de 1 A y midiendo la tensión resultante
 *    (R_th = V / I).
 * El equivalente de Norton es I_N = V_th / R_th en paralelo con R_th. La máxima transferencia de
 * potencia ocurre con R_L = R_th y vale P_máx = V_th² / (4 R_th).
 *
 * Fuente: Hayt, Kemmerly & Durbin, *Análisis de Circuitos en Ingeniería*, 7.ª ed., cap. 4.
 */
import { formatNumber } from '@/lib/math/format';
import type { Notice, ResultTable, Step } from '../types';
import {
  buildTopology,
  componentLabel,
  validateTopology,
  type CircuitComponent,
  type CircuitDocument,
  type CircuitErrorCode,
  type GridPoint,
} from './circuit';
import { solveMna } from './mna';

export interface TheveninResult {
  loadId: string;
  loadLabel: string;
  loadValue: number;
  a: GridPoint;
  b: GridPoint;
  vTh: number;
  rTh: number;
  iN: number;
  pMax: number;
  loadCurrent: number;
  loadPower: number;
}

export type TheveninErrorCode =
  CircuitErrorCode | 'carga-no-valida' | 'terminal-flotante' | 'sin-fuentes' | 'singular';

export interface TheveninSolve {
  ok: true;
  result: TheveninResult;
  steps: Step[];
  tables: ResultTable[];
  notices: Notice[];
}

export interface TheveninFailure {
  ok: false;
  code: TheveninErrorCode;
  message: string;
}

export type TheveninOutcome = TheveninSolve | TheveninFailure;

function deactivateSources(components: CircuitComponent[]): CircuitComponent[] {
  return components.map((c) => (c.kind === 'resistor' ? c : { ...c, value: 0 }));
}

/** Tensión entre dos terminales tras resolver el circuito, o `null` si un terminal queda aislado. */
function voltageBetween(doc: CircuitDocument, a: GridPoint, b: GridPoint): number | null {
  const topology = buildTopology(doc);
  const ia = topology.nodeOf.get(`${a.x},${a.y}`);
  const ib = topology.nodeOf.get(`${b.x},${b.y}`);
  if (ia === undefined || ib === undefined) return null;
  const mna = solveMna(topology);
  if (!mna.ok) return null;
  return mna.result.nodeVoltages[ia]! - mna.result.nodeVoltages[ib]!;
}

/** Calcula el equivalente de Thévenin/Norton visto por la resistencia de carga indicada. */
export function computeThevenin(doc: CircuitDocument, loadId: string): TheveninOutcome {
  const load = doc.components.find((c) => c.id === loadId);
  if (!load) {
    return {
      ok: false,
      code: 'carga-no-valida',
      message: 'Elige una resistencia de carga entre cuyos terminales buscar el equivalente.',
    };
  }
  if (load.kind !== 'resistor') {
    return {
      ok: false,
      code: 'carga-no-valida',
      message: `La carga (${componentLabel(load)}) debe ser una resistencia.`,
    };
  }
  const structural = validateTopology(buildTopology(doc));
  if (structural) {
    return { ok: false, code: structural.code, message: structural.message };
  }

  const withoutLoad: CircuitDocument = {
    ...doc,
    components: doc.components.filter((c) => c.id !== loadId),
  };
  if (!withoutLoad.components.some((c) => c.kind !== 'resistor')) {
    return {
      ok: false,
      code: 'sin-fuentes',
      message: 'Al quitar la carga, el circuito no tiene fuentes independientes.',
    };
  }

  const vTh = voltageBetween(withoutLoad, load.a, load.b);
  if (vTh === null) {
    return {
      ok: false,
      code: 'terminal-flotante',
      message:
        'Al quitar la carga, alguno de sus terminales queda desconectado. Conecta ambos terminales al resto del circuito.',
    };
  }

  const testDoc: CircuitDocument = {
    ...withoutLoad,
    components: [
      ...deactivateSources(withoutLoad.components),
      { id: '__test__', kind: 'current-source', a: load.b, b: load.a, value: 1, label: 'I_t' },
    ],
  };
  const rThMeasured = voltageBetween(testDoc, load.a, load.b);
  const rTh = rThMeasured === null ? Number.POSITIVE_INFINITY : rThMeasured;

  const finite = Number.isFinite(rTh);
  const iN = finite ? (Math.abs(rTh) < 1e-12 ? Number.POSITIVE_INFINITY : vTh / rTh) : 0;
  const pMax = finite && rTh > 1e-12 ? (vTh * vTh) / (4 * rTh) : Number.POSITIVE_INFINITY;
  const total = rTh + load.value;
  const loadCurrent = finite && total > 1e-12 ? vTh / total : 0;
  const loadPower = loadCurrent * loadCurrent * load.value;

  const result: TheveninResult = {
    loadId,
    loadLabel: componentLabel(load),
    loadValue: load.value,
    a: load.a,
    b: load.b,
    vTh,
    rTh,
    iN,
    pMax,
    loadCurrent,
    loadPower,
  };

  const summaryTable: ResultTable = {
    id: 'equivalente',
    title: 'Equivalente de Thévenin y Norton',
    columns: [
      { key: 'magnitud', header: 'Magnitud' },
      { key: 'valor', header: 'Valor' },
    ],
    rows: [
      { magnitud: 'Tensión de Thévenin V_{th}', valor: `${formatNumber(vTh, 6)} V` },
      {
        magnitud: 'Resistencia de Thévenin R_{th}',
        valor: finite ? `${formatNumber(rTh, 6)} Ω` : '∞ (circuito abierto)',
      },
      {
        magnitud: 'Corriente de Norton I_{N}',
        valor: Number.isFinite(iN) ? `${formatNumber(iN, 6)} A` : '∞ (fuente ideal)',
      },
      {
        magnitud: 'Potencia máxima P_{máx}',
        valor: Number.isFinite(pMax) ? `${formatNumber(pMax, 6)} W` : '—',
      },
      {
        magnitud: `Corriente de la carga ${loadLabel(load)}`,
        valor: `${formatNumber(loadCurrent, 6)} A`,
      },
      {
        magnitud: `Potencia de la carga ${loadLabel(load)}`,
        valor: `${formatNumber(loadPower, 6)} W`,
      },
    ],
  };

  const steps: Step[] = [
    {
      title: 'Carga y terminales',
      explanation: `Se busca el equivalente visto por ${componentLabel(load)} (${formatNumber(load.value, 6)} Ω), entre (${load.a.x}, ${load.a.y}) y (${load.b.x}, ${load.b.y}).`,
    },
    {
      title: 'Tensión de Thévenin (circuito abierto)',
      explanation:
        'Se retira la carga y se mide la tensión entre sus terminales. Al no circular corriente por la carga, es la tensión en circuito abierto.',
      formula: 'V_{th} = v_a - v_b\\ \\text{(sin carga)}',
      result: `V_{th} = ${formatNumber(vTh, 6)}\\text{ V}`,
    },
    {
      title: 'Resistencia de Thévenin',
      explanation:
        'Se apagan todas las fuentes independientes (V → 0 V, I → 0 A), se aplica una fuente de prueba de 1 A entre los terminales y se mide la tensión: R_th = V / I.',
      formula: 'R_{th} = \\frac{V_{prueba}}{1\\text{ A}}',
      result: finite ? `R_{th} = ${formatNumber(rTh, 6)}\\ \\Omega` : 'R_{th} = \\infty',
    },
    {
      title: 'Equivalente de Norton',
      explanation:
        'La fuente de Norton es la corriente de cortocircuito del equivalente de Thévenin.',
      formula: 'I_{N} = \\frac{V_{th}}{R_{th}}',
      result:
        Number.isFinite(iN) && finite
          ? `I_{N} = ${formatNumber(iN, 6)}\\text{ A}`
          : 'I_{N} \\to \\infty',
    },
    {
      title: 'Equivalentes resultantes',
      explanation:
        'El equivalente de Thévenin es una fuente V_th en serie con R_th; el de Norton, una fuente I_N en paralelo con R_th.',
      formula: 'V_{th} = I_{N}\\,R_{th}',
      result: `V_{th} = ${formatNumber(vTh, 6)}\\text{ V},\\ R_{th} = ${finite ? formatNumber(rTh, 6) : '\\infty'}\\ \\Omega`,
    },
    {
      title: 'Con la carga conectada',
      explanation:
        'Al reconectar la carga, la corriente es la tensión de Thévenin entre R_th + R_L.',
      formula: 'i_L = \\frac{V_{th}}{R_{th} + R_L}',
      substitution: `i_L = \\frac{${formatNumber(vTh, 6)}}{${finite ? formatNumber(rTh, 6) : '\\infty'} + ${formatNumber(load.value, 6)}}`,
      result: `i_L = ${formatNumber(loadCurrent, 6)}\\text{ A},\\quad P_L = ${formatNumber(loadPower, 6)}\\text{ W}`,
    },
  ];

  const notices: Notice[] = [];
  if (!finite) {
    notices.push({
      level: 'warning',
      message: 'No hay camino resistivo entre los terminales: R_th es infinita.',
    });
  }
  if (finite && rTh <= 1e-12) {
    notices.push({
      level: 'info',
      message: 'R_th es prácticamente 0 Ω (fuente ideal); la corriente de Norton sería infinita.',
    });
  }

  return { ok: true, result, steps, tables: [summaryTable], notices };
}

function loadLabel(c: CircuitComponent): string {
  return componentLabel(c);
}
