/**
 * Núcleo de las pruebas de hipótesis (Walpole, Myers, Myers y Ye, cap. 10; Canavos, cap. 9):
 * a partir del valor del estadístico de prueba y de su distribución bajo H₀ arma la región
 * crítica, el valor P, la decisión y la gráfica de la densidad con la región de rechazo.
 *
 *   H₁: θ ≠ θ₀  → se rechaza en las dos colas (α/2 en cada una)
 *   H₁: θ < θ₀  → cola izquierda;   H₁: θ > θ₀ → cola derecha
 *
 * Los valores críticos se nombran como en Walpole, por el área a su derecha: z_{α/2}, t_{α}, χ²_{α},
 * f_{α}(ν₁, ν₂).
 */
import { z } from 'zod';
import {
  chiSquareCdf,
  chiSquareDensity,
  chiSquareQuantile,
  fCdf,
  fDensity,
  fQuantile,
  studentTCdf,
  studentTDensity,
  studentTQuantile,
} from '@/lib/math/distributions';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { normalDensity, standardNormalCdf, standardNormalQuantile } from '@/lib/math/normal';
import type { Latex, Series, Step, SummaryItem } from '../types';

export const alternatives = ['distinto', 'menor', 'mayor'] as const;
export type Alternative = (typeof alternatives)[number];

export const alternativeField = z.enum(alternatives, { error: 'Elige la hipótesis alternativa.' });

export const alphaField = z
  .number({ error: 'Ingresa el nivel de significancia α.' })
  .refine(
    (v) => Number.isFinite(v) && v > 0 && v < 0.5,
    'α debe estar entre 0 y 0.5 (p. ej. 0.05).',
  );

export type TestStatistic =
  | { kind: 'z' }
  | { kind: 't'; df: number }
  | { kind: 'chi2'; df: number }
  | { kind: 'f'; df1: number; df2: number };

const n = (v: number) => toLatexNumber(v, 6);

export const RELATION: Record<Alternative, Latex> = { distinto: '\\neq', menor: '<', mayor: '>' };

export function hypothesesLatex(parameter: Latex, value: Latex, alternative: Alternative): Latex {
  return `H_0\\!: ${parameter} = ${value}, \\qquad H_1\\!: ${parameter} ${RELATION[alternative]} ${value}`;
}

interface Distribution {
  symbol: Latex;
  name: string;
  cdf(x: number): number;
  quantile(p: number): number;
  density(x: number): number;
  /** Valor crítico con área `area` a la derecha, en notación del libro. */
  criticalName(area: number): Latex;
  symmetric: boolean;
  support: [number, number];
}

function distribution(statistic: TestStatistic): Distribution {
  switch (statistic.kind) {
    case 'z':
      return {
        symbol: 'z',
        name: 'normal estándar',
        cdf: standardNormalCdf,
        quantile: standardNormalQuantile,
        density: (x) => normalDensity(x, 0, 1),
        criticalName: (a) => `z_{${formatNumber(a, 6)}}`,
        symmetric: true,
        support: [-Infinity, Infinity],
      };
    case 't':
      return {
        symbol: 't',
        name: `t de Student con ν = ${formatNumber(statistic.df)} grados de libertad`,
        cdf: (x) => studentTCdf(x, statistic.df),
        quantile: (p) => studentTQuantile(p, statistic.df),
        density: (x) => studentTDensity(x, statistic.df),
        criticalName: (a) => `t_{${formatNumber(a, 6)}}`,
        symmetric: true,
        support: [-Infinity, Infinity],
      };
    case 'chi2':
      return {
        symbol: '\\chi^2',
        name: `ji-cuadrada con ν = ${formatNumber(statistic.df)} grados de libertad`,
        cdf: (x) => chiSquareCdf(x, statistic.df),
        quantile: (p) => chiSquareQuantile(p, statistic.df),
        density: (x) => chiSquareDensity(x, statistic.df),
        criticalName: (a) => `\\chi^2_{${formatNumber(a, 6)}}`,
        symmetric: false,
        support: [0, Infinity],
      };
    case 'f':
      return {
        symbol: 'f',
        name: `F con ν₁ = ${formatNumber(statistic.df1)} y ν₂ = ${formatNumber(statistic.df2)} grados de libertad`,
        cdf: (x) => fCdf(x, statistic.df1, statistic.df2),
        quantile: (p) => fQuantile(p, statistic.df1, statistic.df2),
        density: (x) => fDensity(x, statistic.df1, statistic.df2),
        criticalName: (a) =>
          `f_{${formatNumber(a, 6)}}(${formatNumber(statistic.df1)}, ${formatNumber(statistic.df2)})`,
        symmetric: false,
        support: [0, Infinity],
      };
  }
}

export interface TestOutcome {
  /** Valores críticos: [inferior, superior] en dos colas, uno en una cola. */
  critical: number[];
  pValue: number;
  reject: boolean;
  steps: Step[];
  series: Series;
  summary: SummaryItem[];
}

/** Valor P según la hipótesis alternativa. */
export function pValueOf(
  statistic: TestStatistic,
  value: number,
  alternative: Alternative,
): number {
  const d = distribution(statistic);
  const left = d.cdf(value);
  if (alternative === 'menor') return left;
  if (alternative === 'mayor') return 1 - left;
  if (d.symmetric) return 2 * (1 - d.cdf(Math.abs(value)));
  return Math.min(1, 2 * Math.min(left, 1 - left));
}

/**
 * Región crítica, valor P, decisión y gráfica. `statisticTex` es el valor calculado en LaTeX
 * (normalmente `z = 2.02`).
 */
export function testDecision({
  statistic,
  value,
  alternative,
  alpha,
}: {
  statistic: TestStatistic;
  value: number;
  alternative: Alternative;
  alpha: number;
}): TestOutcome {
  const d = distribution(statistic);
  const s = d.symbol;
  let critical: number[];
  let region: Latex;
  let criticalTex: Latex;
  let inRegion: (x: number) => boolean;
  if (alternative === 'distinto') {
    const lower = d.quantile(alpha / 2);
    const upper = d.quantile(1 - alpha / 2);
    critical = [lower, upper];
    inRegion = (x) => x < lower || x > upper;
    region = `${s} < ${n(lower)} \\;\\text{ o }\\; ${s} > ${n(upper)}`;
    criticalTex = d.symmetric
      ? `${d.criticalName(alpha / 2)} = ${n(upper)}`
      : `${d.criticalName(1 - alpha / 2)} = ${n(lower)}, \\quad ${d.criticalName(alpha / 2)} = ${n(upper)}`;
  } else if (alternative === 'mayor') {
    const upper = d.quantile(1 - alpha);
    critical = [upper];
    inRegion = (x) => x > upper;
    region = `${s} > ${n(upper)}`;
    criticalTex = `${d.criticalName(alpha)} = ${n(upper)}`;
  } else {
    const lower = d.quantile(alpha);
    critical = [lower];
    inRegion = (x) => x < lower;
    region = `${s} < ${n(lower)}`;
    criticalTex = d.symmetric
      ? `-${d.criticalName(alpha)} = ${n(lower)}`
      : `${d.criticalName(1 - alpha)} = ${n(lower)}`;
  }

  const pValue = pValueOf(statistic, value, alternative);
  const reject = inRegion(value);
  const pTex =
    alternative === 'menor'
      ? `P = P(${s} < ${n(value)})`
      : alternative === 'mayor'
        ? `P = P(${s} > ${n(value)})`
        : d.symmetric
          ? `P = 2P(${s} > ${n(Math.abs(value))})`
          : `P = 2\\min\\{P(${s} < ${n(value)}),\\ P(${s} > ${n(value)})\\}`;

  const steps: Step[] = [
    {
      title: 'Región crítica',
      explanation: `Bajo H₀ el estadístico tiene distribución ${d.name}. Con α = ${formatNumber(alpha)}${alternative === 'distinto' ? `, repartido en las dos colas (α/2 = ${formatNumber(alpha / 2)} en cada una)` : alternative === 'mayor' ? ', en la cola derecha' : ', en la cola izquierda'}:`,
      formula: criticalTex,
      result: `\\text{Se rechaza } H_0 \\text{ si } ${region}`,
    },
    {
      title: 'Valor P',
      explanation:
        'Probabilidad, si H₀ fuera cierta, de obtener un estadístico al menos tan extremo como el observado.',
      formula: pTex,
      result: `P = ${toLatexNumber(pValue, 4)}`,
    },
    {
      title: 'Decisión',
      explanation: reject
        ? `El estadístico ${formatNumber(value, 6)} cae en la región crítica (equivalentemente, P = ${formatNumber(pValue, 4)} < α = ${formatNumber(alpha)}): se rechaza H₀ a favor de H₁.`
        : `El estadístico ${formatNumber(value, 6)} no cae en la región crítica (P = ${formatNumber(pValue, 4)} ≥ α = ${formatNumber(alpha)}): no se rechaza H₀. Los datos no dan evidencia suficiente a favor de H₁.`,
      result: reject ? '\\text{Se rechaza } H_0' : '\\text{No se rechaza } H_0',
    },
  ];

  // Gráfica: densidad bajo H₀ con la región de rechazo sombreada. Un estadístico muy extremo (o
  // infinito, p. ej. con un ajuste perfecto) se dibuja en el borde.
  const shown = Number.isFinite(value)
    ? Math.max(-50, Math.min(value, 50 * Math.max(1, ...critical.map(Math.abs))))
    : 0;
  const [supLo] = d.support;
  let lo: number;
  let hi: number;
  if (supLo === 0) {
    lo = 0;
    hi = Math.max(d.quantile(0.999), shown * 1.15, ...critical.map((c) => c * 1.15));
  } else {
    const edge = Math.max(4, Math.abs(shown) * 1.15, ...critical.map((c) => Math.abs(c) * 1.15));
    lo = -edge;
    hi = edge;
  }
  const samples = 240;
  const xs = Array.from({ length: samples + 1 }, (_, i) => lo + ((hi - lo) * i) / samples);
  for (const c of critical) if (c > lo && c < hi) xs.push(c);
  xs.sort((a, b) => a - b);
  const density = (x: number) => {
    const y = d.density(x);
    return Number.isFinite(y) ? y : Number.NaN;
  };
  const points = xs.map((x) => ({ x, y: density(x) })).filter((p) => Number.isFinite(p.y));
  const peak = Math.max(...points.map((p) => p.y));
  const observed = Math.min(Math.max(Number.isFinite(value) ? value : value > 0 ? hi : lo, lo), hi);
  const series: Series = {
    id: 'prueba',
    title: `Distribución de ${s === '\\chi^2' ? 'χ²' : s} bajo H₀ y región de rechazo`,
    xLabel: s === '\\chi^2' ? 'χ²' : s,
    yLabel: 'Densidad',
    label: 'Densidad bajo H₀',
    points,
    region: {
      label: 'Región de rechazo',
      points: points.map((p) => ({
        x: p.x,
        low: 0,
        high: inRegion(p.x) || critical.includes(p.x) ? p.y : 0,
      })),
    },
    others: [
      {
        label: `Estadístico observado = ${formatNumber(value, 4)}`,
        points: [
          { x: observed, y: 0 },
          { x: observed + (hi - lo) * 1e-9, y: peak },
        ],
      },
    ],
  };

  const summary: SummaryItem[] = [
    {
      label: 'Decisión',
      value: reject ? '\\text{Se rechaza } H_0' : '\\text{No se rechaza } H_0',
      emphasis: true,
    },
    { label: 'Valor P', value: `P = ${toLatexNumber(pValue, 4)}` },
    { label: 'Región crítica', value: region },
  ];

  return { critical, pValue, reject, steps, series, summary };
}
