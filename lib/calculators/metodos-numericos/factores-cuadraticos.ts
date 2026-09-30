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
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
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

function listLatex(name: string, values: number[], degree: number): string {
  return values.map((v, i) => `${name}_{${degree - i}} = ${n(v)}`).join(',\\ ');
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

function rootsFromCoefficients(coefficients: number[]): { roots: ComplexRoot[]; step: Step } {
  const degree = coefficients.length - 1;
  if (degree === 1) {
    const [a1, a0] = coefficients as [number, number];
    const root = -a0 / a1;
    return {
      roots: [{ re: root, im: 0 }],
      step: {
        title: 'Queda un polinomio de grado 1',
        formula: `${polynomialLatex(coefficients)} = 0 \\;\\Rightarrow\\; x = -\\frac{a_0}{a_1}`,
        substitution: `x = -\\frac{${n(a0)}}{${n(a1)}}`,
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
      formula: 'x = \\frac{r \\pm \\sqrt{r^2 + 4s}}{2}',
      substitution: `r = ${n(r)},\\ s = ${n(s)}: \\quad x = \\frac{${n(r)} \\pm \\sqrt{${op(r)}^2 + 4${op(s)}}}{2}`,
      result: roots.map((root) => `x = ${complexLatex(root)}`).join(',\\quad '),
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
  const rows: Record<string, number | string | null>[] = [];
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
          { key: 'factor', header: '\\text{Factor}' },
          { key: 'iteration', header: '\\text{Iteración}' },
          { key: 'dr', header: '\\Delta r' },
          { key: 'ds', header: '\\Delta s' },
          { key: 'r', header: 'r' },
          { key: 's', header: 's' },
          { key: 'ear', header: '\\varepsilon_{a,r}\\,(\\%)' },
          { key: 'eas', header: '\\varepsilon_{a,s}\\,(\\%)' },
        ],
        rows,
      },
    ],
  });

  while (coefficients.length - 1 >= 3) {
    const degree = coefficients.length - 1;
    const factorNumber = factors.length + 1;
    const iterationSteps: Step[] = [];
    let converged = false;
    let iteration = 0;
    let b: number[] = [];

    while (iteration < input.maxIterations) {
      iteration++;
      b = bairstowDivision(coefficients, r, s);
      const c = bairstowDivision(b, r, s);
      const b0 = b[degree]!;
      const b1 = b[degree - 1]!;
      const c1 = c[degree - 1]!;
      const c2 = c[degree - 2]!;
      const c3 = c[degree - 3]!;
      const det = c2 * c2 - c3 * c1;
      const detailed = iteration <= DETAILED_ITERATIONS;
      const children: Step[] = [
        {
          title: 'Primera división: coeficientes b',
          formula: 'b_n = a_n,\\ b_{n-1} = a_{n-1} + r b_n,\\ b_i = a_i + r b_{i+1} + s b_{i+2}',
          result: listLatex('b', b, degree),
        },
        {
          title: 'Segunda división: coeficientes c',
          formula: 'c_n = b_n,\\ c_{n-1} = b_{n-1} + r c_n,\\ c_i = b_i + r c_{i+1} + s c_{i+2}',
          result: listLatex('c', c.slice(0, degree), degree),
        },
      ];
      if (!Number.isFinite(det) || [...b, ...c].some((v) => !Number.isFinite(v))) {
        steps.push({
          title: `Factor ${factorNumber}`,
          children: [...iterationSteps, { title: `Iteración ${iteration}`, children }],
        });
        return {
          ok: false,
          error: {
            code: 'non-finite',
            message:
              'Los coeficientes crecieron sin control: el método diverge. Prueba otros valores iniciales r₀ y s₀.',
          },
          ...trace(),
        };
      }
      if (Math.abs(det) < 1e-14 * Math.max(1, c2 * c2, Math.abs(c3 * c1))) {
        steps.push({
          title: `Factor ${factorNumber}`,
          children: [
            ...iterationSteps,
            {
              title: `Iteración ${iteration}`,
              children: [
                ...children,
                {
                  title: 'Sistema sin solución única',
                  explanation: 'El determinante c₂² − c₃c₁ es 0: no se pueden calcular Δr y Δs.',
                },
              ],
            },
          ],
        });
        return {
          ok: false,
          error: {
            code: 'singular-system',
            message:
              'El sistema para Δr y Δs no tiene solución única. Prueba otros valores iniciales r₀ y s₀.',
          },
          ...trace(),
        };
      }
      const dr = (-b1 * c2 + b0 * c3) / det;
      const ds = (-b0 * c2 + b1 * c1) / det;
      r += dr;
      s += ds;
      const ear = r === 0 ? null : Math.abs(dr / r) * 100;
      const eas = s === 0 ? null : Math.abs(ds / s) * 100;
      rows.push({ factor: factorNumber, iteration, dr, ds, r, s, ear, eas });
      converged = ear !== null && eas !== null && ear < tolerance && eas < tolerance;
      children.push(
        {
          title: 'Correcciones Δr y Δs',
          formula:
            '\\begin{aligned} c_2\\,\\Delta r + c_3\\,\\Delta s &= -b_1 \\\\ c_1\\,\\Delta r + c_2\\,\\Delta s &= -b_0 \\end{aligned}',
          substitution: `\\begin{aligned} ${n(c2)}\\,\\Delta r + ${op(c3)}\\,\\Delta s &= ${n(-b1)} \\\\ ${n(c1)}\\,\\Delta r + ${op(c2)}\\,\\Delta s &= ${n(-b0)} \\end{aligned}`,
          result: `\\Delta r = ${n(dr)},\\quad \\Delta s = ${n(ds)}`,
        },
        {
          title: 'Nuevos r y s',
          formula: 'r \\leftarrow r + \\Delta r, \\qquad s \\leftarrow s + \\Delta s',
          result: `r = ${n(r)},\\quad s = ${n(s)}`,
        },
        {
          title: 'Errores aproximados',
          explanation: converged
            ? `Ambos errores son menores que εs = ${formatNumber(tolerance)} %: el factor convergió.`
            : `Algún error no es menor que εs = ${formatNumber(tolerance)} %: se sigue iterando.`,
          formula:
            '\\varepsilon_{a,r} = \\left|\\frac{\\Delta r}{r}\\right| 100\\%, \\quad \\varepsilon_{a,s} = \\left|\\frac{\\Delta s}{s}\\right| 100\\%',
          result: `\\varepsilon_{a,r} = ${ear === null ? '\\text{—}' : `${n(ear)}\\,\\%`},\\quad \\varepsilon_{a,s} = ${eas === null ? '\\text{—}' : `${n(eas)}\\,\\%`}`,
        },
      );
      if (detailed || converged || iteration === input.maxIterations) {
        iterationSteps.push({ title: `Iteración ${iteration}`, children });
      } else if (iteration === DETAILED_ITERATIONS + 1) {
        iterationSteps.push({
          title: 'Iteraciones siguientes',
          explanation:
            'Se repite el mismo procedimiento; los valores están en la tabla de iteraciones.',
        });
      }
      if (converged) break;
    }

    if (!converged) {
      steps.push({ title: `Factor ${factorNumber}`, children: iterationSteps });
      return {
        ok: false,
        error: {
          code: 'max-iterations',
          message: `El factor ${factorNumber} no convergió en ${input.maxIterations} iteraciones. Aumenta el máximo o prueba otros r₀ y s₀.`,
        },
        ...trace(),
      };
    }

    // Se recalcula b con los r y s finales para deflactar.
    b = bairstowDivision(coefficients, r, s);
    const factorRoots = quadraticFactorRoots(r, s);
    const quotient = b.slice(0, degree - 1);
    factors.push({ r, s, roots: factorRoots, iterations: iteration });
    roots.push(...factorRoots);
    iterationSteps.push({
      title: 'Raíces del factor',
      formula: 'x = \\frac{r \\pm \\sqrt{r^2 + 4s}}{2}',
      substitution: `x = \\frac{${n(r)} \\pm \\sqrt{${op(r)}^2 + 4${op(s)}}}{2}`,
      result: factorRoots.map((root) => `x = ${complexLatex(root)}`).join(',\\quad '),
    });
    iterationSteps.push({
      title: 'Polinomio deflactado',
      explanation:
        'El cociente de la división entre el factor cuadrático conserva las raíces restantes.',
      result: `f(x) \\approx (x^2 ${r < 0 ? '+' : '-'} ${n(Math.abs(r))}x ${s < 0 ? '+' : '-'} ${n(Math.abs(s))})(${polynomialLatex(quotient)})`,
    });
    steps.push({
      title: `Factor ${factorNumber}: ${iteration} iteraciones`,
      children: iterationSteps,
      result: `x^2 - r x - s \\text{ con } r = ${n(r)},\\ s = ${n(s)}`,
    });
    coefficients = quotient;
  }

  const last = rootsFromCoefficients(coefficients);
  roots.push(...last.roots);
  steps.push(last.step);

  const summary: SummaryItem[] = [
    {
      label: 'Raíces',
      value: roots.map((root) => complexLatex(root)).join(',\\quad '),
      emphasis: true,
    },
    ...factors.map((f, i) => ({
      label: `Factor ${i + 1}`,
      value: `x^2 ${f.r < 0 ? '+' : '-'} ${n(Math.abs(f.r))}x ${f.s < 0 ? '+' : '-'} ${n(Math.abs(f.s))}`,
    })),
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
          { key: 'root', header: '\\text{Raíz}', format: 'latex' },
          { key: 're', header: '\\text{Parte real}' },
          { key: 'im', header: '\\text{Parte imaginaria}' },
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
          'Cap. 7, sec. 7.5 (método de Bairstow, ejemplo con f₅(x) = x⁵ − 3.5x⁴ + 2.75x³ + 2.125x² − 3.875x + 1.25), 5.ª ed. en español',
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
