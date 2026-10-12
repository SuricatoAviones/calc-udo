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
  return (
    <g className={selected ? 'text-primary' : 'text-foreground'}>
      <line x1={c.a.x} y1={c.a.y} x2={c.b.x} y2={c.b.y} {...stroke} />
      {c.kind === 'resistor' && <ResistorSymbol a={c.a} b={c.b} />}
      {c.kind === 'voltage-source' && <VoltageSourceSymbol a={c.a} b={c.b} />}
      {c.kind === 'current-source' && <CurrentSourceSymbol a={c.a} b={c.b} />}
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
