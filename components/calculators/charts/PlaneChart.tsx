'use client';

import type { Point, Series } from '@/lib/calculators/types';
import { formatNumber } from '@/lib/math/format';

/** Lado del lienzo en unidades del viewBox (la figura se escala al ancho disponible). */
const SIZE = 400;
const PAD = 36;

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-3)',
];

/** Paso «redondo» (1, 2 o 5 por una potencia de 10) para unas 6 a 8 marcas. */
function niceStep(span: number): number {
  const raw = span / 6;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit < 1.5 ? 1 : unit < 3.5 ? 2 : unit < 7.5 ? 5 : 10) * power;
}

/**
 * Plano complejo con la misma escala en los dos ejes (los ángulos se ven como en el libro):
 * curvas unidas en el orden de sus puntos (las ramas del lugar de las raíces, las asíntotas) y
 * marcadores para polos (×), ceros (○) y puntos calculados (●). Las líneas que salen de la
 * ventana se recortan.
 */
export function PlaneChart({ series }: { series: Series }) {
  const curves = series.curves ?? [];
  const markers = series.markers ?? [];
  const solid = curves.filter((c) => !c.dashed).flatMap((c) => c.points);
  const marked = markers.flatMap((m) => m.points);
  const basis: Point[] = [...solid, ...marked].filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  if (basis.length === 0) return null;

  // Ventana cuadrada centrada en los datos, con margen e incluyendo el origen.
  const xs = [...basis.map((p) => p.x), 0];
  const ys = [...basis.map((p) => p.y), 0];
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half =
    Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.55;
  const x0 = cx - half;
  const y0 = cy - half;
  const span = 2 * half;
  const inner = SIZE - 2 * PAD;
  const px = (x: number) => PAD + ((x - x0) / span) * inner;
  const py = (y: number) => SIZE - PAD - ((y - y0) / span) * inner;

  const step = niceStep(span);
  const ticks = (from: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(from / step) * step; v <= from + span + 1e-9; v += step)
      out.push(Number(v.toPrecision(12)));
    return out;
  };
  const xTicks = ticks(x0);
  const yTicks = ticks(y0);

  const labels = [...new Set(curves.map((c) => c.label))];
  const colorOf = (label: string) => COLORS[labels.indexOf(label) % COLORS.length]!;
  const markerColor = (shape: string) =>
    shape === 'cross'
      ? 'var(--foreground)'
      : shape === 'circle'
        ? 'var(--chart-2)'
        : 'var(--chart-4)';
  const clipId = `plano-${series.id}`;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">{series.title}</figcaption>
      <div className="bg-card mx-auto w-full max-w-md rounded-lg border p-2">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${series.title}: plano complejo, ${series.xLabel} en el eje horizontal y ${series.yLabel} en el vertical`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD} y={PAD} width={inner} height={inner} />
            </clipPath>
          </defs>
          {xTicks.map((t) => (
            <g key={`x${t}`}>
              <line
                x1={px(t)}
                y1={PAD}
                x2={px(t)}
                y2={SIZE - PAD}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={px(t)}
                y={SIZE - PAD + 14}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted-foreground)"
              >
                {formatNumber(t, 4)}
              </text>
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line
                x1={PAD}
                y1={py(t)}
                x2={SIZE - PAD}
                y2={py(t)}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={PAD - 4}
                y={py(t) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--muted-foreground)"
              >
                {formatNumber(t, 4)}
              </text>
            </g>
          ))}
          <g clipPath={`url(#${clipId})`}>
            {/* Ejes real e imaginario. */}
            <line
              x1={PAD}
              y1={py(0)}
              x2={SIZE - PAD}
              y2={py(0)}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
            />
            <line
              x1={px(0)}
              y1={PAD}
              x2={px(0)}
              y2={SIZE - PAD}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
            />
            {curves.map((c, i) => (
              <polyline
                key={i}
                points={c.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
                fill="none"
                stroke={c.dashed ? 'var(--muted-foreground)' : colorOf(c.label)}
                strokeWidth={c.dashed ? 1.2 : 2}
                strokeDasharray={c.dashed ? '6 4' : undefined}
                strokeLinejoin="round"
              />
            ))}
            {markers.map((m) =>
              m.points.map((p, j) => {
                const x = px(p.x);
                const y = py(p.y);
                const color = markerColor(m.shape);
                if (m.shape === 'cross') {
                  return (
                    <g key={`${m.label}-${j}`} stroke={color} strokeWidth={2}>
                      <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} />
                      <line x1={x - 5} y1={y + 5} x2={x + 5} y2={y - 5} />
                    </g>
                  );
                }
                if (m.shape === 'circle') {
                  return (
                    <circle
                      key={`${m.label}-${j}`}
                      cx={x}
                      cy={y}
                      r={5}
                      fill="var(--card)"
                      stroke={color}
                      strokeWidth={2}
                    />
                  );
                }
                return (
                  <circle
                    key={`${m.label}-${j}`}
                    cx={x}
                    cy={y}
                    r={3.5}
                    fill={color}
                    stroke="var(--card)"
                    strokeWidth={1}
                  />
                );
              }),
            )}
          </g>
          <text
            x={SIZE - PAD}
            y={py(0) - 6}
            textAnchor="end"
            fontSize="11"
            fill="var(--muted-foreground)"
          >
            {series.xLabel}
          </text>
          <text x={px(0) + 6} y={PAD + 10} fontSize="11" fill="var(--muted-foreground)">
            {series.yLabel}
          </text>
        </svg>
      </div>
      <ul className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {labels.map((label) => {
          const dashed = curves.find((c) => c.label === label)?.dashed;
          return (
            <li key={label} className="flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden className="shrink-0">
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke={dashed ? 'var(--muted-foreground)' : colorOf(label)}
                  strokeWidth={2}
                  strokeDasharray={dashed ? '4 3' : undefined}
                />
              </svg>
              {label}
            </li>
          );
        })}
        {markers.map((m) => (
          <li key={m.label} className="flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden className="shrink-0">
              {m.shape === 'cross' ? (
                <g stroke={markerColor(m.shape)} strokeWidth={1.8}>
                  <line x1="2" y1="2" x2="10" y2="10" />
                  <line x1="2" y1="10" x2="10" y2="2" />
                </g>
              ) : m.shape === 'circle' ? (
                <circle
                  cx="6"
                  cy="6"
                  r="4"
                  fill="none"
                  stroke={markerColor(m.shape)}
                  strokeWidth={1.8}
                />
              ) : (
                <circle cx="6" cy="6" r="3.5" fill={markerColor(m.shape)} />
              )}
            </svg>
            {m.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
