/**
 * Método de Newton-Raphson para sistemas de ecuaciones no lineales (Chapra & Canale, sec. 6.6.2):
 *
 *   F(x) = 0,   J(xᵢ) Δ = −F(xᵢ),   xᵢ₊₁ = xᵢ + Δ
 *
 * donde J es la matriz jacobiana (derivadas parciales). Para dos ecuaciones u(x, y) = 0 y
 * v(x, y) = 0, resolver el sistema por la regla de Cramer da las ecuaciones 6.24 del libro:
 *
 *   xᵢ₊₁ = xᵢ − (uᵢ ∂vᵢ/∂y − vᵢ ∂uᵢ/∂y) / det J,   yᵢ₊₁ = yᵢ − (vᵢ ∂uᵢ/∂x − uᵢ ∂vᵢ/∂x) / det J
 *
 * Se detiene cuando el error aproximado de todas las variables es menor que ε_s.
 */
import { z } from 'zod';
import { differentiate, parseFunction, type ParsedExpression } from '@/lib/math/expression';
import { formatNumber, toLatexNumber, toLatexOperand, TEX } from '@/lib/math/format';
import { solveLinearSystem } from '@/lib/math/linear-algebra';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type SummaryItem,
} from '../types';
import { texMatrix } from './matrix';
import { finiteNumber, maxIterationsField, toleranceField } from './root-finding';

const VARIABLES = ['x', 'y', 'z'] as const;

const equationField = z.string().trim().max(200, 'La expresión es demasiado larga.');

export const newtonSystemInputSchema = z
  .object({
    size: z.enum(['2', '3'], { error: 'Elige el número de ecuaciones.' }),
    f1: equationField.min(1, 'Escribe la primera ecuación.'),
    f2: equationField.min(1, 'Escribe la segunda ecuación.'),
    f3: equationField.optional(),
    x0: finiteNumber('x₀'),
    y0: finiteNumber('y₀'),
    z0: finiteNumber('z₀').optional(),
    tolerance: toleranceField,
    maxIterations: maxIterationsField,
  })
  .superRefine((v, ctx) => {
    if (v.size !== '3') return;
    if (!v.f3)
      ctx.addIssue({ code: 'custom', path: ['f3'], message: 'Escribe la tercera ecuación.' });
    if (v.z0 === undefined) ctx.addIssue({ code: 'custom', path: ['z0'], message: 'Ingresa z₀.' });
  });

export type NewtonSystemInput = z.infer<typeof newtonSystemInputSchema>;

export interface NewtonSystemValue {
  solution: number[];
  iterations: number;
  /** F en la solución, para comprobar. */
  residuals: number[];
}

export type NewtonSystemErrorCode =
  'invalid-expression' | 'non-finite' | 'singular-jacobian' | 'max-iterations';

type Result = CalculatorResult<NewtonSystemValue, NewtonSystemErrorCode>;

const n = toLatexNumber;
const op = toLatexOperand;

function vectorTex(values: number[]): string {
  return String.raw`\begin{bmatrix} ${values.map((v) => n(v, 7)).join(TEX.newline)} \end{bmatrix}`;
}

type ParsedSystem =
  { equations: ParsedExpression[]; jacobian: ParsedExpression[][] } | { message: string };

/** Lee las ecuaciones y deriva la jacobiana simbólica. */
function parseSystem(sources: string[], vars: string[]): ParsedSystem {
  const equations: ParsedExpression[] = [];
  for (const [i, source] of sources.entries()) {
    const parsed = parseFunction(source, vars);
    if (!parsed.ok) return { message: `Ecuación ${i + 1}: ${parsed.message}` };
    equations.push(parsed.expr);
  }
  const jacobian: ParsedExpression[][] = [];
  for (const eq of equations) {
    const row: ParsedExpression[] = [];
    for (const v of vars) {
      const d = differentiate(eq, v);
      if (!d.ok) return { message: 'No se pudo derivar una ecuación simbólicamente.' };
      row.push(d.expr);
    }
    jacobian.push(row);
  }
  return { equations, jacobian };
}

/** Δ de J Δ = −F y det J (solo con dos ecuaciones); `null` si J es singular. */
function newtonDelta(J: number[][], F: number[]): { delta: number[]; det: number | null } | null {
  const delta = solveLinearSystem(
    J,
    F.map((v) => -v),
  );
  const det = J.length === 2 ? J[0]![0]! * J[1]![1]! - J[0]![1]! * J[1]![0]! : null;
  if (!delta || det === 0) return null;
  return { delta, det };
}

/** Con dos ecuaciones, la regla de Cramer de Chapra (ecuaciones 6.24). */
function cramerSteps(
  it: number,
  point: number[],
  next: number[],
  F: number[],
  J: number[][],
  det: number,
): Step[] {
  const [u, v] = F as [number, number];
  const [[ux, uy], [vx, vy]] = J as [[number, number], [number, number]];
  return [
    {
      title: 'Determinante de la jacobiana',
      formula: String.raw`\det J = \frac{\partial f_1}{\partial x}\frac{\partial f_2}{\partial y} - \frac{\partial f_1}{\partial y}\frac{\partial f_2}{\partial x}`,
      substitution: String.raw`\det J = ${op(ux)}${op(vy)} - ${op(uy)}${op(vx)}`,
      result: String.raw`\det J = ${n(det)}`,
    },
    {
      title: 'Nuevos valores (ecuaciones 6.24)',
      formula: String.raw`x_{i+1} = x_i - \frac{f_1 \frac{\partial f_2}{\partial y} - f_2 \frac{\partial f_1}{\partial y}}{\det J}, \quad y_{i+1} = y_i - \frac{f_2 \frac{\partial f_1}{\partial x} - f_1 \frac{\partial f_2}{\partial x}}{\det J}`,
      substitution: String.raw`x_{${it}} = ${n(point[0]!)} - \frac{${op(u)}${op(vy)} - ${op(v)}${op(uy)}}{${n(det)}}, \quad y_{${it}} = ${n(point[1]!)} - \frac{${op(v)}${op(ux)} - ${op(u)}${op(vx)}}{${n(det)}}`,
      result: String.raw`x_{${it}} = ${n(next[0]!)}, \quad y_{${it}} = ${n(next[1]!)}`,
    },
  ];
}

/** Con tres ecuaciones, el sistema lineal J Δ = −F por eliminación de Gauss. */
function gaussSteps(
  it: number,
  names: string[],
  next: number[],
  F: number[],
  J: number[][],
  delta: number[],
): Step[] {
  return [
    {
      title: 'Resolver J Δ = −F',
      explanation: 'Se resuelve el sistema lineal con eliminación de Gauss y pivoteo parcial.',
      formula: String.raw`J\,\Delta = -F`,
      substitution: String.raw`${texMatrix(J, 7)} \Delta = ${vectorTex(F.map((v) => -v))}`,
      result: String.raw`\Delta = ${vectorTex(delta)}`,
    },
    {
      title: 'Nuevos valores',
      formula: String.raw`x_{i+1} = x_i + \Delta`,
      result: names.map((v, k) => `${v}_{${it}} = ${n(next[k]!)}`).join(String.raw`,\quad `),
    },
  ];
}

/** El mayor error relativo; `null` si alguna variable vale 0 (no está definido). */
function maxError(errors: (number | null)[]): number | null {
  return errors.includes(null) ? null : Math.max(...(errors as number[]));
}

function errorExplanation(converged: boolean, ea: number | null, tolerance: number): string {
  if (converged) {
    return `El mayor error es menor que εs = ${formatNumber(tolerance)} %: el método convergió.`;
  }
  if (ea === null) return 'No está definido para una variable que vale 0. Se sigue iterando.';
  return `El mayor error no es menor que εs = ${formatNumber(tolerance)} %: se sigue iterando.`;
}

function errorStep(
  names: string[],
  errors: (number | null)[],
  ea: number | null,
  tolerance: number,
): Step {
  const converged = ea !== null && ea < tolerance;
  const perVariable = names
    .map((v, k) => {
      const e = errors[k];
      const value = e === null ? TEX.dash : n(e!, 6);
      return String.raw`\varepsilon_{a,${v}} = ${value}\,\%`;
    })
    .join(String.raw`,\quad `);
  return {
    title: 'Error aproximado',
    explanation: errorExplanation(converged, ea, tolerance),
    formula: String.raw`\varepsilon_a = \max_k \left|\frac{x_k^{(i+1)} - x_k^{(i)}}{x_k^{(i+1)}}\right| 100\%`,
    result: ea === null ? undefined : perVariable,
  };
}

export function solveNewtonSystem(input: NewtonSystemInput): Result {
  const size = Number(input.size);
  const vars = VARIABLES.slice(0, size) as unknown as string[];
  const sources = [input.f1, input.f2, input.f3 ?? ''].slice(0, size);

  const system = parseSystem(sources, vars);
  if ('message' in system) {
    return {
      ok: false,
      error: { code: 'invalid-expression', message: system.message },
      ...emptyTrace(),
    };
  }
  const { equations, jacobian } = system;

  let point = [input.x0, input.y0, input.z0 ?? 0].slice(0, size);
  const names = vars.map((v) => `${v}`);
  const rows: Record<string, number | null>[] = [];
  const argumentList = names.join(', ');
  const systemTex = equations
    .map((e, i) => `f_{${i + 1}}(${argumentList}) &= ${e.tex} = 0`)
    .join(TEX.newline);
  const jacobianTex = jacobian.map((row) => row.map((d) => d.tex).join(' & ')).join(TEX.newline);
  const steps: Step[] = [
    {
      title: 'Sistema y matriz jacobiana',
      explanation: `Se buscan ${argumentList} tales que todas las funciones valgan 0. La jacobiana reúne las derivadas parciales de cada función respecto de cada variable.`,
      formula: String.raw`\begin{aligned} ${systemTex} \end{aligned}`,
      result: String.raw`J = \begin{bmatrix} ${jacobianTex} \end{bmatrix}`,
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
          ...names.map((v) => ({ key: v, header: `${v}_i` })),
          { key: 'ea', header: String.raw`\varepsilon_a\,(\%)` },
        ],
        rows,
      },
    ],
    series: [
      {
        id: 'error',
        title: 'Error aproximado por iteración',
        xLabel: 'Iteración',
        yLabel: 'εa (%)',
        yScale: 'log' as const,
        points: rows.flatMap((r) =>
          r.ea === null || r.ea === undefined || r.ea <= 0 ? [] : [{ x: r.i!, y: r.ea }],
        ),
      },
    ],
  });
  rows.push({ i: 0, ...Object.fromEntries(names.map((v, k) => [v, point[k]!])), ea: null });

  for (let it = 1; it <= input.maxIterations; it++) {
    const scope = Object.fromEntries(names.map((v, k) => [v, point[k]!]));
    const F = equations.map((e) => e.evaluateAt(scope));
    const J = jacobian.map((row) => row.map((d) => d.evaluateAt(scope)));
    if ([...F, ...J.flat()].some((v) => !Number.isFinite(v))) {
      return {
        ok: false,
        error: {
          code: 'non-finite',
          message: `Las funciones o sus derivadas no tienen un valor real finito en (${point.map((v) => formatNumber(v)).join(', ')}).`,
        },
        ...trace(),
      };
    }
    const at = `(${point.map((v) => n(v)).join(TEX.listSep)})`;
    const children: Step[] = [
      {
        title: 'Evaluar las funciones',
        result: F.map((v, k) => `f_{${k + 1}}${at} = ${n(v)}`).join(String.raw`,\quad `),
      },
      {
        title: 'Evaluar la jacobiana',
        result: `J${at} = ${texMatrix(J, 7)}`,
      },
    ];
    const solved = newtonDelta(J, F);
    if (!solved) {
      children.push({
        title: 'La jacobiana es singular',
        explanation: 'Su determinante es 0, así que el sistema J Δ = −F no tiene solución única.',
      });
      steps.push({ title: `Iteración ${it}`, children });
      return {
        ok: false,
        error: {
          code: 'singular-jacobian',
          message: 'La matriz jacobiana es singular en este punto. Prueba otros valores iniciales.',
        },
        ...trace(),
      };
    }
    const { delta, det } = solved;
    const next = point.map((v, k) => v + delta[k]!);
    children.push(
      ...(det === null
        ? gaussSteps(it, names, next, F, J, delta)
        : cramerSteps(it, point, next, F, J, det)),
    );
    const errors = next.map((v, k) => (v === 0 ? null : Math.abs((v - point[k]!) / v) * 100));
    const ea = maxError(errors);
    children.push(errorStep(names, errors, ea, input.tolerance));
    steps.push({ title: `Iteración ${it}`, children });
    point = next;
    rows.push({ i: it, ...Object.fromEntries(names.map((v, k) => [v, point[k]!])), ea });

    if (ea !== null && ea < input.tolerance) {
      const residuals = equations.map((e) =>
        e.evaluateAt(Object.fromEntries(names.map((v, k) => [v, point[k]!]))),
      );
      steps.push({
        title: 'Comprobación',
        explanation: 'Se sustituye la solución en las ecuaciones: deben dar prácticamente 0.',
        result: residuals.map((v, k) => `f_{${k + 1}} = ${n(v, 4)}`).join(String.raw`,\quad `),
      });
      const summary: SummaryItem[] = [
        {
          label: 'Solución aproximada',
          value: names
            .map((v, k) => String.raw`${v} \approx ${n(point[k]!)}`)
            .join(String.raw`,\quad `),
          emphasis: true,
        },
        { label: 'Iteraciones', value: String(it) },
        { label: 'Error aproximado', value: String.raw`\varepsilon_a = ${n(ea, 4)}\,\%` },
      ];
      return {
        ok: true,
        value: { solution: point, iterations: it, residuals },
        summary,
        ...trace(),
      };
    }
  }
  return {
    ok: false,
    error: {
      code: 'max-iterations',
      message: `No se alcanzó la tolerancia en ${input.maxIterations} iteraciones. Prueba otros valores iniciales o más iteraciones.`,
    },
    ...trace(),
  };
}

export const newtonSystem: Calculator<NewtonSystemInput, NewtonSystemValue, NewtonSystemErrorCode> =
  {
    meta: {
      id: 'newton-varias-variables',
      title: 'Método de Newton para varias variables',
      summary:
        'Resuelve sistemas de ecuaciones no lineales con la matriz jacobiana en cada iteración.',
      citations: [
        {
          sourceId: 'chapra-canale-2000',
          locator:
            'Cap. 6, sec. 6.6.2, ejemplo 6.11 (Newton-Raphson para un sistema no lineal: u = x² + xy − 10, v = y + 3xy² − 57 desde (1.5, 3.5)), 5.ª ed. en español',
        },
        { sourceId: 'nakamura-1994' },
        { sourceId: 'smith-1993' },
      ],
    },
    inputSchema: newtonSystemInputSchema,
    example: {
      size: '2',
      f1: 'x^2 + x*y - 10',
      f2: 'y + 3x*y^2 - 57',
      f3: '',
      x0: 1.5,
      y0: 3.5,
      tolerance: 0.001,
      maxIterations: 50,
    },
    solve: solveNewtonSystem,
  };
