/**
 * Lote económico de producción (Anderson, Sweeney y Williams, sec. 10.2; Taha, modelo con
 * reabastecimiento gradual): mientras se produce, el inventario crece a razón P − D (producción
 * menos demanda); cuando termina la corrida, baja a razón D.
 *
 *   Inventario máximo = (1 − D/P) Q,   CT(Q) = ½(1 − D/P) Q C_h + (D/Q) C_o
 *   Q* = √( 2 D C_o / ((1 − D/P) C_h) )
 *
 * Con d días hábiles al año: duración del ciclo T = d·Q* / D, duración de la corrida t = d·Q* / P y
 * punto de reorden r = (D/d)·L para un tiempo de preparación de L días. Si P → ∞ se obtiene el
 * EOQ clásico.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import { costCurves, nonNegativeField, positiveField } from './inventory';

export const productionLotInputSchema = z
  .object({
    demand: positiveField('la demanda anual D'),
    production: positiveField('la producción anual P'),
    setupCost: positiveField('el costo de preparación C_o'),
    holdingCost: positiveField('el costo de mantener C_h'),
    workingDays: positiveField('los días hábiles por año').optional(),
    leadTime: nonNegativeField('el tiempo de preparación L').optional(),
  })
  .refine((v) => v.production > v.demand, {
    message:
      'La tasa de producción debe ser mayor que la demanda (si no, nunca se acumula inventario).',
    path: ['production'],
  });

export type ProductionLotInput = z.infer<typeof productionLotInputSchema>;

export interface ProductionLotValue {
  quantity: number;
  maxInventory: number;
  averageInventory: number;
  runs: number;
  holdingCost: number;
  setupCost: number;
  totalCost: number;
  cycleDays: number | null;
  runDays: number | null;
  reorderPoint: number | null;
}

export type ProductionLotErrorCode = never;

type Result = CalculatorResult<ProductionLotValue, ProductionLotErrorCode>;

const n = toLatexNumber;

export function solveProductionLot(input: ProductionLotInput): Result {
  const { demand: D, production: P, setupCost: Co, holdingCost: Ch } = input;
  const factor = 1 - D / P;
  const Q = Math.sqrt((2 * D * Co) / (factor * Ch));
  const maxInventory = factor * Q;
  const holding = 0.5 * factor * Q * Ch;
  const setup = (D / Q) * Co;
  const total = holding + setup;
  const runs = D / Q;

  const steps: Step[] = [
    {
      title: 'Fracción del tiempo en que no se produce',
      explanation:
        'Durante la corrida el inventario crece a razón P − D; la fracción 1 − D/P es la que se acumula de cada unidad producida.',
      formula: '1 - \\frac{D}{P}',
      substitution: `1 - \\frac{${n(D)}}{${n(P)}}`,
      result: `1 - \\frac{D}{P} = ${n(factor)}`,
    },
    {
      title: 'Tamaño económico del lote',
      explanation:
        'Minimiza el costo anual de preparación más el de mantener; con producción instantánea (P → ∞) sería el EOQ.',
      formula: 'Q^* = \\sqrt{\\frac{2DC_o}{\\left(1 - \\frac{D}{P}\\right)C_h}}',
      substitution: `Q^* = \\sqrt{\\frac{2(${n(D)})(${n(Co)})}{(${n(factor)})(${n(Ch)})}}`,
      result: `Q^* = ${n(Q)}`,
    },
    {
      title: 'Inventario máximo y promedio',
      formula:
        'I_{\\max} = \\left(1 - \\frac{D}{P}\\right)Q^*, \\qquad \\bar I = \\frac{I_{\\max}}{2}',
      substitution: `I_{\\max} = (${n(factor)})(${n(Q)})`,
      result: `I_{\\max} = ${n(maxInventory)}, \\qquad \\bar I = ${n(maxInventory / 2)}`,
    },
    {
      title: 'Costo total anual',
      formula: 'CT = \\frac{1}{2}\\left(1 - \\frac{D}{P}\\right)Q C_h + \\frac{D}{Q}C_o',
      substitution: `CT = \\frac{1}{2}(${n(factor)})(${n(Q)})(${n(Ch)}) + \\frac{${n(D)}}{${n(Q)}}(${n(Co)}) = ${n(holding)} + ${n(setup)}`,
      result: `CT = ${n(total)}`,
    },
    {
      title: 'Corridas de producción por año',
      formula: '\\frac{D}{Q^*}',
      substitution: `\\frac{${n(D)}}{${n(Q)}}`,
      result: `\\frac{D}{Q^*} = ${n(runs)}`,
    },
  ];

  let cycleDays: number | null = null;
  let runDays: number | null = null;
  let reorder: number | null = null;
  if (input.workingDays !== undefined) {
    const days = input.workingDays;
    cycleDays = (days * Q) / D;
    runDays = (days * Q) / P;
    steps.push({
      title: 'Duración del ciclo y de la corrida',
      explanation: `Con ${formatNumber(days)} días hábiles por año.`,
      formula: 'T = \\frac{d\\,Q^*}{D}, \\qquad t = \\frac{d\\,Q^*}{P}',
      substitution: `T = \\frac{${n(days)}(${n(Q)})}{${n(D)}}, \\qquad t = \\frac{${n(days)}(${n(Q)})}{${n(P)}}`,
      result: `T = ${n(cycleDays)} \\text{ días}, \\qquad t = ${n(runDays)} \\text{ días}`,
    });
    if (input.leadTime !== undefined) {
      reorder = (D / days) * input.leadTime;
      steps.push({
        title: 'Punto de reorden',
        explanation:
          'La corrida se programa cuando el inventario alcanza la demanda del tiempo de preparación.',
        formula: 'r = \\frac{D}{d}\\,L',
        substitution: `r = \\frac{${n(D)}}{${n(days)}}(${n(input.leadTime)})`,
        result: `r = ${n(reorder)}`,
      });
    }
  }

  const series = [
    costCurves({
      optimum: Q,
      total: (q) => 0.5 * factor * q * Ch + (D / q) * Co,
      components: [
        { label: 'Costo de mantener', f: (q) => 0.5 * factor * q * Ch },
        { label: 'Costo de preparación', f: (q) => (D / q) * Co },
      ],
    }),
  ];

  return {
    ok: true,
    value: {
      quantity: Q,
      maxInventory,
      averageInventory: maxInventory / 2,
      runs,
      holdingCost: holding,
      setupCost: setup,
      totalCost: total,
      cycleDays,
      runDays,
      reorderPoint: reorder,
    },
    summary: [
      { label: 'Lote económico de producción', value: `Q^* = ${n(Q, 6)}`, emphasis: true },
      { label: 'Costo total anual', value: `CT = ${n(total, 6)}` },
      { label: 'Inventario máximo', value: `I_{\\max} = ${n(maxInventory, 6)}` },
      ...(cycleDays === null
        ? []
        : [
            {
              label: 'Ciclo y corrida',
              value: `T = ${n(cycleDays, 4)},\\ t = ${n(runDays!, 4)} \\text{ días}`,
            },
          ]),
      ...(reorder === null ? [] : [{ label: 'Punto de reorden', value: `r = ${n(reorder, 6)}` }]),
    ],
    ...emptyTrace(),
    steps,
    series,
    notices: [
      {
        level: 'info',
        message: 'En el óptimo, el costo de mantener y el de preparación son iguales.',
      },
    ],
  };
}

export const productionLot: Calculator<
  ProductionLotInput,
  ProductionLotValue,
  ProductionLotErrorCode
> = {
  meta: {
    id: 'lote-economico-de-produccion',
    title: 'Lote económico de producción',
    summary: 'Tamaño de lote cuando el reabastecimiento es gradual (producción a ritmo P).',
    citations: [
      {
        sourceId: 'anderson-1993',
        locator: 'Sec. 10.2, ejemplo de Beauty Bar Soap (13.ª ed.)',
      },
      { sourceId: 'taha' },
      { sourceId: 'diaz-matalobos-1998' },
    ],
  },
  inputSchema: productionLotInputSchema,
  // Anderson, Beauty Bar Soap: D = 26 000 cajas/año, capacidad P = 60 000, preparación $135,
  // C_h = 0.24 × $4.50 = $1.08; 250 días hábiles y 5 días de preparación.
  example: {
    demand: 26000,
    production: 60000,
    setupCost: 135,
    holdingCost: 1.08,
    workingDays: 250,
    leadTime: 5,
  },
  solve: solveProductionLot,
};
