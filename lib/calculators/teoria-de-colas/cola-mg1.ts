/**
 * Modelo M/G/1 — llegadas de Poisson con tasa λ y un servidor con tiempo de servicio de
 * distribución cualquiera, de media 1/μ y desviación estándar σ. Fórmula de Pollaczek-Khintchine:
 *
 *   ρ = λ/μ < 1,   L_q = (λ²σ² + ρ²) / (2(1 − ρ)),   L = L_q + ρ,   W_q = L_q/λ,   W = W_q + 1/μ
 *   p₀ = 1 − ρ,   P_w = ρ
 *
 * Con σ = 0 (servicio constante) es el modelo M/D/1; con σ = 1/μ (exponencial), el M/M/1.
 *
 * Taha, sec. 18.7 (ejemplo 18.7-1, 10.ª ed.); Anderson, Sweeney y Williams, sec. 11.7 (ejemplo
 * de Hartlage's Seafood Supply, 13.ª ed.).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type Step } from '../types';
import {
  littleSteps,
  queueRatesShape,
  queueSummary,
  unstable,
  type QueueErrorCode,
  type QueueResult,
  type QueueValue,
} from './queueing';

export const mg1InputSchema = z.object({
  ...queueRatesShape,
  sigma: z
    .number({ error: 'Ingresa la desviación estándar del tiempo de servicio σ.' })
    .refine(Number.isFinite, 'σ debe ser un número finito.')
    .refine((v) => v >= 0, 'σ no puede ser negativa.'),
});

export type MG1Input = z.infer<typeof mg1InputSchema>;

const n = toLatexNumber;

export function solveMG1({ lambda, mu, sigma }: MG1Input): QueueResult {
  const rho = lambda / mu;
  const steps: Step[] = [
    {
      title: 'Factor de utilización',
      explanation:
        'Fracción del tiempo que el servidor está ocupado: la tasa de llegadas por el tiempo promedio de servicio 1/μ. Debe ser menor que 1.',
      formula: '\\rho = \\frac{\\lambda}{\\mu} = \\lambda\\,E[t]',
      substitution: `\\rho = \\frac{${n(lambda)}}{${n(mu)}}`,
      result: `\\rho = ${n(rho)}`,
    },
  ];
  if (rho >= 1) return unstable(steps, rho);

  const p0 = 1 - rho;
  const Lq = (lambda ** 2 * sigma ** 2 + rho ** 2) / (2 * (1 - rho));
  const L = Lq + rho;
  const value: QueueValue = {
    rho,
    p0,
    L,
    Lq,
    W: L / lambda,
    Wq: Lq / lambda,
    lambdaEff: lambda,
    probabilities: [],
  };

  steps.push(
    {
      title: 'Probabilidad de que el sistema esté vacío',
      formula: 'p_0 = 1 - \\rho',
      substitution: `p_0 = 1 - ${n(rho)}`,
      result: `p_0 = ${n(p0)}`,
    },
    {
      title: 'Clientes promedio en la cola (Pollaczek-Khintchine)',
      explanation:
        'La variabilidad del servicio entra por σ²: con el mismo μ, un servicio más irregular alarga la cola.',
      formula: 'L_q = \\frac{\\lambda^2\\sigma^2 + \\rho^2}{2\\,(1 - \\rho)}',
      substitution: `L_q = \\frac{(${n(lambda)})^2(${n(sigma)})^2 + (${n(rho)})^2}{2\\,(1 - ${n(rho)})}`,
      result: `L_q = ${n(Lq)}`,
    },
    {
      title: 'Clientes promedio en el sistema',
      formula: 'L = L_q + \\rho',
      substitution: `L = ${n(Lq)} + ${n(rho)}`,
      result: `L = ${n(L)}`,
    },
    ...littleSteps(value, '\\lambda'),
    {
      title: 'Probabilidad de que un cliente espere',
      explanation: 'Un cliente espera si el servidor está ocupado cuando llega.',
      formula: 'P_w = \\rho',
      result: `P_w = ${n(rho)}`,
    },
  );

  const notices: QueueResult['notices'] = [
    {
      level: 'info',
      message: 'El modelo M/G/1 no da una fórmula sencilla para pₙ; solo las medidas promedio.',
    },
  ];
  if (sigma === 0) {
    notices.push({
      level: 'info',
      message: 'Con σ = 0 el tiempo de servicio es constante: es el modelo M/D/1.',
    });
  } else if (Math.abs(sigma - 1 / mu) < 1e-12 * Math.max(1, sigma)) {
    notices.push({
      level: 'info',
      message:
        'Con σ = 1/μ el servicio tiene la variabilidad de una exponencial: coincide con M/M/1.',
    });
  }

  return {
    ok: true,
    value,
    summary: queueSummary(value, [
      { label: 'Probabilidad de esperar', value: `P_w = ${n(rho, 6)}` },
    ]),
    ...emptyTrace(),
    steps,
    notices: [
      ...notices,
      {
        level: 'info',
        message: `En promedio un cliente espera ${formatNumber(value.Wq, 4)} unidades de tiempo antes de ser atendido.`,
      },
    ],
  };
}

export const mg1: Calculator<MG1Input, QueueValue, QueueErrorCode> = {
  meta: {
    id: 'cola-mg1',
    title: 'Modelo M/G/1',
    summary: 'Un servidor con tiempo de servicio de distribución general (Pollaczek-Khintchine).',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 18.7, Ejemplo 18.7-1 (10.ª ed.)' },
      {
        sourceId: 'anderson-1993',
        locator: 'Sec. 11.7, ejemplo de Hartlage’s Seafood Supply (13.ª ed.)',
      },
      { sourceId: 'hillier-lieberman-2002', locator: 'Sec. 17.7, modelo M/G/1' },
      { sourceId: 'winston-1994', locator: 'Sec. 20.8 (4.ª ed.)' },
    ],
  },
  inputSchema: mg1InputSchema,
  // Anderson, Hartlage's: λ = 21 clientes/h = 0.35/min, servicio de 2 min (μ = 0.5/min) con
  // σ = 1.2 min.
  example: { lambda: 0.35, mu: 0.5, sigma: 1.2 },
  solve: solveMG1,
};
