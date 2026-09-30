/**
 * Caminata aleatoria sobre los enteros (Hillier & Lieberman, sec. 16.7): en cada paso la
 * posición sube 1 con probabilidad p, baja 1 con probabilidad q o se queda con r = 1 − p − q.
 *
 * Sin barreras, tras n pasos desde i: E[X_n] = i + n(p − q), Var[X_n] = n[(p + q) − (p − q)²], y
 * con r = 0, P{X_n = k} = C(n, u) p^u q^{n−u}, u = (n + k − i)/2 (pasos hacia arriba).
 *
 * Con barreras absorbentes en 0 y N (la ruina del jugador), desde i:
 *   P{llegar a N} = (1 − (q/p)^i) / (1 − (q/p)^N)   si p ≠ q;   i/N   si p = q
 *   Pasos esperados hasta la absorción: [i/(q − p) − N/(q − p) · P{llegar a N}] / (p + q)   si p ≠ q;
 *                                       i(N − i)/(p + q)   si p = q
 * (el factor 1/(p + q) cuenta los pasos en que la posición no cambia).
 *
 * La distribución tras n pasos se calcula paso a paso: P{X_{t+1} = k} = p·P{X_t = k − 1} +
 * q·P{X_t = k + 1} + r·P{X_t = k}, con las barreras reteniendo su probabilidad.
 */
import { z } from 'zod';
import { formatNumber, fractionToLatex, parseFraction, toLatexNumber } from '@/lib/math/format';
import { lnGamma } from '@/lib/math/special';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
} from '../types';

export const walkBarriers = ['ninguna', 'absorbentes'] as const;

/** Probabilidad escrita como decimal o fracción («0.4», «1/3»). */
const probability = (label: string) =>
  z
    .string({ error: `Ingresa ${label}.` })
    .trim()
    .min(1, `Ingresa ${label}.`)
    .refine((text) => {
      const v = parseFraction(text);
      return Number.isFinite(v) && v >= 0 && v <= 1;
    }, `${label} debe ser un número o una fracción entre 0 y 1 (p. ej. 0.4 o 1/3).`);

const MAX_STEPS = 200;
const MAX_BARRIER = 200;

export const randomWalkInputSchema = z
  .object({
    p: probability('la probabilidad de subir p'),
    q: probability('la probabilidad de bajar q'),
    start: z
      .number({ error: 'Ingresa la posición inicial.' })
      .int('La posición inicial debe ser entera.')
      .min(-1000, 'La posición inicial es demasiado pequeña.')
      .max(1000, 'La posición inicial es demasiado grande.'),
    steps: z
      .number({ error: 'Ingresa el número de pasos n.' })
      .int('El número de pasos debe ser entero.')
      .min(0, 'El número de pasos no puede ser negativo.')
      .max(MAX_STEPS, `El máximo es ${MAX_STEPS} pasos.`),
    barriers: z.enum(walkBarriers, { error: 'Elige si hay barreras.' }),
    upper: z
      .number({ error: 'La barrera superior debe ser un número entero.' })
      .int('La barrera superior debe ser entera.')
      .min(1, 'La barrera superior debe ser al menos 1.')
      .max(MAX_BARRIER, `La barrera superior máxima es ${MAX_BARRIER}.`)
      .optional(),
  })
  .superRefine((v, ctx) => {
    const p = parseFraction(v.p);
    const q = parseFraction(v.q);
    if (!Number.isFinite(p) || !Number.isFinite(q)) return;
    if (p + q > 1 + 1e-12) {
      ctx.addIssue({ code: 'custom', path: ['q'], message: 'p + q no puede pasar de 1.' });
    }
    if (p + q === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['p'],
        message: 'Con p = q = 0 la posición nunca cambia.',
      });
    }
    if (v.barriers === 'absorbentes') {
      if (v.upper === undefined) {
        ctx.addIssue({ code: 'custom', path: ['upper'], message: 'Indica la barrera superior N.' });
      } else if (v.start < 0 || v.start > v.upper) {
        ctx.addIssue({
          code: 'custom',
          path: ['start'],
          message: 'Con barreras en 0 y N la posición inicial debe estar entre 0 y N.',
        });
      }
    }
  });

export type RandomWalkInput = z.infer<typeof randomWalkInputSchema>;

export interface RandomWalkValue {
  /** Posiciones y probabilidades tras n pasos (solo las de probabilidad positiva). */
  distribution: { position: number; probability: number }[];
  mean: number;
  variance: number;
  /** Solo con barreras absorbentes. */
  absorption: { top: number; bottom: number; expectedSteps: number } | null;
}

export type RandomWalkErrorCode = never;

type Result = CalculatorResult<RandomWalkValue, RandomWalkErrorCode>;

const n = toLatexNumber;

function binomialPmf(trials: number, k: number, p: number): number {
  if (k < 0 || k > trials) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === trials ? 1 : 0;
  return Math.exp(
    lnGamma(trials + 1) -
      lnGamma(k + 1) -
      lnGamma(trials - k + 1) +
      k * Math.log(p) +
      (trials - k) * Math.log(1 - p),
  );
}

export function solveRandomWalk(input: RandomWalkInput): Result {
  const p = parseFraction(input.p);
  const q = parseFraction(input.q);
  const { start, steps: count, barriers } = input;
  const r = Math.max(0, 1 - p - q);
  const absorbing = barriers === 'absorbentes';
  const N = input.upper ?? 0;
  const steps: Step[] = [
    {
      title: 'Probabilidades de un paso',
      explanation: absorbing
        ? `Cada paso sube 1, baja 1 o se queda. Las posiciones 0 y ${N} son absorbentes: al llegar a ellas el proceso se detiene.`
        : 'Cada paso sube 1, baja 1 o se queda, independientemente de los pasos anteriores.',
      formula: 'P\\{+1\\} = p, \\qquad P\\{-1\\} = q, \\qquad P\\{0\\} = r = 1 - p - q',
      result: `p = ${fractionToLatex(input.p)}, \\qquad q = ${fractionToLatex(input.q)}, \\qquad r = ${n(r)}`,
    },
  ];

  // Distribución tras n pasos por recursión.
  const low = absorbing ? 0 : start - count;
  const high = absorbing ? N : start + count;
  let dist = new Array<number>(high - low + 1).fill(0);
  dist[start - low] = 1;
  for (let t = 0; t < count; t++) {
    const next = new Array<number>(dist.length).fill(0);
    dist.forEach((mass, idx) => {
      if (mass === 0) return;
      const position = idx + low;
      if (absorbing && (position === 0 || position === N)) {
        next[idx]! += mass;
        return;
      }
      if (idx + 1 < next.length) next[idx + 1]! += mass * p;
      if (idx - 1 >= 0) next[idx - 1]! += mass * q;
      next[idx]! += mass * r;
    });
    dist = next;
  }
  const distribution = dist
    .map((probability, idx) => ({ position: idx + low, probability }))
    .filter((d) => d.probability > 1e-15);
  const mean = distribution.reduce((acc, d) => acc + d.position * d.probability, 0);
  const variance = distribution.reduce(
    (acc, d) => acc + (d.position - mean) ** 2 * d.probability,
    0,
  );

  steps.push({
    title: `Distribución de la posición tras ${count} pasos`,
    explanation: absorbing
      ? 'Se aplica la recursión paso a paso; la probabilidad que llega a una barrera se queda en ella.'
      : 'Se aplica la recursión paso a paso partiendo de toda la probabilidad en la posición inicial.',
    formula:
      'P\\{X_{t+1} = k\\} = p\\,P\\{X_t = k - 1\\} + q\\,P\\{X_t = k + 1\\} + r\\,P\\{X_t = k\\}',
    result: `P\\{X_0 = ${start}\\} = 1 \\ \\Rightarrow\\ E[X_{${count}}] = ${n(mean)}`,
  });

  if (!absorbing) {
    steps.push({
      title: 'Media y varianza de la posición',
      explanation:
        'La posición es la inicial más la suma de n pasos independientes, cada uno con media p − q y varianza (p + q) − (p − q)².',
      formula:
        'E[X_n] = i + n(p - q), \\qquad \\operatorname{Var}[X_n] = n\\left[(p + q) - (p - q)^2\\right]',
      substitution: `E[X_{${count}}] = ${start} + ${count}(${n(p)} - ${n(q)}), \\qquad \\operatorname{Var}[X_{${count}}] = ${count}\\left[${n(p + q)} - (${n(p - q)})^2\\right]`,
      result: `E[X_{${count}}] = ${n(start + count * (p - q))}, \\qquad \\operatorname{Var}[X_{${count}}] = ${n(count * (p + q - (p - q) ** 2))}`,
    });
    if (r === 0 && count > 0) {
      const example = distribution.reduce((a, b) => (b.probability > a.probability ? b : a));
      const up = (count + example.position - start) / 2;
      steps.push({
        title: 'Fórmula cerrada (sin quedarse en el sitio)',
        explanation: `Llegar a k exige u = (n + k − i)/2 pasos hacia arriba y n − u hacia abajo, en cualquier orden. Por ejemplo, la posición más probable, k = ${example.position}:`,
        formula:
          'P\\{X_n = k\\} = \\binom{n}{u} p^{u} q^{\\,n-u}, \\qquad u = \\frac{n + k - i}{2}',
        substitution: `P\\{X_{${count}} = ${example.position}\\} = \\binom{${count}}{${up}} (${n(p)})^{${up}} (${n(q)})^{${count - up}}`,
        result: `P\\{X_{${count}} = ${example.position}\\} = ${n(binomialPmf(count, up, p))}`,
      });
    }
  }

  let absorption: RandomWalkValue['absorption'] = null;
  if (absorbing) {
    const moving = p + q;
    let top: number;
    let expectedSteps: number;
    if (p === 0) {
      top = start === N ? 1 : 0;
      expectedSteps = start === N ? 0 : start / q;
    } else if (q === 0) {
      top = start === 0 ? 0 : 1;
      expectedSteps = start === 0 ? 0 : (N - start) / p;
    } else if (Math.abs(p - q) < 1e-12) {
      top = start / N;
      expectedSteps = (start * (N - start)) / moving;
    } else {
      const ratio = q / p;
      top = (1 - ratio ** start) / (1 - ratio ** N);
      expectedSteps = (start / (q - p) - (N / (q - p)) * top) / moving;
    }
    absorption = { top, bottom: 1 - top, expectedSteps };
    const equal = Math.abs(p - q) < 1e-12;
    steps.push(
      {
        title: `Probabilidad de llegar a ${N} antes que a 0 (ruina del jugador)`,
        explanation:
          'Se obtiene del sistema f_i = p f_{i+1} + q f_{i−1} + r f_i con f_0 = 0 y f_N = 1 (análisis del primer paso). Quedarse en el sitio no cambia a dónde se llega.',
        formula: equal
          ? 'f_i = \\frac{i}{N} \\quad (p = q)'
          : 'f_i = \\frac{1 - (q/p)^i}{1 - (q/p)^N} \\quad (p \\ne q)',
        substitution:
          p === 0 || q === 0
            ? undefined
            : equal
              ? `f_{${start}} = \\frac{${start}}{${N}}`
              : `f_{${start}} = \\frac{1 - (${n(q / p)})^{${start}}}{1 - (${n(q / p)})^{${N}}}`,
        result: `P\\{\\text{llegar a } ${N}\\} = ${n(top)}, \\qquad P\\{\\text{llegar a } 0\\} = ${n(1 - top)}`,
      },
      {
        title: 'Pasos esperados hasta la absorción',
        explanation: 'Resuelve D_i = 1 + p D_{i+1} + q D_{i−1} + r D_i con D_0 = D_N = 0.',
        formula: equal
          ? 'D_i = \\frac{i\\,(N - i)}{p + q}'
          : 'D_i = \\frac{1}{p + q}\\left[\\frac{i}{q - p} - \\frac{N}{q - p}\\,f_i\\right]',
        result: `D_{${start}} = ${n(expectedSteps)}`,
      },
    );
  }

  const series: Series[] = [
    {
      id: 'posicion',
      title: `Distribución de la posición tras ${count} pasos`,
      xLabel: 'Posición k',
      yLabel: 'P{Xₙ = k}',
      kind: 'bar',
      points: distribution.map((d) => ({ x: d.position, y: d.probability })),
    },
  ];

  const summary = [
    { label: 'Posición esperada', value: `E[X_{${count}}] = ${n(mean, 6)}`, emphasis: !absorbing },
    { label: 'Varianza', value: `\\operatorname{Var}[X_{${count}}] = ${n(variance, 6)}` },
  ];
  if (absorption) {
    summary.unshift(
      {
        label: `Llegar a ${N} antes que a 0`,
        value: `f_{${start}} = ${n(absorption.top, 6)}`,
        emphasis: true,
      },
      { label: 'Llegar a 0 (ruina)', value: `1 - f_{${start}} = ${n(absorption.bottom, 6)}` },
      { label: 'Pasos esperados', value: `D_{${start}} = ${n(absorption.expectedSteps, 6)}` },
    );
  }

  return {
    ok: true,
    value: { distribution, mean, variance, absorption },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'distribucion',
        title: `Posición tras ${count} pasos`,
        columns: [
          { key: 'position', header: 'k' },
          { key: 'probability', header: `P\\{X_{${count}} = k\\}` },
        ],
        rows: distribution.map((d) => ({ ...d })),
      },
    ],
    series,
    notices: absorbing
      ? [
          {
            level: 'info',
            message: `Tras ${count} pasos, la probabilidad de haber sido absorbido ya es ${formatNumber(
              (distribution.find((d) => d.position === 0)?.probability ?? 0) +
                (distribution.find((d) => d.position === N)?.probability ?? 0),
              4,
            )}.`,
          },
        ]
      : [],
  };
}

export const randomWalk: Calculator<RandomWalkInput, RandomWalkValue, RandomWalkErrorCode> = {
  meta: {
    id: 'caminata-aleatoria',
    title: 'Caminata aleatoria',
    summary: 'Probabilidades de posición tras n pasos y ruina del jugador.',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 16.7, caminatas aleatorias y el ejemplo de los dos jugadores (7.ª ed.)',
      },
      { sourceId: 'wong-2007' },
    ],
  },
  inputSchema: randomWalkInputSchema,
  // Hillier, sec. 16.7: dos jugadores con $2 cada uno apuestan $1 hasta que uno se arruina; A
  // gana cada apuesta con probabilidad 1/3.
  example: { p: '1/3', q: '2/3', start: 2, steps: 10, barriers: 'absorbentes', upper: 4 },
  solve: solveRandomWalk,
};
