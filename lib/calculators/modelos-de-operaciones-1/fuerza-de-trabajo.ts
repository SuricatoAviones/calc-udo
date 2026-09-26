/**
 * Modelo del tamaño de la fuerza de trabajo (Taha, sec. 10.3.2): en el periodo i se necesitan al
 * menos b_i trabajadores y se decide cuántos mantener, x_i ≥ b_i. Mantener trabajadores de más
 * cuesta C₁ y contratar cuesta C₂; despedir no cuesta.
 *
 *   f_i(x_{i−1}) = mín_{x_i ≥ b_i} { C₁(x_i − b_i) + C₂(x_i − x_{i−1}) + f_{i+1}(x_i) },  f_{n+1} = 0
 *   C₁(x_i − b_i) = c_e (x_i − b_i),   C₂(x_i − x_{i−1}) = K + c_c (x_i − x_{i−1}) si x_i > x_{i−1}
 *
 * Etapa i = periodo i; alternativa = x_i; estado = x_{i−1}. Como no conviene mantener más
 * trabajadores que el mayor requerimiento que falta, x_i ∈ [b_i, máx{b_i, …, b_n}].
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { latexLines, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type ResultTable,
  type Step,
} from '../types';
import { argOptimum, optimumLatex, stageTable, type StageRow } from './dynamic-programming';

const MAX_PERIODS = 12;
const MAX_WORKERS = 60;

function parseRequirements(text: string): number[] | string {
  const { values, invalid } = parseDataList(text);
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  if (values.length < 1) return 'Ingresa el requerimiento de al menos un periodo.';
  if (values.length > MAX_PERIODS) return `El máximo es ${MAX_PERIODS} periodos.`;
  if (values.some((v) => !Number.isInteger(v) || v < 0)) {
    return 'Los requerimientos deben ser números enteros de trabajadores (0 o más).';
  }
  if (values.some((v) => v > MAX_WORKERS)) return `El máximo es ${MAX_WORKERS} trabajadores.`;
  return values;
}

const cost = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`)
    .refine((v) => v >= 0, `${label} no puede ser negativo.`);

export const workforceInputSchema = z.object({
  requirements: z.string().superRefine((text, ctx) => {
    const parsed = parseRequirements(text);
    if (typeof parsed === 'string') ctx.addIssue({ code: 'custom', message: parsed });
  }),
  excessCost: cost('el costo por trabajador de más'),
  hiringFixedCost: cost('el costo fijo de contratar'),
  hiringVariableCost: cost('el costo por trabajador contratado'),
  initialWorkforce: z
    .number({ error: 'Ingresa la fuerza de trabajo inicial.' })
    .int('La fuerza de trabajo inicial debe ser un número entero.')
    .min(0, 'La fuerza de trabajo inicial no puede ser negativa.')
    .max(MAX_WORKERS, `El máximo es ${MAX_WORKERS} trabajadores.`),
});

export type WorkforceInput = z.infer<typeof workforceInputSchema>;

export interface WorkforcePeriod {
  period: number;
  required: number;
  workers: number;
  /** Positivo = contrataciones; negativo = despidos. */
  change: number;
  excessCost: number;
  hiringCost: number;
}

export interface WorkforceValue {
  totalCost: number;
  plan: WorkforcePeriod[];
  /** f_i(estado) de cada etapa: `stages[i - 1][x_{i−1}]`. */
  stages: Record<number, number>[];
}

export type WorkforceErrorCode = 'invalid-data';

const n = toLatexNumber;

export function solveWorkforce(
  input: WorkforceInput,
): CalculatorResult<WorkforceValue, WorkforceErrorCode> {
  const parsed = parseRequirements(input.requirements);
  if (typeof parsed === 'string') {
    return { ok: false, error: { code: 'invalid-data', message: parsed }, ...emptyTrace() };
  }
  const b = parsed;
  const periods = b.length;
  const {
    excessCost: ce,
    hiringFixedCost: K,
    hiringVariableCost: cc,
    initialWorkforce: x0,
  } = input;

  // M_i = máx{b_i, …, b_n}: tope útil de x_i.
  const suffixMax = b.map((_, i) => Math.max(...b.slice(i)));
  const alternatives = (i: number) =>
    Array.from({ length: suffixMax[i]! - b[i]! + 1 }, (_, k) => b[i]! + k);
  const statesOf = (i: number) => (i === 0 ? [x0] : alternatives(i - 1));

  const excess = (i: number, x: number) => ce * (x - b[i]!);
  const hiring = (x: number, s: number) => (x > s ? K + cc * (x - s) : 0);

  const steps: Step[] = [
    {
      title: 'Elementos del modelo',
      explanation: `Etapa i = periodo i (${periods} etapas). La alternativa es x_i, los trabajadores que se mantienen en el periodo i (al menos b_i); el estado es x_{i−1}, los que había en el periodo anterior (x₀ = ${x0}). Mantener más de los necesarios cuesta C₁ y contratar cuesta C₂; despedir no cuesta. Se resuelve con recursión en reversa, desde el último periodo.`,
      formula:
        'f_i(x_{i-1}) = \\min_{x_i \\ge b_i} \\left\\{ C_1(x_i - b_i) + C_2(x_i - x_{i-1}) + f_{i+1}(x_i) \\right\\}, \\quad f_{n+1} = 0',
      substitution: `C_1(x_i - b_i) = ${n(ce)}\\,(x_i - b_i), \\qquad C_2(x_i - x_{i-1}) = ${n(K)} + ${n(cc)}\\,(x_i - x_{i-1}) \\ \\text{si } x_i > x_{i-1}`,
      result: `b = \\left(${b.join(',\\ ')}\\right), \\qquad x_i \\in [\\,b_i,\\ \\max\\{b_i, \\ldots, b_n\\}\\,]`,
    },
  ];

  const f: Map<number, number>[] = Array.from({ length: periods + 1 }, () => new Map());
  const choice: Map<number, number>[] = Array.from({ length: periods }, () => new Map());
  const tables: ResultTable[] = [];

  for (let i = periods - 1; i >= 0; i--) {
    const stage = i + 1;
    const xs = alternatives(i);
    const rows: StageRow[] = [];
    const children: Step[] = [];
    for (const s of statesOf(i)) {
      const values = xs.map((x) => excess(i, x) + hiring(x, s) + (f[i + 1]!.get(x) ?? 0));
      const best = argOptimum('min', values);
      const bestValue = values[best[0]!]!;
      f[i]!.set(s, bestValue);
      choice[i]!.set(s, xs[best[0]!]!);
      rows.push({
        state: String(s),
        values: new Map(xs.map((x, k) => [String(x), values[k]!])),
        best: bestValue,
        argBest: best.map((k) => String(xs[k]!)),
      });
      children.push({
        title: `Estado x${subscript(i)} = ${s}`,
        substitution: latexLines(
          xs.map((x, k) => {
            const hire = x > s ? `${n(K)} + ${n(cc)}(${x - s})` : '0';
            const next = i === periods - 1 ? '0' : n(f[i + 1]!.get(x)!);
            return `x_{${stage}} = ${x}:\\ ${n(ce)}(${x - b[i]!}) + ${hire} + ${next} = ${n(values[k]!)}`;
          }),
        ),
        result: `f_{${stage}}(${s}) = ${optimumLatex('min', values)} = ${n(bestValue)}, \\qquad x_{${stage}}^* = ${best.map((k) => xs[k]!).join('\\ \\text{o}\\ ')}`,
      });
    }
    steps.push({
      title: `Etapa ${stage} (b${subscript(stage)} = ${b[i]})`,
      explanation:
        i === periods - 1
          ? `En el último periodo no hay costos futuros (f${subscript(periods + 1)} = 0).`
          : `A cada alternativa se le suma el costo mínimo de los periodos siguientes, f${subscript(stage + 1)}(x${subscript(stage)}), calculado en la etapa anterior.`,
      children,
    });
    tables.push(
      stageTable({
        id: `etapa-${stage}`,
        title: `Etapa ${stage} (b${subscript(stage)} = ${b[i]}): costo según los trabajadores del periodo anterior`,
        stateHeader: `x_{${stage - 1}}`,
        decisions: xs.map((x) => ({ key: String(x), header: `x_{${stage}} = ${x}` })),
        rows,
        bestHeader: `f_{${stage}}(x_{${stage - 1}})`,
        argHeader: `x_{${stage}}^*`,
      }),
    );
  }

  // ── Plan óptimo: se sigue la decisión óptima desde x₀ ─────────────────────
  const plan: WorkforcePeriod[] = [];
  let previous = x0;
  for (let i = 0; i < periods; i++) {
    const x = choice[i]!.get(previous)!;
    plan.push({
      period: i + 1,
      required: b[i]!,
      workers: x,
      change: x - previous,
      excessCost: excess(i, x),
      hiringCost: hiring(x, previous),
    });
    previous = x;
  }
  const totalCost = f[0]!.get(x0)!;
  const decision = (p: WorkforcePeriod) =>
    p.change > 0 ? `Contratar ${p.change}` : p.change < 0 ? `Despedir ${-p.change}` : 'Sin cambios';

  steps.push({
    title: 'Plan óptimo',
    explanation:
      'Se parte de x₀ en la etapa 1 y se sigue, periodo a periodo, la decisión óptima del estado al que se llega.',
    result: `x^* = \\left(${plan.map((p) => p.workers).join(',\\ ')}\\right), \\qquad f_1(${x0}) = ${n(totalCost)}`,
  });

  return {
    ok: true,
    value: {
      totalCost,
      plan,
      stages: f.slice(0, periods).map((m) => Object.fromEntries(m)),
    },
    summary: [
      { label: 'Costo total mínimo', value: n(totalCost), emphasis: true },
      {
        label: 'Trabajadores por periodo',
        value: `x^* = \\left(${plan.map((p) => p.workers).join(',\\ ')}\\right)`,
      },
      {
        label: 'Requerimientos',
        value: `b = \\left(${b.join(',\\ ')}\\right)`,
      },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'plan',
        title: 'Plan óptimo de la fuerza de trabajo',
        columns: [
          { key: 'period', header: '\\text{Periodo}' },
          { key: 'required', header: 'b_i' },
          { key: 'workers', header: 'x_i' },
          { key: 'decision', header: '\\text{Decisión}', format: 'text' },
          { key: 'excessCost', header: 'C_1' },
          { key: 'hiringCost', header: 'C_2' },
          { key: 'cost', header: '\\text{Costo}' },
        ],
        rows: plan.map((p) => ({
          period: p.period,
          required: p.required,
          workers: p.workers,
          decision: decision(p),
          excessCost: p.excessCost,
          hiringCost: p.hiringCost,
          cost: p.excessCost + p.hiringCost,
        })),
      },
      ...tables,
    ],
    series: [
      {
        id: 'plan',
        title: 'Trabajadores mantenidos frente a los requeridos',
        xLabel: 'Periodo',
        yLabel: 'Trabajadores',
        label: 'Trabajadores (x)',
        points: plan.map((p) => ({ x: p.period, y: p.workers })),
        reference: {
          label: 'Requeridos (b)',
          points: plan.map((p) => ({ x: p.period, y: p.required })),
        },
      },
    ],
  };
}

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
function subscript(k: number): string {
  return String(k)
    .split('')
    .map((d) => SUBSCRIPTS[Number(d)])
    .join('');
}

export const workforce: Calculator<WorkforceInput, WorkforceValue, WorkforceErrorCode> = {
  meta: {
    id: 'fuerza-de-trabajo',
    title: 'Modelo del tamaño de la fuerza de trabajo',
    summary: 'Cuántos trabajadores mantener en cada periodo al menor costo.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 10.3.2, Ejemplo 10.3-2 (8.ª ed. en inglés)' },
      { sourceId: 'winston-1994' },
    ],
  },
  inputSchema: workforceInputSchema,
  // Taha, ejemplo 10.3-2: un contratista necesita 5, 7, 8, 4 y 6 trabajadores en las próximas
  // 5 semanas; cada trabajador de más cuesta $300 por semana y contratar cuesta $400 más $200 por
  // trabajador.
  example: {
    requirements: '5 7 8 4 6',
    excessCost: 300,
    hiringFixedCost: 400,
    hiringVariableCost: 200,
    initialWorkforce: 0,
  },
  solve: solveWorkforce,
};
