/**
 * Procedimiento común de las soluciones iniciales del transporte (esquina noroeste, costo
 * mínimo y Vogel): balancear, asignar, presentar la tabla y calcular el costo.
 */
import { z } from 'zod';
import { emptyTrace, type CalculatorResult, type Notice } from '../types';
import {
  allocationTable,
  balance,
  balanceStep,
  costLatex,
  initialSolution,
  parseKey,
  refineTransport,
  totalCost,
  transportShape,
  type InitialMethod,
  type TransportData,
} from './transport';

export const transportInputSchema = z.object(transportShape).superRefine(refineTransport);
export type TransportInput = z.infer<typeof transportInputSchema>;

export interface TransportValue {
  cost: number;
  /** Celdas básicas (incluidas las que valen 0), 1-indexadas como en la tabla. */
  allocation: { from: number; to: number; quantity: number }[];
  balanced: boolean;
}

export type TransportErrorCode = never;

const intro: Record<InitialMethod, string> = {
  'esquina-noroeste':
    'Se empieza en la celda (1, 1) y se asigna lo más posible: el mínimo entre la oferta y la demanda que quedan. Luego se avanza a la derecha si se agotó la demanda de la columna, o hacia abajo si se agotó la oferta de la fila. No usa los costos, así que suele dar una solución cara.',
  'costo-minimo':
    'En cada paso se asigna lo más posible a la celda de menor costo entre las que no están tachadas, y se tacha la fila o la columna que queda satisfecha.',
  vogel:
    'En cada paso se calcula la penalización de cada fila y columna (la diferencia entre sus dos menores costos) y se asigna lo más posible a la celda de menor costo de la fila o columna con la mayor penalización. Suele dar una solución inicial muy cercana a la óptima.',
};

export function solveInitial(
  input: TransportData,
  method: InitialMethod,
): CalculatorResult<TransportValue, TransportErrorCode> {
  const b = balance(input);
  const { allocation, steps } = initialSolution(b, method);
  const cost = totalCost(b, allocation);
  const notices: Notice[] = [];
  const zeros = [...allocation.entries()].filter(([, q]) => q.isZero());
  if (zeros.length > 0) {
    notices.push({
      level: 'info',
      message: `Solución degenerada: ${zeros
        .map(
          ([k]) =>
            `x${parseKey(k)
              .map((v) => v + 1)
              .join('')}`,
        )
        .join(
          ', ',
        )} ${zeros.length === 1 ? 'es básica con valor' : 'son básicas con valor'} 0. Se conservan para tener m + n − 1 = ${b.supply.length + b.demand.length - 1} variables básicas.`,
    });
  }
  return {
    ok: true,
    value: {
      cost: cost.toNumber(),
      allocation: [...allocation.entries()].map(([k, q]) => {
        const [i, j] = parseKey(k);
        return { from: i + 1, to: j + 1, quantity: q.toNumber() };
      }),
      balanced: b.dummy === null,
    },
    summary: [
      { label: 'Costo total de la solución inicial', value: cost.toLatex(), emphasis: true },
      {
        label: 'Asignaciones',
        value: [...allocation.entries()]
          .filter(([, q]) => !q.isZero())
          .map(([k, q]) => {
            const [i, j] = parseKey(k);
            return `x_{${i + 1}${j + 1}} = ${q.toLatex()}`;
          })
          .join(',\\ '),
      },
      {
        label: 'Variables básicas',
        value: `${allocation.size} = m + n - 1`,
      },
    ],
    ...emptyTrace(),
    steps: [
      balanceStep(b),
      { title: 'Asignaciones', explanation: intro[method], children: steps },
      {
        title: 'Costo total',
        formula: 'Z = \\sum c_{ij}\\,x_{ij}',
        substitution: costLatex(b, allocation),
        result: `Z = ${cost.toLatex()}`,
      },
    ],
    notices,
    tables: [
      allocationTable(
        b,
        allocation,
        'asignacion',
        'Solución inicial (cantidad asignada y costo unitario)',
      ),
    ],
  };
}

/** Ejemplo SunRay Transport (Taha, ejemplo 5.3-1): 3 silos y 4 molinos. */
export const sunRay: TransportInput = {
  costs: [
    [10, 2, 20, 11],
    [12, 7, 9, 20],
    [4, 14, 16, 18],
  ],
  supply: [15, 25, 10],
  demand: [5, 15, 15, 15],
};
