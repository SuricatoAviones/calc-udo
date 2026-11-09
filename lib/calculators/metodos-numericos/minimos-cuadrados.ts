/**
 * Regresión por mínimos cuadrados con un polinomio de grado m (Chapra & Canale, cap. 17):
 *
 *   y = a₀ + a₁x + ⋯ + a_m x^m + e,   minimizando S_r = Σ (y_i − a₀ − a₁x_i − ⋯ − a_m x_i^m)²
 *
 * Ecuaciones normales (ec. 17.19 para m = 2): Σ_k a_k Σ x_i^{j+k} = Σ x_i^j y_i, j = 0, …, m.
 * Con m = 1 se obtienen las fórmulas de la recta (ec. 17.15 y 17.16):
 *   a₁ = (n Σx_iy_i − Σx_i Σy_i) / (n Σx_i² − (Σx_i)²),   a₀ = ȳ − a₁x̄
 * Bondad del ajuste (ec. 17.3, 17.9, 17.10 y 17.20):
 *   S_t = Σ(y_i − ȳ)²,  s_y = √(S_t/(n − 1)),  s_{y/x} = √(S_r/(n − (m + 1))),  r² = (S_t − S_r)/S_t
 */
import { z } from 'zod';
import { formatNumber, powerTex, toLatexNumber, toLatexOperand, TEX } from '@/lib/math/format';
import { solveLinearSystem } from '@/lib/math/linear-algebra';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
  type SummaryItem,
} from '../types';
import { parsePoints, pointsShape, refinePoints } from './differences';
import { texAugmented } from './matrix';
import { polynomialLatex } from './polynomial';

const MAX_LS_POINTS = 200;

export const leastSquaresInputSchema = z
  .object({
    ...pointsShape,
    degree: z
      .number({ error: 'Ingresa el grado del polinomio.' })
      .int('El grado debe ser un número entero.')
      .min(1, 'El grado mínimo es 1 (una recta).')
      .max(6, 'El grado máximo es 6.'),
  })
  .superRefine((v, ctx) => {
    const points = refinePoints(v, ctx, { min: 2, max: MAX_LS_POINTS, distinct: false });
    if (!points) return;
    if (new Set(points.x).size < v.degree + 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['degree'],
        message: `Un polinomio de grado ${v.degree} necesita al menos ${v.degree + 1} valores distintos de x.`,
      });
    }
  });

export type LeastSquaresInput = z.infer<typeof leastSquaresInputSchema>;

export interface LeastSquaresValue {
  /** a₀, a₁, …, a_m. */
  coefficients: number[];
  st: number;
  sr: number;
  /** Error estándar de la estimación s_{y/x}; `null` si n = m + 1. */
  standardError: number | null;
  r2: number | null;
  r: number | null;
}

export type LeastSquaresErrorCode = 'singular';

const n = (v: number) => toLatexNumber(v, 8);
const op = (v: number) => toLatexOperand(v, 8);

/** Σ x^k, para la notación de las ecuaciones normales. */
function sumName(power: number, withY: boolean): string {
  const x = powerTex('x_i', power);
  if (withY) return String.raw`\sum ${x}${x ? TEX.thinSpace : ''}y_i`;
  return power === 0 ? 'n' : String.raw`\sum ${x}`;
}

/** a_k x^k en la ecuación del modelo. */
function modelTerm(k: number): string {
  if (k === 0) return 'a_0';
  return k === 1 ? 'a_1 x' : `a_{${k}} x^{${k}}`;
}

/** Coeficientes: con m = 1 las fórmulas de la recta; si no, la solución del sistema. */
function coefficientsStep(m: number, sumX: number[], sumXY: number[], a: number[]): Step {
  if (m !== 1) {
    return {
      title: 'Resolver el sistema',
      explanation: 'Se resuelve con eliminación de Gauss y pivoteo parcial.',
      result: a.map((v, k) => `a_{${k}} = ${n(v)}`).join(String.raw`,\quad `),
    };
  }
  const [s0, s1, s2] = sumX as [number, number, number];
  const [sy, sxy] = sumXY as [number, number];
  return {
    title: 'Coeficientes de la recta',
    formula: String.raw`a_1 = \frac{n \sum x_i y_i - \sum x_i \sum y_i}{n \sum x_i^2 - \left(\sum x_i\right)^2}, \qquad a_0 = \bar{y} - a_1 \bar{x}`,
    substitution: String.raw`a_1 = \frac{${n(s0)}(${n(sxy)}) - ${op(s1)}${op(sy)}}{${n(s0)}(${n(s2)}) - ${op(s1)}^2}, \qquad a_0 = ${n(sy / s0)} - ${op(a[1]!)}${op(s1 / s0)}`,
    result: String.raw`a_1 = ${n(a[1]!)}, \quad a_0 = ${n(a[0]!)}`,
  };
}

interface Fit {
  m: number;
  count: number;
  mean: number;
  st: number;
  sr: number;
  sy: number | null;
  standardError: number | null;
  r2: number | null;
  r: number | null;
}

/** St, Sr y, cuando están definidos, s_y, s_{y/x} y r². */
function goodnessSteps({ m, count, mean, st, sr, sy, standardError, r2, r }: Fit): Step[] {
  const fittedTex = m === 1 ? 'a_0 - a_1 x_i' : String.raw`\hat{y}_i`;
  const steps: Step[] = [
    {
      title: 'Suma total de cuadrados',
      formula: String.raw`S_t = \sum (y_i - \bar{y})^2`,
      result: String.raw`\bar{y} = ${n(mean)}, \quad S_t = ${n(st)}`,
    },
    {
      title: 'Suma de los cuadrados de los residuos',
      formula: String.raw`S_r = \sum (y_i - ${fittedTex})^2`,
      result: `S_r = ${n(sr)}`,
    },
  ];
  if (sy !== null) {
    steps.push({
      title: 'Desviación estándar',
      formula: String.raw`s_y = \sqrt{\frac{S_t}{n - 1}}`,
      substitution: String.raw`s_y = \sqrt{\frac{${n(st)}}{${count - 1}}}`,
      result: `s_y = ${n(sy)}`,
    });
  }
  if (standardError !== null) {
    steps.push({
      title: 'Error estándar de la estimación',
      formula: String.raw`s_{y/x} = \sqrt{\frac{S_r}{n - (m + 1)}}`,
      substitution: String.raw`s_{y/x} = \sqrt{\frac{${n(sr)}}{${count} - ${m + 1}}}`,
      result: `s_{y/x} = ${n(standardError)}`,
    });
  }
  if (r2 !== null) {
    steps.push({
      title: 'Coeficiente de determinación',
      formula: String.raw`r^2 = \frac{S_t - S_r}{S_t}`,
      substitution: String.raw`r^2 = \frac{${n(st)} - ${op(sr)}}{${n(st)}}`,
      result: String.raw`r^2 = ${n(r2)}, \quad r = ${n(r!)}`,
    });
  }
  return steps;
}

export function solveLeastSquares(
  input: LeastSquaresInput,
): CalculatorResult<LeastSquaresValue, LeastSquaresErrorCode> {
  const { x, y } = parsePoints(input.x, input.y, { max: MAX_LS_POINTS, distinct: false }) as {
    x: number[];
    y: number[];
  };
  const m = input.degree;
  const count = x.length;
  const sumX = Array.from({ length: 2 * m + 1 }, (_, k) => x.reduce((s, xi) => s + xi ** k, 0));
  const sumXY = Array.from({ length: m + 1 }, (_, k) =>
    x.reduce((s, xi, i) => s + xi ** k * y[i]!, 0),
  );
  const A = Array.from({ length: m + 1 }, (_, j) =>
    Array.from({ length: m + 1 }, (_, k) => sumX[j + k]!),
  );

  const steps: Step[] = [
    {
      title: 'Modelo',
      explanation: `${count} datos. Se ajusta un polinomio de grado ${m} minimizando la suma de los cuadrados de los residuos.`,
      formula: `y = ${Array.from({ length: m + 1 }, (_, k) => modelTerm(k)).join(' + ')}`,
    },
    {
      title: 'Sumatorias',
      result: [
        ...sumX.slice(1).map((v, k) => `${sumName(k + 1, false)} = ${n(v)}`),
        ...sumXY.map((v, k) => `${sumName(k, true)} = ${n(v)}`),
      ].join(String.raw`,\quad `),
    },
  ];

  const system = A.map((row, j) => [...row, sumXY[j]!]);
  const normalEquations = A.map((row, j) => {
    const lhs = row.map((_, k) => String.raw`${sumName(j + k, false)}\,a_{${k}}`).join(' + ');
    return `${lhs} &= ${sumName(j, true)}`;
  }).join(TEX.newline);
  steps.push({
    title: 'Ecuaciones normales',
    explanation:
      'Se derivan Sr respecto de cada coeficiente y se igualan a 0. Queda un sistema lineal de m + 1 ecuaciones.',
    formula: String.raw`\begin{aligned} ${normalEquations} \end{aligned}`,
    substitution: texAugmented(system, 1, 8),
  });

  const solution = solveLinearSystem(A, sumXY);
  if (!solution) {
    return {
      ok: false,
      error: {
        code: 'singular',
        message:
          'Las ecuaciones normales no tienen solución única. Revisa que haya suficientes x distintos.',
      },
      ...emptyTrace(),
      steps,
    };
  }
  const a = solution;
  steps.push(coefficientsStep(m, sumX, sumXY, a));

  const predict = (t: number) => a.reduce((s, c, k) => s + c * t ** k, 0);
  const mean = y.reduce((s, v) => s + v, 0) / count;
  const fitted = x.map(predict);
  const st = y.reduce((s, v) => s + (v - mean) ** 2, 0);
  const sr = y.reduce((s, v, i) => s + (v - fitted[i]!) ** 2, 0);
  const dof = count - (m + 1);
  const standardError = dof > 0 ? Math.sqrt(sr / dof) : null;
  const sy = count > 1 ? Math.sqrt(st / (count - 1)) : null;
  const r2 = st === 0 ? null : (st - sr) / st;
  // Con una recta, r tiene el signo de la pendiente.
  const slopeSign = m === 1 && a[1]! < 0 ? -1 : 1;
  const r = r2 === null ? null : Math.sqrt(Math.max(0, r2)) * slopeSign;
  const equation = `y = ${polynomialLatex([...a].reverse(), 'x', 7)}`;

  steps.push(
    {
      title: 'Polinomio ajustado',
      result: equation,
    },
    {
      title: 'Bondad del ajuste',
      explanation:
        'St mide la dispersión de los datos alrededor de la media y Sr la que queda alrededor del ajuste. r² es la fracción de la dispersión que explica el modelo.',
      children: goodnessSteps({ m, count, mean, st, sr, sy, standardError, r2, r }),
    },
  );

  const lo = Math.min(...x);
  const hi = Math.max(...x);
  const pad = 0.05 * (hi - lo || 1);
  const series: Series[] = [
    {
      id: 'ajuste',
      title: 'Datos y polinomio ajustado',
      xLabel: 'x',
      yLabel: 'y',
      label: m === 1 ? 'Recta de mínimos cuadrados' : `Polinomio de grado ${m}`,
      points: Array.from({ length: 121 }, (_, i) => {
        const t = lo - pad + ((hi - lo + 2 * pad) * i) / 120;
        return { x: t, y: predict(t) };
      }),
      scatter: { label: 'Datos', points: x.map((xi, i) => ({ x: xi, y: y[i]! })) },
    },
  ];

  const summary: SummaryItem[] = [
    { label: 'Ajuste', value: equation, emphasis: true },
    ...(r2 === null ? [] : [{ label: 'Coeficiente de determinación', value: `r^2 = ${n(r2)}` }]),
    ...(standardError === null
      ? []
      : [{ label: 'Error estándar de la estimación', value: `s_{y/x} = ${n(standardError)}` }]),
  ];

  return {
    ok: true,
    value: { coefficients: a, st, sr, standardError, r2, r },
    summary,
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'residuos',
        title: 'Datos, ajuste y residuos',
        columns: [
          { key: 'i', header: 'i' },
          { key: 'x', header: 'x_i' },
          { key: 'y', header: 'y_i' },
          { key: 'fit', header: String.raw`\hat{y}_i` },
          { key: 'e', header: String.raw`e_i = y_i - \hat{y}_i` },
          { key: 'e2', header: 'e_i^2' },
          { key: 'dev2', header: String.raw`(y_i - \bar{y})^2` },
        ],
        rows: x.map((xi, i) => ({
          i: i + 1,
          x: xi,
          y: y[i]!,
          fit: fitted[i]!,
          e: y[i]! - fitted[i]!,
          e2: (y[i]! - fitted[i]!) ** 2,
          dev2: (y[i]! - mean) ** 2,
        })),
      },
    ],
    series,
    notices:
      dof === 0
        ? [
            {
              level: 'info',
              message: `Con ${formatNumber(count)} puntos y grado ${m}, el polinomio pasa por todos los datos (es interpolación): Sr = 0.`,
            },
          ]
        : [],
  };
}

export const leastSquares: Calculator<LeastSquaresInput, LeastSquaresValue, LeastSquaresErrorCode> =
  {
    meta: {
      id: 'minimos-cuadrados',
      title: 'Aproximación por mínimos cuadrados',
      summary: 'Ajusta una recta o un polinomio a datos discretos con las ecuaciones normales.',
      citations: [
        {
          sourceId: 'chapra-canale-2000',
          locator:
            'Cap. 17, sec. 17.1, ejemplos 17.1 y 17.2 (regresión lineal) y sec. 17.2, ejemplo 17.5 (regresión polinomial), 5.ª ed. en español',
        },
        { sourceId: 'nakamura-1994' },
        { sourceId: 'smith-1993' },
      ],
    },
    inputSchema: leastSquaresInputSchema,
    example: { x: '1 2 3 4 5 6 7', y: '0.5 2.5 2.0 4.0 3.5 6.0 5.5', degree: 1 },
    solve: solveLeastSquares,
  };
