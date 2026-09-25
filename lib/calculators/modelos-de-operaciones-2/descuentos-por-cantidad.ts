/**
 * EOQ con descuentos por cantidad (Hillier & Lieberman, sec. 19.3 de la 7.ª ed.; Taha, ejemplo
 * del aceite a granel de LubeCar). El precio unitario c_j aplica a todo el lote si Q está en el
 * rango [q_j, q_{j+1}) del nivel j.
 *
 *   T_j(Q) = D c_j + KD/Q + h_j Q/2,   Q*_j = √(2KD/h_j)
 *
 * Procedimiento (Hillier): para cada nivel se calcula Q*_j; si cae dentro de su rango es un
 * candidato; si queda por debajo, el candidato es el mínimo del rango; si queda por encima, el
 * nivel se descarta porque el siguiente, más barato, cuesta menos. Se elige el candidato de menor
 * T_j. El costo de mantener puede ser fijo (h) o un porcentaje I del precio (h_j = I c_j).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
} from '../types';
import {
  economicOrderQuantity,
  nonNegativeField,
  positiveField,
  reorderPoint,
  reorderStep,
  sample,
  type ReorderPoint,
} from './inventory';

export const holdingTypes = ['fijo', 'porcentaje'] as const;

const MAX_TIERS = 8;

export const discountsInputSchema = z.object({
  demand: positiveField('la demanda D'),
  orderCost: positiveField('el costo de pedir K'),
  holdingType: z.enum(holdingTypes, { error: 'Elige cómo se da el costo de mantener.' }),
  holding: positiveField('el costo de mantener'),
  tiers: z
    .array(
      z.object({
        minQuantity: nonNegativeField('la cantidad mínima'),
        unitPrice: positiveField('el precio unitario'),
      }),
    )
    .min(1, 'Agrega al menos un nivel de precio.')
    .max(MAX_TIERS, `El máximo es ${MAX_TIERS} niveles.`)
    .superRefine((tiers, ctx) => {
      if (tiers[0] && tiers[0].minQuantity !== 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'El primer nivel debe empezar en 0 unidades (el precio sin descuento).',
        });
        return;
      }
      for (let j = 1; j < tiers.length; j++) {
        if (tiers[j]!.minQuantity <= tiers[j - 1]!.minQuantity) {
          ctx.addIssue({
            code: 'custom',
            message: 'Las cantidades mínimas deben ir en orden creciente.',
          });
          return;
        }
        if (tiers[j]!.unitPrice >= tiers[j - 1]!.unitPrice) {
          ctx.addIssue({
            code: 'custom',
            message: 'El precio debe bajar al aumentar la cantidad (es un descuento).',
          });
          return;
        }
      }
    }),
  leadTime: nonNegativeField('el tiempo de entrega L').optional(),
});

export type DiscountsInput = z.infer<typeof discountsInputSchema>;

export interface DiscountCandidate {
  tier: number;
  min: number;
  /** `Infinity` para el último nivel. */
  max: number;
  price: number;
  holding: number;
  eoq: number;
  /** `null` si el nivel se descarta. */
  quantity: number | null;
  totalCost: number | null;
}

export interface DiscountsValue {
  quantity: number;
  totalCost: number;
  /** Índice del nivel elegido. */
  tier: number;
  candidates: DiscountCandidate[];
  reorder: ReorderPoint | null;
}

export type DiscountsErrorCode = never;

const n = toLatexNumber;

export function solveDiscounts(
  input: DiscountsInput,
): CalculatorResult<DiscountsValue, DiscountsErrorCode> {
  const { demand: D, orderCost: K, tiers, holdingType, holding, leadTime } = input;
  const percent = holdingType === 'porcentaje';
  const holdingFor = (price: number) => (percent ? (holding / 100) * price : holding);
  const cost = (q: number, price: number, h: number) => D * price + (K * D) / q + (h * q) / 2;

  const candidates: DiscountCandidate[] = tiers.map((tier, j) => {
    const max = tiers[j + 1]?.minQuantity ?? Infinity;
    const h = holdingFor(tier.unitPrice);
    const q = economicOrderQuantity(D, K, h);
    const quantity = q >= max ? null : Math.max(q, tier.minQuantity);
    return {
      tier: j,
      min: tier.minQuantity,
      max,
      price: tier.unitPrice,
      holding: h,
      eoq: q,
      quantity,
      totalCost: quantity === null ? null : cost(quantity, tier.unitPrice, h),
    };
  });
  const feasible = candidates.filter((c) => c.totalCost !== null);
  const best = feasible.reduce((a, b) => (b.totalCost! < a.totalCost! ? b : a));
  const range = (c: DiscountCandidate) =>
    Number.isFinite(c.max) ? `${n(c.min)} \\le Q < ${n(c.max)}` : `Q \\ge ${n(c.min)}`;

  const steps: Step[] = [
    {
      title: 'Cantidad económica para cada precio',
      explanation: percent
        ? `El costo de mantener es el ${formatNumber(holding)} % del precio, así que cambia en cada nivel: h_j = I c_j.`
        : 'El costo de mantener es el mismo en todos los niveles, así que Q* no depende del precio.',
      formula: percent
        ? 'h_j = I\\,c_j, \\qquad Q_j^* = \\sqrt{\\frac{2KD}{h_j}}'
        : 'Q_j^* = \\sqrt{\\frac{2KD}{h}}',
      children: candidates.map((c) => ({
        title: `Nivel ${c.tier + 1}: c = ${formatNumber(c.price)}`,
        substitution: `${percent ? `h_{${c.tier + 1}} = ${n(holding / 100)}(${n(c.price)}) = ${n(c.holding, 6)}, \\quad ` : ''}Q_{${c.tier + 1}}^* = \\sqrt{\\frac{2(${n(K)})(${n(D)})}{${n(c.holding, 6)}}}`,
        result: `Q_{${c.tier + 1}}^* = ${n(c.eoq, 6)}`,
      })),
    },
    {
      title: 'Ajustar cada Q* al rango de su precio',
      explanation:
        'Si Q* está en el rango del nivel, es un candidato. Si queda por debajo, se sube al mínimo del rango para obtener el descuento. Si queda por encima, el nivel se descarta: en el siguiente nivel el precio es menor y el costo también.',
      children: candidates.map((c) => ({
        title: `Nivel ${c.tier + 1} (${Number.isFinite(c.max) ? `${formatNumber(c.min)} a ${formatNumber(c.max)}` : `${formatNumber(c.min)} o más`})`,
        substitution: `Q_{${c.tier + 1}}^* = ${n(c.eoq, 6)} \\quad \\text{y} \\quad ${range(c)}`,
        result:
          c.quantity === null
            ? '\\text{Se descarta: } Q^* \\text{ supera el rango}'
            : c.quantity === c.eoq
              ? `Q_{${c.tier + 1}} = Q_{${c.tier + 1}}^* = ${n(c.quantity, 6)}`
              : `Q_{${c.tier + 1}} = ${n(c.quantity, 6)} \\ \\text{(mínimo del rango)}`,
      })),
    },
    {
      title: 'Costo total de cada candidato',
      formula: 'T_j = D\\,c_j + \\frac{KD}{Q_j} + \\frac{h_j Q_j}{2}',
      children: feasible.map((c) => ({
        title: `Nivel ${c.tier + 1}`,
        substitution: `T_{${c.tier + 1}} = ${n(D)}(${n(c.price)}) + \\frac{${n(K)}(${n(D)})}{${n(c.quantity!, 6)}} + \\frac{${n(c.holding, 6)}(${n(c.quantity!, 6)})}{2}`,
        result: `T_{${c.tier + 1}} = ${n(c.totalCost!, 8)}`,
      })),
    },
    {
      title: 'Elegir el menor costo',
      substitution:
        feasible.length > 1
          ? `\\min\\{${feasible.map((c) => n(c.totalCost!, 8)).join(',\\ ')}\\} = ${n(best.totalCost!, 8)}`
          : undefined,
      result: `Q^* = ${n(best.quantity!, 6)} \\ \\text{a}\\ c = ${n(best.price)}, \\qquad T = ${n(best.totalCost!, 8)}`,
    },
  ];

  const reorder = leadTime === undefined ? null : reorderPoint(D, best.quantity!, leadTime);
  if (reorder) steps.push(reorderStep(D, leadTime!, reorder));

  // Gráfica: el costo total efectivo (con el precio que corresponde a cada Q) y la curva
  // completa de cada nivel.
  const lastMin = tiers.at(-1)!.minQuantity;
  const from = Math.max(1e-9, 0.2 * Math.min(...candidates.map((c) => c.eoq)));
  const to = 1.5 * Math.max(best.quantity!, lastMin, ...candidates.map((c) => c.eoq));
  const priceAt = (q: number) => candidates.filter((c) => q >= c.min).at(-1)!;
  const effective = sample(from, to, (q) => {
    const c = priceAt(q);
    return cost(q, c.price, c.holding);
  });
  for (const c of candidates.slice(1)) {
    if (c.min <= from || c.min >= to) continue;
    const before = candidates[c.tier - 1]!;
    const eps = (to - from) * 1e-6;
    effective.push(
      { x: c.min - eps, y: cost(c.min - eps, before.price, before.holding) },
      { x: c.min, y: cost(c.min, c.price, c.holding) },
    );
  }
  effective.sort((a, b) => a.x - b.x);
  const series: Series = {
    id: 'costos',
    title: 'Costo total por unidad de tiempo con descuentos',
    xLabel: 'Q',
    yLabel: 'Costo',
    label: 'Costo total con el precio de cada rango',
    points: effective,
    others: candidates.map((c) => ({
      label: `T${c.tier + 1} (c = ${formatNumber(c.price)})`,
      points: sample(from, to, (q) => cost(q, c.price, c.holding), 40),
    })),
  };

  return {
    ok: true,
    value: {
      quantity: best.quantity!,
      totalCost: best.totalCost!,
      tier: best.tier,
      candidates,
      reorder,
    },
    summary: [
      { label: 'Tamaño del lote', value: `Q^* = ${n(best.quantity!, 6)}`, emphasis: true },
      { label: 'Precio unitario', value: `c = ${n(best.price)}` },
      { label: 'Costo total por unidad de tiempo', value: `T = ${n(best.totalCost!, 8)}` },
      ...(reorder
        ? [{ label: 'Punto de reorden', value: `R = ${n(reorder.reorderPoint, 6)}` }]
        : []),
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'niveles',
        title: 'Candidatos por nivel de precio',
        columns: [
          { key: 'tier', header: '\\text{Nivel}' },
          { key: 'range', header: '\\text{Rango}', format: 'latex' },
          { key: 'price', header: 'c_j' },
          { key: 'holding', header: 'h_j' },
          { key: 'eoq', header: 'Q_j^*' },
          { key: 'quantity', header: 'Q_j' },
          { key: 'total', header: 'T_j' },
          { key: 'status', header: '\\text{Estado}', format: 'text' },
        ],
        rows: candidates.map((c) => ({
          tier: c.tier + 1,
          range: range(c),
          price: c.price,
          holding: c.holding,
          eoq: c.eoq,
          quantity: c.quantity,
          total: c.totalCost,
          status:
            c.quantity === null ? 'Descartado' : c.tier === best.tier ? 'Óptimo' : 'Candidato',
        })),
      },
    ],
    series: [series],
  };
}

export const discounts: Calculator<DiscountsInput, DiscountsValue, DiscountsErrorCode> = {
  meta: {
    id: 'descuentos-por-cantidad',
    title: 'EOQ con descuentos por cantidad',
    summary: 'Elige el tamaño de lote cuando el precio unitario baja con la cantidad.',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator:
          'Sec. 19.3, EOQ con descuentos por cantidad: bocinas para televisores, figura 19.3 (7.ª ed. en inglés)',
      },
      {
        sourceId: 'taha',
        locator: 'Ejemplo 12.3-2, aceite a granel de LubeCar (9.ª ed. en inglés)',
      },
      { sourceId: 'diaz-matalobos-1998' },
    ],
  },
  inputSchema: discountsInputSchema,
  // Hillier & Lieberman: bocinas a $11 (menos de 10,000), $10 (de 10,000 a 80,000) y $9.50 (más
  // de 80,000); 8,000 por mes, $12,000 por preparación y $0.30 por bocina y por mes.
  example: {
    demand: 8000,
    orderCost: 12000,
    holdingType: 'fijo',
    holding: 0.3,
    tiers: [
      { minQuantity: 0, unitPrice: 11 },
      { minQuantity: 10000, unitPrice: 10 },
      { minQuantity: 80000, unitPrice: 9.5 },
    ],
  },
  solve: solveDiscounts,
};
