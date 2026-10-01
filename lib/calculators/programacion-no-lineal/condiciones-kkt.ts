/**
 * Condiciones de Karush-Kuhn-Tucker en un punto candidato (Taha, sec. 20.2.2; Hillier &
 * Lieberman, sec. 13.6). Con cada restricción escrita como g_i(X) (≤, ≥, =) 0 (lado izquierdo −
 * lado derecho) y L = f − Σ λ_i g_i, un punto X que cumple las restricciones es un punto KKT si
 *
 *   ∇f(X) − Σ λ_i ∇g_i(X) = 0,     λ_i g_i(X) = 0 (holgura complementaria)
 *
 * y los multiplicadores tienen el signo de la tabla 20.2 de Taha:
 *
 *   maximizar: g ≤ 0 → λ ≥ 0;  g ≥ 0 → λ ≤ 0;  g = 0 → λ libre
 *   minimizar: g ≤ 0 → λ ≤ 0;  g ≥ 0 → λ ≥ 0;  g = 0 → λ libre
 *
 * Las restricciones inactivas (g_i ≠ 0) tienen λ_i = 0; los multiplicadores de las activas se
 * obtienen de la condición de estacionariedad (por mínimos cuadrados si hay más ecuaciones que
 * incógnitas). Las condiciones también son suficientes si f es cóncava (maximizar) o convexa
 * (minimizar) y la región factible es convexa (tabla 20.1).
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Step,
} from '../types';
import {
  classifyMatrix,
  clean,
  evaluateAt,
  evaluateMatrix,
  evaluateVector,
  gradientOf,
  hessianOf,
  parseConstraintList,
  parseNlpExpression,
  parsePoint,
  pointTex,
  relationTex,
  solveDense,
  type ConstraintRelation,
  type NlpConstraint,
} from './nlp';

export const kktInputSchema = z
  .object({
    sense: z.enum(['max', 'min'], { error: 'Elige si se maximiza o se minimiza.' }),
    objective: z
      .string()
      .trim()
      .min(1, 'Escribe la función objetivo f(x1, x2, …).')
      .max(300, 'La expresión es demasiado larga.'),
    constraints: z
      .string()
      .trim()
      .min(1, 'Escribe al menos una restricción.')
      .max(1500, 'Las restricciones son demasiado largas.'),
    point: z.string().trim().min(1, 'Escribe el punto candidato.'),
  })
  .superRefine((v, ctx) => {
    const f = parseNlpExpression(v.objective);
    if (!f.ok) {
      ctx.addIssue({ code: 'custom', path: ['objective'], message: f.message });
      return;
    }
    const constraints = parseConstraintList(v.constraints);
    if (typeof constraints === 'string') {
      ctx.addIssue({ code: 'custom', path: ['constraints'], message: constraints });
      return;
    }
    if (constraints.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['constraints'],
        message: 'Escribe al menos una restricción.',
      });
      return;
    }
    const size = Math.max(f.maxIndex, ...constraints.map((c) => c.maxIndex), 1);
    const point = parsePoint(v.point, size);
    if (typeof point === 'string') {
      ctx.addIssue({ code: 'custom', path: ['point'], message: `El punto: ${point}.` });
    }
  });

export type KktInput = z.infer<typeof kktInputSchema>;

export type MultiplierSign = 'mayor o igual que 0' | 'menor o igual que 0' | 'libre';

export interface KktConstraintResult {
  index: number;
  relation: ConstraintRelation;
  g: number;
  feasible: boolean;
  active: boolean;
  lambda: number;
  requiredSign: MultiplierSign;
  signOk: boolean;
}

export interface KktValue {
  feasible: boolean;
  stationary: boolean;
  signsOk: boolean;
  isKkt: boolean;
  residual: number;
  constraints: KktConstraintResult[];
  /** Si se pudo confirmar la suficiencia (funciones cuadráticas o lineales con la convexidad correcta). */
  sufficient: boolean;
}

export type KktErrorCode = 'invalid-expression';

type Result = CalculatorResult<KktValue, KktErrorCode>;

const n = toLatexNumber;
const TOL = 1e-7;

function requiredSign(sense: 'max' | 'min', relation: ConstraintRelation): MultiplierSign {
  if (relation === '=') return 'libre';
  const nonNegative = (sense === 'max') === (relation === '<=');
  return nonNegative ? 'mayor o igual que 0' : 'menor o igual que 0';
}

const SIGN_TEX: Record<MultiplierSign, string> = {
  'mayor o igual que 0': '\\ge 0',
  'menor o igual que 0': '\\le 0',
  libre: '\\text{ libre}',
};

/** Mínimos cuadrados: resuelve (AᵀA) x = Aᵀ b. */
function leastSquares(A: number[][], b: number[]): number[] | null {
  const k = A[0]?.length ?? 0;
  if (k === 0) return [];
  const AtA = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => A.reduce((acc, row) => acc + row[i]! * row[j]!, 0)),
  );
  const Atb = Array.from({ length: k }, (_, i) =>
    A.reduce((acc, row, r) => acc + row[i]! * b[r]!, 0),
  );
  return solveDense(AtA, Atb);
}

export function solveKkt({
  sense,
  objective,
  constraints: text,
  point: pointText,
}: KktInput): Result {
  const parsedF = parseNlpExpression(objective);
  const parsedG = parseConstraintList(text);
  if (!parsedF.ok || typeof parsedG === 'string') {
    return {
      ok: false,
      error: {
        code: 'invalid-expression',
        message: parsedF.ok ? String(parsedG) : parsedF.message,
      },
      ...emptyTrace(),
    };
  }
  const f = parsedF.expr;
  const constraints: NlpConstraint[] = parsedG;
  const size = Math.max(parsedF.maxIndex, ...constraints.map((c) => c.maxIndex), 1);
  const x = parsePoint(pointText, size) as number[];
  const gradF = gradientOf(f, size);
  const gradG = constraints.map((c) => gradientOf(c.g, size));
  if (!gradF || gradG.some((g) => !g)) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: 'No se pudieron derivar las funciones.' },
      ...emptyTrace(),
    };
  }

  const gValues = constraints.map((c) => clean(evaluateAt(c.g, x)));
  const scale = Math.max(1, ...x.map(Math.abs));
  const results: KktConstraintResult[] = constraints.map((c, i) => {
    const g = gValues[i]!;
    const active = Math.abs(g) <= TOL * scale;
    const feasible =
      c.relation === '=' ? active : c.relation === '<=' ? g <= TOL * scale : g >= -TOL * scale;
    return {
      index: i + 1,
      relation: c.relation,
      g,
      feasible,
      active,
      lambda: 0,
      requiredSign: requiredSign(sense, c.relation),
      signOk: true,
    };
  });
  const feasible = results.every((r) => r.feasible);

  const steps: Step[] = [
    {
      title: 'Restricciones en la forma g(X) ≷ 0',
      explanation:
        'Cada restricción se escribe como lado izquierdo − lado derecho, comparado con 0.',
      substitution: constraints
        .map((c, i) => `g_{${i + 1}}(X) = ${c.g.tex} ${relationTex[c.relation]} 0`)
        .join(' \\\\ '),
    },
    {
      title: 'Factibilidad del punto',
      explanation: `Se evalúa cada g_i en X = ${pointTex(x)}. Las restricciones con g_i = 0 son activas (se cumplen con igualdad).`,
      substitution: results
        .map(
          (r) =>
            `g_{${r.index}}(X) = ${n(r.g, 8)} \\ ${r.feasible ? '\\checkmark' : '\\times'}${r.active ? '\\ \\text{(activa)}' : ''}`,
        )
        .join(' \\\\ '),
      result: feasible ? '\\text{El punto es factible}' : '\\text{El punto no es factible}',
    },
  ];

  // Estacionariedad: ∇f − Σ_{activas} λ_i ∇g_i = 0.
  const df = evaluateVector(gradF, x);
  const dg = gradG.map((g) => evaluateVector(g!, x));
  const activeIdx = results.filter((r) => r.active).map((r) => r.index - 1);
  const A = df.map((_, j) => activeIdx.map((i) => dg[i]![j]!));
  const lambdas = activeIdx.length > 0 ? leastSquares(A, df) : [];
  let residual = Math.hypot(...df);
  if (lambdas) {
    activeIdx.forEach((i, k) => {
      results[i]!.lambda = clean(lambdas[k]!);
    });
    residual = Math.hypot(
      ...df.map((v, j) => v - activeIdx.reduce((acc, i, k) => acc + lambdas[k]! * dg[i]![j]!, 0)),
    );
  }
  const stationary = lambdas !== null && residual <= 1e-6 * Math.max(1, Math.hypot(...df));
  for (const r of results) {
    r.signOk =
      r.requiredSign === 'libre' ||
      (r.requiredSign === 'mayor o igual que 0' ? r.lambda >= -1e-9 : r.lambda <= 1e-9);
  }
  const signsOk = results.every((r) => r.signOk);

  steps.push(
    {
      title: 'Holgura complementaria',
      explanation:
        'λ_i g_i(X) = 0: las restricciones inactivas (g_i ≠ 0) tienen multiplicador 0; solo las activas pueden tener λ_i ≠ 0.',
      result:
        results
          .filter((r) => !r.active)
          .map((r) => `\\lambda_{${r.index}} = 0`)
          .join(',\\ ') || '\\text{Todas las restricciones son activas}',
    },
    {
      title: 'Estacionariedad',
      explanation:
        'Se resuelve ∇f(X) = Σ λ_i ∇g_i(X) con las restricciones activas; si hay más ecuaciones que multiplicadores, por mínimos cuadrados, y se revisa si el residuo es cero.',
      formula: '\\nabla f(X) - \\sum_i \\lambda_i \\nabla g_i(X) = 0',
      substitution: `\\nabla f(X) = ${pointTex(df)}${activeIdx
        .map((i) => `,\\quad \\nabla g_{${i + 1}}(X) = ${pointTex(dg[i]!)}`)
        .join('')}`,
      result: stationary
        ? activeIdx.length > 0
          ? activeIdx.map((i) => `\\lambda_{${i + 1}} = ${n(results[i]!.lambda, 8)}`).join(',\\ ')
          : '\\nabla f(X) = 0'
        : `\\text{No hay multiplicadores que anulen el gradiente (residuo } ${n(residual, 4)})`,
    },
    {
      title: 'Signo de los multiplicadores',
      explanation:
        sense === 'max'
          ? 'Al maximizar (L = f − Σλg): λ ≥ 0 en las restricciones ≤, λ ≤ 0 en las ≥ y libre en las de igualdad.'
          : 'Al minimizar (L = f − Σλg): λ ≤ 0 en las restricciones ≤, λ ≥ 0 en las ≥ y libre en las de igualdad.',
      substitution: results
        .map(
          (r) =>
            `\\lambda_{${r.index}} = ${n(r.lambda, 8)} \\ (${SIGN_TEX[r.requiredSign].replace('\\text{ libre}', '\\text{libre}')}) \\ ${r.signOk ? '\\checkmark' : '\\times'}`,
        )
        .join(' \\\\ '),
    },
  );

  const isKkt = feasible && stationary && signsOk;

  // Suficiencia: funciones cuadráticas o lineales (hessianas constantes) con la curvatura correcta.
  let sufficient = false;
  if (isKkt) {
    const hessF = hessianOf(f, size);
    const hessG = constraints.map((c) => hessianOf(c.g, size));
    const probe = x.map((v) => v + 0.731);
    const constant = (H: ReturnType<typeof hessianOf>) =>
      H !== null &&
      evaluateMatrix(H, x).every((row, i) =>
        row.every((v, j) => Math.abs(v - evaluateMatrix(H, probe)[i]![j]!) < 1e-9),
      );
    if (constant(hessF) && hessG.every(constant)) {
      const fClass = classifyMatrix(evaluateMatrix(hessF!, x));
      const fOk =
        sense === 'max'
          ? ['definida negativa', 'semidefinida negativa', 'nula'].includes(fClass)
          : ['definida positiva', 'semidefinida positiva', 'nula'].includes(fClass);
      const gOk = constraints.every((c, i) => {
        const cls = classifyMatrix(evaluateMatrix(hessG[i]!, x));
        if (cls === 'nula') return true;
        if (c.relation === '=') return false;
        const convex = cls === 'definida positiva' || cls === 'semidefinida positiva';
        const concave = cls === 'definida negativa' || cls === 'semidefinida negativa';
        return c.relation === '<=' ? convex : concave;
      });
      sufficient = fOk && gOk;
    }
    steps.push({
      title: 'Suficiencia',
      explanation: sufficient
        ? `La función objetivo es ${sense === 'max' ? 'cóncava' : 'convexa'} y la región factible es convexa (restricciones ≤ convexas, ≥ cóncavas, = lineales): las condiciones KKT también son suficientes y el punto es un óptimo global.`
        : 'No se pudo confirmar la convexidad de todo el problema (tabla 20.1 de Taha): el punto cumple las condiciones necesarias, pero podría ser un óptimo local o no serlo.',
    });
  }

  const rows = results.map((r): Record<string, CellValue> => ({
    index: r.index,
    relation: r.relation === '<=' ? '≤' : r.relation === '>=' ? '≥' : '=',
    g: r.g,
    active: r.active ? 'sí' : 'no',
    lambda: r.lambda,
    sign: r.requiredSign,
    ok: r.feasible && r.signOk ? 'sí' : 'no',
  }));

  return {
    ok: true,
    value: {
      feasible,
      stationary,
      signsOk,
      isKkt,
      residual,
      constraints: results,
      sufficient,
    },
    summary: [
      {
        label: 'Condiciones KKT',
        value: isKkt ? '\\text{se cumplen}' : '\\text{no se cumplen}',
        emphasis: true,
      },
      {
        label: 'Multiplicadores',
        value: results.map((r) => `\\lambda_{${r.index}} = ${n(r.lambda, 6)}`).join(',\\ '),
      },
      { label: 'Valor de la función', value: `f(X) = ${n(evaluateAt(f, x), 8)}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'restricciones',
        title: 'Restricciones en el punto',
        columns: [
          { key: 'index', header: 'i' },
          { key: 'relation', header: '\\text{Tipo}', format: 'text' },
          { key: 'g', header: 'g_i(X)' },
          { key: 'active', header: '\\text{Activa}', format: 'text' },
          { key: 'lambda', header: '\\lambda_i' },
          { key: 'sign', header: '\\text{Signo exigido}', format: 'text' },
          { key: 'ok', header: '\\text{Cumple}', format: 'text' },
        ],
        rows,
      },
    ],
    notices: isKkt
      ? []
      : [
          {
            level: 'warning',
            message: !feasible
              ? 'El punto no cumple todas las restricciones, así que no puede ser un punto KKT.'
              : !stationary
                ? 'No existen multiplicadores que anulen el gradiente de la función de Lagrange en este punto.'
                : 'Algún multiplicador tiene el signo equivocado: se puede mejorar la función objetivo moviéndose dentro de la región factible.',
          },
        ],
  };
}

export const kkt: Calculator<KktInput, KktValue, KktErrorCode> = {
  meta: {
    id: 'condiciones-kkt',
    title: 'Condiciones de Karush-Kuhn-Tucker',
    summary: 'Verifica las condiciones KKT y la suficiencia en un punto candidato.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 20.2.2, tablas 20.1 y 20.2, Ejemplo 20.2-5 (10.ª ed.)',
      },
      { sourceId: 'hillier-lieberman-2002', locator: 'Sec. 13.6 (7.ª ed.)' },
      { sourceId: 'bazaraa-1993' },
    ],
  },
  inputSchema: kktInputSchema,
  // Taha, ejemplo 20.2-5, con las restricciones escritas como en el libro (g(X) ≤ 0).
  example: {
    sense: 'min',
    objective: 'x1^2 + x2^2 + x3^2',
    constraints: '2x1 + x2 - 5 <= 0\nx1 + x3 - 2 <= 0\n1 - x1 <= 0\n2 - x2 <= 0\n-x3 <= 0',
    point: '1, 2, 0',
  },
  solve: solveKkt,
};
