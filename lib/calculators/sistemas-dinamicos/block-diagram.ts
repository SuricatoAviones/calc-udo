/**
 * Diagramas de bloques dibujados en el constructor: modelo, geometría y conversión a flujograma
 * (Kuo, 7.ª ed., sec. 3-9; Ogata, 3.ª ed., sec. 3-3).
 *
 * El documento es geométrico: bloques, puntos suma, entradas y salidas en una cuadrícula, unidos
 * por cables ortogonales. Cada conjunto de cables conectados es una señal; la produce una sola
 * salida (de un bloque, de un punto suma o una entrada R) y la reciben las entradas que toca. Una
 * señal que llega a varias entradas es un punto de bifurcación.
 *
 * Reglas de conexión: dos cables se unen si un vértice de uno cae sobre el otro (una T); dos
 * cables que solo se cruzan no se unen. Un terminal se une al cable que lo toca.
 *
 * El flujograma equivalente tiene un nodo por señal; cada bloque es una rama con su ganancia y
 * cada entrada de un punto suma es una rama de ganancia +1 o −1 hacia su salida.
 */
import { z } from 'zod';
import type { Step } from '../types';
import type { Sfg, SfgBranch } from './signal-flow';
import { frConst, parseGain, symbolTex, type FRat } from './symbolic';

export interface BdPoint {
  x: number;
  y: number;
}

export type BdKind = 'block' | 'sum' | 'input' | 'output';

/** Sentido de la señal: 0 → derecha, 1 → abajo, 2 → izquierda, 3 → arriba. */
export type Direction = 0 | 1 | 2 | 3;

/** Entradas de un punto suma, relativas al sentido de la señal. */
export type SumPort = 'back' | 'left' | 'right';
export const SUM_PORTS: readonly SumPort[] = ['back', 'left', 'right'];

export interface BdElement {
  id: string;
  kind: BdKind;
  x: number;
  y: number;
  dir: Direction;
  /** Bloque: su función de transferencia (`G1`, `10/(s + 1)`). */
  gain?: string;
  /** Entrada o salida: nombre de la señal (`R`, `D`, `C`). */
  label?: string;
  /** Punto suma: signo de cada entrada (por defecto +). */
  signs?: Partial<Record<SumPort, '+' | '-'>>;
}

export interface BdWire {
  id: string;
  points: BdPoint[];
}

export interface BlockDiagramDocument {
  elements: BdElement[];
  wires: BdWire[];
}

const pointSchema = z.object({ x: z.number().int(), y: z.number().int() });

export const blockDiagramSchema = z.object({
  elements: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.enum(['block', 'sum', 'input', 'output']),
      x: z.number().int(),
      y: z.number().int(),
      dir: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
      gain: z.string().max(200).optional(),
      label: z.string().max(12).optional(),
      signs: z
        .object({
          back: z.enum(['+', '-']).optional(),
          left: z.enum(['+', '-']).optional(),
          right: z.enum(['+', '-']).optional(),
        })
        .optional(),
    }),
  ),
  wires: z.array(z.object({ id: z.string().min(1), points: z.array(pointSchema).min(2) })),
});

// ─── Geometría ──────────────────────────────────────────────────────────────

/** Medio largo de un bloque (en celdas): el bloque mide 4 × 2. */
export const BLOCK_HALF = 2;
/** Radio de un punto suma (en celdas). */
export const SUM_RADIUS = 1;

const UNIT: Record<Direction, BdPoint> = {
  0: { x: 1, y: 0 },
  1: { x: 0, y: 1 },
  2: { x: -1, y: 0 },
  3: { x: 0, y: -1 },
};

export function unit(dir: Direction): BdPoint {
  return UNIT[dir];
}

/** Lado izquierdo respecto al sentido de la señal (en pantalla, con y hacia abajo). */
export function leftOf(dir: Direction): BdPoint {
  const u = UNIT[dir];
  return { x: u.y, y: -u.x };
}

export type TerminalRole = 'in' | 'out';

export interface Terminal {
  elementId: string;
  /** `in`, `out` o el puerto del punto suma. */
  port: 'in' | 'out' | SumPort;
  role: TerminalRole;
  point: BdPoint;
}

const add = (p: BdPoint, q: BdPoint, k = 1): BdPoint => ({ x: p.x + k * q.x, y: p.y + k * q.y });

export function elementTerminals(e: BdElement): Terminal[] {
  const c = { x: e.x, y: e.y };
  const u = UNIT[e.dir];
  switch (e.kind) {
    case 'block':
      return [
        { elementId: e.id, port: 'in', role: 'in', point: add(c, u, -BLOCK_HALF) },
        { elementId: e.id, port: 'out', role: 'out', point: add(c, u, BLOCK_HALF) },
      ];
    case 'sum': {
      const l = leftOf(e.dir);
      return [
        { elementId: e.id, port: 'out', role: 'out', point: add(c, u, SUM_RADIUS) },
        { elementId: e.id, port: 'back', role: 'in', point: add(c, u, -SUM_RADIUS) },
        { elementId: e.id, port: 'left', role: 'in', point: add(c, l, SUM_RADIUS) },
        { elementId: e.id, port: 'right', role: 'in', point: add(c, l, -SUM_RADIUS) },
      ];
    }
    case 'input':
      return [{ elementId: e.id, port: 'out', role: 'out', point: c }];
    case 'output':
      return [{ elementId: e.id, port: 'in', role: 'in', point: c }];
  }
}

function samePoint(a: BdPoint, b: BdPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

/** ¿El punto está sobre el tramo ortogonal (incluidos sus extremos)? */
export function onSegment(p: BdPoint, a: BdPoint, b: BdPoint): boolean {
  if (a.x === b.x && p.x === a.x) return p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
  if (a.y === b.y && p.y === a.y) return p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x);
  return samePoint(p, a) || samePoint(p, b);
}

export function onWire(p: BdPoint, wire: BdWire): boolean {
  for (let i = 0; i < wire.points.length - 1; i++) {
    if (onSegment(p, wire.points[i]!, wire.points[i + 1]!)) return true;
  }
  return wire.points.length === 1 && samePoint(p, wire.points[0]!);
}

/** Puntos donde un vértice de un cable cae sobre otro cable: se dibujan como un punto (•). */
export function junctionPoints(doc: BlockDiagramDocument): BdPoint[] {
  const out: BdPoint[] = [];
  const seen = new Set<string>();
  for (const a of doc.wires) {
    for (const p of [a.points[0]!, a.points.at(-1)!]) {
      const touching = doc.wires.filter((w) => w !== a && onWire(p, w)).length;
      const k = `${p.x},${p.y}`;
      // Un extremo sobre el interior de otro cable (o tres cables en un punto) es una bifurcación.
      const interior = doc.wires.some(
        (w) =>
          w !== a && onWire(p, w) && !samePoint(p, w.points[0]!) && !samePoint(p, w.points.at(-1)!),
      );
      if ((interior || touching >= 2) && !seen.has(k)) {
        seen.add(k);
        out.push(p);
      }
    }
  }
  return out;
}

// ─── Señales ────────────────────────────────────────────────────────────────

class UnionFind {
  private parent = new Map<string, string>();
  add(k: string) {
    if (!this.parent.has(k)) this.parent.set(k, k);
  }
  find(k: string): string {
    let r = k;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = k;
    while (this.parent.get(c) !== r) {
      const next = this.parent.get(c)!;
      this.parent.set(c, r);
      c = next;
    }
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export interface Signal {
  /** Nombre del nodo del flujograma: `R`, `C`, `E1`, `X2`. */
  name: string;
  driver: Terminal | null;
  drivers: Terminal[];
  consumers: Terminal[];
  wires: string[];
}

const terminalKey = (t: Terminal) => `t:${t.elementId}:${t.port}`;

/**
 * Agrupa terminales y cables en señales. Los puertos de un punto suma que no tocan nada no
 * cuentan (el punto suma puede usar dos de sus tres entradas).
 */
export function buildSignals(doc: BlockDiagramDocument): Signal[] {
  const uf = new UnionFind();
  const terminals = doc.elements.flatMap(elementTerminals);
  for (const w of doc.wires) uf.add(`w:${w.id}`);
  for (const t of terminals) uf.add(terminalKey(t));

  for (const a of doc.wires) {
    for (const p of a.points) {
      for (const b of doc.wires) {
        if (a !== b && onWire(p, b)) uf.union(`w:${a.id}`, `w:${b.id}`);
      }
    }
  }
  for (const t of terminals) {
    for (const w of doc.wires) if (onWire(t.point, w)) uf.union(terminalKey(t), `w:${w.id}`);
  }
  for (let i = 0; i < terminals.length; i++) {
    for (let j = i + 1; j < terminals.length; j++) {
      const a = terminals[i]!;
      const b = terminals[j]!;
      if (a.elementId !== b.elementId && samePoint(a.point, b.point)) {
        uf.union(terminalKey(a), terminalKey(b));
      }
    }
  }

  const groups = new Map<string, { terminals: Terminal[]; wires: string[] }>();
  const groupOf = (root: string) => {
    if (!groups.has(root)) groups.set(root, { terminals: [], wires: [] });
    return groups.get(root)!;
  };
  for (const t of terminals) {
    const connected =
      doc.wires.some((w) => onWire(t.point, w)) ||
      terminals.some((o) => o.elementId !== t.elementId && samePoint(o.point, t.point));
    // Un puerto de punto suma sin conectar no forma parte de ninguna señal.
    if (
      !connected &&
      doc.elements.find((e) => e.id === t.elementId)?.kind === 'sum' &&
      t.role === 'in'
    ) {
      continue;
    }
    groupOf(uf.find(terminalKey(t))).terminals.push(t);
  }
  for (const w of doc.wires) groupOf(uf.find(`w:${w.id}`)).wires.push(w.id);

  return [...groups.values()].map((g) => {
    const drivers = g.terminals.filter((t) => t.role === 'out');
    return {
      name: '',
      driver: drivers.length === 1 ? drivers[0]! : null,
      drivers,
      consumers: g.terminals.filter((t) => t.role === 'in'),
      wires: g.wires,
    };
  });
}

// ─── Conversión a flujograma ────────────────────────────────────────────────

export type DiagramErrorCode =
  | 'diagrama-vacio'
  | 'sin-entrada'
  | 'sin-salida'
  | 'ganancia-invalida'
  | 'terminal-sin-conectar'
  | 'senal-sin-origen'
  | 'salidas-unidas'
  | 'sumador-sin-entradas'
  | 'nombre-repetido'
  | 'entrada-unida-a-salida';

export interface DiagramGraph {
  graph: Sfg;
  inputs: string[];
  outputs: string[];
  /** Nombre de nodo → descripción para el estudiante. */
  descriptions: Map<string, string>;
  steps: Step[];
}

export type DiagramOutcome =
  { ok: true; value: DiagramGraph } | { ok: false; code: DiagramErrorCode; message: string };

/** «de» + descripción, con la contracción «del»: «del bloque G1», «de la entrada R». */
function of(text: string): string {
  return text.startsWith('el ') ? `del ${text.slice(3)}` : `de ${text}`;
}

function describe(e: BdElement, index: Map<string, number>): string {
  if (e.kind === 'block') return `el bloque ${e.gain?.trim() || `#${index.get(e.id)}`}`;
  if (e.kind === 'sum') return `el punto suma ${index.get(e.id)}`;
  if (e.kind === 'input') return `la entrada ${e.label || 'R'}`;
  return `la salida ${e.label || 'C'}`;
}

/** Convierte el diagrama en su flujograma equivalente, con un nodo por señal. */
export function diagramToGraph(doc: BlockDiagramDocument): DiagramOutcome {
  const fail = (code: DiagramErrorCode, message: string): DiagramOutcome => ({
    ok: false,
    code,
    message,
  });
  if (doc.elements.length === 0) return fail('diagrama-vacio', 'El diagrama está vacío.');
  const inputs = doc.elements.filter((e) => e.kind === 'input');
  const outputs = doc.elements.filter((e) => e.kind === 'output');
  if (inputs.length === 0) return fail('sin-entrada', 'Agrega una entrada (R) al diagrama.');
  if (outputs.length === 0) return fail('sin-salida', 'Agrega una salida (C) al diagrama.');

  const names = [...inputs, ...outputs].map(
    (e) => e.label?.trim() || (e.kind === 'input' ? 'R' : 'C'),
  );
  const repeated = names.find((name, i) => names.indexOf(name) !== i);
  if (repeated)
    return fail('nombre-repetido', `Hay dos entradas o salidas llamadas «${repeated}».`);

  // Numeración de bloques y puntos suma en el orden en que se dibujaron.
  const index = new Map<string, number>();
  let blocks = 0;
  let sums = 0;
  for (const e of doc.elements) {
    if (e.kind === 'block') index.set(e.id, ++blocks);
    if (e.kind === 'sum') index.set(e.id, ++sums);
  }

  const gains = new Map<string, FRat>();
  for (const e of doc.elements.filter((x) => x.kind === 'block')) {
    const parsed = parseGain(e.gain ?? '');
    if (!parsed.ok) {
      return fail(
        'ganancia-invalida',
        `Bloque ${index.get(e.id)}${e.gain ? ` («${e.gain}»)` : ''}: ${parsed.message}`,
      );
    }
    if (parsed.value.coef === 0) {
      return fail('ganancia-invalida', `El bloque ${index.get(e.id)} tiene ganancia 0.`);
    }
    gains.set(e.id, parsed.value);
  }

  const signals = buildSignals(doc);
  const byElement = new Map(doc.elements.map((e) => [e.id, e]));
  for (const s of signals) {
    if (s.drivers.length > 1) {
      const what = s.drivers
        .map((t) => of(describe(byElement.get(t.elementId)!, index)))
        .join(' y ');
      return fail(
        'salidas-unidas',
        `Las salidas ${what} están unidas: cada señal debe salir de un solo lugar.`,
      );
    }
    // Un terminal suelto (sin cables) se informa más abajo como «no conectado».
    if (
      s.drivers.length === 0 &&
      s.consumers.length > 0 &&
      (s.wires.length > 0 || s.consumers.length > 1)
    ) {
      const what = describe(byElement.get(s.consumers[0]!.elementId)!, index);
      return fail(
        'senal-sin-origen',
        `La entrada ${of(what)} recibe un cable que no viene de ninguna salida (de un bloque, un punto suma o una entrada R).`,
      );
    }
  }

  // Cada terminal obligatorio debe estar en una señal con algo más.
  const signalOf = new Map<string, Signal>();
  for (const s of signals)
    for (const t of [...s.drivers, ...s.consumers]) signalOf.set(`${t.elementId}:${t.port}`, s);
  for (const e of doc.elements) {
    const required = elementTerminals(e).filter((t) => e.kind !== 'sum' || t.role === 'out');
    for (const t of required) {
      const s = signalOf.get(`${t.elementId}:${t.port}`);
      const alone = !s || s.drivers.length + s.consumers.length < 2;
      if (alone) {
        const side = t.role === 'in' ? 'la entrada' : 'la salida';
        const what = describe(e, index);
        return fail(
          'terminal-sin-conectar',
          e.kind === 'input' || e.kind === 'output'
            ? `${what[0]!.toUpperCase()}${what.slice(1)} no está conectada.`
            : `${side[0]!.toUpperCase()}${side.slice(1)} ${of(what)} no está conectada.`,
        );
      }
    }
    if (e.kind === 'sum') {
      const used = elementTerminals(e).filter(
        (t) => t.role === 'in' && signalOf.has(`${t.elementId}:${t.port}`),
      );
      if (used.length === 0) {
        return fail(
          'sumador-sin-entradas',
          `El punto suma ${index.get(e.id)} no tiene ninguna entrada conectada.`,
        );
      }
    }
  }

  // Nombres de las señales.
  const sumCount = doc.elements.filter((e) => e.kind === 'sum').length;
  const descriptions = new Map<string, string>();
  let x = 0;
  for (const s of signals) {
    const markers = s.consumers.filter((t) => byElement.get(t.elementId)!.kind === 'output');
    const labelOf = (t: Terminal) => byElement.get(t.elementId)!.label?.trim() || 'C';
    if (markers.length > 1) {
      return fail(
        'nombre-repetido',
        `Las salidas ${markers.map(labelOf).join(' y ')} son la misma señal.`,
      );
    }
    if (markers.length === 1 && s.driver && byElement.get(s.driver.elementId)!.kind === 'input') {
      return fail(
        'entrada-unida-a-salida',
        `La entrada ${byElement.get(s.driver.elementId)!.label?.trim() || 'R'} está unida directamente a la salida ${labelOf(markers[0]!)}.`,
      );
    }
  }
  for (const s of signals) {
    const outMarker = s.consumers.find((t) => byElement.get(t.elementId)!.kind === 'output');
    const driver = s.driver ? byElement.get(s.driver.elementId)! : null;
    if (driver?.kind === 'input') {
      s.name = driver.label?.trim() || 'R';
      descriptions.set(s.name, `la entrada ${s.name}`);
    } else if (outMarker) {
      const marker = byElement.get(outMarker.elementId)!;
      s.name = marker.label?.trim() || 'C';
      descriptions.set(s.name, `la salida ${s.name}`);
    } else if (driver?.kind === 'sum') {
      s.name = sumCount === 1 ? 'E' : `E${index.get(driver.id)}`;
      descriptions.set(s.name, `la salida del punto suma ${index.get(driver.id)}`);
    } else {
      s.name = `X${++x}`;
      if (driver) descriptions.set(s.name, `la salida ${of(describe(driver, index))}`);
    }
  }

  const branches: SfgBranch[] = [];
  for (const e of doc.elements) {
    const terms = elementTerminals(e);
    const out = signalOf.get(`${e.id}:out`);
    if (e.kind === 'block') {
      const inp = signalOf.get(`${e.id}:in`)!;
      branches.push({ from: inp.name, to: out!.name, gain: gains.get(e.id)! });
    }
    if (e.kind === 'sum') {
      for (const t of terms.filter((x) => x.role === 'in')) {
        const s = signalOf.get(`${e.id}:${t.port}`);
        if (!s) continue;
        const sign = e.signs?.[t.port as SumPort] === '-' ? -1 : 1;
        branches.push({ from: s.name, to: out!.name, gain: frConst(sign) });
      }
    }
  }
  const nodes = signals.filter((s) => s.drivers.length + s.consumers.length > 0).map((s) => s.name);
  const inputNames = inputs.map((e) => e.label?.trim() || 'R');
  const outputNames = outputs.map((e) => e.label?.trim() || 'C');

  const steps: Step[] = [
    {
      title: 'Flujograma equivalente',
      explanation:
        'Cada señal del diagrama es un nodo. Cada bloque es una rama con su función de transferencia y cada entrada de un punto suma es una rama de ganancia +1 o −1 (según su signo) hacia la salida del punto suma. Una señal que llega a varios bloques es un punto de bifurcación (Kuo, sec. 3-9).',
      children: [...descriptions.entries()].map(([name, text]) => ({
        title: `${name}: ${text}`,
      })),
    },
  ];
  return {
    ok: true,
    value: {
      graph: { nodes, branches },
      inputs: inputNames,
      outputs: outputNames,
      descriptions,
      steps,
    },
  };
}

/** Nombre de una señal en LaTeX (`E1` → `E_{1}`). */
export function signalTex(name: string): string {
  return /^[A-Za-z]+_?\d*$/.test(name) ? symbolTex(name) : name;
}
