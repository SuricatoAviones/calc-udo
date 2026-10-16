'use client';

import { useController, useFormContext } from 'react-hook-form';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BoxSelect,
  Check,
  Copy,
  FlipHorizontal2,
  Maximize2,
  Pause,
  Play,
  Redo2,
  RotateCw,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  buildTopology,
  componentLabel,
  componentUnit,
  emptyCircuit,
  formatEngineering,
  nextLabel,
  parseEngineering,
  RESISTIVE_KINDS,
  validateTopology,
  type CircuitComponent,
  type CircuitDocument,
  type CircuitWire,
  type ComponentKind,
  type GridPoint,
} from '@/lib/calculators/circuitos-y-sistemas/circuit';
import { solveMna } from '@/lib/calculators/circuitos-y-sistemas/mna';
import { BuilderGuide } from './BuilderGuide';
import { ComponentShape, GroundSymbol, PaletteIcon, midpoint } from './circuit-symbols';

const DEFAULT_SCALE = 26;
const MIN_SCALE = 12;
const MAX_SCALE = 90;
/** Longitud de un componente en unidades de rejilla. */
const COMP_LEN = 2;
const ORIENTATIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
] as const;

const DEFAULT_VALUE: Record<ComponentKind, number> = {
  resistor: 1000,
  'voltage-source': 10,
  'current-source': 0.001,
  capacitor: 1e-6,
  inductor: 1e-3,
  diode: 0.7,
};

const KIND_TITLE: Record<ComponentKind, string> = {
  resistor: 'Resistencia',
  'voltage-source': 'Fuente de voltaje',
  'current-source': 'Fuente de corriente',
  capacitor: 'Capacitor',
  inductor: 'Inductor',
  diode: 'Diodo',
};

type Tool = 'select' | 'wire' | ComponentKind | 'ground';

/**
 * Vista que encuadra todo el circuito en un lienzo de w × h píxeles. Con `shrinkOnly` solo aleja
 * (no agranda un circuito pequeño) y deja el circuito arriba a la izquierda si ya cabe.
 */
function fitTransform(
  doc: CircuitDocument,
  w: number,
  h: number,
  shrinkOnly = false,
): ViewState | null {
  const pts: GridPoint[] = [];
  for (const c of doc.components) pts.push(c.a, c.b);
  for (const wire of doc.wires) pts.push(...wire.points);
  if (doc.ground) pts.push(doc.ground);
  if (pts.length === 0 || !w || !h) return null;
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const pad = 2;
  const width = maxX - minX + 2 * pad;
  const height = maxY - minY + 2 * pad;
  const fit = Math.min(w / width, h / height);
  if (shrinkOnly && fit >= DEFAULT_SCALE) return null;
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, shrinkOnly ? Math.min(fit, DEFAULT_SCALE) : fit),
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { scale, tx: w / 2 - cx * scale, ty: h / 2 - cy * scale };
}

function isComponentTool(tool: Tool): tool is ComponentKind {
  return tool !== 'select' && tool !== 'wire' && tool !== 'ground';
}

interface ViewState {
  scale: number;
  tx: number;
  ty: number;
}

/** Punto agarrable: terminal de componente, vértice de cable o tierra. */
type Handle =
  | { kind: 'terminal'; id: string; terminal: 'a' | 'b' }
  | { kind: 'wire-vertex'; id: string; index: number }
  | { kind: 'ground' };

type MoveItem =
  | { kind: 'component'; id: string; a: GridPoint; b: GridPoint }
  | { kind: 'wire'; id: string; points: GridPoint[] };

type Drag =
  | { kind: 'pan'; last: { x: number; y: number }; moved: boolean }
  | { kind: 'move'; grab: GridPoint; items: MoveItem[]; moved: boolean; historyPushed: boolean }
  | {
      kind: 'endpoint';
      handle: Handle;
      basePoints: GridPoint[] | null;
      moved: boolean;
      historyPushed: boolean;
    }
  | { kind: 'select-box'; start: GridPoint; current: GridPoint };

function keyOf(p: GridPoint) {
  return `${p.x},${p.y}`;
}

function samePoint(a: GridPoint, b: GridPoint) {
  return a.x === b.x && a.y === b.y;
}

function snapWorld(p: GridPoint): GridPoint {
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Formatea con notación de ingeniería, mostrando 0 cuando el valor es un residuo numérico. */
function fmtNumber(value: number, unit: string): string {
  if (Math.abs(value) < 1e-12) return `0 ${unit}`;
  return formatEngineering(value, unit);
}

/** ¿Dos segmentos ortogonales se solapan en un tramo (no solo en un punto)? */
function collinearOverlap(a1: GridPoint, a2: GridPoint, b1: GridPoint, b2: GridPoint): boolean {
  if (a1.x === a2.x && b1.x === b2.x && a1.x === b1.x) {
    const aMin = Math.min(a1.y, a2.y);
    const aMax = Math.max(a1.y, a2.y);
    const bMin = Math.min(b1.y, b2.y);
    const bMax = Math.max(b1.y, b2.y);
    return Math.max(aMin, bMin) < Math.min(aMax, bMax);
  }
  if (a1.y === a2.y && b1.y === b2.y && a1.y === b1.y) {
    const aMin = Math.min(a1.x, a2.x);
    const aMax = Math.max(a1.x, a2.x);
    const bMin = Math.min(b1.x, b2.x);
    const bMax = Math.max(b1.x, b2.x);
    return Math.max(aMin, bMin) < Math.min(aMax, bMax);
  }
  return false;
}

function distToSegment(p: GridPoint, a: GridPoint, b: GridPoint): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

function segmentConflicts(doc: CircuitDocument, a: GridPoint, b: GridPoint): boolean {
  for (const c of doc.components) {
    if (collinearOverlap(a, b, c.a, c.b)) return true;
  }
  for (const w of doc.wires) {
    for (let i = 0; i < w.points.length - 1; i++) {
      if (collinearOverlap(a, b, w.points[i]!, w.points[i + 1]!)) return true;
    }
  }
  return false;
}

/** Punto del circuito (terminal o nodo de cable) más cercano dentro de una tolerancia. */
function nearestAnchor(
  doc: CircuitDocument,
  p: GridPoint,
  tol: number,
  exclude?: GridPoint,
): GridPoint {
  const anchors: GridPoint[] = [];
  for (const c of doc.components) anchors.push(c.a, c.b);
  for (const w of doc.wires) anchors.push(...w.points);
  let best = p;
  let bestDist = tol;
  for (const q of anchors) {
    if (exclude && samePoint(q, exclude)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestDist) {
      bestDist = d;
      best = q;
    }
  }
  return best;
}

/** Reconstruye una polilínea ortogonal insertando codos donde haga falta. */
function orthogonalize(points: GridPoint[]): GridPoint[] {
  const out: GridPoint[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev) {
      if (prev.x !== p.x && prev.y !== p.y) out.push({ x: p.x, y: prev.y });
      if (samePoint(out[out.length - 1]!, p)) continue;
    }
    out.push(p);
  }
  return out;
}

function boxIntersects(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  a: GridPoint,
  b: GridPoint,
): boolean {
  const segMinX = Math.min(a.x, b.x);
  const segMaxX = Math.max(a.x, b.x);
  const segMinY = Math.min(a.y, b.y);
  const segMaxY = Math.max(a.y, b.y);
  return segMaxX >= box.minX && segMinX <= box.maxX && segMaxY >= box.minY && segMinY <= box.maxY;
}

export function CircuitBuilderField({
  name,
  kinds = RESISTIVE_KINDS,
}: {
  name: string;
  /** Componentes de la paleta (por defecto, los de los circuitos resistivos de cd). */
  kinds?: readonly ComponentKind[];
}) {
  // La simulación en vivo es de cd resistiva: con capacitores, inductores o diodos no aplica.
  const canSimulate = kinds.every((k) => RESISTIVE_KINDS.includes(k));
  const { control, getValues } = useFormContext();
  const { field } = useController({ name, control, defaultValue: emptyCircuit() });
  const doc: CircuitDocument = (field.value as CircuitDocument | undefined) ?? emptyCircuit();

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spaceRef = useRef(false);
  const autoFittedRef = useRef(false);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<ViewState>({ scale: DEFAULT_SCALE, tx: 24, ty: 24 });
  const [tool, setTool] = useState<Tool>('select');
  const [orientation, setOrientation] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pointer, setPointer] = useState<{ world: GridPoint; snapped: GridPoint } | null>(null);
  const [wireDraft, setWireDraft] = useState<GridPoint[]>([]);
  const [past, setPast] = useState<CircuitDocument[]>([]);
  const [future, setFuture] = useState<CircuitDocument[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  const selectedComponents = useMemo(
    () => doc.components.filter((c) => selectedIds.includes(c.id)),
    [doc.components, selectedIds],
  );
  const selectedWires = useMemo(
    () => doc.wires.filter((w) => selectedIds.includes(w.id)),
    [doc.wires, selectedIds],
  );
  const groundSelected = Boolean(doc.ground && selectedIds.includes(keyOf(doc.ground)));

  // ── Simulación (MNA) para animar la corriente y mostrar resultados ─────────
  const sim = useMemo(() => {
    if (!simulating) return null;
    const topology = buildTopology(doc);
    const structural = validateTopology(topology);
    if (structural) return { error: structural.message, currents: null, branches: [], maxAbs: 0 };
    const mna = solveMna(topology);
    if (!mna.ok) return { error: mna.message, currents: null, branches: [], maxAbs: 0 };
    const currents = new Map<string, number>();
    let maxAbs = 0;
    for (const b of mna.result.branchResults) {
      currents.set(b.id, b.i);
      maxAbs = Math.max(maxAbs, Math.abs(b.i));
    }
    return {
      error: null,
      currents,
      branches: mna.result.branchResults.map((b) => ({ id: b.id, label: b.label, i: b.i, p: b.p })),
      maxAbs,
    };
  }, [simulating, doc]);
  const powerBalance = sim?.branches?.reduce((s, b) => s + b.p, 0) ?? 0;

  // ── Medición del contenedor ────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize({ w, h });
      // La primera vez, si el ejemplo no cabe en el lienzo (p. ej. en un celular), se aleja.
      if (!autoFittedRef.current && w > 0 && h > 0) {
        autoFittedRef.current = true;
        const fitted = fitTransform(getValues(name) as CircuitDocument, w, h, true);
        if (fitted) setView(fitted);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [getValues, name]);

  // ── Rueda del ratón (zoom sobre el cursor) ─────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = svg!.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
    }
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // ── Atajos de teclado ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') spaceRef.current = false;
    }
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === ' ') {
        e.preventDefault();
        spaceRef.current = true;
        return;
      }
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        selectAll();
        return;
      }
      if (mod && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.key === 'Escape') {
        setTool('select');
        setWireDraft([]);
        setSelectedIds([]);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        if (selectedComponents.length > 0)
          for (const c of selectedComponents) rotateComponent(c.id);
        else setOrientation((o) => (o + 1) % 4);
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        flipSelected();
        return;
      }
      if (e.key === 'w' || e.key === 'W') {
        setTool('wire');
        setWireDraft([]);
      } else if (e.key === 'g' || e.key === 'G') {
        setTool('ground');
      } else if (e.key === 's' || e.key === 'S') {
        setTool('select');
      } else if ((e.key === 'k' || e.key === 'K') && canSimulate) {
        setSimulating((s) => !s);
      } else if (e.key.startsWith('Arrow') && selectedIds.length > 0) {
        e.preventDefault();
        const step: Record<string, [number, number]> = {
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
        };
        const d = step[e.key];
        if (d) nudge(d[0], d[1]);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  function flashMessage(message: string) {
    setFlash(message);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2200);
  }

  function commit(next: CircuitDocument) {
    setPast((p) => [...p.slice(-49), doc]);
    setFuture([]);
    field.onChange(next);
  }

  function undo() {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1]!;
      setFuture((f) => [doc, ...f].slice(0, 50));
      field.onChange(prev);
      return p.slice(0, -1);
    });
  }

  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0]!;
      setPast((p) => [...p.slice(-49), doc]);
      field.onChange(next);
      return f.slice(1);
    });
  }

  function zoomAt(factor: number, cx: number, cy: number) {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const k = scale / v.scale;
      return { scale, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
    });
  }

  function resetView() {
    setView({ scale: DEFAULT_SCALE, tx: 24, ty: 24 });
  }

  function fitView() {
    const fitted = fitTransform(doc, size.w, size.h);
    if (fitted) setView(fitted);
    else resetView();
  }

  function toWorld(clientX: number, clientY: number): GridPoint {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.tx) / view.scale,
      y: (clientY - rect.top - view.ty) / view.scale,
    };
  }

  function hitComponent(world: GridPoint, tol: number): CircuitComponent | undefined {
    let best: CircuitComponent | undefined;
    let bestDist = tol;
    for (const c of doc.components) {
      const d = distToSegment(world, c.a, c.b);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  function hitWire(world: GridPoint, tol: number): CircuitWire | undefined {
    let best: CircuitWire | undefined;
    let bestDist = tol;
    for (const w of doc.wires) {
      for (let i = 0; i < w.points.length - 1; i++) {
        const d = distToSegment(world, w.points[i]!, w.points[i + 1]!);
        if (d < bestDist) {
          bestDist = d;
          best = w;
        }
      }
    }
    return best;
  }

  function hitHandle(world: GridPoint, tol: number): Handle | null {
    let best: Handle | null = null;
    let bestDist = tol;
    const consider = (handle: Handle, point: GridPoint) => {
      const d = Math.hypot(world.x - point.x, world.y - point.y);
      if (d < bestDist) {
        bestDist = d;
        best = handle;
      }
    };
    for (const c of doc.components) {
      consider({ kind: 'terminal', id: c.id, terminal: 'a' }, c.a);
      consider({ kind: 'terminal', id: c.id, terminal: 'b' }, c.b);
    }
    for (const w of doc.wires) {
      w.points.forEach((p, index) => consider({ kind: 'wire-vertex', id: w.id, index }, p));
    }
    if (doc.ground) consider({ kind: 'ground' }, doc.ground);
    return best;
  }

  function handleOwnerId(handle: Handle): string {
    return handle.kind === 'ground' ? keyOf(doc.ground!) : handle.id;
  }

  function selectAll() {
    setSelectedIds([
      ...doc.components.map((c) => c.id),
      ...doc.wires.map((w) => w.id),
      ...(doc.ground ? [keyOf(doc.ground)] : []),
    ]);
  }

  function snapshotIds(ids: string[]): MoveItem[] {
    const items: MoveItem[] = [];
    for (const c of doc.components) {
      if (ids.includes(c.id))
        items.push({ kind: 'component', id: c.id, a: { ...c.a }, b: { ...c.b } });
    }
    for (const w of doc.wires) {
      if (ids.includes(w.id))
        items.push({ kind: 'wire', id: w.id, points: w.points.map((p) => ({ ...p })) });
    }
    return items;
  }

  function applyMove(items: MoveItem[], grab: GridPoint, snapped: GridPoint) {
    const dx = snapped.x - grab.x;
    const dy = snapped.y - grab.y;
    field.onChange({
      ...doc,
      components: doc.components.map((c) => {
        const item = items.find((i) => i.kind === 'component' && i.id === c.id);
        if (!item || item.kind !== 'component') return c;
        return {
          ...c,
          a: { x: item.a.x + dx, y: item.a.y + dy },
          b: { x: item.b.x + dx, y: item.b.y + dy },
        };
      }),
      wires: doc.wires.map((w) => {
        const item = items.find((i) => i.kind === 'wire' && i.id === w.id);
        if (!item || item.kind !== 'wire') return w;
        return { ...w, points: item.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
      }),
    });
  }

  function applyEndpoint(handle: Handle, snapped: GridPoint, basePoints: GridPoint[] | null) {
    if (handle.kind === 'ground') {
      field.onChange({ ...doc, ground: snapped });
      return;
    }
    if (handle.kind === 'terminal') {
      const c = doc.components.find((x) => x.id === handle.id);
      if (!c) return;
      const other = handle.terminal === 'a' ? c.b : c.a;
      const target = nearestAnchor(doc, snapped, 0.6, other);
      if (samePoint(target, other)) return;
      field.onChange({
        ...doc,
        components: doc.components.map((x) =>
          x.id === handle.id ? { ...x, [handle.terminal]: target } : x,
        ),
      });
      return;
    }
    const w = doc.wires.find((x) => x.id === handle.id);
    if (!w) return;
    const base = basePoints ?? w.points;
    const target = nearestAnchor(doc, snapped, 0.6, base[handle.index]);
    const points = orthogonalize(base.map((p, i) => (i === handle.index ? target : p)));
    if (points.length < 2) return;
    field.onChange({
      ...doc,
      wires: doc.wires.map((x) => (x.id === handle.id ? { ...x, points } : x)),
    });
  }

  function placeComponent(kind: ComponentKind, at: GridPoint) {
    const start = nearestAnchor(doc, at, 0.75);
    const dir = ORIENTATIONS[orientation]!;
    const a = start;
    const b = { x: start.x + dir.x * COMP_LEN, y: start.y + dir.y * COMP_LEN };
    if (segmentConflicts(doc, a, b)) {
      flashMessage('Ya hay un componente en esa posición. Gíralo con R o elige otro punto.');
      return;
    }
    const component: CircuitComponent = {
      id: uid(kind),
      kind,
      a,
      b,
      value: DEFAULT_VALUE[kind],
      label: nextLabel(doc, kind),
    };
    commit({ ...doc, components: [...doc.components, component] });
    setSelectedIds([component.id]);
  }

  function addWirePoint(p: GridPoint) {
    const at = nearestAnchor(doc, p, 0.6);
    setWireDraft((points) => {
      if (points.length === 0) return [at];
      const last = points[points.length - 1]!;
      if (samePoint(last, at)) return points;
      const next = [...points];
      if (at.x !== last.x && at.y !== last.y) next.push({ x: at.x, y: last.y });
      const from = next[next.length - 1]!;
      if (segmentConflicts(doc, from, at)) {
        flashMessage('Ese tramo se solapa con un componente existente.');
        return points;
      }
      next.push(at);
      return next;
    });
  }

  function finishWire() {
    setWireDraft((points) => {
      if (points.length >= 2) {
        const wire: CircuitWire = { id: uid('w'), points };
        commit({ ...doc, wires: [...doc.wires, wire] });
        setSelectedIds([wire.id]);
      }
      return [];
    });
    setTool('select');
  }

  function placeGround(at: GridPoint) {
    const anchor = nearestAnchor(doc, at, 0.75);
    commit({ ...doc, ground: anchor });
    setSelectedIds([keyOf(anchor)]);
    setTool('select');
  }

  function deleteSelected() {
    if (selectedIds.length === 0) return;
    commit({
      ...doc,
      components: doc.components.filter((c) => !selectedIds.includes(c.id)),
      wires: doc.wires.filter((w) => !selectedIds.includes(w.id)),
      ground: doc.ground && selectedIds.includes(keyOf(doc.ground)) ? undefined : doc.ground,
    });
    setSelectedIds([]);
  }

  function rotateComponent(id: string) {
    const c = doc.components.find((x) => x.id === id);
    if (!c) return;
    const dx = c.b.x - c.a.x;
    const dy = c.b.y - c.a.y;
    const b = { x: c.a.x - dy, y: c.a.y + dx };
    if (segmentConflicts(doc, c.a, b)) {
      flashMessage('No se puede girar: choca con otro componente.');
      return;
    }
    commit({ ...doc, components: doc.components.map((x) => (x.id === id ? { ...x, b } : x)) });
  }

  function flipSelected() {
    const sources = doc.components.filter(
      (c) => selectedIds.includes(c.id) && c.kind !== 'resistor',
    );
    if (sources.length === 0) {
      flashMessage(
        kinds.includes('diode')
          ? 'Selecciona una fuente o un diodo para voltear su polaridad.'
          : canSimulate
            ? 'Selecciona una fuente de voltaje o de corriente para voltear su polaridad.'
            : 'Selecciona una fuente, un capacitor o un inductor para voltear su polaridad.',
      );
      return;
    }
    commit({
      ...doc,
      components: doc.components.map((c) =>
        selectedIds.includes(c.id) ? { ...c, a: c.b, b: c.a } : c,
      ),
    });
  }

  function duplicateSelected() {
    if (selectedIds.length === 0) return;
    const components = doc.components.filter((c) => selectedIds.includes(c.id));
    const wires = doc.wires.filter((w) => selectedIds.includes(w.id));
    const pts: GridPoint[] = [];
    for (const c of components) pts.push(c.a, c.b);
    for (const w of wires) pts.push(...w.points);
    const maxX = pts.length ? Math.max(...pts.map((p) => p.x)) : 0;
    const minX = pts.length ? Math.min(...pts.map((p) => p.x)) : 0;
    const dx = maxX - minX + COMP_LEN + 1;
    const next: CircuitDocument = {
      components: [...doc.components],
      wires: [...doc.wires],
      ground: doc.ground,
    };
    const newIds: string[] = [];
    for (const c of components) {
      const id = uid(c.kind);
      next.components.push({
        ...c,
        id,
        a: { x: c.a.x + dx, y: c.a.y },
        b: { x: c.b.x + dx, y: c.b.y },
        label: nextLabel(next, c.kind),
      });
      newIds.push(id);
    }
    for (const w of wires) {
      const id = uid('w');
      next.wires.push({ id, points: w.points.map((p) => ({ x: p.x + dx, y: p.y })) });
      newIds.push(id);
    }
    if (doc.ground && selectedIds.includes(keyOf(doc.ground))) {
      next.ground = { x: doc.ground.x + dx, y: doc.ground.y };
      newIds.push(keyOf(next.ground));
    }
    commit(next);
    setSelectedIds(newIds);
  }

  function nudge(dx: number, dy: number) {
    commit({
      ...doc,
      components: doc.components.map((c) =>
        selectedIds.includes(c.id)
          ? { ...c, a: { x: c.a.x + dx, y: c.a.y + dy }, b: { x: c.b.x + dx, y: c.b.y + dy } }
          : c,
      ),
      wires: doc.wires.map((w) =>
        selectedIds.includes(w.id)
          ? { ...w, points: w.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
          : w,
      ),
      ground:
        doc.ground && selectedIds.includes(keyOf(doc.ground))
          ? { x: doc.ground.x + dx, y: doc.ground.y + dy }
          : doc.ground,
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  // ── Eventos de puntero ─────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const world = toWorld(e.clientX, e.clientY);
    const snapped = snapWorld(world);
    const tol = 9 / view.scale;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;

    if (e.button === 1 || e.button === 2) {
      dragRef.current = { kind: 'pan', last: { x: e.clientX, y: e.clientY }, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;

    if (spaceRef.current) {
      dragRef.current = { kind: 'pan', last: { x: e.clientX, y: e.clientY }, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (isComponentTool(tool)) {
      placeComponent(tool, snapped);
      return;
    }
    if (tool === 'wire') {
      addWirePoint(snapped);
      return;
    }
    if (tool === 'ground') {
      placeGround(snapped);
      return;
    }

    const handle = hitHandle(world, tol);
    if (handle) {
      const owner = handleOwnerId(handle);
      setSelectedIds(
        additive ? (selectedIds.includes(owner) ? selectedIds : [...selectedIds, owner]) : [owner],
      );
      const basePoints =
        handle.kind === 'wire-vertex'
          ? (doc.wires.find((w) => w.id === handle.id)?.points.map((p) => ({ ...p })) ?? null)
          : null;
      dragRef.current = {
        kind: 'endpoint',
        handle,
        basePoints,
        moved: false,
        historyPushed: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const component = hitComponent(world, tol);
    const wire = component ? undefined : hitWire(world, tol);
    const target = component?.id ?? wire?.id;
    if (target) {
      if (additive) {
        toggleSelected(target);
        return;
      }
      const ids = selectedIds.includes(target) ? selectedIds : [target];
      setSelectedIds(ids);
      dragRef.current = {
        kind: 'move',
        grab: snapped,
        items: snapshotIds(ids),
        moved: false,
        historyPushed: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (additive) {
      dragRef.current = { kind: 'select-box', start: world, current: world };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    setSelectedIds([]);
    dragRef.current = { kind: 'pan', last: { x: e.clientX, y: e.clientY }, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && dragRef.current?.kind === 'pan') {
      const pts = [...pointersRef.current.values()];
      const p1 = pts[0]!;
      const p2 = pts[1]!;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const prev = pinchRef.current;
      if (prev) {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          zoomAt(dist / prev.dist, mid.x - rect.left, mid.y - rect.top);
          setView((v) => ({
            ...v,
            tx: v.tx + (mid.x - prev.mid.x),
            ty: v.ty + (mid.y - prev.mid.y),
          }));
        }
      }
      pinchRef.current = { dist, mid };
      return;
    }

    const world = toWorld(e.clientX, e.clientY);
    const snapped = snapWorld(world);
    setPointer({ world, snapped });

    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === 'pan') {
      const dx = e.clientX - drag.last.x;
      const dy = e.clientY - drag.last.y;
      if (dx === 0 && dy === 0) return;
      drag.moved = true;
      drag.last = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
      return;
    }

    if (drag.kind === 'select-box') {
      drag.current = world;
      return;
    }

    if (!drag.historyPushed) {
      drag.historyPushed = true;
      setPast((p) => [...p.slice(-49), doc]);
      setFuture([]);
    }
    drag.moved = true;

    if (drag.kind === 'move') {
      applyMove(drag.items, drag.grab, snapped);
      return;
    }
    applyEndpoint(drag.handle, snapped, drag.basePoints);
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(e.pointerId);
    pinchRef.current = null;
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === 'select-box') {
      const minX = Math.min(drag.start.x, drag.current.x);
      const maxX = Math.max(drag.start.x, drag.current.x);
      const minY = Math.min(drag.start.y, drag.current.y);
      const maxY = Math.max(drag.start.y, drag.current.y);
      if (maxX - minX > 0.2 || maxY - minY > 0.2) {
        const box = { minX, minY, maxX, maxY };
        const ids: string[] = [];
        for (const c of doc.components) if (boxIntersects(box, c.a, c.b)) ids.push(c.id);
        for (const w of doc.wires) {
          for (let i = 0; i < w.points.length - 1; i++) {
            if (boxIntersects(box, w.points[i]!, w.points[i + 1]!)) {
              ids.push(w.id);
              break;
            }
          }
        }
        setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
      }
    }
  }

  function onDoubleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (tool === 'wire') {
      finishWire();
      return;
    }
    if (tool !== 'select') return;
    const world = toWorld(e.clientX, e.clientY);
    const tol = 9 / view.scale;

    // Quitar un codo interior si se hace doble clic sobre él.
    let vertex: { id: string; index: number } | null = null;
    let vertexDist = tol;
    for (const w of doc.wires) {
      for (let k = 1; k < w.points.length - 1; k++) {
        const p = w.points[k]!;
        const d = Math.hypot(world.x - p.x, world.y - p.y);
        if (d < vertexDist) {
          vertexDist = d;
          vertex = { id: w.id, index: k };
        }
      }
    }
    if (vertex) {
      const w = doc.wires.find((x) => x.id === vertex!.id)!;
      const prev = w.points[vertex.index - 1]!;
      const next = w.points[vertex.index + 1]!;
      if (prev.x === next.x || prev.y === next.y) {
        const points = w.points.filter((_, k) => k !== vertex!.index);
        commit({ ...doc, wires: doc.wires.map((x) => (x.id === w.id ? { ...x, points } : x)) });
        flashMessage('Codo eliminado.');
      } else {
        flashMessage('No se puede quitar el codo: el tramo quedaría en diagonal.');
      }
      return;
    }

    // Agregar un codo en el tramo de cable más cercano.
    let segment: { id: string; index: number } | null = null;
    let segmentDist = tol;
    for (const w of doc.wires) {
      for (let i = 0; i < w.points.length - 1; i++) {
        const d = distToSegment(world, w.points[i]!, w.points[i + 1]!);
        if (d < segmentDist) {
          segmentDist = d;
          segment = { id: w.id, index: i };
        }
      }
    }
    if (!segment) return;
    const w = doc.wires.find((x) => x.id === segment!.id)!;
    const a = w.points[segment.index]!;
    const b = w.points[segment.index + 1]!;
    const p = a.x === b.x ? { x: a.x, y: Math.round(world.y) } : { x: Math.round(world.x), y: a.y };
    const between =
      a.x === b.x
        ? p.y > Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y)
        : p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x);
    if (!between) return;
    const points = [
      ...w.points.slice(0, segment.index + 1),
      p,
      ...w.points.slice(segment.index + 1),
    ];
    commit({ ...doc, wires: doc.wires.map((x) => (x.id === w.id ? { ...x, points } : x)) });
    flashMessage('Codo agregado. Arrástralo para ajustarlo.');
  }

  // ── Rejilla visible ────────────────────────────────────────────────────────
  const grid = useMemo(() => {
    if (!size.w || !size.h) return null;
    const x0 = Math.floor(-view.tx / view.scale);
    const x1 = Math.ceil((size.w - view.tx) / view.scale);
    const y0 = Math.floor(-view.ty / view.scale);
    const y1 = Math.ceil((size.h - view.ty) / view.scale);
    if (x1 - x0 > 400 || y1 - y0 > 400) return null;
    return { x0, x1, y0, y1 };
  }, [size, view]);

  const previewComponent = useMemo(() => {
    if (tool === 'select' || tool === 'wire' || tool === 'ground' || !pointer) return null;
    const start = nearestAnchor(doc, pointer.snapped, 0.75);
    const dir = ORIENTATIONS[orientation]!;
    const a = start;
    const b = { x: start.x + dir.x * COMP_LEN, y: start.y + dir.y * COMP_LEN };
    return { a, b, conflict: segmentConflicts(doc, a, b) };
  }, [tool, pointer, orientation, doc]);

  const previewWire = useMemo(() => {
    if (tool !== 'wire' || !pointer || wireDraft.length === 0) return null;
    const last = wireDraft[wireDraft.length - 1]!;
    const hover = pointer.snapped;
    if (samePoint(last, hover)) return null;
    const elbow = hover.x !== last.x && hover.y !== last.y ? { x: hover.x, y: last.y } : null;
    return { last, hover, elbow };
  }, [tool, pointer, wireDraft]);

  const activeHandle = useMemo(
    () => (tool === 'select' && pointer ? hitHandle(pointer.world, 9 / view.scale) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, pointer, view.scale, doc],
  );

  const dragState = dragRef.current;
  const selectBox =
    dragState?.kind === 'select-box'
      ? {
          x: Math.min(dragState.start.x, dragState.current.x),
          y: Math.min(dragState.start.y, dragState.current.y),
          w: Math.abs(dragState.current.x - dragState.start.x),
          h: Math.abs(dragState.current.y - dragState.start.y),
        }
      : null;

  const statusHint =
    tool === 'select'
      ? 'Arrastra para mover o desplazar • los puntos se agarran a los nodos • Shift+arrastrar selecciona varios'
      : tool === 'wire'
        ? 'Clic para trazar el cable • doble clic o Esc para terminar'
        : tool === 'ground'
          ? 'Clic sobre un nodo para marcar la referencia (tierra)'
          : 'Clic para colocar • R para girar • Esc para cancelar';

  return (
    <div className="flex flex-col gap-3">
      {/* Paleta de herramientas */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolButton
          active={tool === 'select'}
          onClick={() => {
            setTool('select');
            setWireDraft([]);
          }}
          title="Seleccionar (S)"
        >
          <PaletteIcon kind="select" />
        </ToolButton>
        <ToolButton
          active={tool === 'wire'}
          onClick={() => {
            setTool('wire');
            setWireDraft([]);
          }}
          title="Cable (W)"
        >
          <PaletteIcon kind="wire" />
        </ToolButton>
        {kinds.map((kind) => (
          <ToolButton
            key={kind}
            active={tool === kind}
            onClick={() => setTool(kind)}
            title={KIND_TITLE[kind]}
          >
            <PaletteIcon kind={kind} />
          </ToolButton>
        ))}
        <ToolButton active={tool === 'ground'} onClick={() => setTool('ground')} title="Tierra (G)">
          <PaletteIcon kind="ground" />
        </ToolButton>

        <div className="bg-border mx-1 h-6 w-px" />
        <ToolButton onClick={() => setOrientation((o) => (o + 1) % 4)} title="Girar colocación (R)">
          <RotateCw className="size-4" />
        </ToolButton>
        <ToolButton
          onClick={flipSelected}
          disabled={selectedIds.length === 0}
          title="Voltear polaridad (F)"
        >
          <FlipHorizontal2 className="size-4" />
        </ToolButton>
        <ToolButton
          onClick={duplicateSelected}
          disabled={selectedIds.length === 0}
          title="Duplicar (Ctrl+D)"
        >
          <Copy className="size-4" />
        </ToolButton>
        <ToolButton onClick={selectAll} title="Seleccionar todo (Ctrl+A)">
          <BoxSelect className="size-4" />
        </ToolButton>
        <ToolButton onClick={undo} disabled={past.length === 0} title="Deshacer (Ctrl+Z)">
          <Undo2 className="size-4" />
        </ToolButton>
        <ToolButton onClick={redo} disabled={future.length === 0} title="Rehacer (Ctrl+Y)">
          <Redo2 className="size-4" />
        </ToolButton>
        <ToolButton
          onClick={deleteSelected}
          disabled={selectedIds.length === 0}
          title="Eliminar (Supr)"
        >
          <Trash2 className="size-4" />
        </ToolButton>
        {canSimulate && (
          <ToolButton
            active={simulating}
            onClick={() => setSimulating((s) => !s)}
            title={simulating ? 'Detener simulación (K)' : 'Simular corriente (K)'}
          >
            {simulating ? <Pause className="size-4" /> : <Play className="size-4" />}
          </ToolButton>
        )}
      </div>

      {/* Lienzo */}
      <div
        ref={containerRef}
        className="bg-card relative h-80 touch-none overflow-hidden rounded-md border select-none sm:h-96"
      >
        <svg
          ref={svgRef}
          data-testid="circuit-canvas"
          className={cn(
            'h-full w-full',
            tool === 'select' ? 'cursor-default' : 'cursor-crosshair',
            dragRef.current?.kind === 'move' && 'cursor-grabbing',
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
        >
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            {grid && (
              <g>
                {Array.from({ length: grid.x1 - grid.x0 + 1 }, (_, i) => {
                  const x = grid.x0 + i;
                  return (
                    <line
                      key={`gx-${x}`}
                      x1={x}
                      y1={grid.y0}
                      x2={x}
                      y2={grid.y1}
                      stroke="currentColor"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      className={x === 0 ? 'text-muted-foreground/60' : 'text-muted-foreground/20'}
                    />
                  );
                })}
                {Array.from({ length: grid.y1 - grid.y0 + 1 }, (_, i) => {
                  const y = grid.y0 + i;
                  return (
                    <line
                      key={`gy-${y}`}
                      x1={grid.x0}
                      y1={y}
                      x2={grid.x1}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      className={y === 0 ? 'text-muted-foreground/60' : 'text-muted-foreground/20'}
                    />
                  );
                })}
              </g>
            )}

            {/* Cables */}
            {doc.wires.map((w) => {
              const selected = selectedIds.includes(w.id);
              return (
                <polyline
                  key={w.id}
                  points={w.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={selected ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className={cn('cursor-pointer', selected ? 'text-primary' : 'text-foreground')}
                />
              );
            })}

            {/* Vista previa del cable */}
            {previewWire && (
              <polyline
                points={
                  previewWire.elbow
                    ? `${previewWire.last.x},${previewWire.last.y} ${previewWire.elbow.x},${previewWire.elbow.y} ${previewWire.hover.x},${previewWire.hover.y}`
                    : `${previewWire.last.x},${previewWire.last.y} ${previewWire.hover.x},${previewWire.hover.y}`
                }
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                className="text-primary/70"
              />
            )}

            {/* Componentes */}
            {doc.components.map((c) => {
              const selected = selectedIds.includes(c.id);
              return (
                <g key={c.id}>
                  {selected && (
                    <line
                      x1={c.a.x}
                      y1={c.a.y}
                      x2={c.b.x}
                      y2={c.b.y}
                      stroke="currentColor"
                      strokeWidth={7}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      className="text-primary/25"
                    />
                  )}
                  <ComponentShape c={c} selected={selected} />
                  <ComponentLabel component={c} />
                </g>
              );
            })}

            {/* Animación de corriente */}
            {sim?.currents &&
              doc.components.map((c) => {
                const i = sim.currents!.get(c.id);
                if (i === undefined || Math.abs(i) < 1e-12 || sim.maxAbs <= 0) return null;
                const norm = Math.min(1, Math.abs(i) / sim.maxAbs);
                const dur = (1.6 - 1.1 * norm).toFixed(2);
                const [from, to] = i >= 0 ? [c.a, c.b] : [c.b, c.a];
                const key = `${c.id}-${i >= 0 ? 'f' : 'r'}-${dur}`;
                return (
                  <g key={key} className="text-primary pointer-events-none">
                    <circle r={0.12} className="fill-current">
                      <animateMotion
                        dur={`${dur}s`}
                        repeatCount="indefinite"
                        path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                      />
                    </circle>
                    <circle r={0.12} className="fill-current" opacity={0.7}>
                      <animateMotion
                        dur={`${dur}s`}
                        begin={`-${(Number(dur) / 2).toFixed(2)}s`}
                        repeatCount="indefinite"
                        path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                      />
                    </circle>
                  </g>
                );
              })}

            {/* Tierra */}
            {doc.ground && (
              <g
                className={cn(
                  groundSelected ? 'text-primary' : 'text-foreground',
                  activeHandle?.kind === 'ground' && 'text-primary',
                )}
              >
                <GroundSymbol p={doc.ground} />
              </g>
            )}

            {/* Puntos agarrables: terminales */}
            {doc.components.flatMap((c) => [
              <circle
                key={`${c.id}-a`}
                cx={c.a.x}
                cy={c.a.y}
                r={handleRadius(activeHandle, { kind: 'terminal', id: c.id, terminal: 'a' })}
                className={
                  isActiveHandle(activeHandle, { kind: 'terminal', id: c.id, terminal: 'a' })
                    ? 'fill-primary'
                    : 'fill-foreground'
                }
              />,
              <circle
                key={`${c.id}-b`}
                cx={c.b.x}
                cy={c.b.y}
                r={handleRadius(activeHandle, { kind: 'terminal', id: c.id, terminal: 'b' })}
                className={
                  isActiveHandle(activeHandle, { kind: 'terminal', id: c.id, terminal: 'b' })
                    ? 'fill-primary'
                    : 'fill-foreground'
                }
              />,
            ])}

            {/* Puntos agarrables: vértices de cable */}
            {doc.wires.flatMap((w) =>
              w.points.map((p, index) => {
                const handle: Handle = { kind: 'wire-vertex', id: w.id, index };
                const active = isActiveHandle(activeHandle, handle);
                return (
                  <circle
                    key={`${w.id}-${index}`}
                    cx={p.x}
                    cy={p.y}
                    r={handleRadius(activeHandle, handle)}
                    className={active ? 'fill-primary' : 'fill-muted-foreground'}
                  />
                );
              }),
            )}

            {/* Recuadro de selección */}
            {selectBox && (
              <rect
                x={selectBox.x}
                y={selectBox.y}
                width={selectBox.w}
                height={selectBox.h}
                fill="currentColor"
                className="text-primary/10"
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Vista previa del componente */}
            {previewComponent && tool !== 'wire' && tool !== 'ground' && (
              <g
                className={cn(
                  'pointer-events-none',
                  previewComponent.conflict ? 'text-destructive' : 'text-primary',
                )}
                opacity={0.75}
              >
                <ComponentShape
                  c={{
                    id: 'preview',
                    kind: tool as ComponentKind,
                    a: previewComponent.a,
                    b: previewComponent.b,
                    value: DEFAULT_VALUE[tool as ComponentKind],
                  }}
                />
              </g>
            )}
          </g>
        </svg>

        {/* Controles de zoom */}
        <div className="bg-card/90 absolute right-2 bottom-2 flex flex-col overflow-hidden rounded-md border shadow-sm">
          <button
            type="button"
            className="hover:bg-accent px-2 py-1 text-sm"
            onClick={() => zoomAt(1.2, size.w / 2, size.h / 2)}
            title="Acercar"
          >
            +
          </button>
          <button
            type="button"
            className="hover:bg-accent border-y px-2 py-1 text-xs"
            onClick={fitView}
            title="Ajustar al circuito"
          >
            <Maximize2 className="mx-auto size-3.5" />
          </button>
          <button
            type="button"
            className="hover:bg-accent border-b px-2 py-1 text-xs"
            onClick={resetView}
            title="Restablecer vista (100 %)"
          >
            ⌂
          </button>
          <button
            type="button"
            className="hover:bg-accent px-2 py-1 text-sm"
            onClick={() => zoomAt(1 / 1.2, size.w / 2, size.h / 2)}
            title="Alejar"
          >
            −
          </button>
        </div>

        {/* Terminar el cable (útil en pantallas táctiles, sin doble clic) */}
        {tool === 'wire' && wireDraft.length > 0 && (
          <div className="absolute top-2 right-2 flex gap-1.5">
            {wireDraft.length >= 2 && (
              <Button type="button" size="sm" onClick={finishWire} className="shadow-sm">
                <Check className="size-4" aria-hidden />
                Terminar cable
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-card/90 shadow-sm"
              onClick={() => setWireDraft([])}
            >
              <X className="size-4" aria-hidden />
              Cancelar
            </Button>
          </div>
        )}

        {/* Aviso flotante */}
        {flash && (
          <div className="bg-destructive text-destructive-foreground absolute bottom-2 left-2 max-w-[80%] rounded-md px-3 py-1.5 text-xs shadow-md">
            {flash}
          </div>
        )}
        {sim?.error && (
          <div className="bg-muted text-muted-foreground absolute top-2 left-2 max-w-[80%] rounded-md px-3 py-1.5 text-xs shadow-sm">
            {sim.error}
          </div>
        )}
      </div>

      {/* Barra de estado */}
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>{statusHint}</span>
        <span className="font-mono">
          {doc.components.length} comp · {doc.wires.length} cables · zoom{' '}
          {Math.round((view.scale / DEFAULT_SCALE) * 100)}%
          {selectedIds.length > 0 && ` · ${selectedIds.length} sel.`}
        </span>
      </div>

      {/* Resultados de la simulación */}
      {sim && !sim.error && sim.branches.length > 0 && (
        <div className="rounded-md border p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Resultados de la simulación</span>
            <span className="text-muted-foreground text-xs">
              balance de potencias: {fmtNumber(powerBalance, 'W')}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rama</TableHead>
                <TableHead className="text-right">Corriente</TableHead>
                <TableHead className="text-right">Potencia</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sim.branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono">{b.label}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNumber(b.i, 'A')}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNumber(b.p, 'W')}</TableCell>
                  <TableCell className="text-right">
                    {Math.abs(b.p) < 1e-12 ? '—' : b.p > 0 ? 'absorbe' : 'entrega'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Propiedades */}
      <PropertiesPanel
        doc={doc}
        selectedComponents={selectedComponents}
        selectedWires={selectedWires}
        groundSelected={groundSelected}
        onDelete={deleteSelected}
        onRotate={rotateComponent}
        onChange={(next) => field.onChange(next)}
      />

      {/* Guía del tablero */}
      <BuilderGuide kinds={kinds} canSimulate={canSimulate} />
    </div>
  );
}

function isActiveHandle(a: Handle | null, b: Handle): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === 'terminal' && b.kind === 'terminal')
    return a.id === b.id && a.terminal === b.terminal;
  if (a.kind === 'wire-vertex' && b.kind === 'wire-vertex')
    return a.id === b.id && a.index === b.index;
  return a.kind === 'ground' && b.kind === 'ground';
}

function handleRadius(active: Handle | null, handle: Handle): number {
  return isActiveHandle(active, handle) ? 0.22 : 0.12;
}

function ComponentLabel({ component }: { component: CircuitComponent }) {
  const m = midpoint(component.a, component.b);
  const vertical =
    Math.abs(component.b.y - component.a.y) > Math.abs(component.b.x - component.a.x);
  // En un diodo el valor es su V_K: se escribe «D1 · 0.7 V», como en los libros.
  const text =
    component.kind === 'diode'
      ? `${componentLabel(component)} · ${Number(component.value.toFixed(3))} V`
      : `${componentLabel(component)} = ${formatEngineering(component.value, componentUnit(component.kind))}`;
  if (vertical) {
    return (
      <text
        transform={`translate(${m.x - 0.24} ${m.y}) rotate(-90)`}
        fontSize={0.42}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-current select-none"
      >
        {text}
      </text>
    );
  }
  return (
    <text
      x={m.x}
      y={m.y - 0.42}
      fontSize={0.42}
      textAnchor="middle"
      className="fill-current select-none"
    >
      {text}
    </text>
  );
}

function ToolButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="icon"
      className="size-9"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}

function PropertiesPanel({
  doc,
  selectedComponents,
  selectedWires,
  groundSelected,
  onDelete,
  onRotate,
  onChange,
}: {
  doc: CircuitDocument;
  selectedComponents: CircuitComponent[];
  selectedWires: CircuitWire[];
  groundSelected: boolean;
  onDelete: () => void;
  onRotate: (id: string) => void;
  onChange: (doc: CircuitDocument) => void;
}) {
  const single = selectedComponents.length === 1 ? selectedComponents[0]! : null;

  if (single) {
    return (
      <div className="flex flex-col gap-3 rounded-md border p-3" key={single.id}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {componentLabel(single)} ·{' '}
            {single.kind === 'diode' ? 'diodo (ánodo → cátodo)' : componentUnit(single.kind)}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onRotate(single.id)}>
              Girar
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              Eliminar
            </Button>
          </div>
        </div>
        <ValueAndLabelEditor doc={doc} component={single} onChange={onChange} />
      </div>
    );
  }

  const total = selectedComponents.length + selectedWires.length + (groundSelected ? 1 : 0);
  if (total > 0) {
    const parts = [
      selectedComponents.length > 0 && `${selectedComponents.length} componente(s)`,
      selectedWires.length > 0 && `${selectedWires.length} cable(s)`,
      groundSelected && 'tierra',
    ].filter(Boolean);
    return (
      <div className="flex items-center justify-between rounded-md border p-3">
        <span className="text-sm font-medium">{parts.join(' · ')}</span>
        <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
          Eliminar
        </Button>
      </div>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      Selecciona un componente para editar su valor y su etiqueta. La guía del tablero, abajo,
      explica cada acción y sus atajos.
    </p>
  );
}

function ValueAndLabelEditor({
  doc,
  component,
  onChange,
}: {
  doc: CircuitDocument;
  component: CircuitComponent;
  onChange: (doc: CircuitDocument) => void;
}) {
  const unit = componentUnit(component.kind);
  const storage = component.kind === 'capacitor' || component.kind === 'inductor';
  const diode = component.kind === 'diode';
  const initialUnit = component.kind === 'capacitor' ? 'V' : 'A';
  const [textValue, setTextValue] = useState(() =>
    diode ? `${Number(component.value.toFixed(4))} V` : formatEngineering(component.value, unit),
  );
  const [textInitial, setTextInitial] = useState(() =>
    formatEngineering(component.initial ?? 0, initialUnit),
  );
  const [invalid, setInvalid] = useState<'valor' | 'inicial' | null>(null);

  function update(patch: Partial<CircuitComponent>) {
    onChange({
      ...doc,
      components: doc.components.map((c) => (c.id === component.id ? { ...c, ...patch } : c)),
    });
  }

  function updateValue(raw: string) {
    const parsed = parseEngineering(raw);
    // V_K puede ser 0 (diodo ideal); los demás valores deben ser positivos.
    if (parsed === null || parsed < 0 || (parsed === 0 && !diode)) {
      setInvalid('valor');
      return;
    }
    setInvalid(null);
    update({ value: parsed });
  }

  function updateInitial(raw: string) {
    const parsed = parseEngineering(raw);
    if (parsed === null) {
      setInvalid('inicial');
      return;
    }
    setInvalid(null);
    update({ initial: parsed });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={cn('grid grid-cols-2 gap-3', storage && 'sm:grid-cols-3')}>
        <div>
          <label htmlFor={`${component.id}-valor`} className="text-muted-foreground text-xs">
            {diode ? 'V_K, umbral (V)' : `Valor (${unit})`}
          </label>
          <Input
            id={`${component.id}-valor`}
            type="text"
            inputMode="decimal"
            className="font-mono"
            aria-invalid={invalid === 'valor'}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={(e) => updateValue(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${component.id}-etiqueta`} className="text-muted-foreground text-xs">
            Etiqueta
          </label>
          <Input
            id={`${component.id}-etiqueta`}
            type="text"
            className="font-mono"
            value={component.label ?? ''}
            onChange={(e) => update({ label: e.target.value })}
          />
        </div>
        {storage && (
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor={`${component.id}-inicial`} className="text-muted-foreground text-xs">
              {component.kind === 'capacitor' ? 'v_C(0) (V)' : 'i_L(0) (A)'}
            </label>
            <Input
              id={`${component.id}-inicial`}
              type="text"
              inputMode="decimal"
              className="font-mono"
              aria-invalid={invalid === 'inicial'}
              value={textInitial}
              onChange={(e) => setTextInitial(e.target.value)}
              onBlur={(e) => updateInitial(e.target.value)}
            />
          </div>
        )}
      </div>
      {invalid && (
        <p className="text-destructive text-xs" role="alert">
          {invalid === 'valor'
            ? diode
              ? 'Escribe el umbral en voltios: 0.7 (silicio), 0.3 (germanio), 1.8 (LED rojo).'
              : 'Escribe un número positivo, p. ej. 2.2k, 470m o 10µ.'
            : 'Escribe un número, p. ej. 5, −0.3 o 150m.'}
        </p>
      )}
    </div>
  );
}
