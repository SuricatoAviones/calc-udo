/**
 * Conversión entre sistemas de numeración (Tucker y Joyanes). El número se pasa primero a
 * base 10 con su desarrollo posicional (Σ dᵢ·bⁱ) y de ahí a la base de destino: la parte entera
 * por divisiones sucesivas y la fraccionaria por multiplicaciones sucesivas. Entre las bases 2,
 * 8 y 16 se muestra además el atajo de agrupar bits de a 3 o de a 4.
 */
import { z } from 'zod';
import { latexLines } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Notice,
  type ResultTable,
  type Step,
} from '../types';
import {
  digitChar,
  fractionValue,
  integerDigits,
  integerValue,
  MAX_BASE,
  MAX_FRACTION_DIGITS,
  MAX_INTEGER,
  MIN_BASE,
  numeralLatex,
  numeralText,
  parseNumeral,
  successiveDivisions,
  successiveMultiplications,
} from './numeration';

const baseField = (label: string) =>
  z
    .number({ error: `Escribe la base ${label}.` })
    .int(`La base ${label} debe ser un entero.`)
    .min(MIN_BASE, `La base ${label} debe estar entre ${MIN_BASE} y ${MAX_BASE}.`)
    .max(MAX_BASE, `La base ${label} debe estar entre ${MIN_BASE} y ${MAX_BASE}.`);

export const numeralInputSchema = z
  .object({
    number: z
      .string({ error: 'Escribe el número.' })
      .trim()
      .min(1, 'Escribe el número.')
      .max(40, 'El número es demasiado largo.'),
    from: baseField('de origen'),
    to: baseField('de destino'),
  })
  .superRefine((v, ctx) => {
    if (!Number.isInteger(v.from) || v.from < MIN_BASE || v.from > MAX_BASE) return;
    const parsed = parseNumeral(v.number, v.from);
    if (typeof parsed === 'string') {
      ctx.addIssue({
        code: 'custom',
        path: ['number'],
        message: `${parsed[0]!.toUpperCase()}${parsed.slice(1)}.`,
      });
    } else if (integerValue(parsed.intDigits, v.from) > MAX_INTEGER) {
      ctx.addIssue({
        code: 'custom',
        path: ['number'],
        message: 'La parte entera es demasiado grande (máximo 2⁶⁴ − 1).',
      });
    }
  });
export type NumeralInput = z.infer<typeof numeralInputSchema>;

export interface NumeralValue {
  /** Resultado en la base de destino, p. ej. "11001.011". */
  result: string;
  /** Valor en base 10 como fracción exacta, p. ej. "203/8". */
  exactDecimal: string;
  /** La parte fraccionaria no termina en la base de destino. */
  periodic: boolean;
  truncated: boolean;
}

export type NumeralErrorCode = 'invalid-number';

const bigLatex = (n: bigint) => String(n);

/** Desarrollo posicional: 1·2⁴ + 1·2³ + … */
function positionalLatex(intDigits: number[], fracDigits: number[], base: number): string {
  const terms = [
    ...intDigits.map((d, k) => `${d}\\cdot ${base}^{${intDigits.length - 1 - k}}`),
    ...fracDigits.map((d, k) => `${d}\\cdot ${base}^{-${k + 1}}`),
  ];
  // Con muchos dígitos se parte en renglones de 6 términos.
  const lines: string[] = [];
  for (let k = 0; k < terms.length; k += 6) lines.push(terms.slice(k, k + 6).join(' + '));
  return latexLines(lines.map((line, k) => (k === 0 ? `N = ${line}` : `\\quad + ${line}`)));
}

/** Decimal exacto o con puntos suspensivos (hasta 12 decimales), en LaTeX. */
function decimalLatex(negative: boolean, int: bigint, frac: Rational): string {
  const expansion = successiveMultiplications(frac, 10);
  return numeralLatex(negative, integerDigits(int, 10), expansion.digits, 10, {
    periodStart: expansion.periodStart,
    truncated: expansion.truncated,
  });
}

const GROUPS: Record<number, number> = { 8: 3, 16: 4 };
const POWER: Record<number, string> = { 3: '2³', 4: '2⁴' };

/** Atajo 2 → 8/16 (agrupar bits) o 8/16 → 2 (cada dígito a 3 o 4 bits). */
function groupingStep(
  from: number,
  to: number,
  intDigits: number[],
  fracDigits: number[],
): Step | null {
  const toBinary = from !== 2;
  const size = GROUPS[toBinary ? from : to];
  if (!size || (toBinary ? to !== 2 : from !== 2)) return null;
  const bits = (d: number) => d.toString(2).padStart(size, '0');
  if (toBinary) {
    const part = (ds: number[]) =>
      ds.map((d) => `\\underbrace{${bits(d)}}_{${digitChar(d)}}`).join('\\,');
    return {
      title: `Atajo: cada dígito a ${size} bits`,
      explanation: `Como ${from} = ${POWER[size]}, cada dígito en base ${from} equivale exactamente a ${size} bits. Se reemplaza cada uno y se quitan los ceros de más a la izquierda (y a la derecha de la parte fraccionaria).`,
      result: `${part(intDigits)}${fracDigits.length > 0 ? `\\,.\\,${part(fracDigits)}` : ''}`,
    };
  }
  const intBits = intDigits.join('');
  const fracBits = fracDigits.join('');
  const padInt = intBits.padStart(Math.ceil(intBits.length / size) * size, '0');
  const padFrac = fracBits.padEnd(Math.ceil(fracBits.length / size) * size, '0');
  const chunks = (s: string) => s.match(new RegExp(`.{${size}}`, 'g')) ?? [];
  const part = (s: string) =>
    chunks(s)
      .map((g) => `\\underbrace{${g}}_{${digitChar(parseInt(g, 2))}}`)
      .join('\\,');
  return {
    title: `Atajo: grupos de ${size} bits`,
    explanation: `Como ${to} = ${POWER[size]}, se agrupan los bits de a ${size} desde el punto (hacia la izquierda en la parte entera y hacia la derecha en la fraccionaria, completando con ceros) y cada grupo se convierte en un dígito.`,
    result: `${part(padInt)}${padFrac ? `\\,.\\,${part(padFrac)}` : ''}`,
  };
}

export function solveNumeral(
  input: NumeralInput,
): CalculatorResult<NumeralValue, NumeralErrorCode> {
  const { from, to } = input;
  const parsed = parseNumeral(input.number, from);
  if (typeof parsed === 'string') {
    return {
      ok: false,
      error: { code: 'invalid-number', message: `No se pudo leer el número: ${parsed}.` },
      ...emptyTrace(),
    };
  }
  const { negative, intDigits, fracDigits } = parsed;
  const int = integerValue(intDigits, from);
  const frac = fractionValue(fracDigits, from);
  const exact = Rational.of(int).add(frac);
  const source = numeralLatex(negative, intDigits, fracDigits, from);
  const decimal = decimalLatex(negative, int, frac);
  const steps: Step[] = [];
  const notices: Notice[] = [];
  if (negative) {
    notices.push({
      level: 'info',
      message:
        'El signo no se convierte: se convierte el valor absoluto y se le antepone el signo.',
    });
  }

  if (from !== 10) {
    steps.push({
      title: 'Valor en base 10',
      explanation: `Cada dígito se multiplica por la potencia de ${from} que corresponde a su posición: ${from}⁰ para el primero a la izquierda del punto, ${from}¹ para el siguiente, y ${from}⁻¹, ${from}⁻², … a la derecha del punto.${from > 10 ? ` Las letras valen A = 10, B = 11, …` : ''}`,
      formula: `N = \\sum_i d_i\\, ${from}^{i}`,
      substitution: positionalLatex(intDigits, fracDigits, from),
      result: `${source} = ${decimal}`,
    });
  }

  const resultInt = integerDigits(int, to);
  const expansion = successiveMultiplications(frac, to);
  const tables: ResultTable[] = [];
  if (to !== 10) {
    const divisions = successiveDivisions(int, to);
    steps.push({
      title: 'Parte entera: divisiones sucesivas',
      explanation:
        int === 0n
          ? 'La parte entera es 0.'
          : `Se divide ${int} entre ${to}, luego el cociente entre ${to}, y así hasta que el cociente sea 0. Los residuos, leídos del último al primero, son los dígitos en base ${to}.`,
      result:
        int === 0n
          ? `0_{10} = 0_{${to}}`
          : `${bigLatex(int)}_{10} = ${numeralLatex(false, resultInt, [], to)}`,
    });
    if (divisions.length > 0) {
      tables.push({
        id: 'divisiones',
        title: `Divisiones sucesivas entre ${to}`,
        columns: [
          { key: 'dividend', header: '\\text{Dividendo}', format: 'text' },
          { key: 'quotient', header: '\\text{Cociente}', format: 'text' },
          { key: 'remainder', header: '\\text{Residuo}', format: 'text' },
          { key: 'digit', header: '\\text{Dígito}', format: 'text' },
        ],
        rows: divisions.map((r) => ({
          dividend: String(r.dividend),
          quotient: String(r.quotient),
          remainder: String(r.remainder),
          digit: digitChar(r.remainder),
        })),
      });
    }
    if (!frac.isZero()) {
      const kind =
        expansion.periodStart !== null ? 'periodic' : expansion.truncated ? 'truncated' : 'exact';
      steps.push({
        title: 'Parte fraccionaria: multiplicaciones sucesivas',
        explanation: `Se multiplica la parte fraccionaria por ${to}: la parte entera del producto es el siguiente dígito y la parte fraccionaria se vuelve a multiplicar. ${
          kind === 'exact'
            ? 'Se termina cuando la parte fraccionaria es 0.'
            : kind === 'periodic'
              ? 'Una parte fraccionaria se repitió, así que los dígitos se repiten desde ahí: el resultado es periódico (la raya indica el período).'
              : `Tras ${MAX_FRACTION_DIGITS} dígitos la parte fraccionaria no se anuló ni se repitió: el resultado se trunca.`
        }`,
        result: `${frac.toLatex()}_{10} = ${numeralLatex(false, [0], expansion.digits, to, expansion)}`,
      });
      tables.push({
        id: 'multiplicaciones',
        title: `Multiplicaciones sucesivas por ${to}`,
        columns: [
          { key: 'fraction', header: '\\text{Fracción}', format: 'latex' },
          { key: 'product', header: `\\times ${to}`, format: 'latex' },
          { key: 'digit', header: '\\text{Dígito}', format: 'text' },
        ],
        rows: expansion.rows.map((r) => ({
          fraction: r.fraction.toLatex(),
          product: r.product.toLatex(),
          digit: digitChar(r.digit),
        })),
      });
      if (kind === 'truncated') {
        notices.push({
          level: 'warning',
          message: `La parte fraccionaria no termina en base ${to}: se muestran ${MAX_FRACTION_DIGITS} dígitos.`,
        });
      }
    }
  }

  const result = numeralText(negative, resultInt, expansion.digits);
  const resultLatex = numeralLatex(negative, resultInt, expansion.digits, to, expansion);
  const shortcut = groupingStep(from, to, intDigits, fracDigits);
  if (shortcut)
    steps.push({ ...shortcut, result: `${shortcut.result} \\;\\Rightarrow\\; ${resultLatex}` });
  steps.push({
    title: 'Resultado',
    explanation:
      from === to
        ? 'La base de origen y la de destino son iguales: el número no cambia.'
        : `Se juntan la parte entera y la fraccionaria en base ${to}.`,
    result: `${source} = ${resultLatex}`,
  });

  return {
    ok: true,
    value: {
      result,
      exactDecimal: (negative ? exact.neg() : exact).toString(),
      periodic: expansion.periodStart !== null,
      truncated: expansion.truncated,
    },
    summary: [
      { label: `En base ${to}`, value: resultLatex, emphasis: true },
      ...(from !== 10 && to !== 10 ? [{ label: 'En base 10', value: decimal }] : []),
    ],
    ...emptyTrace(),
    steps,
    tables,
    notices,
  };
}

export const numeralSystems: Calculator<NumeralInput, NumeralValue, NumeralErrorCode> = {
  meta: {
    id: 'sistemas-de-numeracion',
    title: 'Conversión entre sistemas de numeración',
    summary: 'Convierte números entre bases (binaria, octal, decimal, hexadecimal…).',
    citations: [{ sourceId: 'tucker-joyanes-2000' }],
  },
  inputSchema: numeralInputSchema,
  // 25.375₁₀ = 11001.011₂: parte entera por divisiones y fracción exacta (0.375 = 3/8).
  example: { number: '25.375', from: 10, to: 2 },
  solve: solveNumeral,
};
