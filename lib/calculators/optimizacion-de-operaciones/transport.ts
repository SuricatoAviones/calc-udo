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
      result: String.raw`\sum s_i = \sum d_j = ${total(b.supply).toLatex()}`,
    };
  }
  const extra = b.dummy === 'destino' ? b.demand.at(-1)! : b.supply.at(-1)!;
  return {
    title: 'Balancear el modelo',
    explanation:
      b.dummy === 'destino'
        ? `Sobran ${extra.toText()} unidades de oferta: se agrega un destino ficticio con esa demanda y costo 0 (lo que se «envía» ahí se queda en el origen).`
        : `Faltan ${extra.toText()} unidades de oferta: se agrega un origen ficticio con esa oferta y costo 0 (lo que «envía» es demanda que no se atiende).`,
    result: String.raw`\sum s_i = \sum d_j = ${total(b.supply).toLatex()}`,
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

type Cell = [number, number];

/** La celda de menor costo entre las candidatas (la primera, si hay empate). */
function cheapestCell(b: Balanced, candidates: Cell[]): Cell {
  const cost = (cell: Cell) => b.costs[cell[0]]![cell[1]]!;
  return candidates.reduce(
    (best, cell) => (cost(cell).lt(cost(best)) ? cell : best),
    candidates[0]!,
  );
}

/** Vogel: penalización = diferencia entre los dos menores costos de cada fila y columna. */
function vogelCell(b: Balanced, rows: Set<number>, cols: Set<number>): { cell: Cell; why: string } {
  const c = (i: number, j: number) => b.costs[i]![j]!;
  const penalty = (costs: Rational[]) => {
    const sorted = [...costs].sort((x, y) => x.cmp(y));
    return sorted.length > 1 ? sorted[1]!.sub(sorted[0]!) : sorted[0]!;
  };
  const rowPen = [...rows].map((i) => ({ i, p: penalty([...cols].map((j) => c(i, j))) }));
  const colPen = [...cols].map((j) => ({ j, p: penalty([...rows].map((i) => c(i, j))) }));
  const bestRow = rowPen.reduce((x, y) => (y.p.gt(x.p) ? y : x), rowPen[0]!);
  const bestCol = colPen.reduce((x, y) => (y.p.gt(x.p) ? y : x), colPen[0]!);
  const useRow = !bestCol.p.gt(bestRow.p);
  const cell = useRow
    ? cheapestCell(
        b,
        [...cols].map((j) => [bestRow.i, j] as Cell),
      )
    : cheapestCell(
        b,
        [...rows].map((i) => [i, bestCol.j] as Cell),
      );
  const rowList = rowPen.map((r) => `${b.rowNames[r.i]} = ${r.p.toText()}`).join(', ');
  const colList = colPen.map((q) => `${b.colNames[q.j]} = ${q.p.toText()}`).join(', ');
  const chosen = useRow ? b.rowNames[bestRow.i] : b.colNames[bestCol.j];
  const largest = (useRow ? bestRow.p : bestCol.p).toText();
  return {
    cell,
    why: `Penalizaciones de fila: ${rowList}. De columna: ${colList}. La mayor es la de ${chosen} (${largest}); ahí se asigna a la celda de menor costo (c = ${c(cell[0], cell[1]).toText()}).`,
  };
}

/** La celda que asigna el método y por qué. */
function chooseCell(
  b: Balanced,
  method: InitialMethod,
  rows: Set<number>,
  cols: Set<number>,
): { cell: Cell; why: string } {
  if (method === 'esquina-noroeste') {
    return {
      cell: [Math.min(...rows), Math.min(...cols)],
      why: 'Se toma la celda de la esquina superior izquierda (noroeste) de lo que no está tachado.',
    };
  }
  if (method === 'vogel' && rows.size > 1 && cols.size > 1) return vogelCell(b, rows, cols);
  const uncrossed = [...rows].flatMap((i) => [...cols].map((j) => [i, j] as Cell));
  const cell = cheapestCell(b, uncrossed);
  const cost = b.costs[cell[0]]![cell[1]]!.toText();
  if (method === 'costo-minimo') {
    return { cell, why: `Se toma la celda de menor costo no tachada (c = ${cost}).` };
  }
  const line = rows.size === 1 ? 'fila' : 'columna';
  return {
    cell,
    why: `Queda una sola ${line}: sus celdas se asignan por costo mínimo (c = ${cost}).`,
  };
}

/**
 * Tacha la fila o la columna que se agotó (solo una si se agotan las dos, salvo al final) y
 * devuelve la explicación.
 */
function crossOut(
  b: Balanced,
  lines: { rows: Set<number>; cols: Set<number> },
  [i, j]: Cell,
  done: { row: boolean; col: boolean },
): string {
  const { rows, cols } = lines;
  if (rows.size === 1 && cols.size === 1) {
    rows.delete(i);
    cols.delete(j);
    return 'Se tachan la última fila y la última columna.';
  }
  if (done.row && done.col && cols.size > 1) {
    cols.delete(j);
    return `Se satisfacen la fila y la columna a la vez: se tacha solo la columna ${b.colNames[j]}; ${b.rowNames[i]} queda con oferta 0.`;
  }
  if (done.row && done.col) {
    rows.delete(i);
    return `Se satisfacen la fila y la columna a la vez: se tacha solo la fila ${b.rowNames[i]}; ${b.colNames[j]} queda con demanda 0.`;
  }
  if (done.row) {
    rows.delete(i);
    return `Se tacha la fila ${b.rowNames[i]} (oferta agotada).`;
  }
  cols.delete(j);
  return `Se tacha la columna ${b.colNames[j]} (demanda satisfecha).`;
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

  while (rows.size > 0 && cols.size > 0) {
    const { cell, why } = chooseCell(b, method, rows, cols);
    const [i, j] = cell;
    const q = s[i]!.lt(d[j]!) ? s[i]! : d[j]!;
    allocation.set(cellKey(i, j), q);
    s[i] = s[i]!.sub(q);
    d[j] = d[j]!.sub(q);
    const crossed = crossOut(b, { rows, cols }, cell, { row: s[i]!.isZero(), col: d[j]!.isZero() });
    steps.push({
      title: `Asignar a (${b.rowNames[i]}, ${b.colNames[j]})`,
      explanation: `${why} ${crossed}`,
      substitution: String.raw`x_{${i + 1}${j + 1}} = \min\{${s[i]!.add(q).toLatex()},\ ${d[j]!.add(q).toLatex()}\}`,
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
      header: String.raw`\text{${name}}`,
      format: 'latex' as const,
    })),
    { key: 'supply', header: String.raw`\text{Oferta}`, format: 'latex' },
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
      const mark = sign ? String.raw`\ {\scriptstyle(${sign})}` : '';
      const enteringCell = extra?.entering;
      const entering = enteringCell?.[0] === i && enteringCell[1] === j;
      const theta = entering ? String.raw`\ \boxed{\theta}` : '';
      cells[`d${j}`] =
        q === undefined
          ? String.raw`{\scriptstyle ${cost.toLatex()}}${theta}${mark}`
          : String.raw`\mathbf{${q.toLatex()}}\ {\scriptstyle(${cost.toLatex()})}${mark}`;
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
