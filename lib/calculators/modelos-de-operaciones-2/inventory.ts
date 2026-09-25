/**
 * Piezas comunes de los modelos de inventario (Taha, cap. de modelos determinísticos de
 * inventario; Hillier & Lieberman, cap. 19 de la 7.ª ed.): campos de entrada, el punto de
 * reorden con tiempo de entrega efectivo y las curvas de costo.
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import type { Series, Step } from '../types';

export const positiveField = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`)
    .refine((v) => v > 0, `${label} debe ser mayor que 0.`);

export const nonNegativeField = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`)
    .refine((v) => v >= 0, `${label} no puede ser negativo.`);

/** Q* = √(2KD/h): cantidad económica de pedido. */
export function economicOrderQuantity(demand: number, orderCost: number, holding: number) {
  return Math.sqrt((2 * orderCost * demand) / holding);
}

const n = toLatexNumber;

export interface ReorderPoint {
  cycle: number;
  /** Ciclos completos que caben en el tiempo de entrega. */
  fullCycles: number;
  effectiveLeadTime: number;
  reorderPoint: number;
}

/**
 * Punto de reorden con demanda constante (Taha): si el tiempo de entrega L es mayor que la
 * duración del ciclo t₀, el pedido se hace ⌊L/t₀⌋ ciclos antes y el punto de reorden usa el
 * tiempo de entrega efectivo L_e = L − ⌊L/t₀⌋ t₀.
 */
export function reorderPoint(demand: number, quantity: number, leadTime: number): ReorderPoint {
  const cycle = quantity / demand;
  // Un pequeño margen evita que un cociente exacto (L = 2t₀) se trunque a 1 por redondeo.
  const fullCycles = Math.floor(leadTime / cycle + 1e-9);
  const effectiveLeadTime = Math.max(0, leadTime - fullCycles * cycle);
  return { cycle, fullCycles, effectiveLeadTime, reorderPoint: effectiveLeadTime * demand };
}

export function reorderStep(demand: number, leadTime: number, r: ReorderPoint): Step {
  const shifted = r.fullCycles > 0;
  return {
    title: 'Punto de reorden',
    explanation: shifted
      ? `El tiempo de entrega (L = ${leadTime}) es mayor que un ciclo, así que cada pedido se hace ${r.fullCycles} ${r.fullCycles === 1 ? 'ciclo' : 'ciclos'} antes. Lo que importa para el punto de reorden es el tiempo de entrega efectivo.`
      : 'Se pide cuando el inventario alcanza lo que se consume durante el tiempo de entrega.',
    formula: shifted
      ? 'L_e = L - \\left\\lfloor \\frac{L}{t_0} \\right\\rfloor t_0, \\qquad R = L_e\\,D'
      : 'R = L\\,D',
    substitution: shifted
      ? `L_e = ${n(leadTime)} - ${r.fullCycles}(${n(r.cycle, 6)}) = ${n(r.effectiveLeadTime, 6)}, \\qquad R = ${n(r.effectiveLeadTime, 6)}(${n(demand)})`
      : `R = ${n(leadTime)}(${n(demand)})`,
    result: `R = ${n(r.reorderPoint, 6)}`,
  };
}

/** Puntos para graficar una función de costo en [from, to]. */
export function sample(
  from: number,
  to: number,
  f: (q: number) => number,
  count = 80,
): { x: number; y: number }[] {
  return Array.from({ length: count + 1 }, (_, k) => {
    const x = from + ((to - from) * k) / count;
    return { x, y: f(x) };
  });
}

/** Curva del costo total con sus componentes, para el comportamiento gráfico de los costos. */
export function costCurves(options: {
  optimum: number;
  total: (q: number) => number;
  components: { label: string; f: (q: number) => number }[];
  xLabel?: string;
}): Series {
  const { optimum, total, components } = options;
  const from = optimum * 0.25;
  const to = optimum * 2.5;
  return {
    id: 'costos',
    title: 'Costos por unidad de tiempo según el tamaño del lote',
    xLabel: options.xLabel ?? 'Q',
    yLabel: 'Costo',
    label: 'Costo total',
    points: sample(from, to, total),
    others: components.map((c) => ({ label: c.label, points: sample(from, to, c.f) })),
  };
}
