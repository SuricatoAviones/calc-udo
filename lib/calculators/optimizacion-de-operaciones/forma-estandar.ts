/**
 * Forma canónica y forma estándar de un modelo de programación lineal (Taha, sec. 3.1;
 * Arreola):
 *
 * - Canónica: al maximizar, todas las restricciones son ≤ (al minimizar, ≥) y las variables son
 *   no negativas. Una ≥ se multiplica por −1 y una igualdad se divide en dos desigualdades.
 * - Estándar: todas las restricciones son igualdades con lado derecho no negativo; las ≤ reciben
 *   una holgura sᵢ ≥ 0 y las ≥ un exceso eᵢ ≥ 0 que se resta.
 */
import { Rational } from '@/lib/math/rational';
import { emptyTrace, type Calculator, type CalculatorResult } from '../types';
import {
  linearLatex,
  relationLatex,
  variableLatex,
  type LinearProgram,
  type LpConstraint,
} from './lp-model';
import { parseForSolve, type LpInput } from './lp-solve';
import { lpInputSchema } from './simplex';
import { toStandardForm } from './tableau';

export interface StandardFormValue {
  canonical: string;
  standard: string;
  slacks: number;
  surpluses: number;
  /** Restricciones que no tienen una holgura como variable básica inicial. */
  needArtificial: number;
}

export type StandardFormErrorCode = 'invalid-model';

/** Restricciones de la forma canónica, con la operación que las produjo. */
function canonicalConstraints(lp: LinearProgram): { constraint: LpConstraint; note: string }[] {
  const target = lp.sense === 'max' ? '<=' : '>=';
  const negate = (c: LpConstraint): LpConstraint => ({
    coefficients: c.coefficients.map((a) => a.neg()),
    relation: c.relation === '<=' ? '>=' : c.relation === '>=' ? '<=' : '=',
    rhs: c.rhs.neg(),
  });
  return lp.constraints.flatMap((c, i) => {
    if (c.relation === target) return [{ constraint: c, note: `R${i + 1}: ya tiene la forma` }];
    if (c.relation === '=') {
      const le: LpConstraint = { ...c, relation: '<=' };
      const ge: LpConstraint = { ...c, relation: '>=' };
      const kept = target === '<=' ? le : ge;
      const flipped = negate(target === '<=' ? ge : le);
      return [
        { constraint: kept, note: `R${i + 1}: igualdad dividida en dos desigualdades` },
        { constraint: flipped, note: `R${i + 1}: la segunda, multiplicada por −1` },
      ];
    }
    return [{ constraint: negate(c), note: `R${i + 1}: multiplicada por −1` }];
  });
}

export function solveStandardForm(
  input: LpInput,
): CalculatorResult<StandardFormValue, StandardFormErrorCode> {
  const parsed = parseForSolve(input);
  if (!parsed.ok) {
    const failure = parsed.result;
    return {
      ok: false,
      error: { code: 'invalid-model', message: failure.ok ? '' : failure.error.message },
      ...emptyTrace(),
    };
  }
  const { lp, trace } = parsed;
  const names = lp.variables.map(variableLatex);

  const canonical = canonicalConstraints(lp);
  const canonicalLatex = `\\begin{aligned} \\${lp.sense}\\ z &= ${linearLatex(lp.objective, names)} \\\\ ${canonical
    .map(
      ({ constraint: c }) =>
        `${linearLatex(c.coefficients, names)} &${relationLatex[c.relation]} ${c.rhs.toLatex()}`,
    )
    .join(' \\\\ ')} \\\\ ${names.join(', ')} &\\ge 0 \\end{aligned}`;
  trace.steps.push({
    title: 'Forma canónica',
    explanation:
      lp.sense === 'max'
        ? 'Al maximizar, la forma canónica tiene todas las restricciones ≤: las ≥ se multiplican por −1 (el signo se invierte) y cada igualdad se escribe como una ≤ y una ≥, y esta última se multiplica por −1.'
        : 'Al minimizar, la forma canónica tiene todas las restricciones ≥: las ≤ se multiplican por −1 (el signo se invierte) y cada igualdad se escribe como una ≤ y una ≥, y la primera se multiplica por −1.',
    substitution: canonical.map((c) => c.note).join('; '),
    result: canonicalLatex,
  });

  const sf = toStandardForm(lp);
  const keep = sf.columns.flatMap((c, j) => (c.kind === 'artificial' ? [] : [j]));
  const columns = keep.map((j) => sf.columns[j]!);
  const columnNames = columns.map((c) => c.latex);
  const rows = sf.rows.map((row) => keep.map((j) => row[j]!));
  const objective = keep.map((j) => (j < lp.variables.length ? lp.objective[j]! : Rational.ZERO));
  const standardLatex = `\\begin{aligned} \\${lp.sense}\\ z &= ${linearLatex(objective, columnNames)} \\\\ ${rows
    .map((row, i) => `${linearLatex(row, columnNames)} &= ${sf.rhs[i]!.toLatex()}`)
    .join(' \\\\ ')} \\\\ ${columnNames.join(', ')} &\\ge 0 \\end{aligned}`;
  const slacks = columns.filter((c) => c.kind === 'slack').length;
  const surpluses = columns.filter((c) => c.kind === 'surplus').length;
  const needArtificial = sf.relations.filter((r) => r !== '<=').length;

  trace.steps.push({
    title: 'Forma estándar',
    explanation: [
      sf.flipped.length > 0
        ? `Las restricciones ${sf.flipped.map((i) => i + 1).join(', ')} tienen lado derecho negativo: se multiplican por −1.`
        : '',
      'Cada ≤ recibe una holgura sᵢ (lo que no se usa del recurso) y cada ≥ un exceso eᵢ (lo que se pasa del mínimo), que se resta. Las igualdades quedan igual.',
    ]
      .filter(Boolean)
      .join(' '),
    result: standardLatex,
  });
  trace.steps.push({
    title: 'Solución básica inicial',
    explanation:
      needArtificial === 0
        ? 'Todas las restricciones tienen holgura: con las variables de decisión en 0, las holguras forman la base inicial y se puede aplicar el simplex directamente.'
        : `${needArtificial} ${needArtificial === 1 ? 'restricción no tiene' : 'restricciones no tienen'} una holgura con coeficiente +1 que sirva de variable básica inicial (las ≥ y las =). Para ellas se agregan variables artificiales y se usa el método de la M grande o el de las dos fases.`,
    result:
      needArtificial === 0
        ? sf.basis.map((b, i) => `${sf.columns[b]!.latex} = ${sf.rhs[i]!.toLatex()}`).join(',\\ ')
        : undefined,
  });

  return {
    ok: true,
    value: {
      canonical: canonicalLatex,
      standard: standardLatex,
      slacks,
      surpluses,
      needArtificial,
    },
    summary: [
      { label: 'Forma estándar', value: standardLatex, emphasis: true },
      {
        label: 'Holguras y excesos',
        value: `${slacks}\\ \\text{holguras},\\ ${surpluses}\\ \\text{excesos}`,
      },
      {
        label: 'Base inicial',
        value:
          needArtificial === 0
            ? '\\text{las holguras (simplex directo)}'
            : `\\text{hacen falta ${needArtificial} artificiales}`,
      },
    ],
    ...emptyTrace(),
    ...trace,
  };
}

export const standardForm: Calculator<LpInput, StandardFormValue, StandardFormErrorCode> = {
  meta: {
    id: 'forma-estandar',
    title: 'Forma canónica y forma estándar',
    summary: 'Reescribe un modelo con restricciones ≤ (o ≥) y con igualdades y holguras.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 3.1, forma de ecuaciones (estándar) de la PL' },
      { sourceId: 'arreola-2003' },
      { sourceId: 'hillier-lieberman-2002' },
    ],
  },
  inputSchema: lpInputSchema,
  // Taha, ejemplo 3.4-1: una igualdad, una ≥ y una ≤.
  example: {
    sense: 'min',
    objective: '4x1 + x2',
    constraints: '3x1 + x2 = 3\n4x1 + 3x2 >= 6\nx1 + 2x2 <= 4',
  },
  solve: solveStandardForm,
};
