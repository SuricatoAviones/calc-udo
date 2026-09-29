/**
 * Estimación por máxima verosimilitud (Walpole, Myers, Myers y Ye, sec. 9.14): el estimador θ̂
 * es el valor del parámetro que maximiza la verosimilitud de la muestra,
 *
 *   L(θ) = f(x₁; θ) f(x₂; θ) ⋯ f(xₙ; θ)   (definición 9.3)
 *
 * Se maximiza ln L: se deriva, se iguala a 0, se despeja y se verifica con la segunda derivada.
 * Para cada modelo el despeje tiene forma cerrada:
 *
 *   Bernoulli p̂ = Σx/n · Poisson λ̂ = x̄ (ej. 9.20) · geométrica p̂ = 1/x̄ ·
 *   exponencial β̂ = x̄ (ej. 9.22) · normal μ̂ = x̄, σ̂² = Σ(x − x̄)²/n (ej. 9.21) ·
 *   f(x; θ) = θ/x^{θ+1}, x > 1:  θ̂ = n / Σ ln x (ej. 9.23)
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { lnFactorial } from '../estadistica-1/discrete';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Latex,
  type Notice,
  type Series,
  type Step,
} from '../types';

export const likelihoodModels = [
  'bernoulli',
  'poisson',
  'geometrica',
  'exponencial',
  'normal',
  'pareto',
] as const;
export type LikelihoodModel = (typeof likelihoodModels)[number];

const MAX_VALUES = 1000;

/** Condición que debe cumplir cada dato según el modelo (o `null` si la cumple). */
function checkValue(model: LikelihoodModel, x: number): string | null {
  switch (model) {
    case 'bernoulli':
      return x === 0 || x === 1 ? null : 'En Bernoulli cada dato es 0 (fracaso) o 1 (éxito).';
    case 'poisson':
      return Number.isInteger(x) && x >= 0 ? null : 'En Poisson los datos son conteos: 0, 1, 2, …';
    case 'geometrica':
      return Number.isInteger(x) && x >= 1
        ? null
        : 'En la geométrica cada dato es el número del ensayo del primer éxito: 1, 2, 3, …';
    case 'exponencial':
      return x > 0 ? null : 'En la exponencial los datos son tiempos positivos.';
    case 'normal':
      return null;
    case 'pareto':
      return x > 1 ? null : 'En este modelo los datos deben ser mayores que 1.';
  }
}

export const likelihoodInputSchema = z
  .object({
    model: z.enum(likelihoodModels, { error: 'Elige la distribución.' }),
    data: z.string(),
  })
  .superRefine((v, ctx) => {
    const { values, invalid } = parseDataList(v.data);
    if (invalid.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message: `No son números: ${invalid.slice(0, 3).join(', ')}.`,
      });
      return;
    }
    if (values.length < (v.model === 'normal' ? 2 : 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message: v.model === 'normal' ? 'Ingresa al menos 2 datos.' : 'Ingresa al menos 1 dato.',
      });
      return;
    }
    if (values.length > MAX_VALUES) {
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message: `El máximo es ${MAX_VALUES} datos.`,
      });
      return;
    }
    const problem = values.map((x) => checkValue(v.model, x)).find((m) => m !== null);
    if (problem) ctx.addIssue({ code: 'custom', path: ['data'], message: problem });
  });

export type LikelihoodInput = z.infer<typeof likelihoodInputSchema>;

export interface LikelihoodValue {
  /** Parámetros estimados, en el orden del modelo (p, λ, β, μ y σ², θ…). */
  estimates: { symbol: string; value: number }[];
  /** ln L en el estimador (puede ser −∞ en un extremo). */
  logLikelihood: number;
}

export type LikelihoodErrorCode = 'invalid-data' | 'degenerate';

type Result = CalculatorResult<LikelihoodValue, LikelihoodErrorCode>;

const n = toLatexNumber;

interface Derivation {
  symbol: Latex;
  density: Latex;
  likelihood: Latex;
  logLikelihood: Latex;
  /** ln L con los números de la muestra. */
  logSubstitution: Latex;
  derivative: Latex;
  solve: Latex;
  estimate: number;
  /** Segunda derivada en el estimador (negativa si es máximo). */
  secondDerivative: Latex;
  secondValue: number;
  /** ln L como función del parámetro (para la gráfica). */
  logL(theta: number): number;
  /** Rango del parámetro para graficar ln L. */
  plotRange: [number, number];
  /** Nombre del parámetro en el eje x. */
  axis: string;
}

function derive(model: Exclude<LikelihoodModel, 'normal'>, values: number[]): Derivation {
  const size = values.length;
  const sum = values.reduce((s, x) => s + x, 0);
  const mean = sum / size;
  switch (model) {
    case 'bernoulli': {
      const p = sum / size;
      const logL = (t: number) =>
        (sum === 0 ? 0 : sum * Math.log(t)) +
        (size - sum === 0 ? 0 : (size - sum) * Math.log(1 - t));
      return {
        symbol: 'p',
        density: 'f(x;\\ p) = p^x (1 - p)^{1 - x}, \\quad x = 0, 1',
        likelihood:
          'L(p) = \\prod p^{x_i}(1 - p)^{1 - x_i} = p^{\\sum x_i}(1 - p)^{\\,n - \\sum x_i}',
        logLikelihood:
          '\\ln L(p) = \\left(\\sum x_i\\right)\\ln p + \\left(n - \\sum x_i\\right)\\ln(1 - p)',
        logSubstitution: `\\ln L(p) = ${n(sum)}\\ln p + ${n(size - sum)}\\ln(1 - p)`,
        derivative: '\\frac{d\\ln L}{dp} = \\frac{\\sum x_i}{p} - \\frac{n - \\sum x_i}{1 - p} = 0',
        solve: `\\hat{p} = \\frac{\\sum x_i}{n} = \\frac{${n(sum)}}{${size}}`,
        estimate: p,
        secondDerivative:
          '\\frac{d^2\\ln L}{dp^2} = -\\frac{\\sum x_i}{p^2} - \\frac{n - \\sum x_i}{(1 - p)^2}',
        secondValue: -sum / p ** 2 - (size - sum) / (1 - p) ** 2,
        logL,
        plotRange: [0.005, 0.995],
        axis: 'p',
      };
    }
    case 'poisson': {
      const lnFactorials = values.reduce((s, x) => s + lnFactorial(x), 0);
      return {
        symbol: '\\lambda',
        density:
          'f(x;\\ \\lambda) = \\frac{e^{-\\lambda}\\lambda^x}{x!}, \\quad x = 0, 1, 2, \\ldots',
        likelihood:
          'L(\\lambda) = \\prod \\frac{e^{-\\lambda}\\lambda^{x_i}}{x_i!} = \\frac{e^{-n\\lambda}\\lambda^{\\sum x_i}}{\\prod x_i!}',
        logLikelihood:
          '\\ln L(\\lambda) = -n\\lambda + \\left(\\sum x_i\\right)\\ln\\lambda - \\sum \\ln x_i!',
        logSubstitution: `\\ln L(\\lambda) = -${size}\\lambda + ${n(sum)}\\ln\\lambda - ${n(lnFactorials, 6)}`,
        derivative: '\\frac{d\\ln L}{d\\lambda} = -n + \\frac{\\sum x_i}{\\lambda} = 0',
        solve: `\\hat{\\lambda} = \\frac{\\sum x_i}{n} = \\bar{x} = \\frac{${n(sum)}}{${size}}`,
        estimate: mean,
        secondDerivative: '\\frac{d^2\\ln L}{d\\lambda^2} = -\\frac{\\sum x_i}{\\lambda^2}',
        secondValue: -sum / mean ** 2,
        logL: (t) => -size * t + (sum === 0 ? 0 : sum * Math.log(t)) - lnFactorials,
        plotRange: [Math.max(mean / 4, 1e-3), Math.max(mean * 2.5, 1)],
        axis: 'λ',
      };
    }
    case 'geometrica': {
      const p = size / sum;
      return {
        symbol: 'p',
        density: 'f(x;\\ p) = p(1 - p)^{x - 1}, \\quad x = 1, 2, \\ldots',
        likelihood: 'L(p) = \\prod p(1 - p)^{x_i - 1} = p^n (1 - p)^{\\sum x_i - n}',
        logLikelihood: '\\ln L(p) = n\\ln p + \\left(\\sum x_i - n\\right)\\ln(1 - p)',
        logSubstitution: `\\ln L(p) = ${size}\\ln p + ${n(sum - size)}\\ln(1 - p)`,
        derivative: '\\frac{d\\ln L}{dp} = \\frac{n}{p} - \\frac{\\sum x_i - n}{1 - p} = 0',
        solve: `\\hat{p} = \\frac{n}{\\sum x_i} = \\frac{1}{\\bar{x}} = \\frac{${size}}{${n(sum)}}`,
        estimate: p,
        secondDerivative:
          '\\frac{d^2\\ln L}{dp^2} = -\\frac{n}{p^2} - \\frac{\\sum x_i - n}{(1 - p)^2}',
        secondValue: -size / p ** 2 - (sum - size) / (1 - p) ** 2,
        logL: (t) => size * Math.log(t) + (sum - size === 0 ? 0 : (sum - size) * Math.log(1 - t)),
        plotRange: [0.005, 0.995],
        axis: 'p',
      };
    }
    case 'exponencial':
      return {
        symbol: '\\beta',
        density: 'f(x;\\ \\beta) = \\frac{1}{\\beta} e^{-x/\\beta}, \\quad x > 0',
        likelihood:
          'L(\\beta) = \\prod \\frac{1}{\\beta} e^{-x_i/\\beta} = \\beta^{-n} e^{-\\sum x_i / \\beta}',
        logLikelihood: '\\ln L(\\beta) = -n\\ln\\beta - \\frac{\\sum x_i}{\\beta}',
        logSubstitution: `\\ln L(\\beta) = -${size}\\ln\\beta - \\frac{${n(sum)}}{\\beta}`,
        derivative:
          '\\frac{d\\ln L}{d\\beta} = -\\frac{n}{\\beta} + \\frac{\\sum x_i}{\\beta^2} = 0',
        solve: `\\hat{\\beta} = \\frac{\\sum x_i}{n} = \\bar{x} = \\frac{${n(sum)}}{${size}}`,
        estimate: mean,
        secondDerivative:
          '\\frac{d^2\\ln L}{d\\beta^2} = \\frac{n}{\\beta^2} - \\frac{2\\sum x_i}{\\beta^3}',
        secondValue: size / mean ** 2 - (2 * sum) / mean ** 3,
        logL: (t) => -size * Math.log(t) - sum / t,
        plotRange: [mean / 4, mean * 3],
        axis: 'β',
      };
    case 'pareto': {
      const sumLog = values.reduce((s, x) => s + Math.log(x), 0);
      const theta = size / sumLog;
      return {
        symbol: '\\theta',
        density: 'f(x;\\ \\theta) = \\frac{\\theta}{x^{\\theta + 1}}, \\quad x > 1',
        likelihood:
          'L(\\theta) = \\prod \\frac{\\theta}{x_i^{\\theta + 1}} = \\frac{\\theta^n}{\\left(\\prod x_i\\right)^{\\theta + 1}}',
        logLikelihood: '\\ln L(\\theta) = n\\ln\\theta - (\\theta + 1)\\sum \\ln x_i',
        logSubstitution: `\\ln L(\\theta) = ${size}\\ln\\theta - (\\theta + 1)(${n(sumLog, 8)})`,
        derivative: '\\frac{d\\ln L}{d\\theta} = \\frac{n}{\\theta} - \\sum \\ln x_i = 0',
        solve: `\\hat{\\theta} = \\frac{n}{\\sum \\ln x_i} = \\frac{${size}}{${n(sumLog, 8)}}`,
        estimate: theta,
        secondDerivative: '\\frac{d^2\\ln L}{d\\theta^2} = -\\frac{n}{\\theta^2}',
        secondValue: -size / theta ** 2,
        logL: (t) => size * Math.log(t) - (t + 1) * sumLog,
        plotRange: [theta / 4, theta * 3],
        axis: 'θ',
      };
    }
  }
}

const MODEL_NAME: Record<LikelihoodModel, string> = {
  bernoulli: 'Bernoulli',
  poisson: 'Poisson',
  geometrica: 'geométrica',
  exponencial: 'exponencial',
  normal: 'normal',
  pareto: 'f(x; θ) = θ/x^(θ+1), x > 1',
};

function curve(logL: (t: number) => number, [from, to]: [number, number]) {
  return Array.from({ length: 121 }, (_, k) => {
    const t = from + ((to - from) * k) / 120;
    return { x: t, y: logL(t) };
  });
}

function solveNormalModel(values: number[]): Result {
  const size = values.length;
  const sum = values.reduce((s, x) => s + x, 0);
  const mean = sum / size;
  const squares = values.reduce((s, x) => s + (x - mean) ** 2, 0);
  const variance = squares / size;
  if (variance === 0) {
    return {
      ok: false,
      error: {
        code: 'degenerate',
        message: 'Todos los datos son iguales: σ̂² = 0 y la verosimilitud normal no tiene máximo.',
      },
      ...emptyTrace(),
    };
  }
  const logL = (mu: number, s2: number) =>
    (-size / 2) * Math.log(2 * Math.PI * s2) -
    values.reduce((s, x) => s + (x - mu) ** 2, 0) / (2 * s2);
  const steps: Step[] = [
    {
      title: 'Función de verosimilitud',
      explanation: `La muestra tiene n = ${size} datos independientes de una normal N(μ, σ²): la verosimilitud es el producto de las densidades.`,
      formula:
        'L(\\mu, \\sigma^2) = \\prod \\frac{1}{\\sqrt{2\\pi\\sigma^2}} e^{-(x_i - \\mu)^2/(2\\sigma^2)} = (2\\pi\\sigma^2)^{-n/2} e^{-\\sum (x_i - \\mu)^2 / (2\\sigma^2)}',
    },
    {
      title: 'Logaritmo de la verosimilitud',
      explanation: 'Maximizar ln L es lo mismo que maximizar L, y los productos se vuelven sumas.',
      formula:
        '\\ln L = -\\frac{n}{2}\\ln(2\\pi) - \\frac{n}{2}\\ln\\sigma^2 - \\frac{\\sum (x_i - \\mu)^2}{2\\sigma^2}',
    },
    {
      title: 'Derivadas parciales iguales a cero',
      formula:
        '\\frac{\\partial \\ln L}{\\partial \\mu} = \\frac{\\sum (x_i - \\mu)}{\\sigma^2} = 0, \\qquad \\frac{\\partial \\ln L}{\\partial \\sigma^2} = -\\frac{n}{2\\sigma^2} + \\frac{\\sum (x_i - \\mu)^2}{2\\sigma^4} = 0',
    },
    {
      title: 'Despejar μ',
      explanation: 'De la primera ecuación, Σxᵢ − nμ = 0.',
      formula: '\\hat{\\mu} = \\frac{\\sum x_i}{n} = \\bar{x}',
      substitution: `\\hat{\\mu} = \\frac{${n(sum)}}{${size}}`,
      result: `\\hat{\\mu} = ${n(mean)}`,
    },
    {
      title: 'Despejar σ²',
      explanation:
        'De la segunda ecuación con μ = x̄. Se divide entre n, no entre n − 1: el estimador de máxima verosimilitud de σ² no es el insesgado s².',
      formula: '\\hat{\\sigma}^2 = \\frac{\\sum (x_i - \\bar{x})^2}{n}',
      substitution: `\\hat{\\sigma}^2 = \\frac{${n(squares)}}{${size}}`,
      result: `\\hat{\\sigma}^2 = ${n(variance)}, \\qquad \\hat{\\sigma} = ${n(Math.sqrt(variance))}`,
    },
    {
      title: 'Verificar que es un máximo',
      explanation:
        'En (x̄, σ̂²) la matriz de segundas derivadas es diagonal con entradas negativas, −n/σ̂² y −n/(2σ̂⁴): es un máximo.',
      result: `-\\frac{n}{\\hat{\\sigma}^2} = ${n(-size / variance)}, \\qquad -\\frac{n}{2\\hat{\\sigma}^4} = ${n(-size / (2 * variance ** 2))}`,
    },
  ];
  const sd = Math.sqrt(variance);
  const series: Series[] = [
    {
      id: 'verosimilitud',
      title: 'ln L en función de μ (con σ² = σ̂²)',
      xLabel: 'μ',
      yLabel: 'ln L',
      points: curve((mu) => logL(mu, variance), [mean - 3 * sd, mean + 3 * sd]),
    },
  ];
  return {
    ok: true,
    value: {
      estimates: [
        { symbol: 'μ', value: mean },
        { symbol: 'σ²', value: variance },
      ],
      logLikelihood: logL(mean, variance),
    },
    summary: [
      { label: 'Media', value: `\\hat{\\mu} = ${n(mean, 6)}`, emphasis: true },
      { label: 'Varianza', value: `\\hat{\\sigma}^2 = ${n(variance, 6)}`, emphasis: true },
      { label: 'Desviación estándar', value: `\\hat{\\sigma} = ${n(sd, 6)}` },
      { label: 'Datos', value: `n = ${size}` },
    ],
    ...emptyTrace(),
    steps,
    series,
  };
}

export function solveLikelihood(input: LikelihoodInput): Result {
  const { values, invalid } = parseDataList(input.data);
  const model = input.model;
  const problem = values.map((x) => checkValue(model, x)).find((m) => m !== null);
  if (invalid.length > 0 || values.length === 0 || problem) {
    return {
      ok: false,
      error: { code: 'invalid-data', message: problem ?? 'Ingresa datos numéricos.' },
      ...emptyTrace(),
    };
  }
  if (model === 'normal') return solveNormalModel(values);

  const size = values.length;
  const d = derive(model, values);
  const notices: Notice[] = [];
  const atBoundary =
    (model === 'bernoulli' && (d.estimate === 0 || d.estimate === 1)) ||
    (model === 'poisson' && d.estimate === 0) ||
    (model === 'geometrica' && d.estimate === 1);
  if (atBoundary) {
    notices.push({
      level: 'info',
      message: `El estimador queda en el borde del espacio de parámetros (${formatNumber(d.estimate)}): ln L es monótona y el máximo está en el extremo, no donde la derivada vale 0.`,
    });
  }

  const steps: Step[] = [
    {
      title: 'Función de verosimilitud',
      explanation: `La muestra tiene n = ${size} datos independientes de una distribución ${MODEL_NAME[model]}: la verosimilitud es el producto de f(xᵢ) evaluada en cada dato, vista como función del parámetro.`,
      formula: `${d.density} \\qquad ${d.likelihood}`,
    },
    {
      title: 'Logaritmo de la verosimilitud',
      explanation: 'Maximizar ln L es lo mismo que maximizar L, y los productos se vuelven sumas.',
      formula: d.logLikelihood,
      substitution: d.logSubstitution,
    },
    {
      title: 'Derivar e igualar a cero',
      formula: d.derivative,
    },
    {
      title: 'Despejar el parámetro',
      substitution: d.solve,
      result: `\\hat{${d.symbol}} = ${n(d.estimate)}`,
    },
    {
      title: 'Verificar que es un máximo',
      explanation: atBoundary
        ? 'En el borde la segunda derivada no se usa: ln L crece hacia el extremo.'
        : 'Si la segunda derivada es negativa en el estimador, ln L tiene ahí un máximo.',
      formula: d.secondDerivative,
      result: atBoundary
        ? undefined
        : `\\left.\\frac{d^2\\ln L}{d${d.symbol}^2}\\right|_{\\hat{${d.symbol}}} = ${n(d.secondValue)} < 0`,
    },
  ];
  if (model === 'exponencial') {
    steps.push({
      title: 'Tasa equivalente',
      explanation:
        'Por la invariancia de los estimadores de máxima verosimilitud, el de la tasa λ = 1/β es 1/β̂.',
      result: `\\hat{\\lambda} = \\frac{1}{\\hat{\\beta}} = ${n(1 / d.estimate)}`,
    });
  }

  const estimateSymbol = d.symbol.replace('\\', '');
  const plain: Record<string, string> = { lambda: 'λ', beta: 'β', theta: 'θ', p: 'p' };
  return {
    ok: true,
    value: {
      estimates: [{ symbol: plain[estimateSymbol] ?? estimateSymbol, value: d.estimate }],
      logLikelihood: d.logL(d.estimate),
    },
    summary: [
      { label: 'Estimador', value: `\\hat{${d.symbol}} = ${n(d.estimate, 6)}`, emphasis: true },
      {
        label: 'Log-verosimilitud',
        value: `\\ln L(\\hat{${d.symbol}}) = ${n(d.logL(d.estimate), 6)}`,
      },
      { label: 'Datos', value: `n = ${size}` },
    ],
    ...emptyTrace(),
    steps,
    notices,
    series: [
      {
        id: 'verosimilitud',
        title: `ln L en función de ${d.axis}`,
        xLabel: d.axis,
        yLabel: 'ln L',
        points: curve(d.logL, d.plotRange).filter((p) => Number.isFinite(p.y)),
      },
    ],
  };
}

export const maximumLikelihood: Calculator<LikelihoodInput, LikelihoodValue, LikelihoodErrorCode> =
  {
    meta: {
      id: 'maxima-verosimilitud',
      title: 'Estimación por máxima verosimilitud',
      summary:
        'Estima el parámetro de una distribución maximizando la verosimilitud de la muestra.',
      citations: [
        {
          sourceId: 'walpole-1998',
          locator: 'Sec. 9.14, definición 9.3, Ejemplos 9.20 a 9.23 (9.ª ed. en español)',
        },
        { sourceId: 'meyer-1998' },
        { sourceId: 'johnson-1997' },
      ],
    },
    inputSchema: likelihoodInputSchema,
    // Walpole, ejemplo 9.22: tiempos de supervivencia (meses) de 10 ratas, modelo exponencial.
    example: { model: 'exponencial', data: '14 17 27 18 12 8 22 13 19 12' },
    solve: solveLikelihood,
  };
