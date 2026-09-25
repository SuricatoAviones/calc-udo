/**
 * Modelo M/M/s — (M/M/c):(DG/∞/∞) en la notación de Taha: s servidores en paralelo idénticos,
 * cola única, capacidad y población infinitas. Con r = λ/μ y ρ = r/s < 1:
 *
 *   p₀ = [ Σ_{n=0}^{s−1} rⁿ/n! + r^s / (s!(1 − ρ)) ]⁻¹
 *   p_n = rⁿ/n! · p₀            si n < s
 *   p_n = rⁿ/(s! s^{n−s}) · p₀  si n ≥ s
 *   L_q = r^{s+1} / ((s − 1)! (s − r)²) · p₀,   L = L_q + r,   W_q = L_q/λ,   W = W_q + 1/μ
 *
 * Taha, sec. 17.6.3 (ejemplo 17.6-5).
 */
import { z } from 'zod';
import { toLatexNumber } from '@/lib/math/format';
import type { Calculator, Step } from '../types';
import {
  probabilitiesUntilCovered,
  probabilityTrace,
  queueRatesShape,
  queueSummary,
  unstable,
  type QueueErrorCode,
  type QueueResult,
  type QueueValue,
} from './queueing';

export const mmsInputSchema = z.object({
  ...queueRatesShape,
  servers: z
    .number({ error: 'Ingresa el número de servidores.' })
    .int('El número de servidores debe ser entero.')
    .min(1, 'Debe haber al menos 1 servidor.')
    .max(100, 'El máximo permitido es 100 servidores.'),
});
export type MMSInput = z.infer<typeof mmsInputSchema>;

const n = toLatexNumber;

function factorial(k: number): number {
  let result = 1;
  for (let i = 2; i <= k; i++) result *= i;
  return result;
}

export function solveMMS({ lambda, mu, servers: s }: MMSInput): QueueResult {
  const r = lambda / mu;
  const rho = r / s;
  const steps: Step[] = [
    {
      title: 'Carga ofrecida y utilización',
      explanation:
        'r es el número promedio de servidores que haría falta tener ocupados; ρ es la fracción de tiempo que cada servidor está ocupado. Se necesita ρ < 1.',
      formula: 'r = \\frac{\\lambda}{\\mu}, \\qquad \\rho = \\frac{r}{s}',
      substitution: `r = \\frac{${n(lambda)}}{${n(mu)}}, \\qquad \\rho = \\frac{${n(r)}}{${s}}`,
      result: `r = ${n(r)}, \\qquad \\rho = ${n(rho)}`,
    },
  ];
  if (rho >= 1) return unstable(steps, rho);

  const terms = Array.from({ length: s }, (_, k) => r ** k / factorial(k));
  const sum = terms.reduce((acc, t) => acc + t, 0);
  const tail = r ** s / (factorial(s) * (1 - rho));
  const p0 = 1 / (sum + tail);
  const Lq = (r ** (s + 1) / (factorial(s - 1) * (s - r) ** 2)) * p0;
  const L = Lq + r;
  const Wq = Lq / lambda;
  const value: QueueValue = {
    rho,
    p0,
    L,
    Lq,
    W: Wq + 1 / mu,
    Wq,
    lambdaEff: lambda,
    probabilities: probabilitiesUntilCovered((k) =>
      k < s ? (r ** k / factorial(k)) * p0 : (r ** k / (factorial(s) * s ** (k - s))) * p0,
    ),
  };

  steps.push(
    {
      title: 'Probabilidad de que el sistema esté vacío',
      formula:
        'p_0 = \\left[\\sum_{n=0}^{s-1} \\frac{r^n}{n!} + \\frac{r^s}{s!\\,(1 - \\rho)}\\right]^{-1}',
      substitution: `p_0 = \\left[${terms.map((t) => n(t)).join(' + ')} + \\frac{(${n(r)})^{${s}}}{${s}!\\,(1 - ${n(rho)})}\\right]^{-1} = \\left[${n(sum)} + ${n(tail)}\\right]^{-1}`,
      result: `p_0 = ${n(p0)}`,
    },
    {
      title: 'Clientes promedio en la cola',
      formula: 'L_q = \\frac{r^{s+1}}{(s-1)!\\,(s - r)^2}\\,p_0',
      substitution: `L_q = \\frac{(${n(r)})^{${s + 1}}}{${s - 1}!\\,(${s} - ${n(r)})^2}\\,(${n(p0)})`,
      result: `L_q = ${n(Lq)}`,
    },
    {
      title: 'Clientes promedio en el sistema',
      explanation: 'A los que esperan se suman, en promedio, r clientes en servicio.',
      formula: 'L = L_q + r',
      substitution: `L = ${n(Lq)} + ${n(r)}`,
      result: `L = ${n(L)}`,
    },
    {
      title: 'Tiempo promedio en la cola (ley de Little)',
      formula: 'W_q = \\frac{L_q}{\\lambda}',
      substitution: `W_q = \\frac{${n(Lq)}}{${n(lambda)}}`,
      result: `W_q = ${n(Wq)}`,
    },
    {
      title: 'Tiempo promedio en el sistema',
      explanation: 'Al tiempo de espera se suma el tiempo promedio de servicio, 1/μ.',
      formula: 'W = W_q + \\frac{1}{\\mu}',
      substitution: `W = ${n(Wq)} + \\frac{1}{${n(mu)}}`,
      result: `W = ${n(value.W)}`,
    },
  );

  return {
    ok: true,
    value,
    summary: queueSummary(value, [{ label: 'Servidores', value: `s = ${s}` }]),
    ...probabilityTrace(steps, value),
  };
}

export const mms: Calculator<MMSInput, QueueValue, QueueErrorCode> = {
  meta: {
    id: 'cola-mms',
    title: 'Modelo M/M/s',
    summary: 'Varios servidores en paralelo con una cola común.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 17.6.3, Ejemplo 17.6-5 (pp. 613–614 de la 7.ª ed. en español)',
      },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'kaufman-1996' },
    ],
  },
  inputSchema: mmsInputSchema,
  // Taha, ejemplo 17.6-5: empresa de taxis consolidada, λ = 16 llamadas/h, μ = 5 viajes/h, 4 taxis.
  example: { lambda: 16, mu: 5, servers: 4 },
  solve: solveMMS,
};
