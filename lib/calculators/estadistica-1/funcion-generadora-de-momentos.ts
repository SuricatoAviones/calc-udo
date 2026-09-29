/**
 * Momentos a partir de la función generadora de momentos (Walpole, Myers, Myers y Ye, sec. 7.3):
 *
 *   M_X(t) = E(e^{tX})                                    (definición 7.2)
 *   μ'_r = E(X^r) = dʳM_X(t)/dtʳ en t = 0                  (teorema 7.6)
 *   μ = μ'_1,   σ² = μ'_2 − μ²
 *
 * Las derivadas son simbólicas (mathjs), así que el resultado es exacto salvo el redondeo final.
 */
import { z } from 'zod';
import { differentiate, parseFunction, type ParsedExpression } from '@/lib/math/expression';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';

/** Derivadas más largas que esto no se escriben completas en el paso. */
const MAX_TEX_LENGTH = 700;

export const mgfInputSchema = z.object({
  expression: z.string().superRefine((text, ctx) => {
    const parsed = parseFunction(text, 't');
    if (!parsed.ok) ctx.addIssue({ code: 'custom', message: parsed.message });
  }),
  moments: z
    .number({ error: 'Ingresa cuántos momentos calcular.' })
    .int('Debe ser un número entero.')
    .min(1, 'Calcula al menos 1 momento.')
    .max(4, 'El máximo es 4 momentos.'),
});

export type MgfInput = z.infer<typeof mgfInputSchema>;

export interface MgfValue {
  /** μ'_1, μ'_2, … (momentos alrededor del origen). */
  moments: number[];
  mean: number;
  /** `null` si solo se pidió un momento. */
  variance: number | null;
}

export type MgfErrorCode =
  'invalid-expression' | 'undefined-at-zero' | 'not-an-mgf' | 'not-differentiable';

type Result = CalculatorResult<MgfValue, MgfErrorCode>;

const n = toLatexNumber;

const ordinal = ['primer', 'segundo', 'tercer', 'cuarto'];

export function solveMgf(input: MgfInput): Result {
  const fail = (code: MgfErrorCode, message: string, steps: Step[] = []): Result => ({
    ok: false,
    error: { code, message },
    ...emptyTrace(),
    steps,
  });

  const parsed = parseFunction(input.expression, 't');
  if (!parsed.ok) return fail('invalid-expression', parsed.message);
  const m = parsed.expr;

  const steps: Step[] = [
    {
      title: 'Función generadora de momentos',
      explanation:
        'Al derivar M_X(t) r veces y evaluar en t = 0 se obtiene el r-ésimo momento alrededor del origen, E(Xʳ) (teorema 7.6).',
      formula:
        "M_X(t) = E(e^{tX}), \\qquad \\mu'_r = \\left.\\frac{d^r M_X(t)}{dt^r}\\right|_{t=0}",
      substitution: `M_X(t) = ${m.tex}`,
    },
  ];

  const atZero = m.evaluate(0);
  if (!Number.isFinite(atZero)) {
    return fail(
      'undefined-at-zero',
      'M(t) no está definida en t = 0 (p. ej. la de la uniforme, (e^{bt} − e^{at})/[(b − a)t], es 0/0). Usa una expresión equivalente definida en 0 o su desarrollo en serie.',
      steps,
    );
  }
  steps.push({
    title: 'Verificar M(0) = 1',
    explanation: 'Toda función generadora cumple M_X(0) = E(e⁰) = E(1) = 1.',
    substitution: `M_X(0) = ${n(atZero)}`,
  });
  if (Math.abs(atZero - 1) > 1e-9) {
    return fail(
      'not-an-mgf',
      `M(0) = ${formatNumber(atZero)} ≠ 1, así que no es una función generadora de momentos. Revisa la expresión.`,
      steps,
    );
  }

  const moments: number[] = [];
  let current: ParsedExpression = m;
  for (let r = 1; r <= input.moments; r++) {
    const derived = differentiate(current, 't');
    if (!derived.ok) return fail('not-differentiable', derived.message, steps);
    current = derived.expr;
    const value = current.evaluate(0);
    const prime = `\\mu'_{${r}}`;
    const power = r === 1 ? '' : `^{${r}}`;
    const derivative = `\\frac{d${power} M_X(t)}{dt${power}}`;
    steps.push({
      title: `${ordinal[r - 1]![0]!.toUpperCase()}${ordinal[r - 1]!.slice(1)} momento`,
      explanation:
        current.tex.length > MAX_TEX_LENGTH
          ? `Se deriva M_X(t) ${r === 1 ? 'una vez' : `${r} veces`}; la derivada es larga y se omite.`
          : undefined,
      formula: `${prime} = E(X${power}) = \\left.${derivative}\\right|_{t=0}`,
      substitution:
        current.tex.length > MAX_TEX_LENGTH ? undefined : `${derivative} = ${current.tex}`,
      result: `${prime} = ${n(value)}`,
    });
    if (!Number.isFinite(value)) {
      return fail(
        'not-differentiable',
        `La derivada ${r} no está definida en t = 0: no se puede obtener ese momento.`,
        steps,
      );
    }
    moments.push(value);
  }

  const mean = moments[0]!;
  const variance = moments.length >= 2 ? moments[1]! - mean ** 2 : null;
  steps.push({
    title: 'Media y varianza',
    formula:
      variance === null ? "\\mu = \\mu'_1" : "\\mu = \\mu'_1, \\qquad \\sigma^2 = \\mu'_2 - \\mu^2",
    substitution:
      variance === null ? undefined : `\\sigma^2 = ${n(moments[1]!)} - ${toLatexOperand(mean)}^2`,
    result:
      variance === null
        ? `\\mu = ${n(mean)}`
        : `\\mu = ${n(mean)}, \\qquad \\sigma^2 = ${n(variance)}`,
  });

  return {
    ok: true,
    value: { moments, mean, variance },
    summary: [
      { label: 'Media', value: `\\mu = ${n(mean, 6)}`, emphasis: true },
      ...(variance === null
        ? []
        : [
            { label: 'Varianza', value: `\\sigma^2 = ${n(variance, 6)}` },
            {
              label: 'Desviación estándar',
              value: `\\sigma = ${n(Math.sqrt(Math.max(0, variance)), 6)}`,
            },
          ]),
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'momentos',
        title: 'Momentos alrededor del origen',
        columns: [
          { key: 'r', header: 'r' },
          { key: 'moment', header: "\\mu'_r = E(X^r)" },
        ],
        rows: moments.map((moment, i) => ({ r: i + 1, moment })),
      },
    ],
  };
}

export const mgf: Calculator<MgfInput, MgfValue, MgfErrorCode> = {
  meta: {
    id: 'funcion-generadora-de-momentos',
    title: 'Función generadora de momentos',
    summary: 'Obtiene los momentos, la media y la varianza derivando la FGM en t = 0.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 7.3, definición 7.2, teorema 7.6, Ejemplos 7.6 y 7.7 (9.ª ed. en español)',
      },
      { sourceId: 'meyer-1998' },
      { sourceId: 'canavos-1995' },
    ],
  },
  inputSchema: mgfInputSchema,
  // Walpole, ejemplo 7.6: FGM de la binomial, (pe^t + q)^n, con n = 15 y p = 0.4 (los pacientes
  // del ejemplo 5.2).
  example: { expression: '(0.4 e^t + 0.6)^15', moments: 2 },
  solve: solveMgf,
};
