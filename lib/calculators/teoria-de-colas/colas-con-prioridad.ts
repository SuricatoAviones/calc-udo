/**
 * Colas con prioridad (Hillier & Lieberman, sec. 17.8): N clases de clientes con llegadas de
 * Poisson de tasas λ₁, …, λ_N (la clase 1 es la de mayor prioridad), s servidores exponenciales
 * con la misma tasa μ para todas las clases y FIFO dentro de cada clase. Sea λ = Σλᵢ, r = λ/μ.
 *
 * Prioridades sin interrupción (no apropiativas):
 *
 *   A = s! (sμ − λ)/r^s · Σ_{j=0}^{s−1} r^j/j! + sμ,   B₀ = 1,   B_k = 1 − Σ_{i≤k} λᵢ/(sμ)
 *   W_k = 1 / (A B_{k−1} B_k) + 1/μ
 *
 * Con interrupción (apropiativas), un servidor:  W_k = (1/μ) / (B_{k−1} B_k).
 * Con interrupción y s > 1 se usa el procedimiento del libro: las clases 1 … k no se ven
 * afectadas por las demás, así que su tiempo promedio en el sistema es el W de un M/M/s con
 * Λ_k = λ₁ + … + λ_k, y
 *
 *   Λ_k W̄_k = Σ_{i≤k} λᵢ Wᵢ   ⟹   W_k = (Λ_k W̄_k − Λ_{k−1} W̄_{k−1}) / λ_k
 *
 * En todos los casos L_k = λ_k W_k (ley de Little por clase) y W_{q,k} = W_k − 1/μ.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Step,
} from '../types';
import { factorial, mmsMeasures, rateField } from './queueing';

const MAX_CLASSES = 10;

function parseRates(text: string): number[] | string {
  const { values, invalid } = parseDataList(text);
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  if (values.length < 1) return 'Ingresa la tasa de llegadas de al menos una clase.';
  if (values.length > MAX_CLASSES) return `El máximo es ${MAX_CLASSES} clases.`;
  if (values.some((v) => !(v > 0) || !Number.isFinite(v))) {
    return 'Las tasas de llegadas deben ser mayores que 0.';
  }
  return values;
}

export const priorityDisciplines = ['no-apropiativa', 'apropiativa'] as const;

export const priorityQueueInputSchema = z.object({
  rates: z.string().superRefine((text, ctx) => {
    const parsed = parseRates(text);
    if (typeof parsed === 'string') ctx.addIssue({ code: 'custom', message: parsed });
  }),
  mu: rateField('la tasa de servicio μ'),
  servers: z
    .number({ error: 'Ingresa el número de servidores s.' })
    .int('El número de servidores debe ser entero.')
    .min(1, 'Debe haber al menos 1 servidor.')
    .max(50, 'El máximo es 50 servidores.'),
  discipline: z.enum(priorityDisciplines, { error: 'Elige el tipo de prioridad.' }),
});

export type PriorityQueueInput = z.infer<typeof priorityQueueInputSchema>;

export interface PriorityClassResult {
  priority: number;
  lambda: number;
  /** `null` si la clase no alcanza el estado estable. */
  W: number | null;
  Wq: number | null;
  L: number | null;
  Lq: number | null;
}

export interface PriorityQueueValue {
  classes: PriorityClassResult[];
  /** Solo en el modelo sin interrupción. */
  A: number | null;
  B: number[];
}

export type PriorityQueueErrorCode = 'invalid-data' | 'unstable';

type Result = CalculatorResult<PriorityQueueValue, PriorityQueueErrorCode>;

const n = toLatexNumber;

export function solvePriorityQueue(input: PriorityQueueInput): Result {
  const parsed = parseRates(input.rates);
  if (typeof parsed === 'string') {
    return { ok: false, error: { code: 'invalid-data', message: parsed }, ...emptyTrace() };
  }
  const rates = parsed;
  const { mu, servers: s, discipline } = input;
  const capacity = s * mu;
  const lambda = rates.reduce((a, b) => a + b, 0);
  const cumulative = rates.map((_, k) => rates.slice(0, k + 1).reduce((a, b) => a + b, 0));
  const B = [1, ...cumulative.map((c) => 1 - c / capacity)];

  const steps: Step[] = [
    {
      title: 'Tasa total de llegadas y capacidad',
      explanation:
        'Si no se distingue la clase, las llegadas forman un proceso de Poisson con la suma de las tasas y el sistema es un M/M/s.',
      formula: '\\lambda = \\sum_{i=1}^{N} \\lambda_i, \\qquad s\\mu',
      substitution: `\\lambda = ${rates.map((r) => n(r)).join(' + ')}, \\qquad s\\mu = ${s}(${n(mu)})`,
      result: `\\lambda = ${n(lambda)}, \\qquad s\\mu = ${n(capacity)}`,
    },
    {
      title: 'Coeficientes B_k',
      explanation:
        'B_k es la fracción de la capacidad que no usan las clases 1 a k. La clase k alcanza el estado estable solo si B_k > 0.',
      formula: 'B_0 = 1, \\qquad B_k = 1 - \\frac{\\sum_{i=1}^{k} \\lambda_i}{s\\mu}',
      substitution: B.slice(1)
        .map((b, k) => `B_{${k + 1}} = 1 - \\frac{${n(cumulative[k]!)}}{${n(capacity)}}`)
        .join(',\\ '),
      result: B.slice(1)
        .map((b, k) => `B_{${k + 1}} = ${n(b, 6)}`)
        .join(',\\ '),
    },
  ];

  if (B[1]! <= 0) {
    return {
      ok: false,
      error: {
        code: 'unstable',
        message: `Solo la clase 1 ya llega a ${formatNumber(rates[0]!)} por unidad de tiempo y los servidores atienden ${formatNumber(capacity)}: ninguna clase alcanza el estado estable.`,
      },
      ...emptyTrace(),
      steps,
    };
  }

  let A: number | null = null;
  const W: (number | null)[] = [];
  if (discipline === 'no-apropiativa') {
    if (lambda >= capacity) {
      return {
        ok: false,
        error: {
          code: 'unstable',
          message: `λ = ${formatNumber(lambda)} ≥ sμ = ${formatNumber(capacity)}: sin interrupciones, la cola total crece sin límite y el modelo no tiene estado estable.`,
        },
        ...emptyTrace(),
        steps,
      };
    }
    const r = lambda / mu;
    let sum = 0;
    for (let j = 0; j < s; j++) sum += r ** j / factorial(j);
    A = ((factorial(s) * (capacity - lambda)) / r ** s) * sum + capacity;
    steps.push({
      title: 'Constante A',
      explanation: s === 1 ? 'Con un servidor, A se reduce a μ²/λ.' : undefined,
      formula:
        'A = \\frac{s!\\,(s\\mu - \\lambda)}{r^s} \\sum_{j=0}^{s-1} \\frac{r^j}{j!} + s\\mu, \\qquad r = \\frac{\\lambda}{\\mu}',
      substitution: `A = \\frac{${s}!\\,(${n(capacity)} - ${n(lambda)})}{(${n(r)})^{${s}}}\\,(${n(sum, 8)}) + ${n(capacity)}`,
      result: `A = ${n(A)}`,
    });
    const classSteps: Step[] = rates.map((_, k) => {
      const Wk = 1 / (A! * B[k]! * B[k + 1]!) + 1 / mu;
      W.push(Wk);
      return {
        title: `Clase ${k + 1}`,
        formula: `W_{${k + 1}} = \\frac{1}{A\\,B_{${k}}\\,B_{${k + 1}}} + \\frac{1}{\\mu}`,
        substitution: `W_{${k + 1}} = \\frac{1}{${n(A!)}\\,(${n(B[k]!, 6)})(${n(B[k + 1]!, 6)})} + \\frac{1}{${n(mu)}}`,
        result: `W_{${k + 1}} = ${n(Wk)}`,
      };
    });
    steps.push({
      title: 'Tiempo promedio en el sistema de cada clase',
      explanation: 'Un cliente en servicio no se interrumpe aunque llegue otro de mayor prioridad.',
      children: classSteps,
    });
  } else if (s === 1) {
    const classSteps: Step[] = rates.map((_, k) => {
      if (B[k + 1]! <= 0) {
        W.push(null);
        return {
          title: `Clase ${k + 1}`,
          explanation: `B_${k + 1} ≤ 0: las clases 1 a ${k + 1} ocupan toda la capacidad y esta clase no alcanza el estado estable.`,
        };
      }
      const Wk = 1 / mu / (B[k]! * B[k + 1]!);
      W.push(Wk);
      return {
        title: `Clase ${k + 1}`,
        formula: `W_{${k + 1}} = \\frac{1/\\mu}{B_{${k}}\\,B_{${k + 1}}}`,
        substitution: `W_{${k + 1}} = \\frac{1/${n(mu)}}{(${n(B[k]!, 6)})(${n(B[k + 1]!, 6)})}`,
        result: `W_{${k + 1}} = ${n(Wk)}`,
      };
    });
    steps.push({
      title: 'Tiempo promedio en el sistema de cada clase',
      explanation:
        'Con interrupción, un cliente de menor prioridad en servicio vuelve a la cola cuando llega uno de mayor prioridad. W_k incluye todo el tiempo de servicio.',
      children: classSteps,
    });
  } else {
    let previousTotal = 0;
    let previousW = 0;
    const classSteps: Step[] = rates.map((rate, k) => {
      const total = cumulative[k]!;
      const m = mmsMeasures(total, mu, s);
      if (!m) {
        W.push(null);
        return {
          title: `Clase ${k + 1}`,
          explanation: `Las clases 1 a ${k + 1} llegan a ${formatNumber(total)} ≥ sμ: esta clase no alcanza el estado estable.`,
        };
      }
      const Wk = (total * m.W - previousTotal * previousW) / rate;
      W.push(Wk);
      const step: Step = {
        title: `Clase ${k + 1}`,
        explanation: `Las clases 1 a ${k + 1} se comportan como un M/M/${s} con Λ = ${formatNumber(total)}, cuyo tiempo en el sistema es W̄ = ${formatNumber(m.W, 8)}.`,
        formula:
          k === 0
            ? 'W_1 = \\bar W_1'
            : `W_{${k + 1}} = \\frac{\\Lambda_{${k + 1}}\\bar W_{${k + 1}} - \\Lambda_{${k}}\\bar W_{${k}}}{\\lambda_{${k + 1}}}`,
        substitution:
          k === 0
            ? `W_1 = ${n(m.W)}`
            : `W_{${k + 1}} = \\frac{(${n(total)})(${n(m.W, 8)}) - (${n(previousTotal)})(${n(previousW, 8)})}{${n(rate)}}`,
        result: `W_{${k + 1}} = ${n(Wk)}`,
      };
      previousTotal = total;
      previousW = m.W;
      return step;
    });
    steps.push({
      title: 'Tiempo promedio en el sistema de cada clase',
      explanation:
        'Las clases de mayor prioridad no se ven afectadas por las de menor prioridad. Por eso las clases 1 a k juntas se analizan como un M/M/s, y el tiempo de la clase k se despeja del promedio ponderado.',
      formula: '\\Lambda_k \\bar W_k = \\sum_{i=1}^{k} \\lambda_i W_i',
      children: classSteps,
    });
  }

  const classes: PriorityClassResult[] = rates.map((rate, k) => {
    const Wk = W[k] ?? null;
    return {
      priority: k + 1,
      lambda: rate,
      W: Wk,
      Wq: Wk === null ? null : Wk - 1 / mu,
      L: Wk === null ? null : rate * Wk,
      Lq: Wk === null ? null : rate * (Wk - 1 / mu),
    };
  });

  steps.push({
    title: 'Medidas por clase (ley de Little)',
    formula:
      'W_{q,k} = W_k - \\frac{1}{\\mu}, \\qquad L_k = \\lambda_k W_k, \\qquad L_{q,k} = \\lambda_k W_{q,k}',
    result: classes
      .filter((c) => c.Wq !== null)
      .map((c) => `W_{q,${c.priority}} = ${n(c.Wq!, 6)}`)
      .join(',\\ '),
  });

  const unstableClasses = classes.filter((c) => c.W === null).map((c) => c.priority);
  const rows: Record<string, CellValue>[] = classes.map((c) => ({
    priority: c.priority,
    lambda: c.lambda,
    B: B[c.priority]!,
    W: c.W,
    Wq: c.Wq,
    L: c.L,
    Lq: c.Lq,
  }));

  return {
    ok: true,
    value: { classes, A, B },
    summary: [
      ...classes.slice(0, 4).map((c, i) => ({
        label: `Espera de la clase ${c.priority}`,
        value:
          c.Wq === null ? `W_{q,${c.priority}} = \\infty` : `W_{q,${c.priority}} = ${n(c.Wq, 6)}`,
        emphasis: i === 0,
      })),
      ...(A === null ? [] : [{ label: 'Constante A', value: `A = ${n(A, 6)}` }]),
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'clases',
        title: 'Medidas de desempeño por clase de prioridad',
        columns: [
          { key: 'priority', header: 'k' },
          { key: 'lambda', header: '\\lambda_k' },
          { key: 'B', header: 'B_k' },
          { key: 'W', header: 'W_k' },
          { key: 'Wq', header: 'W_k - 1/\\mu' },
          { key: 'L', header: 'L_k' },
          { key: 'Lq', header: 'L_{q,k}' },
        ],
        rows,
      },
    ],
    notices:
      unstableClasses.length > 0
        ? [
            {
              level: 'warning',
              message: `La${unstableClasses.length > 1 ? 's clases' : ' clase'} ${unstableClasses.join(', ')} no alcanza${unstableClasses.length > 1 ? 'n' : ''} el estado estable: las clases de mayor prioridad ocupan toda la capacidad.`,
            },
          ]
        : [
            {
              level: 'info',
              message:
                'W_k − 1/μ es el tiempo promedio de espera de la clase k sin contar su servicio. Con interrupción, ese tiempo incluye las esperas después de ser interrumpido.',
            },
          ],
  };
}

export const priorityQueue: Calculator<
  PriorityQueueInput,
  PriorityQueueValue,
  PriorityQueueErrorCode
> = {
  meta: {
    id: 'colas-con-prioridad',
    title: 'Colas con prioridad',
    summary: 'Tiempos de espera por clase de prioridad, con o sin interrupción del servicio.',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 17.8, ejemplo del hospital del condado, tabla 17.4 (7.ª ed.)',
      },
      { sourceId: 'winston-1994', locator: 'Sec. 20.15, modelos de colas con prioridad (4.ª ed.)' },
    ],
  },
  inputSchema: priorityQueueInputSchema,
  // Hillier, hospital del condado: λ = 2 pacientes/h (10 %, 30 % y 60 % en las tres clases),
  // μ = 3 por médico, dos médicos y atención interrumpida por casos más graves.
  example: { rates: '0.2, 0.6, 1.2', mu: 3, servers: 2, discipline: 'apropiativa' },
  solve: solvePriorityQueue,
};
