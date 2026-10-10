/**
 * Modelo de circuito, topología y utilidades para el constructor interactivo de
 * Circuitos y Sistemas.
 *
 * El documento de circuito (`CircuitDocument`) es una netlist geométrica: componentes y cables en
 * coordenadas enteras de una cuadrícula. Desde él se extraen nodos (puntos unidos por cables), se
 * asigna una referencia (tierra) y se validan condiciones estructurales.
 */
import { z } from 'zod';

// ─── Tipos y schemas ────────────────────────────────────────────────────────

export interface GridPoint {
  x: number;
  y: number;
}

export type ComponentKind = 'resistor' | 'voltage-source' | 'current-source';

export interface CircuitComponent {
  id: string;
  kind: ComponentKind;
  /** Terminal positivo/1. */
  a: GridPoint;
  /** Terminal negativo/2. */
  b: GridPoint;
  /** Valor numérico: Ω, V o A según el tipo. */
  value: number;
  label?: string;
}

export interface CircuitWire {
  id: string;
  /** Secuencia de puntos conectados por segmentos ortogonales. */
  points: GridPoint[];
}

export interface CircuitDocument {
  components: CircuitComponent[];
  wires: CircuitWire[];
  /** Punto marcado como referencia. Si no hay, se elige el nodo con más terminales. */
  ground?: GridPoint | null;
}

const gridPointSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

const componentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['resistor', 'voltage-source', 'current-source']),
  a: gridPointSchema,
  b: gridPointSchema,
  value: z.number().finite(),
  label: z.string().optional(),
});

const wireSchema = z.object({
  id: z.string().min(1),
  points: z.array(gridPointSchema).min(2),
});

export const circuitDocumentSchema = z.object({
  components: z.array(componentSchema),
  wires: z.array(wireSchema),
  ground: gridPointSchema.nullable().optional(),
});

export type CircuitErrorCode =
  | 'circuito-vacio'
  | 'circuito-desconectado'
  | 'lazo-de-fuentes-de-voltaje'
  | 'corte-de-fuentes-de-corriente'
  | 'nodo-sin-referencia'
  | 'singular';

export interface CircuitError {
  code: CircuitErrorCode;
  message: string;
}

// ─── Notación de ingeniería ─────────────────────────────────────────────────

const ENG_SUFFIX: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
};

export function parseEngineering(text: string): number | null {
  const s = text.trim().replace(',', '.').replace(/\s+/g, '');
  const m = /^([+-]?\d+\.?\d*|\.\d+)([pnumµukKMG]?)$/.exec(s);
  if (!m) return null;
  const val = Number(m[1]);
  const mult = ENG_SUFFIX[m[2]!] ?? 1;
  return val * mult;
}

const ENG_UNITS = [
  { value: 1e9, symbol: 'G' },
  { value: 1e6, symbol: 'M' },
  { value: 1e3, symbol: 'k' },
  { value: 1, symbol: '' },
  { value: 1e-3, symbol: 'm' },
  { value: 1e-6, symbol: 'µ' },
  { value: 1e-9, symbol: 'n' },
  { value: 1e-12, symbol: 'p' },
];

export function formatEngineering(value: number, unit = ''): string {
  if (value === 0) return `0 ${unit}`.trim();
  const abs = Math.abs(value);
  for (const { value: scale, symbol } of ENG_UNITS) {
    const scaled = value / scale;
    if (abs >= scale * 0.999 && abs < scale * 1000) {
      const n = Math.abs(scaled) < 100 ? Number(scaled.toFixed(3)) : Number(scaled.toFixed(1));
      return `${n} ${symbol}${unit}`.trim();
    }
  }
  return `${value} ${unit}`.trim();
}

// ─── Utilidades de etiquetado ───────────────────────────────────────────────

const KIND_LABEL: Record<ComponentKind, string> = {
  resistor: 'R',
  'voltage-source': 'V',
  'current-source': 'I',
};

const UNIT_LABEL: Record<ComponentKind, string> = {
  resistor: 'Ω',
  'voltage-source': 'V',
  'current-source': 'A',
};

export function componentLabel(c: CircuitComponent): string {
  return c.label ?? `${KIND_LABEL[c.kind]}?`;
}

export function componentUnit(kind: ComponentKind): string {
  return UNIT_LABEL[kind];
}

export function emptyCircuit(): CircuitDocument {
  return { components: [], wires: [] };
}

// ─── Topología ──────────────────────────────────────────────────────────────

export interface NodeTerminal {
  component: CircuitComponent;
  terminal: 'a' | 'b';
}

export interface CircuitNode {
  index: number;
  points: GridPoint[];
  terminals: NodeTerminal[];
  isGround: boolean;
}

export interface MappedComponent {
  component: CircuitComponent;
  nodeA: number;
  nodeB: number;
}

export interface CircuitTopology {
  nodes: CircuitNode[];
  nodeOf: Map<string, number>;
  components: MappedComponent[];
  referenceNode: number;
}

function key(p: GridPoint): string {
  return `${p.x},${p.y}`;
}

class UnionFind {
  private parent = new Map<string, string>();

  add(p: GridPoint): void {
    const k = key(p);
    if (!this.parent.has(k)) this.parent.set(k, k);
  }

  find(p: GridPoint): string {
    const k = key(p);
    let root = k;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // compresión de camino
    let curr = k;
    while (this.parent.get(curr) !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a: GridPoint, b: GridPoint): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function pointsOnSegment(a: GridPoint, b: GridPoint): GridPoint[] {
  const points: GridPoint[] = [];
  if (a.x === b.x) {
    const x = a.x;
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    for (let y = y0; y <= y1; y++) points.push({ x, y });
  } else if (a.y === b.y) {
    const y = a.y;
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    for (let x = x0; x <= x1; x++) points.push({ x, y });
  }
  return points;
}

function pointsEqual(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

function pointOnWire(p: GridPoint, wire: CircuitWire): boolean {
  for (let i = 0; i < wire.points.length - 1; i++) {
    const a = wire.points[i]!;
    const b = wire.points[i + 1]!;
    if (a.x === b.x && p.x === a.x) {
      const min = Math.min(a.y, b.y);
      const max = Math.max(a.y, b.y);
      if (p.y >= min && p.y <= max) return true;
    } else if (a.y === b.y && p.y === a.y) {
      const min = Math.min(a.x, b.x);
      const max = Math.max(a.x, b.x);
      if (p.x >= min && p.x <= max) return true;
    }
  }
  return false;
}

/**
 * Extrae la topología de un circuito: nodos (puntos unidos por cables), referencia y componentes
 * con sus nodos asignados. No valida problemas eléctricos; usa `validateTopology` para eso.
 */
export function buildTopology(doc: CircuitDocument): CircuitTopology {
  const uf = new UnionFind();

  // Registrar todos los puntos de cables y terminales.
  for (const wire of doc.wires) {
    for (let i = 0; i < wire.points.length - 1; i++) {
      const seg = pointsOnSegment(wire.points[i]!, wire.points[i + 1]!);
      for (const p of seg) uf.add(p);
      for (let j = 1; j < seg.length; j++) uf.union(seg[j - 1]!, seg[j]!);
    }
  }
  for (const c of doc.components) {
    uf.add(c.a);
    uf.add(c.b);
  }
  if (doc.ground) uf.add(doc.ground);

  // Unir terminales que caigan sobre un cable o que coincidan con otro terminal.
  for (const c of doc.components) {
    for (const t of [c.a, c.b]) {
      for (const wire of doc.wires) {
        if (pointOnWire(t, wire)) {
          // Unir con un punto del cable (el primero del segmento que lo contiene).
          const first = wire.points[0]!;
          uf.union(t, first);
        }
      }
    }
  }
  for (let i = 0; i < doc.components.length; i++) {
    for (let j = i + 1; j < doc.components.length; j++) {
      const a = doc.components[i]!;
      const b = doc.components[j]!;
      if (pointsEqual(a.a, b.a)) uf.union(a.a, b.a);
      else if (pointsEqual(a.a, b.b)) uf.union(a.a, b.b);
      if (pointsEqual(a.b, b.a)) uf.union(a.b, b.a);
      else if (pointsEqual(a.b, b.b)) uf.union(a.b, b.b);
    }
  }

  // Reconstruir nodos recorriendo todos los puntos registrados.
  const pointToRoot = new Map<string, string>();
  const rootToPoints = new Map<string, GridPoint[]>();
  const collect = (p: GridPoint) => {
    const k = key(p);
    if (pointToRoot.has(k)) return;
    const root = uf.find(p);
    pointToRoot.set(k, root);
    if (!rootToPoints.has(root)) rootToPoints.set(root, []);
    rootToPoints.get(root)!.push(p);
  };
  for (const c of doc.components) {
    collect(c.a);
    collect(c.b);
  }
  for (const wire of doc.wires) {
    for (const p of wire.points) collect(p);
  }
  if (doc.ground) collect(doc.ground);

  const roots = [...rootToPoints.keys()];
  const rootToIndex = new Map<string, number>();
  roots.forEach((root, i) => rootToIndex.set(root, i));

  const nodeOf = new Map<string, number>();
  for (const root of roots) {
    const idx = rootToIndex.get(root)!;
    for (const p of rootToPoints.get(root)!) nodeOf.set(key(p), idx);
  }

  const nodes: CircuitNode[] = roots.map((root, i) => ({
    index: i,
    points: rootToPoints.get(root)!,
    terminals: [],
    isGround: doc.ground ? uf.find(doc.ground) === root : false,
  }));

  const mapped: MappedComponent[] = [];
  for (const c of doc.components) {
    const nodeA = nodeOf.get(key(c.a))!;
    const nodeB = nodeOf.get(key(c.b))!;
    nodes[nodeA]!.terminals.push({ component: c, terminal: 'a' });
    nodes[nodeB]!.terminals.push({ component: c, terminal: 'b' });
    mapped.push({ component: c, nodeA, nodeB });
  }

  // Referencia: nodo con tierra, o el que tenga más terminales.
  let referenceNode = nodes.findIndex((n) => n.isGround);
  if (referenceNode === -1) {
    referenceNode =
      nodes.map((n, i) => ({ i, count: n.terminals.length })).sort((a, b) => b.count - a.count)[0]
        ?.i ?? 0;
  }

  return { nodes, nodeOf, components: mapped, referenceNode };
}

// ─── Validación estructural ─────────────────────────────────────────────────

function findVoltageSourceLoop(topology: CircuitTopology): boolean {
  const n = topology.nodes.length;
  const adj = Array.from({ length: n }, () => new Set<number>());
  for (const { component, nodeA, nodeB } of topology.components) {
    if (component.kind === 'voltage-source') {
      adj[nodeA]!.add(nodeB);
      adj[nodeB]!.add(nodeA);
    }
  }
  const visited = new Set<number>();
  const parent = new Map<number, number>();
  for (let start = 0; start < n; start++) {
    if (visited.has(start)) continue;
    const stack = [start];
    visited.add(start);
    while (stack.length) {
      const u = stack.pop()!;
      for (const v of adj[u]!) {
        if (!visited.has(v)) {
          visited.add(v);
          parent.set(v, u);
          stack.push(v);
        } else if (parent.get(u) !== v) {
          return true;
        }
      }
    }
  }
  return false;
}

function hasCurrentSourceCut(topology: CircuitTopology): boolean {
  for (let i = 0; i < topology.nodes.length; i++) {
    if (i === topology.referenceNode) continue;
    const incident = topology.components.filter(({ nodeA, nodeB }) => nodeA === i || nodeB === i);
    if (
      incident.length > 0 &&
      incident.every(({ component }) => component.kind === 'current-source')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Valida un circuito construido. Devuelve `null` si no hay problema estructural.
 */
export function validateTopology(topology: CircuitTopology): CircuitError | null {
  const { nodes, components, referenceNode } = topology;
  if (components.length === 0) {
    return { code: 'circuito-vacio', message: 'El circuito no tiene componentes.' };
  }

  // Cada nodo con componentes debe estar conectado a la referencia.
  const uf = new UnionFind();
  for (const n of nodes) {
    for (const p of n.points) uf.add(p);
  }
  for (const { nodeA, nodeB } of components) {
    uf.union(nodes[nodeA]!.points[0]!, nodes[nodeB]!.points[0]!);
  }
  const refRoot = uf.find(nodes[referenceNode]!.points[0]!);
  for (let i = 0; i < nodes.length; i++) {
    if (i === referenceNode) continue;
    if (nodes[i]!.terminals.length === 0) continue; // nodo solo de cables
    const root = uf.find(nodes[i]!.points[0]!);
    if (root !== refRoot) {
      return {
        code: 'circuito-desconectado',
        message:
          'El circuito tiene partes desconectadas de la referencia. Agrega un cable o componente que las una.',
      };
    }
  }

  if (findVoltageSourceLoop(topology)) {
    return {
      code: 'lazo-de-fuentes-de-voltaje',
      message:
        'Hay un lazo de fuentes de voltaje sin resistencia. Agrega una resistencia en serie o revisa el circuito.',
    };
  }
  if (hasCurrentSourceCut(topology)) {
    return {
      code: 'corte-de-fuentes-de-corriente',
      message: 'Hay un nodo donde solo se encuentran fuentes de corriente. Revisa las conexiones.',
    };
  }

  return null;
}

/**
 * Valida un documento de circuito (schema zod + topología).
 */
export function validateCircuit(doc: CircuitDocument): CircuitError | null {
  const parse = circuitDocumentSchema.safeParse(doc);
  if (!parse.success) {
    return { code: 'singular', message: 'El circuito tiene datos inválidos.' };
  }
  const topology = buildTopology(parse.data);
  return validateTopology(topology);
}

// ─── Helpers para la UI ─────────────────────────────────────────────────────

/** Indica si un punto pertenece a algún nodo (terminal o cable) del circuito. */
export function isOccupied(doc: CircuitDocument, p: GridPoint): boolean {
  for (const c of doc.components) {
    if (pointsEqual(c.a, p) || pointsEqual(c.b, p)) return true;
  }
  for (const w of doc.wires) {
    if (pointOnWire(p, w)) return true;
  }
  return false;
}

/** Siguiente etiqueta disponible para un tipo de componente. */
export function nextLabel(doc: CircuitDocument, kind: ComponentKind): string {
  const prefix = KIND_LABEL[kind];
  const used = new Set<number>();
  for (const c of doc.components) {
    if (!c.label || !c.label.startsWith(prefix)) continue;
    const n = Number(c.label.slice(prefix.length));
    if (Number.isInteger(n)) used.add(n);
  }
  let i = 1;
  while (used.has(i)) i++;
  return `${prefix}${i}`;
}
