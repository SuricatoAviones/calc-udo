/**
 * Cantidad económica de pedido, EOQ (Taha, sec. del modelo clásico de EOQ; Hillier & Lieberman,
 * sec. 19.3 de la 7.ª ed.): demanda constante D, costo de preparación K por pedido, costo de
 * mantener h por unidad y por unidad de tiempo, sin faltantes y reabastecimiento instantáneo.
 *
 *   TCU(Q) = KD/Q + hQ/2,   Q* = √(2KD/h),   t₀ = Q* / D,   TCU(Q*) = √(2KDh)
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import {
  costCurves,
  economicOrderQuantity,
  nonNegativeField,
  positiveField,
  reorderPoint,
  reorderStep,
  type ReorderPoint,
} from './inventory';

export const eoqInputSchema = z.object({
  demand: positiveField('la demanda D'),
  orderCost: positiveField('el costo de pedir K'),
  holdingCost: positiveField('el costo de mantener h'),
  leadTime: nonNegativeField('el tiempo de entrega L').optional(),
});

export type EoqInput = z.infer<typeof eoqInputSchema>;

export interface EoqValue {
  quantity: number;
  cycle: number;
  ordersPerTime: number;
  orderingCost: number;
  holdingCost: number;
  totalCost: number;
  reorder: ReorderPoint | null;
}

export type EoqErrorCode = never;

const n = toLatexNumber;

export function solveEoq(input: EoqInput): CalculatorResult<EoqValue, EoqErrorCode> {
  const { demand: D, orderCost: K, holdingCost: h, leadTime } = input;
  const Q = economicOrderQuantity(D, K, h);
  const ordering = (K * D) / Q;
  const holding = (h * Q) / 2;
  const total = ordering + holding;
  const cycle = Q / D;

  const steps: Step[] = [
    {
      title: 'Cantidad económica de pedido',
      explanation:
        'El costo total por unidad de tiempo suma el costo de pedir (baja cuando se piden lotes grandes) y el de mantener el inventario promedio Q/2 (sube con el lote). Se deriva e iguala a cero.',
      formula:
        '\\mathrm{TCU}(Q) = \\frac{KD}{Q} + \\frac{hQ}{2}, \\qquad Q^* = \\sqrt{\\frac{2KD}{h}}',
      substitution: `Q^* = \\sqrt{\\frac{2(${n(K)})(${n(D)})}{${n(h)}}}`,
      result: `Q^* = ${n(Q, 6)}`,
    },
    {
      title: 'Costos en el óptimo',
      explanation: 'En Q* el costo de pedir y el de mantener son iguales.',
      formula: '\\frac{KD}{Q^*}, \\qquad \\frac{hQ^*}{2}',
      substitution: `\\frac{${n(K)}(${n(D)})}{${n(Q, 6)}} = ${n(ordering, 6)}, \\qquad \\frac{${n(h)}(${n(Q, 6)})}{2} = ${n(holding, 6)}`,
      result: `\\mathrm{TCU}(Q^*) = ${n(ordering, 6)} + ${n(holding, 6)} = ${n(total, 6)}`,
    },
    {
      title: 'Duración del ciclo',
      explanation:
        'Tiempo que tarda en consumirse un lote, y número de pedidos por unidad de tiempo.',
      formula: 't_0 = \\frac{Q^*}{D}, \\qquad N = \\frac{D}{Q^*}',
      substitution: `t_0 = \\frac{${n(Q, 6)}}{${n(D)}}, \\qquad N = \\frac{${n(D)}}{${n(Q, 6)}}`,
      result: `t_0 = ${n(cycle, 6)}, \\qquad N = ${n(D / Q, 6)}`,
    },
  ];

  const reorder = leadTime === undefined ? null : reorderPoint(D, Q, leadTime);
  if (reorder) steps.push(reorderStep(D, leadTime!, reorder));

  return {
    ok: true,
    value: {
      quantity: Q,
      cycle,
      ordersPerTime: D / Q,
      orderingCost: ordering,
      holdingCost: holding,
      totalCost: total,
      reorder,
    },
    summary: [
      { label: 'Cantidad económica de pedido', value: `Q^* = ${n(Q, 6)}`, emphasis: true },
      { label: 'Costo por unidad de tiempo', value: `\\mathrm{TCU} = ${n(total, 6)}` },
      { label: 'Duración del ciclo', value: `t_0 = ${n(cycle, 6)}` },
      ...(reorder
        ? [
            {
              label: 'Punto de reorden',
              value: `R = ${n(reorder.reorderPoint, 6)}`,
            },
          ]
        : []),
    ],
    ...emptyTrace(),
    steps,
    notices: [
      {
        level: 'info',
        message: `Usa la misma unidad de tiempo en D, h y L. En la práctica Q* se redondea (${formatNumber(Q, 6)} ≈ ${Math.round(Q)}); el costo cambia muy poco cerca del óptimo.`,
      },
    ],
    series: [
      costCurves({
        optimum: Q,
        total: (q) => (K * D) / q + (h * q) / 2,
        components: [
          { label: 'Costo de pedir KD/Q', f: (q) => (K * D) / q },
          { label: 'Costo de mantener hQ/2', f: (q) => (h * q) / 2 },
        ],
      }),
    ],
  };
}

export const eoq: Calculator<EoqInput, EoqValue, EoqErrorCode> = {
  meta: {
    id: 'eoq',
    title: 'Cantidad económica de pedido (EOQ)',
    summary: 'Tamaño de lote que equilibra los costos de pedir y de mantener.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Modelo clásico de EOQ, Ejemplo 12.3-1 (9.ª ed. en inglés; 11.3-1 en la 8.ª)',
      },
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 19.3, ejemplo de las bocinas para televisores (7.ª ed. en inglés)',
      },
      { sourceId: 'diaz-matalobos-1998' },
    ],
  },
  inputSchema: eoqInputSchema,
  // Taha, ejemplo de las lámparas de neón: 100 lámparas por día, $100 por pedido, $0.02 por
  // lámpara y por día, 12 días de tiempo de entrega.
  example: { demand: 100, orderCost: 100, holdingCost: 0.02, leadTime: 12 },
  solve: solveEoq,
};
