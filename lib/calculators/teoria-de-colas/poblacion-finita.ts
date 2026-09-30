/**
 * Modelo con población finita — (M/M/R):(DG/K/K) en la notación de Taha, el «modelo de
 * reparación de máquinas»: K clientes (máquinas) que llegan cada uno con tasa λ cuando no están
 * en el sistema, y R servidores con tasa μ. Con n clientes en el sistema, la tasa de llegadas es
 * λₙ = (K − n)λ. Con r = λ/μ:
 *
 *   p_n = C(K, n) rⁿ p₀                          si 0 ≤ n ≤ R
 *   p_n = C(K, n) n! rⁿ / (R! R^{n−R}) · p₀      si R ≤ n ≤ K
 *   L = Σ n p_n,   L_q = Σ_{n>R} (n − R) p_n,   λ_ef = λ(K − L),   W = L/λ_ef,   W_q = L_q/λ_ef
 *
 * Taha, sec. 18.6.4 (ejemplo 18.6-8, 10.ª ed.); Anderson, Sweeney y Williams, sec. 11.9 (ejemplo
 * de Kolkmeyer, 13.ª ed.).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, Step } from '../types';
import {
  factorial,
  littleSteps,
  probabilityTrace,
  queueRatesShape,
  queueSummary,
  type QueueValue,
} from './queueing';

const MAX_POPULATION = 200;

export const finitePopulationInputSchema = z
  .object({
    ...queueRatesShape,
    servers: z
      .number({ error: 'Ingresa el número de servidores R.' })
      .int('El número de servidores debe ser entero.')
      .min(1, 'Debe haber al menos 1 servidor.')
      .max(MAX_POPULATION, `El máximo es ${MAX_POPULATION} servidores.`),
    population: z
      .number({ error: 'Ingresa el tamaño de la población K.' })
      .int('La población debe ser un número entero.')
      .min(1, 'La población debe tener al menos 1 cliente.')
      .max(MAX_POPULATION, `La población máxima permitida es ${MAX_POPULATION}.`),
  })
  .refine((v) => v.servers <= v.population, {
    message: 'Con más servidores que clientes, algunos nunca trabajarían: usa R ≤ K.',
    path: ['servers'],
  });

export type FinitePopulationInput = z.infer<typeof finitePopulationInputSchema>;

export interface FinitePopulationValue extends QueueValue {
  /** Probabilidad de que un cliente tenga que esperar, P(n ≥ R). */
  waitProbability: number;
  /** Porcentaje de la población que está fuera del sistema (máquinas trabajando). */
  productivity: number;
}

const n = toLatexNumber;

/** Combinaciones C(K, n) sin desbordar (producto incremental). */
function combinations(total: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (total - k + i)) / i;
  return result;
}

export function solveFinitePopulation({
  lambda,
  mu,
  servers: R,
  population: K,
}: FinitePopulationInput): CalculatorResult<FinitePopulationValue, never> {
  const r = lambda / mu;
  const weights = Array.from({ length: K + 1 }, (_, k) =>
    k <= R
      ? combinations(K, k) * r ** k
      : (combinations(K, k) * factorial(k) * r ** k) / (factorial(R) * R ** (k - R)),
  );
  const total = weights.reduce((sum, w) => sum + w, 0);
  const probabilities = weights.map((w) => w / total);
  const p0 = probabilities[0]!;
  const L = probabilities.reduce((sum, p, k) => sum + k * p, 0);
  const Lq = probabilities.reduce((sum, p, k) => sum + Math.max(0, k - R) * p, 0);
  const waitProbability = probabilities.reduce((sum, p, k) => (k >= R ? sum + p : sum), 0);
  const lambdaEff = lambda * (K - L);
  const productivity = ((K - L) / K) * 100;
  const value: FinitePopulationValue = {
    rho: lambdaEff / (R * mu),
    p0,
    L,
    Lq,
    W: L / lambdaEff,
    Wq: Lq / lambdaEff,
    lambdaEff,
    probabilities,
    waitProbability,
    productivity,
  };

  const shown = weights.slice(0, 4).map((w) => n(w, 6));
  const steps: Step[] = [
    {
      title: 'Relación entre las tasas',
      explanation: `λ es la tasa de llegadas de cada cliente mientras está fuera del sistema. Con n clientes en el sistema solo ${K} − n pueden llegar, así que la tasa total es λₙ = (K − n)λ.`,
      formula: 'r = \\frac{\\lambda}{\\mu}, \\qquad \\lambda_n = (K - n)\\lambda',
      substitution: `r = \\frac{${n(lambda)}}{${n(mu)}}`,
      result: `r = ${n(r)}`,
    },
    {
      title: 'Probabilidad de que el sistema esté vacío',
      explanation: `Se suman los términos de cada estado n = 0, 1, …, ${K}; cada p_n es su término multiplicado por p₀.`,
      formula:
        'p_0 = \\left[\\sum_{n=0}^{R} \\binom{K}{n} r^n + \\sum_{n=R+1}^{K} \\binom{K}{n} \\frac{n!\\,r^n}{R!\\,R^{\\,n-R}}\\right]^{-1}',
      substitution: `p_0 = \\left[${shown.join(' + ')}${K > 3 ? ' + \\cdots' : ''}\\right]^{-1} = \\left[${n(total, 8)}\\right]^{-1}`,
      result: `p_0 = ${n(p0)}`,
    },
    {
      title: 'Clientes promedio en el sistema',
      explanation: 'No hay fórmula cerrada: se calcula con la definición de valor esperado.',
      formula: 'L = \\sum_{n=0}^{K} n\\,p_n',
      substitution: `L = ${probabilities
        .slice(0, 3)
        .map((p, k) => `${k}(${n(p, 6)})`)
        .join(' + ')}${K > 2 ? ' + \\cdots' : ''}`,
      result: `L = ${n(L)}`,
    },
    {
      title: 'Clientes promedio en la cola',
      explanation: `Solo esperan los clientes que exceden a los ${R} servidores.`,
      formula: 'L_q = \\sum_{n=R+1}^{K} (n - R)\\,p_n',
      result: `L_q = ${n(Lq)}`,
    },
    {
      title: 'Tasa efectiva de llegadas',
      explanation: 'En promedio hay K − L clientes fuera del sistema, cada uno con tasa λ.',
      formula: '\\lambda_{ef} = \\lambda\\,(K - L)',
      substitution: `\\lambda_{ef} = ${n(lambda)}\\,(${K} - ${n(L)})`,
      result: `\\lambda_{ef} = ${n(lambdaEff)}`,
    },
    ...littleSteps(value, '\\lambda_{ef}'),
    {
      title: 'Probabilidad de esperar',
      explanation: 'Un cliente espera si al llegar encuentra ocupados a todos los servidores.',
      formula: 'P_w = \\sum_{n=R}^{K} p_n',
      result: `P_w = ${n(waitProbability)}`,
    },
    {
      title: 'Productividad de la población',
      explanation:
        'En el problema de reparación de máquinas es el porcentaje de máquinas que están trabajando.',
      formula: '\\text{Productividad} = \\frac{K - L}{K} \\times 100\\,\\%',
      substitution: `\\text{Productividad} = \\frac{${K} - ${n(L)}}{${K}} \\times 100\\,\\%`,
      result: `\\text{Productividad} = ${n(productivity, 6)}\\,\\%`,
    },
  ];

  return {
    ok: true,
    value,
    summary: queueSummary(value, [
      { label: 'Tasa efectiva de llegadas', value: `\\lambda_{ef} = ${n(lambdaEff, 6)}` },
      { label: 'Probabilidad de esperar', value: `P_w = ${n(waitProbability, 6)}` },
      {
        label: 'Productividad',
        value: `${n(productivity, 5)}\\,\\%`,
      },
    ]),
    ...probabilityTrace(steps, value, [
      {
        level: 'info',
        message: `En promedio ${formatNumber(K - L, 4)} de los ${K} clientes están fuera del sistema y ${formatNumber(L, 4)} dentro (esperando o en servicio).`,
      },
    ]),
  };
}

export const finitePopulation: Calculator<FinitePopulationInput, FinitePopulationValue, never> = {
  meta: {
    id: 'cola-poblacion-finita',
    title: 'Modelo con población finita',
    summary: 'Fuente de entrada con un número limitado de clientes (reparación de máquinas).',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 18.6.4, Ejemplo 18.6-8 (10.ª ed.)' },
      {
        sourceId: 'anderson-1993',
        locator: 'Sec. 11.9, ejemplo de Kolkmeyer Manufacturing (13.ª ed.)',
      },
      { sourceId: 'hillier-lieberman-2002', locator: 'Sec. 17.6, variación de fuente finita' },
    ],
  },
  inputSchema: finitePopulationInputSchema,
  // Anderson, ejemplo de Kolkmeyer: 6 máquinas que fallan cada 20 h (λ = 0.05) y un técnico que
  // repara en 2 h en promedio (μ = 0.5).
  example: { lambda: 0.05, mu: 0.5, servers: 1, population: 6 },
  solve: solveFinitePopulation,
};
