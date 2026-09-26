/**
 * Representación de enteros con signo en n bits (Tucker y Joyanes):
 *
 *   signo y magnitud   bit de signo (0 = +, 1 = −) y |x| en n − 1 bits
 *                      rango −(2ⁿ⁻¹ − 1) … 2ⁿ⁻¹ − 1 (hay +0 y −0)
 *   complemento a 1    si x < 0, se invierten todos los bits de |x|; mismo rango
 *   complemento a 2    si x < 0, complemento a 1 más 1 (o 2ⁿ − |x|)
 *                      rango −2ⁿ⁻¹ … 2ⁿ⁻¹ − 1
 *   exceso 2ⁿ⁻¹        x + 2ⁿ⁻¹ en binario sin signo; mismo rango que complemento a 2
 */
import { z } from 'zod';
import { latexLines } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Notice,
  type Step,
} from '../types';
import { successiveDivisions } from './numeration';

export const MIN_BITS = 2;
export const MAX_BITS = 32;

export const binaryInputSchema = z
  .object({
    value: z.number({ error: 'Escribe un número entero.' }).int('Escribe un número entero.'),
    bits: z
      .number({ error: 'Escribe el número de bits.' })
      .int('El número de bits debe ser entero.')
      .min(MIN_BITS, `Usa entre ${MIN_BITS} y ${MAX_BITS} bits.`)
      .max(MAX_BITS, `Usa entre ${MIN_BITS} y ${MAX_BITS} bits.`),
  })
  .superRefine((v, ctx) => {
    if (!Number.isInteger(v.bits) || v.bits < MIN_BITS || v.bits > MAX_BITS) return;
    const half = 2 ** (v.bits - 1);
    if (v.value < -half || v.value > half - 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `Con ${v.bits} bits solo se representan enteros de ${-half} a ${half - 1}.`,
      });
    }
  });
export type BinaryInput = z.infer<typeof binaryInputSchema>;

export interface BinaryValue {
  /** `null` si el número no cabe en esa representación. */
  signMagnitude: string | null;
  onesComplement: string | null;
  twosComplement: string;
  excess: string;
}

export type BinaryErrorCode = 'out-of-range';

const toBits = (n: number, width: number) => n.toString(2).padStart(width, '0');
const invert = (bits: string) => [...bits].map((b) => (b === '0' ? '1' : '0')).join('');

/** Bits en grupos de 4 para leerlos mejor. */
export function bitsLatex(bits: string): string {
  const groups: string[] = [];
  for (let end = bits.length; end > 0; end -= 4)
    groups.unshift(bits.slice(Math.max(0, end - 4), end));
  return `\\mathtt{${groups.join('\\,')}}`;
}

export function solveBinary(input: BinaryInput): CalculatorResult<BinaryValue, BinaryErrorCode> {
  const { value: x, bits: n } = input;
  const half = 2 ** (n - 1);
  const magnitude = Math.abs(x);
  const ranges = latexLines([
    `\\text{Signo y magnitud y complemento a 1: } ${-(half - 1)} \\le x \\le ${half - 1}`,
    `\\text{Complemento a 2 y exceso } 2^{${n - 1}}: ${-half} \\le x \\le ${half - 1}`,
  ]);
  const steps: Step[] = [
    {
      title: `Rangos con ${n} bits`,
      explanation:
        'Con n bits hay 2ⁿ patrones. Signo y magnitud y complemento a 1 gastan dos patrones en el cero (+0 y −0); complemento a 2 y exceso tienen un solo cero y un negativo más.',
      result: ranges,
    },
  ];
  if (!Number.isInteger(x) || x < -half || x > half - 1) {
    return {
      ok: false,
      error: {
        code: 'out-of-range',
        message: `Con ${n} bits solo se representan enteros de ${-half} a ${half - 1}.`,
      },
      ...emptyTrace(),
      steps,
    };
  }

  const divisions = successiveDivisions(BigInt(magnitude), 2);
  const magnitudeBits = magnitude === 0 ? '0' : magnitude.toString(2);
  steps.push({
    title: 'Magnitud en binario',
    explanation:
      magnitude === 0
        ? 'La magnitud es 0.'
        : `Se divide |x| = ${magnitude} entre 2 sucesivamente; los residuos, leídos de abajo hacia arriba, dan la magnitud en binario.`,
    result: `|x| = ${magnitude} = ${magnitudeBits}_{2}`,
  });

  const fitsSm = magnitude <= half - 1;
  const negative = x < 0;
  const notices: Notice[] = [];
  let signMagnitude: string | null = null;
  let onesComplement: string | null = null;
  if (fitsSm) {
    const body = toBits(magnitude, n - 1);
    signMagnitude = `${negative ? '1' : '0'}${body}`;
    onesComplement = negative ? invert(toBits(magnitude, n)) : toBits(magnitude, n);
    steps.push(
      {
        title: 'Signo y magnitud',
        explanation: `El primer bit es el signo (${negative ? '1 porque x es negativo' : '0 porque x no es negativo'}) y los ${n - 1} restantes son la magnitud, completada con ceros a la izquierda.`,
        result: `${negative ? '1' : '0'} \\mid ${bitsLatex(body)} \\;\\Rightarrow\\; ${bitsLatex(signMagnitude)}`,
      },
      {
        title: 'Complemento a 1',
        explanation: negative
          ? `Se escribe |x| con ${n} bits y se invierten todos (cada 0 pasa a 1 y cada 1 a 0).`
          : 'Los positivos se escriben igual que en binario, con ceros a la izquierda.',
        result: negative
          ? `\\overline{${bitsLatex(toBits(magnitude, n))}} = ${bitsLatex(onesComplement)}`
          : bitsLatex(onesComplement),
      },
    );
  } else {
    notices.push({
      level: 'info',
      message: `${x} no se puede escribir en signo y magnitud ni en complemento a 1 con ${n} bits: su rango llega solo hasta ${-(half - 1)}.`,
    });
  }

  const twosValue = negative ? 2 ** n - magnitude : magnitude;
  const twosComplement = toBits(twosValue, n);
  steps.push({
    title: 'Complemento a 2',
    explanation: negative
      ? `Se suma 1 al complemento a 1. Equivale a escribir 2ⁿ − |x| = ${2 ** n} − ${magnitude} = ${twosValue} en binario.`
      : 'Los positivos se escriben igual que en binario, con ceros a la izquierda.',
    formula: negative ? `C_2(x) = 2^{${n}} - |x|` : undefined,
    result: negative
      ? onesComplement
        ? `${bitsLatex(onesComplement)} + 1 = ${bitsLatex(twosComplement)}`
        : `2^{${n}} - ${magnitude} = ${twosValue} = ${bitsLatex(twosComplement)}`
      : bitsLatex(twosComplement),
  });

  const excessValue = x + half;
  const excess = toBits(excessValue, n);
  steps.push({
    title: `Exceso ${half}`,
    explanation: `Se suma el sesgo 2ⁿ⁻¹ = ${half} y el resultado, que ya no es negativo, se escribe en binario sin signo con ${n} bits. Es el complemento a 2 con el primer bit invertido.`,
    formula: `E(x) = x + 2^{${n - 1}}`,
    substitution: `E(${x}) = ${x} + ${half} = ${excessValue}`,
    result: bitsLatex(excess),
  });

  const row = (name: string, bits: string | null, range: string) => ({
    name,
    bits: bits === null ? '\\text{no representable}' : bitsLatex(bits),
    range,
  });
  return {
    ok: true,
    value: { signMagnitude, onesComplement, twosComplement, excess },
    summary: [
      { label: 'Complemento a 2', value: bitsLatex(twosComplement), emphasis: true },
      {
        label: 'Signo y magnitud',
        value: signMagnitude ? bitsLatex(signMagnitude) : '\\text{no representable}',
      },
      {
        label: 'Complemento a 1',
        value: onesComplement ? bitsLatex(onesComplement) : '\\text{no representable}',
      },
      { label: `Exceso ${half}`, value: bitsLatex(excess) },
    ],
    ...emptyTrace(),
    steps,
    notices,
    tables: [
      ...(divisions.length > 0
        ? [
            {
              id: 'divisiones',
              title: `Divisiones sucesivas de ${magnitude} entre 2`,
              columns: [
                { key: 'dividend', header: '\\text{Dividendo}', format: 'text' as const },
                { key: 'quotient', header: '\\text{Cociente}', format: 'text' as const },
                { key: 'remainder', header: '\\text{Residuo}', format: 'text' as const },
              ],
              rows: divisions.map((r) => ({
                dividend: String(r.dividend),
                quotient: String(r.quotient),
                remainder: String(r.remainder),
              })),
            },
          ]
        : []),
      {
        id: 'representaciones',
        title: `${x} con ${n} bits`,
        columns: [
          { key: 'name', header: '\\text{Representación}', format: 'text' },
          { key: 'bits', header: '\\text{Bits}', format: 'latex' },
          { key: 'range', header: '\\text{Rango}', format: 'latex' },
        ],
        rows: [
          row('Signo y magnitud', signMagnitude, `[${-(half - 1)},\\ ${half - 1}]`),
          row('Complemento a 1', onesComplement, `[${-(half - 1)},\\ ${half - 1}]`),
          row('Complemento a 2', twosComplement, `[${-half},\\ ${half - 1}]`),
          row(`Exceso ${half}`, excess, `[${-half},\\ ${half - 1}]`),
        ],
      },
    ],
  };
}

export const binaryRepresentation: Calculator<BinaryInput, BinaryValue, BinaryErrorCode> = {
  meta: {
    id: 'representacion-binaria',
    title: 'Representación binaria de enteros',
    summary: 'Signo y magnitud, complemento a 1, complemento a 2 y exceso con n bits.',
    citations: [{ sourceId: 'tucker-joyanes-2000' }],
  },
  inputSchema: binaryInputSchema,
  // −25 con 8 bits: 25 = 11001₂; C1 = 11100110 y C2 = 11100111 (verificado a mano).
  example: { value: -25, bits: 8 },
  solve: solveBinary,
};
