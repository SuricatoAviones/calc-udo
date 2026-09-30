/**
 * Piezas comunes de las redes de colas con estaciones M/M/s (Hillier & Lieberman, sec. 17.9;
 * Winston, sec. 20.10): la tabla de estaciones y el análisis de cada estación por separado.
 *
 * Teorema de Jackson: si las llegadas externas son de Poisson, los servicios exponenciales y las
 * colas infinitas, en estado estable cada estación j se comporta como un M/M/s_j independiente
 * con su tasa total de llegadas λ_j. Por eso L de la red es la suma de los L_j.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { CellValue, ResultTable, Step } from '../types';
import { mmsMeasures, type MmsMeasures } from './queueing';

export const MAX_STATIONS = 10;

export const stationShape = {
  servers: z
    .number({ error: 'Ingresa el número de servidores.' })
    .int('El número de servidores debe ser entero.')
    .min(1, 'Cada estación necesita al menos 1 servidor.')
    .max(50, 'El máximo es 50 servidores por estación.'),
  mu: z
    .number({ error: 'Ingresa la tasa de servicio μ.' })
    .refine((v) => Number.isFinite(v) && v > 0, 'μ debe ser mayor que 0.'),
};

export interface StationResult extends MmsMeasures {
  station: number;
  servers: number;
  mu: number;
  lambda: number;
}

const n = toLatexNumber;

/**
 * Analiza cada estación como M/M/s. Devuelve los resultados y los pasos, o el número de la
 * primera estación inestable.
 */
export function analyzeStations(
  stations: { servers: number; mu: number }[],
  lambdas: number[],
): { results: StationResult[]; steps: Step[] } | { unstable: number; steps: Step[] } {
  const results: StationResult[] = [];
  const steps: Step[] = [];
  for (let j = 0; j < stations.length; j++) {
    const { servers: s, mu } = stations[j]!;
    const lambda = lambdas[j]!;
    const m = mmsMeasures(lambda, mu, s);
    const title = `Estación ${j + 1}: M/M/${s} con λ = ${formatNumber(lambda, 8)}`;
    if (!m) {
      steps.push({
        title,
        explanation: `ρ = λ/(sμ) = ${formatNumber(lambda / (s * mu), 6)} ≥ 1: esta estación no tiene capacidad para el flujo que recibe.`,
        formula: '\\rho = \\frac{\\lambda}{s\\mu}',
        substitution: `\\rho = \\frac{${n(lambda)}}{${s}(${n(mu)})}`,
        result: `\\rho = ${n(lambda / (s * mu))} \\ge 1`,
      });
      return { unstable: j + 1, steps };
    }
    results.push({ station: j + 1, servers: s, mu, lambda, ...m });
    steps.push({
      title,
      children: [
        {
          title: 'Utilización',
          formula: '\\rho = \\frac{\\lambda}{s\\mu}',
          substitution: `\\rho = \\frac{${n(lambda)}}{${s}(${n(mu)})}`,
          result: `\\rho = ${n(m.rho)}`,
        },
        {
          title: 'Probabilidad de que la estación esté vacía',
          formula:
            'p_0 = \\left[\\sum_{n=0}^{s-1} \\frac{r^n}{n!} + \\frac{r^s}{s!\\,(1 - \\rho)}\\right]^{-1}, \\qquad r = \\frac{\\lambda}{\\mu}',
          result: `p_0 = ${n(m.p0)}`,
        },
        {
          title: 'Clientes en la cola y en la estación',
          formula:
            s === 1
              ? 'L_q = \\frac{\\rho^2}{1 - \\rho}, \\qquad L = L_q + \\frac{\\lambda}{\\mu}'
              : 'L_q = \\frac{P(n \\ge s)\\,\\rho}{1 - \\rho}, \\qquad L = L_q + \\frac{\\lambda}{\\mu}',
          substitution:
            s === 1
              ? `L_q = \\frac{(${n(m.rho)})^2}{1 - ${n(m.rho)}}`
              : `L_q = \\frac{(${n(m.waitProbability)})(${n(m.rho)})}{1 - ${n(m.rho)}}`,
          result: `L_q = ${n(m.Lq)}, \\qquad L = ${n(m.L)}`,
        },
        {
          title: 'Tiempos en la cola y en la estación',
          formula: 'W_q = \\frac{L_q}{\\lambda}, \\qquad W = W_q + \\frac{1}{\\mu}',
          result: `W_q = ${n(m.Wq)}, \\qquad W = ${n(m.W)}`,
        },
      ],
    });
  }
  return { results, steps };
}

/** Tabla con las medidas de cada estación. */
export function stationsTable(results: StationResult[]): ResultTable {
  return {
    id: 'estaciones',
    title: 'Medidas de desempeño de cada estación',
    columns: [
      { key: 'station', header: '\\text{Estación}' },
      { key: 'servers', header: 's_j' },
      { key: 'lambda', header: '\\lambda_j' },
      { key: 'rho', header: '\\rho_j' },
      { key: 'p0', header: 'p_0' },
      { key: 'waitProbability', header: 'P(n \\ge s_j)' },
      { key: 'Lq', header: 'L_q' },
      { key: 'L', header: 'L' },
      { key: 'Wq', header: 'W_q' },
      { key: 'W', header: 'W' },
    ],
    rows: results.map((r): Record<string, CellValue> => ({
      station: r.station,
      servers: r.servers,
      lambda: r.lambda,
      rho: r.rho,
      p0: r.p0,
      waitProbability: r.waitProbability,
      Lq: r.Lq,
      L: r.L,
      Wq: r.Wq,
      W: r.W,
    })),
  };
}
