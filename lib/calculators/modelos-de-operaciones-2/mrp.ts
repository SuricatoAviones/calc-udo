/**
 * Planeación de requerimientos de materiales, MRP (Chase, Jacobs y Aquilano, cap. 18 de la 12.ª ed.
 * en español). A partir del programa maestro (necesidades de los productos finales por periodo),
 * la lista de materiales y los registros de inventario, se calcula para cada pieza, nivel por
 * nivel («explosión»):
 *
 *   saldo disponible proyectado_t = saldo_{t−1} + entradas programadas_t − necesidades brutas_t
 *                                   (+ entradas de pedidos planeados_t)
 *
 * El saldo inicial es la existencia menos el inventario de seguridad. Si el saldo quedaría
 * negativo, la diferencia es la necesidad neta y se planea la entrada de un pedido: la cantidad
 * exacta (lote por lote) o un múltiplo de la cantidad fija de pedido. Su expedición (liberación)
 * se adelanta el tiempo de entrega. Las expediciones de una pieza, por la cantidad por unidad de
 * la lista de materiales, son necesidades brutas de sus componentes en el mismo periodo.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexText } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type ResultTable,
  type Step,
} from '../types';

const MAX_PERIODS = 24;

const code = z
  .string({ error: 'Escribe el código de la pieza.' })
  .trim()
  .min(1, 'Escribe el código de la pieza.')
  .max(16, 'Usa un código de hasta 16 caracteres.');

const quantityField = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine((v) => Number.isFinite(v) && v >= 0, `${label} no puede ser negativo.`);

const periodField = z
  .number({ error: 'Ingresa el periodo.' })
  .int('El periodo debe ser un número entero.')
  .min(1, 'Los periodos empiezan en 1.');

export const mrpInputSchema = z
  .object({
    periods: z
      .number({ error: 'Ingresa el número de periodos.' })
      .int('El número de periodos debe ser entero.')
      .min(1, 'Al menos 1 periodo.')
      .max(MAX_PERIODS, `El máximo es ${MAX_PERIODS} periodos.`),
    items: z
      .array(
        z.object({
          code,
          leadTime: z
            .number({ error: 'Ingresa el tiempo de entrega.' })
            .int('El tiempo de entrega debe ser un número entero de periodos.')
            .min(0, 'El tiempo de entrega no puede ser negativo.'),
          onHand: quantityField('la existencia'),
          safetyStock: quantityField('el inventario de seguridad').optional(),
          lotSize: quantityField('la cantidad de pedido').optional(),
        }),
      )
      .min(1, 'Agrega al menos una pieza.')
      .max(20, 'El máximo es 20 piezas.'),
    bom: z
      .array(
        z.object({
          parent: code,
          child: code,
          quantity: z
            .number({ error: 'Ingresa la cantidad por unidad.' })
            .refine(
              (v) => Number.isFinite(v) && v > 0,
              'La cantidad por unidad debe ser mayor que 0.',
            ),
        }),
      )
      .max(60, 'El máximo es 60 relaciones.'),
    demand: z
      .array(z.object({ item: code, period: periodField, quantity: quantityField('la cantidad') }))
      .min(1, 'Indica al menos una necesidad del programa maestro.')
      .max(100, 'El máximo es 100 necesidades.'),
    receipts: z
      .array(z.object({ item: code, period: periodField, quantity: quantityField('la cantidad') }))
      .max(60, 'El máximo es 60 entradas programadas.'),
  })
  .superRefine((v, ctx) => {
    const codes = v.items.map((i) => i.code.toUpperCase());
    const duplicate = codes.find((c, k) => codes.indexOf(c) !== k);
    if (duplicate) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: `La pieza «${duplicate}» está repetida.`,
      });
      return;
    }
    const known = (name: string) => codes.includes(name.toUpperCase());
    v.bom.forEach((b, k) => {
      for (const field of ['parent', 'child'] as const) {
        if (!known(b[field])) {
          ctx.addIssue({
            code: 'custom',
            path: ['bom', k, field],
            message: `«${b[field]}» no está en la lista de piezas.`,
          });
        }
      }
      if (b.parent.toUpperCase() === b.child.toUpperCase()) {
        ctx.addIssue({
          code: 'custom',
          path: ['bom', k, 'child'],
          message: 'Una pieza no puede contenerse a sí misma.',
        });
      }
    });
    for (const list of ['demand', 'receipts'] as const) {
      v[list].forEach((d, k) => {
        if (!known(d.item)) {
          ctx.addIssue({
            code: 'custom',
            path: [list, k, 'item'],
            message: `«${d.item}» no está en la lista de piezas.`,
          });
        }
        if (d.period > v.periods) {
          ctx.addIssue({
            code: 'custom',
            path: [list, k, 'period'],
            message: `El horizonte tiene ${v.periods} periodos.`,
          });
        }
      });
    }
  });

export type MrpInput = z.infer<typeof mrpInputSchema>;

export interface MrpRecord {
  item: string;
  level: number;
  gross: number[];
  scheduled: number[];
  projected: number[];
  net: number[];
  plannedReceipts: number[];
  plannedReleases: number[];
  /** Expediciones que caen antes del periodo 1 (pedidos atrasados). */
  pastDue: { period: number; quantity: number }[];
}

export interface MrpValue {
  records: MrpRecord[];
}

export type MrpErrorCode = 'cycle';

type Result = CalculatorResult<MrpValue, MrpErrorCode>;

const n = toLatexNumber;

export function solveMrp(input: MrpInput): Result {
  const T = input.periods;
  const keyOf = (name: string) => name.trim().toUpperCase();
  const items = input.items;
  const byKey = new Map(items.map((i) => [keyOf(i.code), i]));

  // Niveles (código de nivel más bajo): un componente va por debajo de todos sus padres.
  const level = new Map(items.map((i) => [keyOf(i.code), 0]));
  for (let pass = 0; pass <= items.length; pass++) {
    let changed = false;
    for (const b of input.bom) {
      const next = level.get(keyOf(b.parent))! + 1;
      if (next > level.get(keyOf(b.child))!) {
        level.set(keyOf(b.child), next);
        changed = true;
      }
    }
    if (!changed) break;
    if (pass === items.length) {
      return {
        ok: false,
        error: {
          code: 'cycle',
          message:
            'La lista de materiales tiene un ciclo: una pieza termina conteniéndose a sí misma.',
        },
        ...emptyTrace(),
      };
    }
  }
  const order = [...items].sort((a, b) => level.get(keyOf(a.code))! - level.get(keyOf(b.code))!);

  const zeros = () => new Array<number>(T + 1).fill(0);
  const gross = new Map(items.map((i) => [keyOf(i.code), zeros()]));
  const independent = new Map(items.map((i) => [keyOf(i.code), zeros()]));
  for (const d of input.demand) {
    gross.get(keyOf(d.item))![d.period]! += d.quantity;
    independent.get(keyOf(d.item))![d.period]! += d.quantity;
  }

  const records: MrpRecord[] = [];
  const steps: Step[] = [
    {
      title: 'Niveles de la lista de materiales',
      explanation:
        'Se calcula cada pieza después de todas las que la contienen, para conocer antes sus necesidades brutas (explosión nivel por nivel).',
      substitution: order
        .map((i) => `${toLatexText(i.code)}: \\text{nivel } ${level.get(keyOf(i.code))}`)
        .join(',\\ '),
    },
  ];
  const notices: Result['notices'] = [];

  for (const item of order) {
    const key = keyOf(item.code);
    const g = gross.get(key)!;
    const scheduled = zeros();
    for (const r of input.receipts) if (keyOf(r.item) === key) scheduled[r.period]! += r.quantity;
    const safety = item.safetyStock ?? 0;
    const lot = item.lotSize ?? 0;
    const projected = zeros();
    const net = zeros();
    const plannedReceipts = zeros();
    const plannedReleases = zeros();
    const pastDue: MrpRecord['pastDue'] = [];
    let balance = item.onHand - safety;
    const lines: string[] = [];
    for (let t = 1; t <= T; t++) {
      const previous = balance;
      const available = previous + scheduled[t]! - g[t]!;
      if (available < -1e-9) {
        net[t] = -available;
        const quantity = lot > 0 ? Math.ceil(net[t]! / lot - 1e-9) * lot : net[t]!;
        plannedReceipts[t] = quantity;
        balance = available + quantity;
        const release = t - item.leadTime;
        if (release >= 1) plannedReleases[release]! += quantity;
        else pastDue.push({ period: release, quantity });
        lines.push(
          `t = ${t}:\\ ${n(previous)} + ${n(scheduled[t]!)} - ${n(g[t]!)} = ${n(available)} \\Rightarrow \\text{neta } ${n(net[t]!)},\\ \\text{entrada planeada } ${n(quantity)},\\ \\text{saldo } ${n(balance)},\\ \\text{expedición en } t = ${release}`,
        );
      } else {
        balance = available;
      }
      projected[t] = balance;
    }
    // Las expediciones de la pieza son necesidades brutas de sus componentes.
    for (const b of input.bom) {
      if (keyOf(b.parent) !== key) continue;
      const child = gross.get(keyOf(b.child))!;
      for (let t = 1; t <= T; t++) child[t]! += plannedReleases[t]! * b.quantity;
    }
    const parents = input.bom.filter((b) => keyOf(b.child) === key);
    const ownDemand = independent.get(key)!.some((v) => v > 0);
    steps.push({
      title: `Pieza ${item.code} (nivel ${level.get(key)})`,
      explanation: `${
        parents.length > 0
          ? `Necesidades brutas: expediciones de ${parents.map((p) => `${p.parent} × ${formatNumber(p.quantity)}`).join(', ')}${ownDemand ? ' más la demanda independiente' : ''}.`
          : 'Necesidades brutas: las del programa maestro.'
      } Saldo inicial = ${formatNumber(item.onHand)} − ${formatNumber(safety)} (inventario de seguridad). ${
        lot > 0
          ? `Se pide en múltiplos de ${formatNumber(lot)}.`
          : 'Lote por lote: se pide exactamente la necesidad neta.'
      } Tiempo de entrega: ${item.leadTime}.`,
      formula:
        '\\text{Saldo}_t = \\text{saldo}_{t-1} + \\text{entradas programadas}_t - \\text{necesidades brutas}_t',
      substitution:
        lines.length > 0
          ? lines.join(' \\\\ ')
          : '\\text{No hay necesidades netas en el horizonte}',
    });
    for (const p of pastDue) {
      notices.push({
        level: 'warning',
        message: `El pedido de ${formatNumber(p.quantity)} de ${item.code} tendría que haberse expedido en el periodo ${p.period}: está atrasado.`,
      });
    }
    records.push({
      item: item.code,
      level: level.get(key)!,
      gross: g.slice(1),
      scheduled: scheduled.slice(1),
      projected: projected.slice(1),
      net: net.slice(1),
      plannedReceipts: plannedReceipts.slice(1),
      plannedReleases: plannedReleases.slice(1),
      pastDue,
    });
  }

  const periodColumns = Array.from({ length: T }, (_, t) => ({
    key: `t${t + 1}`,
    header: String(t + 1),
  }));
  const rowOf = (
    label: string,
    values: number[],
    blankZeros: boolean,
  ): Record<string, CellValue> => ({
    concept: label,
    ...Object.fromEntries(
      values.map((v, t) => [`t${t + 1}`, blankZeros && Math.abs(v) < 1e-12 ? null : v]),
    ),
  });
  const tables: ResultTable[] = records.map((r) => {
    const item = byKey.get(keyOf(r.item))!;
    return {
      id: `mrp-${r.item}`,
      title: `${r.item}: TE = ${item.leadTime}, existencia = ${formatNumber(item.onHand)}, IS = ${formatNumber(item.safetyStock ?? 0)}, ${item.lotSize ? `lote = ${formatNumber(item.lotSize)}` : 'lote por lote'}`,
      columns: [
        { key: 'concept', header: '\\text{Periodo}', format: 'text' as const },
        ...periodColumns,
      ],
      rows: [
        rowOf('Necesidades brutas', r.gross, true),
        rowOf('Entradas programadas', r.scheduled, true),
        rowOf('Saldo disponible proyectado', r.projected, false),
        rowOf('Necesidades netas', r.net, true),
        rowOf('Entradas de pedidos planeados', r.plannedReceipts, true),
        rowOf('Expedición de pedidos planeados', r.plannedReleases, true),
      ],
    };
  });

  const releases = records.flatMap((r) =>
    r.plannedReleases.flatMap((q, t) =>
      q > 0 ? [`${r.item}: ${formatNumber(q)} en ${t + 1}`] : [],
    ),
  );

  return {
    ok: true,
    value: { records },
    summary: [
      {
        label: 'Pedidos a expedir',
        value:
          releases.length > 0
            ? `\\text{${releases.slice(0, 6).join('; ')}${releases.length > 6 ? '; …' : ''}}`
            : '\\text{ninguno}',
        emphasis: true,
      },
      { label: 'Piezas', value: `${records.length}` },
    ],
    ...emptyTrace(),
    steps,
    tables,
    notices,
  };
}

export const mrp: Calculator<MrpInput, MrpValue, MrpErrorCode> = {
  meta: {
    id: 'mrp',
    title: 'Planeación de requerimientos de materiales (MRP)',
    summary: 'Necesidades netas y pedidos planeados de cada pieza a partir del programa maestro.',
    citations: [
      {
        sourceId: 'aquilano-1994',
        locator:
          'Chase, Jacobs y Aquilano, cap. 18, ilustraciones 18.10 a 18.14 (12.ª ed. en español; 21.12 de la 15.ª)',
      },
      { sourceId: 'diaz-matalobos-1998' },
    ],
  },
  inputSchema: mrpInputSchema,
  // Chase, Jacobs y Aquilano, medidores A y B: el subensamble C (1 por medidor) lleva 2
  // transformadores D, y el medidor A lleva además un D.
  example: {
    periods: 9,
    items: [
      { code: 'A', leadTime: 2, onHand: 50, safetyStock: 0 },
      { code: 'B', leadTime: 2, onHand: 60, safetyStock: 0 },
      { code: 'C', leadTime: 1, onHand: 40, safetyStock: 5, lotSize: 2000 },
      { code: 'D', leadTime: 1, onHand: 200, safetyStock: 20, lotSize: 5000 },
    ],
    bom: [
      { parent: 'A', child: 'C', quantity: 1 },
      { parent: 'A', child: 'D', quantity: 1 },
      { parent: 'B', child: 'C', quantity: 1 },
      { parent: 'C', child: 'D', quantity: 2 },
    ],
    demand: [
      { item: 'A', period: 9, quantity: 1250 },
      { item: 'B', period: 9, quantity: 470 },
      { item: 'D', period: 9, quantity: 270 },
    ],
    receipts: [
      { item: 'B', period: 5, quantity: 10 },
      { item: 'D', period: 4, quantity: 100 },
    ],
  },
  solve: solveMrp,
};
