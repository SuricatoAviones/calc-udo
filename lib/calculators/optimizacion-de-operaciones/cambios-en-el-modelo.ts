/**
 * Análisis post-óptimo (Taha, sec. 4.5): qué pasa con la solución óptima si cambia el modelo, sin
 * resolverlo de nuevo. Parte de la tabla óptima del simplex (restricciones ≤ con holguras), cuyas
 * columnas de holgura forman B⁻¹ y cuyos coeficientes de holgura en la fila z son los precios
 * duales y = c_B B⁻¹.
 *
 * - Lado derecho (ej. 4.5-1): x_B = B⁻¹b'. Si algún valor es negativo, dual simplex.
 * - Nueva restricción (ej. 4.5-2): si la solución la cumple es redundante; si no, se agrega a la
 *   tabla, se hace consistente con la base y se aplica el dual simplex.
 * - Función objetivo (ej. 4.5-3): nuevos y = c_B B⁻¹ y costos reducidos yaⱼ − cⱼ. Si alguno viola
 *   la optimalidad, simplex primal.
 * - Nueva variable (ej. 4.5-4): costo reducido ya − c. Si conviene, entra con la columna B⁻¹a.
 * - Coeficientes tecnológicos de una variable no básica: igual que una variable nueva. Si la
 *   variable es básica cambia B y la tabla ya no sirve: se resuelve de nuevo (observación final
 *   de la sec. 4.5).
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { latexLines, parseFraction } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Notice,
  type ResultTable,
  type Step,
} from '../types';
import {
  linearLatex,
  lpInputShape,
  parseConstraintLine,
  parseLinearCoefficients,
  parseLinearProgram,
  refineLp,
  relationLatex,
  variableLatex,
  type LinearProgram,
} from './lp-model';
import { runSimplexTabular, type LpErrorCode } from './lp-solve';
import {
  basicSolution,
  dualIterationStep,
  dualTableauTable,
  initialTableau,
  iterationStep,
  MValue,
  runDualSimplex,
  runSimplex,
  tableauTable,
  toStandardForm,
  type Column,
  type Tableau,
} from './tableau';

export const changeTypes = [
  'lado-derecho',
  'objetivo',
  'coeficientes-tecnologicos',
  'nueva-variable',
  'nueva-restriccion',
] as const;
export type ChangeType = (typeof changeTypes)[number];

/** Lista de números («600 640 590» o «1, 1, 2») → racionales, o un mensaje de error. */
function parseNumbers(text: string | undefined, count: number, what: string): Rational[] | string {
  const { values, invalid } = parseDataList(text ?? '');
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  if (values.length !== count) {
    return `Escribe ${count} ${count === 1 ? 'número' : 'números'} para ${what}, uno por restricción.`;
  }
  return values.map((v) => Rational.fromNumber(v));
}

function parseCost(text: string | undefined): Rational | null | string {
  const clean = (text ?? '').trim();
  if (clean === '') return null;
  const value = parseFraction(clean);
  return Number.isFinite(value) ? Rational.fromNumber(value) : 'El costo debe ser un número.';
}

export const modelChangeInputSchema = z
  .object({
    ...lpInputShape,
    change: z.enum(changeTypes, { error: 'Elige qué cambia en el modelo.' }),
    rhs: z.string().optional(),
    newObjective: z.string().optional(),
    variable: z.string().optional(),
    column: z.string().optional(),
    cost: z.string().optional(),
    constraint: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    refineLp(v, ctx);
    const parsed = parseLinearProgram(v.sense, v.objective, v.constraints);
    if (!parsed.ok) return;
    const { variables, constraints } = parsed.lp;
    const m = constraints.length;
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    switch (v.change) {
      case 'lado-derecho': {
        const rhs = parseNumbers(v.rhs, m, 'el lado derecho');
        if (typeof rhs === 'string') issue('rhs', rhs);
        break;
      }
      case 'objetivo': {
        const c = parseLinearCoefficients(v.newObjective ?? '', variables);
        if (typeof c === 'string') issue('newObjective', `Función objetivo: ${c}.`);
        break;
      }
      case 'coeficientes-tecnologicos': {
        const name = (v.variable ?? '').trim().replace(/_/g, '');
        if (!variables.includes(name)) {
          issue('variable', `Escribe una variable del modelo: ${variables.join(', ')}.`);
        }
        const column = parseNumbers(v.column, m, 'la columna');
        if (typeof column === 'string') issue('column', column);
        const cost = parseCost(v.cost);
        if (typeof cost === 'string') issue('cost', cost);
        break;
      }
      case 'nueva-variable': {
        const column = parseNumbers(v.column, m, 'la columna');
        if (typeof column === 'string') issue('column', column);
        const cost = parseCost(v.cost);
        if (typeof cost === 'string') issue('cost', cost);
        else if (cost === null) issue('cost', 'Escribe el coeficiente de la nueva variable en z.');
        break;
      }
      case 'nueva-restriccion': {
        const c = parseConstraintLine(v.constraint ?? '', variables);
        if (typeof c === 'string') issue('constraint', `Restricción: ${c}.`);
        else if (c.relation === '=') {
          issue(
            'constraint',
            'Escribe la restricción con <= o >=. Una igualdad equivale a dos desigualdades.',
          );
        }
        break;
      }
    }
  });

export type ModelChangeInput = z.infer<typeof modelChangeInputSchema>;

export interface ModelChangeValue {
  /** `sin-cambios`: misma solución; `nuevos-valores`: misma base, otros valores; `nueva-base`. */
  status: 'sin-cambios' | 'nuevos-valores' | 'nueva-base';
  z: number;
  zExact: string;
  variables: Record<string, number>;
  exact: Record<string, string>;
  /** Iteraciones hechas después del cambio. */
  iterations: number;
}

export type ModelChangeErrorCode = LpErrorCode | 'invalid-change';

type Result = CalculatorResult<ModelChangeValue, ModelChangeErrorCode>;

// ─── Presentación ───────────────────────────────────────────────────────────

const bmatrix = (rows: Rational[][]) =>
  `\\begin{bmatrix} ${rows.map((row) => row.map((v) => v.toLatex()).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
const column = (values: Rational[]) => bmatrix(values.map((v) => [v]));
const row = (values: Rational[]) => `\\left(${values.map((v) => v.toLatex()).join(',\\ ')}\\right)`;
const dot = (a: Rational[], b: Rational[]) =>
  a.reduce((s, v, i) => s.add(v.mul(b[i]!)), Rational.ZERO);

// ─── Tabla óptima: B⁻¹ y precios duales ─────────────────────────────────────

interface Optimum {
  lp: LinearProgram;
  t: Tableau;
  slack: number[];
  inverse: Rational[][];
  duals: Rational[];
}

function optimumOf(lp: LinearProgram, t: Tableau): Optimum {
  const slack = lp.constraints.map((_, i) =>
    t.columns.findIndex((c) => c.kind === 'slack' && c.constraint === i),
  );
  return {
    lp,
    t,
    slack,
    inverse: t.rows.map((r) => slack.map((k) => r[k]!)),
    duals: slack.map((k) => t.z[k]!.a),
  };
}

/** Valores de las variables de decisión (incluida una nueva) y z de una tabla. */
function decisionsOf(t: Tableau) {
  const values = basicSolution(t);
  const decisions = t.columns.flatMap((c, j) =>
    c.kind === 'decision' ? [{ c, v: values[j]! }] : [],
  );
  return { decisions, z: t.zRhs.a };
}

const optimalFor = (t: Tableau) => (v: MValue) =>
  t.sense === 'max' ? v.sign() >= 0 : v.sign() <= 0;

// ─── Resultado común ────────────────────────────────────────────────────────

interface Continuation {
  steps: Step[];
  tables: ResultTable[];
  notices: Notice[];
}

function success(
  original: Tableau,
  final: Tableau,
  status: ModelChangeValue['status'],
  iterations: number,
  trace: Continuation,
  verdict: string,
): Result {
  const before = decisionsOf(original);
  const { decisions, z: zNew } = decisionsOf(final);
  const decisionLatex = decisions.map(({ c, v }) => `${c.latex} = ${v.toLatex()}`).join(',\\ ');
  trace.steps.push({
    title: status === 'sin-cambios' ? 'Conclusión' : 'Nueva solución óptima',
    explanation: verdict,
    result: `${decisionLatex}, \\qquad z^* = ${zNew.toLatex()}`,
  });
  return {
    ok: true,
    value: {
      status,
      z: zNew.toNumber(),
      zExact: zNew.toText(),
      variables: Object.fromEntries(decisions.map(({ c, v }) => [c.name, v.toNumber()])),
      exact: Object.fromEntries(decisions.map(({ c, v }) => [c.name, v.toText()])),
      iterations,
    },
    summary: [
      {
        label: 'Resultado',
        value: `\\text{${status === 'sin-cambios' ? 'La solución no cambia' : status === 'nuevos-valores' ? 'Misma base, nuevos valores' : 'Cambia la solución óptima'}}`,
        emphasis: true,
      },
      { label: 'Valor óptimo', value: `z^* = ${zNew.toLatex()}` },
      { label: 'Solución', value: decisionLatex },
      { label: 'Antes del cambio', value: `z^* = ${before.z.toLatex()}` },
    ],
    ...emptyTrace(),
    ...trace,
  };
}

function failure(code: ModelChangeErrorCode, message: string, trace: Continuation): Result {
  return { ok: false, error: { code, message }, ...emptyTrace(), ...trace };
}

/** Continúa con el simplex primal desde una tabla factible que dejó de ser óptima. */
function continuePrimal(original: Tableau, start: Tableau, trace: Continuation): Result {
  const run = runSimplex(start);
  run.iterations.forEach((info, k) => {
    const before = run.tableaus[k]!;
    trace.tables.push(
      tableauTable(before, `cambio-${k}`, k === 0 ? 'Tabla modificada' : `Tabla ${k}`, info),
    );
    trace.steps.push({
      ...iterationStep(before, info, k + 1),
      title: `Simplex primal: iteración ${k + 1}`,
    });
  });
  if (run.status === 'unbounded') {
    return failure(
      'unbounded',
      'Después del cambio la solución no está acotada: la variable que entra no tiene coeficientes positivos en su columna.',
      trace,
    );
  }
  if (run.status === 'max-iterations') {
    return failure('max-iterations', 'Se alcanzó el máximo de iteraciones.', trace);
  }
  trace.tables.push(tableauTable(run.final, 'cambio-final', 'Tabla óptima después del cambio'));
  return success(
    original,
    run.final,
    'nueva-base',
    run.iterations.length,
    trace,
    'Con el simplex primal se recupera la optimalidad: ningún coeficiente de la fila z viola la condición de optimalidad.',
  );
}

/** Continúa con el dual simplex desde una tabla óptima que dejó de ser factible. */
function continueDual(original: Tableau, start: Tableau, trace: Continuation): Result {
  const run = runDualSimplex(start);
  run.iterations.forEach((info, k) => {
    const before = run.tableaus[k]!;
    trace.tables.push(
      dualTableauTable(before, `cambio-${k}`, k === 0 ? 'Tabla modificada' : `Tabla ${k}`, info),
    );
    trace.steps.push({
      ...dualIterationStep(before, info, k + 1),
      title: `Dual simplex: iteración ${k + 1}`,
    });
  });
  if (run.status === 'infeasible') {
    return failure(
      'infeasible',
      'Después del cambio el modelo es infactible: una variable básica es negativa y ninguna puede entrar a corregirla.',
      trace,
    );
  }
  if (run.status === 'max-iterations') {
    return failure('max-iterations', 'Se alcanzó el máximo de iteraciones.', trace);
  }
  trace.tables.push(tableauTable(run.final, 'cambio-final', 'Tabla óptima después del cambio'));
  return success(
    original,
    run.final,
    'nueva-base',
    run.iterations.length,
    trace,
    'Con el dual simplex se recupera la factibilidad sin perder la optimalidad.',
  );
}

// ─── Cada tipo de cambio ────────────────────────────────────────────────────

function changeRhs(o: Optimum, rhs: Rational[], trace: Continuation): Result {
  const { t, inverse, duals } = o;
  const values = inverse.map((r) => dot(r, rhs));
  const zNew = dot(duals, rhs);
  trace.steps.push({
    title: 'Nuevo lado derecho de la tabla',
    explanation:
      'Solo cambia la columna Solución: los valores de las básicas son B⁻¹ por el nuevo vector b. La fila z no cambia, así que la tabla sigue cumpliendo la condición de optimalidad.',
    formula: "x_B = B^{-1} b', \\qquad z = y\\,b'",
    substitution: `${bmatrix(inverse)} ${column(rhs)} = ${column(values)}`,
    result: latexLines([
      t.basis.map((b, i) => `${t.columns[b]!.latex} = ${values[i]!.toLatex()}`).join(',\\ '),
      `z = ${row(duals)} \\cdot ${row(rhs)} = ${zNew.toLatex()}`,
    ]),
  });
  const modified: Tableau = { ...t, rhs: values, zRhs: new MValue(zNew) };
  const negative = values.findIndex((v) => v.sign() < 0);
  if (negative < 0) {
    trace.tables.push(tableauTable(modified, 'cambio-final', 'Tabla con el nuevo lado derecho'));
    return success(
      t,
      modified,
      'nuevos-valores',
      0,
      trace,
      'Todas las básicas siguen siendo no negativas: la base actual sigue siendo óptima y factible, con los nuevos valores.',
    );
  }
  trace.steps.push({
    title: 'Factibilidad',
    explanation: `${t.columns[t.basis[negative]!]!.name} = ${values[negative]!.toText()} < 0: la solución deja de ser factible. Como la fila z sigue siendo óptima, se aplica el dual simplex.`,
  });
  return continueDual(t, modified, trace);
}

function changeObjective(o: Optimum, c: Rational[], trace: Continuation): Result {
  const { lp, t, inverse } = o;
  const n = lp.variables.length;
  const costOf = (j: number) => (j < n ? c[j]! : Rational.ZERO);
  const cB = t.basis.map(costOf);
  const duals = o.slack.map((_, k) =>
    dot(
      cB,
      inverse.map((r) => r[k]!),
    ),
  );
  const zRow = t.columns.map(
    (_, j) =>
      new MValue(
        dot(
          cB,
          t.rows.map((r) => r[j]!),
        ).sub(costOf(j)),
      ),
  );
  const zRhs = new MValue(dot(cB, t.rhs));
  const nonBasic = t.columns.map((_, j) => j).filter((j) => !t.basis.includes(j));
  const columnOf = (j: number) =>
    j < n
      ? lp.constraints.map((ct) => ct.coefficients[j]!)
      : o.slack.map((k) => (k === j ? Rational.ONE : Rational.ZERO));
  trace.steps.push(
    {
      title: 'Nuevos precios duales',
      explanation:
        'Con los nuevos coeficientes de las variables básicas (0 para las holguras) se recalculan los valores duales.',
      formula: 'y = c_B\\,B^{-1}',
      substitution: `y = ${row(cB)} ${bmatrix(inverse)}`,
      result: `y = ${row(duals)}`,
    },
    {
      title: 'Costos reducidos de las no básicas',
      explanation:
        'Cada coeficiente de la fila z es la diferencia entre el lado izquierdo y el derecho de la restricción dual: y·aⱼ − cⱼ. Los de las básicas siguen en 0.',
      formula: 'z_j - c_j = y\\,a_j - c_j',
      substitution: latexLines(
        nonBasic.map((j) => {
          const a = columnOf(j);
          return `${t.columns[j]!.latex}:\\ ${row(duals)} \\cdot ${row(a)} - ${costOf(j).toLatex()} = ${zRow[j]!.toLatex()}`;
        }),
      ),
    },
  );
  const modified: Tableau = { ...t, z: zRow, zRhs };
  const violating = nonBasic.filter((j) => !optimalFor(t)(zRow[j]!));
  if (violating.length === 0) {
    trace.tables.push(tableauTable(modified, 'cambio-final', 'Tabla con la nueva fila z'));
    return success(
      t,
      modified,
      'nuevos-valores',
      0,
      trace,
      `Todos los costos reducidos cumplen la condición de optimalidad (${t.sense === 'max' ? '≥ 0' : '≤ 0'}): la solución sigue siendo óptima; solo cambia el valor de z.`,
    );
  }
  trace.steps.push({
    title: 'Optimalidad',
    explanation: `${violating.map((j) => t.columns[j]!.name).join(', ')} ${violating.length === 1 ? 'viola' : 'violan'} la condición de optimalidad: la solución deja de ser óptima (sigue siendo factible), así que se continúa con el simplex primal.`,
  });
  return continuePrimal(t, modified, trace);
}

/** Inserta una columna de decisión en la tabla (después de las demás de decisión). */
function withColumn(
  t: Tableau,
  at: number,
  col: Column,
  entries: Rational[],
  zValue: MValue,
): Tableau {
  const insert = <T>(list: T[], value: T) => [...list.slice(0, at), value, ...list.slice(at)];
  return {
    ...t,
    columns: insert(t.columns, col),
    rows: t.rows.map((r, i) => insert(r, entries[i]!)),
    z: insert(t.z, zValue),
    basis: t.basis.map((b) => (b >= at ? b + 1 : b)),
  };
}

function enterColumn(
  o: Optimum,
  name: string,
  a: Rational[],
  cost: Rational,
  replace: number | null,
  trace: Continuation,
): Result {
  const { t, inverse, duals } = o;
  const reduced = dot(duals, a).sub(cost);
  const latex = variableLatex(name);
  trace.steps.push({
    title: `Costo reducido de ${name}`,
    explanation:
      'Con los precios duales de la tabla óptima se evalúa si conviene producir la actividad: es la diferencia entre lo que "cuestan" sus recursos (y·a) y lo que aporta (c).',
    formula: `z_{${latex}} - c_{${latex}} = y\\,a - c`,
    substitution: `${row(duals)} \\cdot ${row(a)} - ${cost.toLatex()}`,
    result: `z_{${latex}} - c_{${latex}} = ${reduced.toLatex()}`,
  });
  const zValue = new MValue(reduced);
  if (optimalFor(t)(zValue)) {
    return success(
      t,
      replace === null ? t : { ...t, z: t.z.map((v, j) => (j === replace ? zValue : v)) },
      'sin-cambios',
      0,
      trace,
      `El costo reducido cumple la condición de optimalidad (${t.sense === 'max' ? '≥ 0' : '≤ 0'}): ${name} no conviene y la solución óptima no cambia.`,
    );
  }
  const entries = inverse.map((r) => dot(r, a));
  trace.steps.push({
    title: `Columna de ${name} en la tabla óptima`,
    explanation: `El costo reducido viola la condición de optimalidad, así que ${name} mejora z. Su columna en la tabla es B⁻¹a y se continúa con el simplex primal.`,
    formula: 'B^{-1} a',
    substitution: `${bmatrix(inverse)} ${column(a)} = ${column(entries)}`,
  });
  let modified: Tableau;
  if (replace === null) {
    const at = t.columns.filter((c) => c.kind === 'decision').length;
    modified = withColumn(t, at, { name, latex, kind: 'decision' }, entries, zValue);
  } else {
    modified = {
      ...t,
      rows: t.rows.map((r, i) => r.map((v, j) => (j === replace ? entries[i]! : v))),
      z: t.z.map((v, j) => (j === replace ? zValue : v)),
    };
  }
  return continuePrimal(t, modified, trace);
}

function addConstraint(o: Optimum, text: string, trace: Continuation): Result {
  const { lp, t } = o;
  const parsed = parseConstraintLine(text, lp.variables);
  if (typeof parsed === 'string' || parsed.relation === '=') {
    return failure('invalid-change', 'Revisa la nueva restricción.', trace);
  }
  const values = basicSolution(t);
  const x = lp.variables.map((_, j) => values[j]!);
  const lhs = dot(parsed.coefficients, x);
  const names = lp.variables.map(variableLatex);
  const satisfied = parsed.relation === '<=' ? lhs.cmp(parsed.rhs) <= 0 : lhs.cmp(parsed.rhs) >= 0;
  trace.steps.push({
    title: '¿La solución actual cumple la restricción?',
    explanation:
      'Agregar una restricción nunca mejora z. Si la solución óptima ya la cumple, es redundante.',
    formula: `${linearLatex(parsed.coefficients, names)} ${relationLatex[parsed.relation]} ${parsed.rhs.toLatex()}`,
    substitution: `${linearLatex(parsed.coefficients, names)} = ${lhs.toLatex()}`,
    result: `${lhs.toLatex()} ${satisfied ? relationLatex[parsed.relation] : parsed.relation === '<=' ? '>' : '<'} ${parsed.rhs.toLatex()} \\ \\Rightarrow\\ \\text{${satisfied ? 'la cumple' : 'no la cumple'}}`,
  });
  if (satisfied) {
    return success(
      t,
      t,
      'sin-cambios',
      0,
      trace,
      'La restricción es redundante: la solución óptima la cumple, así que no cambia.',
    );
  }
  // Como ≤ (una ≥ se multiplica por −1) con una holgura nueva que entra a la base.
  const sign = parsed.relation === '<=' ? Rational.ONE : Rational.of(-1);
  const m = lp.constraints.length;
  const slackName = `s${m + 1}`;
  const slack: Column = { name: slackName, latex: `s_{${m + 1}}`, kind: 'slack', constraint: m };
  const n = lp.variables.length;
  const newRow = t.columns.map((_, j) =>
    j < n ? parsed.coefficients[j]!.mul(sign) : Rational.ZERO,
  );
  let rowValues = [...newRow, Rational.ONE];
  let rhs = parsed.rhs.mul(sign);
  const operations: string[] = [];
  t.basis.forEach((b, i) => {
    const factor = rowValues[b]!;
    if (factor.isZero()) return;
    rowValues = rowValues.map((v, j) =>
      v.sub(factor.mul(j < t.columns.length ? t.rows[i]![j]! : Rational.ZERO)),
    );
    rhs = rhs.sub(factor.mul(t.rhs[i]!));
    operations.push(
      `\\text{Fila } ${slack.latex} \\leftarrow \\text{fila } ${slack.latex} ${factor.sign() < 0 ? '+' : '-'} ${factor.abs().eq(Rational.ONE) ? '' : `${factor.abs().toLatex()}\\,`}\\text{fila } ${t.columns[b]!.latex}`,
    );
  });
  const modified: Tableau = {
    ...t,
    columns: [...t.columns, slack],
    rows: [...t.rows.map((r) => [...r, Rational.ZERO]), rowValues],
    rhs: [...t.rhs, rhs],
    basis: [...t.basis, t.columns.length],
    z: [...t.z, MValue.ZERO],
  };
  trace.steps.push({
    title: 'Agregar la restricción a la tabla',
    explanation: `${parsed.relation === '>=' ? 'Se multiplica por −1 para escribirla como ≤ y ' : 'Se '}agrega con una holgura nueva ${slackName} como básica. Para que la tabla sea consistente, se eliminan de su fila las variables básicas restando múltiplos de sus filas (como al sustituirlas).`,
    substitution: operations.length > 0 ? latexLines(operations) : undefined,
    result: `${slack.latex} = ${rhs.toLatex()}`,
  });
  return continueDual(t, modified, trace);
}

function changeTechnology(
  o: Optimum,
  name: string,
  a: Rational[],
  cost: Rational | null,
  trace: Continuation,
): Result {
  const { lp, t } = o;
  const j = lp.variables.indexOf(name);
  const c = cost ?? lp.objective[j]!;
  if (!t.basis.includes(j)) {
    trace.steps.push({
      title: `${name} no es básica`,
      explanation: `Su columna no forma parte de B, así que B⁻¹ y los precios duales no cambian: se analiza como una actividad nueva con la columna ${a.map((v) => v.toText()).join(', ')} y costo ${c.toText()}.`,
    });
    return enterColumn(o, name, a, c, j, trace);
  }
  const modifiedLp: LinearProgram = {
    ...lp,
    objective: lp.objective.map((v, k) => (k === j ? c : v)),
    constraints: lp.constraints.map((ct, i) => ({
      ...ct,
      coefficients: ct.coefficients.map((v, k) => (k === j ? a[i]! : v)),
    })),
  };
  trace.steps.push({
    title: `${name} es básica: se resuelve de nuevo`,
    explanation: `La columna de ${name} forma parte de la base B, así que B⁻¹ cambia y la tabla óptima ya no describe el modelo. Como advierte Taha, en este caso el modelo modificado se resuelve de nuevo.`,
    result: `${linearLatex(modifiedLp.objective, lp.variables.map(variableLatex))} \\qquad (\\text{con la nueva columna de } ${variableLatex(name)})`,
  });
  const sf = toStandardForm(modifiedLp);
  const run = runSimplex(initialTableau(modifiedLp, sf, 'plain'));
  run.iterations.forEach((info, k) => {
    const before = run.tableaus[k]!;
    trace.tables.push(
      tableauTable(
        before,
        `cambio-${k}`,
        k === 0 ? 'Tabla inicial del modelo modificado' : `Tabla ${k}`,
        info,
      ),
    );
    trace.steps.push({
      ...iterationStep(before, info, k + 1),
      title: `Modelo modificado: iteración ${k + 1}`,
    });
  });
  if (run.status !== 'optimal') {
    return failure(
      run.status === 'unbounded' ? 'unbounded' : 'max-iterations',
      run.status === 'unbounded'
        ? 'El modelo modificado no está acotado.'
        : 'Se alcanzó el máximo de iteraciones.',
      trace,
    );
  }
  trace.tables.push(tableauTable(run.final, 'cambio-final', 'Tabla óptima del modelo modificado'));
  const before = decisionsOf(t);
  const after = decisionsOf(run.final);
  const same = before.decisions.every(({ v }, k) => v.eq(after.decisions[k]!.v));
  return success(
    t,
    run.final,
    same ? 'nuevos-valores' : 'nueva-base',
    run.iterations.length,
    trace,
    same
      ? 'El modelo modificado tiene la misma solución (puede cambiar z).'
      : 'El cambio modifica la solución óptima.',
  );
}

// ─── Punto de entrada ───────────────────────────────────────────────────────

export function solveModelChange(input: ModelChangeInput): Result {
  const base = runSimplexTabular(input);
  if (!base.result.ok || !base.lp || !base.final) {
    const result = base.result;
    if (result.ok) {
      return failure('max-iterations', 'No se obtuvo la tabla óptima.', {
        steps: [],
        tables: [],
        notices: [],
      });
    }
    return {
      ...result,
      error:
        result.error.code === 'needs-artificial'
          ? {
              code: 'needs-artificial',
              message:
                'El análisis post-óptimo usa la tabla óptima con holguras: el modelo original debe tener solo restricciones ≤ con lado derecho no negativo.',
            }
          : result.error,
    };
  }
  const { lp, final: t } = base;
  const o = optimumOf(lp, t);
  const trace: Continuation = {
    steps: [
      {
        title: 'Solución óptima del modelo original',
        explanation: `Se resuelve el modelo con el simplex. La tabla óptima es el punto de partida: z* = ${t.zRhs.a.toText()}.`,
        children: base.result.steps,
      },
      {
        title: 'Inversa de la base y precios duales',
        explanation:
          'En la tabla óptima, las columnas de las holguras forman B⁻¹ (en el orden de las variables básicas) y sus coeficientes en la fila z son los precios duales y = c_B B⁻¹.',
        result: latexLines([
          `\\text{Básicas: } ${t.basis.map((b) => t.columns[b]!.latex).join(',\\ ')}`,
          `B^{-1} = ${bmatrix(o.inverse)}, \\qquad y = ${row(o.duals)}`,
        ]),
      },
    ],
    tables: [tableauTable(t, 'original', 'Tabla óptima del modelo original')],
    notices: base.result.notices,
  };
  const m = lp.constraints.length;
  const invalid = (message: string) => failure('invalid-change', message, trace);

  switch (input.change) {
    case 'lado-derecho': {
      const rhs = parseNumbers(input.rhs, m, 'el lado derecho');
      return typeof rhs === 'string' ? invalid(rhs) : changeRhs(o, rhs, trace);
    }
    case 'objetivo': {
      const c = parseLinearCoefficients(input.newObjective ?? '', lp.variables);
      return typeof c === 'string' ? invalid(c) : changeObjective(o, c, trace);
    }
    case 'nueva-variable': {
      const a = parseNumbers(input.column, m, 'la columna');
      const cost = parseCost(input.cost);
      if (typeof a === 'string') return invalid(a);
      if (cost === null || typeof cost === 'string')
        return invalid('Falta el costo de la variable.');
      const numbers = lp.variables.map((v) => /^x(\d+)$/.exec(v)?.[1]).map(Number);
      const name = numbers.every(Number.isFinite) ? `x${Math.max(...numbers) + 1}` : 'xnueva';
      return enterColumn(o, name, a, cost, null, trace);
    }
    case 'coeficientes-tecnologicos': {
      const name = (input.variable ?? '').trim().replace(/_/g, '');
      const a = parseNumbers(input.column, m, 'la columna');
      const cost = parseCost(input.cost);
      if (!lp.variables.includes(name)) return invalid('La variable no está en el modelo.');
      if (typeof a === 'string') return invalid(a);
      if (typeof cost === 'string') return invalid(cost);
      return changeTechnology(o, name, a, cost, trace);
    }
    case 'nueva-restriccion':
      return addConstraint(o, input.constraint ?? '', trace);
  }
}

export const modelChange: Calculator<ModelChangeInput, ModelChangeValue, ModelChangeErrorCode> = {
  meta: {
    id: 'cambios-en-el-modelo',
    title: 'Cambios en coeficientes tecnológicos, variables y restricciones',
    summary:
      'Análisis post-óptimo: nuevo lado derecho, nueva función objetivo, cambios en una columna, nueva variable o nueva restricción.',
    citations: [
      {
        sourceId: 'taha',
        locator:
          'Sec. 4.5, análisis post-óptimo, Ejemplos 4.5-1 a 4.5-4: TOYCO (10.ª ed. en inglés)',
      },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'gould-eppen-schmidt' },
    ],
  },
  inputSchema: modelChangeInputSchema,
  // Taha, ejemplo 4.5-2 (situación 2): TOYCO agrega una cuarta operación de 500 minutos con
  // tiempos 3, 3 y 1.
  example: {
    sense: 'max',
    objective: '3x1 + 2x2 + 5x3',
    constraints: 'x1 + 2x2 + x3 <= 430\n3x1 + 2x3 <= 460\nx1 + 4x2 <= 420',
    change: 'nueva-restriccion',
    constraint: '3x1 + 3x2 + x3 <= 500',
    rhs: '450 460 400',
    newObjective: '6x1 + 3x2 + 4x3',
    variable: 'x1',
    column: '1 1 2',
    cost: '4',
  },
  solve: solveModelChange,
};
