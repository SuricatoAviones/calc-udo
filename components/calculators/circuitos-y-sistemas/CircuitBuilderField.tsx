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
  parseEngineering,
  type CircuitComponent,
  type CircuitDocument,
  type CircuitWire,
  type ComponentKind,
  type GridPoint,
} from '@/lib/calculators/circuitos-y-sistemas/circuit';

const VIEW_W = 20;
const VIEW_H = 16;
const GRID = 1;

type Tool = 'select' | 'wire' | ComponentKind | 'ground';

interface DraftComponent {
  kind: ComponentKind;
  start: GridPoint;
  end?: GridPoint;
}

interface DraftWire {
  points: GridPoint[];
}

function keyOf(p: GridPoint) {
  return `${p.x},${p.y}`;
}

function samePoint(a: GridPoint, b: GridPoint) {
  return a.x === b.x && a.y === b.y;
}

function snap(point: GridPoint): GridPoint {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

function withinView(p: GridPoint) {
  return p.x >= 0 && p.x <= VIEW_W && p.y >= 0 && p.y <= VIEW_H;
}

function midpoint(a: GridPoint, b: GridPoint): GridPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function isHorizontal(a: GridPoint, b: GridPoint) {
  return a.y === b.y;
}

/** Distancia al cuadrado de un punto a un segmento ortogonal. */
function distToSegment(p: GridPoint, a: GridPoint, b: GridPoint): number {
  if (a.x === b.x) {
    if (p.x !== a.x) return Infinity;
    const min = Math.min(a.y, b.y);
    const max = Math.max(a.y, b.y);
    if (p.y < min) return (min - p.y) ** 2;
    if (p.y > max) return (p.y - max) ** 2;
    return 0;
  }
  if (a.y === b.y) {
    if (p.y !== a.y) return Infinity;
    const min = Math.min(a.x, b.x);
    const max = Math.max(a.x, b.x);
    if (p.x < min) return (min - p.x) ** 2;
    if (p.x > max) return (p.x - max) ** 2;
    return 0;
  }
  return Infinity;
}

function componentAt(doc: CircuitDocument, p: GridPoint): CircuitComponent | undefined {
  return doc.components.find((c) => samePoint(c.a, p) || samePoint(c.b, p));
}

function wireAt(doc: CircuitDocument, p: GridPoint): CircuitWire | undefined {
  return doc.wires.find((w) => {
    for (let i = 0; i < w.points.length - 1; i++) {
      if (distToSegment(p, w.points[i]!, w.points[i + 1]!) === 0) return true;
    }
    return false;
  });
}

function ResistorSymbol({ a, b }: { a: GridPoint; b: GridPoint }) {
  const m = midpoint(a, b);
  const horizontal = isHorizontal(a, b);
  const len = horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y);
  const body = Math.min(len - 0.3, 1.2);
  const peaks = 5;
  const step = body / peaks;
  let d = `M ${-body / 2} 0`;
  for (let k = 1; k <= peaks; k++) {
    const x = -body / 2 + k * step;
    const y = k % 2 === 1 ? -0.25 : 0.25;
    d += ` L ${x - step / 2} ${y}`;
    if (k < peaks) d += ` L ${x} 0`;
    else d += ` L ${x} 0`;
  }
  const angle = horizontal ? 0 : 90;
  return (
    <g transform={`translate(${m.x},${m.y}) rotate(${angle})`}>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.08}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function VoltageSourceSymbol({ a, b }: { a: GridPoint; b: GridPoint }) {
  const m = midpoint(a, b);
  const horizontal = isHorizontal(a, b);
  const angle = horizontal ? 0 : 90;
  const r = 0.32;
  return (
    <g transform={`translate(${m.x},${m.y}) rotate(${angle})`}>
      <circle cx={0} cy={0} r={r} fill="none" stroke="currentColor" strokeWidth={0.08} />
      <text x={-r - 0.15} y={0.15} fontSize={0.35} textAnchor="end" fill="currentColor">
        +
      </text>
      <text x={r + 0.15} y={0.15} fontSize={0.35} textAnchor="start" fill="currentColor">
        −
      </text>
    </g>
  );
}

function CurrentSourceSymbol({ a, b }: { a: GridPoint; b: GridPoint }) {
  const m = midpoint(a, b);
  const horizontal = isHorizontal(a, b);
  const angle = horizontal ? 0 : 90;
  const r = 0.32;
  return (
    <g transform={`translate(${m.x},${m.y}) rotate(${angle})`}>
      <circle cx={0} cy={0} r={r} fill="none" stroke="currentColor" strokeWidth={0.08} />
      <path d={`M ${-0.15} -0.12 L 0.15 0 L -0.15 0.12`} fill="currentColor" />
    </g>
  );
}

function GroundSymbol({ p }: { p: GridPoint }) {
  return (
    <g transform={`translate(${p.x},${p.y})`}>
      <line x1={-0.35} y1={0} x2={0.35} y2={0} stroke="currentColor" strokeWidth={0.08} />
      <line x1={-0.2} y1={0.15} x2={0.2} y2={0.15} stroke="currentColor" strokeWidth={0.08} />
      <line x1={-0.05} y1={0.3} x2={0.05} y2={0.3} stroke="currentColor" strokeWidth={0.08} />
    </g>
  );
}

function ComponentShape({ c, selected }: { c: CircuitComponent; selected?: boolean }) {
  return (
    <g className={cn('transition-colors', selected ? 'text-primary' : 'text-foreground')}>
      <line x1={c.a.x} y1={c.a.y} x2={c.b.x} y2={c.b.y} stroke="currentColor" strokeWidth={0.06} />
      {c.kind === 'resistor' && <ResistorSymbol a={c.a} b={c.b} />}
      {c.kind === 'voltage-source' && <VoltageSourceSymbol a={c.a} b={c.b} />}
      {c.kind === 'current-source' && <CurrentSourceSymbol a={c.a} b={c.b} />}
      <text
        x={midpoint(c.a, c.b).x}
        y={midpoint(c.a, c.b).y - 0.45}
        fontSize={0.35}
        textAnchor="middle"
        fill="currentColor"
      >
        {componentLabel(c)} = {formatEngineering(c.value, componentUnit(c.kind))}
      </text>
    </g>
  );
}

export function CircuitBuilderField({ name }: { name: string }) {
  const { control } = useFormContext();
  const {
    field: { value, onChange },
  } = useController({ name, control, defaultValue: emptyCircuit() });
  const doc: CircuitDocument = value ?? emptyCircuit();

  const [tool, setTool] = useState<Tool>('select');
  const [draft, setDraft] = useState<DraftComponent | DraftWire | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<GridPoint | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedComponent = useMemo(
    () => doc.components.find((c) => c.id === selectedId) ?? null,
    [doc.components, selectedId],
  );
  const selectedWire = useMemo(
    () => doc.wires.find((w) => w.id === selectedId) ?? null,
    [doc.wires, selectedId],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDraft(null);
        setTool('select');
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          onChange({
            ...doc,
            components: doc.components.filter((c) => c.id !== selectedId),
            wires: doc.wires.filter((w) => w.id !== selectedId),
            ground: doc.ground && keyOf(doc.ground) === selectedId ? undefined : doc.ground,
          });
          setSelectedId(null);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, onChange, selectedId]);

  function pointerToGrid(evt: React.MouseEvent<SVGSVGElement>): GridPoint | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX - rect.left;
    pt.y = evt.clientY - rect.top;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const loc = pt.matrixTransform(ctm.inverse());
    const p = snap({ x: loc.x, y: loc.y });
    return withinView(p) ? p : null;
  }

  function addComponent(kind: ComponentKind, a: GridPoint, b: GridPoint) {
    const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const used = new Set(doc.components.map((c) => c.label).filter(Boolean));
    let label = '';
    const prefix = kind === 'resistor' ? 'R' : kind === 'voltage-source' ? 'V' : 'I';
    for (let n = 1; n < 1000; n++) {
      const candidate = `${prefix}${n}`;
      if (!used.has(candidate)) {
        label = candidate;
        break;
      }
    }
    const defaults: Record<ComponentKind, number> = {
      resistor: 1000,
      'voltage-source': 10,
      'current-source': 0.001,
    };
    onChange({
      ...doc,
      components: [...doc.components, { id, kind, a, b, value: defaults[kind], label }],
    });
    setSelectedId(id);
    setTool('select');
  }

  function addWire(points: GridPoint[]) {
    const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    onChange({ ...doc, wires: [...doc.wires, { id, points }] });
    setSelectedId(id);
    setTool('select');
  }

  function handleClick(evt: React.MouseEvent<SVGSVGElement>) {
    const p = pointerToGrid(evt);
    if (!p) return;
    evt.preventDefault();

    if (tool === 'select') {
      const comp = componentAt(doc, p);
      if (comp) {
        setSelectedId(comp.id);
        return;
      }
      const wire = wireAt(doc, p);
      if (wire) {
        setSelectedId(wire.id);
        return;
      }
      if (doc.ground && samePoint(doc.ground, p)) {
        setSelectedId(keyOf(doc.ground));
        return;
      }
      setSelectedId(null);
      return;
    }

    if (tool === 'ground') {
      onChange({ ...doc, ground: p });
      setSelectedId(keyOf(p));
      setTool('select');
      return;
    }

    if (tool === 'wire') {
      const wireDraft = (draft as DraftWire | null) ?? { points: [p] };
      const last = wireDraft.points[wireDraft.points.length - 1]!;
      if (!samePoint(last, p)) {
        // Solo segmentos ortogonales.
        if (p.x !== last.x && p.y !== last.y) return;
        const next: DraftWire = { points: [...wireDraft.points, p] };
        setDraft(next);
      }
      return;
    }

    // Componente pasivo o fuente: primer click inicio, segundo click fin.
    const compDraft = (draft as DraftComponent | null) ?? { kind: tool as ComponentKind, start: p };
    if (samePoint(compDraft.start, p)) return;
    if (p.x !== compDraft.start.x && p.y !== compDraft.start.y) return;
    addComponent(compDraft.kind, compDraft.start, p);
    setDraft(null);
  }

  function finishWire() {
    if (draft && 'points' in draft && draft.points.length >= 2) {
      addWire(draft.points);
      setDraft(null);
    }
  }

  function handleMouseMove(evt: React.MouseEvent<SVGSVGElement>) {
    setHover(pointerToGrid(evt));
  }

  const preview = useMemo(() => {
    if (!hover) return null;
    if (tool === 'wire' && draft && 'points' in draft) {
      const last = draft.points[draft.points.length - 1]!;
      if (hover.x === last.x || hover.y === last.y) {
        return (
          <line
            x1={last.x}
            y1={last.y}
            x2={hover.x}
            y2={hover.y}
            stroke="currentColor"
            strokeWidth={0.06}
            strokeDasharray="0.15,0.1"
          />
        );
      }
    }
    if (
      (tool === 'resistor' || tool === 'voltage-source' || tool === 'current-source') &&
      draft &&
      'start' in draft &&
      !draft.end
    ) {
      if (hover.x === draft.start.x || hover.y === draft.start.y) {
        return (
          <g className="text-muted-foreground">
            <line
              x1={draft.start.x}
              y1={draft.start.y}
              x2={hover.x}
              y2={hover.y}
              stroke="currentColor"
              strokeWidth={0.06}
              strokeDasharray="0.15,0.1"
            />
            {tool === 'resistor' && <ResistorSymbol a={draft.start} b={hover} />}
            {tool === 'voltage-source' && <VoltageSourceSymbol a={draft.start} b={hover} />}
            {tool === 'current-source' && <CurrentSourceSymbol a={draft.start} b={hover} />}
          </g>
        );
      }
    }
    return null;
  }, [hover, tool, draft]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <ToolButton active={tool === 'select'} onClick={() => setTool('select')}>
          Seleccionar
        </ToolButton>
        <ToolButton
          active={tool === 'wire'}
          onClick={() => {
            setTool('wire');
            setDraft(null);
          }}
        >
          Cable
        </ToolButton>
        <ToolButton
          active={tool === 'resistor'}
          onClick={() => {
            setTool('resistor');
            setDraft(null);
          }}
        >
          Resistencia
        </ToolButton>
        <ToolButton
          active={tool === 'voltage-source'}
          onClick={() => {
            setTool('voltage-source');
            setDraft(null);
          }}
        >
          Fuente V
        </ToolButton>
        <ToolButton
          active={tool === 'current-source'}
          onClick={() => {
            setTool('current-source');
            setDraft(null);
          }}
        >
          Fuente I
        </ToolButton>
        <ToolButton
          active={tool === 'ground'}
          onClick={() => {
            setTool('ground');
            setDraft(null);
          }}
        >
          Tierra
        </ToolButton>
        {tool === 'wire' && draft && 'points' in draft && draft.points.length >= 2 && (
          <Button type="button" variant="outline" size="sm" onClick={finishWire}>
            Cerrar cable
          </Button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-md border">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="aspect-[5/4] w-full touch-none"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
        >
          <defs>
            <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path
                d={`M ${GRID} 0 L 0 0 0 ${GRID}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.02}
                className="text-muted"
              />
            </pattern>
          </defs>
          <rect width={VIEW_W} height={VIEW_H} fill="url(#grid)" />

          {/* Nodos: pequeños puntos en cada terminal y esquina de cable */}
          {doc.components.map((c) => (
            <g key={`dot-${c.id}`}>
              <circle cx={c.a.x} cy={c.a.y} r={0.08} className="fill-muted-foreground" />
              <circle cx={c.b.x} cy={c.b.y} r={0.08} className="fill-muted-foreground" />
            </g>
          ))}
          {doc.wires.flatMap((w) =>
            w.points.map((p, i) => (
              <circle
                key={`w-${w.id}-${i}`}
                cx={p.x}
                cy={p.y}
                r={0.08}
                className="fill-muted-foreground"
              />
            )),
          )}

          {/* Cables */}
          {doc.wires.map((w) => (
            <g
              key={w.id}
              className={cn(
                'transition-colors',
                selectedId === w.id ? 'text-primary' : 'text-foreground',
              )}
            >
              <polyline
                points={w.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.08}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {/* Componentes */}
          {doc.components.map((c) => (
            <ComponentShape key={c.id} c={c} selected={selectedId === c.id} />
          ))}

          {/* Tierra */}
          {doc.ground && (
            <g
              className={cn(
                'transition-colors',
                selectedId === keyOf(doc.ground) ? 'text-primary' : 'text-foreground',
              )}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(keyOf(doc.ground!));
              }}
            >
              <GroundSymbol p={doc.ground} />
            </g>
          )}

          {/* Previsualización */}
          {preview}
        </svg>
      </div>

      <PropertiesPanel
        doc={doc}
        onChange={onChange}
        component={selectedComponent}
        wire={selectedWire}
      />
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button type="button" variant={active ? 'default' : 'outline'} size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

function PropertiesPanel({
  doc,
  onChange,
  component,
  wire,
}: {
  doc: CircuitDocument;
  onChange: (doc: CircuitDocument) => void;
  component: CircuitComponent | null;
  wire: CircuitWire | null;
}) {
  if (!component && !wire) {
    return (
      <p className="text-muted-foreground text-sm">
        Haz clic en un componente, cable o tierra para editarlo. Usa Delete para eliminar.
      </p>
    );
  }

  if (wire) {
    return (
      <div className="flex items-center justify-between rounded-md border p-3">
        <span className="text-sm font-medium">Cable</span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => onChange({ ...doc, wires: doc.wires.filter((w) => w.id !== wire.id) })}
        >
          Eliminar
        </Button>
      </div>
    );
  }

  if (!component) return null;
  const componentId = component.id;

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3" key={componentId}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{componentLabel(component)}</span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() =>
            onChange({
              ...doc,
              components: doc.components.filter((c) => c.id !== component.id),
            })
          }
        >
          Eliminar
        </Button>
      </div>
      <ValueAndLabelEditor doc={doc} component={component} onChange={onChange} />
    </div>
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
