/**
 * Proceso de nacimiento y muerte en estado estable (Taha, sec. 18.5, «modelo general de colas de
 * Poisson»; Hillier & Lieberman, sec. 17.5). En el estado n llegan clientes con tasa λₙ y se van
 * con tasa μₙ. Las ecuaciones de balance dan
 *
 *   p_n = C_n p₀,   C_n = (λ_{n−1} λ_{n−2} ⋯ λ₀) / (μ_n μ_{n−1} ⋯ μ₁),   p₀ = 1 / Σ_n C_n
 *
 * Las tasas se dan por tramos: cada fila vale desde su estado hasta el anterior a la siguiente
 * fila. Si no hay capacidad máxima, el último tramo continúa sin fin y sus términos forman una
 * serie geométrica de razón ρ = λ/μ, que converge solo si ρ < 1:
 *
 *   Σ_{n > n₀} C_n = C_{n₀} ρ/(1 − ρ),   Σ_{n > n₀} n C_n = C_{n₀} [n₀ ρ/(1 − ρ) + ρ/(1 − ρ)²]
 *
 * Medidas: L = Σ n p_n, λ̄ = Σ λ_n p_n (tasa promedio de llegadas que entran) y W = L/λ̄.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
} from '../types';

const MAX_STATES = 500;

const rate = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine((v) => Number.isFinite(v) && v >= 0, `${label} no puede ser negativa.`);

export const birthDeathInputSchema = z
  .object({
    segments: z
      .array(
        z.object({
          from: z
            .number({ error: 'Ingresa el estado desde el que vale la fila.' })
            .int('El estado debe ser un número entero.')
            .min(0, 'El estado no puede ser negativo.')
            .max(MAX_STATES, `El estado máximo es ${MAX_STATES}.`),
          lambda: rate('la tasa de nacimientos λ'),
          mu: rate('la tasa de muertes μ'),
        }),
      )
      .min(1, 'Agrega al menos un tramo de tasas.')
      .max(20, 'El máximo es 20 tramos.'),
    capacity: z
      .number({ error: 'La capacidad debe ser un número entero.' })
      .int('La capacidad debe ser un número entero.')
      .min(1, 'La capacidad debe ser al menos 1.')
      .max(MAX_STATES, `La capacidad máxima es ${MAX_STATES}.`)
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.segments[0]?.from !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['segments'],
        message: 'La primera fila debe empezar en el estado 0.',
      });
    }
    for (let i = 1; i < v.segments.length; i++) {
      if (v.segments[i]!.from <= v.segments[i - 1]!.from) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments'],
          message: 'Los estados de inicio de las filas deben ir en orden creciente.',
        });
        return;
      }
    }
    if (v.capacity !== undefined && v.segments.at(-1)!.from > v.capacity) {
      ctx.addIssue({
        code: 'custom',
        path: ['capacity'],
        message: 'La capacidad debe ser mayor o igual que el inicio del último tramo.',
      });
    }
  });

export type BirthDeathInput = z.infer<typeof birthDeathInputSchema>;

export interface BirthDeathValue {
  p0: number;
  /** p_n para los estados mostrados en la tabla. */
  probabilities: number[];
  L: number;
  /** Tasa promedio de llegadas que entran, λ̄ = Σ λₙ pₙ. */
  lambdaBar: number;
  W: number;
  /** `null` si la capacidad es finita. */
  tailRatio: number | null;
}

export type BirthDeathErrorCode = 'no-steady-state' | 'dead-state';

type Result = CalculatorResult<BirthDeathValue, BirthDeathErrorCode>;

const n = toLatexNumber;

export function solveBirthDeath({ segments, capacity }: BirthDeathInput): Result {
  const rateAt = (state: number) => {
    let segment = segments[0]!;
    for (const s of segments) if (s.from <= state) segment = s;
    return segment;
  };
  const lambdaAt = (state: number) =>
    capacity !== undefined && state >= capacity ? 0 : rateAt(state).lambda;
  const muAt = (state: number) => rateAt(state).mu;

  const last = segments.at(-1)!;
  const infinite = capacity === undefined;
  // Estados que se suman término a término; en el caso infinito, la cola geométrica empieza
  // después de n₀ = inicio del último tramo.
  const lastExplicit = infinite ? last.from : capacity;

  const steps: Step[] = [
    {
      title: 'Tasas de cada estado',
      explanation:
        'λₙ es la tasa de llegadas (nacimientos) con n en el sistema y μₙ la de salidas (muertes). Cada fila vale desde su estado hasta el anterior a la fila siguiente.',
      substitution: segments
        .map((s, i) => {
          const to = segments[i + 1]
            ? `${segments[i + 1]!.from - 1}`
            : infinite
              ? '\\infty'
              : `${capacity}`;
          return `n = ${s.from}, \\ldots, ${to}:\\ \\lambda_n = ${n(s.lambda)},\\ \\mu_n = ${n(s.mu)}`;
        })
        .join(' \\\\ '),
      result: infinite ? undefined : `\\lambda_{${capacity}} = 0 \\ \\text{(sistema lleno)}`,
    },
  ];

  // C_n término a término.
  const C = [1];
  for (let state = 1; state <= lastExplicit; state++) {
    const mu = muAt(state);
    if (mu === 0) {
      return {
        ok: false,
        error: {
          code: 'dead-state',
          message: `μ_${state} = 0: del estado ${state} no se puede bajar, así que no hay un estado estable con p₀ > 0. Revisa las tasas de muerte.`,
        },
        ...emptyTrace(),
        steps,
      };
    }
    C.push((C[state - 1]! * lambdaAt(state - 1)) / mu);
  }

  let tailRatio: number | null = null;
  let tailMass = 0;
  let tailMoment = 0;
  let tailLambda = 0;
  if (infinite) {
    if (last.mu === 0) {
      return {
        ok: false,
        error: {
          code: 'dead-state',
          message: 'En el último tramo μ = 0: los clientes nunca salen y no hay estado estable.',
        },
        ...emptyTrace(),
        steps,
      };
    }
    tailRatio = last.lambda / last.mu;
    if (tailRatio >= 1) {
      steps.push({
        title: 'Convergencia de la serie',
        explanation: `A partir de n = ${last.from} los términos crecen o se mantienen con razón ρ = λ/μ = ${formatNumber(tailRatio, 6)} ≥ 1: la suma no converge.`,
        formula: '\\rho = \\frac{\\lambda}{\\mu} < 1',
        result: `\\rho = ${n(tailRatio)} \\ge 1`,
      });
      return {
        ok: false,
        error: {
          code: 'no-steady-state',
          message: `En el último tramo λ/μ = ${formatNumber(tailRatio, 6)} ≥ 1: el sistema crece sin límite y no alcanza el estado estable.`,
        },
        ...emptyTrace(),
        steps,
      };
    }
    const cn0 = C[last.from]!;
    const rho = tailRatio;
    tailMass = (cn0 * rho) / (1 - rho);
    tailMoment = cn0 * ((last.from * rho) / (1 - rho) + rho / (1 - rho) ** 2);
    tailLambda = last.lambda * tailMass;
  }

  const explicitSum = C.reduce((a, b) => a + b, 0);
  const total = explicitSum + tailMass;
  const p0 = 1 / total;

  const ratioTerms = C.slice(1, 5).map((c, i) => {
    const state = i + 1;
    return `C_{${state}} = ${n(c, 6)}`;
  });
  steps.push({
    title: 'Coeficientes C_n',
    explanation:
      'De las ecuaciones de balance λ_{n−1} p_{n−1} = μ_n p_n se obtiene cada p_n como un múltiplo de p₀. Cada coeficiente es el anterior por λ_{n−1}/μ_n.',
    formula:
      'C_0 = 1, \\qquad C_n = C_{n-1}\\,\\frac{\\lambda_{n-1}}{\\mu_n}, \\qquad p_n = C_n\\,p_0',
    substitution: `C_1 = \\frac{${n(lambdaAt(0))}}{${n(muAt(1))}}${ratioTerms.length > 1 ? `, \\quad ${ratioTerms.slice(1).join(',\\ ')}` : ''}${C.length > 5 ? ', \\ldots' : ''}`,
    result: ratioTerms.join(',\\ '),
  });

  if (infinite) {
    steps.push({
      title: `Cola geométrica a partir de n = ${last.from}`,
      explanation: `Desde el último tramo, cada coeficiente es el anterior por ρ = λ/μ = ${formatNumber(tailRatio!, 6)} < 1, así que la suma infinita es una serie geométrica.`,
      formula: '\\sum_{n > n_0} C_n = C_{n_0}\\,\\frac{\\rho}{1 - \\rho}',
      substitution: `\\sum_{n > ${last.from}} C_n = ${n(C[last.from]!, 8)}\\,\\frac{${n(tailRatio!)}}{1 - ${n(tailRatio!)}}`,
      result: `\\sum_{n > ${last.from}} C_n = ${n(tailMass, 8)}`,
    });
  }

  steps.push({
    title: 'Probabilidad de que el sistema esté vacío',
    explanation:
      'Las probabilidades suman 1, así que p₀ es el recíproco de la suma de los coeficientes.',
    formula: 'p_0 = \\left[\\sum_{n} C_n\\right]^{-1}',
    substitution: infinite
      ? `p_0 = \\left[${n(explicitSum, 8)} + ${n(tailMass, 8)}\\right]^{-1}`
      : `p_0 = \\left[${n(explicitSum, 8)}\\right]^{-1}`,
    result: `p_0 = ${n(p0)}`,
  });

  // Estados que se muestran: los explícitos y, en el caso infinito, la cola hasta cubrir 0.999.
  const probabilities = C.map((c) => c * p0);
  if (infinite) {
    let cumulative = probabilities.reduce((a, b) => a + b, 0);
    let state = last.from;
    while (cumulative < 0.999 && probabilities.length < 1000) {
      state++;
      const p = probabilities[state - 1]! * tailRatio!;
      probabilities.push(p);
      cumulative += p;
    }
  }

  let L = 0;
  let lambdaBar = 0;
  for (let state = 0; state <= lastExplicit; state++) {
    L += state * C[state]! * p0;
    lambdaBar += lambdaAt(state) * C[state]! * p0;
  }
  L += tailMoment * p0;
  lambdaBar += tailLambda * p0;
  const W = L / lambdaBar;

  steps.push(
    {
      title: 'Número promedio en el sistema',
      formula: 'L = \\sum_n n\\,p_n',
      result: `L = ${n(L)}`,
    },
    {
      title: 'Tasa promedio de llegadas y tiempo en el sistema',
      explanation:
        'Como λₙ depende del estado, la ley de Little usa la tasa promedio de llegadas que efectivamente entran.',
      formula: '\\bar\\lambda = \\sum_n \\lambda_n\\,p_n, \\qquad W = \\frac{L}{\\bar\\lambda}',
      result: `\\bar\\lambda = ${n(lambdaBar)}, \\qquad W = ${n(W)}`,
    },
  );

  let cumulative = 0;
  const rows = probabilities.map((p, state) => {
    cumulative += p;
    return {
      n: state,
      lambda: lambdaAt(state),
      mu: state === 0 ? null : muAt(state),
      C: p / p0,
      p,
      cumulative: Math.min(1, cumulative),
    };
  });
  const series: Series[] = [
    {
      id: 'pn',
      title: 'Probabilidades de estado estable',
      xLabel: 'n',
      yLabel: 'pₙ',
      kind: 'bar',
      points: probabilities.map((p, state) => ({ x: state, y: p })),
    },
  ];

  return {
    ok: true,
    value: { p0, probabilities, L, lambdaBar, W, tailRatio },
    summary: [
      { label: 'Sistema vacío', value: `p_0 = ${n(p0, 6)}`, emphasis: true },
      { label: 'Número promedio', value: `L = ${n(L, 6)}` },
      { label: 'Tasa promedio de llegadas', value: `\\bar\\lambda = ${n(lambdaBar, 6)}` },
      { label: 'Tiempo promedio en el sistema', value: `W = ${n(W, 6)}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'probabilidades',
        title: 'Probabilidades de estado estable',
        columns: [
          { key: 'n', header: 'n' },
          { key: 'lambda', header: '\\lambda_n' },
          { key: 'mu', header: '\\mu_n' },
          { key: 'C', header: 'C_n' },
          { key: 'p', header: 'p_n' },
          { key: 'cumulative', header: 'P(N \\le n)' },
        ],
        rows,
      },
    ],
    series,
    notices:
      infinite && cumulative < 1 - 1e-9
        ? [
            {
              level: 'info',
              message: `La tabla muestra n = 0 a ${probabilities.length - 1}; la probabilidad de tener más es ${formatNumber(1 - cumulative, 4)}.`,
            },
          ]
        : [],
  };
}

export const birthDeath: Calculator<BirthDeathInput, BirthDeathValue, BirthDeathErrorCode> = {
  meta: {
    id: 'nacimiento-y-muerte',
    title: 'Proceso de nacimiento y muerte',
    summary: 'Probabilidades de estado estable con tasas λₙ y μₙ que dependen del estado.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 18.5, modelo general de colas de Poisson, Ejemplo 18.5-1 (10.ª ed.)',
      },
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 17.5, proceso de nacimiento y muerte (7.ª ed.)',
      },
      { sourceId: 'wong-2007' },
    ],
  },
  inputSchema: birthDeathInputSchema,
  // Taha, ejemplo 18.5-1: B&K Groceries, 10 clientes/h y cajas que atienden 5/h; 1 caja abierta
  // con 1 a 3 clientes, 2 con 4 a 6 y 3 con más de 6.
  example: {
    segments: [
      { from: 0, lambda: 10, mu: 5 },
      { from: 4, lambda: 10, mu: 10 },
      { from: 7, lambda: 10, mu: 15 },
    ],
  },
  solve: solveBirthDeath,
};
