'use client';

import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { Series } from '@/lib/calculators/types';
import { formatNumber } from '@/lib/math/format';
import { withKeys } from '../keys';
import { PlaneChart } from './PlaneChart';

interface Row {
  x: number;
  y?: number;
  ref?: number;
  /** Copia de y dentro del rango resaltado: se rellena el área bajo la curva solo ahí. */
  hl?: number;
  /** Valores de las líneas adicionales (`series.others`), por índice. */
  others?: Record<number, number>;
  /** Límites inferior y superior de la región sombreada (`series.region`). */
  band?: [number, number];
  /** Punto suelto (`series.scatter`). */
  sc?: number;
}

/** Más puntos que esto → sin marcadores (una curva muestreada, no iteraciones). */
const MAX_DOTS = 30;

/** Colores de las líneas adicionales, distintos del de la serie principal. */
const OTHER_COLORS = ['var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-2)'];

// Recharts clona el elemento de `content` con las props del tooltip; por eso son opcionales.
function ChartTooltip({
  active,
  payload,
  label,
  series,
}: Readonly<Partial<TooltipContentProps> & { series: Series }>) {
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
      {series.scatter && row.sc !== undefined && (
        <p className="text-muted-foreground">
          {series.scatter.label}:{' '}
          <span className="text-foreground tabular font-mono">{formatNumber(row.sc, 6)}</span>
        </p>
      )}
      {withKeys(series.others ?? [], (o) => o.label).map(({ item: other, key }, i) =>
        row.others?.[i] === undefined ? null : (
          <p key={key} className="text-muted-foreground">
            {other.label}:{' '}
            <span className="text-foreground tabular font-mono">
              {formatNumber(row.others[i], 6)}
            </span>
          </p>
        ),
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

/**
 * Completa cada línea adicional en los x de las demás series que caen dentro de su propio rango,
 * interpolando linealmente, para que se dibuje continua sin unir tramos fuera de su rango.
 */
function fillOthers(sorted: Row[], series: Series): void {
  series.others?.forEach((other, i) => {
    const points = [...other.points].sort((a, b) => a.x - b.x);
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) return;
    for (const row of sorted) {
      if (row.others?.[i] !== undefined || row.x < first.x || row.x > last.x) continue;
      const right = points.findIndex((p) => p.x > row.x);
      const a = points[right - 1];
      const b = points[right];
      if (!a || !b) continue;
      row.others = { ...row.others, [i]: a.y + ((row.x - a.x) / (b.x - a.x)) * (b.y - a.y) };
    }
  });
}

/** Igual que `fillOthers`, para los dos bordes de la región sombreada. */
function fillRegion(sorted: Row[], series: Series): void {
  const points = [...(series.region?.points ?? [])].sort((a, b) => a.x - b.x);
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return;
  for (const row of sorted) {
    if (row.band || row.x < first.x || row.x > last.x) continue;
    const right = points.findIndex((p) => p.x > row.x);
    const a = points[right - 1];
    const b = points[right];
    if (!a || !b) continue;
    const t = (row.x - a.x) / (b.x - a.x);
    row.band = [a.low + t * (b.low - a.low), a.high + t * (b.high - a.high)];
  }
}

/** Une la serie principal, la de referencia, las adicionales y la región en filas por x. */
function mergeRows(series: Series, isLog: boolean): Row[] {
  const keep = (y: number) => Number.isFinite(y) && (!isLog || y > 0);
  const rows = new Map<number, Row>();
  for (const p of series.points) if (keep(p.y)) rows.set(p.x, { x: p.x, y: p.y });
  for (const p of series.reference?.points ?? []) {
    if (!keep(p.y)) continue;
    rows.set(p.x, { ...(rows.get(p.x) ?? { x: p.x }), ref: p.y });
  }
  series.others?.forEach((other, i) => {
    for (const p of other.points) {
      if (!keep(p.y)) continue;
      const row = rows.get(p.x) ?? { x: p.x };
      rows.set(p.x, { ...row, others: { ...row.others, [i]: p.y } });
    }
  });
  for (const p of series.region?.points ?? []) {
    if (!keep(p.low) || !keep(p.high)) continue;
    rows.set(p.x, { ...(rows.get(p.x) ?? { x: p.x }), band: [p.low, p.high] });
  }
  for (const p of series.scatter?.points ?? []) {
    if (!keep(p.y)) continue;
    rows.set(p.x, { ...(rows.get(p.x) ?? { x: p.x }), sc: p.y });
  }
  const sorted = [...rows.values()].sort((a, b) => a.x - b.x);
  fillOthers(sorted, series);
  fillRegion(sorted, series);
  const { highlight } = series;
  if (!highlight || (series.kind ?? 'line') !== 'line') return sorted;
  return withHighlight(sorted, highlight);
}

/**
 * Marca las filas del rango resaltado (`hl`). Se agregan los extremos del rango (interpolando)
 * para que el área empiece y termine exactamente en ellos, aunque la curva esté muestreada en
 * otros puntos.
 */
function withHighlight(sorted: Row[], highlight: { from: number; to: number }): Row[] {
  const withEdges = [...sorted];
  for (const edge of [highlight.from, highlight.to]) {
    if (sorted.some((r) => r.x === edge)) continue;
    const right = sorted.findIndex((r) => r.x > edge && r.y !== undefined);
    const left = sorted[right - 1];
    const next = sorted[right];
    if (right <= 0 || left?.y === undefined || next?.y === undefined) continue;
    const t = (edge - left.x) / (next.x - left.x);
    withEdges.push({ x: edge, y: left.y + t * (next.y - left.y) });
  }
  withEdges.sort((a, b) => a.x - b.x);
  return withEdges.map((r) =>
    r.y !== undefined && r.x >= highlight.from && r.x <= highlight.to ? { ...r, hl: r.y } : r,
  );
}

/**
 * Marcas de los ejes. Recharts calcula mal el dominio automático en escala log (recorta el último
 * punto), así que se fija en potencias de 10 que envuelven los datos, con una marca por década.
 */
function axisTicks(rows: Row[], isLog: boolean, xLog: boolean) {
  const yValues = rows
    .flatMap((r) => [r.y, r.ref, r.sc, ...Object.values(r.others ?? {}), ...(r.band ?? [])])
    .filter((v): v is number => v !== undefined);
  return {
    logTicks: isLog ? decadeTicks(yValues) : undefined,
    xTicks: xLog ? decadeTicks(rows.map((r) => r.x)) : undefined,
    digits: isLog ? 2 : tickDigits(yValues),
  };
}

/** Dominio del eje y: décadas en escala log; en barras, desde 0. */
function yDomain(
  logTicks: number[] | undefined,
  kind: Series['kind'],
): Readonly<[number | 'auto', number | 'auto']> {
  if (logTicks) return [logTicks[0]!, logTicks.at(-1)!];
  return kind === 'line' ? ['auto', 'auto'] : [0, 'auto'];
}

/**
 * Gráfica de una serie: línea, área o barras, con una serie de referencia opcional (punteada) y
 * líneas adicionales (`others`) en la misma escala. Con una sola serie no hay leyenda: el título
 * la nombra. La tabla de resultados es la vista alternativa accesible.
 */
export function SeriesChart({ series }: Readonly<{ series: Series }>) {
  if (series.kind === 'plane') return <PlaneChart series={series} />;
  return <CartesianChart series={series} />;
}

function CartesianChart({ series }: Readonly<{ series: Series }>) {
  const kind = series.kind ?? 'line';
  const isLog = series.yScale === 'log';
  const xLog = series.xScale === 'log';
  const rows = mergeRows(series, isLog).filter((r) => !xLog || r.x > 0);
  const mainCount = rows.filter((r) => r.y !== undefined).length;
  if (mainCount < 2 && !(kind === 'bar' && mainCount >= 1)) return null;

  const others = kind === 'line' ? (series.others ?? []) : [];
  const region = kind === 'line' ? series.region : undefined;
  const scatter = kind === 'line' ? series.scatter : undefined;
  const { logTicks, xTicks, digits } = axisTicks(rows, isLog, xLog);
  const allIntegers = rows.every((r) => Number.isInteger(r.x));
  const showDots = mainCount <= MAX_DOTS && kind !== 'bar';
  const mainDot = showDots
    ? { r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }
    : false;
  const keyedOthers = withKeys(others, (o) => o.label);
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
          <ComposedChart data={rows} margin={{ top: 12, right: 16, bottom: 20, left: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="x"
              type={kind === 'bar' ? 'category' : 'number'}
              scale={xLog ? 'log' : 'auto'}
              domain={xTicks ? [xTicks[0]!, xTicks.at(-1)!] : ['dataMin', 'dataMax']}
              ticks={xTicks}
              allowDataOverflow={xLog}
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
              domain={yDomain(logTicks, kind)}
              ticks={logTicks}
              tickFormatter={(v: number) => formatNumber(v, digits)}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              stroke="var(--border)"
              width={64}
            />
            <Tooltip
              content={<ChartTooltip series={series} />}
              cursor={
                kind === 'bar'
                  ? { fill: 'var(--muted)', opacity: 0.5 }
                  : { stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }
              }
            />
            {/* Primero la región y las líneas adicionales, para que la serie principal quede encima. */}
            {region && (
              <Area
                type="linear"
                dataKey="band"
                name={region.label}
                stroke="none"
                fill="var(--chart-1)"
                fillOpacity={0.18}
                isAnimationActive={false}
                legendType="none"
                tooltipType="none"
                activeDot={false}
              />
            )}
            {keyedOthers.map(({ item: other, key }, i) => (
              <Line
                key={key}
                type="linear"
                dataKey={(row: Row) => row.others?.[i]}
                name={other.label}
                stroke={OTHER_COLORS[i % OTHER_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
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
                dot={mainDot}
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
                dot={mainDot}
                activeDot={{ r: 6, stroke: 'var(--card)', strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls
              />
            )}
            {scatter && (
              // Una línea sin trazo con marcadores: los puntos quedan sueltos y las filas sin
              // dato (las de la curva) no dibujan nada.
              <Line
                type="linear"
                dataKey="sc"
                name={scatter.label}
                stroke="none"
                dot={{ r: 3.5, fill: 'var(--chart-2)', stroke: 'var(--card)', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: 'var(--chart-2)', stroke: 'var(--card)', strokeWidth: 2 }}
                isAnimationActive={false}
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
      <ChartLegend series={series} keyedOthers={keyedOthers} region={region} scatter={scatter} />
    </figure>
  );
}

/** Leyenda de la gráfica; con una sola serie no hay leyenda (el título la nombra). */
function ChartLegend({
  series,
  keyedOthers,
  region,
  scatter,
}: Readonly<{
  series: Series;
  keyedOthers: { item: NonNullable<Series['others']>[number]; key: string }[];
  region: Series['region'];
  scatter: Series['scatter'];
}>) {
  if (!series.reference && keyedOthers.length === 0 && !region && !scatter) return null;
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <LegendItem color="var(--chart-1)" label={series.label ?? series.yLabel} />
      {region && <LegendItem color="var(--chart-1)" label={region.label} area />}
      {scatter && <LegendItem color="var(--chart-2)" label={scatter.label} dot />}
      {series.reference && (
        <LegendItem color="var(--chart-2)" label={series.reference.label} dashed />
      )}
      {keyedOthers.map(({ item: other, key }, i) => (
        <LegendItem
          key={key}
          color={OTHER_COLORS[i % OTHER_COLORS.length]!}
          label={other.label}
          thin
        />
      ))}
    </ul>
  );
}

/**
 * Entrada de la leyenda. Va en HTML debajo de la gráfica, y no dentro del SVG, para que en
 * pantallas angostas pueda ocupar varios renglones sin tapar las curvas.
 */
function LegendItem({
  color,
  label,
  dashed = false,
  thin = false,
  area = false,
  dot = false,
}: Readonly<{
  color: string;
  label: string;
  dashed?: boolean;
  thin?: boolean;
  /** Muestra un rectángulo relleno (una región) en vez de una línea. */
  area?: boolean;
  /** Muestra un punto (datos sueltos) en vez de una línea. */
  dot?: boolean;
}>) {
  if (dot) {
    return (
      <li className="flex items-center gap-1.5">
        <svg width="18" height="10" aria-hidden className="shrink-0">
          <circle cx="9" cy="5" r="3.5" fill={color} />
        </svg>
        {label}
      </li>
    );
  }
  if (area) {
    return (
      <li className="flex items-center gap-1.5">
        <svg width="18" height="10" aria-hidden className="shrink-0">
          <rect width="18" height="10" rx="2" fill={color} fillOpacity={0.25} />
        </svg>
        {label}
      </li>
    );
  }
  return (
    <li className="flex items-center gap-1.5">
      <svg width="18" height="8" aria-hidden className="shrink-0">
        <line
          x1="0"
          y1="4"
          x2="18"
          y2="4"
          stroke={color}
          strokeWidth={thin ? 1.5 : 2.5}
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      </svg>
      {label}
    </li>
  );
}
