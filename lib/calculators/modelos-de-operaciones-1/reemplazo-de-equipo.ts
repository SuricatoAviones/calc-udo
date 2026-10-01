/**
 * Modelo de reemplazo de equipo (Taha, sec. 12.3.3): en un horizonte de n años, al inicio de cada
 * año se decide conservar (K) la máquina o reemplazarla (R) por una nueva de costo I. Una máquina
 * de t años produce un ingreso r(t), cuesta c(t) operarla y se vende en s(t). Etapa i = año i;
 * estado = edad t de la máquina al inicio del año.
 *
 *   f_n(t) = máx { K: r(t) − c(t) + s(t + 1);   R: r(0) + s(t) + s(1) − c(0) − I }
 *   f_i(t) = máx { K: r(t) − c(t) + f_{i+1}(t + 1);   R: r(0) + s(t) − c(0) − I + f_{i+1}(1) }
 *
 * Al final del horizonte la máquina se vende (por eso s(t + 1) y s(1) en la última etapa). Una
 * máquina con la edad máxima debe reemplazarse. Solo se evalúan las edades alcanzables desde la
 * edad inicial.
 */
import { z } from 'zod';
import { latexLines, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type ResultTable,
  type Step,
} from '../types';
import { argOptimum, optimumLatex, stageTable, type StageRow } from './dynamic-programming';

const MAX_YEARS = 15;
const MAX_AGE = 20;

const money = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`);

export const replacementInputSchema = z
  .object({
    years: z
      .number({ error: 'Ingresa el horizonte n.' })
      .int('El horizonte debe ser un número entero de años.')
      .min(1, 'El horizonte debe ser de al menos 1 año.')
      .max(MAX_YEARS, `El horizonte máximo es ${MAX_YEARS} años.`),
    initialAge: z
      .number({ error: 'Ingresa la edad actual de la máquina.' })
      .int('La edad debe ser un número entero.')
      .min(0, 'La edad no puede ser negativa.')
      .max(MAX_AGE, `La edad máxima permitida es ${MAX_AGE}.`),
    newCost: money('el costo de una máquina nueva I'),
    data: z
      .array(
        z.object({
          revenue: money('el ingreso r(t)'),
          cost: money('el costo de operación c(t)'),
          salvage: money('el valor de rescate s(t)').optional(),
        }),
      )
      .min(2, 'Agrega al menos las edades 0 y 1.')
      .max(MAX_AGE + 1, `El máximo es la edad ${MAX_AGE}.`),
  })
  .superRefine((v, ctx) => {
    const maxAge = v.data.length - 1;
    if (v.initialAge > maxAge) {
      ctx.addIssue({
        code: 'custom',
        path: ['initialAge'],
        message: `La tabla llega hasta la edad ${maxAge}: agrega filas o revisa la edad actual.`,
      });
    }
    v.data.forEach((row, t) => {
      if (t >= 1 && row.salvage === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['data', t, 'salvage'],
          message: 'Indica el valor de rescate (a partir de la edad 1).',
        });
      }
    });
  });

export type ReplacementInput = z.infer<typeof replacementInputSchema>;

export interface ReplacementValue {
  total: number;
  /** Políticas óptimas: decisión (K o R) de cada año. */
  policies: ('K' | 'R')[][];
  /** f_i(t) por etapa. */
  stages: Record<number, number>[];
}

export type ReplacementErrorCode = never;

type Result = CalculatorResult<ReplacementValue, ReplacementErrorCode>;

const n = toLatexNumber;
const MAX_POLICIES = 10;

export function solveReplacement(input: ReplacementInput): Result {
  const { years, initialAge, newCost: I, data } = input;
  const maxAge = data.length - 1;
  const r = (t: number) => data[t]!.revenue;
  const c = (t: number) => data[t]!.cost;
  const s = (t: number) => data[t]?.salvage;

  // Edades alcanzables al inicio de cada año.
  const ages: number[][] = [[initialAge]];
  for (let i = 1; i < years; i++) {
    const next = new Set<number>([1]);
    for (const t of ages[i - 1]!) if (t < maxAge) next.add(t + 1);
    ages.push([...next].sort((a, b) => a - b));
  }

  const steps: Step[] = [
    {
      title: 'Edades posibles al inicio de cada año',
      explanation: `Si se conserva, la máquina cumple un año más; si se reemplaza, la nueva tendrá 1 año al inicio del año siguiente. Una máquina de ${maxAge} años debe reemplazarse.`,
      substitution: ages
        .map((list, i) => `\\text{Año } ${i + 1}: t \\in \\{${list.join(', ')}\\}`)
        .join(' \\\\ '),
    },
  ];

  const f: Map<number, { value: number; decisions: ('K' | 'R')[] }>[] = Array.from(
    { length: years + 1 },
    () => new Map(),
  );
  const tables: ResultTable[] = [];
  const stageSteps: Step[] = [];
  for (let i = years; i >= 1; i--) {
    const last = i === years;
    const rows: StageRow[] = [];
    const lines: string[] = [];
    for (const t of ages[i - 1]!) {
      const values = new Map<string, number>();
      const parts: string[] = [];
      const canKeep = t < maxAge && (!last || s(t + 1) !== undefined);
      if (canKeep) {
        const keep = last ? r(t) - c(t) + s(t + 1)! : r(t) - c(t) + f[i + 1]!.get(t + 1)!.value;
        values.set('K', keep);
        parts.push(
          last
            ? `K: ${n(r(t))} - ${n(c(t))} + ${n(s(t + 1)!)} = ${n(keep)}`
            : `K: ${n(r(t))} - ${n(c(t))} + ${n(f[i + 1]!.get(t + 1)!.value)} = ${n(keep)}`,
        );
      }
      const salvageNow = t === 0 ? 0 : s(t)!;
      const replace = last
        ? r(0) + salvageNow + s(1)! - c(0) - I
        : r(0) + salvageNow - c(0) - I + f[i + 1]!.get(1)!.value;
      values.set('R', replace);
      parts.push(
        last
          ? `R: ${n(r(0))} + ${n(salvageNow)} + ${n(s(1)!)} - ${n(c(0))} - ${n(I)} = ${n(replace)}`
          : `R: ${n(r(0))} + ${n(salvageNow)} - ${n(c(0))} - ${n(I)} + ${n(f[i + 1]!.get(1)!.value)} = ${n(replace)}`,
      );
      const keys = [...values.keys()];
      const list = keys.map((k) => values.get(k)!);
      const best = Math.max(...list);
      const arg = argOptimum('max', list).map((k) => keys[k] as 'K' | 'R');
      f[i]!.set(t, { value: best, decisions: arg });
      rows.push({ state: String(t), values, best, argBest: arg });
      lines.push(
        `t = ${t}:\\ ${parts.join(',\\ ')} \\ \\Rightarrow\\ f_{${i}}(${t}) = ${optimumLatex('max', list)} = ${n(best)}${canKeep ? '' : t >= maxAge ? '\\ \\text{(debe reemplazarse)}' : ''}`,
      );
    }
    stageSteps.push({
      title: `Etapa ${i} (año ${i})`,
      formula: last
        ? 'f_n(t) = \\max\\{r(t) - c(t) + s(t+1),\\ r(0) + s(t) + s(1) - c(0) - I\\}'
        : `f_{${i}}(t) = \\max\\{r(t) - c(t) + f_{${i + 1}}(t+1),\\ r(0) + s(t) - c(0) - I + f_{${i + 1}}(1)\\}`,
      substitution: latexLines(lines),
    });
    tables.push(
      stageTable({
        id: `etapa-${i}`,
        title: `Etapa ${i} (año ${i})`,
        stateHeader: 't',
        decisions: [
          { key: 'K', header: '\\text{K (conservar)}' },
          { key: 'R', header: '\\text{R (reemplazar)}' },
        ],
        rows,
        bestHeader: `f_{${i}}(t)`,
        argHeader: '\\text{Decisión}',
      }),
    );
  }
  steps.push({
    title: 'Recursión en reversa',
    explanation:
      'Se empieza por el último año, en que la máquina se vende al final, y se retrocede hasta el año 1. En cada estado se elige la alternativa de mayor ingreso neto acumulado.',
    children: stageSteps,
  });

  // Políticas óptimas (todas las combinaciones de empates).
  const policies: ('K' | 'R')[][] = [];
  const walk = (i: number, t: number, policy: ('K' | 'R')[]) => {
    if (policies.length >= MAX_POLICIES) return;
    if (i > years) {
      policies.push(policy);
      return;
    }
    for (const d of f[i]!.get(t)!.decisions) walk(i + 1, d === 'K' ? t + 1 : 1, [...policy, d]);
  };
  walk(1, initialAge, []);
  const total = f[1]!.get(initialAge)!.value;
  steps.push({
    title: 'Política óptima',
    explanation:
      policies.length > 1
        ? 'Hay empates entre conservar y reemplazar, así que existen varias políticas con el mismo ingreso neto.'
        : 'Se recorren las decisiones óptimas desde el año 1.',
    result: `${policies.map((p) => `(${p.join(', ')})`).join(' \\ \\text{o} \\ ')}, \\qquad f_1(${initialAge}) = ${n(total)}`,
  });

  return {
    ok: true,
    value: {
      total,
      policies,
      stages: f.slice(1).map((m) => Object.fromEntries([...m].map(([t, v]) => [t, v.value]))),
    },
    summary: [
      { label: 'Ingreso neto máximo', value: `f_1(${initialAge}) = ${n(total)}`, emphasis: true },
      {
        label: policies.length > 1 ? 'Políticas óptimas' : 'Política óptima',
        value: policies.map((p) => `(${p.join(', ')})`).join(' \\ \\text{o} \\ '),
      },
    ],
    ...emptyTrace(),
    steps,
    tables: tables.reverse(),
    notices: [
      {
        level: 'info',
        message: 'K = conservar la máquina un año más; R = reemplazarla al inicio del año.',
      },
    ],
  };
}

export const replacement: Calculator<ReplacementInput, ReplacementValue, ReplacementErrorCode> = {
  meta: {
    id: 'reemplazo-de-equipo',
    title: 'Modelo de reemplazo de equipo',
    summary: 'Cuándo conservar o reemplazar una máquina a lo largo de un horizonte.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 12.3.3, Ejemplo 12.3-3 (10.ª ed.)' },
      {
        sourceId: 'winston-1994',
        locator: 'Sec. 18.5, problemas de reemplazo de equipo (4.ª ed.)',
      },
      { sourceId: 'hillier-lieberman-2002' },
    ],
  },
  inputSchema: replacementInputSchema,
  // Taha, ejemplo 12.3-3 (en miles de dólares): máquina de 3 años, horizonte de 4 años, una
  // máquina de 6 años debe reemplazarse y una nueva cuesta 100.
  example: {
    years: 4,
    initialAge: 3,
    newCost: 100,
    data: [
      { revenue: 20, cost: 0.2 },
      { revenue: 19, cost: 0.6, salvage: 80 },
      { revenue: 18.5, cost: 1.2, salvage: 60 },
      { revenue: 17.2, cost: 1.5, salvage: 50 },
      { revenue: 15.5, cost: 1.7, salvage: 30 },
      { revenue: 14, cost: 1.8, salvage: 10 },
      { revenue: 12.2, cost: 2.2, salvage: 5 },
    ],
  },
  solve: solveReplacement,
};
