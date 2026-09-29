/**
 * Método simplex algebraico (Taha, sec. 3.2 y 3.3.1; Hillier y Lieberman, "El álgebra del método
 * simplex"). Resuelve el mismo modelo que el simplex tabular, pero con las ecuaciones:
 *
 * 1. Soluciones básicas: con m ecuaciones y n variables, se igualan a 0 n − m variables (no
 *    básicas) y se resuelven las m restantes. Las factibles son los vértices de la región.
 * 2. En cada iteración, las básicas y z se escriben en función de las no básicas. Entra la no
 *    básica con la mayor tasa de mejora de z; crece hasta que una básica llega a 0 (razón mínima);
 *    se despeja de esa ecuación y se sustituye en las demás.
 * 3. Termina cuando ninguna no básica mejora z.
 *
 * Usa el motor de `tableau.ts` (las mismas reglas que la tabla); aquí solo cambia la presentación.
 */
import { z } from 'zod';
import { latexLines } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import type { Calculator, ResultTable, Step } from '../types';
import { lpInputShape, objectiveValue, refineLp, type LinearProgram } from './lp-model';
import {
  fail,
  finish,
  parseForSolve,
  standardFormStep,
  tooMany,
  unbounded,
  type LpErrorCode,
  type LpInput,
  type LpResult,
  type LpValue,
} from './lp-solve';
import {
  basicSolution,
  initialTableau,
  runSimplex,
  toStandardForm,
  type IterationInfo,
  type StandardForm,
  type Tableau,
} from './tableau';

/** Con más combinaciones que esto no se enumeran las soluciones básicas. */
const MAX_BASIC_SOLUTIONS = 84;

export const algebraicSimplexInputSchema = z.object(lpInputShape).superRefine(refineLp);

// ─── Soluciones básicas ─────────────────────────────────────────────────────

function combinations(size: number, k: number): number[][] {
  const result: number[][] = [];
  const current: number[] = [];
  const visit = (from: number) => {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = from; i < size; i++) {
      current.push(i);
      visit(i + 1);
      current.pop();
    }
  };
  visit(0);
  return result;
}

/** Resuelve A·x = b (A cuadrada) con fracciones exactas; `null` si A es singular. */
function solveSquare(a: Rational[][], b: Rational[]): Rational[] | null {
  const m = b.length;
  const rows = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < m; col++) {
    const pivot = rows.findIndex((row, i) => i >= col && !row[col]!.isZero());
    if (pivot < 0) return null;
    [rows[col], rows[pivot]] = [rows[pivot]!, rows[col]!];
    const p = rows[col]![col]!;
    rows[col] = rows[col]!.map((v) => v.div(p));
    for (let i = 0; i < m; i++) {
      if (i === col) continue;
      const factor = rows[i]![col]!;
      if (factor.isZero()) continue;
      rows[i] = rows[i]!.map((v, j) => v.sub(factor.mul(rows[col]![j]!)));
    }
  }
  return rows.map((row) => row[m]!);
}

interface BasicSolution {
  basis: number[];
  values: Rational[] | null;
  feasible: boolean;
  z: Rational | null;
}

function enumerateBasicSolutions(lp: LinearProgram, sf: StandardForm): BasicSolution[] {
  const m = sf.rows.length;
  return combinations(sf.columns.length, m).map((basis) => {
    const matrix = sf.rows.map((row) => basis.map((j) => row[j]!));
    const solved = solveSquare(matrix, sf.rhs);
    if (!solved) return { basis, values: null, feasible: false, z: null };
    const values = sf.columns.map(() => Rational.ZERO);
    basis.forEach((j, i) => {
      values[j] = solved[i]!;
    });
    const feasible = solved.every((v) => v.sign() >= 0);
    const x = lp.variables.map((_, j) => values[j]!);
    return { basis, values, feasible, z: objectiveValue(lp, x) };
  });
}

const sameBasis = (a: number[], b: number[]) =>
  a.length === b.length &&
  [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);

function basicSolutionsTable(
  sf: StandardForm,
  solutions: BasicSolution[],
  path: number[][],
): ResultTable {
  const names = sf.columns.map((c) => c.latex);
  return {
    id: 'soluciones-basicas',
    title: 'Soluciones básicas',
    columns: [
      { key: 'nonbasic', header: '\\text{No básicas} = 0', format: 'latex' },
      { key: 'basic', header: '\\text{Básicas}', format: 'latex' },
      { key: 'feasible', header: '\\text{¿Factible?}', format: 'text' },
      { key: 'z', header: 'z', format: 'latex' },
      { key: 'simplex', header: '\\text{Simplex}', format: 'text' },
    ],
    rows: solutions.map((s) => {
      const visit = path.findIndex((basis) => sameBasis(basis, s.basis));
      return {
        nonbasic: sf.columns
          .map((_, j) => j)
          .filter((j) => !s.basis.includes(j))
          .map((j) => names[j])
          .join(', '),
        basic:
          s.values === null
            ? `${s.basis.map((j) => names[j]).join(', ')}:\\ \\text{sin solución única}`
            : s.basis.map((j) => `${names[j]} = ${s.values![j]!.toLatex()}`).join(',\\ '),
        feasible: s.values === null ? '—' : s.feasible ? 'Sí' : 'No',
        z: s.feasible && s.z !== null ? s.z.toLatex() : '\\text{—}',
        simplex: visit < 0 ? '' : visit === 0 ? 'Inicio' : `Iteración ${visit}`,
      };
    }),
  };
}

// ─── Ecuaciones en función de las no básicas ────────────────────────────────

/** «c + a·x + b·y» con signos, omitiendo ceros y coeficientes 1. */
function affine(constant: Rational, terms: { coefficient: Rational; latex: string }[]): string {
  let text = constant.isZero() ? '' : constant.toLatex();
  for (const { coefficient, latex } of terms) {
    if (coefficient.isZero()) continue;
    const abs = coefficient.abs();
    const term = `${abs.eq(Rational.ONE) ? '' : abs.toLatex()}${latex}`;
    const negative = coefficient.sign() < 0;
    text += text === '' ? `${negative ? '-' : ''}${term}` : ` ${negative ? '-' : '+'} ${term}`;
  }
  return text === '' ? '0' : text;
}

function nonBasic(t: Tableau): number[] {
  return t.columns.map((_, j) => j).filter((j) => !t.basis.includes(j));
}

/** Básicas y z en función de las no básicas: x₂ = 5/2 − ½x₁ − ½s₂, z = 15/2 + ½x₁ − 3/2 s₂. */
function dictionary(t: Tableau): string[] {
  const free = nonBasic(t);
  const rows = t.rows.map(
    (row, i) =>
      `${t.columns[t.basis[i]!]!.latex} = ${affine(
        t.rhs[i]!,
        free.map((j) => ({ coefficient: row[j]!.neg(), latex: t.columns[j]!.latex })),
      )}`,
  );
  const objective = `z = ${affine(
    t.zRhs.a,
    free.map((j) => ({ coefficient: t.z[j]!.a.neg(), latex: t.columns[j]!.latex })),
  )}`;
  return [objective, ...rows];
}

function currentSolution(t: Tableau): string {
  const values = basicSolution(t);
  const free = nonBasic(t);
  return latexLines([
    `${free.map((j) => t.columns[j]!.latex).join(' = ')} = 0 \\ (\\text{no básicas})`,
    `${t.basis.map((b) => `${t.columns[b]!.latex} = ${values[b]!.toLatex()}`).join(',\\ ')}, \\qquad z = ${t.zRhs.a.toLatex()}`,
  ]);
}

function iterationStep(
  t: Tableau,
  next: Tableau | undefined,
  info: IterationInfo,
  n: number,
): Step {
  const entering = t.columns[info.entering]!.latex;
  const rate = info.enteringValue.a.neg();
  const max = t.sense === 'max';
  const children: Step[] = [
    {
      title: 'Ecuaciones en función de las no básicas',
      explanation:
        'Cada variable básica y z se escriben en términos de las no básicas; así se ve qué pasa si una no básica deja de valer 0.',
      result: latexLines(dictionary(t)),
    },
    { title: 'Solución básica actual', result: currentSolution(t) },
    {
      title: 'Prueba de optimalidad: variable que entra',
      explanation: max
        ? `z aumenta si crece una no básica con coeficiente positivo en la ecuación de z. Se aumenta una sola a la vez: la de mayor tasa de mejora.`
        : `z disminuye si crece una no básica con coeficiente negativo en la ecuación de z. Se aumenta una sola a la vez: la de mayor tasa de mejora (el coeficiente más negativo).`,
      result: `${entering} \\ \\text{entra (tasa } ${rate.toLatex()})`,
    },
    {
      title: '¿Cuánto puede crecer? (razón mínima)',
      explanation: `Con las demás no básicas en 0, cada básica cambia al crecer ${t.columns[info.entering]!.name}. Ninguna puede volverse negativa: la primera que llega a 0 sale de la base.`,
      substitution: latexLines(
        t.rows.map((row, i) => {
          const basic = t.columns[t.basis[i]!]!.latex;
          const a = row[info.entering]!;
          const expression = `${basic} = ${affine(t.rhs[i]!, [{ coefficient: a.neg(), latex: entering }])}`;
          const ratio = info.ratios[i];
          return ratio === null || ratio === undefined
            ? `${expression} \\ \\Rightarrow\\ \\text{no limita}`
            : `${expression} \\ge 0 \\ \\Rightarrow\\ ${entering} \\le ${ratio.toLatex()}`;
        }),
      ),
      result:
        info.leaving === null
          ? `\\text{Ninguna básica limita a } ${entering}`
          : `${t.columns[t.basis[info.leaving]!]!.latex} \\ \\text{sale;}\\ ${entering} = ${info.ratios[info.leaving]!.toLatex()}`,
    },
  ];
  if (info.leaving !== null && next) {
    const r = info.leaving;
    const newRow = next.rows[r]!;
    const free = nonBasic(next);
    children.push({
      title: 'Despejar y sustituir',
      explanation: `Se despeja ${t.columns[info.entering]!.name} de la ecuación de ${t.columns[t.basis[r]!]!.name} y se sustituye en las demás ecuaciones y en z (es la eliminación de Gauss-Jordan de la tabla).`,
      substitution: `${entering} = ${affine(
        next.rhs[r]!,
        free.map((j) => ({ coefficient: newRow[j]!.neg(), latex: next.columns[j]!.latex })),
      )}`,
      result: currentSolution(next),
    });
  }
  return { title: `Iteración ${n}`, children };
}

function iterationsTable(tableaus: Tableau[]): ResultTable {
  return {
    id: 'recorrido',
    title: 'Recorrido del simplex',
    columns: [
      { key: 'iteration', header: '\\text{Iteración}', format: 'text' },
      { key: 'basis', header: '\\text{Solución básica}', format: 'latex' },
      { key: 'z', header: 'z', format: 'latex' },
    ],
    rows: tableaus.map((t, k) => {
      const values = basicSolution(t);
      return {
        iteration: k === 0 ? 'Inicio' : String(k),
        basis: t.basis.map((b) => `${t.columns[b]!.latex} = ${values[b]!.toLatex()}`).join(',\\ '),
        z: t.zRhs.a.toLatex(),
      };
    }),
  };
}

export function solveAlgebraicSimplex(input: LpInput): LpResult {
  const parsed = parseForSolve(input);
  if (!parsed.ok) return parsed.result;
  const { lp, trace } = parsed;
  const sf = toStandardForm(lp);
  trace.steps.push(standardFormStep(lp, sf, 'plain'));
  if (sf.columns.some((c) => c.kind === 'artificial')) {
    return fail(
      'needs-artificial',
      'Hay restricciones ≥ o = (o con lado derecho negativo): no hay una solución básica inicial con las holguras. Resuelve el modelo con el método de la M grande o el de las dos fases.',
      trace,
    );
  }

  const run = runSimplex(initialTableau(lp, sf, 'plain'));
  const path = run.tableaus.map((t) => t.basis);

  const total = sf.columns.length;
  const m = sf.rows.length;
  let count = 1;
  for (let i = 1; i <= m; i++) count = (count * (total - m + i)) / i;
  if (Math.round(count) <= MAX_BASIC_SOLUTIONS) {
    const solutions = enumerateBasicSolutions(lp, sf);
    const feasible = solutions.filter((s) => s.feasible).length;
    trace.steps.push({
      title: 'Soluciones básicas',
      explanation: `Hay ${m} ecuaciones y ${total} variables: cada solución básica iguala a 0 ${total - m} variables (no básicas) y resuelve las ${m} ecuaciones para las demás (básicas). Las factibles (todas ≥ 0) son los vértices de la región factible. El simplex no las revisa todas: parte del origen y pasa a una vecina que mejora z (ver la columna «Simplex» de la tabla).`,
      formula: '\\binom{n}{m} = \\frac{n!}{m!\\,(n-m)!}',
      substitution: `\\binom{${total}}{${m}} = ${Math.round(count)}`,
      result: `${Math.round(count)}\\ \\text{soluciones básicas},\\ ${feasible}\\ \\text{factibles}`,
    });
    trace.tables.push(basicSolutionsTable(sf, solutions, path));
  }

  run.iterations.forEach((info, k) => {
    trace.steps.push(iterationStep(run.tableaus[k]!, run.tableaus[k + 1], info, k + 1));
  });
  trace.tables.push(iterationsTable(run.tableaus));

  if (run.status === 'unbounded') return unbounded(run.final, trace);
  if (run.status === 'max-iterations') return tooMany(trace);
  const final = run.final;
  const max = final.sense === 'max';
  return finish(lp, final, run.iterations.length, trace, {
    optimality: {
      title: 'Prueba de optimalidad',
      explanation: max
        ? 'En la ecuación de z ninguna no básica tiene coeficiente positivo: aumentar cualquiera no mejora z. La solución es óptima.'
        : 'En la ecuación de z ninguna no básica tiene coeficiente negativo: aumentar cualquiera no disminuye z. La solución es óptima.',
      result: latexLines(dictionary(final)),
    },
    solution:
      'Las no básicas valen 0 y las básicas toman el término constante de su ecuación; z es el término constante de la ecuación de z.',
  });
}

export const algebraicSimplex: Calculator<LpInput, LpValue, LpErrorCode> = {
  meta: {
    id: 'simplex-algebraico',
    title: 'Método simplex algebraico',
    summary:
      'Resuelve un modelo con las ecuaciones: soluciones básicas, variable que entra, razón mínima y sustitución.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 3.2 y 3.3.1, Ejemplo 3.2-1 (10.ª ed. en inglés)',
      },
      { sourceId: 'hillier-lieberman-2002', locator: 'El álgebra del método simplex' },
      { sourceId: 'arreola-2003' },
    ],
  },
  inputSchema: algebraicSimplexInputSchema,
  // Taha, ejemplo 3.2-1: máx z = 2x1 + 3x2 con 2x1 + x2 ≤ 4 y x1 + 2x2 ≤ 5.
  example: {
    sense: 'max',
    objective: '2x1 + 3x2',
    constraints: '2x1 + x2 <= 4\nx1 + 2x2 <= 5',
  },
  solve: solveAlgebraicSimplex,
};
