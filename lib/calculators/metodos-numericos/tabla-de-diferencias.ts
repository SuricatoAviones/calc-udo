/**
 * Tabla de diferencias finitas hacia adelante o de diferencias divididas a partir de una tabla de
 * datos (x_i, y_i). Ver differences.ts para las fórmulas.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Step,
  type SummaryItem,
  type TableColumn,
} from '../types';
import {
  constantOrder,
  describeSpacing,
  dividedDifferences,
  dividedName,
  equalSpacing,
  forwardDifferences,
  forwardName,
  parsePoints,
  pointsShape,
  refinePoints,
  SPACING_MESSAGE,
} from './differences';

export const differenceKinds = ['adelante', 'divididas'] as const;
export type DifferenceKind = (typeof differenceKinds)[number];

export const differenceTableInputSchema = z
  .object({
    kind: z.enum(differenceKinds, { error: 'Elige el tipo de diferencias.' }),
    ...pointsShape,
  })
  .superRefine((v, ctx) => {
    const points = refinePoints(v, ctx);
    if (points && v.kind === 'adelante' && equalSpacing(points.x) === null) {
      ctx.addIssue({ code: 'custom', path: ['x'], message: SPACING_MESSAGE });
    }
  });

export type DifferenceTableInput = z.infer<typeof differenceTableInputSchema>;

export interface DifferenceTableValue {
  /** levels[k][i] = Δᵏy_i o f[x_i, …, x_{i+k}]. */
  levels: number[][];
  /** Orden en que las diferencias se vuelven constantes, o `null`. */
  constantOrder: number | null;
}

export type DifferenceTableErrorCode = never;

const n = (v: number) => toLatexNumber(v, 8);
const op = (v: number) => toLatexOperand(v, 8);

/** Cálculos que se detallan por nivel. */
const DETAILED_PER_LEVEL = 3;

export function solveDifferenceTable(
  input: DifferenceTableInput,
): CalculatorResult<DifferenceTableValue, DifferenceTableErrorCode> {
  const { x, y } = parsePoints(input.x, input.y) as { x: number[]; y: number[] };
  const forward = input.kind === 'adelante';
  const levels = forward ? forwardDifferences(y) : dividedDifferences(x, y);
  const name = forward ? forwardName : dividedName;
  const h = equalSpacing(x);

  const steps: Step[] = [
    {
      title: 'Datos',
      explanation: `${x.length} puntos. ${h !== null ? describeSpacing(h) : 'Los x no están igualmente espaciados.'}`,
      result: x.map((xi, i) => `(${n(xi)},\\ ${n(y[i]!)})`).join(',\\ '),
    },
  ];

  for (let k = 1; k < levels.length; k++) {
    const level = levels[k]!;
    const prev = levels[k - 1]!;
    const children: Step[] = level.slice(0, DETAILED_PER_LEVEL).map((v, i) => {
      if (forward) {
        return {
          title: `Diferencia de orden ${k} en i = ${i}`,
          formula: `${name(i, k)} = ${name(i + 1, k - 1)} - ${name(i, k - 1)}`,
          substitution: `${name(i, k)} = ${n(prev[i + 1]!)} - ${op(prev[i]!)}`,
          result: `${name(i, k)} = ${n(v)}`,
        };
      }
      return {
        title: `Diferencia de orden ${k} en i = ${i}`,
        formula: `${name(i, k)} = \\frac{${name(i + 1, k - 1)} - ${name(i, k - 1)}}{x_{${i + k}} - x_{${i}}}`,
        substitution: `${name(i, k)} = \\frac{${n(prev[i + 1]!)} - ${op(prev[i]!)}}{${n(x[i + k]!)} - ${op(x[i]!)}}`,
        result: `${name(i, k)} = ${n(v)}`,
      };
    });
    steps.push({
      title: forward ? `Diferencias de orden ${k}` : `Diferencias divididas de orden ${k}`,
      explanation:
        level.length > DETAILED_PER_LEVEL
          ? `Se detallan las primeras ${DETAILED_PER_LEVEL}; las ${level.length} están en la tabla.`
          : undefined,
      children,
    });
  }

  const constant = constantOrder(levels);
  if (constant !== null) {
    steps.push({
      title: `Las diferencias de orden ${constant} son constantes`,
      explanation: `Todas las diferencias de orden ${constant} valen ${formatNumber(levels[constant]![0]!, 8)} y las de orden mayor son 0: los datos provienen de un polinomio de grado ${constant}.`,
    });
  }

  const columns: TableColumn[] = [
    { key: 'i', header: 'i' },
    { key: 'x', header: 'x_i' },
    ...levels.map((_, k) => ({
      key: `d${k}`,
      header: forward
        ? k === 0
          ? 'y_i'
          : `\\Delta${k === 1 ? '' : `^{${k}}`} y_i`
        : k === 0
          ? 'f[x_i]'
          : `f[x_i, \\ldots, x_{i+${k}}]`,
    })),
  ];
  const rows = x.map((xi, i) => {
    const row: Record<string, CellValue> = { i, x: xi };
    levels.forEach((level, k) => {
      row[`d${k}`] = level[i] ?? null;
    });
    return row;
  });

  const summary: SummaryItem[] = [
    { label: 'Puntos', value: String(x.length) },
    {
      label: forward ? 'Primeras diferencias en y₀' : 'Coeficientes de Newton (diagonal)',
      value: levels
        .slice(0, 5)
        .map((level, k) => `${name(0, k)} = ${n(level[0]!)}`)
        .join(',\\ '),
      emphasis: true,
    },
  ];
  if (constant !== null) {
    summary.push({ label: 'Diferencias constantes', value: `\\text{orden } ${constant}` });
  }

  return {
    ok: true,
    value: { levels, constantOrder: constant },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'diferencias',
        title: forward ? 'Tabla de diferencias hacia adelante' : 'Tabla de diferencias divididas',
        columns,
        rows,
      },
    ],
  };
}

export const differenceTable: Calculator<
  DifferenceTableInput,
  DifferenceTableValue,
  DifferenceTableErrorCode
> = {
  meta: {
    id: 'tabla-de-diferencias',
    title: 'Tabla de diferencias',
    summary:
      'Construye la tabla de diferencias hacia adelante o de diferencias divididas de un conjunto de datos.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 18, sec. 18.1.3 (diferencias divididas finitas, ejemplo 18.3: ln x en 1, 4, 6 y 5), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'smith-1993' },
    ],
  },
  inputSchema: differenceTableInputSchema,
  example: { kind: 'divididas', x: '1 4 6 5', y: '0 1.3862944 1.7917595 1.6094379' },
  solve: solveDifferenceTable,
};
