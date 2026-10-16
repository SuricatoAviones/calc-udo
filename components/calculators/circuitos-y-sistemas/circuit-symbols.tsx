'use client';

import type { CircuitComponent, GridPoint } from '@/lib/calculators/circuitos-y-sistemas/circuit';

/**
 * Símbolos SVG de los componentes del constructor, dibujados en unidades de rejilla (1 unidad =
 * una celda). El contenedor aplica la escala y el desplazamiento, así que aquí solo se usan
 * coordenadas del mundo. Los trazos usan `non-scaling-stroke` para mantenerse finos al hacer zoom.
 */

export function midpoint(a: GridPoint, b: GridPoint): GridPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Ángulo (grados) del segmento a→b, solo para rotar el símbolo. */
function angleOf(a: GridPoint, b: GridPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 180;
  return dy >= 0 ? 90 : -90;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  vectorEffect: 'non-scaling-stroke' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function ResistorSymbol({ a, b }: { a: GridPoint; b: GridPoint }) {
  const m = midpoint(a, b);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const body = Math.max(0.4, Math.min(len - 0.3, 1.3));
  const peaks = 6;
  const step = body / peaks;
  let d = `M ${(-body / 2).toFixed(3)} 0`;
  for (let k = 1; k <= peaks; k++) {
    const x = -body / 2 + k * step;
    const y = k % 2 === 1 ? -0.22 : 0.22;
    d += ` L ${(x - step / 2).toFixed(3)} ${y}`;
    d += ` L ${x.toFixed(3)} 0`;
  }
  return (
    <g transform={`translate(${m.x} ${m.y}) rotate(${angleOf(a, b)})`}>
      <path d={d} {...stroke} />
    </g>
  );
}

export function VoltageSourceSymbol({ a, b }: { a: GridPoint; b: GridPoint }) {
  const m = midpoint(a, b);
  const r = 0.34;
  // En el grupo rotado, el terminal `a` (positivo) queda hacia −x y `b` hacia +x.
  return (
    <g transform={`translate(${m.x} ${m.y}) rotate(${angleOf(a, b)})`}>
      <circle r={r} {...stroke} />
      {/* Positivo: cruz cerca del terminal a. */}
      <line x1={-0.2} y1={0} x2={-0.06} y2={0} {...stroke} strokeWidth={1.4} />
      <line x1={-0.13} y1={-0.07} x2={-0.13} y2={0.07} {...stroke} strokeWidth={1.4} />
      {/* Negativo: guion cerca del terminal b. */}
      <line x1={0.06} y1={0} x2={0.2} y2={0} {...stroke} strokeWidth={1.4} />
    </g>
  );
}

export function CurrentSourceSymbol({ a, b }: { a: GridPoint; b: GridPoint }) {
  const m = midpoint(a, b);
  const r = 0.34;
  return (
    <g transform={`translate(${m.x} ${m.y}) rotate(${angleOf(a, b)})`}>
      <circle r={r} {...stroke} />
      <path d="M -0.18 -0.16 L 0.18 0 L -0.18 0.16" {...stroke} strokeWidth={1.5} />
    </g>
  );
}

/** Capacitor: dos placas; el + marca el terminal `a`, referencia de v_C. */
export function CapacitorSymbol({ a, b }: { a: GridPoint; b: GridPoint }) {
  const m = midpoint(a, b);
  const half = Math.hypot(b.x - a.x, b.y - a.y) / 2;
  const gap = 0.12;
  return (
    <g transform={`translate(${m.x} ${m.y}) rotate(${angleOf(a, b)})`}>
      <line x1={-half} y1={0} x2={-gap} y2={0} {...stroke} />
      <line x1={gap} y1={0} x2={half} y2={0} {...stroke} />
      <line x1={-gap} y1={-0.34} x2={-gap} y2={0.34} {...stroke} strokeWidth={2.4} />
      <line x1={gap} y1={-0.34} x2={gap} y2={0.34} {...stroke} strokeWidth={2.4} />
      <line x1={-0.44} y1={-0.3} x2={-0.28} y2={-0.3} {...stroke} strokeWidth={1.4} />
      <line x1={-0.36} y1={-0.38} x2={-0.36} y2={-0.22} {...stroke} strokeWidth={1.4} />
    </g>
  );
}

/** Inductor: bobina de cuatro espiras; la flecha marca el sentido de i_L (de `a` a `b`). */
export function InductorSymbol({ a, b }: { a: GridPoint; b: GridPoint }) {
  const m = midpoint(a, b);
  const half = Math.hypot(b.x - a.x, b.y - a.y) / 2;
  const w = Math.min(0.6, half - 0.1);
  const r = w / 4;
  let d = `M ${-w} 0`;
  for (let k = 0; k < 4; k++) d += ` a ${r} ${r} 0 0 1 ${2 * r} 0`;
  return (
    <g transform={`translate(${m.x} ${m.y}) rotate(${angleOf(a, b)})`}>
      <line x1={-half} y1={0} x2={-w} y2={0} {...stroke} />
      <line x1={w} y1={0} x2={half} y2={0} {...stroke} />
      <path d={d} {...stroke} />
      <path
        d="M -0.22 0.3 L 0.2 0.3 M 0.11 0.23 L 0.2 0.3 L 0.11 0.37"
        {...stroke}
        strokeWidth={1.3}
      />
    </g>
  );
}

/**
 * Diodo: triángulo que apunta del ánodo (`a`) al cátodo (`b`), con la barra en el cátodo. La
 * flecha es el sentido en que conduce.
 */
export function DiodeSymbol({ a, b }: { a: GridPoint; b: GridPoint }) {
  const m = midpoint(a, b);
  const half = Math.hypot(b.x - a.x, b.y - a.y) / 2;
  const w = 0.26;
  return (
    <g transform={`translate(${m.x} ${m.y}) rotate(${angleOf(a, b)})`}>
      <line x1={-half} y1={0} x2={-w} y2={0} {...stroke} />
      <line x1={w} y1={0} x2={half} y2={0} {...stroke} />
      <path
        d={`M ${-w} -0.3 L ${w} 0 L ${-w} 0.3 Z`}
        {...stroke}
        fill="currentColor"
        fillOpacity={0.15}
      />
      <line x1={w} y1={-0.3} x2={w} y2={0.3} {...stroke} strokeWidth={2.4} />
    </g>
  );
}

/**
 * Marco local de un amplificador operacional: `e1` apunta de las entradas a la salida y `e2` de la
 * entrada − (`a`) a la + (`b`). `at(s, t)` es el punto a + s·e1 + t·e2 (las entradas están en t = 0
 * y t = 2, la salida en s = 4, t = 1).
 */
export function opAmpFrame(a: GridPoint, b: GridPoint, c: GridPoint) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const e2 = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const mid = midpoint(a, b);
  const out = Math.hypot(c.x - mid.x, c.y - mid.y) || 1;
  const e1 = { x: (c.x - mid.x) / out, y: (c.y - mid.y) / out };
  const at = (s: number, t: number): GridPoint => ({
    x: a.x + s * e1.x + t * e2.x,
    y: a.y + s * e1.y + t * e2.y,
  });
  return { e1, e2, at };
}

/** Cuerpo del amplificador (sin los terminales), para detectar choques y clics. */
export function opAmpBody(a: GridPoint, b: GridPoint, c: GridPoint, margin = 0) {
  const { at } = opAmpFrame(a, b, c);
  const corners = [at(0.4, -0.4), at(3.3, -0.4), at(0.4, 2.4), at(3.3, 2.4)];
  return {
    minX: Math.min(...corners.map((p) => p.x)) - margin,
    maxX: Math.max(...corners.map((p) => p.x)) + margin,
    minY: Math.min(...corners.map((p) => p.y)) - margin,
    maxY: Math.max(...corners.map((p) => p.y)) + margin,
  };
}

/**
 * Amplificador operacional: triángulo con la entrada inversora (−, terminal `a`) y la no
 * inversora (+, terminal `b`) en la base y la salida (`c`) en el vértice.
 */
export function OpAmpSymbol({ a, b, c }: { a: GridPoint; b: GridPoint; c: GridPoint }) {
  const { at } = opAmpFrame(a, b, c);
  const pts = (list: GridPoint[]) => list.map((p) => `${p.x},${p.y}`).join(' ');
  const back1 = at(0.5, -0.5);
  const back2 = at(0.5, 2.5);
  const apex = at(3.3, 1);
  const minus = [at(0.75, 0), at(1.05, 0)];
  const plus = [at(0.75, 2), at(1.05, 2), at(0.9, 1.85), at(0.9, 2.15)];
  return (
    <g>
      <polyline points={pts([a, at(0.5, 0)])} {...stroke} />
      <polyline points={pts([b, at(0.5, 2)])} {...stroke} />
      <polyline points={pts([apex, c])} {...stroke} />
      <polygon
        points={pts([back1, apex, back2])}
        {...stroke}
        fill="currentColor"
        fillOpacity={0.06}
      />
      <line
        x1={minus[0]!.x}
        y1={minus[0]!.y}
        x2={minus[1]!.x}
        y2={minus[1]!.y}
        {...stroke}
        strokeWidth={1.4}
      />
      <line
        x1={plus[0]!.x}
        y1={plus[0]!.y}
        x2={plus[1]!.x}
        y2={plus[1]!.y}
        {...stroke}
        strokeWidth={1.4}
      />
      <line
        x1={plus[2]!.x}
        y1={plus[2]!.y}
        x2={plus[3]!.x}
        y2={plus[3]!.y}
        {...stroke}
        strokeWidth={1.4}
      />
    </g>
  );
}

export function GroundSymbol({ p }: { p: GridPoint }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <line x1={-0.4} y1={0} x2={0.4} y2={0} {...stroke} />
      <line x1={-0.24} y1={0.16} x2={0.24} y2={0.16} {...stroke} />
      <line x1={-0.09} y1={0.32} x2={0.09} y2={0.32} {...stroke} />
    </g>
  );
}

export function ComponentShape({ c, selected }: { c: CircuitComponent; selected?: boolean }) {
  // Capacitor, inductor, diodo y amplificador dibujan sus propios terminales (la línea no debe
  // cruzar el cuerpo).
  const drawsLeads =
    c.kind === 'capacitor' || c.kind === 'inductor' || c.kind === 'diode' || c.kind === 'opamp';
  return (
    <g className={selected ? 'text-primary' : 'text-foreground'}>
      {!drawsLeads && <line x1={c.a.x} y1={c.a.y} x2={c.b.x} y2={c.b.y} {...stroke} />}
      {c.kind === 'resistor' && <ResistorSymbol a={c.a} b={c.b} />}
      {c.kind === 'voltage-source' && <VoltageSourceSymbol a={c.a} b={c.b} />}
      {c.kind === 'current-source' && <CurrentSourceSymbol a={c.a} b={c.b} />}
      {c.kind === 'capacitor' && <CapacitorSymbol a={c.a} b={c.b} />}
      {c.kind === 'inductor' && <InductorSymbol a={c.a} b={c.b} />}
      {c.kind === 'diode' && <DiodeSymbol a={c.a} b={c.b} />}
      {c.kind === 'opamp' && c.c && <OpAmpSymbol a={c.a} b={c.b} c={c.c} />}
    </g>
  );
}

/** Iconos de la paleta (24×24, sin coordenadas del mundo). */
export function PaletteIcon({
  kind,
}: {
  kind: CircuitComponent['kind'] | 'wire' | 'ground' | 'select';
}) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (kind === 'select')
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path d="M5 3 L5 18 L9.5 14 L12.5 20 L15 19 L12 13 L18 13 Z" {...common} />
      </svg>
    );
  if (kind === 'wire')
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <line x1="2" y1="12" x2="22" y2="12" {...common} />
        <circle cx="2" cy="12" r="1.6" fill="currentColor" />
        <circle cx="22" cy="12" r="1.6" fill="currentColor" />
      </svg>
    );
  if (kind === 'ground')
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <line x1="12" y1="3" x2="12" y2="13" {...common} />
        <line x1="5" y1="13" x2="19" y2="13" {...common} />
        <line x1="8" y1="17" x2="16" y2="17" {...common} />
        <line x1="10.5" y1="21" x2="13.5" y2="21" {...common} />
      </svg>
    );
  if (kind === 'resistor')
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path d="M2 12 L6 12 L8.5 7 L11 17 L13.5 7 L16 17 L18 12 L22 12" {...common} />
      </svg>
    );
  if (kind === 'capacitor')
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <line x1="2" y1="12" x2="10" y2="12" {...common} />
        <line x1="14" y1="12" x2="22" y2="12" {...common} />
        <line x1="10" y1="5" x2="10" y2="19" {...common} strokeWidth={2.2} />
        <line x1="14" y1="5" x2="14" y2="19" {...common} strokeWidth={2.2} />
      </svg>
    );
  if (kind === 'inductor')
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path
          d="M2 14 L4 14 a2 2 0 0 1 4 0 a2 2 0 0 1 4 0 a2 2 0 0 1 4 0 a2 2 0 0 1 4 0 L22 14"
          {...common}
        />
      </svg>
    );
  if (kind === 'opamp')
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path d="M6 4 L20 12 L6 20 Z" {...common} />
        <line x1="2" y1="8" x2="6" y2="8" {...common} />
        <line x1="2" y1="16" x2="6" y2="16" {...common} />
        <line x1="20" y1="12" x2="23" y2="12" {...common} />
        <line x1="8" y1="8" x2="10.5" y2="8" {...common} strokeWidth={1.4} />
        <line x1="8" y1="16" x2="10.5" y2="16" {...common} strokeWidth={1.4} />
        <line x1="9.25" y1="14.75" x2="9.25" y2="17.25" {...common} strokeWidth={1.4} />
      </svg>
    );
  if (kind === 'diode')
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <line x1="2" y1="12" x2="8" y2="12" {...common} />
        <line x1="16" y1="12" x2="22" y2="12" {...common} />
        <path d="M8 6 L16 12 L8 18 Z" {...common} />
        <line x1="16" y1="6" x2="16" y2="18" {...common} strokeWidth={2.2} />
      </svg>
    );
  if (kind === 'voltage-source')
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <circle cx="12" cy="12" r="6" {...common} />
        <line x1="8.5" y1="12" x2="11" y2="12" {...common} />
        <line x1="9.75" y1="10.7" x2="9.75" y2="13.3" {...common} />
        <line x1="13" y1="12" x2="15.5" y2="12" {...common} />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <circle cx="12" cy="12" r="6" {...common} />
      <path d="M9.5 15 L12 9 L14.5 15 M10.5 13 L13.5 13" {...common} />
    </svg>
  );
}
