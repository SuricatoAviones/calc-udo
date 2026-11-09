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

const POLYNOMIAL_OPERATORS = new Set(['add', 'subtract', 'multiply', 'unaryMinus', 'unaryPlus']);

/** ¿El operador mantiene un polinomio? Potencias enteras no negativas y división por constantes. */
function polynomialOperator(fn: string, args: MathNode[]): boolean {
  if (fn === 'pow') {
    const exponent = args[1];
    const value =
      exponent?.type === 'ConstantNode'
        ? Number((exponent as unknown as { value: unknown }).value)
        : Number.NaN;
    return Number.isInteger(value) && value >= 0;
  }
  if (fn === 'divide') return args[1]?.type === 'ConstantNode';
  return POLYNOMIAL_OPERATORS.has(fn);
}

/** ¿La expresión es un polinomio (sumas, productos y potencias enteras de x y y)? */
function isPolynomial(node: MathNode): boolean {
  let polynomial = true;
  node.traverse((child) => {
    if (!polynomial) return;
    if (child.type === 'FunctionNode') polynomial = false;
    if (child.type === 'OperatorNode') {
      const { fn, args } = child as unknown as { fn: string; args: MathNode[] };
      if (!polynomialOperator(fn, args)) polynomial = false;
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

type InH = (h: number) => number;
/** ¿a es mejor que b? (mayor al maximizar, menor al minimizar). */
type Better = (a: number, b: number) => boolean;

/** g'(h) y g''(h) compiladas; `null` si mathjs no puede derivar. */
function derivativesInH(g: MathNode): { dgAt: InH; d2gAt: InH } | null {
  try {
    // Sin simplificar: la derivada de una expresión compuesta se simplifica muy lento.
    const dg = derivative(g, 'h', { simplify: false });
    return { dgAt: compileInH(dg), d2gAt: compileInH(derivative(dg, 'h', { simplify: false })) };
  } catch {
    return null;
  }
}

/** Newton sobre g'(h) = 0 desde h = 0; `null` si no llega a un h > 0 que mejore g. */
function newtonInH(g: MathNode, gAt: InH, sign: 1 | -1, better: Better): number | null {
  const derivatives = derivativesInH(g);
  if (!derivatives) return null;
  const { dgAt, d2gAt } = derivatives;
  let h = 0;
  for (let i = 0; i < 50; i++) {
    const d1 = dgAt(h);
    const d2 = d2gAt(h);
    if (!Number.isFinite(d1) || !Number.isFinite(d2) || d2 === 0) break;
    const next = h - d1 / d2;
    const done = Math.abs(next - h) <= 1e-14 * Math.max(1, Math.abs(next));
    h = next;
    if (done) break;
  }
  const gh = gAt(h);
  const improves = Number.isFinite(gh) && better(gh, gAt(0));
  return h > 0 && sign * d2gAt(h) < 0 && improves ? h : null;
}

/**
 * Busca b tal que g mejora hasta b y deja de mejorar en 2b (se duplica desde 10⁻³). `null` si g
 * no mejora al dar un paso o si sigue mejorando con pasos enormes (no acotada en esa dirección).
 */
function bracketInH(gAt: InH, better: Better): number | null {
  let b = 1e-3;
  let gb = gAt(b);
  if (!Number.isFinite(gb) || !better(gb, gAt(0))) return null;
  for (let i = 0; i < 60; i++) {
    const next = gAt(2 * b);
    if (!Number.isFinite(next) || !better(next, gb)) return b;
    b *= 2;
    gb = next;
  }
  return null;
}

/** Sección dorada sobre [0, hi]; `null` si g no es finita en el resultado. */
function goldenSection(gAt: InH, better: Better, hi0: number): number | null {
  let lo = 0;
  let hi = hi0;
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
  return Number.isFinite(gAt(h)) ? h : null;
}

/**
 * h* > 0 que optimiza g. Newton sobre g'(h) = 0 desde 0; si no sirve, sección dorada sobre un
 * intervalo que se amplía mientras g mejore.
 */
function optimalStep(g: MathNode, sign: 1 | -1): { h: number; method: 'newton' | 'dorada' } | null {
  const better: Better = (a, b) => sign * a > sign * b;
  const gAt = compileInH(g);
  const newton = newtonInH(g, gAt, sign, better);
  if (newton !== null) return { h: newton, method: 'newton' };
  const b = bracketInH(gAt, better);
  if (b === null) return null;
  const h = goldenSection(gAt, better, 2 * b);
  return h === null ? null : { h, method: 'dorada' };
}

function approxError(xNew: number, xOld: number): number | null {
  return xNew === 0 ? null : Math.abs((xNew - xOld) / xNew) * 100;
}

const signTex = (v: number) => (v < 0 ? '-' : '+');
const signText = (v: number) => (v < 0 ? '−' : '+');

/** g(h): f a lo largo de la dirección (x + h·dₓ, y + h·d_y), desarrollada si es un polinomio. */
function lineStep(
  g: MathNode,
  { x, y, dx, dy }: { x: number; y: number; dx: number; dy: number },
  maximize: boolean,
): Step {
  const expanded = polynomialTex(g);
  const along = maximize ? '+' : '-';
  return {
    title: 'Función a lo largo de la dirección',
    explanation: `Se sustituye x = ${formatNumber(x)} ${signText(dx)} ${formatNumber(Math.abs(dx))}h y y = ${formatNumber(y)} ${signText(dy)} ${formatNumber(Math.abs(dy))}h en f: queda una función de una sola variable, el tamaño de paso h.`,
    formula: String.raw`g(h) = f\left(x_i ${along} h\frac{\partial f}{\partial x},\ y_i ${along} h\frac{\partial f}{\partial y}\right)`,
    substitution: String.raw`g(h) = f\left(${n(x)} ${signTex(dx)} ${n(Math.abs(dx))}h,\ ${n(y)} ${signTex(dy)} ${n(Math.abs(dy))}h\right)`,
    result: expanded ? `g(h) = ${expanded}` : undefined,
  };
}

function stepSizeExplanation(method: 'newton' | 'dorada', maximize: boolean): string {
  if (method === 'dorada') return 'Se busca el óptimo de g(h) con la sección dorada.';
  const goal = maximize ? 'máximo' : 'mínimo';
  return `Se resuelve g'(h) = 0 (el ${goal} de g).`;
}

function errorExplanation(converged: boolean, ea: number | null, tolerance: number): string {
  if (converged) {
    return `El mayor error de las coordenadas es menor que εs = ${formatNumber(tolerance)} %: el método convergió.`;
  }
  if (ea === null) return 'No está definido porque una coordenada nueva es 0. Se sigue iterando.';
  return `El mayor error de las coordenadas no es menor que εs = ${formatNumber(tolerance)} %: se sigue iterando.`;
}

interface Descent {
  f: ParsedExpression;
  fx: ParsedExpression;
  fy: ParsedExpression;
  maximize: boolean;
  tolerance: number;
}

type PathPoint = SteepestDescentValue['path'][number];

type IterationOutcome =
  | { kind: 'stationary'; step: Step }
  | { kind: 'fail'; code: SteepestDescentErrorCode; message: string; steps: Step[] }
  | {
      kind: 'moved';
      point: PathPoint & { h: number };
      row: Record<string, number | null>;
      converged: boolean;
      step: Step;
    };

/** Una iteración desde (x, y): gradiente, g(h), paso óptimo, nuevo punto y error. */
function descentIteration(d: Descent, i: number, current: PathPoint): IterationOutcome {
  const { x, y } = current;
  const gx = d.fx.evaluateAt({ x, y });
  const gy = d.fy.evaluateAt({ x, y });
  if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
    return {
      kind: 'fail',
      code: 'non-finite',
      message: `El gradiente no tiene un valor real finito en (${formatNumber(x)}, ${formatNumber(y)}).`,
      steps: [],
    };
  }
  const title = `Iteración ${i + 1}`;
  const gradientStep: Step = {
    title: 'Gradiente en el punto actual',
    substitution: String.raw`\nabla f(${n(x)},\ ${n(y)}) = \left(${n(gx)},\ ${n(gy)}\right)`,
  };
  const norm = Math.hypot(gx, gy);
  const scale = Math.max(1, Math.abs(current.f));
  if (norm <= STATIONARY * scale) {
    const explanation = 'El gradiente es cero: el punto es estacionario y el método se detiene.';
    return { kind: 'stationary', step: { title, children: [{ ...gradientStep, explanation }] } };
  }
  const sign: 1 | -1 = d.maximize ? 1 : -1;
  const dx = sign * gx;
  const dy = sign * gy;
  const g = lineFunction(d.f, x, y, dx, dy);
  const best = optimalStep(g, sign);
  if (!best && norm <= 1e-5 * scale) {
    // El gradiente es tan pequeño que ningún paso cambia f en la precisión de la máquina.
    const explanation =
      'El gradiente es prácticamente cero y ningún paso mejora f: el punto es estacionario.';
    return { kind: 'stationary', step: { title, children: [{ ...gradientStep, explanation }] } };
  }
  const line = lineStep(g, { x, y, dx, dy }, d.maximize);
  if (!best) {
    const verb = d.maximize ? 'aumente' : 'disminuya';
    return {
      kind: 'fail',
      code: 'no-step',
      message: `No se encontró un paso h > 0 que ${verb} f en la dirección del gradiente. La función puede no estar acotada en esa dirección.`,
      steps: [{ title, children: [gradientStep, line] }],
    };
  }
  const { h } = best;
  const xNew = x + h * dx;
  const yNew = y + h * dy;
  const fNew = d.f.evaluateAt({ x: xNew, y: yNew });
  const ex = approxError(xNew, x);
  const ey = approxError(yNew, y);
  const ea = ex === null || ey === null ? null : Math.max(ex, ey);
  const converged = ea !== null && ea < d.tolerance;
  const along = d.maximize ? '+' : '-';
  const children: Step[] = [
    gradientStep,
    line,
    {
      title: `Paso óptimo h*`,
      explanation: stepSizeExplanation(best.method, d.maximize),
      formula: "g'(h^*) = 0",
      result: `h^* = ${n(h)}`,
    },
    {
      title: 'Nuevo punto',
      formula: String.raw`(x_{i+1}, y_{i+1}) = (x_i, y_i) ${along} h^* \nabla f`,
      substitution: String.raw`x_{${i + 1}} = ${n(x)} + ${n(h)}${op(dx)}, \quad y_{${i + 1}} = ${n(y)} + ${n(h)}${op(dy)}`,
      result: String.raw`(x_{${i + 1}}, y_{${i + 1}}) = (${n(xNew)},\ ${n(yNew)}), \quad f = ${n(fNew)}`,
    },
    {
      title: 'Error aproximado',
      explanation: errorExplanation(converged, ea, d.tolerance),
      formula: String.raw`\varepsilon_a = \max\left(\left|\frac{x_{i+1} - x_i}{x_{i+1}}\right|, \left|\frac{y_{i+1} - y_i}{y_{i+1}}\right|\right) 100\%`,
      result: ea === null ? undefined : String.raw`\varepsilon_a = ${n(ea, 6)}\,\%`,
    },
  ];
  return {
    kind: 'moved',
    point: { x: xNew, y: yNew, f: fNew, h },
    row: { i: i + 1, gx, gy, h, x: xNew, y: yNew, f: fNew, ea },
    converged,
    step: { title, children },
  };
}

type ParsedGradient =
  { f: ParsedExpression; fx: ParsedExpression; fy: ParsedExpression } | { message: string };

function parseWithGradient(expression: string): ParsedGradient {
  const parsed = parseFunction(expression, ['x', 'y']);
  if (!parsed.ok) return { message: parsed.message };
  const fx = differentiate(parsed.expr, 'x');
  const fy = differentiate(parsed.expr, 'y');
  if (!fx.ok || !fy.ok) return { message: 'No se pudo derivar la función simbólicamente.' };
  return { f: parsed.expr, fx: fx.expr, fy: fy.expr };
}

const GOAL_TEXT: Record<SteepestGoal, string> = {
  maximizar: 'Para maximizar se avanza en la dirección del gradiente (ascenso más rápido).',
  minimizar:
    'Para minimizar se avanza en la dirección contraria al gradiente (descenso más rápido).',
};

export function solveSteepestDescent(input: SteepestDescentInput): Result {
  const parsed = parseWithGradient(input.expression);
  if ('message' in parsed) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: parsed.message },
      ...emptyTrace(),
    };
  }
  const { f, fx, fy } = parsed;
  const maximize = input.goal === 'maximizar';
  const descent: Descent = { f, fx, fy, maximize, tolerance: input.tolerance };
  let x = input.x0;
  let y = input.y0;
  let fValue = f.evaluateAt({ x, y });
  const path: SteepestDescentValue['path'] = [{ x, y, f: fValue, h: null }];
  const rows: Record<string, number | null>[] = [];

  const steps: Step[] = [
    {
      title: 'Función y gradiente',
      explanation: GOAL_TEXT[input.goal],
      formula: `f(x, y) = ${f.tex}`,
      substitution: String.raw`\frac{\partial f}{\partial x} = ${fx.tex}, \qquad \frac{\partial f}{\partial y} = ${fy.tex}`,
      result: String.raw`(x_0, y_0) = (${n(x)},\ ${n(y)}), \quad f(x_0, y_0) = ${n(fValue)}`,
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
          { key: 'gx', header: String.raw`\partial f/\partial x` },
          { key: 'gy', header: String.raw`\partial f/\partial y` },
          { key: 'h', header: 'h^*' },
          { key: 'x', header: 'x_{i+1}' },
          { key: 'y', header: 'y_{i+1}' },
          { key: 'f', header: 'f(x_{i+1}, y_{i+1})' },
          { key: 'ea', header: String.raw`\varepsilon_a\,(\%)` },
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
  const failure = (code: SteepestDescentErrorCode, message: string): Result => ({
    ok: false,
    error: { code, message },
    ...trace(),
  });

  if (!Number.isFinite(fValue)) {
    return failure('non-finite', 'f(x, y) no tiene un valor real finito en el punto inicial.');
  }

  for (let i = 0; i < input.maxIterations; i++) {
    const outcome = descentIteration(descent, i, { x, y, f: fValue, h: null });
    if (outcome.kind === 'fail') {
      steps.push(...outcome.steps);
      return failure(outcome.code, outcome.message);
    }
    steps.push(outcome.step);
    if (outcome.kind === 'stationary') return finish(i);
    rows.push(outcome.row);
    path.push(outcome.point);
    ({ x, y, f: fValue } = outcome.point);
    if (!Number.isFinite(fValue)) {
      return failure('non-finite', 'f(x, y) dejó de tener un valor real finito.');
    }
    if (outcome.converged) return finish(i + 1);
  }

  return failure(
    'max-iterations',
    `No se alcanzó la tolerancia en ${input.maxIterations} iteraciones. El último punto es (${formatNumber(x)}, ${formatNumber(y)}).`,
  );

  function finish(iterations: number): Result {
    const summary: SummaryItem[] = [
      {
        label: maximize ? 'Máximo aproximado' : 'Mínimo aproximado',
        value: String.raw`(x, y) \approx (${n(x)},\ ${n(y)})`,
        emphasis: true,
      },
      { label: 'Valor de la función', value: String.raw`f \approx ${n(fValue)}` },
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
