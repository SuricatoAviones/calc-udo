/**
 * Modelo M/M/1/K — (M/M/1):(DG/N/∞) en la notación de Taha: un servidor y capacidad máxima de
 * K clientes en el sistema (en servicio + en cola). Quien llega con el sistema lleno se pierde.
 * Con ρ = λ/μ (puede ser ≥ 1, porque la capacidad limita la cola):
 *
 *   ρ ≠ 1:  p₀ = (1 − ρ)/(1 − ρ^{K+1}),  L = ρ[1 − (K+1)ρ^K + Kρ^{K+1}] / ((1 − ρ)(1 − ρ^{K+1}))
 *   ρ = 1:  p₀ = 1/(K + 1),              L = K/2
 *   p_n = ρⁿ p₀ (n = 0 … K),  λ_ef = λ(1 − p_K),  L_q = L − λ_ef/μ,  W = L/λ_ef,  W_q = L_q/λ_ef
 *
 * Taha, sec. 17.6.2 (ejemplo 17.6-4).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator, Step } from '../types';
import {
  littleSteps,
  probabilityTrace,
  queueRatesShape,
  queueSummary,
  type QueueErrorCode,
  type QueueResult,
  type QueueValue,
} from './queueing';

export const mm1kInputSchema = z.object({
  ...queueRatesShape,
  capacity: z
    .number({ error: 'Ingresa la capacidad K del sistema.' })
    .int('La capacidad debe ser un número entero.')
    .min(1, 'La capacidad debe ser al menos 1.')
    .max(200, 'La capacidad máxima permitida es 200.'),
});
export type MM1KInput = z.infer<typeof mm1kInputSchema>;

const n = toLatexNumber;

export function solveMM1K({ lambda, mu, capacity: K }: MM1KInput): QueueResult {
  const rho = lambda / mu;
  const balanced = Math.abs(rho - 1) < 1e-12;
  const steps: Step[] = [
    {
      title: 'Intensidad de tráfico',
      explanation:
        'Con capacidad limitada no hace falta ρ < 1: cuando el sistema se llena, los clientes que llegan se pierden y la cola no crece sin límite.',
      formula: '\\rho = \\frac{\\lambda}{\\mu}',
      substitution: `\\rho = \\frac{${n(lambda)}}{${n(mu)}}`,
      result: `\\rho = ${n(rho)}`,
    },
  ];

  let p0: number;
  let L: number;
  if (balanced) {
    p0 = 1 / (K + 1);
    L = K / 2;
    steps.push(
      {
        title: 'Probabilidad de que el sistema esté vacío (ρ = 1)',
        explanation: 'Con ρ = 1 los K + 1 estados son igualmente probables.',
        formula: 'p_0 = \\frac{1}{K + 1}',
        substitution: `p_0 = \\frac{1}{${K} + 1}`,
        result: `p_0 = ${n(p0)}`,
      },
      {
        title: 'Clientes promedio en el sistema (ρ = 1)',
        formula: 'L = \\frac{K}{2}',
        substitution: `L = \\frac{${K}}{2}`,
        result: `L = ${n(L)}`,
      },
    );
  } else {
    p0 = (1 - rho) / (1 - rho ** (K + 1));
    L = (rho * (1 - (K + 1) * rho ** K + K * rho ** (K + 1))) / ((1 - rho) * (1 - rho ** (K + 1)));
    steps.push(
      {
        title: 'Probabilidad de que el sistema esté vacío',
        formula: 'p_0 = \\frac{1 - \\rho}{1 - \\rho^{K+1}}',
        substitution: `p_0 = \\frac{1 - ${n(rho)}}{1 - (${n(rho)})^{${K + 1}}}`,
        result: `p_0 = ${n(p0)}`,
      },
      {
        title: 'Clientes promedio en el sistema',
        formula:
          'L = \\frac{\\rho\\left[1 - (K+1)\\rho^K + K\\rho^{K+1}\\right]}{(1 - \\rho)(1 - \\rho^{K+1})}',
        substitution: `L = \\frac{${n(rho)}\\left[1 - (${K + 1})(${n(rho)})^{${K}} + ${K}(${n(rho)})^{${K + 1}}\\right]}{(1 - ${n(rho)})(1 - (${n(rho)})^{${K + 1}})}`,
        result: `L = ${n(L)}`,
      },
    );
  }

  const probabilities = Array.from({ length: K + 1 }, (_, k) => p0 * rho ** k);
  const pK = probabilities[K]!;
  const lambdaEff = lambda * (1 - pK);
  const Lq = L - lambdaEff / mu;
  const value: QueueValue = {
    rho,
    p0,
    L,
    Lq,
    W: L / lambdaEff,
    Wq: Lq / lambdaEff,
    lambdaEff,
    probabilities,
  };

  steps.push(
    {
      title: 'Probabilidad de que el sistema esté lleno',
      explanation: `Es la fracción de clientes que llegan y se pierden porque ya hay ${K} en el sistema.`,
      formula: 'p_K = \\rho^K p_0',
      substitution: `p_{${K}} = (${n(rho)})^{${K}}\\,(${n(p0)})`,
      result: `p_{${K}} = ${n(pK)}`,
    },
    {
      title: 'Tasa efectiva de llegadas',
      explanation: 'Solo entran al sistema los clientes que encuentran lugar.',
      formula: '\\lambda_{ef} = \\lambda\\,(1 - p_K)',
      substitution: `\\lambda_{ef} = ${n(lambda)}\\,(1 - ${n(pK)})`,
      result: `\\lambda_{ef} = ${n(lambdaEff)}`,
    },
    {
      title: 'Clientes promedio en la cola',
      explanation: 'En promedio hay λ_ef/μ clientes en servicio.',
      formula: 'L_q = L - \\frac{\\lambda_{ef}}{\\mu}',
      substitution: `L_q = ${n(L)} - \\frac{${n(lambdaEff)}}{${n(mu)}}`,
      result: `L_q = ${n(Lq)}`,
    },
    ...littleSteps(value, '\\lambda_{ef}'),
  );

  return {
    ok: true,
    value,
    summary: queueSummary(value, [
      { label: 'Tasa efectiva de llegadas', value: `\\lambda_{ef} = ${n(lambdaEff, 6)}` },
      { label: 'Clientes perdidos', value: `p_{${K}} = ${n(pK, 6)}` },
    ]),
    ...probabilityTrace(steps, value, [
      {
        level: 'info',
        message: `El ${formatNumber(pK * 100, 4)} % de los clientes encuentra el sistema lleno y se va (${formatNumber(lambda * pK, 4)} por unidad de tiempo).`,
      },
    ]),
  };
}

export const mm1k: Calculator<MM1KInput, QueueValue, QueueErrorCode> = {
  meta: {
    id: 'cola-mm1k',
    title: 'Modelo M/M/1/K',
    summary: 'Un servidor con capacidad finita del sistema.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 17.6.2, Ejemplo 17.6-4 (p. 610 de la 7.ª ed. en español)',
      },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'kaufman-1996' },
    ],
  },
  inputSchema: mm1kInputSchema,
  // Taha, ejemplo 17.6-4: el lavado de autos con 4 cajones de estacionamiento → K = 4 + 1 = 5.
  example: { lambda: 4, mu: 6, capacity: 5 },
  solve: solveMM1K,
};
