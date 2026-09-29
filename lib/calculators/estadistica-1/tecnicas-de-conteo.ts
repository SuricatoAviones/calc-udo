/**
 * Técnicas de conteo (Walpole, Myers, Myers y Ye, sec. 2.3):
 *
 *   Regla de multiplicación (regla 2.1), con repetición:   nʳ
 *   Permutaciones de n tomados de r (teorema 2.2):          ₙPᵣ = n! / (n − r)!
 *   Permutaciones circulares (teorema 2.3):                 (n − 1)!
 *   Permutaciones con objetos repetidos (teorema 2.4):      n! / (n₁! n₂! ⋯ n_k!)
 *   Particiones en celdas (teorema 2.5):                    n! / (n₁! n₂! ⋯ n_r!)
 *   Combinaciones (teorema 2.6):                            C(n, r) = n! / [r! (n − r)!]
 *
 * Los conteos se calculan con enteros exactos (`bigint`), así que no se pierden cifras.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { toLatexNumber } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Latex,
  type Step,
} from '../types';

export const countingTypes = [
  'permutaciones',
  'combinaciones',
  'con-repeticion',
  'circulares',
  'objetos-repetidos',
  'particiones',
] as const;
export type CountingType = (typeof countingTypes)[number];

const MAX_N = 1000;
/** Con más factores que esto no se escribe el producto desarrollado. */
const MAX_EXPANDED = 12;
/** Con más cifras que esto el resultado se muestra en notación científica. */
const MAX_DIGITS = 30;

const integer = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .int(`${label} debe ser un número entero.`)
    .min(0, `${label} no puede ser negativo.`)
    .max(MAX_N, `El máximo permitido es ${MAX_N}.`);

/** Tamaños de los grupos: enteros no negativos separados por espacios o comas. */
function parseGroups(text: string | undefined): number[] | string {
  const { values, invalid } = parseDataList(text ?? '');
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  if (values.length === 0) return 'Escribe cuántos objetos hay de cada clase, p. ej. 3 3 2 1 1.';
  if (values.some((v) => !Number.isInteger(v) || v < 0)) {
    return 'Cada tamaño debe ser un entero no negativo.';
  }
  const total = values.reduce((s, v) => s + v, 0);
  if (total < 1) return 'Al menos un grupo debe tener objetos.';
  if (total > MAX_N) return `El total de objetos no puede pasar de ${MAX_N}.`;
  return values;
}

const usesGroups = (type: CountingType) => type === 'objetos-repetidos' || type === 'particiones';
const usesR = (type: CountingType) =>
  type === 'permutaciones' || type === 'combinaciones' || type === 'con-repeticion';

export const countingInputSchema = z
  .object({
    type: z.enum(countingTypes, { error: 'Elige qué quieres contar.' }),
    n: integer('n').optional(),
    r: integer('r').optional(),
    groups: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (usesGroups(v.type)) {
      const groups = parseGroups(v.groups);
      if (typeof groups === 'string')
        ctx.addIssue({ code: 'custom', path: ['groups'], message: groups });
      return;
    }
    if (v.n === undefined) {
      ctx.addIssue({ code: 'custom', path: ['n'], message: 'Ingresa n.' });
      return;
    }
    if (v.type === 'circulares' && v.n < 1) {
      ctx.addIssue({ code: 'custom', path: ['n'], message: 'Hace falta al menos un objeto.' });
    }
    if (usesR(v.type)) {
      if (v.r === undefined) {
        ctx.addIssue({ code: 'custom', path: ['r'], message: 'Ingresa r.' });
      } else if (v.type !== 'con-repeticion' && v.r > v.n) {
        ctx.addIssue({
          code: 'custom',
          path: ['r'],
          message: 'Sin repetición no se pueden tomar más objetos (r) de los que hay (n).',
        });
      }
    }
  });

export type CountingInput = z.infer<typeof countingInputSchema>;

export interface CountingValue {
  /** El conteo como número (puede perder cifras si es enorme). */
  count: number;
  /** El conteo exacto, en base 10. */
  exact: string;
}

export type CountingErrorCode = 'invalid-input';

function factorial(m: number): bigint {
  let result = 1n;
  for (let i = 2n; i <= BigInt(m); i++) result *= i;
  return result;
}

/** n (n − 1) ⋯ (n − r + 1) */
function fallingFactorial(m: number, r: number): bigint {
  let result = 1n;
  for (let i = 0; i < r; i++) result *= BigInt(m - i);
  return result;
}

/** Entero exacto → LaTeX; los muy grandes en notación científica. */
function bigLatex(value: bigint): Latex {
  const digits = value.toString();
  if (digits.length <= MAX_DIGITS) return digits;
  const mantissa = `${digits[0]}.${digits.slice(1, 7)}`;
  return `${mantissa} \\times 10^{${digits.length - 1}}`;
}

/** n (n − 1) ⋯ (n − r + 1) escrito con puntos, si no es muy largo. */
function expandedProduct(m: number, r: number): Latex | undefined {
  if (r < 1 || r > MAX_EXPANDED) return undefined;
  return Array.from({ length: r }, (_, i) => m - i).join(' \\cdot ');
}

const LABEL: Record<CountingType, string> = {
  permutaciones: 'Permutaciones',
  combinaciones: 'Combinaciones',
  'con-repeticion': 'Arreglos con repetición',
  circulares: 'Permutaciones circulares',
  'objetos-repetidos': 'Permutaciones con objetos repetidos',
  particiones: 'Particiones',
};

export function solveCounting(
  input: CountingInput,
): CalculatorResult<CountingValue, CountingErrorCode> {
  const { type } = input;
  const groups = usesGroups(type) ? parseGroups(input.groups) : [];
  if (typeof groups === 'string' || (!usesGroups(type) && input.n === undefined)) {
    return {
      ok: false,
      error: {
        code: 'invalid-input',
        message: typeof groups === 'string' ? groups : 'Ingresa n.',
      },
      ...emptyTrace(),
    };
  }
  const n = usesGroups(type) ? groups.reduce((s, g) => s + g, 0) : input.n!;
  const r = input.r ?? 0;
  if (usesR(type) && (input.r === undefined || (type !== 'con-repeticion' && r > n))) {
    return {
      ok: false,
      error: { code: 'invalid-input', message: 'r debe estar entre 0 y n.' },
      ...emptyTrace(),
    };
  }

  const steps: Step[] = [];
  let count: bigint;
  let symbol: Latex;

  switch (type) {
    case 'permutaciones': {
      count = fallingFactorial(n, r);
      symbol = `{}_{${n}}P_{${r}}`;
      const expanded = expandedProduct(n, r);
      steps.push(
        {
          title: 'Identificar el conteo',
          explanation:
            'El orden importa y no se repiten objetos: se eligen r de n objetos distintos y se acomodan en r posiciones distinguibles (p. ej. presidente y tesorero). Con r = n es n!.',
          formula: '{}_{n}P_{r} = \\frac{n!}{(n-r)!} = n(n-1)\\cdots(n-r+1)',
        },
        {
          title: 'Sustituir',
          substitution: `${symbol} = \\frac{${n}!}{(${n} - ${r})!} = \\frac{${n}!}{${n - r}!}${expanded ? ` = ${expanded}` : ''}`,
          result: `${symbol} = ${bigLatex(count)}`,
        },
      );
      break;
    }
    case 'combinaciones': {
      const k = Math.min(r, n - r);
      count = fallingFactorial(n, k) / factorial(k);
      symbol = `\\binom{${n}}{${r}}`;
      const expanded = expandedProduct(n, k);
      steps.push(
        {
          title: 'Identificar el conteo',
          explanation:
            'El orden no importa: solo cuenta qué r objetos se eligen de los n. Cada selección aparece r! veces entre las permutaciones, por eso se divide entre r!.',
          formula: '\\binom{n}{r} = \\frac{n!}{r!\\,(n-r)!}',
        },
        {
          title: 'Sustituir',
          explanation:
            k !== r && expanded
              ? `Como C(n, r) = C(n, n − r), se simplifica con el menor de r y n − r (${k}).`
              : undefined,
          substitution: `${symbol} = \\frac{${n}!}{${r}!\\,(${n} - ${r})!}${expanded ? ` = \\frac{${expanded}}{${k}!}` : ''}`,
          result: `${symbol} = ${bigLatex(count)}`,
        },
      );
      break;
    }
    case 'con-repeticion': {
      count = BigInt(n) ** BigInt(r);
      symbol = `${n}^{${r}}`;
      steps.push(
        {
          title: 'Identificar el conteo',
          explanation:
            'Cada una de las r posiciones puede ocuparse con cualquiera de los n objetos, aunque se repitan. Por la regla de multiplicación son n · n ⋯ n, r veces.',
          formula: 'n^r',
        },
        { title: 'Sustituir', substitution: symbol, result: `${symbol} = ${bigLatex(count)}` },
      );
      break;
    }
    case 'circulares': {
      count = factorial(n - 1);
      symbol = `(${n} - 1)!`;
      steps.push(
        {
          title: 'Identificar el conteo',
          explanation:
            'En un círculo, girar a todos una posición no produce un arreglo nuevo. Se fija un objeto como referencia y se ordenan los otros n − 1.',
          formula: '(n-1)!',
        },
        {
          title: 'Sustituir',
          substitution: `(${n} - 1)! = ${n - 1}!`,
          result: `${n - 1}! = ${bigLatex(count)}`,
        },
      );
      break;
    }
    case 'objetos-repetidos':
    case 'particiones': {
      count = groups.reduce((acc, g) => acc / factorial(g), factorial(n));
      symbol = `\\binom{${n}}{${groups.join(', ')}}`;
      const denominators = groups.map((g) => `${g}!`).join('\\,');
      const values = n <= 20 ? groups.map((g) => factorial(g).toString()) : [];
      steps.push(
        {
          title: 'Identificar el conteo',
          explanation:
            type === 'particiones'
              ? 'Se reparten n objetos en celdas con n₁, n₂, … elementos; el orden dentro de cada celda no importa, así que se divide n! entre las permutaciones de cada celda.'
              : 'Permutaciones de n objetos donde n₁ son de una clase, n₂ de otra, etc. Los objetos de una misma clase no se distinguen, así que se divide n! entre las permutaciones de cada clase.',
          formula:
            type === 'particiones'
              ? '\\binom{n}{n_1, n_2, \\ldots, n_r} = \\frac{n!}{n_1!\\,n_2!\\cdots n_r!}'
              : '\\frac{n!}{n_1!\\,n_2!\\cdots n_k!}',
        },
        {
          title: 'Total de objetos',
          formula: 'n = n_1 + n_2 + \\cdots',
          substitution: `n = ${groups.join(' + ')}`,
          result: `n = ${n}`,
        },
        {
          title: 'Sustituir',
          substitution:
            `\\frac{${n}!}{${denominators}}` +
            (values.length > 0
              ? ` = \\frac{${factorial(n)}}{${values.map((v) => `(${v})`).join('')}}`
              : ''),
          result: `${symbol} = ${bigLatex(count)}`,
        },
      );
      break;
    }
  }

  return {
    ok: true,
    value: { count: Number(count), exact: count.toString() },
    summary: [
      { label: LABEL[type], value: `${symbol} = ${bigLatex(count)}`, emphasis: true },
      ...(count.toString().length > 15
        ? [{ label: 'Cifras', value: toLatexNumber(count.toString().length) }]
        : []),
    ],
    ...emptyTrace(),
    steps,
  };
}

export const counting: Calculator<CountingInput, CountingValue, CountingErrorCode> = {
  meta: {
    id: 'tecnicas-de-conteo',
    title: 'Permutaciones y combinaciones',
    summary: 'Cuenta arreglos y selecciones con y sin orden, en círculo o con objetos repetidos.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 2.3, teoremas 2.1 a 2.6, Ejemplos 2.13 y 2.18 a 2.23 (9.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: countingInputSchema,
  // Walpole, ejemplo 2.18: tres premios distintos entre 25 estudiantes.
  example: { type: 'permutaciones', n: 25, r: 3 },
  solve: solveCounting,
};
