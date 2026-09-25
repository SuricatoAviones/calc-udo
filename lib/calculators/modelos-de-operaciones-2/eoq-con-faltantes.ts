/**
 * EOQ con faltantes planeados (Hillier & Lieberman, sec. 19.3 de la 7.ª ed.): la demanda que no
 * se atiende queda pendiente y se surte al llegar el siguiente lote, con un costo p por unidad
 * faltante y por unidad de tiempo.
 *
 *   T(Q, S) = KD/Q + hS²/(2Q) + p(Q − S)²/(2Q)
 *   Q* = √(2KD/h) √((p + h)/p),   S* = √(2KD/h) √(p/(p + h)),   t* = Q* / D
 *
 * S es el nivel máximo de inventario y Q − S el faltante máximo. Si p → ∞, se recupera el EOQ.
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult } from '../types';
import { costCurves, economicOrderQuantity, positiveField } from './inventory';

export const eoqShortagesInputSchema = z.object({
  demand: positiveField('la demanda D'),
  orderCost: positiveField('el costo de pedir K'),
  holdingCost: positiveField('el costo de mantener h'),
  shortageCost: positiveField('el costo por faltante p'),
});

export type EoqShortagesInput = z.infer<typeof eoqShortagesInputSchema>;

export interface EoqShortagesValue {
  quantity: number;
  maxInventory: number;
  maxShortage: number;
  cycle: number;
  /** Tiempo del ciclo con inventario y con faltantes. */
  timeWithStock: number;
  timeShort: number;
  orderingCost: number;
  holdingCost: number;
  shortageCost: number;
  totalCost: number;
  /** Q* del EOQ sin faltantes, para comparar. */
  classicQuantity: number;
}

export type EoqShortagesErrorCode = never;

const n = toLatexNumber;

export function solveEoqShortages(
  input: EoqShortagesInput,
): CalculatorResult<EoqShortagesValue, EoqShortagesErrorCode> {
  const { demand: D, orderCost: K, holdingCost: h, shortageCost: p } = input;
  const base = economicOrderQuantity(D, K, h);
  const Q = base * Math.sqrt((p + h) / p);
  const S = base * Math.sqrt(p / (p + h));
  const shortage = Q - S;
  const ordering = (K * D) / Q;
  const holding = (h * S * S) / (2 * Q);
  const shortageCost = (p * shortage * shortage) / (2 * Q);
  const total = ordering + holding + shortageCost;
  const cycle = Q / D;

  // Con el S óptimo para cada Q (S = Qp/(p + h)), para graficar T como función de Q.
  const ratio = p / (p + h);
  const curve = (q: number) => {
    const s = q * ratio;
    return {
      ordering: (K * D) / q,
      holding: (h * s * s) / (2 * q),
      shortage: (p * (q - s) ** 2) / (2 * q),
    };
  };

  return {
    ok: true,
    value: {
      quantity: Q,
      maxInventory: S,
      maxShortage: shortage,
      cycle,
      timeWithStock: S / D,
      timeShort: shortage / D,
      orderingCost: ordering,
      holdingCost: holding,
      shortageCost,
      totalCost: total,
      classicQuantity: base,
    },
    summary: [
      { label: 'Tamaño del lote', value: `Q^* = ${n(Q, 6)}`, emphasis: true },
      { label: 'Nivel máximo de inventario', value: `S^* = ${n(S, 6)}` },
      { label: 'Faltante máximo', value: `Q^* - S^* = ${n(shortage, 6)}` },
      { label: 'Duración del ciclo', value: `t^* = ${n(cycle, 6)}` },
      { label: 'Costo por unidad de tiempo', value: `T = ${n(total, 6)}` },
    ],
    ...emptyTrace(),
    steps: [
      {
        title: 'Costo por unidad de tiempo',
        explanation:
          'En cada ciclo el inventario sube hasta S y baja hasta −(Q − S): la parte positiva genera costo de mantener y la negativa, costo por faltante. Se deriva respecto de Q y de S y se iguala a cero.',
        formula: 'T(Q, S) = \\frac{KD}{Q} + \\frac{hS^2}{2Q} + \\frac{p\\,(Q - S)^2}{2Q}',
      },
      {
        title: 'Tamaño óptimo del lote',
        formula: 'Q^* = \\sqrt{\\frac{2KD}{h}}\\,\\sqrt{\\frac{p + h}{p}}',
        substitution: `Q^* = \\sqrt{\\frac{2(${n(K)})(${n(D)})}{${n(h)}}}\\,\\sqrt{\\frac{${n(p)} + ${n(h)}}{${n(p)}}} = ${n(base, 6)}\\,(${n(Math.sqrt((p + h) / p), 6)})`,
        result: `Q^* = ${n(Q, 6)}`,
      },
      {
        title: 'Nivel máximo de inventario',
        formula: 'S^* = \\sqrt{\\frac{2KD}{h}}\\,\\sqrt{\\frac{p}{p + h}}',
        substitution: `S^* = ${n(base, 6)}\\,\\sqrt{\\frac{${n(p)}}{${n(p)} + ${n(h)}}} = ${n(base, 6)}\\,(${n(Math.sqrt(ratio), 6)})`,
        result: `S^* = ${n(S, 6)}`,
      },
      {
        title: 'Faltante máximo y duración del ciclo',
        formula:
          'Q^* - S^*, \\qquad t^* = \\frac{Q^*}{D}, \\qquad t_1 = \\frac{S^*}{D}, \\qquad t_2 = \\frac{Q^* - S^*}{D}',
        substitution: `Q^* - S^* = ${n(Q, 6)} - ${n(S, 6)}, \\qquad t^* = \\frac{${n(Q, 6)}}{${n(D)}}`,
        result: `Q^* - S^* = ${n(shortage, 6)}, \\qquad t^* = ${n(cycle, 6)} \\quad (t_1 = ${n(S / D, 6)},\\ t_2 = ${n(shortage / D, 6)})`,
      },
      {
        title: 'Costos en el óptimo',
        substitution: `\\frac{KD}{Q^*} = ${n(ordering, 6)}, \\qquad \\frac{hS^{*2}}{2Q^*} = ${n(holding, 6)}, \\qquad \\frac{p\\,(Q^* - S^*)^2}{2Q^*} = ${n(shortageCost, 6)}`,
        result: `T(Q^*, S^*) = ${n(total, 6)}`,
      },
      {
        title: 'Comparación con el EOQ sin faltantes',
        explanation:
          'Sin faltantes el lote sería menor. Permitir faltantes conviene cuando p no es mucho mayor que h; si p es muy grande, Q* se acerca al EOQ clásico.',
        formula: 'Q_{\\text{EOQ}} = \\sqrt{\\frac{2KD}{h}}, \\qquad T_{\\text{EOQ}} = \\sqrt{2KDh}',
        result: `Q_{\\text{EOQ}} = ${n(base, 6)}, \\qquad T_{\\text{EOQ}} = ${n(Math.sqrt(2 * K * D * h), 6)}`,
      },
    ],
    series: [
      costCurves({
        optimum: Q,
        total: (q) => {
          const c = curve(q);
          return c.ordering + c.holding + c.shortage;
        },
        components: [
          { label: 'Costo de pedir', f: (q) => curve(q).ordering },
          { label: 'Costo de mantener', f: (q) => curve(q).holding },
          { label: 'Costo por faltantes', f: (q) => curve(q).shortage },
        ],
      }),
    ],
  };
}

export const eoqShortages: Calculator<EoqShortagesInput, EoqShortagesValue, EoqShortagesErrorCode> =
  {
    meta: {
      id: 'eoq-con-faltantes',
      title: 'EOQ con faltantes planeados',
      summary: 'Tamaño de lote y faltante máximo cuando se permiten pedidos pendientes.',
      citations: [
        {
          sourceId: 'hillier-lieberman-2002',
          locator:
            'Sec. 19.3, EOQ con faltantes planeados: ejemplo de las bocinas para televisores (7.ª ed. en inglés)',
        },
        { sourceId: 'taha' },
        { sourceId: 'diaz-matalobos-1998' },
      ],
    },
    inputSchema: eoqShortagesInputSchema,
    // Hillier & Lieberman: 8,000 bocinas por mes, $12,000 por preparación, $0.30 por bocina y por
    // mes en inventario y $1.10 por bocina faltante y por mes.
    example: { demand: 8000, orderCost: 12000, holdingCost: 0.3, shortageCost: 1.1 },
    solve: solveEoqShortages,
  };
