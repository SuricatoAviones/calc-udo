/**
 * Modelo de transporte (Taha, cap. 5): m orígenes con oferta sᵢ, n destinos con demanda dⱼ y costo
 * cᵢⱼ por unidad enviada. Si la oferta total no es igual a la demanda total se agrega un origen o
 * un destino ficticio con costo 0.
 *
 * Soluciones iniciales (sec. 5.3.1): esquina noroeste, costo mínimo y aproximación de Vogel.
 * Todas asignan una celda a la vez y tachan la fila o la columna que se satisface; si se
 * satisfacen las dos a la vez, se tacha solo una (la otra queda con 0 y dará una básica en 0),
 * así la solución tiene siempre m + n − 1 variables básicas.
 */
import { z } from 'zod';
import { Rational } from '@/lib/math/rational';
import type { ResultTable, Step } from '../types';

export const MAX_SIDE = 8;

const quantity = (label: string) =>
  z
    .number({ error: `Completa ${label}.` })
    .refine(
      (v) => Number.isFinite(v) && v >= 0,
      `${label[0]!.toUpperCase()}${label.slice(1)} no puede ser negativa.`,
    );

export const transportShape = {
  costs: z
    .array(
      z.array(
        z
          .number({ error: 'Completa todos los costos.' })
          .refine(Number.isFinite, 'Los costos deben ser números finitos.'),
      ),
    )
    .min(1, 'Agrega al menos un origen.')
    .max(MAX_SIDE, `El máximo es ${MAX_SIDE} orígenes.`),
  supply: z.array(quantity('la oferta')),
  demand: z.array(quantity('la demanda')),
};

export interface TransportData {
  costs: number[][];
  supply: number[];
  demand: number[];
}

export function refineTransport(v: TransportData, ctx: z.RefinementCtx) {
  const m = v.costs.length;
  const n = v.costs[0]?.length ?? 0;
  if (n < 1 || n > MAX_SIDE || v.costs.some((row) => row.length !== n)) {
    ctx.addIssue({
      code: 'custom',
      path: ['costs'],
      message: 'La matriz de costos no es rectangular.',
    });
  }
  if (v.supply.length !== m) {
    ctx.addIssue({ code: 'custom', path: ['supply'], message: 'Indica la oferta de cada origen.' });
  }
  if (v.demand.length !== n) {
    ctx.addIssue({
      code: 'custom',
      path: ['demand'],
      message: 'Indica la demanda de cada destino.',
    });
  }
  const total = (xs: number[]) => xs.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
  if (total(v.supply) <= 0 || total(v.demand) <= 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['supply'],
      message: 'La oferta y la demanda totales deben ser positivas.',
    });
  }
}

export interface Balanced {
  costs: Rational[][];
  supply: Rational[];
  demand: Rational[];
  rowNames: string[];
  colNames: string[];
  /** 'origen' o 'destino' si se agregó uno ficticio. */
  dummy: 'origen' | 'destino' | null;
}

export function balance(data: TransportData): Balanced {
  const costs = data.costs.map((row) => row.map(Rational.fromNumber));
  const supply = data.supply.map(Rational.fromNumber);
  const demand = data.demand.map(Rational.fromNumber);
  const rowNames = supply.map((_, i) => `O${i + 1}`);
  const colNames = demand.map((_, j) => `D${j + 1}`);
  const sum = (xs: Rational[]) => xs.reduce((s, x) => s.add(x), Rational.ZERO);
  const diff = sum(supply).sub(sum(demand));
  if (diff.sign() > 0) {
    costs.forEach((row) => row.push(Rational.ZERO));
    demand.push(diff);
    colNames.push('Ficticio');
    return { costs, supply, demand, rowNames, colNames, dummy: 'destino' };
  }
  if (diff.sign() < 0) {
    costs.push(demand.map(() => Rational.ZERO));
    supply.push(diff.neg());
    rowNames.push('Ficticio');
    return { costs, supply, demand, rowNames, colNames, dummy: 'origen' };
  }
  return { costs, supply, demand, rowNames, colNames, dummy: null };
}

export function balanceStep(b: Balanced): Step {
  const total = (xs: Rational[]) => xs.reduce((s, x) => s.add(x), Rational.ZERO);
  if (!b.dummy) {
    return {
      title: 'Modelo balanceado',
      explanation:
        'La oferta total es igual a la demanda total, así que el modelo se puede resolver directamente.',
      result: `\\sum s_i = \\sum d_j = ${total(b.supply).toLatex()}`,
    };
  }
  const extra = b.dummy === 'destino' ? b.demand.at(-1)! : b.supply.at(-1)!;
  return {
    title: 'Balancear el modelo',
    explanation:
      b.dummy === 'destino'
        ? `Sobran ${extra.toText()} unidades de oferta: se agrega un destino ficticio con esa demanda y costo 0 (lo que se «envía» ahí se queda en el origen).`
        : `Faltan ${extra.toText()} unidades de oferta: se agrega un origen ficticio con esa oferta y costo 0 (lo que «envía» es demanda que no se atiende).`,
    result: `\\sum s_i = \\sum d_j = ${total(b.supply).toLatex()}`,
  };
}

/** Asignación: celdas básicas con su cantidad (puede ser 0). */
export type Allocation = Map<string, Rational>;
export const cellKey = (i: number, j: number) => `${i},${j}`;
export const parseKey = (k: string) => k.split(',').map(Number) as [number, number];

export function totalCost(b: Balanced, allocation: Allocation): Rational {
  let total = Rational.ZERO;
  for (const [k, q] of allocation) {
    const [i, j] = parseKey(k);
    total = total.add(b.costs[i]![j]!.mul(q));
  }
  return total;
}

export type InitialMethod = 'esquina-noroeste' | 'costo-minimo' | 'vogel';

export interface InitialSolution {
  allocation: Allocation;
  /** Orden de las asignaciones, con su explicación. */
  steps: Step[];
}

/** Soluciones iniciales. Cada iteración asigna una celda y tacha una fila o columna. */
export function initialSolution(b: Balanced, method: InitialMethod): InitialSolution {
  const m = b.supply.length;
  const n = b.demand.length;
  const s = [...b.supply];
  const d = [...b.demand];
  const rows = new Set(Array.from({ length: m }, (_, i) => i));
  const cols = new Set(Array.from({ length: n }, (_, j) => j));
  const allocation: Allocation = new Map();
  const steps: Step[] = [];
  const c = (i: number, j: number) => b.costs[i]![j]!;

  const cheapest = (candidates: [number, number][]) =>
    candidates.reduce((best, cell) => (c(cell[0], cell[1]).lt(c(best[0], best[1])) ? cell : best));
  const uncrossed = () =>
    [...rows].flatMap((i) => [...cols].map((j) => [i, j] as [number, number]));

  while (rows.size > 0 && cols.size > 0) {
    let cell: [number, number];
    let why: string;
    if (method === 'esquina-noroeste') {
      cell = [Math.min(...rows), Math.min(...cols)];
      why =
        'Se toma la celda de la esquina superior izquierda (noroeste) de lo que no está tachado.';
    } else if (method === 'costo-minimo' || rows.size === 1 || cols.size === 1) {
      cell = cheapest(uncrossed());
      why =
        method === 'costo-minimo'
          ? `Se toma la celda de menor costo no tachada (c = ${c(cell[0], cell[1]).toText()}).`
          : `Queda una sola ${rows.size === 1 ? 'fila' : 'columna'}: sus celdas se asignan por costo mínimo (c = ${c(cell[0], cell[1]).toText()}).`;
    } else {
      // Vogel: penalización = diferencia entre los dos menores costos de cada fila y columna.
      const penalty = (costs: Rational[]) => {
        const sorted = [...costs].sort((x, y) => x.cmp(y));
        return sorted.length > 1 ? sorted[1]!.sub(sorted[0]!) : sorted[0]!;
      };
      const rowPen = [...rows].map((i) => ({ i, p: penalty([...cols].map((j) => c(i, j))) }));
      const colPen = [...cols].map((j) => ({ j, p: penalty([...rows].map((i) => c(i, j))) }));
      const bestRow = rowPen.reduce((x, y) => (y.p.gt(x.p) ? y : x));
      const bestCol = colPen.reduce((x, y) => (y.p.gt(x.p) ? y : x));
      const useRow = !bestCol.p.gt(bestRow.p);
      cell = useRow
        ? cheapest([...cols].map((j) => [bestRow.i, j] as [number, number]))
        : cheapest([...rows].map((i) => [i, bestCol.j] as [number, number]));
      const penalties = `Penalizaciones de fila: ${rowPen.map((r) => `${b.rowNames[r.i]} = ${r.p.toText()}`).join(', ')}. De columna: ${colPen.map((q) => `${b.colNames[q.j]} = ${q.p.toText()}`).join(', ')}.`;
      why = `${penalties} La mayor es ${useRow ? `la de ${b.rowNames[bestRow.i]}` : `la de ${b.colNames[bestCol.j]}`} (${(useRow ? bestRow.p : bestCol.p).toText()}); ahí se asigna a la celda de menor costo (c = ${c(cell[0], cell[1]).toText()}).`;
    }
    const [i, j] = cell;
    const q = s[i]!.lt(d[j]!) ? s[i]! : d[j]!;
    allocation.set(cellKey(i, j), q);
    s[i] = s[i]!.sub(q);
    d[j] = d[j]!.sub(q);
    let crossed: string;
    if (rows.size === 1 && cols.size === 1) {
      rows.delete(i);
      cols.delete(j);
      crossed = 'Se tachan la última fila y la última columna.';
    } else if (s[i]!.isZero() && d[j]!.isZero()) {
      if (cols.size > 1) {
        cols.delete(j);
        crossed = `Se satisfacen la fila y la columna a la vez: se tacha solo la columna ${b.colNames[j]}; ${b.rowNames[i]} queda con oferta 0.`;
      } else {
        rows.delete(i);
        crossed = `Se satisfacen la fila y la columna a la vez: se tacha solo la fila ${b.rowNames[i]}; ${b.colNames[j]} queda con demanda 0.`;
      }
    } else if (s[i]!.isZero()) {
      rows.delete(i);
      crossed = `Se tacha la fila ${b.rowNames[i]} (oferta agotada).`;
    } else {
      cols.delete(j);
      crossed = `Se tacha la columna ${b.colNames[j]} (demanda satisfecha).`;
    }
    steps.push({
      title: `Asignar a (${b.rowNames[i]}, ${b.colNames[j]})`,
      explanation: `${why} ${crossed}`,
      substitution: `x_{${i + 1}${j + 1}} = \\min\\{${s[i]!.add(q).toLatex()},\\ ${d[j]!.add(q).toLatex()}\\}`,
      result: `x_{${i + 1}${j + 1}} = ${q.toLatex()}`,
    });
  }
  return { allocation, steps };
}

/** Tabla de transporte con costos, asignaciones, ofertas y demandas. */
export function allocationTable(
  b: Balanced,
  allocation: Allocation,
  id: string,
  title: string,
  extra?: {
    u?: Rational[];
    v?: Rational[];
    entering?: [number, number];
    loop?: Map<string, '+' | '-'>;
  },
): ResultTable {
  const columns: ResultTable['columns'] = [
    { key: 'origin', header: '', format: 'text' },
    ...b.colNames.map((name, j) => ({
      key: `d${j}`,
      header: `\\text{${name}}`,
      format: 'latex' as const,
    })),
    { key: 'supply', header: '\\text{Oferta}', format: 'latex' },
  ];
  if (extra?.u) columns.push({ key: 'u', header: 'u_i', format: 'latex' });
  const rows = b.costs.map((row, i) => {
    const cells: Record<string, string | null> = {
      origin: b.rowNames[i]!,
      supply: b.supply[i]!.toLatex(),
    };
    row.forEach((cost, j) => {
      const q = allocation.get(cellKey(i, j));
      const sign = extra?.loop?.get(cellKey(i, j));
      const mark = sign ? `\\ {\\scriptstyle(${sign})}` : '';
      const entering = extra?.entering && extra.entering[0] === i && extra.entering[1] === j;
      cells[`d${j}`] =
        q === undefined
          ? `{\\scriptstyle ${cost.toLatex()}}${entering ? '\\ \\boxed{\\theta}' : ''}${mark}`
          : `\\mathbf{${q.toLatex()}}\\ {\\scriptstyle(${cost.toLatex()})}${mark}`;
    });
    if (extra?.u) cells.u = extra.u[i]!.toLatex();
    return cells;
  });
  const demandRow: Record<string, string | null> = { origin: 'Demanda', supply: null };
  b.demand.forEach((q, j) => {
    demandRow[`d${j}`] = q.toLatex();
  });
  const result = [...rows, demandRow];
  if (extra?.v) {
    const vRow: Record<string, string | null> = { origin: 'vⱼ', supply: null };
    extra.v.forEach((v, j) => {
      vRow[`d${j}`] = v.toLatex();
    });
    result.push(vRow);
  }
  return { id, title, columns, rows: result };
}

/** Costo total en LaTeX: Σ cᵢⱼ xᵢⱼ con los términos de las celdas asignadas. */
export function costLatex(b: Balanced, allocation: Allocation): string {
  const terms = [...allocation.entries()]
    .filter(([, q]) => !q.isZero())
    .map(([k, q]) => {
      const [i, j] = parseKey(k);
      return `${b.costs[i]![j]!.toLatex()}(${q.toLatex()})`;
    });
  return `${terms.join(' + ')} = ${totalCost(b, allocation).toLatex()}`;
}
