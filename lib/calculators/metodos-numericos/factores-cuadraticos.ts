/**
 * Método de Bairstow (Chapra & Canale, sec. 7.5): extrae del polinomio factores cuadráticos
 * x² − r x − s, que dan dos raíces (reales o complejas conjugadas) cada uno.
 *
 * División sintética entre x² − r x − s (ec. 7.37):
 *   bₙ = aₙ,  bₙ₋₁ = aₙ₋₁ + r bₙ,  b_i = a_i + r b_{i+1} + s b_{i+2}
 * Segunda división (ec. 7.39):
 *   cₙ = bₙ,  cₙ₋₁ = bₙ₋₁ + r cₙ,  c_i = b_i + r c_{i+1} + s c_{i+2}
 * Correcciones (ec. 7.39), para que el residuo b₁(x − r) + b₀ sea 0:
 *   c₂ Δr + c₃ Δs = −b₁
 *   c₁ Δr + c₂ Δs = −b₀
 * Errores (ec. 7.40): ε_{a,r} = |Δr / r| × 100 %,  ε_{a,s} = |Δs / s| × 100 %.
 *
 * Al converger, las raíces del factor son x = [r ± √(r² + 4s)] / 2 (ec. 7.41) y el cociente
 * (bₙ … b₂) es el polinomio deflactado, al que se aplica de nuevo el método partiendo de los
 * últimos r y s. Si queda un polinomio de grado 2 o 1, se resuelve directamente.
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand, TEX } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Step,
  type SummaryItem,
} from '../types';
import {
  coefficientsField,
  complexLatex,
  parseCoefficients,
  polynomialLatex,
  quadraticFactorRoots,
  type ComplexRoot,
} from './polynomial';
import { finiteNumber, maxIterationsField, toleranceField } from './root-finding';

export const bairstowInputSchema = z.object({
  coefficients: coefficientsField(2),
  r0: finiteNumber('r₀'),
  s0: finiteNumber('s₀'),
  tolerance: toleranceField,
  maxIterations: maxIterationsField,
});

export type BairstowInput = z.infer<typeof bairstowInputSchema>;

export interface BairstowFactor {
  r: number;
  s: number;
  roots: ComplexRoot[];
  iterations: number;
}

export interface BairstowValue {
  roots: ComplexRoot[];
  factors: BairstowFactor[];
  /** Factor final de grado 1 o 2 resuelto directamente. */
  remainder: number[];
}

export type BairstowErrorCode = 'max-iterations' | 'singular-system' | 'non-finite';

type Result = CalculatorResult<BairstowValue, BairstowErrorCode>;

const n = (v: number) => toLatexNumber(v, 7);
const op = (v: number) => toLatexOperand(v, 7);

/** Con más iteraciones que esto por factor, solo se detallan las primeras y la última. */
const DETAILED_ITERATIONS = 6;

type Row = Record<string, number | string | null>;

function listLatex(name: string, values: number[], degree: number): string {
  return values.map((v, i) => `${name}_{${degree - i}} = ${n(v)}`).join(String.raw`,\ `);
}

/** Primera o segunda división de Bairstow (b a partir de a, o c a partir de b). */
function bairstowDivision(values: number[], r: number, s: number): number[] {
  const out: number[] = [];
  values.forEach((v, i) => {
    const prev1 = out[i - 1] ?? 0;
    const prev2 = out[i - 2] ?? 0;
    out.push(v + r * prev1 + s * prev2);
  });
  return out;
}

/** x² − r x − s con los signos ya resueltos. */
function factorTex(r: number, s: number): string {
  const rSign = r < 0 ? '+' : '-';
  const sSign = s < 0 ? '+' : '-';
  return `x^2 ${rSign} ${n(Math.abs(r))}x ${sSign} ${n(Math.abs(s))}`;
}

/** |Δ / valor| × 100 %; `null` si el valor es 0. */
function relativeError(delta: number, value: number): number | null {
  return value === 0 ? null : Math.abs(delta / value) * 100;
}

/** εa con su %, o una raya si no está definido. */
function errorTex(e: number | null): string {
  return e === null ? TEX.dash : String.raw`${n(e)}\,\%`;
}

function divisionSteps(b: number[], c: number[], degree: number): Step[] {
  return [
    {
      title: 'Primera división: coeficientes b',
      formula: String.raw`b_n = a_n,\ b_{n-1} = a_{n-1} + r b_n,\ b_i = a_i + r b_{i+1} + s b_{i+2}`,
      result: listLatex('b', b, degree),
    },
    {
      title: 'Segunda división: coeficientes c',
      formula: String.raw`c_n = b_n,\ c_{n-1} = b_{n-1} + r c_n,\ c_i = b_i + r c_{i+1} + s c_{i+2}`,
      result: listLatex('c', c.slice(0, degree), degree),
    },
  ];
}

interface Correction {
  b0: number;
  b1: number;
  c1: number;
  c2: number;
  c3: number;
  dr: number;
  ds: number;
}

function correctionSteps(
  { b0, b1, c1, c2, c3, dr, ds }: Correction,
  r: number,
  s: number,
  errors: { ear: number | null; eas: number | null; converged: boolean; tolerance: number },
): Step[] {
  const { ear, eas, converged, tolerance } = errors;
  return [
    {
      title: 'Correcciones Δr y Δs',
      formula: String.raw`\begin{aligned} c_2\,\Delta r + c_3\,\Delta s &= -b_1 \\ c_1\,\Delta r + c_2\,\Delta s &= -b_0 \end{aligned}`,
      substitution: String.raw`\begin{aligned} ${n(c2)}\,\Delta r + ${op(c3)}\,\Delta s &= ${n(-b1)} \\ ${n(c1)}\,\Delta r + ${op(c2)}\,\Delta s &= ${n(-b0)} \end{aligned}`,
      result: String.raw`\Delta r = ${n(dr)},\quad \Delta s = ${n(ds)}`,
    },
    {
      title: 'Nuevos r y s',
      formula: String.raw`r \leftarrow r + \Delta r, \qquad s \leftarrow s + \Delta s`,
      result: String.raw`r = ${n(r)},\quad s = ${n(s)}`,
    },
    {
      title: 'Errores aproximados',
      explanation: converged
        ? `Ambos errores son menores que εs = ${formatNumber(tolerance)} %: el factor convergió.`
        : `Algún error no es menor que εs = ${formatNumber(tolerance)} %: se sigue iterando.`,
      formula: String.raw`\varepsilon_{a,r} = \left|\frac{\Delta r}{r}\right| 100\%, \quad \varepsilon_{a,s} = \left|\frac{\Delta s}{s}\right| 100\%`,
      result: String.raw`\varepsilon_{a,r} = ${errorTex(ear)},\quad \varepsilon_{a,s} = ${errorTex(eas)}`,
    },
  ];
}

interface FactorSearch {
  r: number;
  s: number;
  tolerance: number;
  maxIterations: number;
  factorNumber: number;
}

type FactorOutcome =
  | { ok: true; r: number; s: number; iterations: number; steps: Step[] }
  | { ok: false; code: BairstowErrorCode; message: string; steps: Step[] };

/** Itera r y s hasta que el residuo del factor cuadrático se anule (o falle). */
function findFactor(coefficients: number[], search: FactorSearch, rows: Row[]): FactorOutcome {
  const { tolerance, maxIterations, factorNumber } = search;
  const degree = coefficients.length - 1;
  let { r, s } = search;
  const iterationSteps: Step[] = [];
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const b = bairstowDivision(coefficients, r, s);
    const c = bairstowDivision(b, r, s);
    const b0 = b[degree]!;
    const b1 = b[degree - 1]!;
    const c1 = c[degree - 1]!;
    const c2 = c[degree - 2]!;
    const c3 = c[degree - 3]!;
    const det = c2 * c2 - c3 * c1;
    const children = divisionSteps(b, c, degree);
    const title = `Iteración ${iteration}`;
    if (!Number.isFinite(det) || [...b, ...c].some((v) => !Number.isFinite(v))) {
      return {
        ok: false,
        code: 'non-finite',
        message:
          'Los coeficientes crecieron sin control: el método diverge. Prueba otros valores iniciales r₀ y s₀.',
        steps: [...iterationSteps, { title, children }],
      };
    }
    if (Math.abs(det) < 1e-14 * Math.max(1, c2 * c2, Math.abs(c3 * c1))) {
      const singular: Step = {
        title: 'Sistema sin solución única',
        explanation: 'El determinante c₂² − c₃c₁ es 0: no se pueden calcular Δr y Δs.',
      };
      return {
        ok: false,
        code: 'singular-system',
        message:
          'El sistema para Δr y Δs no tiene solución única. Prueba otros valores iniciales r₀ y s₀.',
        steps: [...iterationSteps, { title, children: [...children, singular] }],
      };
    }
    const dr = (-b1 * c2 + b0 * c3) / det;
    const ds = (-b0 * c2 + b1 * c1) / det;
    r += dr;
    s += ds;
    const ear = relativeError(dr, r);
    const eas = relativeError(ds, s);
    rows.push({ factor: factorNumber, iteration, dr, ds, r, s, ear, eas });
    const converged = ear !== null && eas !== null && ear < tolerance && eas < tolerance;
    children.push(
      ...correctionSteps({ b0, b1, c1, c2, c3, dr, ds }, r, s, { ear, eas, converged, tolerance }),
    );
    if (iteration <= DETAILED_ITERATIONS || converged || iteration === maxIterations) {
      iterationSteps.push({ title, children });
    } else if (iteration === DETAILED_ITERATIONS + 1) {
      iterationSteps.push({
        title: 'Iteraciones siguientes',
        explanation:
          'Se repite el mismo procedimiento; los valores están en la tabla de iteraciones.',
      });
    }
    if (converged) return { ok: true, r, s, iterations: iteration, steps: iterationSteps };
  }
  return {
    ok: false,
    code: 'max-iterations',
    message: `El factor ${factorNumber} no convergió en ${maxIterations} iteraciones. Aumenta el máximo o prueba otros r₀ y s₀.`,
    steps: iterationSteps,
  };
}

function rootsFromCoefficients(coefficients: number[]): { roots: ComplexRoot[]; step: Step } {
  const degree = coefficients.length - 1;
  if (degree === 1) {
    const [a1, a0] = coefficients as [number, number];
    const root = -a0 / a1;
    return {
      roots: [{ re: root, im: 0 }],
      step: {
        title: 'Queda un polinomio de grado 1',
        formula: String.raw`${polynomialLatex(coefficients)} = 0 \;\Rightarrow\; x = -\frac{a_0}{a_1}`,
        substitution: String.raw`x = -\frac{${n(a0)}}{${n(a1)}}`,
        result: `x = ${n(root)}`,
      },
    };
  }
  // Grado 2: se escribe como a₂(x² − r x − s) con r = −a₁/a₂ y s = −a₀/a₂ (Chapra, fig. 7.5).
  const [a2, a1, a0] = coefficients as [number, number, number];
  const r = -a1 / a2;
  const s = -a0 / a2;
  const roots = quadraticFactorRoots(r, s);
  return {
    roots,
    step: {
      title: 'Queda un polinomio de grado 2',
      explanation:
        'Se resuelve directamente: dividiendo entre el coeficiente principal queda x² − r x − s con r = −a₁/a₂ y s = −a₀/a₂.',
      formula: String.raw`x = \frac{r \pm \sqrt{r^2 + 4s}}{2}`,
      substitution: String.raw`r = ${n(r)},\ s = ${n(s)}: \quad x = \frac{${n(r)} \pm \sqrt{${op(r)}^2 + 4${op(s)}}}{2}`,
      result: roots.map((root) => `x = ${complexLatex(root)}`).join(String.raw`,\quad `),
    },
  };
}

export function solveBairstow(input: BairstowInput): Result {
  let coefficients = parseCoefficients(input.coefficients) as number[];
  const tolerance = input.tolerance;
  let r = input.r0;
  let s = input.s0;
  const steps: Step[] = [
    {
      title: 'Polinomio',
      explanation: `Grado ${coefficients.length - 1}. Se buscan factores x² − r x − s empezando con r₀ = ${formatNumber(r)} y s₀ = ${formatNumber(s)}, hasta que εa,r y εa,s sean menores que εs = ${formatNumber(tolerance)} %.`,
      result: `f(x) = ${polynomialLatex(coefficients)}`,
    },
  ];
  const rows: Row[] = [];
  const factors: BairstowFactor[] = [];
  const roots: ComplexRoot[] = [];
  const trace = () => ({
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'iteraciones',
        title: 'Iteraciones',
        columns: [
          { key: 'factor', header: String.raw`\text{Factor}` },
          { key: 'iteration', header: String.raw`\text{Iteración}` },
          { key: 'dr', header: String.raw`\Delta r` },
          { key: 'ds', header: String.raw`\Delta s` },
          { key: 'r', header: 'r' },
          { key: 's', header: 's' },
          { key: 'ear', header: String.raw`\varepsilon_{a,r}\,(\%)` },
          { key: 'eas', header: String.raw`\varepsilon_{a,s}\,(\%)` },
        ],
        rows,
      },
    ],
  });

  while (coefficients.length - 1 >= 3) {
    const degree = coefficients.length - 1;
    const factorNumber = factors.length + 1;
    const found = findFactor(
      coefficients,
      { r, s, tolerance, maxIterations: input.maxIterations, factorNumber },
      rows,
    );
    if (!found.ok) {
      steps.push({ title: `Factor ${factorNumber}`, children: found.steps });
      return { ok: false, error: { code: found.code, message: found.message }, ...trace() };
    }
    ({ r, s } = found);

    // Se recalcula b con los r y s finales para deflactar.
    const b = bairstowDivision(coefficients, r, s);
    const factorRoots = quadraticFactorRoots(r, s);
    const quotient = b.slice(0, degree - 1);
    factors.push({ r, s, roots: factorRoots, iterations: found.iterations });
    roots.push(...factorRoots);
    steps.push({
      title: `Factor ${factorNumber}: ${found.iterations} iteraciones`,
      children: [
        ...found.steps,
        {
          title: 'Raíces del factor',
          formula: String.raw`x = \frac{r \pm \sqrt{r^2 + 4s}}{2}`,
          substitution: String.raw`x = \frac{${n(r)} \pm \sqrt{${op(r)}^2 + 4${op(s)}}}{2}`,
          result: factorRoots.map((root) => `x = ${complexLatex(root)}`).join(String.raw`,\quad `),
        },
        {
          title: 'Polinomio deflactado',
          explanation:
            'El cociente de la división entre el factor cuadrático conserva las raíces restantes.',
          result: String.raw`f(x) \approx (${factorTex(r, s)})(${polynomialLatex(quotient)})`,
        },
      ],
      result: String.raw`x^2 - r x - s \text{ con } r = ${n(r)},\ s = ${n(s)}`,
    });
    coefficients = quotient;
  }

  const last = rootsFromCoefficients(coefficients);
  roots.push(...last.roots);
  steps.push(last.step);

  const summary: SummaryItem[] = [
    {
      label: 'Raíces',
      value: roots.map((root) => complexLatex(root)).join(String.raw`,\quad `),
      emphasis: true,
    },
    ...factors.map((f, i) => ({ label: `Factor ${i + 1}`, value: factorTex(f.r, f.s) })),
  ];
  const result = trace();
  return {
    ok: true,
    value: { roots, factors, remainder: coefficients },
    summary,
    ...result,
    tables: [
      ...result.tables,
      {
        id: 'raices',
        title: 'Raíces',
        columns: [
          { key: 'root', header: String.raw`\text{Raíz}`, format: 'latex' },
          { key: 're', header: String.raw`\text{Parte real}` },
          { key: 'im', header: String.raw`\text{Parte imaginaria}` },
        ],
        rows: roots.map((root) => ({ root: complexLatex(root), re: root.re, im: root.im })),
      },
    ],
  };
}

export const bairstow: Calculator<BairstowInput, BairstowValue, BairstowErrorCode> = {
  meta: {
    id: 'factores-cuadraticos',
    title: 'Factores cuadráticos (método de Bairstow)',
    summary:
      'Extrae factores x² − rx − s de un polinomio y obtiene todas sus raíces, reales y complejas.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator:
          'Cap. 7, sec. 7.5, ejemplo 7.3 (método de Bairstow con f₅(x) = x⁵ − 3.5x⁴ + 2.75x³ + 2.125x² − 3.875x + 1.25), 5.ª ed. en español',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'smith-1993' },
    ],
  },
  inputSchema: bairstowInputSchema,
  example: {
    coefficients: '1 -3.5 2.75 2.125 -3.875 1.25',
    r0: -1,
    s0: -1,
    tolerance: 1,
    maxIterations: 50,
  },
  solve: solveBairstow,
};
