/**
 * Método dual simplex (Taha, sec. 4.4.1). Parte de una tabla que ya cumple la condición de
 * optimalidad pero no es factible (algún lado derecho negativo):
 *
 * - Las restricciones ≥ se multiplican por −1 y las igualdades se escriben como dos
 *   desigualdades, así todas son ≤ con una holgura básica (aunque su valor sea negativo).
 * - Sale la variable básica con el lado derecho más negativo.
 * - Entra, entre las no básicas con coeficiente negativo en esa fila, la de menor
 *   |coeficiente en la fila z / coeficiente en la fila|.
 * - Termina cuando todos los lados derechos son no negativos (óptimo factible).
 */
import { latexLines } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import {
  emptyTrace,
  type CalculatorResult,
  type Calculator,
  type ResultTable,
  type Step,
} from '../types';
import { variableLatex, type LinearProgram, type LpConstraint } from './lp-model';
import { parseForSolve, type LpInput, type LpValue } from './lp-solve';
import { lpInputSchema } from './simplex';
import {
  alternativeOptimaColumns,
  basicSolution,
  degenerateBasics,
  initialTableau,
  MAX_ITERATIONS,
  pivotTableau,
  tableauTable,
  toStandardForm,
  type Tableau,
} from './tableau';

export type DualSimplexErrorCode =
  'invalid-model' | 'not-dual-feasible' | 'infeasible' | 'max-iterations';

type Result = CalculatorResult<LpValue, DualSimplexErrorCode>;

/** Todas las restricciones como ≤ (≥ por −1; = como dos desigualdades). */
function toLessEqual(lp: LinearProgram): { lp: LinearProgram; notes: string[] } {
  const notes: string[] = [];
  const negate = (c: LpConstraint): LpConstraint => ({
    coefficients: c.coefficients.map((a) => a.neg()),
    relation: '<=',
    rhs: c.rhs.neg(),
  });
  const constraints = lp.constraints.flatMap((c, i) => {
    if (c.relation === '<=') return [c];
    if (c.relation === '>=') {
      notes.push(`R${i + 1} (≥) se multiplica por −1`);
      return [negate(c)];
    }
    notes.push(`R${i + 1} (=) se escribe como una ≤ y una ≥, y la ≥ se multiplica por −1`);
    return [{ ...c, relation: '<=' as const }, negate(c)];
  });
  return { lp: { ...lp, constraints }, notes };
}

interface DualIteration {
  leaving: number;
  entering: number | null;
  ratios: (Rational | null)[];
}

function dualTable(t: Tableau, id: string, title: string, info?: DualIteration): ResultTable {
  const table = tableauTable(t, id, title);
  if (info) {
    table.rows = table.rows.map((row, i) =>
      i === info.leaving + 1 ? { ...row, basic: `${row.basic}\\ \\leftarrow` } : row,
    );
    const ratioRow: Record<string, string | null> = { basic: '\\text{Razón}', rhs: null };
    info.ratios.forEach((ratio, j) => {
      ratioRow[`c${j}`] =
        ratio === null ? null : `${ratio.toLatex()}${j === info.entering ? '\\ \\uparrow' : ''}`;
    });
    table.rows.push(ratioRow);
  }
  return table;
}

export function solveDualSimplex(input: LpInput): Result {
  const parsed = parseForSolve(input);
  if (!parsed.ok) {
    const failure = parsed.result;
    return {
      ok: false,
      error: { code: 'invalid-model', message: failure.ok ? '' : failure.error.message },
      ...emptyTrace(),
    };
  }
  const { lp: original, trace } = parsed;
  const { lp, notes } = toLessEqual(original);
  const sf = toStandardForm(lp, { keepNegativeRhs: true });
  let t = initialTableau(lp, sf, 'plain');
  trace.steps.push({
    title: 'Todas las restricciones como ≤',
    explanation:
      'El dual simplex empieza con las holguras como base. Para eso todas las restricciones deben ser ≤, aunque el lado derecho quede negativo (la solución inicial no es factible).',
    substitution: notes.length > 0 ? notes.join('; ') : undefined,
    result: latexLines(
      t.rows.map(
        (row, i) =>
          `${row
            .map((a, j) =>
              a.isZero()
                ? null
                : `${a.sign() < 0 ? '-' : '+'} ${a.abs().eq(Rational.ONE) ? '' : a.abs().toLatex()}${t.columns[j]!.latex}`,
            )
            .filter(Boolean)
            .join(' ')
            .replace(/^\+ /, '')} = ${t.rhs[i]!.toLatex()}`,
      ),
    ),
  });

  // La tabla inicial debe ser óptima (factibilidad dual).
  const bad = t.z.findIndex((v) => (lp.sense === 'max' ? v.sign() < 0 : v.sign() > 0));
  if (bad >= 0) {
    trace.tables.push(tableauTable(t, 'dual-0', 'Tabla inicial'));
    return {
      ok: false,
      error: {
        code: 'not-dual-feasible',
        message: `La tabla inicial no es óptima: ${t.columns[bad]!.name} tiene coeficiente ${t.z[bad]!.a.toText()} en la fila z. El dual simplex necesita empezar con la condición de optimalidad cumplida (al ${lp.sense === 'max' ? 'maximizar, todos los cⱼ ≤ 0' : 'minimizar, todos los cⱼ ≥ 0'}); usa la M grande o las dos fases.`,
      },
      ...emptyTrace(),
      ...trace,
    };
  }

  let iterations = 0;
  for (; iterations < MAX_ITERATIONS; iterations++) {
    let r = -1;
    t.rhs.forEach((v, i) => {
      if (v.sign() < 0 && (r < 0 || v.lt(t.rhs[r]!))) r = i;
    });
    if (r < 0) break;
    const ratios = t.columns.map((_, j) => {
      const a = t.rows[r]![j]!;
      if (t.basis.includes(j) || a.sign() >= 0) return null;
      return t.z[j]!.a.div(a).abs();
    });
    let e: number | null = null;
    for (let j = 0; j < ratios.length; j++) {
      const ratio = ratios[j]!;
      if (ratio !== null && (e === null || ratio.lt(ratios[e]!))) e = j;
    }
    const info: DualIteration = { leaving: r, entering: e, ratios };
    const leaving = t.columns[t.basis[r]!]!.latex;
    trace.tables.push(
      dualTable(
        t,
        `dual-${iterations}`,
        iterations === 0 ? 'Tabla inicial' : `Tabla ${iterations}`,
        info,
      ),
    );
    const children: Step[] = [
      {
        title: 'Variable que sale',
        explanation: 'Sale la variable básica con el lado derecho más negativo.',
        result: `${leaving} = ${t.rhs[r]!.toLatex()} \\ \\text{sale}`,
      },
      {
        title: 'Variable que entra',
        explanation:
          'Entre las no básicas con coeficiente negativo en la fila que sale, entra la de menor cociente |coeficiente en z / coeficiente en la fila|; así la tabla sigue siendo óptima.',
        substitution: latexLines(
          ratios.flatMap((ratio, j) =>
            ratio === null
              ? []
              : [
                  `${t.columns[j]!.latex}:\\ \\left|\\frac{${t.z[j]!.a.toLatex()}}{${t.rows[r]![j]!.toLatex()}}\\right| = ${ratio.toLatex()}`,
                ],
          ),
        ),
        result:
          e === null
            ? '\\text{Ningún coeficiente negativo en la fila: no hay variable que entre}'
            : `${t.columns[e]!.latex} \\ \\text{entra; pivote } = ${t.rows[r]![e]!.toLatex()}`,
      },
    ];
    if (e === null) {
      trace.steps.push({ title: `Iteración ${iterations + 1}`, children });
      return {
        ok: false,
        error: {
          code: 'infeasible',
          message: `Problema infactible: ${t.columns[t.basis[r]!]!.name} es negativa y ninguna variable puede entrar para corregirla (su fila no tiene coeficientes negativos).`,
        },
        ...emptyTrace(),
        ...trace,
      };
    }
    const { tableau, operations } = pivotTableau(t, r, e);
    children.push({
      title: 'Operaciones de fila (Gauss-Jordan)',
      substitution: latexLines(operations),
    });
    trace.steps.push({ title: `Iteración ${iterations + 1}`, children });
    t = tableau;
  }
  if (iterations >= MAX_ITERATIONS) {
    return {
      ok: false,
      error: { code: 'max-iterations', message: 'Se alcanzó el máximo de iteraciones.' },
      ...emptyTrace(),
      ...trace,
    };
  }
  trace.tables.push(
    tableauTable(
      t,
      `dual-${iterations}`,
      `${iterations === 0 ? 'Tabla inicial' : `Tabla ${iterations}`} (óptima y factible)`,
    ),
  );

  const values = basicSolution(t);
  const decisions = original.variables.map((_, j) => values[j]!);
  const z = t.zRhs.a;
  const decisionLatex = original.variables
    .map((v, j) => `${variableLatex(v)} = ${decisions[j]!.toLatex()}`)
    .join(',\\ ');
  trace.steps.push({
    title: 'Solución óptima',
    explanation:
      'Todos los lados derechos son no negativos: la tabla es factible y, como el dual simplex conserva la optimalidad, también es óptima.',
    result: `${decisionLatex},\\qquad z^* = ${z.toLatex()}`,
  });
  const alternative = alternativeOptimaColumns(t);
  const degenerate = degenerateBasics(t);
  return {
    ok: true,
    value: {
      z: z.toNumber(),
      zExact: z.toText(),
      variables: Object.fromEntries(
        original.variables.map((v, j) => [v, decisions[j]!.toNumber()]),
      ),
      exact: Object.fromEntries(original.variables.map((v, j) => [v, decisions[j]!.toText()])),
      iterations,
      alternativeOptima: alternative.length > 0,
      degenerate: degenerate.length > 0,
    },
    summary: [
      { label: 'Valor óptimo', value: `z^* = ${z.toLatex()}`, emphasis: true },
      { label: 'Solución', value: decisionLatex },
      { label: 'Iteraciones', value: String(iterations) },
    ],
    ...emptyTrace(),
    ...trace,
  };
}

export const dualSimplex: Calculator<LpInput, LpValue, DualSimplexErrorCode> = {
  meta: {
    id: 'dual-simplex',
    title: 'Método dual simplex',
    summary: 'Simplex que parte de una tabla óptima pero no factible.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 4.4.1, Ejemplo 4.4-1 (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'gould-eppen-schmidt' },
    ],
  },
  inputSchema: lpInputSchema,
  // Taha, ejemplo 4.4-1.
  example: {
    sense: 'min',
    objective: '3x1 + 2x2 + x3',
    constraints: '3x1 + x2 + x3 >= 3\n-3x1 + 3x2 + x3 >= 6\nx1 + x2 + x3 <= 3',
  },
  solve: solveDualSimplex,
};
