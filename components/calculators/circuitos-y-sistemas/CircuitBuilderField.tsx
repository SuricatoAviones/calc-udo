'use client';

import { useController, useFormContext } from 'react-hook-form';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  componentLabel,
  componentUnit,
  emptyCircuit,
  formatEngineering,
  nextLabel,
  parseEngineering,
  type CircuitComponent,
  type CircuitDocument,
  type CircuitWire,
  type ComponentKind,
  type GridPoint,
} from '@/lib/calculators/circuitos-y-sistemas/circuit';
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
};

type Tool = 'select' | 'wire' | ComponentKind | 'ground';

interface ViewState {
  scale: number;
  tx: number;
  ty: number;
}

type Drag =
  | { kind: 'pan'; last: { x: number; y: number }; moved: boolean }
  | {
      kind: 'move';
      id: string;
      grab: GridPoint;
      originA: GridPoint;
      originB: GridPoint;
      moved: boolean;
      historyPushed: boolean;
    };

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
function nearestAnchor(doc: CircuitDocument, p: GridPoint, tol: number): GridPoint {
  const anchors: GridPoint[] = [];
  for (const c of doc.components) anchors.push(c.a, c.b);
  for (const w of doc.wires) anchors.push(...w.points);
  let best = p;
  let bestDist = tol;
  for (const q of anchors) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestDist) {
      bestDist = d;
      best = q;
    }
  }
  return best;
}

export function CircuitBuilderField({ name }: { name: string }) {
  const { control } = useFormContext();
  const { field } = useController({ name, control, defaultValue: emptyCircuit() });
  const doc: CircuitDocument = (field.value as CircuitDocument | undefined) ?? emptyCircuit();

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<ViewState>({ scale: DEFAULT_SCALE, tx: 24, ty: 24 });
  const [tool, setTool] = useState<Tool>('select');
  const [orientation, setOrientation] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<GridPoint | null>(null);
  const [wireDraft, setWireDraft] = useState<GridPoint[]>([]);
  const [past, setPast] = useState<CircuitDocument[]>([]);
  const [future, setFuture] = useState<CircuitDocument[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const selectedComponent = useMemo(
    () => doc.components.find((c) => c.id === selectedId) ?? null,
    [doc.components, selectedId],
  );
  const selectedWire = useMemo(
    () => doc.wires.find((w) => w.id === selectedId) ?? null,
    [doc.wires, selectedId],
  );

  // ── Medición del contenedor ────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'Escape') {
        setTool('select');
        setWireDraft([]);
        setHover(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        if (selectedComponent) rotateComponent(selectedComponent.id);
        else setOrientation((o) => (o + 1) % 4);
        return;
      }
      if (e.key === 'w' || e.key === 'W') {
        setTool('wire');
        setWireDraft([]);
      } else if (e.key === 'g' || e.key === 'G') {
        setTool('ground');
      } else if (e.key === 's' || e.key === 'S') {
        setTool('select');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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

  function placeComponent(kind: ComponentKind, at: GridPoint) {
    const dir = ORIENTATIONS[orientation]!;
    const a = at;
    const b = { x: at.x + dir.x * COMP_LEN, y: at.y + dir.y * COMP_LEN };
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
    setSelectedId(component.id);
  }

  function addWirePoint(p: GridPoint) {
    setWireDraft((points) => {
      if (points.length === 0) return [p];
      const last = points[points.length - 1]!;
      if (samePoint(last, p)) return points;
      const next = [...points];
      if (p.x !== last.x && p.y !== last.y) next.push({ x: p.x, y: last.y });
      const from = next[next.length - 1]!;
      if (segmentConflicts(doc, from, p)) {
        flashMessage('Ese tramo se solapa con un componente existente.');
        return points;
      }
      next.push(p);
      return next;
    });
  }

  function finishWire() {
    setWireDraft((points) => {
      if (points.length >= 2) {
        const wire: CircuitWire = { id: uid('w'), points };
        commit({ ...doc, wires: [...doc.wires, wire] });
        setSelectedId(wire.id);
      }
      return [];
    });
    setTool('select');
  }

  function placeGround(at: GridPoint) {
    const anchor = nearestAnchor(doc, at, 0.6);
    commit({ ...doc, ground: anchor });
    setSelectedId(keyOf(anchor));
    setTool('select');
  }

  function deleteSelected() {
    if (!selectedId) return;
    const isGround = doc.ground ? keyOf(doc.ground) === selectedId : false;
    commit({
      ...doc,
      components: doc.components.filter((c) => c.id !== selectedId),
      wires: doc.wires.filter((w) => w.id !== selectedId),
      ground: isGround ? undefined : doc.ground,
    });
    setSelectedId(null);
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

  // ── Eventos de puntero ─────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const world = toWorld(e.clientX, e.clientY);
    const snapped = snapWorld(world);
    const tol = 9 / view.scale;

    if (e.button === 1 || e.button === 2) {
      // Botón central o derecho: paneo.
      dragRef.current = { kind: 'pan', last: { x: e.clientX, y: e.clientY }, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;

    if (tool === 'resistor' || tool === 'voltage-source' || tool === 'current-source') {
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

    // Herramienta de selección.
    const component = hitComponent(world, tol);
    if (component) {
      setSelectedId(component.id);
      dragRef.current = {
        kind: 'move',
        id: component.id,
        grab: snapped,
        originA: { ...component.a },
        originB: { ...component.b },
        moved: false,
        historyPushed: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const wire = hitWire(world, tol);
    if (wire) {
      setSelectedId(wire.id);
      return;
    }
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
    if (tool !== 'select') setHover(snapped);

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

    // Arrastre de un componente completo.
    if (!drag.moved) {
      drag.moved = true;
      if (!drag.historyPushed) {
        drag.historyPushed = true;
        setPast((p) => [...p.slice(-49), doc]);
        setFuture([]);
      }
    }
    const dx = snapped.x - drag.grab.x;
    const dy = snapped.y - drag.grab.y;
    const next: CircuitDocument = {
      ...doc,
      components: doc.components.map((c) =>
        c.id === drag.id
          ? {
              ...c,
              a: { x: drag.originA.x + dx, y: drag.originA.y + dy },
              b: { x: drag.originB.x + dx, y: drag.originB.y + dy },
            }
          : c,
      ),
    };
    field.onChange(next);
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(e.pointerId);
    pinchRef.current = null;
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === 'pan' && !drag.moved) setSelectedId(null);
  }

  function onDoubleClick() {
    if (tool === 'wire' && wireDraft.length >= 2) finishWire();
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
    if (tool === 'select' || tool === 'wire' || tool === 'ground' || !hover) return null;
    const dir = ORIENTATIONS[orientation]!;
    const a = hover;
    const b = { x: a.x + dir.x * COMP_LEN, y: a.y + dir.y * COMP_LEN };
    return { a, b, conflict: segmentConflicts(doc, a, b) };
  }, [tool, hover, orientation, doc]);

  const previewWire = useMemo(() => {
    if (tool !== 'wire' || !hover || wireDraft.length === 0) return null;
    const last = wireDraft[wireDraft.length - 1]!;
    if (samePoint(last, hover)) return null;
    const elbow = hover.x !== last.x && hover.y !== last.y ? { x: hover.x, y: last.y } : null;
    return { last, hover, elbow };
  }, [tool, hover, wireDraft]);

  const statusHint =
    tool === 'select'
      ? 'Arrastra para mover • Rueda para zoom • clic derecho o botón central para desplazar'
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
        <ToolButton
          active={tool === 'resistor'}
          onClick={() => setTool('resistor')}
          title="Resistencia"
        >
          <PaletteIcon kind="resistor" />
        </ToolButton>
        <ToolButton
          active={tool === 'voltage-source'}
          onClick={() => setTool('voltage-source')}
          title="Fuente de voltaje"
        >
          <PaletteIcon kind="voltage-source" />
        </ToolButton>
        <ToolButton
          active={tool === 'current-source'}
          onClick={() => setTool('current-source')}
          title="Fuente de corriente"
        >
          <PaletteIcon kind="current-source" />
        </ToolButton>
        <ToolButton active={tool === 'ground'} onClick={() => setTool('ground')} title="Tierra (G)">
          <PaletteIcon kind="ground" />
        </ToolButton>

        <div className="bg-border mx-1 h-6 w-px" />
        <ToolButton onClick={() => setOrientation((o) => (o + 1) % 4)} title="Girar (R)">
          <span className="text-xs font-semibold">↻</span>
        </ToolButton>
        <ToolButton onClick={undo} disabled={past.length === 0} title="Deshacer (Ctrl+Z)">
          <span className="text-xs font-semibold">↶</span>
        </ToolButton>
        <ToolButton onClick={redo} disabled={future.length === 0} title="Rehacer">
          <span className="text-xs font-semibold">↷</span>
        </ToolButton>
        <ToolButton onClick={deleteSelected} disabled={!selectedId} title="Eliminar (Supr)">
          <span className="text-xs font-semibold">🗑</span>
        </ToolButton>
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
            {doc.wires.map((w) => (
              <g key={w.id} className={selectedId === w.id ? 'text-primary' : 'text-foreground'}>
                <polyline
                  points={w.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={selectedId === w.id ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer"
                />
              </g>
            ))}

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
            {doc.components.map((c) => (
              <g key={c.id}>
                {selectedId === c.id && (
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
                <ComponentShape c={c} selected={selectedId === c.id} />
                <ComponentLabel component={c} />
                <circle cx={c.a.x} cy={c.a.y} r={0.1} className="fill-foreground" />
                <circle cx={c.b.x} cy={c.b.y} r={0.1} className="fill-foreground" />
              </g>
            ))}

            {/* Tierra */}
            {doc.ground && (
              <g
                className={selectedId === keyOf(doc.ground) ? 'text-primary' : 'text-foreground'}
                onClick={() => setSelectedId(keyOf(doc.ground!))}
              >
                <GroundSymbol p={doc.ground} />
              </g>
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
            onClick={resetView}
            title="Restablecer vista"
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

        {/* Aviso flotante */}
        {flash && (
          <div className="bg-destructive text-destructive-foreground absolute bottom-2 left-2 max-w-[80%] rounded-md px-3 py-1.5 text-xs shadow-md">
            {flash}
          </div>
        )}
      </div>

      {/* Barra de estado */}
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>{statusHint}</span>
        <span className="font-mono">
          {doc.components.length} comp · {doc.wires.length} cables · zoom{' '}
          {Math.round((view.scale / DEFAULT_SCALE) * 100)}%
        </span>
      </div>

      {/* Propiedades */}
      <PropertiesPanel
        doc={doc}
        component={selectedComponent}
        wire={selectedWire}
        isGround={Boolean(selectedId && doc.ground && keyOf(doc.ground) === selectedId)}
        onDelete={deleteSelected}
        onRotate={rotateComponent}
        onChange={(next) => field.onChange(next)}
      />
    </div>
  );
}

function ComponentLabel({ component }: { component: CircuitComponent }) {
  const m = midpoint(component.a, component.b);
  const vertical =
    Math.abs(component.b.y - component.a.y) > Math.abs(component.b.x - component.a.x);
  const text = `${componentLabel(component)} = ${formatEngineering(component.value, componentUnit(component.kind))}`;
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
  component,
  wire,
  isGround,
  onDelete,
  onRotate,
  onChange,
}: {
  doc: CircuitDocument;
  component: CircuitComponent | null;
  wire: CircuitWire | null;
  isGround: boolean;
  onDelete: () => void;
  onRotate: (id: string) => void;
  onChange: (doc: CircuitDocument) => void;
}) {
  if (component) {
    return (
      <div className="flex flex-col gap-3 rounded-md border p-3" key={component.id}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {componentLabel(component)} · {componentUnit(component.kind)}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRotate(component.id)}
            >
              Girar
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              Eliminar
            </Button>
          </div>
        </div>
        <ValueAndLabelEditor doc={doc} component={component} onChange={onChange} />
      </div>
    );
  }

  if (wire || isGround) {
    return (
      <div className="flex items-center justify-between rounded-md border p-3">
        <span className="text-sm font-medium">
          {wire ? 'Cable seleccionado' : 'Tierra (referencia)'}
        </span>
        <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
          Eliminar
        </Button>
      </div>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      Elige una herramienta y haz clic en la cuadrícula. En modo selección puedes arrastrar
      componentes y cables; con <kbd>R</kbd> giras y con <kbd>Supr</kbd> eliminas.
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
  const [textValue, setTextValue] = useState(() =>
    formatEngineering(component.value, componentUnit(component.kind)),
  );

  function updateValue(raw: string) {
    const parsed = parseEngineering(raw);
    if (parsed === null || parsed <= 0) return;
    onChange({
      ...doc,
      components: doc.components.map((c) => (c.id === component.id ? { ...c, value: parsed } : c)),
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-muted-foreground text-xs">Valor</label>
        <Input
          type="text"
          inputMode="decimal"
          className="font-mono"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={(e) => updateValue(e.target.value)}
        />
      </div>
      <div>
        <label className="text-muted-foreground text-xs">Etiqueta</label>
        <Input
          type="text"
          className="font-mono"
          value={component.label ?? ''}
          onChange={(e) =>
            onChange({
              ...doc,
              components: doc.components.map((c) =>
                c.id === component.id ? { ...c, label: e.target.value } : c,
              ),
            })
          }
        />
      </div>
    </div>
  );
}
