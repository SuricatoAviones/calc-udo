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
import { formatNumber, TEX } from '@/lib/math/format';
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

/** La carga elegida, o el error si no existe o no es una resistencia. */
function findLoad(doc: CircuitDocument, loadId: string): CircuitComponent | TheveninFailure {
  const load = doc.components.find((c) => c.id === loadId);
  if (!load) {
    return {
      ok: false,
      code: 'carga-no-valida',
      message: 'Elige una resistencia de carga entre cuyos terminales buscar el equivalente.',
    };
  }
  if (load.kind === 'resistor') return load;
  return {
    ok: false,
    code: 'carga-no-valida',
    message: `La carga (${componentLabel(load)}) debe ser una resistencia.`,
  };
}

/**
 * R_th: con las fuentes apagadas se aplica 1 A entre los terminales y se mide la tensión. Si no
 * hay camino resistivo, R_th es infinita.
 */
function theveninResistance(withoutLoad: CircuitDocument, load: CircuitComponent): number {
  const testDoc: CircuitDocument = {
    ...withoutLoad,
    components: [
      ...deactivateSources(withoutLoad.components),
      { id: '__test__', kind: 'current-source', a: load.b, b: load.a, value: 1, label: 'I_t' },
    ],
  };
  return voltageBetween(testDoc, load.a, load.b) ?? Number.POSITIVE_INFINITY;
}

/** I_N = V_th / R_th: 0 si R_th es infinita; infinita si R_th es prácticamente 0. */
function nortonCurrent(vTh: number, rTh: number): number {
  if (!Number.isFinite(rTh)) return 0;
  return Math.abs(rTh) < 1e-12 ? Number.POSITIVE_INFINITY : vTh / rTh;
}

/** Valores del equivalente y de la carga reconectada. */
function equivalentValues(vTh: number, rTh: number, loadValue: number) {
  const finite = Number.isFinite(rTh);
  const pMax = finite && rTh > 1e-12 ? (vTh * vTh) / (4 * rTh) : Number.POSITIVE_INFINITY;
  const total = rTh + loadValue;
  const loadCurrent = finite && total > 1e-12 ? vTh / total : 0;
  return {
    iN: nortonCurrent(vTh, rTh),
    pMax,
    loadCurrent,
    loadPower: loadCurrent * loadCurrent * loadValue,
  };
}

function summaryTableOf(result: TheveninResult): ResultTable {
  const { vTh, rTh, iN, pMax, loadCurrent, loadPower, loadLabel } = result;
  const finiteText = (v: number, unit: string, otherwise: string) =>
    Number.isFinite(v) ? `${formatNumber(v, 6)} ${unit}` : otherwise;
  return {
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
        valor: finiteText(rTh, 'Ω', '∞ (circuito abierto)'),
      },
      { magnitud: 'Corriente de Norton I_{N}', valor: finiteText(iN, 'A', '∞ (fuente ideal)') },
      { magnitud: 'Potencia máxima P_{máx}', valor: finiteText(pMax, 'W', '—') },
      {
        magnitud: `Corriente de la carga ${loadLabel}`,
        valor: `${formatNumber(loadCurrent, 6)} A`,
      },
      { magnitud: `Potencia de la carga ${loadLabel}`, valor: `${formatNumber(loadPower, 6)} W` },
    ],
  };
}

function theveninNotices(rTh: number): Notice[] {
  if (!Number.isFinite(rTh)) {
    return [
      {
        level: 'warning',
        message: 'No hay camino resistivo entre los terminales: R_th es infinita.',
      },
    ];
  }
  if (rTh > 1e-12) return [];
  return [
    {
      level: 'info',
      message: 'R_th es prácticamente 0 Ω (fuente ideal); la corriente de Norton sería infinita.',
    },
  ];
}

/** Calcula el equivalente de Thévenin/Norton visto por la resistencia de carga indicada. */
export function computeThevenin(doc: CircuitDocument, loadId: string): TheveninOutcome {
  const load = findLoad(doc, loadId);
  if ('ok' in load) return load;
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

  const rTh = theveninResistance(withoutLoad, load);
  const finite = Number.isFinite(rTh);
  const { iN, pMax, loadCurrent, loadPower } = equivalentValues(vTh, rTh, load.value);

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
  const summaryTable = summaryTableOf(result);
  const rThTex = finite ? formatNumber(rTh, 6) : TEX.infty;

  const steps: Step[] = [
    {
      title: 'Carga y terminales',
      explanation: `Se busca el equivalente visto por ${componentLabel(load)} (${formatNumber(load.value, 6)} Ω), entre (${load.a.x}, ${load.a.y}) y (${load.b.x}, ${load.b.y}).`,
    },
    {
      title: 'Tensión de Thévenin (circuito abierto)',
      explanation:
        'Se retira la carga y se mide la tensión entre sus terminales. Al no circular corriente por la carga, es la tensión en circuito abierto.',
      formula: String.raw`V_{th} = v_a - v_b\ \text{(sin carga)}`,
      result: String.raw`V_{th} = ${formatNumber(vTh, 6)}\text{ V}`,
    },
    {
      title: 'Resistencia de Thévenin',
      explanation:
        'Se apagan todas las fuentes independientes (V → 0 V, I → 0 A), se aplica una fuente de prueba de 1 A entre los terminales y se mide la tensión: R_th = V / I.',
      formula: String.raw`R_{th} = \frac{V_{prueba}}{1\text{ A}}`,
      result: finite
        ? String.raw`R_{th} = ${formatNumber(rTh, 6)}\ \Omega`
        : String.raw`R_{th} = \infty`,
    },
    {
      title: 'Equivalente de Norton',
      explanation:
        'La fuente de Norton es la corriente de cortocircuito del equivalente de Thévenin.',
      formula: String.raw`I_{N} = \frac{V_{th}}{R_{th}}`,
      result:
        Number.isFinite(iN) && finite
          ? String.raw`I_{N} = ${formatNumber(iN, 6)}\text{ A}`
          : String.raw`I_{N} \to \infty`,
    },
    {
      title: 'Equivalentes resultantes',
      explanation:
        'El equivalente de Thévenin es una fuente V_th en serie con R_th; el de Norton, una fuente I_N en paralelo con R_th.',
      formula: String.raw`V_{th} = I_{N}\,R_{th}`,
      result: String.raw`V_{th} = ${formatNumber(vTh, 6)}\text{ V},\ R_{th} = ${rThTex}\ \Omega`,
    },
    {
      title: 'Con la carga conectada',
      explanation:
        'Al reconectar la carga, la corriente es la tensión de Thévenin entre R_th + R_L.',
      formula: String.raw`i_L = \frac{V_{th}}{R_{th} + R_L}`,
      substitution: String.raw`i_L = \frac{${formatNumber(vTh, 6)}}{${rThTex} + ${formatNumber(load.value, 6)}}`,
      result: String.raw`i_L = ${formatNumber(loadCurrent, 6)}\text{ A},\quad P_L = ${formatNumber(loadPower, 6)}\text{ W}`,
    },
  ];

  return { ok: true, result, steps, tables: [summaryTable], notices: theveninNotices(rTh) };
}
