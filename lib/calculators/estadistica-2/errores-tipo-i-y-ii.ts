/**
 * Errores tipo I y II y función potencia (Walpole, Myers, Myers y Ye, sec. 10.2; Canavos, cap. 9):
 *
 *   α = P(error tipo I)  = P(rechazar H₀ | H₀ es cierta)
 *   β = P(error tipo II) = P(no rechazar H₀ | H₁ es cierta, con un valor particular θ₁)
 *   Potencia = 1 − β = P(rechazar H₀ | θ = θ₁);  la función potencia es 1 − β(θ) para cada θ.
 *
 * Dos modelos, como en el libro:
 * - Media de una normal con σ conocida: X̄ ~ N(μ, σ/√n). La región crítica se da en términos de
 *   x̄ (p. ej. x̄ < 67 o x̄ > 69) o se calcula a partir de α.
 * - Proporción con X ~ binomial(n, p): la región crítica se da en términos de X (p. ej. X > 8).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, TEX } from '@/lib/math/format';
import { standardNormalCdf, standardNormalQuantile } from '@/lib/math/normal';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
  type SummaryItem,
} from '../types';
import { alternativeField, byAlternative, hypothesesLatex, type Alternative } from './hypothesis';
import { binomialCdf } from './probability';
import { finite, positive } from './samples';

export const errorModels = ['normal', 'binomial'] as const;

const probability = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine((v) => Number.isFinite(v) && v > 0 && v < 1, `${label} debe estar entre 0 y 1.`);

type RequiredKey = 'mu0' | 'sigma' | 'p0' | 'alpha' | 'lower' | 'upper' | 'trueValue';

/** Con valores críticos dados: los que pide la alternativa, en orden, y enteros si es binomial. */
function refineLimits(
  v: {
    model: (typeof errorModels)[number];
    alternative: Alternative;
    lower?: number;
    upper?: number;
  },
  need: (key: RequiredKey, message: string) => void,
  ctx: z.RefinementCtx,
): void {
  if (v.alternative !== 'mayor') need('lower', 'Ingresa el valor crítico inferior.');
  if (v.alternative !== 'menor') need('upper', 'Ingresa el valor crítico superior.');
  // z.number() no admite NaN, así que la comparación directa basta.
  const crossed = v.lower !== undefined && v.upper !== undefined && v.lower >= v.upper;
  if (v.alternative === 'distinto' && crossed) {
    ctx.addIssue({
      code: 'custom',
      path: ['upper'],
      message: 'El valor crítico superior debe ser mayor que el inferior.',
    });
  }
  if (v.model !== 'binomial') return;
  for (const key of ['lower', 'upper'] as const) {
    const value = v[key];
    if (value !== undefined && !Number.isInteger(value)) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: 'En el modelo binomial los valores críticos son enteros (número de éxitos).',
      });
    }
  }
}

export const errorTypesInputSchema = z
  .object({
    model: z.enum(errorModels, { error: 'Elige el modelo.' }),
    alternative: alternativeField,
    n: z
      .number({ error: 'Ingresa n.' })
      .int('n debe ser un número entero.')
      .min(1, 'n debe ser al menos 1.')
      .max(100_000, 'n es demasiado grande.'),
    mu0: finite('μ₀').optional(),
    sigma: positive('σ').optional(),
    p0: probability('p₀').optional(),
    regionBy: z.enum(['alfa', 'limites'], { error: 'Elige cómo se da la región crítica.' }),
    alpha: probability('α').optional(),
    lower: finite('el valor crítico inferior').optional(),
    upper: finite('el valor crítico superior').optional(),
    trueValue: finite('el valor de la alternativa').optional(),
  })
  .superRefine((v, ctx) => {
    const need = (key: RequiredKey, message: string) => {
      if (v[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message });
    };
    if (v.model === 'normal') {
      need('mu0', 'Ingresa μ₀.');
      need('sigma', 'Ingresa σ.');
      if (v.regionBy === 'alfa') need('alpha', 'Ingresa α.');
    } else {
      need('p0', 'Ingresa p₀.');
      if (v.trueValue !== undefined && !(v.trueValue > 0 && v.trueValue < 1)) {
        ctx.addIssue({
          code: 'custom',
          path: ['trueValue'],
          message: 'p₁ debe estar entre 0 y 1.',
        });
      }
    }
    if (v.model === 'binomial' || v.regionBy === 'limites') refineLimits(v, need, ctx);
  });

export type ErrorTypesInput = z.infer<typeof errorTypesInputSchema>;

export interface ErrorTypesValue {
  alpha: number;
  /** β y potencia en el valor de la alternativa, si se dio. */
  beta: number | null;
  power: number | null;
  /** Valores críticos usados: [inferior, superior] (null si no aplica). */
  critical: [number | null, number | null];
}

const n = (v: number) => toLatexNumber(v, 6);
const p4 = (v: number) => toLatexNumber(v, 4);

function regionLatex(
  variable: string,
  alternative: Alternative,
  lower: number | null,
  upper: number | null,
) {
  if (alternative === 'mayor') return `${variable} > ${n(upper!)}`;
  if (alternative === 'menor') return `${variable} < ${n(lower!)}`;
  return String.raw`${variable} < ${n(lower!)} \;\text{ o }\; ${variable} > ${n(upper!)}`;
}

const XBAR = String.raw`\bar{x}`;
const XBAR_UPPER = String.raw`\bar{X}`;

interface NormalRegion {
  lower: number | null;
  upper: number | null;
  alpha: number;
  step: Step;
}

/** Valores críticos de x̄ que dejan α (o α/2) en la cola cuando μ = μ₀. */
function regionFromAlpha(input: ErrorTypesInput, se: number): NormalRegion {
  const mu0 = input.mu0!;
  const alt = input.alternative;
  const alpha = input.alpha!;
  const tail = alt === 'distinto' ? alpha / 2 : alpha;
  const zc = standardNormalQuantile(1 - tail);
  const lower = alt === 'mayor' ? null : mu0 - zc * se;
  const upper = alt === 'menor' ? null : mu0 + zc * se;
  const sign = byAlternative(alt, { menor: '-', mayor: '+', distinto: TEX.pm });
  return {
    lower,
    upper,
    alpha,
    step: {
      title: 'Región crítica a partir de α',
      explanation: `Se busca el valor de x̄ que deja un área ${formatNumber(tail)} en ${alt === 'distinto' ? 'cada cola' : 'la cola'} cuando μ = μ₀.`,
      formula: String.raw`\bar{x}_c = \mu_0 ${sign} z_{${formatNumber(tail)}}\,\sigma_{\bar{X}}`,
      substitution: String.raw`\bar{x}_c = ${n(mu0)} ${sign} ${n(zc)}(${n(se)})`,
      result: String.raw`\text{Se rechaza } H_0 \text{ si } ${regionLatex(XBAR, alt, lower, upper)}`,
    },
  };
}

/** α con los valores críticos dados: el área de la región crítica cuando μ = μ₀. */
function regionFromLimits(input: ErrorTypesInput, se: number): NormalRegion {
  const mu0 = input.mu0!;
  const alt = input.alternative;
  const lower = alt === 'mayor' ? null : input.lower!;
  const upper = alt === 'menor' ? null : input.upper!;
  const zLow = lower === null ? null : (lower - mu0) / se;
  const zUp = upper === null ? null : (upper - mu0) / se;
  const alpha =
    (zLow === null ? 0 : standardNormalCdf(zLow)) + (zUp === null ? 0 : 1 - standardNormalCdf(zUp));
  const tailsTex = [
    zLow === null ? null : `P(Z < ${n(zLow)})`,
    zUp === null ? null : `P(Z > ${n(zUp)})`,
  ]
    .filter(Boolean)
    .join(' + ');
  return {
    lower,
    upper,
    alpha,
    step: {
      title: 'Probabilidad del error tipo I',
      explanation: 'Es la probabilidad de caer en la región crítica cuando H₀ es cierta (μ = μ₀).',
      formula: String.raw`\alpha = P(${regionLatex(XBAR_UPPER, alt, lower, upper)} \mid \mu = ${n(mu0)})`,
      substitution: [
        zLow === null
          ? null
          : String.raw`z_1 = \frac{${n(lower!)} - ${n(mu0)}}{${n(se)}} = ${n(zLow)}`,
        zUp === null
          ? null
          : String.raw`z_2 = \frac{${n(upper!)} - ${n(mu0)}}{${n(se)}} = ${n(zUp)}`,
      ]
        .filter(Boolean)
        .join(String.raw`,\quad `),
      result: String.raw`\alpha = ${tailsTex} = ${p4(alpha)}`,
    },
  };
}

/** β en μ₁: la probabilidad de no caer en la región crítica. */
function betaStep(
  mu1: number,
  beta: number,
  se: number,
  lower: number | null,
  upper: number | null,
): Step {
  const z1 = lower === null ? null : (lower - mu1) / se;
  const z2 = upper === null ? null : (upper - mu1) / se;
  const fromLower = lower === null ? '' : String.raw`${n(lower)} \le `;
  const toUpper = upper === null ? '' : String.raw` \le ${n(upper)}`;
  return {
    title: `Probabilidad del error tipo II cuando μ = ${formatNumber(mu1)}`,
    explanation:
      'Es la probabilidad de NO caer en la región crítica cuando la media verdadera es μ₁.',
    formula: String.raw`\beta = P(${fromLower}\bar{X}${toUpper} \mid \mu = ${n(mu1)})`,
    substitution: [
      z1 === null ? null : String.raw`z_1 = \frac{${n(lower!)} - ${n(mu1)}}{${n(se)}} = ${n(z1)}`,
      z2 === null ? null : String.raw`z_2 = \frac{${n(upper!)} - ${n(mu1)}}{${n(se)}} = ${n(z2)}`,
    ]
      .filter(Boolean)
      .join(String.raw`,\quad `),
    result: String.raw`\beta = ${p4(beta)}, \qquad \text{potencia} = 1 - \beta = ${p4(1 - beta)}`,
  };
}

function solveNormal(input: ErrorTypesInput): CalculatorResult<ErrorTypesValue, never> {
  const mu0 = input.mu0!;
  const se = input.sigma! / Math.sqrt(input.n);
  const alt = input.alternative;
  const steps: Step[] = [
    { title: 'Hipótesis', result: hypothesesLatex(String.raw`\mu`, n(mu0), alt) },
    {
      title: 'Distribución de la media muestral',
      explanation: 'Con σ conocida, X̄ es normal con media μ y error estándar σ/√n.',
      formula: String.raw`\sigma_{\bar{X}} = \frac{\sigma}{\sqrt{n}}`,
      substitution: String.raw`\sigma_{\bar{X}} = \frac{${n(input.sigma!)}}{\sqrt{${input.n}}}`,
      result: String.raw`\sigma_{\bar{X}} = ${n(se)}`,
    },
  ];

  const region =
    input.regionBy === 'alfa' ? regionFromAlpha(input, se) : regionFromLimits(input, se);
  const { lower, upper, alpha } = region;
  steps.push(region.step);

  const acceptance = (mu: number) => {
    const low = lower === null ? 0 : standardNormalCdf((lower - mu) / se);
    const up = upper === null ? 1 : standardNormalCdf((upper - mu) / se);
    return up - low;
  };

  let beta: number | null = null;
  if (input.trueValue !== undefined) {
    beta = acceptance(input.trueValue);
    steps.push(betaStep(input.trueValue, beta, se, lower, upper));
  }

  const spread = 4 * se;
  const anchors = [
    mu0,
    ...(input.trueValue === undefined ? [] : [input.trueValue]),
    ...(lower === null ? [] : [lower]),
    ...(upper === null ? [] : [upper]),
  ];
  const lo = Math.min(...anchors) - spread;
  const hi = Math.max(...anchors) + spread;
  const series: Series = {
    id: 'potencia',
    title: 'Función potencia',
    xLabel: 'μ',
    yLabel: 'Potencia 1 − β',
    label: 'Potencia 1 − β(μ)',
    points: Array.from({ length: 161 }, (_, i) => {
      const mu = lo + ((hi - lo) * i) / 160;
      return { x: mu, y: 1 - acceptance(mu) };
    }),
  };
  return finish(alpha, beta, [lower, upper], steps, series, regionLatex(XBAR, alt, lower, upper));
}

function solveBinomial(input: ErrorTypesInput): CalculatorResult<ErrorTypesValue, never> {
  const trials = input.n;
  const p0 = input.p0!;
  const alt = input.alternative;
  const lower = alt === 'mayor' ? null : input.lower!;
  const upper = alt === 'menor' ? null : input.upper!;
  const steps: Step[] = [
    { title: 'Hipótesis', result: hypothesesLatex('p', n(p0), alt) },
    {
      title: 'Estadístico y región crítica',
      explanation: `X es el número de éxitos en ${trials} ensayos; bajo H₀, X ~ binomial(n = ${trials}, p = ${formatNumber(p0)}).`,
      result: String.raw`\text{Se rechaza } H_0 \text{ si } ${regionLatex('X', alt, lower, upper)}`,
    },
  ];
  // P(no rechazar) = P(lower ≤ X ≤ upper), con límites por defecto 0 y n.
  const acceptance = (p: number) => {
    const top = upper === null ? trials : upper;
    const bottom = lower === null ? 0 : lower;
    return binomialCdf(top, trials, p) - binomialCdf(bottom - 1, trials, p);
  };
  const alpha = 1 - acceptance(p0);
  const range = String.raw`${lower === null ? 0 : n(lower)} \le X \le ${upper === null ? trials : n(upper)}`;
  steps.push({
    title: 'Probabilidad del error tipo I',
    explanation:
      'Probabilidad de caer en la región crítica cuando p = p₀, sumando la distribución binomial.',
    formula: String.raw`\alpha = 1 - P(${range} \mid p = ${n(p0)})`,
    substitution: String.raw`\alpha = 1 - ${p4(acceptance(p0))}`,
    result: String.raw`\alpha = ${p4(alpha)}`,
  });
  let beta: number | null = null;
  if (input.trueValue !== undefined) {
    const p1 = input.trueValue;
    beta = acceptance(p1);
    steps.push({
      title: `Probabilidad del error tipo II cuando p = ${formatNumber(p1)}`,
      formula: String.raw`\beta = P(${range} \mid p = ${n(p1)}) = \sum b(x;\ ${trials},\ ${n(p1)})`,
      result: String.raw`\beta = ${p4(beta)}, \qquad \text{potencia} = 1 - \beta = ${p4(1 - beta)}`,
    });
  }
  const series: Series = {
    id: 'potencia',
    title: 'Función potencia',
    xLabel: 'p',
    yLabel: 'Potencia 1 − β',
    label: 'Potencia 1 − β(p)',
    points: Array.from({ length: 101 }, (_, i) => ({ x: i / 100, y: 1 - acceptance(i / 100) })),
  };
  return finish(alpha, beta, [lower, upper], steps, series, regionLatex('X', alt, lower, upper));
}

function finish(
  alpha: number,
  beta: number | null,
  critical: [number | null, number | null],
  steps: Step[],
  series: Series,
  region: string,
): CalculatorResult<ErrorTypesValue, never> {
  steps.push({
    title: 'Interpretación',
    explanation:
      'α y β se mueven en sentidos opuestos: ampliar la región crítica aumenta α y reduce β. Para reducir ambos a la vez hay que aumentar el tamaño de la muestra. La gráfica muestra la potencia para cada valor del parámetro.',
  });
  const summary: SummaryItem[] = [
    { label: 'Error tipo I', value: String.raw`\alpha = ${p4(alpha)}`, emphasis: true },
    ...(beta === null
      ? []
      : [
          { label: 'Error tipo II', value: String.raw`\beta = ${p4(beta)}`, emphasis: true },
          { label: 'Potencia', value: String.raw`1 - \beta = ${p4(1 - beta)}` },
        ]),
    { label: 'Región crítica', value: region },
  ];
  return {
    ok: true,
    value: { alpha, beta, power: beta === null ? null : 1 - beta, critical },
    summary,
    ...emptyTrace(),
    steps,
    series: [series],
  };
}

export function solveErrorTypes(input: ErrorTypesInput) {
  return input.model === 'normal' ? solveNormal(input) : solveBinomial(input);
}

export const errorTypes: Calculator<ErrorTypesInput, ErrorTypesValue, never> = {
  meta: {
    id: 'errores-tipo-i-y-ii',
    title: 'Errores tipo I y II y función potencia',
    summary: 'Calcula α, β y la potencia de una prueba sobre una media normal o una proporción.',
    citations: [
      { sourceId: 'canavos-1995', locator: 'Cap. 9, errores tipo I y II y función de potencia' },
      {
        sourceId: 'walpole-1999',
        locator:
          'Sec. 10.2 (la vacuna con n = 20 y X > 8; el peso medio de los estudiantes con 67 < x̄ < 69), 9.ª ed.',
      },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: errorTypesInputSchema,
  example: {
    model: 'binomial',
    alternative: 'mayor',
    n: 20,
    p0: 0.25,
    mu0: 68,
    sigma: 3.6,
    regionBy: 'limites',
    alpha: 0.05,
    lower: 67,
    upper: 8,
    trueValue: 0.5,
  },
  solve: solveErrorTypes,
};
