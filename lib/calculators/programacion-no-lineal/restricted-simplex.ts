/**
 * Método simplex con base restringida (Taha, secs. 21.2.1 y 21.2.2): como el simplex de
 * `optimizacion-de-operaciones/tableau.ts`, pero una variable solo puede entrar si la base que
 * resulta cumple una regla adicional. Se prueba primero la candidata más prometedora de la fila
 * objetivo; si la regla la rechaza, la siguiente, y así hasta que ninguna mejora admisible queda.
 *
 * - Método de Wolfe: una variable no entra si su complementaria (x_j con μ_j, λ_i con S_i) sigue
 *   en la base.
 * - Programación separable: en cada variable aproximada, a lo sumo dos pesos w positivos y
 *   adyacentes.
 */
import { latexLines } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import type { ResultTable, Step } from '../types';
import {
  MAX_ITERATIONS,
  pivotTableau,
  tableauTable,
  type IterationInfo,
  type MValue,
  type Tableau,
} from '../optimizacion-de-operaciones/tableau';

export interface Rejection {
  column: number;
  /** Motivo en LaTeX (el texto va en \text{…}). */
  reason: string;
}

export interface RestrictedIteration extends IterationInfo {
  rejected: Rejection[];
}

export interface RestrictedRun {
  tableaus: Tableau[];
  iterations: RestrictedIteration[];
  status: 'optimal' | 'unbounded' | 'max-iterations';
  final: Tableau;
}

/** Regla de admisibilidad: `null` si la variable puede entrar, o el motivo del rechazo. */
export type Admissibility = (t: Tableau, entering: number, leavingRow: number) => string | null;

function improves(t: Tableau, v: MValue): boolean {
  return t.sense === 'max' ? v.sign() < 0 : v.sign() > 0;
}

/** Candidatas ordenadas de la más a la menos prometedora (empates: menor índice). */
function candidates(t: Tableau): number[] {
  const list = t.z
    .map((v, j) => ({ v, j }))
    .filter(({ v, j }) => !t.basis.includes(j) && improves(t, v));
  list.sort((a, b) => (t.sense === 'max' ? a.v.cmp(b.v) : b.v.cmp(a.v)) || a.j - b.j);
  return list.map(({ j }) => j);
}

function ratiosFor(t: Tableau, e: number): { ratios: (Rational | null)[]; leaving: number | null } {
  const ratios = t.rows.map((row, i) => (row[e]!.sign() > 0 ? t.rhs[i]!.div(row[e]!) : null));
  let leaving: number | null = null;
  ratios.forEach((ratio, i) => {
    if (ratio !== null && (leaving === null || ratio.lt(ratios[leaving]!))) leaving = i;
  });
  return { ratios, leaving };
}

export function runRestrictedSimplex(start: Tableau, admissible: Admissibility): RestrictedRun {
  const tableaus = [start];
  const iterations: RestrictedIteration[] = [];
  let t = start;
  for (let k = 0; k < MAX_ITERATIONS; k++) {
    const rejected: Rejection[] = [];
    let chosen: { e: number; r: number; ratios: (Rational | null)[] } | null = null;
    for (const e of candidates(t)) {
      const { ratios, leaving } = ratiosFor(t, e);
      if (leaving === null) {
        iterations.push({
          entering: e,
          enteringValue: t.z[e]!,
          leaving: null,
          ratios,
          pivot: null,
          operations: [],
          rejected,
        });
        return { tableaus, iterations, status: 'unbounded', final: t };
      }
      const reason = admissible(t, e, leaving);
      if (reason === null) {
        chosen = { e, r: leaving, ratios };
        break;
      }
      rejected.push({ column: e, reason });
    }
    if (!chosen) {
      if (rejected.length > 0) {
        iterations.push({
          entering: -1,
          enteringValue: t.zRhs,
          leaving: null,
          ratios: [],
          pivot: null,
          operations: [],
          rejected,
        });
      }
      return { tableaus, iterations, status: 'optimal', final: t };
    }
    const { tableau, operations } = pivotTableau(t, chosen.r, chosen.e);
    iterations.push({
      entering: chosen.e,
      enteringValue: t.z[chosen.e]!,
      leaving: chosen.r,
      ratios: chosen.ratios,
      pivot: t.rows[chosen.r]![chosen.e]!,
      operations,
      rejected,
    });
    t = tableau;
    tableaus.push(t);
  }
  return { tableaus, iterations, status: 'max-iterations', final: t };
}

/** Pasos y tablas de una corrida, con las candidatas rechazadas por la base restringida. */
export function restrictedTrace(
  run: RestrictedRun,
  idPrefix: string,
): { steps: Step[]; tables: ResultTable[] } {
  const steps: Step[] = [];
  const tables: ResultTable[] = [];
  run.tableaus.forEach((t, k) => {
    const info = run.iterations[k];
    const valid = info && info.entering >= 0 && info.leaving !== null ? info : undefined;
    tables.push(
      tableauTable(
        t,
        `${idPrefix}-${k}`,
        k === 0 ? 'Tabla inicial' : `Tabla de la iteración ${k}`,
        valid,
      ),
    );
  });
  run.iterations.forEach((info, k) => {
    const t = run.tableaus[k]!;
    const rejectedLines = info.rejected.map((r) => `${t.columns[r.column]!.latex}:\\ ${r.reason}`);
    if (info.entering < 0) {
      steps.push({
        title: 'Fin de la base restringida',
        explanation:
          'Hay variables que mejorarían la función objetivo, pero ninguna puede entrar sin violar la regla de la base restringida: esta es la mejor solución.',
        substitution: latexLines(rejectedLines),
      });
      return;
    }
    const entering = t.columns[info.entering]!.latex;
    const children: Step[] = [];
    if (rejectedLines.length > 0) {
      children.push({
        title: 'Candidatas rechazadas por la base restringida',
        substitution: latexLines(rejectedLines),
      });
    }
    const ratioLines = t.rows.map((row, i) => {
      const basic = t.columns[t.basis[i]!]!.latex;
      const ratio = info.ratios[i];
      return ratio === null || ratio === undefined
        ? `${basic}:\\ \\text{no aplica } (${row[info.entering]!.toLatex()} \\le 0)`
        : `${basic}:\\ \\frac{${t.rhs[i]!.toLatex()}}{${row[info.entering]!.toLatex()}} = ${ratio.toLatex()}`;
    });
    children.push(
      {
        title: 'Variable que entra',
        explanation:
          t.sense === 'max'
            ? `La más prometedora admisible: coeficiente más negativo en la fila ${t.objective}.`
            : `La más prometedora admisible: coeficiente más positivo en la fila ${t.objective}.`,
        result: `${entering} \\ \\text{entra (coeficiente } ${info.enteringValue.toLatex()})`,
      },
      {
        title: 'Variable que sale (razón mínima)',
        substitution: latexLines(ratioLines),
        result:
          info.leaving === null
            ? '\\text{Ningún coeficiente positivo}'
            : `${t.columns[t.basis[info.leaving]!]!.latex} \\ \\text{sale; pivote } = ${info.pivot!.toLatex()}`,
      },
    );
    if (info.operations.length > 0) {
      children.push({ title: 'Operaciones de fila', substitution: latexLines(info.operations) });
    }
    steps.push({ title: `Iteración ${k + 1}`, children });
  });
  return { steps, tables };
}

/** Valor de cada columna en la solución básica. */
export function basicValues(t: Tableau): Rational[] {
  const values = t.columns.map(() => Rational.ZERO);
  t.basis.forEach((b, i) => {
    values[b] = t.rhs[i]!;
  });
  return values;
}

/** Número → racional «limpio» (4.000000000001 → 4) para armar tablas exactas. */
export function toRational(value: number): Rational {
  const rounded = Number(value.toPrecision(12));
  return Rational.fromNumber(Math.abs(rounded) < 1e-12 ? 0 : rounded);
}
