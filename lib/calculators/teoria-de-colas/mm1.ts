/**
 * Modelo M/M/1 — (M/M/1):(DG/∞/∞) en la notación de Taha: llegadas de Poisson con tasa λ, un
 * servidor con servicio exponencial de tasa μ, capacidad y población infinitas.
 *
 *   ρ = λ/μ < 1,  p_n = (1 − ρ)ρⁿ,  L = ρ/(1 − ρ),  L_q = ρ²/(1 − ρ),  W = L/λ,  W_q = L_q/λ
 *
 * Taha, sec. 17.6.1 (ejemplo 17.6-2).
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import type { Calculator, Step } from '../types';
import {
  littleSteps,
  probabilitiesUntilCovered,
  probabilityTrace,
  queueRatesShape,
  queueSummary,
  unstable,
  type QueueErrorCode,
  type QueueResult,
  type QueueValue,
} from './queueing';

export const mm1InputSchema = z.object(queueRatesShape);
export type MM1Input = z.infer<typeof mm1InputSchema>;

const n = toLatexNumber;

export function solveMM1({ lambda, mu }: MM1Input): QueueResult {
  const rho = lambda / mu;
  const steps: Step[] = [
    {
      title: 'Factor de utilización',
      explanation:
        'Fracción del tiempo que el servidor está ocupado. Debe ser menor que 1 para que el sistema alcance el estado estable.',
      formula: '\\rho = \\frac{\\lambda}{\\mu}',
      substitution: `\\rho = \\frac{${n(lambda)}}{${n(mu)}}`,
      result: `\\rho = ${n(rho)}`,
    },
  ];
  if (rho >= 1) return unstable(steps, rho);

  const p0 = 1 - rho;
  const L = rho / (1 - rho);
  const Lq = (rho * rho) / (1 - rho);
  const value: QueueValue = {
    rho,
    p0,
    L,
    Lq,
    W: L / lambda,
    Wq: Lq / lambda,
    lambdaEff: lambda,
    probabilities: probabilitiesUntilCovered((k) => p0 * rho ** k),
  };

  steps.push(
    {
      title: 'Probabilidad de que el sistema esté vacío',
      formula: 'p_0 = 1 - \\rho',
      substitution: `p_0 = 1 - ${n(rho)}`,
      result: `p_0 = ${n(p0)}`,
    },
    {
      title: 'Probabilidad de n clientes en el sistema',
      explanation:
        'La tabla de resultados tiene los valores hasta que la probabilidad acumulada llega a ≈ 1.',
      formula: 'p_n = (1 - \\rho)\\,\\rho^n',
      substitution: `p_1 = (${n(p0)})(${n(rho)})^1`,
      result: `p_1 = ${n(value.probabilities[1] ?? p0 * rho)}`,
    },
    {
      title: 'Clientes promedio en el sistema',
      formula: 'L = \\frac{\\rho}{1 - \\rho}',
      substitution: `L = \\frac{${n(rho)}}{1 - ${n(rho)}}`,
      result: `L = ${n(L)}`,
    },
    {
      title: 'Clientes promedio en la cola',
      formula: 'L_q = \\frac{\\rho^2}{1 - \\rho}',
      substitution: `L_q = \\frac{(${n(rho)})^2}{1 - ${n(rho)}}`,
      result: `L_q = ${n(Lq)}`,
    },
    ...littleSteps(value, '\\lambda'),
  );

  return { ok: true, value, summary: queueSummary(value), ...probabilityTrace(steps, value) };
}

export const mm1: Calculator<MM1Input, QueueValue, QueueErrorCode> = {
  meta: {
    id: 'cola-mm1',
    title: 'Modelo M/M/1',
    summary: 'Un servidor, llegadas de Poisson y tiempos de servicio exponenciales.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 17.6.1, Ejemplo 17.6-2 (p. 604 de la 7.ª ed. en español)',
      },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'kaufman-1996' },
    ],
  },
  inputSchema: mm1InputSchema,
  // Taha, ejemplo 17.6-2: lavado de autos, λ = 4 autos/h, servicio de 10 min → μ = 6 autos/h.
  example: { lambda: 4, mu: 6 },
  solve: solveMM1,
};
