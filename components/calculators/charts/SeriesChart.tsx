'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { Series } from '@/lib/calculators/types';
import { formatNumber } from '@/lib/math/format';

function ChartTooltip({
  active,
  payload,
  label,
  series,
}: TooltipContentProps & { series: Series }) {
  const point = payload?.[0];
  if (!active || !point || typeof point.value !== 'number') return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">
        {series.xLabel}: <span className="text-foreground tabular font-mono">{String(label)}</span>
      </p>
      <p className="text-muted-foreground">
        {series.yLabel}:{' '}
        <span className="text-foreground tabular font-mono">{formatNumber(point.value, 6)}</span>
      </p>
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
 * Gráfica de línea de una serie (p. ej. error vs. iteración). Una sola serie → sin leyenda: el
 * título la nombra. La tabla de resultados es la vista alternativa accesible.
 */
export function SeriesChart({ series }: { series: Series }) {
  const isLog = series.yScale === 'log';
  // En escala logarítmica no existen el 0 ni los negativos (p. ej. error exactamente 0).
  const points = isLog ? series.points.filter((p) => p.y > 0) : series.points;
  if (points.length < 2) return null;

  // Recharts calcula mal el dominio automático en escala log (recorta el último punto), así que
  // se fija en potencias de 10 que envuelven los datos, con una marca por década.
  const logTicks = isLog ? decadeTicks(points.map((p) => p.y)) : undefined;

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
          <LineChart data={points} margin={{ top: 12, right: 16, bottom: 20, left: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              allowDecimals={false}
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
              dataKey="y"
              type="number"
              scale={isLog ? 'log' : 'linear'}
              domain={logTicks ? [logTicks[0]!, logTicks.at(-1)!] : ['auto', 'auto']}
              ticks={logTicks}
              tickFormatter={(v: number) => formatNumber(v, 2)}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              stroke="var(--border)"
              width={64}
            />
            <Tooltip
              content={(props) => <ChartTooltip {...props} series={series} />}
              cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
            />
            <Line
              type="linear"
              dataKey="y"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: 'var(--card)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
