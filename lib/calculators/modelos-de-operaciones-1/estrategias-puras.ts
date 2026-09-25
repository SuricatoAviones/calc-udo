/**
 * Juegos de dos personas y suma cero en estrategias puras (Taha, sec. 13.4.1; Hillier &
 * Lieberman, sec. 14.2): A elige la estrategia con el mejor peor caso (maximin) y B la que le
 * asegura la menor pérdida máxima (minimax).
 *
 *   v̲ = máx_i mín_j a_ij  ≤  v̄ = mín_j máx_i a_ij
 *
 * Si v̲ = v̄ hay un punto de silla y ese es el valor del juego; si no, la solución requiere
 * estrategias mixtas.
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
  analyzeMinimax,
  colName,
  payoffMatrixField,
  payoffMatrixLatex,
  rowName,
  strategyList,
} from './games';

export const pureStrategiesInputSchema = z.object({ payoff: payoffMatrixField });
export type PureStrategiesInput = z.infer<typeof pureStrategiesInputSchema>;

export interface PureStrategiesValue {
  rowMins: number[];
  colMaxs: number[];
  maximin: number;
  minimax: number;
  /** Índices de las estrategias maximin de A y minimax de B. */
  maximinRows: number[];
  minimaxCols: number[];
  saddlePoints: [number, number][];
  /** Valor del juego si hay punto de silla; `null` si no lo hay. */
  value: number | null;
}

export type PureStrategiesErrorCode = never;

const n = toLatexNumber;

export function solvePureStrategies({
  payoff,
}: PureStrategiesInput): CalculatorResult<PureStrategiesValue, PureStrategiesErrorCode> {
  const m = payoff.length;
  const cols = payoff[0]!.length;
  const analysis = analyzeMinimax(payoff);
  const { rowMins, colMaxs, maximin, minimax, maximinRows, minimaxCols, saddlePoints } = analysis;
  const hasSaddle = saddlePoints.length > 0;

  const steps: Step[] = [
    {
      title: 'Matriz de pagos',
      explanation:
        'Cada entrada a_ij es lo que gana el jugador A (filas) y pierde el jugador B (columnas) si A usa la estrategia i y B la j: lo que uno gana lo pierde el otro (suma cero).',
      result: payoffMatrixLatex(payoff),
    },
    {
      title: 'Criterio maximin (jugador A)',
      explanation:
        'A supone que B responderá de la peor manera para él: para cada estrategia toma el pago mínimo de su fila y elige la que tenga el mayor de esos mínimos.',
      formula: '\\underline{v} = \\max_i \\min_j a_{ij}',
      substitution: `\\min_j a_{ij}:\\ ${rowMins.map((v, i) => `${rowName(i)} \\to ${n(v)}`).join(',\\ ')}`,
      result: `\\underline{v} = \\max\\{${rowMins.map((v) => n(v)).join(',\\ ')}\\} = ${n(maximin)} \\quad (${strategyList(maximinRows, rowName)})`,
    },
    {
      title: 'Criterio minimax (jugador B)',
      explanation:
        'B hace el razonamiento simétrico: para cada estrategia toma el pago máximo de su columna (su peor pérdida) y elige la que tenga el menor de esos máximos.',
      formula: '\\overline{v} = \\min_j \\max_i a_{ij}',
      substitution: `\\max_i a_{ij}:\\ ${colMaxs.map((v, j) => `${colName(j)} \\to ${n(v)}`).join(',\\ ')}`,
      result: `\\overline{v} = \\min\\{${colMaxs.map((v) => n(v)).join(',\\ ')}\\} = ${n(minimax)} \\quad (${strategyList(minimaxCols, colName)})`,
    },
    hasSaddle
      ? {
          title: 'Punto de silla',
          explanation:
            'El valor maximin coincide con el minimax: la entrada es a la vez el mínimo de su fila y el máximo de su columna. Ningún jugador gana cambiando de estrategia por su cuenta, así que la solución es estable y ese es el valor del juego.',
          formula: '\\underline{v} = \\overline{v} = v',
          result: `${saddlePoints.map(([i, j]) => `a_{${i + 1}${j + 1}}`).join(',\\ ')} = ${n(maximin)} \\quad \\Rightarrow \\quad v = ${n(maximin)}`,
        }
      : {
          title: 'Sin punto de silla',
          explanation:
            'El maximin es menor que el minimax: si cada jugador usara siempre la misma estrategia, el otro podría aprovecharlo. El valor del juego está entre ambos y se obtiene con estrategias mixtas.',
          result: `\\underline{v} = ${n(maximin)} < v < \\overline{v} = ${n(minimax)}`,
        },
  ];

  const rows: Record<string, CellValue>[] = payoff.map((row, i) => ({
    strategy: `A${i + 1}`,
    ...Object.fromEntries(row.map((v, j) => [`b${j}`, v])),
    min: rowMins[i]!,
  }));
  rows.push({
    strategy: 'Máximo',
    ...Object.fromEntries(colMaxs.map((v, j) => [`b${j}`, v])),
    min: null,
  });

  return {
    ok: true,
    value: {
      rowMins,
      colMaxs,
      maximin,
      minimax,
      maximinRows,
      minimaxCols,
      saddlePoints,
      value: hasSaddle ? maximin : null,
    },
    summary: hasSaddle
      ? [
          { label: 'Valor del juego', value: `v = ${n(maximin)}`, emphasis: true },
          {
            label: 'Estrategia óptima de A (maximin)',
            value: strategyList(maximinRows, rowName),
          },
          {
            label: 'Estrategia óptima de B (minimax)',
            value: strategyList(minimaxCols, colName),
          },
          {
            label: saddlePoints.length > 1 ? 'Puntos de silla' : 'Punto de silla',
            value: saddlePoints.map(([i, j]) => `(${rowName(i)}, ${colName(j)})`).join(',\\ '),
          },
        ]
      : [
          {
            label: 'Sin punto de silla',
            value: `${n(maximin)} < v < ${n(minimax)}`,
            emphasis: true,
          },
          { label: 'Maximin de A', value: `\\underline{v} = ${n(maximin)}` },
          { label: 'Minimax de B', value: `\\overline{v} = ${n(minimax)}` },
        ],
    ...emptyTrace(),
    steps,
    notices: hasSaddle
      ? []
      : [
          {
            level: 'warning',
            message:
              'El juego no tiene punto de silla: las estrategias puras son inestables. Usa la calculadora de estrategias mixtas para hallar el valor del juego y la probabilidad con que conviene jugar cada estrategia.',
          },
        ],
    tables: [
      {
        id: 'matriz',
        title: `Matriz de pagos (${m} × ${cols}) con mínimos de fila y máximos de columna`,
        columns: [
          { key: 'strategy', header: '', format: 'text' },
          ...payoff[0]!.map((_, j) => ({ key: `b${j}`, header: colName(j) })),
          { key: 'min', header: '\\text{Mínimo}' },
        ],
        rows,
      },
    ],
  };
}

export const pureStrategies: Calculator<
  PureStrategiesInput,
  PureStrategiesValue,
  PureStrategiesErrorCode
> = {
  meta: {
    id: 'estrategias-puras',
    title: 'Estrategias puras y punto de silla',
    summary: 'Maximin, minimax y punto de silla de un juego de suma cero.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 13.4.1, Ejemplo 13.4-1 (9.ª ed. en inglés)' },
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 14.2, variación 2 del problema de la campaña política (7.ª ed. en inglés)',
      },
      { sourceId: 'anderson-1993' },
    ],
  },
  inputSchema: pureStrategiesInputSchema,
  // Taha, ejemplo 13.4-1: dos compañías que promocionan medicamentos contra la gripe; el pago es
  // el porcentaje de mercado que gana A.
  example: {
    payoff: [
      [8, -2, 9, -3],
      [6, 5, 6, 8],
      [-2, 4, -9, 5],
    ],
  },
  solve: solvePureStrategies,
};
