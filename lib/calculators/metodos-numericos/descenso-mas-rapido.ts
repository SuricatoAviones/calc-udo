/**
 * Método del descenso (o ascenso) más rápido con paso óptimo (Chapra & Canale, sec. 14.2):
 *
 *   ∇f = (∂f/∂x, ∂f/∂y)
 *   g(h) = f(x + h·d_x, y + h·d_y),   d = −∇f para minimizar, d = +∇f para maximizar
 *   h* optimiza g(h) (g'(h*) = 0),     (x, y) ← (x, y) + h*·d
 *
 * Se detiene cuando el gradiente es cero (punto estacionario) o cuando el error aproximado de
 * cada coordenada, ε_a = |(nuevo − anterior)/nuevo| × 100 %, es menor que ε_s.
 *
 * h* se obtiene resolviendo g'(h) = 0 con Newton desde h = 0 (en una función cuadrática basta un
 * paso y el resultado es exacto, como en el libro). Si Newton no da un paso válido, se usa la
 * búsqueda de la sección dorada sobre h > 0.
 */
import { derivative, parse, rationalize, type MathNode } from 'mathjs';
import { z } from 'zod';
import { differentiate, parseFunction, type ParsedExpression } from '@/lib/math/expression';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type SummaryItem,
} from '../types';
import { polynomialLatex } from './polynomial';
import { finiteNumber, maxIterationsField, toleranceField } from './root-finding';

/** Gradiente de norma menor que esto (relativo a |f|) se considera cero. */
const STATIONARY = 1e-8;

export const steepestGoals = ['minimizar', 'maximizar'] as const;
export type SteepestGoal = (typeof steepestGoals)[number];

export const steepestDescentInputSchema = z.object({
  expression: z
    .string()
    .trim()
    .min(1, 'Escribe f(x, y).')
    .max(200, 'La expresión es demasiado larga.'),
  goal: z.enum(steepestGoals, { error: 'Elige si se minimiza o se maximiza.' }),
  x0: finiteNumber('x₀'),
  y0: finiteNumber('y₀'),
  tolerance: toleranceField,
  maxIterations: maxIterationsField,
});

export type SteepestDescentInput = z.infer<typeof steepestDescentInputSchema>;

export interface SteepestDescentValue {
  x: number;
  y: number;
  f: number;
  iterations: number;
  /** Puntos visitados, empezando por (x₀, y₀). */
  path: { x: number; y: number; f: number; h: number | null }[];
}

export type SteepestDescentErrorCode =
  'invalid-expression' | 'non-finite' | 'max-iterations' | 'no-step';

type Result = CalculatorResult<SteepestDescentValue, SteepestDescentErrorCode>;

const n = toLatexNumber;
const op = toLatexOperand;

/** Compila la expresión una vez y devuelve una función de h (`NaN` si no es real). */
function compileInH(node: MathNode): (h: number) => number {
  const compiled = node.compile();
  return (h: number) => {
    try {
      const value: unknown = compiled.evaluate({ h });
      return typeof value === 'number' ? value : Number.NaN;
    } catch {
      return Number.NaN;
    }
  };
}

/** Sustituye x → x₀ + h·dₓ y y → y₀ + h·d_y en la expresión. */
function lineFunction(f: ParsedExpression, x: number, y: number, dx: number, dy: number): MathNode {
  const replacement: Record<string, MathNode> = {
    x: parse(`(${x}) + h * (${dx})`),
    y: parse(`(${y}) + h * (${dy})`),
  };
  return f.node.transform((node) => {
    if (node.type === 'SymbolNode') {
      const name = (node as unknown as { name: string }).name;
      return replacement[name] ?? node;
    }
    return node;
  });
}

/** ¿La expresión es un polinomio (sumas, productos y potencias enteras de x y y)? */
function isPolynomial(node: MathNode): boolean {
  let polynomial = true;
  node.traverse((child) => {
    if (!polynomial) return;
    if (child.type === 'FunctionNode') polynomial = false;
    if (child.type === 'OperatorNode') {
      const { fn, args } = child as unknown as { fn: string; args: MathNode[] };
      if (fn === 'pow') {
        const exponent = args[1];
        const value =
          exponent?.type === 'ConstantNode'
            ? Number((exponent as unknown as { value: unknown }).value)
            : NaN;
        if (!Number.isInteger(value) || value < 0) polynomial = false;
      } else if (fn === 'divide') {
        if (args[1]?.type !== 'ConstantNode') polynomial = false;
      } else if (!['add', 'subtract', 'multiply', 'unaryMinus', 'unaryPlus'].includes(fn)) {
        polynomial = false;
      }
    }
  });
  return polynomial;
}

/** g(h) desarrollado como polinomio, si lo es (para mostrarlo como en el libro). */
function polynomialTex(node: MathNode): string | null {
  if (!isPolynomial(node)) return null;
  try {
    const { coefficients } = rationalize(node, {}, true) as unknown as {
      coefficients?: number[];
    };
    if (!coefficients || coefficients.length === 0 || coefficients.length > 7) return null;
    // mathjs los da de menor a mayor grado.
    return polynomialLatex([...coefficients].reverse(), 'h');
  } catch {
    return null;
  }
}

/**
 * h* > 0 que optimiza g. Newton sobre g'(h) = 0 desde 0; si no sirve, sección dorada sobre un
 * intervalo que se amplía mientras g mejore.
 */
function optimalStep(g: MathNode, sign: 1 | -1): { h: number; method: 'newton' | 'dorada' } | null {
  const better = (a: number, b: number) => sign * a > sign * b; // a mejor que b
  const gAt = compileInH(g);
  const g0 = gAt(0);
  let dgAt: ((h: number) => number) | null = null;
  let d2gAt: ((h: number) => number) | null = null;
  try {
    // Sin simplificar: la derivada de una expresión compuesta se simplifica muy lento.
    const dg = derivative(g, 'h', { simplify: false });
    dgAt = compileInH(dg);
    d2gAt = compileInH(derivative(dg, 'h', { simplify: false }));
  } catch {
    dgAt = null;
  }
  if (dgAt && d2gAt) {
    let h = 0;
    for (let i = 0; i < 50; i++) {
      const d1 = dgAt(h);
      const d2 = d2gAt(h);
      if (!Number.isFinite(d1) || !Number.isFinite(d2) || d2 === 0) break;
      const next = h - d1 / d2;
      if (Math.abs(next - h) <= 1e-14 * Math.max(1, Math.abs(next))) {
        h = next;
        break;
      }
      h = next;
    }
    const curvature = d2gAt(h);
    const gh = gAt(h);
    if (h > 0 && Number.isFinite(gh) && sign * curvature < 0 && better(gh, g0)) {
      return { h, method: 'newton' };
    }
  }
  // Sección dorada: primero se busca un intervalo [0, b] donde g deje de mejorar.
  let b = 1e-3;
  let gb = gAt(b);
  if (!Number.isFinite(gb) || !better(gb, g0)) return null;
  let bounded = false;
  for (let i = 0; i < 60; i++) {
    const next = gAt(2 * b);
    if (!Number.isFinite(next) || !better(next, gb)) {
      bounded = true;
      break;
    }
    b *= 2;
    gb = next;
  }
  // g sigue mejorando con pasos enormes: la función no está acotada en esa dirección.
  if (!bounded) return null;
  let lo = 0;
  let hi = 2 * b;
  const ratio = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - ratio * (hi - lo);
  let x2 = lo + ratio * (hi - lo);
  let f1 = gAt(x1);
  let f2 = gAt(x2);
  for (let i = 0; i < 200 && hi - lo > 1e-12 * Math.max(1, hi); i++) {
    if (better(f1, f2)) {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - ratio * (hi - lo);
      f1 = gAt(x1);
    } else {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + ratio * (hi - lo);
      f2 = gAt(x2);
    }
  }
  const h = (lo + hi) / 2;
  return Number.isFinite(gAt(h)) ? { h, method: 'dorada' } : null;
}

function approxError(xNew: number, xOld: number): number | null {
  return xNew === 0 ? null : Math.abs((xNew - xOld) / xNew) * 100;
}

export function solveSteepestDescent(input: SteepestDescentInput): Result {
  const parsed = parseFunction(input.expression, ['x', 'y']);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: parsed.message },
      ...emptyTrace(),
    };
  }
  const f = parsed.expr;
  const fx = differentiate(f, 'x');
  const fy = differentiate(f, 'y');
  if (!fx.ok || !fy.ok) {
    return {
      ok: false,
      error: {
        code: 'invalid-expression',
        message: 'No se pudo derivar la función simbólicamente.',
      },
      ...emptyTrace(),
    };
  }
  const maximize = input.goal === 'maximizar';
  const sign: 1 | -1 = maximize ? 1 : -1;
  let x = input.x0;
  let y = input.y0;
  let fValue = f.evaluateAt({ x, y });
  const path: SteepestDescentValue['path'] = [{ x, y, f: fValue, h: null }];
  const rows: Record<string, number | null>[] = [];

  const steps: Step[] = [
    {
      title: 'Función y gradiente',
      explanation: maximize
        ? 'Para maximizar se avanza en la dirección del gradiente (ascenso más rápido).'
        : 'Para minimizar se avanza en la dirección contraria al gradiente (descenso más rápido).',
      formula: `f(x, y) = ${f.tex}`,
      substitution: `\\frac{\\partial f}{\\partial x} = ${fx.expr.tex}, \\qquad \\frac{\\partial f}{\\partial y} = ${fy.expr.tex}`,
      result: `(x_0, y_0) = (${n(x)},\\ ${n(y)}), \\quad f(x_0, y_0) = ${n(fValue)}`,
    },
  ];
  const trace = () => ({
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'iteraciones',
        title: 'Iteraciones',
        columns: [
          { key: 'i', header: 'i' },
          { key: 'gx', header: '\\partial f/\\partial x' },
          { key: 'gy', header: '\\partial f/\\partial y' },
          { key: 'h', header: 'h^*' },
          { key: 'x', header: 'x_{i+1}' },
          { key: 'y', header: 'y_{i+1}' },
          { key: 'f', header: 'f(x_{i+1}, y_{i+1})' },
          { key: 'ea', header: '\\varepsilon_a\\,(\\%)' },
        ],
        rows,
      },
    ],
    series: [
      {
        id: 'convergencia',
        title: 'Valor de f en cada iteración',
        xLabel: 'Iteración',
        yLabel: 'f(x, y)',
        points: path.map((p, i) => ({ x: i, y: p.f })),
      },
    ],
  });

  if (!Number.isFinite(fValue)) {
    return {
      ok: false,
      error: {
        code: 'non-finite',
        message: 'f(x, y) no tiene un valor real finito en el punto inicial.',
      },
      ...trace(),
    };
  }

  for (let i = 0; i < input.maxIterations; i++) {
    const gx = fx.expr.evaluateAt({ x, y });
    const gy = fy.expr.evaluateAt({ x, y });
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
      return {
        ok: false,
        error: {
          code: 'non-finite',
          message: `El gradiente no tiene un valor real finito en (${formatNumber(x)}, ${formatNumber(y)}).`,
        },
        ...trace(),
      };
    }
    const gradientStep: Step = {
      title: 'Gradiente en el punto actual',
      substitution: `\\nabla f(${n(x)},\\ ${n(y)}) = \\left(${n(gx)},\\ ${n(gy)}\\right)`,
    };
    if (Math.hypot(gx, gy) <= STATIONARY * Math.max(1, Math.abs(fValue))) {
      steps.push({
        title: `Iteración ${i + 1}`,
        children: [
          {
            ...gradientStep,
            explanation: 'El gradiente es cero: el punto es estacionario y el método se detiene.',
          },
        ],
      });
      return finish(i);
    }
    const dx = sign * gx;
    const dy = sign * gy;
    const g = lineFunction(f, x, y, dx, dy);
    const expanded = polynomialTex(g);
    const best = optimalStep(g, sign);
    const lineStep: Step = {
      title: 'Función a lo largo de la dirección',
      explanation: `Se sustituye x = ${formatNumber(x)} ${dx < 0 ? '−' : '+'} ${formatNumber(Math.abs(dx))}h y y = ${formatNumber(y)} ${dy < 0 ? '−' : '+'} ${formatNumber(Math.abs(dy))}h en f: queda una función de una sola variable, el tamaño de paso h.`,
      formula: `g(h) = f\\left(x_i ${maximize ? '+' : '-'} h\\frac{\\partial f}{\\partial x},\\ y_i ${maximize ? '+' : '-'} h\\frac{\\partial f}{\\partial y}\\right)`,
      substitution: `g(h) = f\\left(${n(x)} ${dx < 0 ? '-' : '+'} ${n(Math.abs(dx))}h,\\ ${n(y)} ${dy < 0 ? '-' : '+'} ${n(Math.abs(dy))}h\\right)`,
      result: expanded ? `g(h) = ${expanded}` : undefined,
    };
    if (!best && Math.hypot(gx, gy) <= 1e-5 * Math.max(1, Math.abs(fValue))) {
      // El gradiente es tan pequeño que ningún paso cambia f en la precisión de la máquina.
      steps.push({
        title: `Iteración ${i + 1}`,
        children: [
          {
            ...gradientStep,
            explanation:
              'El gradiente es prácticamente cero y ningún paso mejora f: el punto es estacionario.',
          },
        ],
      });
      return finish(i);
    }
    if (!best) {
      steps.push({ title: `Iteración ${i + 1}`, children: [gradientStep, lineStep] });
      return {
        ok: false,
        error: {
          code: 'no-step',
          message: `No se encontró un paso h > 0 que ${maximize ? 'aumente' : 'disminuya'} f en la dirección del gradiente. La función puede no estar acotada en esa dirección.`,
        },
        ...trace(),
      };
    }
    const { h } = best;
    const xNew = x + h * dx;
    const yNew = y + h * dy;
    const fNew = f.evaluateAt({ x: xNew, y: yNew });
    const ex = approxError(xNew, x);
    const ey = approxError(yNew, y);
    const ea = ex === null || ey === null ? null : Math.max(ex, ey);
    const converged = ea !== null && ea < input.tolerance;
    rows.push({ i: i + 1, gx, gy, h, x: xNew, y: yNew, f: fNew, ea });
    path.push({ x: xNew, y: yNew, f: fNew, h });
    steps.push({
      title: `Iteración ${i + 1}`,
      children: [
        gradientStep,
        lineStep,
        {
          title: `Paso óptimo h*`,
          explanation:
            best.method === 'newton'
              ? `Se resuelve g'(h) = 0 (el ${maximize ? 'máximo' : 'mínimo'} de g).`
              : 'Se busca el óptimo de g(h) con la sección dorada.',
          formula: "g'(h^*) = 0",
          result: `h^* = ${n(h)}`,
        },
        {
          title: 'Nuevo punto',
          formula: `(x_{i+1}, y_{i+1}) = (x_i, y_i) ${maximize ? '+' : '-'} h^* \\nabla f`,
          substitution: `x_{${i + 1}} = ${n(x)} + ${n(h)}${op(dx)}, \\quad y_{${i + 1}} = ${n(y)} + ${n(h)}${op(dy)}`,
          result: `(x_{${i + 1}}, y_{${i + 1}}) = (${n(xNew)},\\ ${n(yNew)}), \\quad f = ${n(fNew)}`,
        },
        {
          title: 'Error aproximado',
          explanation: converged
            ? `El mayor error de las coordenadas es menor que εs = ${formatNumber(input.tolerance)} %: el método convergió.`
            : ea === null
              ? 'No está definido porque una coordenada nueva es 0. Se sigue iterando.'
              : `El mayor error de las coordenadas no es menor que εs = ${formatNumber(input.tolerance)} %: se sigue iterando.`,
          formula:
            '\\varepsilon_a = \\max\\left(\\left|\\frac{x_{i+1} - x_i}{x_{i+1}}\\right|, \\left|\\frac{y_{i+1} - y_i}{y_{i+1}}\\right|\\right) 100\\%',
          result: ea === null ? undefined : `\\varepsilon_a = ${n(ea, 6)}\\,\\%`,
        },
      ],
    });
    x = xNew;
    y = yNew;
    fValue = fNew;
    if (!Number.isFinite(fValue)) {
      return {
        ok: false,
        error: { code: 'non-finite', message: 'f(x, y) dejó de tener un valor real finito.' },
        ...trace(),
      };
    }
    if (converged) return finish(i + 1);
  }

  return {
    ok: false,
    error: {
      code: 'max-iterations',
      message: `No se alcanzó la tolerancia en ${input.maxIterations} iteraciones. El último punto es (${formatNumber(x)}, ${formatNumber(y)}).`,
    },
    ...trace(),
  };

  function finish(iterations: number): Result {
    const summary: SummaryItem[] = [
      {
        label: maximize ? 'Máximo aproximado' : 'Mínimo aproximado',
        value: `(x, y) \\approx (${n(x)},\\ ${n(y)})`,
        emphasis: true,
      },
      { label: 'Valor de la función', value: `f \\approx ${n(fValue)}` },
      { label: 'Iteraciones', value: String(iterations) },
    ];
    return { ok: true, value: { x, y, f: fValue, iterations, path }, summary, ...trace() };
  }
}

export const steepestDescent: Calculator<
  SteepestDescentInput,
  SteepestDescentValue,
  SteepestDescentErrorCode
> = {
  meta: {
    id: 'descenso-mas-rapido',
    title: 'Método del descenso más rápido',
    summary:
      'Busca el mínimo (o el máximo) de f(x, y) avanzando por el gradiente con el paso óptimo.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 14, sec. 14.2, ejemplos 14.3 y 14.4 (ascenso optimal de máxima inclinación: f = 2xy + 2x − x² − 2y² desde (−1, 1)), 5.ª ed. en español',
      },
      { sourceId: 'smith-1993' },
      { sourceId: 'nakamura-1994' },
    ],
  },
  inputSchema: steepestDescentInputSchema,
  example: {
    expression: '2x*y + 2x - x^2 - 2y^2',
    goal: 'maximizar',
    x0: -1,
    y0: 1,
    tolerance: 0.01,
    maxIterations: 50,
  },
  solve: solveSteepestDescent,
};
