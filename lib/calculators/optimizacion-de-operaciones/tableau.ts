/**
 * Motor del método simplex tabular con aritmética racional exacta (Taha, cap. 3).
 *
 * Convención de Taha para la fila z: se escribe z − Σ cⱼxⱼ = 0, así que la tabla inicial lleva
 * −cⱼ. Condición de optimalidad: al maximizar entra la variable no básica con el coeficiente más
 * negativo en la fila z; al minimizar, la de coeficiente más positivo. Condición de factibilidad:
 * sale la variable básica con la menor razón (lado derecho entre el coeficiente positivo de la
 * columna que entra). Los empates se rompen por el menor índice.
 *
 * Las variables artificiales se penalizan con una M simbólica (los coeficientes de la fila z son
 * a + bM y se comparan primero por b), así la tabla coincide con la del libro sin elegir un número
 * «grande».
 */
import { latexLines } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import type { ResultTable, Step } from '../types';
import { variableLatex, type LinearProgram, type Relation, type Sense } from './lp-model';

// ─── Números con M ──────────────────────────────────────────────────────────

/** a + bM, con M arbitrariamente grande. */
export class MValue {
  constructor(
    readonly a: Rational,
    readonly m: Rational = Rational.ZERO,
  ) {}

  static readonly ZERO = new MValue(Rational.ZERO);

  add(o: MValue): MValue {
    return new MValue(this.a.add(o.a), this.m.add(o.m));
  }

  sub(o: MValue): MValue {
    return new MValue(this.a.sub(o.a), this.m.sub(o.m));
  }

  scale(r: Rational): MValue {
    return new MValue(this.a.mul(r), this.m.mul(r));
  }

  cmp(o: MValue): -1 | 0 | 1 {
    return this.m.cmp(o.m) || this.a.cmp(o.a);
  }

  sign(): -1 | 0 | 1 {
    return this.m.sign() || this.a.sign();
  }

  isZero(): boolean {
    return this.a.isZero() && this.m.isZero();
  }

  hasM(): boolean {
    return !this.m.isZero();
  }

  /** −4 + 7M, M, −M, 3 (como en Taha: primero la parte numérica). */
  toLatex(): string {
    if (this.m.isZero()) return this.a.toLatex();
    const mAbs = this.m.abs();
    const mTerm = `${mAbs.eq(Rational.ONE) ? '' : mAbs.toLatex()}M`;
    if (this.a.isZero()) return `${this.m.sign() < 0 ? '-' : ''}${mTerm}`;
    return `${this.a.toLatex()} ${this.m.sign() < 0 ? '-' : '+'} ${mTerm}`;
  }
}

// ─── Forma estándar ─────────────────────────────────────────────────────────

export type ColumnKind = 'decision' | 'slack' | 'surplus' | 'artificial';

export interface Column {
  name: string;
  latex: string;
  kind: ColumnKind;
  /** Restricción (índice) que originó la holgura, el exceso o la artificial. */
  constraint?: number;
}

export interface StandardForm {
  columns: Column[];
  rows: Rational[][];
  rhs: Rational[];
  /** Columna básica inicial de cada fila (holgura o artificial). */
  basis: number[];
  /** Relación de cada restricción después de hacer no negativo el lado derecho. */
  relations: Relation[];
  /** Restricciones que se multiplicaron por −1. */
  flipped: number[];
}

const flip: Record<Relation, Relation> = { '<=': '>=', '>=': '<=', '=': '=' };

/**
 * Forma estándar de Taha: lados derechos no negativos, holgura sᵢ en las restricciones ≤,
 * exceso eᵢ y artificial Rᵢ en las ≥, artificial Rᵢ en las =. Con `keepNegativeRhs` (método dual
 * simplex) no se cambia el signo y todas las restricciones deben ser ≤.
 */
export function toStandardForm(
  lp: LinearProgram,
  { keepNegativeRhs = false }: { keepNegativeRhs?: boolean } = {},
): StandardForm {
  const n = lp.variables.length;
  const flipped: number[] = [];
  const prepared = lp.constraints.map((c, i) => {
    if (!keepNegativeRhs && c.rhs.sign() < 0) {
      flipped.push(i);
      return {
        coefficients: c.coefficients.map((a) => a.neg()),
        relation: flip[c.relation],
        rhs: c.rhs.neg(),
      };
    }
    return c;
  });

  const columns: Column[] = lp.variables.map((v) => ({
    name: v,
    latex: variableLatex(v),
    kind: 'decision',
  }));
  const extra: { row: number; column: number; value: Rational }[] = [];
  const basis: number[] = new Array<number>(prepared.length).fill(-1);
  prepared.forEach((c, i) => {
    if (c.relation === '<=') {
      extra.push({ row: i, column: columns.length, value: Rational.ONE });
      basis[i] = columns.length;
      columns.push({ name: `s${i + 1}`, latex: `s_{${i + 1}}`, kind: 'slack', constraint: i });
    } else if (c.relation === '>=') {
      extra.push({ row: i, column: columns.length, value: Rational.of(-1) });
      columns.push({ name: `e${i + 1}`, latex: `e_{${i + 1}}`, kind: 'surplus', constraint: i });
    }
  });
  prepared.forEach((c, i) => {
    if (c.relation !== '<=') {
      extra.push({ row: i, column: columns.length, value: Rational.ONE });
      basis[i] = columns.length;
      columns.push({
        name: `R${i + 1}`,
        latex: `R_{${i + 1}}`,
        kind: 'artificial',
        constraint: i,
      });
    }
  });

  const rows = prepared.map((c, i) => {
    const row = [...c.coefficients, ...new Array<Rational>(columns.length - n).fill(Rational.ZERO)];
    for (const e of extra) if (e.row === i) row[e.column] = e.value;
    return row;
  });
  return {
    columns,
    rows,
    rhs: prepared.map((c) => c.rhs),
    basis,
    relations: prepared.map((c) => c.relation),
    flipped,
  };
}

// ─── Tabla simplex ──────────────────────────────────────────────────────────

export interface Tableau {
  columns: Column[];
  rows: Rational[][];
  rhs: Rational[];
  basis: number[];
  z: MValue[];
  zRhs: MValue;
  sense: Sense;
  /** Nombre de la función objetivo en la tabla: z, o r en la fase I. */
  objective: string;
}

export type ObjectiveMode = 'plain' | 'big-m' | 'phase-1';

/** Fila z inicial (antes de hacerla consistente con la base). */
export function initialObjectiveRow(
  lp: LinearProgram,
  columns: Column[],
  mode: ObjectiveMode,
): MValue[] {
  return columns.map((col, j) => {
    if (mode === 'phase-1')
      return new MValue(col.kind === 'artificial' ? Rational.of(-1) : Rational.ZERO);
    if (col.kind === 'decision') return new MValue(lp.objective[j]!.neg());
    if (col.kind === 'artificial' && mode === 'big-m') {
      // max z = cx − MΣR  →  z − cx + MΣR = 0;   min z = cx + MΣR  →  z − cx − MΣR = 0.
      return new MValue(Rational.ZERO, Rational.of(lp.sense === 'max' ? 1 : -1));
    }
    return MValue.ZERO;
  });
}

/**
 * Hace consistente la fila z con la base: para que las variables básicas tengan coeficiente 0,
 * se le resta (coeficiente) × (fila de la básica). Devuelve la tabla y las operaciones hechas.
 */
export function priceOut(t: Tableau): { tableau: Tableau; operations: string[] } {
  let z = t.z;
  let zRhs = t.zRhs;
  const operations: string[] = [];
  t.basis.forEach((b, i) => {
    const coefficient = z[b]!;
    if (coefficient.isZero()) return;
    z = z.map((v, j) => v.sub(coefficient.scale(t.rows[i]![j]!)));
    zRhs = zRhs.sub(coefficient.scale(t.rhs[i]!));
    operations.push(rowOperation(t.objective, coefficient, t.columns[b]!.latex));
  });
  return { tableau: { ...t, z, zRhs }, operations };
}

/** «z: F_z − (c)·F_{x}» en LaTeX, con el signo simplificado. */
function rowOperation(target: string, coefficient: MValue, pivotRow: string): string {
  const negative = coefficient.sign() < 0;
  const abs = negative ? coefficient.scale(Rational.of(-1)) : coefficient;
  const factor = abs.hasM() && !abs.a.isZero() ? `(${abs.toLatex()})` : abs.toLatex();
  return `\\text{Fila } ${target} \\leftarrow \\text{fila } ${target} ${negative ? '+' : '-'} ${factor === '1' ? '' : `${factor}\\,`}\\text{fila } ${pivotRow}`;
}

export interface IterationInfo {
  entering: number;
  enteringValue: MValue;
  /** Fila que sale, o `null` si no hay razón válida (no acotado). */
  leaving: number | null;
  ratios: (Rational | null)[];
  pivot: Rational | null;
  /** Operaciones de fila, en LaTeX. */
  operations: string[];
}

export type RunStatus = 'optimal' | 'unbounded' | 'max-iterations';

export interface RunResult {
  /** Tabla inicial y la de cada iteración. */
  tableaus: Tableau[];
  iterations: IterationInfo[];
  status: RunStatus;
  final: Tableau;
}

export const MAX_ITERATIONS = 50;

function chooseEntering(t: Tableau, excluded: Set<number>): number | null {
  let best: number | null = null;
  for (let j = 0; j < t.z.length; j++) {
    const v = t.z[j]!;
    if (t.basis.includes(j) || excluded.has(j)) continue;
    const improves = t.sense === 'max' ? v.sign() < 0 : v.sign() > 0;
    if (!improves) continue;
    if (best === null || (t.sense === 'max' ? v.cmp(t.z[best]!) < 0 : v.cmp(t.z[best]!) > 0)) {
      best = j;
    }
  }
  return best;
}

export function pivotTableau(
  t: Tableau,
  r: number,
  e: number,
): { tableau: Tableau; operations: string[] } {
  const p = t.rows[r]![e]!;
  const pivotRow = t.rows[r]!.map((v) => v.div(p));
  const pivotRhs = t.rhs[r]!.div(p);
  const enteringLatex = t.columns[e]!.latex;
  const leavingLatex = t.columns[t.basis[r]!]!.latex;
  const operations = [
    `\\text{Fila pivote } ${enteringLatex} \\leftarrow \\frac{\\text{fila } ${leavingLatex}}{${p.toLatex()}}`,
  ];
  const rows = t.rows.map((row, i) => {
    if (i === r) return pivotRow;
    const factor = row[e]!;
    if (!factor.isZero()) {
      operations.push(
        rowOperation(t.columns[t.basis[i]!]!.latex, new MValue(factor), enteringLatex),
      );
    }
    return row.map((v, j) => v.sub(factor.mul(pivotRow[j]!)));
  });
  const rhs = t.rhs.map((v, i) => (i === r ? pivotRhs : v.sub(t.rows[i]![e]!.mul(pivotRhs))));
  const zFactor = t.z[e]!;
  if (!zFactor.isZero()) operations.splice(1, 0, rowOperation(t.objective, zFactor, enteringLatex));
  const z = t.z.map((v, j) => v.sub(zFactor.scale(pivotRow[j]!)));
  const zRhs = t.zRhs.sub(zFactor.scale(pivotRhs));
  const basis = t.basis.map((b, i) => (i === r ? e : b));
  return { tableau: { ...t, rows, rhs, z, zRhs, basis }, operations };
}

/** Itera el simplex primal hasta el óptimo, un rayo no acotado o el límite de iteraciones. */
export function runSimplex(
  start: Tableau,
  { excluded = new Set<number>() }: { excluded?: Set<number> } = {},
): RunResult {
  const tableaus = [start];
  const iterations: IterationInfo[] = [];
  let t = start;
  for (let k = 0; k < MAX_ITERATIONS; k++) {
    const e = chooseEntering(t, excluded);
    if (e === null) return { tableaus, iterations, status: 'optimal', final: t };
    const ratios = t.rows.map((row, i) => (row[e]!.sign() > 0 ? t.rhs[i]!.div(row[e]!) : null));
    let r: number | null = null;
    for (let i = 0; i < ratios.length; i++) {
      const ratio = ratios[i]!;
      if (ratio !== null && (r === null || ratio.lt(ratios[r]!))) r = i;
    }
    if (r === null) {
      iterations.push({
        entering: e,
        enteringValue: t.z[e]!,
        leaving: null,
        ratios,
        pivot: null,
        operations: [],
      });
      return { tableaus, iterations, status: 'unbounded', final: t };
    }
    const { tableau, operations } = pivotTableau(t, r, e);
    iterations.push({
      entering: e,
      enteringValue: t.z[e]!,
      leaving: r,
      ratios,
      pivot: t.rows[r]![e]!,
      operations,
    });
    t = tableau;
    tableaus.push(t);
  }
  return { tableaus, iterations, status: 'max-iterations', final: t };
}

/** Valor de cada columna en la solución básica de la tabla. */
export function basicSolution(t: Tableau): Rational[] {
  const values = t.columns.map(() => Rational.ZERO);
  t.basis.forEach((b, i) => {
    values[b] = t.rhs[i]!;
  });
  return values;
}

/** Tabla inicial a partir de la forma estándar y el modo de la fila objetivo. */
export function initialTableau(lp: LinearProgram, sf: StandardForm, mode: ObjectiveMode): Tableau {
  return {
    columns: sf.columns,
    rows: sf.rows,
    rhs: sf.rhs,
    basis: sf.basis,
    z: initialObjectiveRow(lp, sf.columns, mode),
    zRhs: MValue.ZERO,
    sense: mode === 'phase-1' ? 'min' : lp.sense,
    objective: mode === 'phase-1' ? 'r' : 'z',
  };
}

// ─── Presentación ───────────────────────────────────────────────────────────

/** La tabla simplex como `ResultTable`, con la columna de razones si se indica. */
export function tableauTable(
  t: Tableau,
  id: string,
  title: string,
  info?: IterationInfo,
): ResultTable {
  const columns: ResultTable['columns'] = [
    { key: 'basic', header: '\\text{Básica}', format: 'latex' },
    ...t.columns.map((c, j) => ({ key: `c${j}`, header: c.latex, format: 'latex' as const })),
    { key: 'rhs', header: '\\text{Solución}', format: 'latex' },
  ];
  if (info) columns.push({ key: 'ratio', header: '\\text{Razón}', format: 'latex' });
  const zRow: Record<string, string | null> = { basic: t.objective, rhs: t.zRhs.toLatex() };
  t.z.forEach((v, j) => {
    zRow[`c${j}`] = v.toLatex();
  });
  if (info) zRow.ratio = null;
  const rows = t.rows.map((row, i) => {
    const cells: Record<string, string | null> = {
      basic: t.columns[t.basis[i]!]!.latex,
      rhs: t.rhs[i]!.toLatex(),
    };
    row.forEach((v, j) => {
      cells[`c${j}`] = v.toLatex();
    });
    if (info) {
      const ratio = info.ratios[i];
      cells.ratio =
        ratio === null || ratio === undefined
          ? '\\text{—}'
          : `${ratio.toLatex()}${i === info.leaving ? '\\ \\leftarrow' : ''}`;
    }
    return cells;
  });
  return { id, title, columns, rows: [zRow, ...rows] };
}

/** Paso de una iteración: variable que entra, razones, variable que sale y operaciones. */
export function iterationStep(t: Tableau, info: IterationInfo, number: number): Step {
  const entering = t.columns[info.entering]!.latex;
  const rule =
    t.sense === 'max'
      ? `Entra la variable no básica con el coeficiente más negativo en la fila ${t.objective}.`
      : `Entra la variable no básica con el coeficiente más positivo en la fila ${t.objective}.`;
  const ratioLines = t.rows.map((row, i) => {
    const basic = t.columns[t.basis[i]!]!.latex;
    const ratio = info.ratios[i];
    return ratio === null || ratio === undefined
      ? `${basic}:\\ \\text{no aplica } (${row[info.entering]!.toLatex()} \\le 0)`
      : `${basic}:\\ \\frac{${t.rhs[i]!.toLatex()}}{${row[info.entering]!.toLatex()}} = ${ratio.toLatex()}`;
  });
  const children: Step[] = [
    {
      title: 'Variable que entra',
      explanation: rule,
      result: `${entering} \\ \\text{entra (coeficiente } ${info.enteringValue.toLatex()})`,
    },
    {
      title: 'Variable que sale (razón mínima)',
      explanation:
        'Se divide el lado derecho entre los coeficientes positivos de la columna que entra; sale la básica con la menor razón.',
      substitution: latexLines(ratioLines),
      result:
        info.leaving === null
          ? '\\text{Ningún coeficiente positivo: no hay razón mínima}'
          : `${t.columns[t.basis[info.leaving]!]!.latex} \\ \\text{sale; pivote } = ${info.pivot!.toLatex()}`,
    },
  ];
  if (info.leaving !== null) {
    children.push({
      title: 'Operaciones de fila (Gauss-Jordan)',
      explanation:
        'La fila pivote se divide entre el pivote; a cada una de las otras filas se le resta su coeficiente en la columna que entra multiplicado por la nueva fila pivote.',
      substitution: latexLines(info.operations),
    });
  }
  return { title: `Iteración ${number}`, children };
}

/** Lista de valores de las variables de decisión: x_1 = 3, x_2 = 1.5. */
export function decisionValuesLatex(t: Tableau): string {
  const values = basicSolution(t);
  return t.columns
    .map((c, j) => (c.kind === 'decision' ? `${c.latex} = ${values[j]!.toLatex()}` : null))
    .filter(Boolean)
    .join(',\\ ');
}

/** Variables básicas en cero (solución degenerada). */
export function degenerateBasics(t: Tableau): string[] {
  return t.basis.filter((_, i) => t.rhs[i]!.isZero()).map((b) => t.columns[b]!.name);
}

/** Variables no básicas (no artificiales) con coeficiente 0 en la fila z: óptimos alternativos. */
export function alternativeOptimaColumns(t: Tableau): number[] {
  return t.z.flatMap((v, j) =>
    !t.basis.includes(j) && t.columns[j]!.kind !== 'artificial' && v.isZero() ? [j] : [],
  );
}

/** Artificiales que siguen en la base con valor positivo: el problema es infactible. */
export function positiveArtificials(t: Tableau): string[] {
  return t.basis
    .filter((b, i) => t.columns[b]!.kind === 'artificial' && t.rhs[i]!.sign() > 0)
    .map((b) => t.columns[b]!.name);
}
