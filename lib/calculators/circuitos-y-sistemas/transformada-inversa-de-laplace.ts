/**
 * Transformada inversa de Laplace por fracciones parciales.
 *
 * El estudiante escribe F(s) como cociente de polinomios (factorizados o no), con factores e^{−as}
 * si hay retardos. La traza sigue el método de residuos: división larga si F no es propia, polos,
 * residuos, inversa de cada término con la tabla y desplazamiento en el tiempo.
 *
 * Fuentes: Hayt, Kemmerly y Durbin, 8.ª ed., sec. 14.5 (ejemplos 14.4 a 14.6); Dorf y Svoboda,
 * 9.ª ed., sec. 14.4 (ejemplos 14.4-1 a 14.4-4).
 */
import { z } from 'zod';
import type { Calculator, CalculatorResult, Series } from '../types';
import { parseTransform, transformTex } from './laplace';
import { inverseLaplace, type InverseGroup } from './laplace-inverse';

const inputSchema = z.object({
  expression: z
    .string()
    .trim()
    .min(1, 'Escribe F(s).')
    .max(300, 'La expresión es demasiado larga (máximo 300 caracteres).'),
});

export type InverseLaplaceInput = z.infer<typeof inputSchema>;

export interface InverseLaplaceValue {
  /** f(t) en LaTeX. */
  tex: string;
  groups: InverseGroup[];
}

export type InverseLaplaceErrorCode = 'expresion-invalida';

/** Horizonte de la gráfica a partir de los polos y retardos. */
export function horizonOf(groups: InverseGroup[], fallback = 10): number {
  let horizon = 0;
  for (const g of groups) {
    for (const p of g.pieces) {
      if (p.sigma < -1e-9) horizon = Math.max(horizon, g.delay + 5 / -p.sigma);
      else horizon = Math.max(horizon, g.delay + fallback / 2);
      if (p.omega > 1e-9) horizon = Math.max(horizon, g.delay + (3 * 2 * Math.PI) / p.omega);
    }
    horizon = Math.max(horizon, g.delay * 1.5);
  }
  return horizon > 0 ? horizon : fallback;
}

export function sampleSeries(
  f: (t: number) => number,
  tEnd: number,
  samples = 400,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let k = 0; k <= samples; k++) {
    const t = (k * tEnd) / samples;
    const y = f(t);
    points.push({ x: t, y: Number.isFinite(y) ? y : 0 });
  }
  return points;
}

export function solveInverseLaplace(
  input: InverseLaplaceInput,
): CalculatorResult<InverseLaplaceValue, InverseLaplaceErrorCode> {
  const parsed = parseTransform(input.expression, 's');
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'expresion-invalida', message: parsed.message },
      steps: [],
      tables: [],
      series: [],
      notices: [{ level: 'error', message: parsed.message }],
    };
  }
  const inverse = inverseLaplace(parsed.groups, 'F', 'f');
  if (!inverse.ok) {
    return {
      ok: false,
      error: { code: 'expresion-invalida', message: inverse.message },
      steps: [],
      tables: [],
      series: [],
      notices: [{ level: 'error', message: inverse.message }],
    };
  }
  const { result } = inverse;
  const tEnd = horizonOf(result.groups);
  const series: Series = {
    id: 'f',
    title: 'Función en el tiempo',
    xLabel: 't (s)',
    yLabel: 'f(t)',
    points: sampleSeries(result.evaluate, tEnd),
  };

  return {
    ok: true,
    value: { tex: result.tex, groups: result.groups },
    summary: [
      { label: 'F(s)', value: transformTex(parsed.groups) },
      { label: 'f(t)', value: `f(t) = ${result.tex}`, emphasis: true },
    ],
    steps: [
      {
        title: 'Función a invertir',
        explanation:
          'Se escribe F(s) como cociente de polinomios en s. Si hay factores e^(−as), cada término se invierte por separado y al final se desplaza en el tiempo.',
        formula: `F(s) = ${transformTex(parsed.groups)}`,
      },
      ...result.steps,
      {
        title: 'Resultado',
        explanation: 'La transformada es unilateral: el resultado vale para t ≥ 0.',
        result: `f(t) = ${result.tex}`,
      },
    ],
    tables: [result.table],
    series: [series],
    notices: result.hasImpulses
      ? [
          {
            level: 'info',
            message:
              'El resultado tiene impulsos (δ y sus derivadas) en t = 0 o en los retardos; la gráfica solo muestra la parte continua.',
          },
        ]
      : [],
  };
}

export const transformadaInversaDeLaplace: Calculator<
  InverseLaplaceInput,
  InverseLaplaceValue,
  InverseLaplaceErrorCode
> = {
  meta: {
    id: 'transformada-inversa-de-laplace',
    title: 'Transformada inversa de Laplace',
    summary:
      'Vuelve al dominio del tiempo con fracciones parciales: polos reales, complejos y repetidos.',
    citations: [
      {
        sourceId: 'hayt-kemmerly-1993',
        locator: '8.ª ed. en inglés, sec. 14.5, ejemplos 14.4 a 14.6',
      },
      {
        sourceId: 'dorf-svoboda-2000',
        locator: '9.ª ed. en inglés, sec. 14.4, ejemplos 14.4-1 a 14.4-4',
      },
    ],
  },
  inputSchema,
  // Dorf y Svoboda, 9.ª ed., ejemplo 14.4-2: polo real y par de polos complejos.
  example: { expression: '10/((s^2 + 6s + 10)(s + 2))' },
  solve: solveInverseLaplace,
};
