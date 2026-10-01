/**
 * Clasificación ABC de inventarios (Chase, Jacobs y Aquilano, cap. 17 de la 12.ª ed.; Díaz
 * Matalobos): las piezas se ordenan por su uso anual en dinero (demanda anual × costo unitario) y
 * se dividen en tres grupos según el principio de Pareto: pocas piezas A concentran la mayor parte
 * del valor, muchas piezas C representan poco.
 *
 * Dos criterios de corte:
 * - por porcentaje de piezas (como en el libro): A = el primer p_A % de la lista, B = el
 *   siguiente p_B %, C = el resto (Chase usa 20 %, 30 % y 50 %);
 * - por valor acumulado: A hasta que el porcentaje acumulado del valor llega a v_A (p. ej. 80 %),
 *   B hasta v_B (p. ej. 95 %) y C el resto.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexText } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Series,
  type Step,
} from '../types';

export const abcCriteria = ['articulos', 'valor'] as const;

const percent = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine((v) => Number.isFinite(v) && v > 0 && v < 100, `${label} debe estar entre 0 y 100.`);

export const abcInputSchema = z
  .object({
    items: z
      .array(
        z.object({
          name: z
            .string({ error: 'Escribe el nombre o número de la pieza.' })
            .trim()
            .min(1, 'Escribe el nombre o número de la pieza.')
            .max(24, 'Usa un nombre de hasta 24 caracteres.'),
          quantity: z
            .number({ error: 'Ingresa la demanda anual.' })
            .refine((v) => Number.isFinite(v) && v >= 0, 'La demanda no puede ser negativa.'),
          unitCost: z
            .number({ error: 'El costo unitario debe ser un número.' })
            .refine((v) => Number.isFinite(v) && v >= 0, 'El costo no puede ser negativo.')
            .optional(),
        }),
      )
      .min(3, 'Agrega al menos tres piezas.')
      .max(60, 'El máximo es 60 piezas.'),
    criterion: z.enum(abcCriteria, { error: 'Elige el criterio.' }),
    cutA: percent('el corte de A'),
    cutB: percent('el corte de B'),
  })
  .superRefine((v, ctx) => {
    if (v.criterion === 'articulos' && v.cutA + v.cutB >= 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['cutB'],
        message: 'Los porcentajes de A y B deben sumar menos de 100 (el resto es C).',
      });
    }
    if (v.criterion === 'valor' && v.cutB <= v.cutA) {
      ctx.addIssue({
        code: 'custom',
        path: ['cutB'],
        message: 'El corte acumulado de B debe ser mayor que el de A.',
      });
    }
    if (v.items.every((i) => i.quantity * (i.unitCost ?? 1) === 0)) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Alguna pieza debe tener valor.' });
    }
  });

export type AbcInput = z.infer<typeof abcInputSchema>;

export interface AbcItem {
  rank: number;
  name: string;
  value: number;
  percent: number;
  cumulative: number;
  itemsPercent: number;
  group: 'A' | 'B' | 'C';
}

export interface AbcGroup {
  group: 'A' | 'B' | 'C';
  names: string[];
  value: number;
  percent: number;
  itemsPercent: number;
}

export interface AbcValue {
  items: AbcItem[];
  groups: AbcGroup[];
  total: number;
}

export type AbcErrorCode = never;

type Result = CalculatorResult<AbcValue, AbcErrorCode>;

const n = toLatexNumber;

export function solveAbc(input: AbcInput): Result {
  const { criterion, cutA, cutB } = input;
  const valued = input.items.map((item, index) => ({
    name: item.name,
    value: item.quantity * (item.unitCost ?? 1),
    index,
  }));
  const total = valued.reduce((acc, i) => acc + i.value, 0);
  const sorted = [...valued].sort((a, b) => b.value - a.value || a.index - b.index);
  const count = sorted.length;
  const countA = Math.max(1, Math.round((cutA / 100) * count));
  const countB = Math.max(1, Math.round((cutB / 100) * count));

  let cumulative = 0;
  const items: AbcItem[] = sorted.map((item, k) => {
    const pct = (item.value / total) * 100;
    cumulative += pct;
    let group: AbcItem['group'];
    if (criterion === 'articulos') {
      group = k < countA ? 'A' : k < countA + countB ? 'B' : 'C';
    } else {
      group = k === 0 || cumulative <= cutA + 1e-9 ? 'A' : cumulative <= cutB + 1e-9 ? 'B' : 'C';
    }
    return {
      rank: k + 1,
      name: item.name,
      value: item.value,
      percent: pct,
      cumulative: Math.min(100, cumulative),
      itemsPercent: ((k + 1) / count) * 100,
      group,
    };
  });

  const groups: AbcGroup[] = (['A', 'B', 'C'] as const).map((group) => {
    const members = items.filter((i) => i.group === group);
    const value = members.reduce((acc, i) => acc + i.value, 0);
    return {
      group,
      names: members.map((i) => i.name),
      value,
      percent: (value / total) * 100,
      itemsPercent: (members.length / count) * 100,
    };
  });

  const steps: Step[] = [
    {
      title: 'Uso anual en dinero de cada pieza',
      explanation:
        'Es la medida de importancia: una pieza barata con mucha demanda puede valer más que una cara con poca. Si no se da el costo unitario, la cantidad ya es el uso en dinero.',
      formula: '\\text{Uso anual} = \\text{demanda anual} \\times \\text{costo unitario}',
      result: `\\text{Total} = ${n(total)}`,
    },
    {
      title: 'Ordenar de mayor a menor y acumular',
      explanation:
        'Se calcula el porcentaje de cada pieza sobre el total y el porcentaje acumulado.',
      formula: '\\%_i = \\frac{\\text{uso}_i}{\\sum \\text{uso}} \\times 100',
      substitution: items
        .slice(0, 6)
        .map(
          (i) =>
            `${toLatexText(i.name)}: \\frac{${n(i.value)}}{${n(total)}} = ${n(i.percent, 4)}\\,\\%`,
        )
        .join(' \\\\ '),
    },
    {
      title: 'Cortes de los grupos',
      explanation:
        criterion === 'articulos'
          ? `Por porcentaje de piezas: A = el primer ${formatNumber(cutA)} % de la lista (${countA} de ${count}), B = el siguiente ${formatNumber(cutB)} % (${countB}) y C el resto.`
          : `Por valor acumulado: A mientras el acumulado no pase de ${formatNumber(cutA)} %, B hasta ${formatNumber(cutB)} % y C el resto.`,
      result: groups
        .map((g) => `${g.group}: ${g.names.map(toLatexText).join(',\\ ') || '\\text{—}'}`)
        .join(' \\\\ '),
    },
    {
      title: 'Resumen por grupo',
      substitution: groups
        .map(
          (g) =>
            `${g.group}: ${n(g.value)} \\ (${n(g.percent, 3)}\\,\\% \\text{ del valor, } ${n(g.itemsPercent, 3)}\\,\\% \\text{ de las piezas})`,
        )
        .join(' \\\\ '),
    },
  ];

  const series: Series[] = [
    {
      id: 'pareto',
      title: 'Curva ABC (Pareto)',
      xLabel: '% de las piezas',
      yLabel: '% acumulado del valor',
      points: [{ x: 0, y: 0 }, ...items.map((i) => ({ x: i.itemsPercent, y: i.cumulative }))],
    },
  ];

  return {
    ok: true,
    value: { items, groups, total },
    summary: groups.map((g, k) => ({
      label: `Grupo ${g.group}`,
      value: `${g.names.length} \\text{ piezas, } ${n(g.percent, 3)}\\,\\% \\text{ del valor}`,
      emphasis: k === 0,
    })),
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'piezas',
        title: 'Piezas ordenadas por uso anual en dinero',
        columns: [
          { key: 'rank', header: '\\#' },
          { key: 'name', header: '\\text{Pieza}', format: 'text' },
          { key: 'value', header: '\\text{Uso anual}' },
          { key: 'percent', header: '\\%' },
          { key: 'cumulative', header: '\\%\\ \\text{acumulado}' },
          { key: 'itemsPercent', header: '\\%\\ \\text{de piezas}' },
          { key: 'group', header: '\\text{Grupo}', format: 'text' },
        ],
        rows: items.map((i): Record<string, CellValue> => ({ ...i })),
      },
      {
        id: 'grupos',
        title: 'Agrupamiento ABC',
        columns: [
          { key: 'group', header: '\\text{Grupo}', format: 'text' },
          { key: 'names', header: '\\text{Piezas}', format: 'text' },
          { key: 'value', header: '\\text{Uso anual}' },
          { key: 'percent', header: '\\%\\ \\text{del valor}' },
          { key: 'itemsPercent', header: '\\%\\ \\text{de piezas}' },
        ],
        rows: groups.map((g) => ({ ...g, names: g.names.join(', ') })),
      },
    ],
    series,
    notices: [
      {
        level: 'info',
        message:
          'Los cortes son una guía: el objetivo es separar lo importante de lo que no lo es. Una pieza crítica puede subirse de grupo aunque su valor no lo justifique.',
      },
    ],
  };
}

export const abc: Calculator<AbcInput, AbcValue, AbcErrorCode> = {
  meta: {
    id: 'clasificacion-abc',
    title: 'Clasificación ABC',
    summary: 'Agrupa los artículos según su uso anual en dinero (principio de Pareto).',
    citations: [
      {
        sourceId: 'aquilano-1994',
        locator:
          'Chase, Jacobs y Aquilano, ilustraciones 17.12 y 17.13 (12.ª ed. en español; 20.11 de la 15.ª)',
      },
      { sourceId: 'diaz-matalobos-1998' },
    ],
  },
  inputSchema: abcInputSchema,
  // Chase, Jacobs y Aquilano, ilustración 17.12: uso anual en dólares de 10 piezas.
  example: {
    items: [
      { name: '22', quantity: 95000 },
      { name: '68', quantity: 75000 },
      { name: '27', quantity: 25000 },
      { name: '03', quantity: 15000 },
      { name: '82', quantity: 13000 },
      { name: '54', quantity: 7500 },
      { name: '36', quantity: 1500 },
      { name: '19', quantity: 800 },
      { name: '23', quantity: 425 },
      { name: '41', quantity: 225 },
    ],
    criterion: 'articulos',
    cutA: 20,
    cutB: 30,
  },
  solve: solveAbc,
};
