/**
 * Teorema de superposición para circuitos lineales: la respuesta (tensión o corriente) es la suma
 * de las respuestas debidas a cada fuente independiente actuando sola, con las demás "apagadas"
 * (fuente de voltaje → cortocircuito, fuente de corriente → circuito abierto).
 *
 * Se resuelve por MNA una vez por fuente, dejando su valor original y poniendo el resto en cero
 * (una fuente de voltaje en 0 V es un corto y una de corriente en 0 A es un abierto, así que la
 * topología no cambia). El aporte total se obtiene sumando rama por rama.
 *
 * Fuente: Hayt, Kemmerly & Durbin, *Análisis de Circuitos en Ingeniería*, 7.ª ed., cap. 4.
 */
import { formatNumber } from '@/lib/math/format';
import type { Notice, ResultTable, Step } from '../types';
import {
  buildTopology,
  componentLabel,
  componentUnit,
  validateTopology,
  type CircuitDocument,
  type CircuitErrorCode,
} from './circuit';
import { solveMna, type BranchResult } from './mna';

export interface SuperpositionContribution {
  sourceId: string;
  sourceLabel: string;
  results: BranchResult[];
}

export interface SuperpositionResult {
  contributions: SuperpositionContribution[];
  total: BranchResult[];
}

export type SuperpositionErrorCode = CircuitErrorCode | 'sin-fuentes' | 'singular';

export interface SuperpositionSolve {
  ok: true;
  result: SuperpositionResult;
  steps: Step[];
  tables: ResultTable[];
  notices: Notice[];
}

export interface SuperpositionFailure {
  ok: false;
  code: SuperpositionErrorCode;
  message: string;
}

export type SuperpositionOutcome = SuperpositionSolve | SuperpositionFailure;

/** Resuelve el circuito por superposición (una solución MNA por fuente). */
export function solveSuperposition(doc: CircuitDocument): SuperpositionOutcome {
  const structural = validateTopology(buildTopology(doc));
  if (structural) {
    return { ok: false, code: structural.code, message: structural.message };
  }

  const sources = doc.components.filter((c) => c.kind !== 'resistor');
  if (sources.length === 0) {
    return {
      ok: false,
      code: 'sin-fuentes',
      message: 'El circuito no tiene fuentes independientes; la superposición no aplica.',
    };
  }

  const contributions: SuperpositionContribution[] = [];
  for (const source of sources) {
    const sub: CircuitDocument = {
      ...doc,
      components: doc.components.map((c) =>
        c.kind === 'resistor' ? c : { ...c, value: c.id === source.id ? c.value : 0 },
      ),
    };
    const mna = solveMna(buildTopology(sub));
    if (!mna.ok) {
      return {
        ok: false,
        code: 'singular',
        message: `No se pudo resolver con solo ${componentLabel(source)} activa: ${mna.message}`,
      };
    }
    contributions.push({
      sourceId: source.id,
      sourceLabel: componentLabel(source),
      results: mna.result.branchResults,
    });
  }

  const total: BranchResult[] = doc.components.map((c) => {
    let v = 0;
    let i = 0;
    for (const contribution of contributions) {
      const b = contribution.results.find((r) => r.id === c.id);
      if (b) {
        v += b.v;
        i += b.i;
      }
    }
    return { id: c.id, label: componentLabel(c), kind: c.kind, nodeA: 0, nodeB: 0, v, i, p: v * i };
  });

  const contributionTables: ResultTable[] = contributions.map((contribution) => ({
    id: `aporte-${contribution.sourceId}`,
    title: `Aporte con ${contribution.sourceLabel} activa (las demás apagadas)`,
    columns: [
      { key: 'rama', header: 'Rama' },
      { key: 'v', header: 'V (V)' },
      { key: 'i', header: 'I (A)' },
    ],
    rows: contribution.results.map((b) => ({
      rama: `${b.label} (${componentUnit(b.kind)})`,
      v: formatNumber(b.v, 6),
      i: formatNumber(b.i, 6),
    })),
  }));

  const totalTable: ResultTable = {
    id: 'total',
    title: 'Suma de aportes (respuesta total)',
    columns: [
      { key: 'rama', header: 'Rama' },
      { key: 'v', header: 'V (V)' },
      { key: 'i', header: 'I (A)' },
      { key: 'p', header: 'P (W)' },
    ],
    rows: total.map((b) => ({
      rama: `${b.label} (${componentUnit(b.kind)})`,
      v: formatNumber(b.v, 6),
      i: formatNumber(b.i, 6),
      p: formatNumber(b.p, 6),
    })),
  };

  const steps: Step[] = [
    {
      title: 'Principio de superposición',
      explanation:
        'En un circuito lineal, la respuesta se obtiene sumando las respuestas de cada fuente independiente por separado. Al analizar una fuente, las demás se apagan: las fuentes de voltaje quedan en 0 V (cortocircuito) y las de corriente en 0 A (circuito abierto).',
      result: `Fuentes independientes: ${sources.map((s) => componentLabel(s)).join(', ')}`,
    },
    ...contributions.map((contribution) => ({
      title: `Solo ${contribution.sourceLabel} activa`,
      explanation: `Se apagan las demás fuentes y se resuelve el circuito. Este es el aporte de ${contribution.sourceLabel}.`,
      result: contribution.results
        .filter((b) => Math.abs(b.i) > 1e-12 || Math.abs(b.v) > 1e-12)
        .map((b) => `${b.label}: ${formatNumber(b.i, 6)}\\text{ A}`)
        .join(',\\ '),
    })),
    {
      title: 'Suma de los aportes',
      explanation:
        'Se suman algebraicamente las tensiones y corrientes rama por rama para obtener la respuesta total.',
      result: total.map((b) => `${b.label}: ${formatNumber(b.i, 6)}\\text{ A}`).join(',\\ '),
    },
  ];

  return {
    ok: true,
    result: { contributions, total },
    steps,
    tables: [...contributionTables, totalTable],
    notices: [
      {
        level: 'info',
        message:
          'La superposición se aplica a tensiones y corrientes (lineales), no a la potencia: no sumes las potencias de cada aporte.',
      },
    ],
  };
}
