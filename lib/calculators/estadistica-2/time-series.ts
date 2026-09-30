/**
 * Descomposición clásica (multiplicativa) de una serie de tiempo: Yₜ = Tₜ × Sₜ × Cₜ × Iₜ
 * (Anderson, Sweeney y Williams, cap. de series de tiempo y pronósticos):
 *
 * 1. Promedios móviles centrados de L periodos (L = periodos por ciclo estacional). Con L par se
 *    promedian dos promedios móviles consecutivos para centrarlos en un periodo.
 * 2. Valores estacional-irregulares Yₜ / PMCₜ; el índice estacional de cada estación es el promedio
 *    de sus valores, ajustado para que los L índices sumen L.
 * 3. Serie desestacionalizada Yₜ / Sₜ y tendencia lineal por mínimos cuadrados Tₜ = b₀ + b₁t,
 *    con t = 1, 2, …, n.
 * 4. Componente cíclico-irregular Yₜ / (Tₜ Sₜ) × 100 %. Sin estacionalidad: porcentaje de la
 *    tendencia Yₜ/Tₜ × 100 % y residuo cíclico relativo (Yₜ − Tₜ)/Tₜ × 100 %.
 *
 * Pronóstico: F_{n+h} = T_{n+h} × S_{estación de n+h}.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import type { Series, Step, TableColumn } from '../types';
import { parseSample } from './samples';

export const MAX_SERIES = 600;

export const seasonField = z
  .number({ error: 'Ingresa los periodos por estación (0 si no hay estacionalidad).' })
  .int('Debe ser un número entero.')
  .min(0, 'No puede ser negativo.')
  .max(52, 'El máximo es 52 periodos por ciclo.');

/** Valida la serie según la longitud de la estación. */
export function refineSeries(
  v: { data: string; season: number },
  ctx: z.RefinementCtx,
): number[] | null {
  const parsed = parseSample(v.data, 3, 'la serie');
  if (typeof parsed === 'string') {
    ctx.addIssue({ code: 'custom', path: ['data'], message: parsed });
    return null;
  }
  if (parsed.length > MAX_SERIES) {
    ctx.addIssue({ code: 'custom', path: ['data'], message: `El máximo es ${MAX_SERIES} datos.` });
    return null;
  }
  if (v.season === 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['season'],
      message: 'Usa 0 si no hay estacionalidad, o 2 o más periodos por ciclo.',
    });
    return null;
  }
  if (v.season >= 2) {
    if (parsed.length < 2 * v.season) {
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message: `Con estaciones de ${v.season} periodos hacen falta al menos ${2 * v.season} datos (dos ciclos).`,
      });
      return null;
    }
    if (parsed.some((y) => y <= 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message: 'El modelo multiplicativo necesita datos positivos.',
      });
      return null;
    }
  }
  return parsed;
}

export interface Decomposition {
  season: number | null;
  y: number[];
  /** Promedio móvil centrado de cada periodo (null en los extremos). */
  cma: (number | null)[];
  ratios: (number | null)[];
  /** Índice estacional de cada estación (1 … L), ya ajustado. */
  indices: number[];
  /** Índices sin ajustar (promedio de los valores estacional-irregulares). */
  rawIndices: number[];
  /** Índice que corresponde a cada periodo (1 si no hay estacionalidad). */
  periodIndex: number[];
  deseasonalized: number[];
  b0: number;
  b1: number;
  trend: number[];
  /** Yₜ / (Tₜ Sₜ) × 100 (o Yₜ/Tₜ × 100 sin estacionalidad). */
  cyclical: number[];
}

/** Estación (1 … L) del periodo t (1, 2, …). */
export const seasonOf = (t: number, season: number) => ((t - 1) % season) + 1;

export function decompose(y: number[], seasonLength: number): Decomposition {
  const n = y.length;
  const season = seasonLength >= 2 ? seasonLength : null;
  const cma: (number | null)[] = new Array(n).fill(null);
  const ratios: (number | null)[] = new Array(n).fill(null);
  let indices: number[] = [];
  let rawIndices: number[] = [];
  if (season) {
    const half = Math.floor(season / 2);
    const average = (from: number) =>
      y.slice(from, from + season).reduce((s, v) => s + v, 0) / season;
    for (let i = 0; i < n; i++) {
      if (season % 2 === 1) {
        if (i - half >= 0 && i + half < n) cma[i] = average(i - half);
      } else if (i - half >= 0 && i + half < n) {
        // Promedio de los promedios móviles que terminan justo antes y justo después de i + ½.
        cma[i] = (average(i - half) + average(i - half + 1)) / 2;
      }
      if (cma[i] !== null) ratios[i] = y[i]! / cma[i]!;
    }
    rawIndices = Array.from({ length: season }, (_, s) => {
      const values = ratios.filter((r, i): r is number => r !== null && i % season === s);
      return values.reduce((acc, v) => acc + v, 0) / values.length;
    });
    const total = rawIndices.reduce((s, v) => s + v, 0);
    indices = rawIndices.map((v) => (v * season) / total);
  }
  const periodIndex = y.map((_, i) => (season ? indices[i % season]! : 1));
  const deseasonalized = y.map((v, i) => v / periodIndex[i]!);
  // Tendencia por mínimos cuadrados con t = 1 … n.
  const ts = y.map((_, i) => i + 1);
  const meanT = (n + 1) / 2;
  const meanD = deseasonalized.reduce((s, v) => s + v, 0) / n;
  const stt = ts.reduce((s, t) => s + (t - meanT) ** 2, 0);
  const std = ts.reduce((s, t, i) => s + (t - meanT) * (deseasonalized[i]! - meanD), 0);
  const b1 = std / stt;
  const b0 = meanD - b1 * meanT;
  const trend = ts.map((t) => b0 + b1 * t);
  const cyclical = y.map((v, i) => (v / (trend[i]! * periodIndex[i]!)) * 100);
  return {
    season,
    y,
    cma,
    ratios,
    indices,
    rawIndices,
    periodIndex,
    deseasonalized,
    b0,
    b1,
    trend,
    cyclical,
  };
}

const n = (v: number) => toLatexNumber(v, 6);
const op = (v: number) => toLatexOperand(v, 6);

export function trendLatex(d: Decomposition): string {
  return `T_t = ${n(d.b0)} ${d.b1 < 0 ? '-' : '+'} ${n(Math.abs(d.b1))}\\,t`;
}

/** Pasos de la descomposición, comunes a las dos calculadoras. */
export function decompositionSteps(d: Decomposition): Step[] {
  const steps: Step[] = [];
  const size = d.y.length;
  if (d.season) {
    const L = d.season;
    const firstIndex = d.cma.findIndex((v) => v !== null);
    const even = L % 2 === 0;
    steps.push({
      title: `Promedios móviles centrados de ${L} periodos`,
      explanation: even
        ? `Un promedio de ${L} periodos queda entre dos periodos; se promedian dos consecutivos para centrarlo. Los primeros y los últimos ${L / 2} periodos no tienen promedio móvil centrado.`
        : `Cada promedio de ${L} periodos queda centrado en el periodo del medio.`,
      formula: even
        ? `PMC_t = \\frac{1}{2}\\left(\\frac{Y_{t-${L / 2}} + \\cdots + Y_{t+${L / 2 - 1}}}{${L}} + \\frac{Y_{t-${L / 2 - 1}} + \\cdots + Y_{t+${L / 2}}}{${L}}\\right)`
        : `PMC_t = \\frac{Y_{t-${(L - 1) / 2}} + \\cdots + Y_{t+${(L - 1) / 2}}}{${L}}`,
      result: `PMC_{${firstIndex + 1}} = ${n(d.cma[firstIndex]!)}`,
    });
    steps.push({
      title: 'Valores estacional-irregulares',
      explanation:
        'Al dividir cada dato entre su promedio móvil centrado se elimina la tendencia (y el ciclo); queda el efecto estacional con la irregularidad.',
      formula: '\\frac{Y_t}{PMC_t}',
      substitution: `\\frac{Y_{${firstIndex + 1}}}{PMC_{${firstIndex + 1}}} = \\frac{${n(d.y[firstIndex]!)}}{${n(d.cma[firstIndex]!)}}`,
      result: `${n(d.ratios[firstIndex]!)}`,
    });
    const sum = d.rawIndices.reduce((s, v) => s + v, 0);
    steps.push({
      title: 'Índices estacionales',
      explanation: `Se promedian los valores estacional-irregulares de cada estación. Como deben sumar ${L}, se multiplican por ${L}/${formatNumber(sum, 6)}.`,
      formula: `S_j = \\bar{r}_j \\cdot \\frac{${L}}{\\sum \\bar{r}_j}`,
      result: d.indices.map((v, j) => `S_{${j + 1}} = ${n(v)}`).join(',\\ '),
    });
    steps.push({
      title: 'Serie desestacionalizada',
      formula: '\\frac{Y_t}{S_t}',
      substitution: `\\frac{Y_1}{S_1} = \\frac{${n(d.y[0]!)}}{${n(d.periodIndex[0]!)}}`,
      result: `${n(d.deseasonalized[0]!)}`,
    });
  }
  const ts = d.y.map((_, i) => i + 1);
  const sumT = ts.reduce((s, t) => s + t, 0);
  const sumY = d.deseasonalized.reduce((s, v) => s + v, 0);
  const sumTY = ts.reduce((s, t, i) => s + t * d.deseasonalized[i]!, 0);
  const sumT2 = ts.reduce((s, t) => s + t * t, 0);
  const yName = d.season ? '\\tilde{Y}' : 'Y';
  steps.push({
    title: d.season ? 'Tendencia de la serie desestacionalizada' : 'Tendencia lineal',
    explanation: `Recta de mínimos cuadrados con t = 1, 2, …, ${size}${d.season ? ' ajustada a los datos desestacionalizados' : ''}.`,
    formula: `b_1 = \\frac{\\sum t\\,${yName}_t - (\\sum t)(\\sum ${yName}_t)/n}{\\sum t^2 - (\\sum t)^2/n}, \\qquad b_0 = \\bar{${yName}} - b_1\\bar{t}`,
    substitution: `b_1 = \\frac{${n(sumTY)} - (${n(sumT)})(${n(sumY)})/${size}}{${n(sumT2)} - ${op(sumT)}^2/${size}}, \\qquad b_0 = ${n(sumY / size)} - ${op(d.b1)}${op(sumT / size)}`,
    result: trendLatex(d),
  });
  return steps;
}

export function decompositionColumns(d: Decomposition, withCyclical: boolean): TableColumn[] {
  return [
    { key: 't', header: 't' },
    ...(d.season ? [{ key: 'season', header: '\\text{Estación}' }] : []),
    { key: 'y', header: 'Y_t' },
    ...(d.season
      ? [
          { key: 'cma', header: 'PMC_t' },
          { key: 'ratio', header: 'Y_t / PMC_t' },
          { key: 'index', header: 'S_t' },
          { key: 'deseasonalized', header: 'Y_t / S_t' },
        ]
      : []),
    { key: 'trend', header: 'T_t' },
    ...(withCyclical
      ? d.season
        ? [{ key: 'cyclical', header: 'Y_t/(T_t S_t)\\ (\\%)' }]
        : [
            { key: 'cyclical', header: 'Y_t/T_t\\ (\\%)' },
            { key: 'residual', header: '(Y_t - T_t)/T_t\\ (\\%)' },
          ]
      : []),
  ];
}

export function decompositionRows(d: Decomposition) {
  return d.y.map((y, i) => ({
    t: i + 1,
    season: d.season ? seasonOf(i + 1, d.season) : null,
    y,
    cma: d.cma[i] ?? null,
    ratio: d.ratios[i] ?? null,
    index: d.periodIndex[i]!,
    deseasonalized: d.deseasonalized[i]!,
    trend: d.trend[i]!,
    cyclical: d.cyclical[i]!,
    residual: d.cyclical[i]! - 100,
  }));
}

export function seriesChart(
  d: Decomposition,
  forecasts: { t: number; value: number }[] = [],
): Series {
  const others: Series['others'] = [
    {
      label: 'Tendencia',
      points: [...d.y.map((_, i) => i + 1), ...forecasts.map((f) => f.t)].map((t) => ({
        x: t,
        y: d.b0 + d.b1 * t,
      })),
    },
  ];
  if (d.season) {
    others.push({
      label: 'Desestacionalizada',
      points: d.deseasonalized.map((v, i) => ({ x: i + 1, y: v })),
    });
  }
  if (forecasts.length > 0) {
    others.push({
      label: 'Pronóstico',
      points: [
        { x: d.y.length, y: d.y.at(-1)! },
        ...forecasts.map((f) => ({ x: f.t, y: f.value })),
      ],
    });
  }
  return {
    id: 'serie',
    title: 'Serie de tiempo',
    xLabel: 'Periodo t',
    yLabel: 'Y',
    label: 'Serie observada',
    points: d.y.map((v, i) => ({ x: i + 1, y: v })),
    others,
  };
}
