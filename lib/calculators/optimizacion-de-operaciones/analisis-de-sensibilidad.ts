/**
 * Análisis de sensibilidad desde la tabla óptima del simplex (Taha, sec. 3.6 y 4.5; Hillier &
 * Lieberman, cap. 6). Para modelos con restricciones ≤ y lado derecho no negativo, la columna de
 * la holgura sᵢ en la tabla óptima es la columna i de B⁻¹:
 *
 * - Precio dual yᵢ: coeficiente de sᵢ en la fila z. Cambio de z por unidad adicional de bᵢ.
 * - Rango de bᵢ (factibilidad): la base sigue siendo factible mientras x_B + D·(columna de sᵢ) ≥ 0.
 * - Rango de cⱼ (optimalidad): si xⱼ es básica en la fila r, cada coeficiente de la fila z de una
 *   no básica k cambia en d·α_rk y debe seguir cumpliendo la condición de optimalidad; si xⱼ no
 *   es básica, su coeficiente en la fila z cambia en −d.
 */
import { Rational } from '@/lib/math/rational';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import { variableLatex } from './lp-model';
import { runSimplexTabular, type LpErrorCode, type LpInput } from './lp-solve';
import { lpInputSchema } from './simplex';
import { basicSolution } from './tableau';

export interface Range {
  /** `null` = sin límite. */
  min: number | null;
  max: number | null;
}

export interface SensitivityValue {
  z: number;
  dualPrices: number[];
  rhsRanges: Range[];
  costRanges: Range[];
}

export type SensitivityErrorCode = LpErrorCode;

/** Intervalo de d que cumple a + d·b ≥ 0 para todos los pares. */
function interval(pairs: { a: Rational; b: Rational }[]): {
  lo: Rational | null;
  hi: Rational | null;
} {
  let lo: Rational | null = null;
  let hi: Rational | null = null;
  for (const { a, b } of pairs) {
    if (b.isZero()) continue;
    const bound = a.neg().div(b);
    if (b.sign() > 0) lo = lo === null || bound.gt(lo) ? bound : lo;
    else hi = hi === null || bound.lt(hi) ? bound : hi;
  }
  return { lo, hi };
}

const bound = (v: Rational | null, infinite: string) => (v === null ? infinite : v.toLatex());

export function solveSensitivity(
  input: LpInput,
): CalculatorResult<SensitivityValue, SensitivityErrorCode> {
  const run = runSimplexTabular(input);
  const base = run.result;
  if (!base.ok) {
    return base.error.code === 'needs-artificial'
      ? {
          ...base,
          error: {
            code: 'needs-artificial',
            message:
              'Este análisis usa la tabla óptima del simplex con holguras: el modelo debe tener solo restricciones ≤ con lado derecho no negativo.',
          },
        }
      : base;
  }
  const { lp, final: t } = run;
  if (!lp || !t) {
    return {
      ok: false,
      error: { code: 'max-iterations', message: 'No se obtuvo la tabla óptima.' },
      ...emptyTrace(),
    };
  }
  const values = basicSolution(t);
  const slackOf = lp.constraints.map((_, i) =>
    t.columns.findIndex((c) => c.kind === 'slack' && c.constraint === i),
  );
  const rowOf = (j: number) => t.basis.indexOf(j);
  const nonBasic = t.columns.flatMap((_, k) => (t.basis.includes(k) ? [] : [k]));
  const max = lp.sense === 'max';
  const steps: Step[] = [];

  // ── Precios duales y rangos de los recursos ─────────────────────────────
  const dual = slackOf.map((k) => t.z[k]!.a);
  const rhsRanges = lp.constraints.map((c, i) => {
    const k = slackOf[i]!;
    const { lo, hi } = interval(t.rhs.map((x, r) => ({ a: x, b: t.rows[r]![k]! })));
    return {
      lo: lo === null ? null : c.rhs.add(lo),
      hi: hi === null ? null : c.rhs.add(hi),
      dLo: lo,
      dHi: hi,
    };
  });
  steps.push({
    title: 'Precios duales',
    explanation:
      'En la tabla óptima, el coeficiente de la holgura sᵢ en la fila z es el precio dual del recurso i: cuánto cambia z por cada unidad adicional de bᵢ (mientras la base no cambie). Un recurso con holgura positiva tiene precio dual 0.',
    result: dual.map((y, i) => `y_{${i + 1}} = ${y.toLatex()}`).join(',\\quad '),
  });
  steps.push({
    title: 'Rangos de factibilidad de los recursos',
    explanation:
      'Si bᵢ cambia en D, los valores básicos cambian en D veces la columna de sᵢ. La base sigue siendo factible (y la solución, con los mismos precios duales) mientras ningún valor básico se haga negativo.',
    formula: 'x_B + D \\cdot (\\text{columna de } s_i) \\ge 0',
    children: lp.constraints.map((c, i) => {
      const k = slackOf[i]!;
      const range = rhsRanges[i]!;
      return {
        title: `Recurso ${i + 1} (b = ${c.rhs.toText()})`,
        substitution: t.rows
          .map(
            (row, r) =>
              `${t.columns[t.basis[r]!]!.latex}:\\ ${t.rhs[r]!.toLatex()} ${row[k]!.sign() < 0 ? '-' : '+'} ${row[k]!.abs().toLatex()}D \\ge 0`,
          )
          .join(',\\quad '),
        result: `${bound(range.dLo, '-\\infty')} \\le D \\le ${bound(range.dHi, '\\infty')} \\ \\Rightarrow\\ ${bound(range.lo, '-\\infty')} \\le b_{${i + 1}} \\le ${bound(range.hi, '\\infty')}`,
      };
    }),
  });

  // ── Rangos de los coeficientes del objetivo ─────────────────────────────
  const costRanges = lp.variables.map((_, j) => {
    const r = rowOf(j);
    let lo: Rational | null;
    let hi: Rational | null;
    let detail: string;
    if (r >= 0) {
      // Condición de optimalidad: máx → z_k + dα ≥ 0; mín → z_k + dα ≤ 0 (se niega todo).
      const sign = Rational.of(max ? 1 : -1);
      const pairs = nonBasic.map((k) => ({
        a: t.z[k]!.a.mul(sign),
        b: t.rows[r]![k]!.mul(sign),
      }));
      ({ lo, hi } = interval(pairs));
      detail = nonBasic
        .filter((k) => !t.rows[r]![k]!.isZero())
        .map((k) => {
          const alpha = t.rows[r]![k]!;
          return `${t.columns[k]!.latex}:\\ ${t.z[k]!.a.toLatex()} ${alpha.sign() < 0 ? '-' : '+'} ${alpha.abs().toLatex()}d ${max ? '\\ge' : '\\le'} 0`;
        })
        .join(',\\quad ');
    } else {
      const reduced = t.z[j]!.a;
      if (max) {
        lo = null;
        hi = reduced;
      } else {
        lo = reduced;
        hi = null;
      }
      detail = `${t.columns[j]!.latex}\\ \\text{no básica}:\\ ${reduced.toLatex()} - d ${max ? '\\ge' : '\\le'} 0`;
    }
    const c = lp.objective[j]!;
    return {
      dLo: lo,
      dHi: hi,
      lo: lo === null ? null : c.add(lo),
      hi: hi === null ? null : c.add(hi),
      basic: r >= 0,
      detail,
    };
  });
  steps.push({
    title: 'Rangos de optimalidad de los coeficientes del objetivo',
    explanation: `Si cⱼ cambia en d y xⱼ es básica, los coeficientes de las no básicas en la fila z cambian en d veces su fila; si xⱼ no es básica, solo cambia su propio coeficiente. La solución sigue siendo óptima mientras todos cumplan la condición de optimalidad (${max ? '≥ 0 al maximizar' : '≤ 0 al minimizar'}).`,
    children: lp.variables.map((v, j) => {
      const range = costRanges[j]!;
      return {
        title: `${v} (${range.basic ? 'básica' : 'no básica'}, c = ${lp.objective[j]!.toText()})`,
        substitution: range.detail || undefined,
        result: `${bound(range.dLo, '-\\infty')} \\le d \\le ${bound(range.dHi, '\\infty')} \\ \\Rightarrow\\ ${bound(range.lo, '-\\infty')} \\le c_{${j + 1}} \\le ${bound(range.hi, '\\infty')}`,
      };
    }),
  });

  const num = (v: Rational | null) => (v === null ? null : v.toNumber());
  return {
    ok: true,
    value: {
      z: t.zRhs.a.toNumber(),
      dualPrices: dual.map((y) => y.toNumber()),
      rhsRanges: rhsRanges.map((r) => ({ min: num(r.lo), max: num(r.hi) })),
      costRanges: costRanges.map((r) => ({ min: num(r.lo), max: num(r.hi) })),
    },
    summary: [
      ...base.summary,
      {
        label: 'Precios duales',
        value: dual.map((y, i) => `y_{${i + 1}} = ${y.toLatex()}`).join(',\\ '),
      },
    ],
    ...emptyTrace(),
    steps: [...base.steps, ...steps],
    notices: base.notices,
    tables: [
      ...base.tables,
      {
        id: 'recursos',
        title: 'Recursos: precios duales y rangos de factibilidad',
        columns: [
          { key: 'constraint', header: '\\text{Restricción}', format: 'text' },
          { key: 'rhs', header: 'b_i', format: 'latex' },
          { key: 'slack', header: 's_i', format: 'latex' },
          { key: 'dual', header: 'y_i', format: 'latex' },
          { key: 'min', header: '\\text{Mínimo}', format: 'latex' },
          { key: 'max', header: '\\text{Máximo}', format: 'latex' },
        ],
        rows: lp.constraints.map((c, i) => ({
          constraint: `R${i + 1}`,
          rhs: c.rhs.toLatex(),
          slack: values[slackOf[i]!]!.toLatex(),
          dual: dual[i]!.toLatex(),
          min: bound(rhsRanges[i]!.lo, '-\\infty'),
          max: bound(rhsRanges[i]!.hi, '\\infty'),
        })),
      },
      {
        id: 'costos',
        title: 'Coeficientes del objetivo: rangos de optimalidad',
        columns: [
          { key: 'variable', header: '\\text{Variable}', format: 'latex' },
          { key: 'c', header: 'c_j', format: 'latex' },
          { key: 'value', header: '\\text{Valor}', format: 'latex' },
          { key: 'status', header: '\\text{Estado}', format: 'text' },
          { key: 'min', header: '\\text{Mínimo}', format: 'latex' },
          { key: 'max', header: '\\text{Máximo}', format: 'latex' },
        ],
        rows: lp.variables.map((v, j) => ({
          variable: variableLatex(v),
          c: lp.objective[j]!.toLatex(),
          value: values[j]!.toLatex(),
          status: costRanges[j]!.basic ? 'Básica' : 'No básica',
          min: bound(costRanges[j]!.lo, '-\\infty'),
          max: bound(costRanges[j]!.hi, '\\infty'),
        })),
      },
    ],
  };
}

export const sensitivity: Calculator<LpInput, SensitivityValue, SensitivityErrorCode> = {
  meta: {
    id: 'analisis-de-sensibilidad',
    title: 'Análisis de sensibilidad',
    summary: 'Precios duales y rangos de los recursos y de los coeficientes del objetivo.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 3.6, Ejemplo 3.6-1 (JOBCO) y modelo TOYCO (9.ª ed. en inglés)',
      },
      { sourceId: 'taha', locator: 'Sec. 4.5, análisis post-óptimo (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
    ],
  },
  inputSchema: lpInputSchema,
  // Taha, ejemplo 3.6-1: JOBCO fabrica dos productos en dos máquinas (horas disponibles).
  example: {
    sense: 'max',
    objective: '30x1 + 20x2',
    constraints: '2x1 + x2 <= 8\nx1 + 3x2 <= 8',
  },
  solve: solveSensitivity,
};
