/**
 * Problema dual (Taha, sec. 4.1–4.2; Hillier & Lieberman, cap. 6). Con variables primales no
 * negativas:
 *
 *   Primal máx:  restricción i ≤ → yᵢ ≥ 0,  ≥ → yᵢ ≤ 0,  = → yᵢ libre;  restricciones duales ≥ cⱼ
 *   Primal mín:  restricción i ≥ → yᵢ ≥ 0,  ≤ → yᵢ ≤ 0,  = → yᵢ libre;  restricciones duales ≤ cⱼ
 *
 * La función objetivo dual usa los lados derechos bᵢ y la matriz de coeficientes se transpone.
 * Por el teorema de dualidad fuerte, si uno tiene óptimo el otro también y z* = w*.
 */
import { Rational } from '@/lib/math/rational';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import {
  linearLatex,
  relationLatex,
  variableLatex,
  type LinearProgram,
  type Relation,
} from './lp-model';
import { parseForSolve, solveLpSilently, type LpInput, type SilentLp } from './lp-solve';
import { lpInputSchema } from './simplex';

export type DualSign = '>=0' | '<=0' | 'libre';

export interface DualModel {
  sense: 'max' | 'min';
  /** Coeficientes del objetivo dual (los bᵢ). */
  objective: Rational[];
  /** Una restricción por variable primal: Σ aᵢⱼ yᵢ (≥ o ≤) cⱼ. */
  constraints: { coefficients: Rational[]; relation: Relation; rhs: Rational }[];
  signs: DualSign[];
}

export interface DualValue {
  primal: { status: SilentLp['status']; z: number | null; x: Record<string, number> };
  dual: { status: SilentLp['status']; w: number | null; y: Record<string, number> };
  signs: DualSign[];
}

export type DualErrorCode = 'invalid-model';

export function buildDual(lp: LinearProgram): DualModel {
  const max = lp.sense === 'max';
  const signs: DualSign[] = lp.constraints.map((c) => {
    if (c.relation === '=') return 'libre';
    if (max) return c.relation === '<=' ? '>=0' : '<=0';
    return c.relation === '>=' ? '>=0' : '<=0';
  });
  return {
    sense: max ? 'min' : 'max',
    objective: lp.constraints.map((c) => c.rhs),
    constraints: lp.variables.map((_, j) => ({
      coefficients: lp.constraints.map((c) => c.coefficients[j]!),
      relation: max ? '>=' : '<=',
      rhs: lp.objective[j]!,
    })),
    signs,
  };
}

const dualName = (i: number) => `y_{${i + 1}}`;

function signLatex(sign: DualSign, i: number): string {
  if (sign === 'libre') return `${dualName(i)}\\ \\text{libre}`;
  return `${dualName(i)} ${sign === '>=0' ? '\\ge' : '\\le'} 0`;
}

export function dualLatex(dual: DualModel): string {
  const names = dual.objective.map((_, i) => dualName(i));
  const rows = dual.constraints.map(
    (c) => `${linearLatex(c.coefficients, names)} &${relationLatex[c.relation]} ${c.rhs.toLatex()}`,
  );
  return `\\begin{aligned} \\${dual.sense}\\ w &= ${linearLatex(dual.objective, names)} \\\\ \\text{s.a.}\\quad ${rows.join(' \\\\ ')} \\\\ &${dual.signs.map(signLatex).join(',\\ ')} \\end{aligned}`;
}

/**
 * Resuelve el dual con variables no negativas: y ≤ 0 se escribe y = −y′ y una libre como
 * y = y⁺ − y⁻.
 */
function solveDual(dual: DualModel): {
  status: SilentLp['status'];
  w: Rational | null;
  y: Rational[];
} {
  const columns: { index: number; factor: Rational }[] = [];
  dual.signs.forEach((sign, i) => {
    if (sign === '>=0') columns.push({ index: i, factor: Rational.ONE });
    else if (sign === '<=0') columns.push({ index: i, factor: Rational.of(-1) });
    else columns.push({ index: i, factor: Rational.ONE }, { index: i, factor: Rational.of(-1) });
  });
  const lp: LinearProgram = {
    sense: dual.sense,
    variables: columns.map((_, k) => `v${k + 1}`),
    objective: columns.map((c) => dual.objective[c.index]!.mul(c.factor)),
    constraints: dual.constraints.map((c) => ({
      coefficients: columns.map((col) => c.coefficients[col.index]!.mul(col.factor)),
      relation: c.relation,
      rhs: c.rhs,
    })),
  };
  const solved = solveLpSilently(lp);
  if (solved.status !== 'optimal') return { status: solved.status, w: null, y: [] };
  const y = dual.objective.map(() => Rational.ZERO);
  columns.forEach((col, k) => {
    y[col.index] = y[col.index]!.add(solved.x[k]!.mul(col.factor));
  });
  return { status: 'optimal', w: solved.z, y };
}

const statusText: Record<SilentLp['status'], string> = {
  optimal: 'tiene óptimo',
  infeasible: 'es infactible',
  unbounded: 'es no acotado',
  'max-iterations': 'no terminó (máximo de iteraciones)',
};

export function solveDualProblem(input: LpInput): CalculatorResult<DualValue, DualErrorCode> {
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
  const dual = buildDual(lp);
  const xNames = lp.variables.map(variableLatex);
  const max = lp.sense === 'max';

  trace.steps.push({
    title: 'Reglas de correspondencia',
    explanation: max
      ? 'El primal maximiza, así que el dual minimiza. Cada restricción primal da una variable dual yᵢ (≤ → yᵢ ≥ 0, ≥ → yᵢ ≤ 0, = → yᵢ libre) y cada variable primal xⱼ ≥ 0 da una restricción dual ≥ cⱼ. Los lados derechos pasan a la función objetivo y la matriz de coeficientes se transpone.'
      : 'El primal minimiza, así que el dual maximiza. Cada restricción primal da una variable dual yᵢ (≥ → yᵢ ≥ 0, ≤ → yᵢ ≤ 0, = → yᵢ libre) y cada variable primal xⱼ ≥ 0 da una restricción dual ≤ cⱼ. Los lados derechos pasan a la función objetivo y la matriz de coeficientes se transpone.',
    children: [
      ...lp.constraints.map((c, i): Step => ({
        title: `Restricción ${i + 1} (${c.relation === '<=' ? '≤' : c.relation === '>=' ? '≥' : '='})`,
        result: `\\Rightarrow\\ ${signLatex(dual.signs[i]!, i)},\\quad \\text{coeficiente en } w:\\ ${c.rhs.toLatex()}`,
      })),
      ...lp.variables.map((_, j): Step => ({
        title: `Variable ${lp.variables[j]} ≥ 0`,
        result: `\\Rightarrow\\ ${linearLatex(
          dual.constraints[j]!.coefficients,
          dual.objective.map((__, i) => dualName(i)),
        )} ${relationLatex[dual.constraints[j]!.relation]} ${lp.objective[j]!.toLatex()}`,
      })),
    ],
  });
  trace.steps.push({ title: 'Problema dual', result: dualLatex(dual) });

  const primal = solveLpSilently(lp);
  const solvedDual = solveDual(dual);
  const bothOptimal = primal.status === 'optimal' && solvedDual.status === 'optimal';
  if (bothOptimal) {
    trace.steps.push({
      title: 'Relación entre las soluciones',
      explanation:
        'Por el teorema de dualidad fuerte, si el primal tiene solución óptima el dual también, y los valores óptimos coinciden. Cada yᵢ es el precio dual (valor marginal) del recurso i.',
      result: `\\begin{array}{l} ${lp.variables.map((_, j) => `${xNames[j]} = ${primal.x[j]!.toLatex()}`).join(',\\ ')},\\quad z^* = ${primal.z.toLatex()} \\\\ ${solvedDual.y.map((y, i) => `${dualName(i)} = ${y.toLatex()}`).join(',\\ ')},\\quad w^* = ${solvedDual.w!.toLatex()} \\end{array}`,
    });
  } else {
    trace.steps.push({
      title: 'Relación entre las soluciones',
      explanation: `El primal ${statusText[primal.status]} y el dual ${statusText[solvedDual.status]}. Si uno es no acotado, el otro es infactible; si uno es infactible, el otro es infactible o no acotado.`,
    });
  }

  const correspondence = [
    ...lp.constraints.map((c, i) => ({
      primal: `\\text{Restricción } ${i + 1}\\ (${relationLatex[c.relation]})`,
      dual: signLatex(dual.signs[i]!, i),
    })),
    ...lp.variables.map((v, j) => ({
      primal: `${xNames[j]} \\ge 0`,
      dual: `\\text{Restricción dual } ${j + 1}\\ (${relationLatex[dual.constraints[j]!.relation]} ${lp.objective[j]!.toLatex()})`,
    })),
  ];

  return {
    ok: true,
    value: {
      primal: {
        status: primal.status,
        z: primal.status === 'optimal' ? primal.z.toNumber() : null,
        x:
          primal.status === 'optimal'
            ? Object.fromEntries(lp.variables.map((v, j) => [v, primal.x[j]!.toNumber()]))
            : {},
      },
      dual: {
        status: solvedDual.status,
        w: solvedDual.w?.toNumber() ?? null,
        y: Object.fromEntries(solvedDual.y.map((y, i) => [`y${i + 1}`, y.toNumber()])),
      },
      signs: dual.signs,
    },
    summary: [
      { label: 'Problema dual', value: dualLatex(dual), emphasis: true },
      ...(bothOptimal
        ? [
            {
              label: 'Valores óptimos',
              value: `z^* = ${primal.z.toLatex()} = w^*`,
            },
            {
              label: 'Solución dual (precios duales)',
              value: solvedDual.y.map((y, i) => `${dualName(i)} = ${y.toLatex()}`).join(',\\ '),
            },
          ]
        : []),
    ],
    ...emptyTrace(),
    ...trace,
    tables: [
      {
        id: 'correspondencia',
        title: 'Correspondencia primal–dual',
        columns: [
          { key: 'primal', header: '\\text{Primal}', format: 'latex' },
          { key: 'dual', header: '\\text{Dual}', format: 'latex' },
        ],
        rows: correspondence,
      },
    ],
  };
}

export const dualProblem: Calculator<LpInput, DualValue, DualErrorCode> = {
  meta: {
    id: 'problema-dual',
    title: 'Problema dual',
    summary: 'Construye el dual de un modelo y compara las soluciones de ambos.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 4.1–4.2, Ejemplo 4.2-1 (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'gould-eppen-schmidt' },
    ],
  },
  inputSchema: lpInputSchema,
  // Taha, ejemplo 4.2-1: una restricción ≤ y una igualdad (y₂ queda libre).
  example: {
    sense: 'max',
    objective: '5x1 + 12x2 + 4x3',
    constraints: 'x1 + 2x2 + x3 <= 10\n2x1 - x2 + 3x3 = 8',
  },
  solve: solveDualProblem,
};
