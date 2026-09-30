/**
 * Errores de redondeo y de truncamiento (Chapra & Canale, cap. 3 y 4):
 *
 *   Error verdadero                E_t = valor verdadero − aproximación          (ec. 3.2)
 *   Error relativo porcentual      ε_t = E_t / valor verdadero × 100 %           (ec. 3.3)
 *   Error aproximado               ε_a = (actual − anterior) / actual × 100 %    (ec. 3.5)
 *   Tolerancia para n cifras       ε_s = (0.5 × 10^{2−n}) %                      (ec. 3.7)
 *
 * Tres usos:
 * - Comparar una aproximación con el valor verdadero (ejemplo 3.1).
 * - Cortar o redondear un número a k cifras significativas (sec. 3.4.1): el error de redondeo.
 * - Aproximar f con la serie de Taylor alrededor de xᵢ, orden por orden (ejemplos 3.2, 4.1 y
 *   4.2): el error de truncamiento es lo que falta de la serie.
 *     f(x) ≈ f(xᵢ) + f'(xᵢ)h + f''(xᵢ)h²/2! + ⋯ + f⁽ⁿ⁾(xᵢ)hⁿ/n!,   h = x − xᵢ
 */
import { derivative, type MathNode } from 'mathjs';
import { z } from 'zod';
import { scarboroughTolerance } from '@/lib/math/error-metrics';
import { parseFunction } from '@/lib/math/expression';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
  type SummaryItem,
} from '../types';
import { finiteNumber } from './root-finding';

export const errorModes = ['aproximacion', 'redondeo', 'taylor'] as const;
export type ErrorMode = (typeof errorModes)[number];

const MAX_ORDER = 12;

const digitsField = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .int(`${label} debe ser un número entero.`)
    .min(1, `${label} debe ser al menos 1.`)
    .max(15, `${label} no puede pasar de 15.`);

export const numericErrorsInputSchema = z
  .object({
    mode: z.enum(errorModes, { error: 'Elige qué quieres calcular.' }),
    trueValue: finiteNumber('el valor verdadero').optional(),
    approximation: finiteNumber('la aproximación').optional(),
    significantFigures: digitsField('el número de cifras significativas').optional(),
    value: finiteNumber('el número').optional(),
    digits: digitsField('el número de cifras').optional(),
    expression: z.string().trim().max(200, 'La expresión es demasiado larga.').optional(),
    xi: finiteNumber('xᵢ').optional(),
    x: finiteNumber('x').optional(),
    order: z
      .number({ error: 'Ingresa el orden.' })
      .int('El orden debe ser un número entero.')
      .min(0, 'El orden no puede ser negativo.')
      .max(MAX_ORDER, `El orden máximo es ${MAX_ORDER}.`)
      .optional(),
  })
  .superRefine((v, ctx) => {
    const require = (key: keyof typeof v, message: string) => {
      if (v[key] === undefined || v[key] === '')
        ctx.addIssue({ code: 'custom', path: [key], message });
    };
    if (v.mode === 'aproximacion') {
      require('trueValue', 'Ingresa el valor verdadero.');
      require('approximation', 'Ingresa la aproximación.');
    } else if (v.mode === 'redondeo') {
      require('value', 'Ingresa el número.');
      require('digits', 'Ingresa cuántas cifras significativas conservar.');
    } else {
      require('expression', 'Escribe la función f(x).');
      require('xi', 'Ingresa el punto de expansión xᵢ.');
      require('x', 'Ingresa el punto x donde se aproxima f.');
      require('order', 'Ingresa el orden máximo.');
    }
  });

export type NumericErrorsInput = z.infer<typeof numericErrorsInputSchema>;

export interface NumericErrorsValue {
  /** Aproximación principal (la última de la serie, o el valor redondeado). */
  approximation: number;
  trueValue: number;
  trueError: number;
  /** ε_t (%), `null` si el valor verdadero es 0. */
  trueRelativeError: number | null;
  /** Solo en el modo de redondeo. */
  chopped?: number;
  rounded?: number;
  /** Solo en el modo de Taylor: aproximación de cada orden. */
  approximations?: number[];
}

export type NumericErrorsErrorCode = 'invalid-expression' | 'non-finite';

type Result = CalculatorResult<NumericErrorsValue, NumericErrorsErrorCode>;

const n = toLatexNumber;
const op = toLatexOperand;

function relative(trueValue: number, error: number): number | null {
  return trueValue === 0 ? null : (error / trueValue) * 100;
}

/** Cifras significativas correctas según el criterio de Scarborough: |ε| < 0.5 × 10^{2−n} %. */
export function correctSignificantFigures(percentError: number): number {
  const abs = Math.abs(percentError);
  if (abs === 0) return Infinity;
  return Math.max(0, Math.floor(2 - Math.log10(abs / 0.5) - 1e-12));
}

function errorSteps(
  trueValue: number,
  approx: number,
  approxLabel = '\\text{aproximación}',
): Step[] {
  const et = trueValue - approx;
  const rel = relative(trueValue, et);
  const steps: Step[] = [
    {
      title: 'Error verdadero',
      explanation: 'Diferencia entre el valor verdadero y la aproximación (con signo).',
      formula: `E_t = \\text{valor verdadero} - ${approxLabel}`,
      substitution: `E_t = ${n(trueValue)} - ${op(approx)}`,
      result: `E_t = ${n(et)}`,
    },
  ];
  steps.push(
    rel === null
      ? {
          title: 'Error relativo porcentual',
          explanation: 'No está definido porque el valor verdadero es 0.',
        }
      : {
          title: 'Error relativo porcentual',
          explanation:
            'El error verdadero comparado con la magnitud del valor: permite comparar errores de cantidades de distinto tamaño.',
          formula: '\\varepsilon_t = \\frac{E_t}{\\text{valor verdadero}} \\times 100\\%',
          substitution: `\\varepsilon_t = \\frac{${n(et)}}{${n(trueValue)}} \\times 100\\%`,
          result: `\\varepsilon_t = ${n(rel)}\\,\\%`,
        },
  );
  return steps;
}

// ─── Aproximación contra valor verdadero ────────────────────────────────────

function solveApproximation(input: NumericErrorsInput): Result {
  const trueValue = input.trueValue!;
  const approx = input.approximation!;
  const steps = errorSteps(trueValue, approx);
  const et = trueValue - approx;
  const rel = relative(trueValue, et);
  const summary: SummaryItem[] = [
    { label: 'Error verdadero', value: `E_t = ${n(et)}`, emphasis: true },
    {
      label: 'Error relativo porcentual',
      value: rel === null ? '\\text{no definido}' : `\\varepsilon_t = ${n(rel)}\\,\\%`,
      emphasis: true,
    },
  ];
  if (rel !== null) {
    const figures = correctSignificantFigures(rel);
    if (Number.isFinite(figures)) {
      summary.push({ label: 'Cifras significativas correctas', value: String(figures) });
    }
    if (input.significantFigures !== undefined) {
      const s = input.significantFigures;
      const es = scarboroughTolerance(s);
      const meets = Math.abs(rel) < es;
      steps.push({
        title: `¿Tiene ${s} cifras significativas correctas?`,
        explanation: meets
          ? `|εt| es menor que la tolerancia de Scarborough: la aproximación es correcta en al menos ${s} cifras significativas.`
          : `|εt| no es menor que la tolerancia de Scarborough: la aproximación no garantiza ${s} cifras significativas.`,
        formula: '\\varepsilon_s = (0.5 \\times 10^{2-n})\\,\\%',
        substitution: `\\varepsilon_s = (0.5 \\times 10^{2-${s}})\\,\\% = ${n(es)}\\,\\%`,
        result: `|\\varepsilon_t| = ${n(Math.abs(rel))}\\,\\% ${meets ? '<' : '\\geq'} ${n(es)}\\,\\%`,
      });
    }
  }
  return {
    ok: true,
    value: { approximation: approx, trueValue, trueError: et, trueRelativeError: rel },
    summary,
    ...emptyTrace(),
    steps,
  };
}

// ─── Corte y redondeo ───────────────────────────────────────────────────────

/**
 * Corta (`chop`) o redondea (`round`, la mitad se aleja de 0) un número a `digits` cifras
 * significativas, operando sobre su representación decimal para no arrastrar el error binario.
 */
export function toSignificant(value: number, digits: number, mode: 'chop' | 'round'): number {
  if (value === 0) return 0;
  // |value| = d.ddd… × 10^exponent = (cifras como entero) × 10^(exponent − cifras + 1)
  const [mantissa = '0', exp = '0'] = Math.abs(value).toExponential().split('e');
  const allDigits = mantissa.replace('.', '');
  const exponent = Number(exp);
  let kept = BigInt(allDigits.slice(0, digits).padEnd(digits, '0'));
  if (mode === 'round' && Number(allDigits[digits] ?? '0') >= 5) kept += 1n;
  // Si el redondeo lleva (9.99 → 10.0), `kept` tiene una cifra más pero la escala es la misma.
  return Math.sign(value) * Number(`${kept}e${exponent - digits + 1}`);
}

function solveRounding(input: NumericErrorsInput): Result {
  const value = input.value!;
  const k = input.digits!;
  const chopped = toSignificant(value, k, 'chop');
  const rounded = toSignificant(value, k, 'round');
  const choppedSteps = errorSteps(value, chopped, '\\text{valor cortado}');
  const roundedSteps = errorSteps(value, rounded, '\\text{valor redondeado}');
  const etChop = value - chopped;
  const etRound = value - rounded;
  const steps: Step[] = [
    {
      title: `Cortar a ${k} cifras significativas`,
      explanation:
        'Se conservan las primeras cifras y se descartan las demás, sin mirarlas (en inglés, "chopping"; originalmente se le llamó truncamiento).',
      result: `${n(value, 15)} \\;\\to\\; ${n(chopped, 15)}`,
      children: choppedSteps,
    },
    {
      title: `Redondear a ${k} cifras significativas`,
      explanation:
        'Si la primera cifra descartada es 5 o más, la última cifra conservada aumenta en 1.',
      result: `${n(value, 15)} \\;\\to\\; ${n(rounded, 15)}`,
      children: roundedSteps,
    },
    {
      title: 'Comparación',
      explanation:
        Math.abs(etRound) <= Math.abs(etChop)
          ? 'El redondeo da un error de magnitud menor o igual que el corte: el error de corte puede llegar a una unidad de la última cifra conservada, el de redondeo a media unidad.'
          : 'En este caso el corte dio un error menor.',
      result: `|E_t^{\\text{corte}}| = ${n(Math.abs(etChop))}, \\quad |E_t^{\\text{redondeo}}| = ${n(Math.abs(etRound))}`,
    },
  ];
  return {
    ok: true,
    value: {
      approximation: rounded,
      trueValue: value,
      trueError: etRound,
      trueRelativeError: relative(value, etRound),
      chopped,
      rounded,
    },
    summary: [
      {
        label: `Cortado a ${k} cifras`,
        value: `${n(chopped, 15)} \\quad (E_t = ${n(etChop)})`,
        emphasis: true,
      },
      {
        label: `Redondeado a ${k} cifras`,
        value: `${n(rounded, 15)} \\quad (E_t = ${n(etRound)})`,
        emphasis: true,
      },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'redondeo',
        title: 'Corte y redondeo',
        columns: [
          { key: 'method', header: '\\text{Método}', format: 'text' },
          { key: 'value', header: '\\text{Valor}' },
          { key: 'et', header: 'E_t' },
          { key: 'rel', header: '\\varepsilon_t\\,(\\%)' },
        ],
        rows: [
          { method: 'Corte', value: chopped, et: etChop, rel: relative(value, etChop) },
          { method: 'Redondeo', value: rounded, et: etRound, rel: relative(value, etRound) },
        ],
      },
    ],
  };
}

// ─── Serie de Taylor ────────────────────────────────────────────────────────

const FACTORIALS = Array.from({ length: MAX_ORDER + 1 }, (_, k) =>
  Array.from({ length: k }, (_, i) => i + 1).reduce((p, v) => p * v, 1),
);

function derivativeName(k: number): string {
  if (k === 0) return 'f(x_i)';
  if (k <= 3) return `f${"'".repeat(k)}(x_i)`;
  return `f^{(${k})}(x_i)`;
}

function solveTaylor(input: NumericErrorsInput): Result {
  const parsed = parseFunction(input.expression ?? '');
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: parsed.message },
      ...emptyTrace(),
    };
  }
  const f = parsed.expr;
  const xi = input.xi!;
  const x = input.x!;
  const order = input.order!;
  const h = x - xi;
  const trueValue = f.evaluate(x);
  const es = input.significantFigures ? scarboroughTolerance(input.significantFigures) : null;

  const steps: Step[] = [
    {
      title: 'Serie de Taylor',
      explanation: `Se aproxima f en x = ${formatNumber(x)} a partir de su valor y sus derivadas en xᵢ = ${formatNumber(xi)}. Cada orden agrega un término; lo que falta de la serie es el error de truncamiento.`,
      formula: `f(x) \\approx f(x_i) + f'(x_i)\\,h + \\frac{f''(x_i)}{2!}h^2 + \\cdots + \\frac{f^{(n)}(x_i)}{n!}h^n`,
      substitution: `f(x) = ${f.tex}, \\quad h = x - x_i = ${n(x)} - ${op(xi)} = ${n(h)}`,
      result: Number.isFinite(trueValue)
        ? `\\text{Valor verdadero: } f(${n(x)}) = ${n(trueValue)}`
        : undefined,
    },
  ];
  if (!Number.isFinite(trueValue)) {
    return {
      ok: false,
      error: {
        code: 'non-finite',
        message: `f(x) no tiene un valor real finito en x = ${formatNumber(x)}.`,
      },
      ...emptyTrace(),
      steps,
    };
  }

  let node: MathNode = f.node;
  let approx = 0;
  let previous: number | null = null;
  const rows: Record<string, number | string | null>[] = [];
  const approximations: number[] = [];
  const polynomial: { coefficient: number; k: number }[] = [];
  let stoppedAt: number | null = null;

  for (let k = 0; k <= order; k++) {
    if (k > 0) {
      try {
        node = derivative(node, 'x');
      } catch {
        return {
          ok: false,
          error: {
            code: 'invalid-expression',
            message: 'No se pudo derivar la función simbólicamente.',
          },
          ...emptyTrace(),
          steps,
        };
      }
    }
    let dk: number;
    try {
      const value: unknown = node.evaluate({ x: xi });
      dk = typeof value === 'number' ? value : Number.NaN;
    } catch {
      dk = Number.NaN;
    }
    if (!Number.isFinite(dk)) {
      steps.push({
        title: `Orden ${k}`,
        explanation: `La derivada de orden ${k} no tiene un valor real finito en xᵢ = ${formatNumber(xi)}.`,
      });
      return {
        ok: false,
        error: {
          code: 'non-finite',
          message: `La derivada de orden ${k} de f no está definida en xᵢ = ${formatNumber(xi)}.`,
        },
        ...emptyTrace(),
        steps,
      };
    }
    const coefficient = dk / FACTORIALS[k]!;
    const term = coefficient * h ** k;
    approx += term;
    polynomial.push({ coefficient, k });
    approximations.push(approx);
    const et = trueValue - approx;
    const rel = relative(trueValue, et);
    const ea = previous === null || approx === 0 ? null : ((approx - previous) / approx) * 100;
    rows.push({ order: k, derivative: dk, term, approx, et, rel, ea });

    const derivativeTex = k === 0 ? f.tex : node.toTex({ implicit: 'show' });
    const children: Step[] = [
      {
        title: k === 0 ? 'Valor de f en xᵢ' : `Derivada de orden ${k}`,
        formula: `${k === 0 ? 'f(x)' : k <= 3 ? `f${"'".repeat(k)}(x)` : `f^{(${k})}(x)`} = ${derivativeTex}`,
        result: `${derivativeName(k)} = ${n(dk)}`,
      },
      {
        title: 'Término y aproximación',
        formula:
          k === 0
            ? 'f(x) \\approx f(x_i)'
            : `\\text{término} = \\frac{${derivativeName(k)}}{${k}!}\\,h^{${k}}`,
        substitution:
          k === 0
            ? undefined
            : `\\frac{${n(dk)}}{${FACTORIALS[k]}}\\,(${n(h)})^{${k}} = ${n(term)}`,
        result: `f(${n(x)}) \\approx ${n(approx)}`,
      },
      {
        title: 'Error de truncamiento',
        explanation:
          rel === null
            ? 'El valor verdadero es 0: solo se reporta el error verdadero.'
            : 'Lo que falta para llegar al valor verdadero: los términos de la serie que no se incluyeron.',
        formula: 'E_t = \\text{valor verdadero} - \\text{aproximación}',
        result: `E_t = ${n(et)}${rel === null ? '' : `, \\quad \\varepsilon_t = ${n(rel, 4)}\\,\\%`}${ea === null ? '' : `, \\quad \\varepsilon_a = ${n(ea, 4)}\\,\\%`}`,
      },
    ];
    steps.push({ title: `Aproximación de orden ${k}`, children });
    if (es !== null && ea !== null && Math.abs(ea) < es) {
      stoppedAt = k;
      steps.push({
        title: 'Criterio de parada',
        explanation: `|εa| = ${formatNumber(Math.abs(ea), 4)} % es menor que εs = ${formatNumber(es)} % (${input.significantFigures} cifras significativas): se detiene la serie.`,
        formula: '\\varepsilon_s = (0.5 \\times 10^{2-n})\\,\\%',
        substitution: `\\varepsilon_s = (0.5 \\times 10^{2-${input.significantFigures}})\\,\\% = ${n(es)}\\,\\%`,
      });
      break;
    }
    previous = approx;
  }

  const et = trueValue - approx;
  const rel = relative(trueValue, et);
  const lastOrder = approximations.length - 1;
  const notices =
    es !== null && stoppedAt === null
      ? [
          {
            level: 'warning' as const,
            message: `Con orden ${order} todavía no se alcanza εs = ${formatNumber(es)} %. Aumenta el orden.`,
          },
        ]
      : [];

  // Gráfica: f y los polinomios de Taylor de algunos órdenes.
  const span = Math.abs(h) || 1;
  const lo = Math.min(xi, x) - 0.5 * span;
  const hi = Math.max(xi, x) + 0.5 * span;
  const samples = 120;
  const grid = Array.from({ length: samples + 1 }, (_, i) => lo + ((hi - lo) * i) / samples);
  const taylorAt = (upTo: number, t: number) =>
    polynomial.slice(0, upTo + 1).reduce((s, p) => s + p.coefficient * (t - xi) ** p.k, 0);
  const shownOrders = [...new Set([0, 1, 2, lastOrder].filter((k) => k <= lastOrder))];
  const series: Series[] = [
    {
      id: 'taylor',
      title: 'f(x) y sus aproximaciones de Taylor',
      xLabel: 'x',
      yLabel: 'y',
      label: 'f(x)',
      points: grid.map((t) => ({ x: t, y: f.evaluate(t) })).filter((p) => Number.isFinite(p.y)),
      others: shownOrders.map((k) => ({
        label: `Orden ${k}`,
        points: grid.map((t) => ({ x: t, y: taylorAt(k, t) })),
      })),
    },
  ];

  return {
    ok: true,
    value: {
      approximation: approx,
      trueValue,
      trueError: et,
      trueRelativeError: rel,
      approximations,
    },
    summary: [
      {
        label: `Aproximación de orden ${lastOrder}`,
        value: `f(${n(x)}) \\approx ${n(approx)}`,
        emphasis: true,
      },
      { label: 'Valor verdadero', value: `f(${n(x)}) = ${n(trueValue)}` },
      { label: 'Error de truncamiento', value: `E_t = ${n(et)}` },
      ...(rel === null
        ? []
        : [{ label: 'Error relativo', value: `\\varepsilon_t = ${n(rel, 4)}\\,\\%` }]),
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'taylor',
        title: 'Aproximaciones por orden',
        columns: [
          { key: 'order', header: '\\text{Orden } n' },
          { key: 'derivative', header: 'f^{(n)}(x_i)' },
          { key: 'term', header: '\\frac{f^{(n)}(x_i)}{n!}h^n' },
          { key: 'approx', header: '\\text{Aproximación}' },
          { key: 'et', header: 'E_t' },
          { key: 'rel', header: '\\varepsilon_t\\,(\\%)' },
          { key: 'ea', header: '\\varepsilon_a\\,(\\%)' },
        ],
        rows,
      },
    ],
    series,
    notices,
  };
}

export function solveNumericErrors(input: NumericErrorsInput): Result {
  switch (input.mode) {
    case 'aproximacion':
      return solveApproximation(input);
    case 'redondeo':
      return solveRounding(input);
    case 'taylor':
      return solveTaylor(input);
  }
}

export const numericErrors: Calculator<
  NumericErrorsInput,
  NumericErrorsValue,
  NumericErrorsErrorCode
> = {
  meta: {
    id: 'errores-numericos',
    title: 'Errores de truncamiento y redondeo',
    summary:
      'Error verdadero y relativo de una aproximación, corte y redondeo a k cifras, y error de truncamiento de la serie de Taylor.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 3, ejemplos 3.1 y 3.2 y sec. 3.4.1 (corte y redondeo); cap. 4, ejemplos 4.1 y 4.2 (serie de Taylor), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: numericErrorsInputSchema,
  example: {
    mode: 'taylor',
    expression: '-0.1x^4 - 0.15x^3 - 0.5x^2 - 0.25x + 1.2',
    xi: 0,
    x: 1,
    order: 4,
    trueValue: 10000,
    approximation: 9999,
    value: 3.14159265358,
    digits: 7,
  },
  solve: solveNumericErrors,
};
