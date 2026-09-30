/**
 * Pruebas no paramétricas (Walpole, Myers, Myers y Ye, cap. 16; Canavos, cap. 14):
 *
 * - Signo (sec. 16.1): X = número de datos mayores que μ̃₀ (se descartan los iguales); bajo H₀,
 *   X ~ binomial(n, ½).
 * - Rangos con signo de Wilcoxon (sec. 16.2): se ordenan |dᵢ| = |xᵢ − μ̃₀| (sin los ceros) y se
 *   suman los rangos de las diferencias positivas (w₊) y negativas (w₋). H₁: μ̃ < μ̃₀ usa w₊,
 *   H₁: μ̃ > μ̃₀ usa w₋ y H₁: μ̃ ≠ μ̃₀ usa w = mín(w₊, w₋); se rechaza si el estadístico es menor
 *   o igual que el valor crítico.
 * - Suma de rangos de Wilcoxon o U de Mann-Whitney (sec. 16.3): con los rangos de las dos muestras
 *   juntas, u₁ = w₁ − n₁(n₁ + 1)/2 y u₂ = n₁n₂ − u₁. H₁: μ̃₁ < μ̃₂ usa u₁, H₁: μ̃₁ > μ̃₂ usa u₂ y
 *   la bilateral u = mín(u₁, u₂).
 * - Kruskal-Wallis (sec. 16.4): h = 12/[N(N + 1)] Σ Rᵢ²/nᵢ − 3(N + 1), aproximadamente
 *   ji-cuadrada con k − 1 grados de libertad.
 *
 * En las tres primeras los valores críticos y el valor P salen de la distribución exacta del
 * estadístico (las tablas A.16 y A.17 del libro se construyen así); con muestras grandes se usa la
 * aproximación normal. A los datos empatados se les asigna el promedio de los rangos.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { standardNormalCdf } from '@/lib/math/normal';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import { alphaField, alternativeField, testDecision, type Alternative } from './hypothesis';
import { binomialCdf } from './probability';
import { averageRanks, finite, parseSample, refineSample } from './samples';

export const nonParametricTests = ['signo', 'wilcoxon', 'mann-whitney', 'kruskal-wallis'] as const;
export type NonParametricTest = (typeof nonParametricTests)[number];

/** Hasta este tamaño se usa la distribución exacta; más allá, la aproximación normal. */
const EXACT_SIGNED_RANK = 50;
const EXACT_RANK_SUM = 30;

/** Grupos de Kruskal-Wallis: uno por renglón. */
export function parseGroups(text: string | undefined): number[][] | string {
  const lines = (text ?? '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return 'Escribe al menos 2 grupos, uno por renglón.';
  const groups: number[][] = [];
  for (const [i, line] of lines.entries()) {
    const { values, invalid } = parseDataList(line);
    if (invalid.length > 0)
      return `En el grupo ${i + 1} hay valores que no son números: ${invalid.slice(0, 3).join(', ')}.`;
    if (values.length === 0) return `El grupo ${i + 1} está vacío.`;
    groups.push(values);
  }
  return groups;
}

export const nonParametricInputSchema = z
  .object({
    test: z.enum(nonParametricTests, { error: 'Elige la prueba.' }),
    sample1: z.string().optional(),
    sample2: z.string().optional(),
    groups: z.string().optional(),
    median0: finite('μ̃₀'),
    alternative: alternativeField,
    alpha: alphaField,
  })
  .superRefine((v, ctx) => {
    if (v.test === 'kruskal-wallis') {
      const groups = parseGroups(v.groups);
      if (typeof groups === 'string')
        ctx.addIssue({ code: 'custom', path: ['groups'], message: groups });
      return;
    }
    const first = refineSample(
      v.sample1,
      'sample1',
      ctx,
      v.test === 'mann-whitney' ? 1 : 2,
      'la muestra 1',
    );
    const hasSecond = (v.sample2 ?? '').trim() !== '';
    if (v.test === 'mann-whitney') {
      refineSample(v.sample2, 'sample2', ctx, 1, 'la muestra 2');
    } else if (hasSecond) {
      const second = refineSample(v.sample2, 'sample2', ctx, 2, 'la muestra 2');
      if (first && second && first.length !== second.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['sample2'],
          message: `Para datos pareados las dos muestras deben tener el mismo tamaño (${first.length} y ${second.length}).`,
        });
      }
    }
  });

export type NonParametricInput = z.infer<typeof nonParametricInputSchema>;

export interface NonParametricValue {
  statistic: number;
  pValue: number;
  reject: boolean;
  /** Valor crítico exacto (w o u), si se usó la distribución exacta. */
  critical: number | null;
  /** Estadísticos auxiliares: w₊, w₋, u₁, u₂, rangos por grupo… */
  details: Record<string, number>;
}

export type NonParametricErrorCode = 'no-data';

type Result = CalculatorResult<NonParametricValue, NonParametricErrorCode>;

const n = (v: number) => toLatexNumber(v, 6);
const p4 = (v: number) => toLatexNumber(v, 4);

// ─── Distribuciones exactas ─────────────────────────────────────────────────

/** P(W₊ = w) para w = 0 … n(n + 1)/2, bajo H₀ (cada rango con signo + o − con probabilidad ½). */
export function signedRankDistribution(size: number): number[] {
  const max = (size * (size + 1)) / 2;
  const counts = new Array<number>(max + 1).fill(0);
  counts[0] = 1;
  for (let k = 1; k <= size; k++) {
    for (let s = max; s >= k; s--) counts[s]! += counts[s - k]!;
  }
  const total = 2 ** size;
  return counts.map((c) => c / total);
}

/** P(U = u) para u = 0 … n₁n₂, bajo H₀ (todas las ordenaciones igualmente probables). */
export function rankSumDistribution(n1: number, n2: number): number[] {
  // p[i][j] = distribución de U con i y j observaciones; recursión sobre la mayor observación.
  let previous: number[][] = Array.from({ length: n2 + 1 }, () => [1]);
  for (let i = 1; i <= n1; i++) {
    const current: number[][] = [];
    current[0] = [1];
    for (let j = 1; j <= n2; j++) {
      const size = i * j + 1;
      const dist = new Array<number>(size).fill(0);
      // La mayor es de la muestra 1 (prob. i/(i+j)): supera a las j de la muestra 2 → U aumenta j.
      const fromFirst = previous[j]!;
      fromFirst.forEach((p, u) => {
        dist[u + j]! += (p * i) / (i + j);
      });
      const fromSecond = current[j - 1]!;
      fromSecond.forEach((p, u) => {
        dist[u]! += (p * j) / (i + j);
      });
      current[j] = dist;
    }
    previous = current;
  }
  return previous[n2]!;
}

function cumulative(dist: number[], value: number): number {
  let sum = 0;
  for (let k = 0; k <= Math.floor(value + 1e-9) && k < dist.length; k++) sum += dist[k]!;
  return Math.min(1, sum);
}

/** Mayor valor c con P(T ≤ c) ≤ área, o `null` si ni el 0 cumple. */
function criticalFrom(dist: number[], area: number): number | null {
  let sum = 0;
  let critical: number | null = null;
  for (let k = 0; k < dist.length; k++) {
    sum += dist[k]!;
    if (sum <= area + 1e-12) critical = k;
    else break;
  }
  return critical;
}

// ─── Pruebas ────────────────────────────────────────────────────────────────

function differences(input: NonParametricInput): { values: number[]; paired: boolean } {
  const first = parseSample(input.sample1) as number[];
  const hasSecond = (input.sample2 ?? '').trim() !== '';
  if (!hasSecond) return { values: first, paired: false };
  const second = parseSample(input.sample2) as number[];
  return { values: first.map((v, i) => v - second[i]!), paired: true };
}

const medianTex = (paired: boolean) => (paired ? '\\tilde{\\mu}_D' : '\\tilde{\\mu}');

function hypotheses(paired: boolean, median0: number, alternative: Alternative): string {
  const rel = alternative === 'distinto' ? '\\neq' : alternative === 'menor' ? '<' : '>';
  const m = medianTex(paired);
  return `H_0\\!: ${m} = ${n(median0)}, \\qquad H_1\\!: ${m} ${rel} ${n(median0)}`;
}

function decisionSteps(pValue: number, alpha: number, reject: boolean): Step {
  return {
    title: 'Decisión',
    explanation: reject
      ? `P = ${formatNumber(pValue, 4)} < α = ${formatNumber(alpha)}: se rechaza H₀.`
      : `P = ${formatNumber(pValue, 4)} ≥ α = ${formatNumber(alpha)}: no se rechaza H₀.`,
    result: reject ? '\\text{Se rechaza } H_0' : '\\text{No se rechaza } H_0',
  };
}

function signTest(input: NonParametricInput): Result {
  const { values, paired } = differences(input);
  const m0 = input.median0;
  const kept = values.filter((v) => v !== m0);
  const plus = kept.filter((v) => v > m0).length;
  const size = kept.length;
  const steps: Step[] = [
    { title: 'Hipótesis', result: hypotheses(paired, m0, input.alternative) },
    {
      title: paired ? 'Diferencias de los pares' : 'Signos',
      explanation: `Cada dato mayor que μ̃₀ = ${formatNumber(m0)} es un «+» y cada uno menor es un «−». Se descartan ${values.length - size} dato(s) iguales a μ̃₀.${paired ? ' Con datos pareados se trabaja con las diferencias d = x₁ − x₂.' : ''}`,
      result: `n = ${size}, \\quad x = \\text{número de signos } + = ${plus}`,
    },
  ];
  if (size === 0) {
    return {
      ok: false,
      error: {
        code: 'no-data',
        message: 'Todos los datos son iguales a μ̃₀: no queda ningún signo.',
      },
      ...emptyTrace(),
      steps,
    };
  }
  const low = binomialCdf(plus, size, 0.5);
  const high = 1 - binomialCdf(plus - 1, size, 0.5);
  const pValue =
    input.alternative === 'mayor'
      ? high
      : input.alternative === 'menor'
        ? low
        : Math.min(1, 2 * Math.min(low, high));
  const reject = pValue < input.alpha;
  steps.push({
    title: 'Valor P con la distribución binomial',
    explanation:
      'Si H₀ es cierta, cada dato tiene probabilidad ½ de quedar por encima de la mediana, así que X ~ binomial(n, ½).',
    formula:
      input.alternative === 'mayor'
        ? 'P = P(X \\ge x \\mid p = \\tfrac12)'
        : input.alternative === 'menor'
          ? 'P = P(X \\le x \\mid p = \\tfrac12)'
          : `P = 2P(X ${plus <= size / 2 ? '\\le' : '\\ge'} x \\mid p = \\tfrac12)`,
    substitution:
      input.alternative === 'distinto'
        ? `P = 2P(X ${plus <= size / 2 ? '\\le' : '\\ge'} ${plus}) = 2(${p4(Math.min(low, high))})`
        : undefined,
    result: `P = ${p4(pValue)}`,
  });
  if (size > 10) {
    const z = (plus - size / 2) / (Math.sqrt(size) / 2);
    steps.push({
      title: 'Aproximación normal (n > 10)',
      explanation:
        'Con muestras grandes el libro usa z en lugar de la suma binomial; el valor P exacto de arriba es el que se usa para decidir.',
      formula: 'z = \\frac{x - n/2}{\\sqrt{n}/2}',
      substitution: `z = \\frac{${plus} - ${n(size / 2)}}{\\sqrt{${size}}/2}`,
      result: `z = ${n(z)}`,
    });
  }
  steps.push(decisionSteps(pValue, input.alpha, reject));
  return {
    ok: true,
    value: {
      statistic: plus,
      pValue,
      reject,
      critical: null,
      details: { n: size, plus, minus: size - plus },
    },
    summary: [
      { label: 'Signos +', value: `x = ${plus} \\text{ de } n = ${size}`, emphasis: true },
      { label: 'Valor P', value: `P = ${p4(pValue)}` },
      {
        label: 'Decisión',
        value: reject ? '\\text{Se rechaza } H_0' : '\\text{No se rechaza } H_0',
      },
    ],
    ...emptyTrace(),
    steps,
  };
}

function signedRankTest(input: NonParametricInput): Result {
  const { values, paired } = differences(input);
  const m0 = input.median0;
  const d = values.map((v) => v - m0).filter((v) => v !== 0);
  const size = d.length;
  const steps: Step[] = [{ title: 'Hipótesis', result: hypotheses(paired, m0, input.alternative) }];
  if (size === 0) {
    return {
      ok: false,
      error: { code: 'no-data', message: 'Todas las diferencias son 0: no hay rangos que sumar.' },
      ...emptyTrace(),
      steps,
    };
  }
  const ranks = averageRanks(d.map(Math.abs));
  const wPlus = ranks.reduce((s, r, i) => s + (d[i]! > 0 ? r : 0), 0);
  const wMinus = ranks.reduce((s, r, i) => s + (d[i]! < 0 ? r : 0), 0);
  const ties = new Set(d.map(Math.abs)).size !== size;
  steps.push({
    title: 'Diferencias y rangos',
    explanation: `Se calculan dᵢ = ${paired ? 'x₁ − x₂' : 'xᵢ'} − μ̃₀, se descartan los ceros (quedan n = ${size}) y se ordenan los |dᵢ| de menor a mayor. ${ties ? 'A los valores empatados se les asigna el promedio de sus rangos.' : ''}`,
    formula: 'w_+ = \\sum_{d_i > 0} r_i, \\qquad w_- = \\sum_{d_i < 0} r_i',
    result: `w_+ = ${n(wPlus)}, \\quad w_- = ${n(wMinus)} \\quad (w_+ + w_- = ${n((size * (size + 1)) / 2)})`,
  });
  const statistic =
    input.alternative === 'menor'
      ? wPlus
      : input.alternative === 'mayor'
        ? wMinus
        : Math.min(wPlus, wMinus);
  const name = input.alternative === 'menor' ? 'w_+' : input.alternative === 'mayor' ? 'w_-' : 'w';
  steps.push({
    title: 'Estadístico',
    explanation:
      input.alternative === 'distinto'
        ? 'Para la alternativa bilateral se usa el menor de w₊ y w₋.'
        : input.alternative === 'menor'
          ? 'Si la mediana fuera menor, habría pocas diferencias positivas: se usa w₊.'
          : 'Si la mediana fuera mayor, habría pocas diferencias negativas: se usa w₋.',
    result: `${name} = ${n(statistic)}`,
  });
  const area = input.alternative === 'distinto' ? input.alpha / 2 : input.alpha;
  let pValue: number;
  let critical: number | null = null;
  if (size <= EXACT_SIGNED_RANK) {
    const dist = signedRankDistribution(size);
    critical = criticalFrom(dist, area);
    const tail = cumulative(dist, statistic);
    pValue = Math.min(1, (input.alternative === 'distinto' ? 2 : 1) * tail);
    steps.push({
      title: 'Valor crítico y valor P exactos',
      explanation: `Bajo H₀ cada rango lleva signo + o − con probabilidad ½; se enumeran las 2^${size} combinaciones. El valor crítico es el mayor w con P(W ≤ w) ≤ ${formatNumber(area)}.${ties ? ' Con empates la distribución exacta es aproximada.' : ''}`,
      formula: `\\text{Se rechaza } H_0 \\text{ si } ${name} \\le w_c`,
      result: `w_c = ${critical === null ? '\\text{no existe (muestra muy pequeña)}' : critical}, \\qquad P = ${p4(pValue)}`,
    });
  } else {
    const mu = (size * (size + 1)) / 4;
    const sd = Math.sqrt((size * (size + 1) * (2 * size + 1)) / 24);
    const z = (statistic - mu) / sd;
    pValue = Math.min(1, (input.alternative === 'distinto' ? 2 : 1) * standardNormalCdf(z));
    steps.push({
      title: 'Aproximación normal (n > 50)',
      formula: 'z = \\frac{w - n(n+1)/4}{\\sqrt{n(n+1)(2n+1)/24}}',
      substitution: `z = \\frac{${n(statistic)} - ${n(mu)}}{${n(sd)}}`,
      result: `z = ${n(z)}, \\qquad P = ${p4(pValue)}`,
    });
  }
  const reject = critical !== null ? statistic <= critical : pValue < input.alpha;
  steps.push(decisionSteps(pValue, input.alpha, reject));
  return {
    ok: true,
    value: { statistic, pValue, reject, critical, details: { n: size, wPlus, wMinus } },
    summary: [
      { label: 'Estadístico', value: `${name} = ${n(statistic)}`, emphasis: true },
      ...(critical === null ? [] : [{ label: 'Valor crítico', value: `w_c = ${critical}` }]),
      { label: 'Valor P', value: `P = ${p4(pValue)}` },
      {
        label: 'Decisión',
        value: reject ? '\\text{Se rechaza } H_0' : '\\text{No se rechaza } H_0',
      },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'rangos',
        title: 'Diferencias y rangos',
        columns: [
          { key: 'd', header: 'd_i' },
          { key: 'abs', header: '|d_i|' },
          { key: 'rank', header: '\\text{Rango}' },
          { key: 'sign', header: '\\text{Signo}', format: 'text' },
        ],
        rows: d.map((v, i) => ({
          d: v,
          abs: Math.abs(v),
          rank: ranks[i]!,
          sign: v > 0 ? '+' : '−',
        })),
      },
    ],
  };
}

function rankSumTest(input: NonParametricInput): Result {
  const a = parseSample(input.sample1, 1) as number[];
  const b = parseSample(input.sample2, 1) as number[];
  const n1 = a.length;
  const n2 = b.length;
  const ranks = averageRanks([...a, ...b]);
  const w1 = ranks.slice(0, n1).reduce((s, r) => s + r, 0);
  const w2 = ranks.slice(n1).reduce((s, r) => s + r, 0);
  const u1 = w1 - (n1 * (n1 + 1)) / 2;
  const u2 = w2 - (n2 * (n2 + 1)) / 2;
  const rel =
    input.alternative === 'distinto' ? '\\neq' : input.alternative === 'menor' ? '<' : '>';
  const steps: Step[] = [
    {
      title: 'Hipótesis',
      result: `H_0\\!: \\tilde{\\mu}_1 = \\tilde{\\mu}_2, \\qquad H_1\\!: \\tilde{\\mu}_1 ${rel} \\tilde{\\mu}_2`,
    },
    {
      title: 'Rangos de las dos muestras juntas',
      explanation: `Se ordenan las ${n1 + n2} observaciones de menor a mayor (empates con el rango promedio) y se suman los rangos de cada muestra.`,
      result: `w_1 = ${n(w1)}, \\quad w_2 = ${n(w2)}`,
    },
    {
      title: 'Estadísticos U',
      formula: 'u_1 = w_1 - \\frac{n_1(n_1 + 1)}{2}, \\qquad u_2 = w_2 - \\frac{n_2(n_2 + 1)}{2}',
      substitution: `u_1 = ${n(w1)} - \\frac{${n1}(${n1 + 1})}{2}, \\qquad u_2 = ${n(w2)} - \\frac{${n2}(${n2 + 1})}{2}`,
      result: `u_1 = ${n(u1)}, \\quad u_2 = ${n(u2)} \\quad (u_1 + u_2 = n_1 n_2 = ${n1 * n2})`,
    },
  ];
  const statistic =
    input.alternative === 'menor' ? u1 : input.alternative === 'mayor' ? u2 : Math.min(u1, u2);
  const name = input.alternative === 'menor' ? 'u_1' : input.alternative === 'mayor' ? 'u_2' : 'u';
  steps.push({
    title: 'Estadístico',
    explanation:
      input.alternative === 'distinto'
        ? 'Para la alternativa bilateral se usa el menor de u₁ y u₂.'
        : `Se usa ${input.alternative === 'menor' ? 'u₁: si la muestra 1 tiende a ser menor, sus rangos son pequeños' : 'u₂: si la muestra 1 tiende a ser mayor, los rangos de la muestra 2 son pequeños'}.`,
    result: `${name} = ${n(statistic)}`,
  });
  const area = input.alternative === 'distinto' ? input.alpha / 2 : input.alpha;
  let pValue: number;
  let critical: number | null = null;
  if (n1 <= EXACT_RANK_SUM && n2 <= EXACT_RANK_SUM) {
    const dist = rankSumDistribution(n1, n2);
    critical = criticalFrom(dist, area);
    pValue = Math.min(1, (input.alternative === 'distinto' ? 2 : 1) * cumulative(dist, statistic));
    steps.push({
      title: 'Valor crítico y valor P exactos',
      explanation: `Bajo H₀ las C(${n1 + n2}, ${n1}) formas de repartir los rangos son igualmente probables. El valor crítico es el mayor u con P(U ≤ u) ≤ ${formatNumber(area)}.`,
      formula: `\\text{Se rechaza } H_0 \\text{ si } ${name} \\le u_c`,
      result: `u_c = ${critical === null ? '\\text{no existe (muestras muy pequeñas)}' : critical}, \\qquad P = ${p4(pValue)}`,
    });
  } else {
    const mu = (n1 * n2) / 2;
    const sd = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    const z = (statistic - mu) / sd;
    pValue = Math.min(1, (input.alternative === 'distinto' ? 2 : 1) * standardNormalCdf(z));
    steps.push({
      title: 'Aproximación normal',
      formula: 'z = \\frac{u - n_1 n_2/2}{\\sqrt{n_1 n_2 (n_1 + n_2 + 1)/12}}',
      substitution: `z = \\frac{${n(statistic)} - ${n(mu)}}{${n(sd)}}`,
      result: `z = ${n(z)}, \\qquad P = ${p4(pValue)}`,
    });
  }
  const reject = critical !== null ? statistic <= critical : pValue < input.alpha;
  steps.push(decisionSteps(pValue, input.alpha, reject));
  return {
    ok: true,
    value: { statistic, pValue, reject, critical, details: { w1, w2, u1, u2 } },
    summary: [
      { label: 'Estadístico', value: `${name} = ${n(statistic)}`, emphasis: true },
      ...(critical === null ? [] : [{ label: 'Valor crítico', value: `u_c = ${critical}` }]),
      { label: 'Valor P', value: `P = ${p4(pValue)}` },
      {
        label: 'Decisión',
        value: reject ? '\\text{Se rechaza } H_0' : '\\text{No se rechaza } H_0',
      },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'rangos',
        title: 'Rangos',
        columns: [
          { key: 'sample', header: '\\text{Muestra}' },
          { key: 'value', header: '\\text{Valor}' },
          { key: 'rank', header: '\\text{Rango}' },
        ],
        rows: [...a, ...b]
          .map((value, i) => ({ sample: i < n1 ? 1 : 2, value, rank: ranks[i]! }))
          .sort((x, y) => x.rank - y.rank),
      },
    ],
  };
}

function kruskalWallis(input: NonParametricInput): Result {
  const groups = parseGroups(input.groups) as number[][];
  const all = groups.flat();
  const total = all.length;
  const ranks = averageRanks(all);
  let offset = 0;
  const sums = groups.map((g) => {
    const sum = ranks.slice(offset, offset + g.length).reduce((s, r) => s + r, 0);
    offset += g.length;
    return sum;
  });
  const k = groups.length;
  const sumTerm = sums.reduce((s, r, i) => s + (r * r) / groups[i]!.length, 0);
  const h = (12 / (total * (total + 1))) * sumTerm - 3 * (total + 1);
  const steps: Step[] = [
    {
      title: 'Hipótesis',
      explanation: `H₀: las ${k} muestras provienen de poblaciones idénticas (medianas iguales). H₁: no todas son iguales.`,
    },
    {
      title: 'Rangos de todas las observaciones juntas',
      explanation: `Se ordenan las N = ${total} observaciones (empates con el rango promedio) y se suman los rangos de cada grupo.`,
      result: sums
        .map((r, i) => `R_{${i + 1}} = ${n(r)}\\ (n_{${i + 1}} = ${groups[i]!.length})`)
        .join(',\\quad '),
    },
    {
      title: 'Estadístico H',
      formula: 'h = \\frac{12}{N(N + 1)} \\sum_i \\frac{R_i^2}{n_i} - 3(N + 1)',
      substitution: `h = \\frac{12}{${total}(${total + 1})}\\left(${sums.map((r, i) => `\\frac{${toLatexOperand(r)}^2}{${groups[i]!.length}}`).join(' + ')}\\right) - 3(${total + 1})`,
      result: `h = ${n(h)}`,
    },
  ];
  const outcome = testDecision({
    statistic: { kind: 'chi2', df: k - 1 },
    value: h,
    alternative: 'mayor',
    alpha: input.alpha,
  });
  steps.push({
    title: 'Distribución aproximada',
    explanation: `Si H₀ es cierta y cada grupo tiene al menos 5 observaciones, h es aproximadamente ji-cuadrada con ν = k − 1 = ${k - 1} grados de libertad.${groups.some((g) => g.length < 5) ? ' Algún grupo tiene menos de 5 datos: la aproximación es menos confiable.' : ''}`,
  });
  steps.push(...outcome.steps);
  return {
    ok: true,
    value: {
      statistic: h,
      pValue: outcome.pValue,
      reject: outcome.reject,
      critical: null,
      details: Object.fromEntries(sums.map((r, i) => [`R${i + 1}`, r])),
    },
    summary: [{ label: 'Estadístico', value: `h = ${n(h)}`, emphasis: true }, ...outcome.summary],
    ...emptyTrace(),
    steps,
    series: [outcome.series],
    notices: groups.some((g) => g.length < 5)
      ? [
          {
            level: 'warning',
            message:
              'Algún grupo tiene menos de 5 observaciones: la aproximación ji-cuadrada puede no ser buena.',
          },
        ]
      : [],
  };
}

export function solveNonParametric(input: NonParametricInput): Result {
  switch (input.test) {
    case 'signo':
      return signTest(input);
    case 'wilcoxon':
      return signedRankTest(input);
    case 'mann-whitney':
      return rankSumTest(input);
    case 'kruskal-wallis':
      return kruskalWallis(input);
  }
}

export const nonParametric: Calculator<
  NonParametricInput,
  NonParametricValue,
  NonParametricErrorCode
> = {
  meta: {
    id: 'pruebas-no-parametricas',
    title: 'Pruebas no paramétricas',
    summary:
      'Prueba del signo, rangos con signo de Wilcoxon, Mann-Whitney y Kruskal-Wallis, con distribuciones exactas.',
    citations: [
      { sourceId: 'canavos-1995', locator: 'Cap. 14, estadística no paramétrica' },
      {
        sourceId: 'walpole-1999',
        locator:
          'Cap. 16: ejemplos 16.1 y 16.3 (recortadora eléctrica), 16.5 (nicotina de dos marcas) y 16.6 (tasas de combustión), 9.ª ed.',
      },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: nonParametricInputSchema,
  example: {
    test: 'signo',
    sample1: '1.5 2.2 0.9 1.3 2.0 1.6 1.8 1.5 2.0 1.2 1.7',
    sample2: '',
    groups: '',
    median0: 1.8,
    alternative: 'distinto',
    alpha: 0.05,
  },
  solve: solveNonParametric,
};
