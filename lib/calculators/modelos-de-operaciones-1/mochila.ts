/**
 * Modelo de la mochila, del equipo de vuelo o de carga (Taha, sec. 10.3.1): se reparte una
 * capacidad W entre n artículos; cada unidad del artículo i pesa w_i y rinde r_i.
 *
 *   f_i(x_i) = máx_{m_i} { r_i m_i + f_{i+1}(x_i − w_i m_i) },   m_i = 0, 1, …, ⌊x_i / w_i⌋,
 *   f_{n+1} = 0
 *
 * Etapa i = artículo i; alternativa = m_i, unidades del artículo i; estado = x_i, capacidad
 * disponible para los artículos i, i + 1, …, n. Se calcula f_i para toda capacidad 0 … W, lo que
 * además permite leer la solución para capacidades menores.
 */
import { z } from 'zod';
import { toLatexNumber, toLatexText } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type ResultTable,
  type Step,
} from '../types';
import { argOptimum, optimumLatex, stageTable, type StageRow } from './dynamic-programming';
import { latexLines } from './network';

const MAX_CAPACITY = 40;
const MAX_ITEMS = 8;

const positiveInteger = (label: string, max: number) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .int(`${label} debe ser un número entero.`)
    .min(1, `${label} debe ser al menos 1.`)
    .max(max, `${label} no puede pasar de ${max}.`);

export const knapsackInputSchema = z.object({
  capacity: positiveInteger('la capacidad W', MAX_CAPACITY),
  items: z
    .array(
      z.object({
        name: z
          .string({ error: 'Escribe el nombre del artículo.' })
          .trim()
          .min(1, 'Escribe el nombre del artículo.')
          .max(24, 'Usa un nombre de hasta 24 caracteres.'),
        weight: positiveInteger('el peso', MAX_CAPACITY),
        value: z
          .number({ error: 'Ingresa el beneficio.' })
          .refine(Number.isFinite, 'El beneficio debe ser un número finito.'),
        maxUnits: z
          .number({ error: 'Escribe un número entero o deja la celda vacía.' })
          .int('El máximo de unidades debe ser un número entero.')
          .min(0, 'El máximo de unidades no puede ser negativo.')
          .optional(),
      }),
    )
    .min(1, 'Agrega al menos un artículo.')
    .max(MAX_ITEMS, `El máximo es ${MAX_ITEMS} artículos.`),
});

export type KnapsackInput = z.infer<typeof knapsackInputSchema>;

export interface KnapsackValue {
  totalValue: number;
  /** Unidades óptimas de cada artículo. */
  units: number[];
  usedCapacity: number;
  /** f_i(x) para x = 0 … W, por etapa (índice 0 = artículo 1). */
  stages: number[][];
  /** m_i*(x) para x = 0 … W, por etapa. */
  decisions: number[][];
}

export type KnapsackErrorCode = never;

const n = toLatexNumber;
const t = toLatexText;

export function solveKnapsack({
  capacity: W,
  items,
}: KnapsackInput): CalculatorResult<KnapsackValue, KnapsackErrorCode> {
  const count = items.length;
  const capacities = Array.from({ length: W + 1 }, (_, x) => x);
  const maxUnits = (i: number, x: number) =>
    Math.min(Math.floor(x / items[i]!.weight), items[i]!.maxUnits ?? Infinity);

  const steps: Step[] = [
    {
      title: 'Elementos del modelo',
      explanation: `Etapa i = artículo i (${count} etapas). La alternativa m_i es cuántas unidades del artículo i se cargan y el estado x_i es la capacidad que queda para los artículos i, …, ${count}. Se resuelve en reversa, desde el último artículo.`,
      formula:
        'f_i(x_i) = \\max_{m_i = 0, 1, \\ldots, \\lfloor x_i / w_i \\rfloor} \\left\\{ r_i m_i + f_{i+1}(x_i - w_i m_i) \\right\\}, \\qquad f_{n+1} = 0',
      result: latexLines(
        items.map(
          (item, i) =>
            `${t(item.name)}:\\ w_{${i + 1}} = ${item.weight},\\ r_{${i + 1}} = ${n(item.value)}${item.maxUnits === undefined ? '' : `,\\ m_{${i + 1}} \\le ${item.maxUnits}`}`,
        ),
      ),
    },
  ];

  const f: number[][] = Array.from({ length: count + 1 }, () => capacities.map(() => 0));
  const decisions: number[][] = Array.from({ length: count }, () => capacities.map(() => 0));
  const tables: ResultTable[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const stage = i + 1;
    const { weight: w, value: r, name } = items[i]!;
    const rows: StageRow[] = [];
    const children: Step[] = [];
    const widest = maxUnits(i, W);
    for (const x of capacities) {
      const options = Array.from({ length: maxUnits(i, x) + 1 }, (_, m) => m);
      const values = options.map((m) => r * m + f[i + 1]![x - w * m]!);
      const best = argOptimum('max', values);
      f[i]![x] = values[best[0]!]!;
      decisions[i]![x] = options[best[0]!]!;
      rows.push({
        state: String(x),
        values: new Map(options.map((m, k) => [String(m), values[k]!])),
        best: f[i]![x]!,
        argBest: best.map((k) => String(options[k]!)),
      });
      children.push({
        title: `Capacidad x${stage} = ${x}`,
        substitution: `f_{${stage}}(${x}) = ${optimumLatex(
          'max',
          values,
        )} \\quad \\text{con } ${options
          .map((m) => `m = ${m}:\\ ${n(r)}(${m}) + f_{${stage + 1}}(${x - w * m})`)
          .join(',\\ ')}`,
        result: `f_{${stage}}(${x}) = ${n(f[i]![x]!)}, \\qquad m_{${stage}}^* = ${best.map((k) => options[k]!).join('\\ \\text{o}\\ ')}`,
      });
    }
    steps.push({
      title: `Etapa ${stage}: ${name}`,
      explanation: `Cada unidad pesa ${w} y rinde ${r}; con capacidad x caben a lo sumo ⌊x/${w}⌋ unidades${items[i]!.maxUnits === undefined ? '' : ` (y no más de ${items[i]!.maxUnits})`}. ${i === count - 1 ? 'Es el último artículo, así que no hay rendimiento futuro.' : `Lo que sobra de la capacidad se aprovecha como indica f${stage + 1}.`}`,
      children,
    });
    tables.push(
      stageTable({
        id: `etapa-${stage}`,
        title: `Etapa ${stage}: ${name} (w = ${w}, r = ${r})`,
        stateHeader: `x_{${stage}}`,
        decisions: Array.from({ length: widest + 1 }, (_, m) => ({
          key: String(m),
          header: `m_{${stage}} = ${m}`,
        })),
        rows,
        bestHeader: `f_{${stage}}(x_{${stage}})`,
        argHeader: `m_{${stage}}^*`,
      }),
    );
  }

  // ── Solución: se parte de x₁ = W y se sigue la decisión óptima ────────────
  const units: number[] = [];
  let x = W;
  const walk: string[] = [];
  for (let i = 0; i < count; i++) {
    const m = decisions[i]![x]!;
    units.push(m);
    walk.push(`x_{${i + 1}} = ${x} \\Rightarrow m_{${i + 1}}^* = ${m}`);
    x -= items[i]!.weight * m;
  }
  const usedCapacity = W - x;
  const totalValue = f[0]![W]!;
  steps.push({
    title: 'Solución óptima',
    explanation:
      'Con x₁ = W se lee m₁* en la etapa 1; la capacidad que queda, x₂ = x₁ − w₁m₁*, da m₂* en la etapa 2, y así sucesivamente.',
    substitution: latexLines(walk),
    result: `m^* = \\left(${units.join(',\\ ')}\\right), \\qquad f_1(${W}) = ${n(totalValue)}`,
  });

  return {
    ok: true,
    value: {
      totalValue,
      units,
      usedCapacity,
      stages: f.slice(0, count),
      decisions,
    },
    summary: [
      { label: 'Beneficio máximo', value: n(totalValue), emphasis: true },
      {
        label: 'Unidades de cada artículo',
        value: items.map((item, i) => `${t(item.name)}: ${units[i]}`).join(',\\quad '),
      },
      { label: 'Capacidad usada', value: `${usedCapacity}\\ \\text{de}\\ ${W}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'solucion',
        title: 'Carga óptima',
        columns: [
          { key: 'name', header: '\\text{Artículo}', format: 'text' },
          { key: 'units', header: 'm_i' },
          { key: 'weight', header: 'w_i m_i' },
          { key: 'value', header: 'r_i m_i' },
        ],
        rows: items.map((item, i) => ({
          name: item.name,
          units: units[i]!,
          weight: item.weight * units[i]!,
          value: item.value * units[i]!,
        })),
      },
      ...tables,
    ],
  };
}

export const knapsack: Calculator<KnapsackInput, KnapsackValue, KnapsackErrorCode> = {
  meta: {
    id: 'mochila',
    title: 'Modelo de la mochila (carga)',
    summary: 'Reparte una capacidad limitada entre artículos para maximizar el beneficio.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 10.3.1, Ejemplo 10.3-1 (8.ª ed. en inglés)' },
      { sourceId: 'winston-1994' },
    ],
  },
  inputSchema: knapsackInputSchema,
  // Taha, ejemplo 10.3-1: barco de 4 toneladas; peso en toneladas y rendimiento en miles de
  // dólares por unidad de cada artículo.
  example: {
    capacity: 4,
    items: [
      { name: 'Artículo 1', weight: 2, value: 31 },
      { name: 'Artículo 2', weight: 3, value: 47 },
      { name: 'Artículo 3', weight: 1, value: 14 },
    ],
  },
  solve: solveKnapsack,
};
