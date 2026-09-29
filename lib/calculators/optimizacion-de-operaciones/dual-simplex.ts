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
import { emptyTrace, type CalculatorResult, type Calculator } from '../types';
import { variableLatex, type LinearProgram, type LpConstraint } from './lp-model';
import { parseForSolve, type LpInput, type LpValue } from './lp-solve';
import { lpInputSchema } from './simplex';
import {
  alternativeOptimaColumns,
  basicSolution,
  degenerateBasics,
  dualIterationStep,
  dualTableauTable,
  initialTableau,
  runDualSimplex,
  tableauTable,
  toStandardForm,
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

  const run = runDualSimplex(t);
  run.iterations.forEach((info, k) => {
    const before = run.tableaus[k]!;
    trace.tables.push(
      dualTableauTable(before, `dual-${k}`, k === 0 ? 'Tabla inicial' : `Tabla ${k}`, info),
    );
    trace.steps.push(dualIterationStep(before, info, k + 1));
  });
  t = run.final;
  const iterations = run.tableaus.length - 1;
  if (run.status === 'infeasible') {
    const r = run.iterations.at(-1)!.leaving;
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
  if (run.status === 'max-iterations') {
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
