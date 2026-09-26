/**
 * Procedimientos completos de programación lineal sobre el motor de `tableau.ts`, con su traza:
 * simplex tabular (solo restricciones ≤), método de la M grande y método de las dos fases
 * (Taha, sec. 3.3 y 3.4). También un solucionador sin traza para otras calculadoras (método
 * gráfico, dual, ramificación y acotamiento).
 */
import { latexLines } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import {
  emptyTrace,
  type CalculatorResult,
  type Notice,
  type ResultTable,
  type Step,
  type SummaryItem,
} from '../types';
import {
  linearLatex,
  lpLatex,
  parseLinearProgram,
  variableLatex,
  type LinearProgram,
  type Sense,
} from './lp-model';
import {
  alternativeOptimaColumns,
  basicSolution,
  degenerateBasics,
  initialTableau,
  iterationStep,
  MValue,
  pivotTableau,
  positiveArtificials,
  priceOut,
  runSimplex,
  tableauTable,
  toStandardForm,
  type ObjectiveMode,
  type RunResult,
  type StandardForm,
  type Tableau,
} from './tableau';

export interface LpValue {
  z: number;
  /** Valor óptimo exacto, como texto (21, 17/5). */
  zExact: string;
  /** Valor de cada variable de decisión. */
  variables: Record<string, number>;
  exact: Record<string, string>;
  iterations: number;
  alternativeOptima: boolean;
  degenerate: boolean;
}

export type LpErrorCode =
  'invalid-model' | 'needs-artificial' | 'unbounded' | 'infeasible' | 'max-iterations';

export type LpResult = CalculatorResult<LpValue, LpErrorCode>;

export interface LpInput {
  sense: Sense;
  objective: string;
  constraints: string;
}

interface Trace {
  steps: Step[];
  tables: ResultTable[];
  notices: Notice[];
}

function fail(code: LpErrorCode, message: string, trace: Trace): LpResult {
  return { ok: false, error: { code, message }, ...emptyTrace(), ...trace };
}

/** Parsea el modelo del formulario y arma el primer paso (el modelo en LaTeX). */
export function parseForSolve(
  input: LpInput,
): { ok: true; lp: LinearProgram; trace: Trace } | { ok: false; result: LpResult } {
  const parsed = parseLinearProgram(input.sense, input.objective, input.constraints);
  const trace: Trace = { steps: [], tables: [], notices: [] };
  if (!parsed.ok) return { ok: false, result: fail('invalid-model', parsed.message, trace) };
  trace.notices.push(...parsed.notices.map((message) => ({ level: 'info' as const, message })));
  trace.steps.push({
    title: 'Modelo de programación lineal',
    explanation: 'Todas las variables de decisión son no negativas.',
    result: lpLatex(parsed.lp),
  });
  return { ok: true, lp: parsed.lp, trace };
}

// ─── Forma estándar ─────────────────────────────────────────────────────────

/** Ecuaciones de la forma estándar en LaTeX, con la función objetivo del modo indicado. */
export function standardFormLatex(
  lp: LinearProgram,
  sf: StandardForm,
  mode: ObjectiveMode,
): string {
  const names = sf.columns.map((c) => c.latex);
  const artificial = sf.columns.filter((c) => c.kind === 'artificial').map((c) => c.latex);
  const decisions = lp.objective.concat(
    new Array<Rational>(sf.columns.length - lp.variables.length).fill(Rational.ZERO),
  );
  let objective = `\\${lp.sense}\\ z = ${linearLatex(decisions, names)}`;
  if (mode === 'big-m' && artificial.length > 0) {
    objective += ` ${lp.sense === 'max' ? '-' : '+'} M(${artificial.join(' + ')})`;
  }
  if (mode === 'phase-1') objective = `\\min\\ r = ${artificial.join(' + ')}`;
  const rows = sf.rows.map((row, i) => `${linearLatex(row, names)} &= ${sf.rhs[i]!.toLatex()}`);
  return `\\begin{aligned} ${objective.replace('=', '&=')} \\\\ ${rows.join(' \\\\ ')} \\\\ ${names.join(', ')} &\\ge 0 \\end{aligned}`;
}

function standardFormStep(lp: LinearProgram, sf: StandardForm, mode: ObjectiveMode): Step {
  const parts = [
    'Cada restricción ≤ recibe una variable de holgura sᵢ (lo que sobra del recurso); cada ≥, una de exceso eᵢ que se resta.',
  ];
  if (sf.flipped.length > 0) {
    parts.unshift(
      `Primero se multiplican por −1 las restricciones ${sf.flipped.map((i) => i + 1).join(', ')} para que el lado derecho no sea negativo (el signo de la desigualdad se invierte).`,
    );
  }
  if (sf.columns.some((c) => c.kind === 'artificial')) {
    parts.push(
      'Las restricciones ≥ y = no tienen una holgura que sirva de variable básica inicial, así que se agrega una variable artificial Rᵢ.',
    );
    if (mode === 'big-m') {
      parts.push(
        lp.sense === 'max'
          ? 'Para que las artificiales salgan de la base, se penalizan en la función objetivo restando M·Rᵢ, con M muy grande.'
          : 'Para que las artificiales salgan de la base, se penalizan en la función objetivo sumando M·Rᵢ, con M muy grande.',
      );
    }
    if (mode === 'phase-1') {
      parts.push(
        'En la fase I se minimiza r, la suma de las artificiales: si su mínimo es 0, la base final es factible para el problema original.',
      );
    }
  }
  const basic = sf.basis.map((b) => sf.columns[b]!.latex);
  return {
    title: 'Forma estándar',
    explanation: parts.join(' '),
    result: standardFormLatex(lp, sf, mode),
    children: [
      {
        title: 'Solución básica inicial',
        explanation:
          'Las variables de decisión (y los excesos) valen 0; cada restricción queda resuelta por su holgura o su artificial.',
        result: sf.basis.map((b, i) => `${basic[i]} = ${sf.rhs[i]!.toLatex()}`).join(',\\ '),
      },
    ],
  };
}

// ─── Iteraciones y solución ─────────────────────────────────────────────────

function iterationsTrace(run: RunResult, trace: Trace, prefix: string) {
  const name = (k: number) => (k === 0 ? 'Tabla inicial' : `Tabla ${k}`);
  run.iterations.forEach((info, k) => {
    const before = run.tableaus[k]!;
    trace.tables.push(tableauTable(before, `${prefix}-${k}`, `${label(prefix)}${name(k)}`, info));
    trace.steps.push({
      ...iterationStep(before, info, k + 1),
      title: `${label(prefix)}Iteración ${k + 1}`,
    });
  });
  if (run.status === 'optimal') {
    const last = run.tableaus.length - 1;
    trace.tables.push(
      tableauTable(run.final, `${prefix}-${last}`, `${label(prefix)}${name(last)} (óptima)`),
    );
  }
}

function label(prefix: string): string {
  return prefix === 'fase-1' ? 'Fase I — ' : prefix === 'fase-2' ? 'Fase II — ' : '';
}

function optimalityStep(t: Tableau): Step {
  return {
    title: 'Condición de optimalidad',
    explanation:
      t.sense === 'max'
        ? `Ningún coeficiente de la fila ${t.objective} es negativo: no hay variable que mejore el objetivo al entrar. La tabla es óptima.`
        : `Ningún coeficiente de la fila ${t.objective} es positivo: no hay variable que mejore el objetivo al entrar. La tabla es óptima.`,
  };
}

/** Resultado final: valores, avisos de casos especiales y resumen. */
function finish(lp: LinearProgram, t: Tableau, iterations: number, trace: Trace): LpResult {
  const values = basicSolution(t);
  const decisions = lp.variables.map((_, j) => values[j]!);
  const z = t.zRhs.a;
  const alternative = alternativeOptimaColumns(t);
  const degenerate = degenerateBasics(t);
  const decisionLatex = lp.variables
    .map((v, j) => `${variableLatex(v)} = ${decisions[j]!.toLatex()}`)
    .join(',\\ ');
  const slackLatex = t.columns
    .map((c, j) =>
      c.kind === 'slack' || c.kind === 'surplus' ? `${c.latex} = ${values[j]!.toLatex()}` : null,
    )
    .filter(Boolean)
    .join(',\\ ');
  trace.steps.push(optimalityStep(t), {
    title: 'Solución óptima',
    explanation:
      'Las variables básicas toman el valor de la columna Solución; las no básicas valen 0. El valor de z es el lado derecho de la fila z.',
    result: latexLines([
      `${decisionLatex}, \\qquad z^* = ${z.toLatex()}`,
      ...(slackLatex ? [slackLatex] : []),
    ]),
  });
  if (alternative.length > 0) {
    trace.notices.push({
      level: 'info',
      message: `Óptimos alternativos: ${alternative.map((j) => t.columns[j]!.name).join(', ')} no ${alternative.length === 1 ? 'es básica' : 'son básicas'} y ${alternative.length === 1 ? 'tiene' : 'tienen'} coeficiente 0 en la fila z. Si ${alternative.length === 1 ? 'entra' : 'entran'} a la base, se obtiene otra solución con el mismo valor de z.`,
    });
  }
  if (degenerate.length > 0) {
    trace.notices.push({
      level: 'info',
      message: `Solución degenerada: ${degenerate.join(', ')} ${degenerate.length === 1 ? 'es básica y vale' : 'son básicas y valen'} 0. Pasa cuando hay un empate en la razón mínima.`,
    });
  }
  const summary: SummaryItem[] = [
    { label: 'Valor óptimo', value: `z^* = ${z.toLatex()}`, emphasis: true },
    { label: 'Solución', value: decisionLatex },
    { label: 'Iteraciones', value: String(iterations) },
  ];
  return {
    ok: true,
    value: {
      z: z.toNumber(),
      zExact: z.toText(),
      variables: Object.fromEntries(lp.variables.map((v, j) => [v, decisions[j]!.toNumber()])),
      exact: Object.fromEntries(lp.variables.map((v, j) => [v, decisions[j]!.toText()])),
      iterations,
      alternativeOptima: alternative.length > 0,
      degenerate: degenerate.length > 0,
    },
    summary,
    ...emptyTrace(),
    ...trace,
  };
}

function unbounded(t: Tableau, trace: Trace): LpResult {
  return fail(
    'unbounded',
    `Solución no acotada: la variable que debería entrar no tiene coeficientes positivos en su columna, así que puede crecer sin límite y z ${t.sense === 'max' ? 'aumenta' : 'disminuye'} indefinidamente. Revisa si falta una restricción.`,
    trace,
  );
}

function tooMany(trace: Trace): LpResult {
  return fail('max-iterations', 'Se alcanzó el máximo de iteraciones sin llegar al óptimo.', trace);
}

function priceOutStep(operations: string[], objective: string): Step | null {
  if (operations.length === 0) return null;
  return {
    title: `Hacer consistente la fila ${objective}`,
    explanation: `Las variables básicas deben tener coeficiente 0 en la fila ${objective}. Como las artificiales empiezan en la base con coeficiente distinto de 0, se les resta el múltiplo necesario de sus filas.`,
    substitution: latexLines(operations),
  };
}

// ─── Simplex tabular (solo ≤) ───────────────────────────────────────────────

/**
 * Simplex tabular con la tabla óptima: la usan el análisis de sensibilidad y la calculadora del
 * simplex. `final` es `null` si no se llegó al óptimo.
 */
export function runSimplexTabular(input: LpInput): {
  result: LpResult;
  lp: LinearProgram | null;
  final: Tableau | null;
} {
  const parsed = parseForSolve(input);
  if (!parsed.ok) return { result: parsed.result, lp: null, final: null };
  const { lp, trace } = parsed;
  const sf = toStandardForm(lp);
  trace.steps.push(standardFormStep(lp, sf, 'plain'));
  if (sf.columns.some((c) => c.kind === 'artificial')) {
    const result = fail(
      'needs-artificial',
      'Hay restricciones ≥ o = (o con lado derecho negativo): no hay una base inicial de holguras. Resuelve el modelo con el método de la M grande o el de las dos fases.',
      trace,
    );
    return { result, lp, final: null };
  }
  const start = initialTableau(lp, sf, 'plain');
  const run = runSimplex(start);
  iterationsTrace(run, trace, 'simplex');
  if (run.status === 'unbounded') return { result: unbounded(run.final, trace), lp, final: null };
  if (run.status === 'max-iterations') return { result: tooMany(trace), lp, final: null };
  return { result: finish(lp, run.final, run.iterations.length, trace), lp, final: run.final };
}

export function solveSimplexTabular(input: LpInput): LpResult {
  return runSimplexTabular(input).result;
}

// ─── M grande ───────────────────────────────────────────────────────────────

export function solveBigM(input: LpInput): LpResult {
  const parsed = parseForSolve(input);
  if (!parsed.ok) return parsed.result;
  const { lp, trace } = parsed;
  const sf = toStandardForm(lp);
  trace.steps.push(standardFormStep(lp, sf, 'big-m'));
  const { tableau: start, operations } = priceOut(initialTableau(lp, sf, 'big-m'));
  const step = priceOutStep(operations, 'z');
  if (step) trace.steps.push(step);
  const run = runSimplex(start);
  iterationsTrace(run, trace, 'm');
  if (run.status === 'unbounded') return unbounded(run.final, trace);
  if (run.status === 'max-iterations') return tooMany(trace);
  const artificials = positiveArtificials(run.final);
  if (artificials.length > 0) {
    trace.steps.push(optimalityStep(run.final));
    return fail(
      'infeasible',
      `Problema infactible: la tabla es óptima pero ${artificials.join(', ')} ${artificials.length === 1 ? 'sigue' : 'siguen'} en la base con valor positivo. Ninguna solución cumple todas las restricciones a la vez.`,
      trace,
    );
  }
  return finish(lp, run.final, run.iterations.length, trace);
}

// ─── Dos fases ──────────────────────────────────────────────────────────────

/** Quita las artificiales tras la fase I (sacando de la base las que quedaron en 0). */
function toPhaseTwo(lp: LinearProgram, t: Tableau): { tableau: Tableau; steps: Step[] } {
  const steps: Step[] = [];
  let current = t;
  for (let i = 0; i < current.rows.length; i++) {
    const b = current.basis[i]!;
    if (current.columns[b]!.kind !== 'artificial') continue;
    const j = current.columns.findIndex(
      (c, k) =>
        c.kind !== 'artificial' && !current.basis.includes(k) && !current.rows[i]![k]!.isZero(),
    );
    if (j >= 0) {
      const { tableau, operations } = pivotTableau(current, i, j);
      steps.push({
        title: `Sacar ${current.columns[b]!.name} de la base`,
        explanation: `La artificial ${current.columns[b]!.name} quedó básica con valor 0. Se hace entrar ${current.columns[j]!.name} en su lugar (pivote degenerado: los valores no cambian).`,
        substitution: latexLines(operations),
      });
      current = tableau;
    } else {
      steps.push({
        title: `Restricción redundante`,
        explanation: `La fila de ${current.columns[b]!.name} solo tiene ceros fuera de las artificiales: es combinación de las demás y se elimina.`,
      });
      current = {
        ...current,
        rows: current.rows.filter((_, k) => k !== i),
        rhs: current.rhs.filter((_, k) => k !== i),
        basis: current.basis.filter((_, k) => k !== i),
      };
      i--;
    }
  }
  const keep = current.columns.flatMap((c, j) => (c.kind === 'artificial' ? [] : [j]));
  const index = new Map(keep.map((j, k) => [j, k]));
  const columns = keep.map((j) => current.columns[j]!);
  const next: Tableau = {
    columns,
    rows: current.rows.map((row) => keep.map((j) => row[j]!)),
    rhs: current.rhs,
    basis: current.basis.map((b) => index.get(b)!),
    z: columns.map((c, k) =>
      c.kind === 'decision' ? new MValue(lp.objective[keep[k]!]!.neg()) : MValue.ZERO,
    ),
    zRhs: MValue.ZERO,
    sense: lp.sense,
    objective: 'z',
  };
  const { tableau, operations } = priceOut(next);
  steps.push({
    title: 'Preparar la fase II',
    explanation:
      'Se eliminan las columnas artificiales y se escribe la fila z con la función objetivo original (−cⱼ). Como algunas variables básicas tienen coeficiente distinto de 0, se hace consistente la fila z con sus filas.',
    substitution: operations.length > 0 ? latexLines(operations) : undefined,
  });
  return { tableau, steps };
}

export function solveTwoPhase(input: LpInput): LpResult {
  const parsed = parseForSolve(input);
  if (!parsed.ok) return parsed.result;
  const { lp, trace } = parsed;
  const sf = toStandardForm(lp);
  const hasArtificial = sf.columns.some((c) => c.kind === 'artificial');
  trace.steps.push(standardFormStep(lp, sf, hasArtificial ? 'phase-1' : 'plain'));
  let phaseTwoStart: Tableau;
  let iterations = 0;
  if (hasArtificial) {
    const { tableau: start, operations } = priceOut(initialTableau(lp, sf, 'phase-1'));
    const step = priceOutStep(operations, 'r');
    if (step) trace.steps.push(step);
    const run = runSimplex(start);
    iterationsTrace(run, trace, 'fase-1');
    iterations += run.iterations.length;
    if (run.status === 'max-iterations') return tooMany(trace);
    const r = run.final.zRhs.a;
    trace.steps.push({
      title: 'Fin de la fase I',
      explanation:
        r.sign() > 0
          ? 'El mínimo de la suma de artificiales es positivo: no existe solución que cumpla todas las restricciones.'
          : 'La suma de artificiales llegó a 0: la base encontrada es factible para el problema original.',
      result: `r^* = ${r.toLatex()}`,
    });
    if (r.sign() > 0) {
      return fail(
        'infeasible',
        `Problema infactible: el mínimo de la fase I es r* = ${r.toText()} > 0, así que las artificiales no pueden anularse.`,
        trace,
      );
    }
    const prepared = toPhaseTwo(lp, run.final);
    trace.steps.push(...prepared.steps);
    phaseTwoStart = prepared.tableau;
  } else {
    trace.notices.push({
      level: 'info',
      message: 'No hay restricciones ≥ ni =: no hace falta la fase I y se resuelve directamente.',
    });
    phaseTwoStart = initialTableau(lp, sf, 'plain');
  }
  const run = runSimplex(phaseTwoStart);
  iterationsTrace(run, trace, hasArtificial ? 'fase-2' : 'simplex');
  iterations += run.iterations.length;
  if (run.status === 'unbounded') return unbounded(run.final, trace);
  if (run.status === 'max-iterations') return tooMany(trace);
  return finish(lp, run.final, iterations, trace);
}

// ─── Solucionador sin traza ─────────────────────────────────────────────────

export type SilentLp =
  | { status: 'optimal'; x: Rational[]; z: Rational; tableau: Tableau }
  | { status: 'infeasible' | 'unbounded' | 'max-iterations' };

/** Resuelve un modelo por la M grande y devuelve solo el resultado. */
export function solveLpSilently(lp: LinearProgram): SilentLp {
  const sf = toStandardForm(lp);
  const { tableau } = priceOut(initialTableau(lp, sf, 'big-m'));
  const run = runSimplex(tableau);
  if (run.status !== 'optimal') return { status: run.status };
  if (positiveArtificials(run.final).length > 0) return { status: 'infeasible' };
  const values = basicSolution(run.final);
  return {
    status: 'optimal',
    x: lp.variables.map((_, j) => values[j]!),
    z: run.final.zRhs.a,
    tableau: run.final,
  };
}
