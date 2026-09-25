'use client';

import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { Series } from '@/lib/calculators/types';
import { formatNumber } from '@/lib/math/format';

interface Row {
  x: number;
  y?: number;
  ref?: number;
  /** Copia de y dentro del rango resaltado: se rellena el área bajo la curva solo ahí. */
  hl?: number;
}

/** Más puntos que esto → sin marcadores (una curva muestreada, no iteraciones). */
const MAX_DOTS = 30;

function ChartTooltip({
  active,
  payload,
  label,
  series,
}: TooltipContentProps & { series: Series }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as Row | undefined;
  if (!row) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">
        {series.xLabel}:{' '}
        <span className="text-foreground tabular font-mono">
          {typeof label === 'number' ? formatNumber(label, 6) : String(label)}
        </span>
      </p>
      {row.y !== undefined && (
        <p className="text-muted-foreground">
          {series.label ?? series.yLabel}:{' '}
          <span className="text-foreground tabular font-mono">{formatNumber(row.y, 6)}</span>
        </p>
      )}
      {series.reference && row.ref !== undefined && (
        <p className="text-muted-foreground">
          {series.reference.label}:{' '}
          <span className="text-foreground tabular font-mono">{formatNumber(row.ref, 6)}</span>
        </p>
      )}
    </div>
  );
}

/** Potencias de 10 desde la década del mínimo hasta la del máximo (máx. ~8 marcas). */
function decadeTicks(values: number[]): number[] {
  const lo = Math.floor(Math.log10(Math.min(...values)));
  const hi = Math.ceil(Math.log10(Math.max(...values)));
  const step = Math.max(1, Math.ceil((hi - lo) / 8));
  const ticks: number[] = [];
  for (let e = lo; e <= hi; e += step) ticks.push(10 ** e);
  if (ticks.at(-1)! < 10 ** hi) ticks.push(10 ** (lo + step * ticks.length));
  return ticks;
}

/**
 * Cifras significativas para las marcas del eje: suficientes para distinguir valores cercanos
 * (p. ej. 14.75 y 14.875), sin llenar el eje de decimales.
 */
function tickDigits(values: number[]): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const magnitude = Math.max(Math.abs(min), Math.abs(max));
  const span = max - min;
  if (span === 0 || magnitude === 0) return 3;
  return Math.min(8, Math.max(2, Math.ceil(Math.log10(magnitude / span)) + 2));
}

/** Une la serie principal y la de referencia en filas por x (pueden tener x distintos). */
function mergeRows(series: Series, isLog: boolean): Row[] {
  const keep = (y: number) => Number.isFinite(y) && (!isLog || y > 0);
  const rows = new Map<number, Row>();
  for (const p of series.points) if (keep(p.y)) rows.set(p.x, { x: p.x, y: p.y });
  for (const p of series.reference?.points ?? []) {
    if (!keep(p.y)) continue;
    rows.set(p.x, { ...(rows.get(p.x) ?? { x: p.x }), ref: p.y });
  }
  const sorted = [...rows.values()].sort((a, b) => a.x - b.x);
  const { highlight } = series;
  if (!highlight || (series.kind ?? 'line') !== 'line') return sorted;

  // Se agregan los extremos del rango (interpolando) para que el área empiece y termine
  // exactamente en ellos, aunque la curva esté muestreada en otros puntos.
  const withEdges = [...sorted];
  for (const edge of [highlight.from, highlight.to]) {
    if (rows.has(edge)) continue;
    const right = sorted.findIndex((r) => r.x > edge && r.y !== undefined);
    const left = sorted[right - 1];
    const next = sorted[right];
    if (right <= 0 || !left || !next || left.y === undefined || next.y === undefined) continue;
    const t = (edge - left.x) / (next.x - left.x);
    withEdges.push({ x: edge, y: left.y + t * (next.y - left.y) });
  }
  return withEdges
    .sort((a, b) => a.x - b.x)
    .map((r) =>
      r.y !== undefined && r.x >= highlight.from && r.x <= highlight.to ? { ...r, hl: r.y } : r,
    );
}

/**
 * Gráfica de una serie: línea, área o barras, con una serie de referencia opcional (punteada) en
 * la misma escala. Con una sola serie no hay leyenda: el título la nombra. La tabla de
 * resultados es la vista alternativa accesible.
 */
export function SeriesChart({ series }: { series: Series }) {
  const kind = series.kind ?? 'line';
  const isLog = series.yScale === 'log';
  const rows = mergeRows(series, isLog);
  const mainCount = rows.filter((r) => r.y !== undefined).length;
  if (mainCount < 2 && !(kind === 'bar' && mainCount >= 1)) return null;

  const yValues = rows.flatMap((r) => [r.y, r.ref]).filter((v): v is number => v !== undefined);
  // Recharts calcula mal el dominio automático en escala log (recorta el último punto), así que
  // se fija en potencias de 10 que envuelven los datos, con una marca por década.
  const logTicks = isLog ? decadeTicks(yValues) : undefined;
  const digits = isLog ? 2 : tickDigits(yValues);
  const allIntegers = rows.every((r) => Number.isInteger(r.x));
  const showDots = mainCount <= MAX_DOTS && kind !== 'bar';
  const hasLegend = Boolean(series.reference);
  const inHighlight = (x: number) =>
    series.highlight !== undefined && x >= series.highlight.from && x <= series.highlight.to;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">
        {series.title}
        {isLog && <span className="text-muted-foreground font-normal"> (escala logarítmica)</span>}
      </figcaption>
      <div
        className="bg-card h-64 rounded-lg border p-2 sm:h-72"
        role="img"
        aria-label={`${series.title}: ${series.yLabel} en función de ${series.xLabel}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 12, right: 16, bottom: hasLegend ? 4 : 20, left: 8 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="x"
              type={kind === 'bar' ? 'category' : 'number'}
              domain={['dataMin', 'dataMax']}
              allowDecimals={!allIntegers}
              tickFormatter={(v: number) => formatNumber(v, 4)}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              stroke="var(--border)"
              label={{
                value: series.xLabel,
                position: 'insideBottom',
                offset: -12,
                fill: 'var(--muted-foreground)',
                fontSize: 12,
              }}
            />
            <YAxis
              type="number"
              scale={isLog ? 'log' : 'linear'}
              domain={
                logTicks
                  ? [logTicks[0]!, logTicks.at(-1)!]
                  : kind === 'line'
                    ? ['auto', 'auto']
                    : [0, 'auto']
              }
              ticks={logTicks}
              tickFormatter={(v: number) => formatNumber(v, digits)}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              stroke="var(--border)"
              width={64}
            />
            <Tooltip
              content={(props) => <ChartTooltip {...props} series={series} />}
              cursor={
                kind === 'bar'
                  ? { fill: 'var(--muted)', opacity: 0.5 }
                  : { stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }
              }
            />
            {hasLegend && (
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
              />
            )}
            {series.highlight && kind === 'line' && (
              <Area
                type="linear"
                dataKey="hl"
                name="Área"
                stroke="none"
                fill="var(--chart-1)"
                fillOpacity={0.25}
                isAnimationActive={false}
                legendType="none"
                tooltipType="none"
                activeDot={false}
              />
            )}
            {kind === 'bar' && (
              <Bar
                dataKey="y"
                name={series.label ?? series.yLabel}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.x}
                    fill="var(--chart-1)"
                    fillOpacity={series.highlight && !inHighlight(row.x) ? 0.3 : 1}
                  />
                ))}
              </Bar>
            )}
            {kind === 'area' && (
              <Area
                type="linear"
                dataKey="y"
                name={series.label ?? series.yLabel}
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="var(--chart-1)"
                fillOpacity={0.15}
                dot={
                  showDots
                    ? { r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }
                    : false
                }
                isAnimationActive={false}
                connectNulls
              />
            )}
            {kind === 'line' && (
              <Line
                type="linear"
                dataKey="y"
                name={series.label ?? series.yLabel}
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={
                  showDots
                    ? { r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }
                    : false
                }
                activeDot={{ r: 6, stroke: 'var(--card)', strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls
              />
            )}
            {series.reference && (
              <Line
                type="monotone"
                dataKey="ref"
                name={series.reference.label}
                stroke="var(--chart-2)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
