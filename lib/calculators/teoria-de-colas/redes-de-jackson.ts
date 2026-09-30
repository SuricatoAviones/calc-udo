/**
 * Redes de Jackson (Hillier & Lieberman, sec. 17.9; Winston, sec. 20.10): m estaciones; a la
 * estación j llegan clientes de afuera con tasa a_j (Poisson) y, al salir de la estación i, un
 * cliente va a la j con probabilidad p_ij o abandona la red con probabilidad 1 − Σ_j p_ij.
 *
 * Las tasas totales de llegada resuelven el sistema lineal
 *
 *   λ_j = a_j + Σ_i λ_i p_ij,   j = 1, …, m     ⟺     (I − Pᵀ) λ = a
 *
 * y, si λ_j < s_j μ_j, cada estación es un M/M/s_j independiente con tasa λ_j. Para toda la red,
 * L = Σ L_j y W = L / Σ a_j (ley de Little con la tasa de llegadas desde afuera).
 */
import { z } from 'zod';
import { solveLinearSystem } from '@/lib/math/linear-algebra';
import { formatNumber, latexLines, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import {
  analyzeStations,
  MAX_STATIONS,
  stationShape,
  stationsTable,
  type StationResult,
} from './networks';

const probability = z
  .number({ error: 'Cada probabilidad de ruta debe ser un número.' })
  .refine((v) => Number.isFinite(v) && v >= 0 && v <= 1, 'Las probabilidades van de 0 a 1.');

export const jacksonInputSchema = z
  .object({
    stations: z
      .array(
        z.object({
          ...stationShape,
          external: z
            .number({ error: 'Ingresa la tasa de llegadas desde afuera (0 si no hay).' })
            .refine((v) => Number.isFinite(v) && v >= 0, 'La tasa externa no puede ser negativa.'),
        }),
      )
      .min(1, 'Agrega al menos una estación.')
      .max(MAX_STATIONS, `El máximo es ${MAX_STATIONS} estaciones.`),
    routing: z.array(z.array(probability)),
  })
  .superRefine((v, ctx) => {
    const m = v.stations.length;
    if (v.routing.length !== m || v.routing.some((row) => row.length !== m)) {
      ctx.addIssue({
        code: 'custom',
        path: ['routing'],
        message: `La matriz de rutas debe ser de ${m} × ${m}, una fila y una columna por estación.`,
      });
      return;
    }
    v.routing.forEach((row, i) => {
      const sum = row.reduce((a, b) => a + b, 0);
      if (sum > 1 + 1e-9) {
        ctx.addIssue({
          code: 'custom',
          path: ['routing'],
          message: `La fila ${i + 1} suma ${formatNumber(sum, 6)}: la probabilidad de ir a otras estaciones no puede pasar de 1.`,
        });
      }
    });
    if (v.stations.every((s) => s.external === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['stations'],
        message: 'Al menos una estación debe recibir llegadas desde afuera.',
      });
    }
  });

export type JacksonInput = z.infer<typeof jacksonInputSchema>;

export interface JacksonValue {
  lambdas: number[];
  stations: StationResult[];
  L: number;
  W: number;
  externalRate: number;
}

export type JacksonErrorCode = 'singular' | 'unstable';

type Result = CalculatorResult<JacksonValue, JacksonErrorCode>;

const n = toLatexNumber;

export function solveJackson({ stations, routing }: JacksonInput): Result {
  const m = stations.length;
  const a = stations.map((s) => s.external);
  const equations = Array.from({ length: m }, (_, j) => {
    const terms = routing.flatMap((row, i) =>
      row[j]! > 0 ? [`${n(row[j]!)}\\,\\lambda_{${i + 1}}`] : [],
    );
    return `\\lambda_{${j + 1}} = ${n(a[j]!)}${terms.length ? ` + ${terms.join(' + ')}` : ''}`;
  });
  const steps: Step[] = [
    {
      title: 'Ecuaciones de flujo',
      explanation:
        'La tasa total de llegadas a cada estación es la que viene de afuera más la fracción de las salidas de las otras estaciones que se dirigen a ella.',
      formula: '\\lambda_j = a_j + \\sum_{i=1}^{m} \\lambda_i\\,p_{ij}',
      substitution: latexLines(equations),
    },
  ];

  // (I − Pᵀ) λ = a
  const matrix = Array.from({ length: m }, (_, j) =>
    Array.from({ length: m }, (_, i) => (i === j ? 1 : 0) - routing[i]![j]!),
  );
  const lambdas = solveLinearSystem(matrix, a);
  if (!lambdas || lambdas.some((v) => !Number.isFinite(v) || v < -1e-9)) {
    return {
      ok: false,
      error: {
        code: 'singular',
        message:
          'Las ecuaciones de flujo no tienen solución: algún grupo de estaciones retiene a los clientes para siempre (sus filas de la matriz de rutas suman 1). Revisa las probabilidades de salida.',
      },
      ...emptyTrace(),
      steps,
    };
  }
  const clean = lambdas.map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
  steps[0]!.result = clean.map((v, j) => `\\lambda_{${j + 1}} = ${n(v)}`).join(',\\ ');

  const analysis = analyzeStations(stations, clean);
  steps.push(...analysis.steps);
  if ('unstable' in analysis) {
    return {
      ok: false,
      error: {
        code: 'unstable',
        message: `La estación ${analysis.unstable} recibe más clientes de los que puede atender (λ ≥ sμ): la red no alcanza el estado estable.`,
      },
      ...emptyTrace(),
      steps,
    };
  }
  const { results } = analysis;
  const L = results.reduce((acc, r) => acc + r.L, 0);
  const externalRate = a.reduce((acc, v) => acc + v, 0);
  const W = L / externalRate;
  steps.push({
    title: 'Medidas de toda la red',
    explanation:
      'Los clientes en la red son la suma de los de cada estación. El tiempo en la red no es la suma de los W_j, porque un cliente puede visitar una estación varias veces o ninguna: se usa la ley de Little con la tasa de llegadas desde afuera.',
    formula: 'L = \\sum_j L_j, \\qquad W = \\frac{L}{\\sum_j a_j}',
    substitution: `L = ${results.map((r) => n(r.L, 6)).join(' + ')}, \\qquad W = \\frac{${n(L)}}{${n(externalRate)}}`,
    result: `L = ${n(L)}, \\qquad W = ${n(W)}`,
  });

  return {
    ok: true,
    value: { lambdas: clean, stations: results, L, W, externalRate },
    summary: [
      { label: 'Clientes en la red', value: `L = ${n(L, 6)}`, emphasis: true },
      { label: 'Tiempo en la red', value: `W = ${n(W, 6)}` },
      {
        label: 'Tasas de llegada',
        value: clean.map((v, j) => `\\lambda_{${j + 1}} = ${n(v, 6)}`).join(',\\ '),
      },
    ],
    ...emptyTrace(),
    steps,
    tables: [stationsTable(results)],
    notices: [
      {
        level: 'info',
        message:
          'Cada estación se analiza como un M/M/s independiente; la probabilidad conjunta de (n₁, …, n_m) clientes es el producto de las probabilidades de cada estación (solución en forma de producto).',
      },
    ],
  };
}

export const jackson: Calculator<JacksonInput, JacksonValue, JacksonErrorCode> = {
  meta: {
    id: 'redes-de-jackson',
    title: 'Redes de Jackson',
    summary: 'Tasas efectivas de llegada y medidas de desempeño por estación.',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 17.9, redes de Jackson, tabla 17.5 (7.ª ed.)',
      },
      { sourceId: 'winston-1994', locator: 'Sec. 20.10, Ejemplo 14 (4.ª ed.)' },
    ],
  },
  inputSchema: jacksonInputSchema,
  // Hillier, tabla 17.5: tres estaciones con μ = 10; s = 1, 2, 1; llegadas externas 1, 4 y 3.
  // Fila i = estación de la que sale el cliente, columna j = estación a la que va.
  example: {
    stations: [
      { servers: 1, mu: 10, external: 1 },
      { servers: 2, mu: 10, external: 4 },
      { servers: 1, mu: 10, external: 3 },
    ],
    routing: [
      [0, 0.6, 0.3],
      [0.1, 0, 0.3],
      [0.4, 0.4, 0],
    ],
  },
  solve: solveJackson,
};
