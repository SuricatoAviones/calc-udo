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

export type ComponentKind =
  'resistor' | 'voltage-source' | 'current-source' | 'capacitor' | 'inductor' | 'diode' | 'opamp';

/** Elementos que almacenan energía: sus variables (v_C, i_L) son las variables de estado. */
export const STORAGE_KINDS: readonly ComponentKind[] = ['capacitor', 'inductor'];

/** Los tipos del constructor en las calculadoras de circuitos resistivos. */
export const RESISTIVE_KINDS: readonly ComponentKind[] = [
  'resistor',
  'voltage-source',
  'current-source',
];

/**
 * Paleta de la calculadora de circuitos con diodos (Electrónica). El diodo va del ánodo (`a`) al
 * cátodo (`b`) y su valor es el voltaje de umbral V_K.
 */
export const DIODE_KINDS: readonly ComponentKind[] = [...RESISTIVE_KINDS, 'diode'];

/**
 * Paleta de la calculadora de amplificadores operacionales (Electrónica). El amplificador tiene
 * tres terminales: `a` es la entrada inversora (−), `b` la no inversora (+) y `c` la salida.
 */
export const OPAMP_KINDS: readonly ComponentKind[] = [...RESISTIVE_KINDS, 'opamp'];

export interface CircuitComponent {
  id: string;
  kind: ComponentKind;
  /** Terminal positivo/1 (en un amplificador operacional, la entrada inversora −). */
  a: GridPoint;
  /** Terminal negativo/2 (en un amplificador operacional, la entrada no inversora +). */
  b: GridPoint;
  /** Solo amplificadores operacionales: la salida. */
  c?: GridPoint;
  /** Valor numérico: Ω, V, A, F o H según el tipo (en un diodo, su V_K en V). */
  value: number;
  label?: string;
  /**
   * Solo capacitores e inductores: v_C(0) en V (con + en `a`) o i_L(0) en A (de `a` a `b`).
   * Si falta, se toma 0.
   */
  initial?: number;
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
  kind: z.enum([
    'resistor',
    'voltage-source',
    'current-source',
    'capacitor',
    'inductor',
    'diode',
    'opamp',
  ]),
  a: gridPointSchema,
  b: gridPointSchema,
  c: gridPointSchema.optional(),
  value: z.number().finite(),
  label: z.string().optional(),
  initial: z.number().finite().optional(),
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
  | 'elementos-almacenadores'
  | 'elementos-no-lineales'
  | 'elementos-no-admitidos'
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
  // Acepta la unidad al final ("2.2 kΩ", "10 µF", "−0,3 A"), como la muestra el editor.
  const s = text
    .trim()
    .replace(',', '.')
    .replace(/\s+/g, '')
    .replace(/^−/, '-')
    .replace(/(Ω|ohms?|[VAFH])$/, '');
  const m = /^([+-]?\d+\.?\d*|\.\d+)([pnumµukKMG]?)$/.exec(s);
  if (!m) return null;
  const val = Number(m[1]);
  const mult = ENG_SUFFIX[m[2]!] ?? 1;
  // Dividir entre 10⁶ redondea mejor que multiplicar por 1e-6 (10µ da 1e-5 exacto).
  return mult < 1 ? val / Math.round(1 / mult) : val * mult;
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
  capacitor: 'C',
  inductor: 'L',
  diode: 'D',
  opamp: 'U',
};

const UNIT_LABEL: Record<ComponentKind, string> = {
  resistor: 'Ω',
  'voltage-source': 'V',
  'current-source': 'A',
  capacitor: 'F',
  inductor: 'H',
  diode: 'V',
  opamp: '',
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

export type TerminalName = 'a' | 'b' | 'c';

/** Terminales de un componente: dos, o tres en el amplificador operacional. */
export function componentTerminals(
  c: CircuitComponent,
): { terminal: TerminalName; point: GridPoint }[] {
  const terminals: { terminal: TerminalName; point: GridPoint }[] = [
    { terminal: 'a', point: c.a },
    { terminal: 'b', point: c.b },
  ];
  if (c.c) terminals.push({ terminal: 'c', point: c.c });
  return terminals;
}

/**
 * Terminales de un amplificador operacional recién colocado, con la salida hacia `dir`: la entrada
 * inversora en `at`, la no inversora dos celdas más abajo (respecto de la salida) y la salida a
 * cuatro celdas, a media altura.
 */
export function opAmpPlacement(
  at: GridPoint,
  dir: GridPoint,
): { a: GridPoint; b: GridPoint; c: GridPoint } {
  const normal = { x: -dir.y, y: dir.x };
  return {
    a: at,
    b: { x: at.x + 2 * normal.x, y: at.y + 2 * normal.y },
    c: { x: at.x + 4 * dir.x + normal.x, y: at.y + 4 * dir.y + normal.y },
  };
}

// ─── Topología ──────────────────────────────────────────────────────────────

export interface NodeTerminal {
  component: CircuitComponent;
  terminal: TerminalName;
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
  /** Nodo de la salida de un amplificador operacional. */
  nodeC?: number;
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
    for (const { point } of componentTerminals(c)) uf.add(point);
  }
  if (doc.ground) uf.add(doc.ground);

  // Unir terminales que caigan sobre un cable o que coincidan con otro terminal.
  for (const c of doc.components) {
    for (const { point: t } of componentTerminals(c)) {
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
    for (const { point } of componentTerminals(c)) collect(point);
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
    if (c.c) {
      const nodeC = nodeOf.get(key(c.c))!;
      nodes[nodeC]!.terminals.push({ component: c, terminal: 'c' });
      mapped.push({ component: c, nodeA, nodeB, nodeC });
    } else {
      mapped.push({ component: c, nodeA, nodeB });
    }
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
export function validateTopology(
  topology: CircuitTopology,
  options: { allow?: readonly ComponentKind[] } = {},
): CircuitError | null {
  const { nodes, components, referenceNode } = topology;
  if (components.length === 0) {
    return { code: 'circuito-vacio', message: 'El circuito no tiene componentes.' };
  }
  const storage = storageElementsError(components.map((c) => c.component));
  if (storage) return storage;
  const electronic = electronicElementsError(
    components.map((c) => c.component),
    options.allow ?? [],
  );
  if (electronic) return electronic;
  const broken = components.find((c) => c.component.kind === 'opamp' && c.nodeC === undefined);
  if (broken) {
    return {
      code: 'singular',
      message: `${componentLabel(broken.component)} no tiene salida: bórralo y vuelve a colocarlo.`,
    };
  }

  // Cada nodo con componentes debe estar conectado a la referencia. Un amplificador operacional
  // liga sus entradas (v₊ = v₋) y su salida queda referida a tierra.
  const uf = new UnionFind();
  for (const n of nodes) {
    for (const p of n.points) uf.add(p);
  }
  for (const { nodeA, nodeB, nodeC } of components) {
    uf.union(nodes[nodeA]!.points[0]!, nodes[nodeB]!.points[0]!);
    if (nodeC !== undefined) uf.union(nodes[nodeC]!.points[0]!, nodes[referenceNode]!.points[0]!);
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
 * Las calculadoras de cd (nodos, mallas, teoremas) trabajan con resistencias y fuentes; los
 * capacitores e inductores son de la calculadora de ecuaciones de estado.
 */
export function storageElementsError(components: CircuitComponent[]): CircuitError | null {
  if (!components.some((c) => STORAGE_KINDS.includes(c.kind))) return null;
  return {
    code: 'elementos-almacenadores',
    message:
      'El circuito tiene capacitores o inductores: este análisis es de circuitos resistivos de cd. Usa la calculadora de ecuaciones de estado para circuitos con elementos que almacenan energía.',
  };
}

/**
 * Diodos y amplificadores operacionales solo los resuelven sus calculadoras de Electrónica; las
 * demás los rechazan (`allow` dice cuáles admite la que llama).
 */
export function electronicElementsError(
  components: CircuitComponent[],
  allow: readonly ComponentKind[] = [],
): CircuitError | null {
  if (!allow.includes('diode') && components.some((c) => c.kind === 'diode')) {
    return {
      code: 'elementos-no-lineales',
      message:
        'El circuito tiene diodos: este análisis es de circuitos lineales. Usa la calculadora de circuitos con diodos (Electrónica).',
    };
  }
  if (!allow.includes('opamp') && components.some((c) => c.kind === 'opamp')) {
    return {
      code: 'elementos-no-admitidos',
      message:
        'El circuito tiene amplificadores operacionales: resuélvelo en la calculadora de amplificadores operacionales (Electrónica).',
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
    if (componentTerminals(c).some(({ point }) => pointsEqual(point, p))) return true;
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
