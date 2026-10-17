'use client';

import {
  Cable,
  Circle,
  Expand,
  LogIn,
  LogOut,
  Maximize2,
  MousePointer2,
  Redo2,
  RotateCw,
  Shrink,
  Square,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useController, useFormContext } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BLOCK_HALF,
  SUM_PORTS,
  SUM_RADIUS,
  buildSignals,
  elementTerminals,
  junctionPoints,
  leftOf,
  onSegment,
  unit,
  type BdElement,
  type BdKind,
  type BdPoint,
  type BdWire,
  type BlockDiagramDocument,
  type Direction,
  type SumPort,
} from '@/lib/calculators/sistemas-dinamicos/block-diagram';
import { gainPreviewTex } from '@/lib/calculators/sistemas-dinamicos/symbolic';
import { cn } from '@/lib/utils';

type Tool = 'select' | 'wire' | BdKind;

interface View {
  scale: number;
  ox: number;
  oy: number;
}

type Selection = { kind: 'element' | 'wire'; id: string } | null;

type Drag =
  | { kind: 'pan'; x: number; y: number; view: View }
  | { kind: 'element'; id: string; start: BdPoint; doc: BlockDiagramDocument; moved: boolean }
  | null;

const MIN_SCALE = 8;
const MAX_SCALE = 48;
const EMPTY: BlockDiagramDocument = { elements: [], wires: [] };

const TOOLS: { tool: Tool; label: string; icon: LucideIcon; key: string }[] = [
  { tool: 'select', label: 'Seleccionar y mover', icon: MousePointer2, key: 'V' },
  { tool: 'block', label: 'Bloque G(s)', icon: Square, key: 'B' },
  { tool: 'sum', label: 'Punto suma', icon: Circle, key: 'S' },
  { tool: 'wire', label: 'Cable', icon: Cable, key: 'W' },
  { tool: 'input', label: 'Entrada R(s)', icon: LogIn, key: 'E' },
  { tool: 'output', label: 'Salida C(s)', icon: LogOut, key: 'O' },
];

let counter = 0;
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

const same = (a: BdPoint, b: BdPoint) => a.x === b.x && a.y === b.y;
const rotate = (d: Direction, k = 1): Direction => ((((d + k) % 4) + 4) % 4) as Direction;

/** Nombre del lado de la pantalla hacia el que apunta un vector unitario. */
function sideName(v: BdPoint): string {
  if (v.x < 0) return 'izquierda';
  if (v.x > 0) return 'derecha';
  return v.y < 0 ? 'arriba' : 'abajo';
}

function portVector(e: BdElement, port: SumPort): BdPoint {
  const u = unit(e.dir);
  const l = leftOf(e.dir);
  if (port === 'back') return { x: -u.x, y: -u.y };
  if (port === 'left') return l;
  return { x: -l.x, y: -l.y };
}

function hitElement(e: BdElement, p: BdPoint): boolean {
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  if (e.kind === 'block') {
    const u = unit(e.dir);
    const along = dx * u.x + dy * u.y;
    const across = -dx * u.y + dy * u.x;
    return Math.abs(along) <= BLOCK_HALF && Math.abs(across) <= 1;
  }
  if (e.kind === 'sum') return Math.hypot(dx, dy) <= SUM_RADIUS + 0.2;
  return Math.hypot(dx, dy) <= 1;
}

function distanceToSegment(p: BdPoint, a: BdPoint, b: BdPoint): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/** Captura el puntero para seguir el arrastre fuera del lienzo (puede fallar con punteros simulados). */
function capture(event: ReactPointerEvent<SVGSVGElement>) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Sin captura el arrastre sigue funcionando dentro del lienzo.
  }
}

function hitWire(w: BdWire, p: BdPoint): boolean {
  for (let i = 0; i < w.points.length - 1; i++)
    if (distanceToSegment(p, w.points[i]!, w.points[i + 1]!) < 0.35) return true;
  return false;
}

/** Quita vértices repetidos o en línea recta. */
function simplify(points: BdPoint[]): BdPoint[] {
  const out: BdPoint[] = [];
  for (const p of points) {
    if (out.length && same(out.at(-1)!, p)) continue;
    out.push(p);
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3) as [BdPoint, BdPoint, BdPoint];
      if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y))
        out.splice(out.length - 2, 1);
      else break;
    }
  }
  return out;
}

/** Une `from` y `to` con tramos ortogonales (primero horizontal). */
function orthogonal(from: BdPoint, to: BdPoint): BdPoint[] {
  if (from.x === to.x || from.y === to.y) return [to];
  return [{ x: to.x, y: from.y }, to];
}

function nextName(doc: BlockDiagramDocument, kind: BdKind): string {
  const used = new Set(doc.elements.map((e) => (e.kind === 'block' ? e.gain : e.label)));
  const base = kind === 'block' ? 'G' : kind === 'input' ? 'R' : 'C';
  if (kind !== 'block' && !used.has(base)) return base;
  const alternatives = kind === 'input' ? ['D', 'N'] : kind === 'output' ? ['Y', 'E'] : [];
  for (const a of alternatives) if (!used.has(a)) return a;
  for (let k = 1; ; k++) if (!used.has(`${base}${k}`)) return `${base}${k}`;
}

function newElement(doc: BlockDiagramDocument, kind: BdKind, p: BdPoint): BdElement {
  const id = uid(kind[0]!);
  if (kind === 'block') return { id, kind, x: p.x, y: p.y, dir: 0, gain: nextName(doc, 'block') };
  if (kind === 'sum')
    return { id, kind, x: p.x, y: p.y, dir: 0, signs: { back: '+', left: '+', right: '-' } };
  return { id, kind, x: p.x, y: p.y, dir: 0, label: nextName(doc, kind) };
}

function bounds(doc: BlockDiagramDocument) {
  const pts: BdPoint[] = [];
  for (const e of doc.elements) {
    // Las entradas y salidas llevan su nombre al lado: se deja espacio para el rótulo.
    const r = e.kind === 'block' ? BLOCK_HALF + 0.5 : e.kind === 'sum' ? 1.8 : 3;
    pts.push({ x: e.x - r, y: e.y - r }, { x: e.x + r, y: e.y + r });
  }
  for (const w of doc.wires) pts.push(...w.points);
  if (pts.length === 0) return null;
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

/**
 * Constructor de diagramas de bloques. La entrada de la calculadora es el documento
 * (`BlockDiagramDocument`): bloques, puntos suma, entradas, salidas y cables en una cuadrícula.
 */
export function BlockDiagramField({ name }: { name: string }) {
  const { control } = useFormContext();
  const { field } = useController({ name, control, defaultValue: EMPTY });
  const doc = (field.value as BlockDiagramDocument | undefined) ?? EMPTY;
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [selection, setSelection] = useState<Selection>(null);
  const [view, setView] = useState<View>({ scale: 18, ox: 20, oy: 120 });
  const [hover, setHover] = useState<BdPoint | null>(null);
  const [draft, setDraft] = useState<BdPoint[] | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [past, setPast] = useState<BlockDiagramDocument[]>([]);
  const [future, setFuture] = useState<BlockDiagramDocument[]>([]);
  const [expanded, setExpanded] = useState(false);

  const commit = useCallback(
    (next: BlockDiagramDocument, previous: BlockDiagramDocument = doc) => {
      setPast((p) => [...p.slice(-60), previous]);
      setFuture([]);
      field.onChange(next);
    },
    [doc, field],
  );

  const fit = useCallback(() => {
    const svg = svgRef.current;
    const b = bounds(doc);
    if (!svg || !b) return;
    const w = svg.clientWidth || 320;
    const h = svg.clientHeight || 300;
    const scale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, Math.min(w / (b.maxX - b.minX + 2), h / (b.maxY - b.minY + 2))),
    );
    setView({
      scale,
      ox: w / 2 - ((b.minX + b.maxX) / 2) * scale,
      oy: h / 2 - ((b.minY + b.maxY) / 2) * scale,
    });
  }, [doc]);

  // Encuadre inicial (el ejemplo precargado) y al cambiar a pantalla completa.
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current) {
      fitted.current = true;
      fit();
    }
  }, [fit]);
  useEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const toWorld = (clientX: number, clientY: number): BdPoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.ox) / view.scale,
      y: (clientY - rect.top - view.oy) / view.scale,
    };
  };
  const snap = (p: BdPoint): BdPoint => ({ x: Math.round(p.x), y: Math.round(p.y) });
  const sx = (x: number) => x * view.scale + view.ox;
  const sy = (y: number) => y * view.scale + view.oy;

  // Zoom con la rueda (centrado en el cursor).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      setView((v) => {
        const scale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, v.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12)),
        );
        return {
          scale,
          ox: mx - ((mx - v.ox) / v.scale) * scale,
          oy: my - ((my - v.oy) / v.scale) * scale,
        };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
    // En pantalla completa el lienzo se monta de nuevo (portal): hay que volver a escuchar.
  }, [expanded]);

  const zoom = (factor: number) => {
    const svg = svgRef.current;
    const w = svg?.clientWidth ?? 320;
    const h = svg?.clientHeight ?? 300;
    setView((v) => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
      return {
        scale,
        ox: w / 2 - ((w / 2 - v.ox) / v.scale) * scale,
        oy: h / 2 - ((h / 2 - v.oy) / v.scale) * scale,
      };
    });
  };

  const terminals = useMemo(() => doc.elements.flatMap(elementTerminals), [doc]);
  const signals = useMemo(() => buildSignals(doc), [doc]);
  const connectedPorts = useMemo(() => {
    const set = new Set<string>();
    for (const s of signals) for (const t of s.consumers) set.add(`${t.elementId}:${t.port}`);
    return set;
  }, [signals]);
  const junctions = useMemo(() => junctionPoints(doc), [doc]);

  const finishDraft = (points: BdPoint[] | null = draft) => {
    if (points && points.length >= 2) {
      const clean = simplify(points);
      if (clean.length >= 2)
        commit({ ...doc, wires: [...doc.wires, { id: uid('w'), points: clean }] });
    }
    setDraft(null);
  };

  const touchesSomething = (p: BdPoint) =>
    terminals.some((t) => same(t.point, p)) ||
    doc.wires.some((w) =>
      w.points.some((q, i) => i < w.points.length - 1 && onSegment(p, q, w.points[i + 1]!)),
    );

  const remove = (sel: Selection) => {
    if (!sel) return;
    if (sel.kind === 'element')
      commit({ ...doc, elements: doc.elements.filter((e) => e.id !== sel.id) });
    else commit({ ...doc, wires: doc.wires.filter((w) => w.id !== sel.id) });
    setSelection(null);
  };

  const updateElement = (id: string, patch: Partial<BdElement>, record = true) => {
    const next = {
      ...doc,
      elements: doc.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    };
    if (record) commit(next);
    else field.onChange(next);
  };

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [doc, ...f]);
    field.onChange(previous);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, doc]);
    field.onChange(next);
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const world = toWorld(event.clientX, event.clientY);
    const p = snap(world);
    if (event.button === 1 || event.button === 2) {
      setDrag({ kind: 'pan', x: event.clientX, y: event.clientY, view });
      capture(event);
      return;
    }
    if (tool === 'wire') {
      if (!draft) {
        setDraft([p]);
        return;
      }
      const last = draft.at(-1)!;
      if (same(last, p)) {
        finishDraft();
        return;
      }
      const points = [...draft, ...orthogonal(last, p)];
      if (touchesSomething(p) && draft.length >= 1 && !same(draft[0]!, p)) finishDraft(points);
      else setDraft(points);
      return;
    }
    if (tool !== 'select') {
      const element = newElement(doc, tool, p);
      commit({ ...doc, elements: [...doc.elements, element] });
      setSelection({ kind: 'element', id: element.id });
      setTool('select');
      return;
    }
    const element = [...doc.elements].reverse().find((e) => hitElement(e, world));
    if (element) {
      setSelection({ kind: 'element', id: element.id });
      setDrag({ kind: 'element', id: element.id, start: p, doc, moved: false });
      capture(event);
      return;
    }
    const wire = doc.wires.find((w) => hitWire(w, world));
    if (wire) {
      setSelection({ kind: 'wire', id: wire.id });
      return;
    }
    setSelection(null);
    setDrag({ kind: 'pan', x: event.clientX, y: event.clientY, view });
    capture(event);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const world = toWorld(event.clientX, event.clientY);
    setHover(snap(world));
    if (!drag) return;
    if (drag.kind === 'pan') {
      setView({
        ...drag.view,
        ox: drag.view.ox + event.clientX - drag.x,
        oy: drag.view.oy + event.clientY - drag.y,
      });
      return;
    }
    const p = snap(world);
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    const original = drag.doc.elements.find((e) => e.id === drag.id);
    if (!original) return;
    // Los extremos de cable pegados a los terminales del elemento se mueven con él.
    const moved = { ...original, x: original.x + dx, y: original.y + dy };
    const before = elementTerminals(original).map((t) => t.point);
    const wires = drag.doc.wires.map((w) => {
      const points = [...w.points];
      const ends = [0, points.length - 1];
      let changed = false;
      for (const i of ends) {
        if (before.some((b) => same(b, points[i]!))) {
          points[i] = { x: points[i]!.x + dx, y: points[i]!.y + dy };
          changed = true;
        }
      }
      if (!changed) return w;
      // Mantener los tramos ortogonales: se agrega un codo junto al extremo movido.
      const fixed: BdPoint[] = [points[0]!];
      for (let i = 1; i < points.length; i++) {
        const a = fixed.at(-1)!;
        const b = points[i]!;
        if (a.x !== b.x && a.y !== b.y)
          fixed.push(i === points.length - 1 ? { x: a.x, y: b.y } : { x: b.x, y: a.y });
        fixed.push(b);
      }
      return { ...w, points: simplify(fixed) };
    });
    field.onChange({
      elements: drag.doc.elements.map((e) => (e.id === drag.id ? moved : e)),
      wires,
    });
    if (dx !== 0 || dy !== 0) setDrag({ ...drag, moved: true });
  };

  const onPointerUp = () => {
    if (drag?.kind === 'element' && drag.moved) {
      setPast((p) => [...p.slice(-60), drag.doc]);
      setFuture([]);
    }
    setDrag(null);
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if (key === 'escape') {
      setDraft(null);
      setSelection(null);
      setTool('select');
      return;
    }
    if (key === 'enter' && draft) {
      finishDraft();
      return;
    }
    if ((key === 'delete' || key === 'backspace') && selection) {
      event.preventDefault();
      remove(selection);
      return;
    }
    if (key === 'r' && selection?.kind === 'element') {
      const e = doc.elements.find((x) => x.id === selection.id);
      if (e) updateElement(e.id, { dir: rotate(e.dir) });
      return;
    }
    const shortcut = TOOLS.find((t) => t.key.toLowerCase() === key);
    if (shortcut && !event.ctrlKey && !event.metaKey) {
      setTool(shortcut.tool);
      setDraft(null);
    }
  };

  const selected =
    selection?.kind === 'element' ? doc.elements.find((e) => e.id === selection.id) : undefined;
  const s = view.scale;

  const renderElement = (e: BdElement) => {
    const isSel = selection?.kind === 'element' && selection.id === e.id;
    const stroke = isSel ? 'var(--primary)' : 'var(--foreground)';
    const u = unit(e.dir);
    const cx = sx(e.x);
    const cy = sy(e.y);
    if (e.kind === 'block') {
      const horizontal = u.y === 0;
      const w = (horizontal ? 2 * BLOCK_HALF : 2) * s;
      const h = (horizontal ? 2 : 2 * BLOCK_HALF) * s;
      const tex = gainPreviewTex(e.gain ?? '');
      return (
        <g key={e.id}>
          <rect
            x={cx - w / 2}
            y={cy - h / 2}
            width={w}
            height={h}
            rx={3}
            fill="var(--card)"
            stroke={stroke}
            strokeWidth={isSel ? 2.5 : 1.6}
          />
          <foreignObject
            x={cx - w / 2 + 2}
            y={cy - h / 2 + 1}
            width={w - 4}
            height={h - 2}
            pointerEvents="none"
          >
            <div
              className={cn(
                'flex h-full w-full items-center justify-center overflow-hidden leading-none',
                !tex && 'text-destructive',
              )}
              style={{ fontSize: Math.max(8, Math.min(16, s * 0.62)) }}
            >
              {tex ? <Formula tex={tex} /> : <span className="font-mono">{e.gain || '?'}</span>}
            </div>
          </foreignObject>
        </g>
      );
    }
    if (e.kind === 'sum') {
      const r = SUM_RADIUS * s;
      const d = r * 0.7;
      return (
        <g key={e.id}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="var(--card)"
            stroke={stroke}
            strokeWidth={isSel ? 2.5 : 1.6}
          />
          <line
            x1={cx - d}
            y1={cy - d}
            x2={cx + d}
            y2={cy + d}
            stroke={stroke}
            strokeWidth={1}
            opacity={0.5}
          />
          <line
            x1={cx - d}
            y1={cy + d}
            x2={cx + d}
            y2={cy - d}
            stroke={stroke}
            strokeWidth={1}
            opacity={0.5}
          />
          {SUM_PORTS.map((port) => {
            const v = portVector(e, port);
            const connected = connectedPorts.has(`${e.id}:${port}`);
            const sign = e.signs?.[port] === '-' ? '−' : '+';
            // El signo va junto al cable de la entrada, sin taparlo: arriba del cable de atrás y
            // del lado de atrás en las entradas laterales.
            const l = leftOf(e.dir);
            const off =
              port === 'back' ? { x: l.x * 0.7, y: l.y * 0.7 } : { x: -u.x * 0.75, y: -u.y * 0.75 };
            const px = cx + (v.x * 1.4 + off.x) * s;
            const py = cy + (v.y * 1.4 + off.y) * s;
            return (
              <text
                key={port}
                x={px}
                y={py}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.max(9, s * 0.8)}
                fontWeight={600}
                fill={connected ? 'var(--foreground)' : 'var(--muted-foreground)'}
                opacity={connected ? 1 : 0.35}
                style={{ cursor: 'pointer' }}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  const signs = { ...e.signs, [port]: e.signs?.[port] === '-' ? '+' : '-' };
                  updateElement(e.id, { signs });
                  setSelection({ kind: 'element', id: e.id });
                }}
              >
                {sign}
              </text>
            );
          })}
        </g>
      );
    }
    // Entrada o salida: marcador con su nombre.
    const isInput = e.kind === 'input';
    const back = { x: -u.x, y: -u.y };
    const labelAt = isInput
      ? { x: e.x + back.x * 1.1, y: e.y + back.y * 1.1 }
      : { x: e.x + u.x * 1.2, y: e.y + u.y * 1.2 };
    const anchor = u.x !== 0 ? (isInput === u.x > 0 ? 'end' : 'start') : 'middle';
    return (
      <g key={e.id}>
        <circle
          cx={cx}
          cy={cy}
          r={Math.max(2.5, s * 0.18)}
          fill={isSel ? 'var(--primary)' : 'var(--foreground)'}
        />
        <text
          x={sx(labelAt.x)}
          y={sy(labelAt.y)}
          textAnchor={anchor}
          dominantBaseline="central"
          fontSize={Math.max(10, s * 0.75)}
          fontStyle="italic"
          fill={isSel ? 'var(--primary)' : 'var(--foreground)'}
        >
          {`${e.label || (isInput ? 'R' : 'C')}(s)`}
        </text>
      </g>
    );
  };

  /** Flecha que entra a cada terminal de entrada conectado. */
  const arrows = terminals
    .filter((t) => t.role === 'in')
    .filter((t) => {
      const e = doc.elements.find((x) => x.id === t.elementId)!;
      return e.kind !== 'sum' || connectedPorts.has(`${t.elementId}:${t.port}`);
    })
    .map((t) => {
      const e = doc.elements.find((x) => x.id === t.elementId)!;
      const d =
        e.kind === 'sum'
          ? { x: -portVector(e, t.port as SumPort).x, y: -portVector(e, t.port as SumPort).y }
          : unit(e.dir);
      const tipX = sx(t.point.x);
      const tipY = sy(t.point.y);
      const len = Math.max(5, s * 0.45);
      const wid = len * 0.55;
      const bx = tipX - d.x * len;
      const by = tipY - d.y * len;
      return (
        <polygon
          key={`${t.elementId}:${t.port}`}
          points={`${tipX},${tipY} ${bx - d.y * wid},${by + d.x * wid} ${bx + d.y * wid},${by - d.x * wid}`}
          fill="var(--foreground)"
        />
      );
    });

  const draftPreview = draft && hover ? [...draft, ...orthogonal(draft.at(-1)!, hover)] : draft;
  const signs =
    selected?.kind === 'sum'
      ? SUM_PORTS.map((port) => ({ port, side: sideName(portVector(selected, port)) }))
      : [];

  const content = (
    <div
      className={cn(
        'flex flex-col gap-2 outline-none',
        expanded && 'bg-background fixed inset-0 z-50 p-3',
      )}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Constructor de diagramas de bloques"
    >
      <div
        className="flex flex-wrap items-center gap-1"
        role="toolbar"
        aria-label="Herramientas del diagrama"
      >
        {TOOLS.map(({ tool: t, label, icon: Icon, key }) => (
          <Button
            key={t}
            type="button"
            size="icon"
            variant={tool === t ? 'default' : 'outline'}
            className="size-9"
            title={`${label} (${key})`}
            aria-label={label}
            aria-pressed={tool === t}
            onClick={() => {
              setTool(t);
              setDraft(null);
            }}
          >
            <Icon className="size-4" />
          </Button>
        ))}
        <span className="bg-border mx-1 h-6 w-px" aria-hidden />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9"
          title="Deshacer (Ctrl+Z)"
          aria-label="Deshacer"
          disabled={!past.length}
          onClick={undo}
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9"
          title="Rehacer (Ctrl+Y)"
          aria-label="Rehacer"
          disabled={!future.length}
          onClick={redo}
        >
          <Redo2 className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9"
          title="Acercar"
          aria-label="Acercar"
          onClick={() => zoom(1.25)}
        >
          <ZoomIn className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9"
          title="Alejar"
          aria-label="Alejar"
          onClick={() => zoom(0.8)}
        >
          <ZoomOut className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9"
          title="Ajustar al diagrama"
          aria-label="Ajustar al diagrama"
          onClick={fit}
        >
          <Maximize2 className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9"
          title={expanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-label={expanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <Shrink className="size-4" /> : <Expand className="size-4" />}
        </Button>
      </div>

      <svg
        ref={svgRef}
        className={cn(
          'bg-card w-full touch-none rounded-md border select-none',
          expanded ? 'min-h-0 flex-1' : 'h-72',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(e) => e.preventDefault()}
        onDoubleClick={() => draft && finishDraft()}
        role="application"
        aria-label="Lienzo del diagrama de bloques"
        style={{
          cursor: tool === 'select' ? (drag?.kind === 'pan' ? 'grabbing' : 'default') : 'crosshair',
        }}
      >
        <defs>
          <pattern
            id="bd-grid"
            width={s}
            height={s}
            patternUnits="userSpaceOnUse"
            x={view.ox % s}
            y={view.oy % s}
          >
            <circle cx={0.5} cy={0.5} r={0.8} fill="var(--border)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bd-grid)" />
        {doc.wires.map((w) => {
          const isSel = selection?.kind === 'wire' && selection.id === w.id;
          return (
            <polyline
              key={w.id}
              points={w.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke={isSel ? 'var(--primary)' : 'var(--foreground)'}
              strokeWidth={isSel ? 2.5 : 1.5}
              strokeLinejoin="round"
            />
          );
        })}
        {junctions.map((p) => (
          <circle
            key={`j${p.x},${p.y}`}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={Math.max(2.5, s * 0.17)}
            fill="var(--foreground)"
          />
        ))}
        {arrows}
        {doc.elements.map(renderElement)}
        {draftPreview && draftPreview.length > 1 && (
          <polyline
            points={draftPreview.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
        )}
        {hover && tool !== 'select' && (
          <circle
            cx={sx(hover.x)}
            cy={sy(hover.y)}
            r={3}
            fill="var(--primary)"
            opacity={0.6}
            pointerEvents="none"
          />
        )}
      </svg>

      {draft && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Dibujando un cable: toca cada esquina y termina sobre un terminal u otro cable.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => finishDraft()}>
            Terminar cable
          </Button>
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-2 rounded-md border p-2">
          <p className="text-sm font-medium">
            {selected.kind === 'block'
              ? 'Bloque'
              : selected.kind === 'sum'
                ? 'Punto suma'
                : selected.kind === 'input'
                  ? 'Entrada'
                  : 'Salida'}
          </p>
          {selected.kind === 'block' && (
            <label className="flex flex-col gap-1 text-xs">
              Función de transferencia
              <Input
                key={selected.id}
                defaultValue={selected.gain}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                onFocus={() => setPast((p) => [...p.slice(-60), doc])}
                onChange={(ev) => updateElement(selected.id, { gain: ev.target.value }, false)}
              />
              <span className="text-muted-foreground">
                Un símbolo (<code>G1</code>, <code>H2</code>) o una función de s (
                <code>10/(s+1)</code>).
              </span>
            </label>
          )}
          {(selected.kind === 'input' || selected.kind === 'output') && (
            <label className="flex flex-col gap-1 text-xs">
              Nombre de la señal
              <Input
                key={selected.id}
                defaultValue={selected.label}
                maxLength={6}
                className="font-mono"
                autoComplete="off"
                onFocus={() => setPast((p) => [...p.slice(-60), doc])}
                onChange={(ev) =>
                  updateElement(
                    selected.id,
                    { label: ev.target.value.replace(/[^A-Za-z0-9]/g, '') },
                    false,
                  )
                }
              />
            </label>
          )}
          {selected.kind === 'sum' && (
            <div className="grid grid-cols-3 gap-2">
              {signs.map(({ port, side }) => (
                <label key={port} className="flex flex-col gap-1 text-xs">
                  Entrada de {side}
                  <select
                    className="border-input bg-card h-8 rounded-md border px-2 text-sm"
                    value={selected.signs?.[port] ?? '+'}
                    onChange={(ev) =>
                      updateElement(selected.id, {
                        signs: { ...selected.signs, [port]: ev.target.value as '+' | '-' },
                      })
                    }
                  >
                    <option value="+">+</option>
                    <option value="-">−</option>
                  </select>
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => updateElement(selected.id, { dir: rotate(selected.dir) })}
            >
              <RotateCw className="size-4" /> Girar (R)
            </Button>
            {selected.kind === 'block' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => updateElement(selected.id, { dir: rotate(selected.dir, 2) })}
              >
                Invertir sentido
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => remove(selection)}>
              <Trash2 className="size-4" /> Eliminar
            </Button>
          </div>
        </div>
      )}
      {selection?.kind === 'wire' && (
        <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
          Cable seleccionado
          <Button type="button" size="sm" variant="outline" onClick={() => remove(selection)}>
            <Trash2 className="size-4" /> Eliminar
          </Button>
        </div>
      )}
      <BlockDiagramGuide />
    </div>
  );
  // El panel del formulario es sticky (crea su propio contexto de apilamiento): en pantalla
  // completa el editor se dibuja directamente en el body para quedar sobre el encabezado.
  return expanded ? createPortal(content, document.body) : content;
}

/** Instrucciones bajo el lienzo. */
function BlockDiagramGuide() {
  return (
    <details className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
      <summary className="text-foreground cursor-pointer text-sm font-medium">
        Cómo dibujar el diagrama
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>
          Elige una herramienta y toca el lienzo: <strong>bloque</strong> (escribe su función de
          transferencia en el panel), <strong>punto suma</strong>, <strong>entrada</strong> R(s) y{' '}
          <strong>salida</strong> C(s).
        </li>
        <li>
          El <strong>bloque</strong> recibe la señal por la izquierda y la entrega por la derecha;
          gíralo (R) o invierte su sentido para los lazos de realimentación.
        </li>
        <li>
          El <strong>punto suma</strong> tiene tres entradas (atrás y a los lados) y una salida al
          frente. Toca el signo de una entrada para cambiarlo entre + y −; las entradas sin cable no
          cuentan.
        </li>
        <li>
          Con el <strong>cable</strong>, toca el punto de partida y cada esquina; termina sobre un
          terminal o sobre otro cable (o toca dos veces el mismo punto). Un cable que sale de otro
          es un <strong>punto de bifurcación</strong> (•); dos cables que solo se cruzan no se unen.
        </li>
        <li>
          Con la flecha se selecciona y se arrastra (los cables pegados se mueven con el elemento);
          arrastrar el fondo mueve la vista y la rueda acerca o aleja. Supr borra, Ctrl+Z deshace y
          Esc cancela.
        </li>
      </ul>
    </details>
  );
}
