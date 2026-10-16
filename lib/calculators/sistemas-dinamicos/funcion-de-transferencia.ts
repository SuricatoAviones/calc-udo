/**
 * Función de transferencia de un sistema descrito por una ecuación diferencial, por sus
 * ecuaciones de estado, escrita directamente o dibujada como circuito eléctrico, con sus formas
 * canónicas, polos, ceros y polinomio característico.
 *
 * Fuentes: Ogata, 3.ª ed., sec. 3-2 (ec. 3-1 y 3-2), sec. 3-4 (ec. 3-32), sec. 3-7 (circuito
 * LRC, ec. 3-59); Ogata, 5.ª ed., ejemplo 2-4 (de espacio de estados a función de transferencia);
 * Kuo, 7.ª ed., sec. 3-1 (ec. 3-3) y ejemplos 3-8 y 3-9.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { toLatexNumber } from '@/lib/math/format';
import { trimPoly } from '@/lib/math/polynomials';
import type { Calculator, CalculatorResult, Notice, Step } from '../types';
import { matrixSchema } from '../metodos-numericos/matrix';
import {
  circuitDocumentSchema,
  componentLabel,
  type CircuitDocument,
} from '../circuitos-y-sistemas/circuit';
import { formulateStateEquations, outputEquation } from '../circuitos-y-sistemas/state-space';
import { stateSpaceToTf } from './state-space-tf';
import { analyzeTf } from './tf-analysis';
import { parseTf, polyTex, tfReduce, tfTex, type TransferFunction } from './transfer-function';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

const inputSchema = z.object({
  mode: z.enum(['ecuacion', 'funcion', 'espacio-de-estados', 'circuito']),
  /** a_n … a_0 (lado de la salida). */
  outputCoefficients: z.string().max(200),
  /** b_m … b_0 (lado de la entrada). */
  inputCoefficients: z.string().max(200),
  transfer: z.string().max(200),
  A: matrixSchema('A', { maxRows: 6, maxCols: 6, shape: 'square' }),
  B: matrixSchema('B', { maxRows: 6, maxCols: 1 }),
  C: matrixSchema('C', { maxRows: 1, maxCols: 6 }),
  D: z.number({ error: 'Escribe D.' }).refine(Number.isFinite, 'Escribe D.'),
  circuit: circuitDocumentSchema,
  /** Fuente que se toma como entrada. */
  source: z.string().max(40),
  /** Componente cuyo voltaje o corriente es la salida. */
  output: z.string().max(40),
  quantity: z.enum(['v', 'i']),
});

export type TransferInput = z.infer<typeof inputSchema>;

export interface TransferValue {
  tf: TransferFunction;
  order: number;
  type: number;
  stability: 'estable' | 'marginal' | 'inestable';
  poles: { re: number; im: number }[];
  zeros: { re: number; im: number }[];
}

export type TransferErrorCode =
  | 'coeficientes-invalidos'
  | 'funcion-invalida'
  | 'dimensiones'
  | 'circuito-invalido'
  | 'sin-fuente'
  | 'sin-salida';

function fail(
  code: TransferErrorCode,
  message: string,
  steps: Step[] = [],
): CalculatorResult<TransferValue, TransferErrorCode> {
  return {
    ok: false,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

function coefficients(text: string, what: string): number[] | string {
  const { values, invalid } = parseDataList(text);
  if (invalid.length) return `${what}: no son números (${invalid.slice(0, 3).join(', ')}).`;
  if (values.length === 0) return `Escribe los coeficientes ${what}.`;
  if (values.length > 11) return `${what}: el orden máximo es 10.`;
  const trimmed = trimPoly(values);
  if (trimmed.length === 1 && trimmed[0] === 0) return `${what}: no pueden ser todos 0.`;
  return trimmed;
}

/** y, y', y'', y''', y^{(4)}… */
function derivativeTex(name: string, order: number): string {
  if (order === 0) return `${name}`;
  if (order <= 3) return `${name}${"'".repeat(order)}`;
  return `${name}^{(${order})}`;
}

function odeSideTex(coefs: number[], name: string): string {
  const degree = coefs.length - 1;
  const terms: string[] = [];
  coefs.forEach((c, i) => {
    if (c === 0) return;
    const body = derivativeTex(name, degree - i);
    const abs = Math.abs(c);
    const text = `${abs === 1 ? '' : n(abs)}${body}`;
    terms.push(
      terms.length === 0 ? (c < 0 ? `-${text}` : text) : c < 0 ? ` - ${text}` : ` + ${text}`,
    );
  });
  return terms.join('');
}

export function solveTransfer(
  input: TransferInput,
): CalculatorResult<TransferValue, TransferErrorCode> {
  const steps: Step[] = [];
  const notices: Notice[] = [];
  let tf: TransferFunction;

  if (input.mode === 'ecuacion') {
    const a = coefficients(input.outputCoefficients, 'de la salida');
    if (typeof a === 'string') return fail('coeficientes-invalidos', a);
    const b = coefficients(input.inputCoefficients, 'de la entrada');
    if (typeof b === 'string') return fail('coeficientes-invalidos', b);
    if (a.length < 2)
      return fail(
        'coeficientes-invalidos',
        'La salida debe tener al menos una derivada: el orden del sistema debe ser 1 o más.',
      );
    steps.push({
      title: 'Ecuación diferencial',
      explanation: `y(t) es la salida y x(t) la entrada. Sistema de orden ${a.length - 1}.`,
      formula: 'a_0y^{(n)} + a_1y^{(n-1)} + \\cdots + a_ny = b_0x^{(m)} + \\cdots + b_mx',
      result: `${odeSideTex(a, 'y')} = ${odeSideTex(b, 'x')}`,
    });
    steps.push({
      title: 'Transformada de Laplace con condiciones iniciales cero',
      explanation:
        'Cada derivada de orden k se convierte en sᵏ por la transformada; la función de transferencia supone condiciones iniciales cero (Ogata, sec. 3-2).',
      result: `\\left(${polyTex(a)}\\right)Y(s) = \\left(${polyTex(b)}\\right)X(s)`,
    });
    tf = { num: b, den: a };
    steps.push({
      title: 'Función de transferencia',
      formula:
        'G(s) = \\frac{Y(s)}{X(s)} = \\frac{b_0s^m + b_1s^{m-1} + \\cdots + b_m}{a_0s^n + a_1s^{n-1} + \\cdots + a_n}',
      result: `G(s) = ${tfTex(tf)}`,
    });
  } else if (input.mode === 'funcion') {
    const parsed = parseTf(input.transfer);
    if (!parsed.ok) return fail('funcion-invalida', parsed.message);
    tf = parsed.tf;
  } else if (input.mode === 'espacio-de-estados') {
    const size = input.A.length;
    if (input.B.length !== size || input.C[0]!.length !== size) {
      return fail('dimensiones', `B debe tener ${size} filas y C ${size} columnas, como A.`);
    }
    const result = stateSpaceToTf(input.A, input.B, input.C, [[input.D]]);
    steps.push(...result.steps);
    tf = result.raw;
    if (result.reduced) {
      notices.push({
        level: 'info',
        message:
          'Hubo cancelación de polos y ceros: el sistema no es completamente controlable u observable.',
      });
    }
  } else {
    const doc: CircuitDocument = input.circuit;
    const formulation = formulateStateEquations(doc);
    if (!formulation.ok) return fail('circuito-invalido', formulation.message, formulation.steps);
    const { model } = formulation;
    steps.push(...formulation.steps);
    const sourceIndex = model.inputs.findIndex((u) => u.id === input.source);
    const inputIndex = sourceIndex >= 0 ? sourceIndex : 0;
    if (model.inputs.length === 0)
      return fail('sin-fuente', 'El circuito no tiene fuentes: no hay entrada.', steps);
    const target = doc.components.find((c) => c.id === input.output);
    if (!target)
      return fail(
        'sin-salida',
        'Elige el componente cuyo voltaje o corriente es la salida.',
        steps,
      );
    const out = outputEquation(doc, model, target.id, input.quantity);
    if (!out.ok) return fail('circuito-invalido', out.message, steps);
    const source = model.inputs[inputIndex]!;
    const outName = `${input.quantity === 'v' ? 'v' : 'i'}_{${componentLabel(target)}}`;
    steps.push({
      title: 'Ecuación de salida',
      explanation: `La salida es ${input.quantity === 'v' ? 'el voltaje' : 'la corriente'} de ${componentLabel(target)} y la entrada es la fuente ${source.label}${model.inputs.length > 1 ? '; las demás fuentes se anulan' : ''}. Se obtiene con la misma sustitución de capacitores e inductores por fuentes.`,
      formula: 'y = C\\mathbf{x} + D\\mathbf{u}',
      result: `${outName} = ${
        [
          ...out.C.map((c, i) => ({ c, v: model.states[i]!.tex })),
          ...out.D.map((c, i) => ({ c, v: model.inputs[i]!.tex })),
        ]
          .filter(({ c }) => c !== 0)
          .map(
            ({ c, v }, i) =>
              `${i === 0 ? (c < 0 ? '-' : '') : c < 0 ? ' - ' : ' + '}${Math.abs(c) === 1 ? '' : n(Math.abs(c))}${v}`,
          )
          .join('') || '0'
      }`,
    });
    const result = stateSpaceToTf(model.A, model.B, [out.C], [out.D], 0, inputIndex);
    steps.push(...result.steps);
    tf = result.raw;
  }

  const { tf: reducedTf, reduced } = tfReduce(tf);
  if (reduced) {
    steps.push({
      title: 'Cancelación de factores comunes',
      result: `G(s) = ${tfTex(tf)} = ${tfTex(reducedTf)}`,
    });
  }
  const analysis = analyzeTf(reducedTf);
  steps.push(...analysis.steps);
  return {
    ok: true,
    value: {
      tf: reducedTf,
      order: analysis.order,
      type: analysis.type,
      stability: analysis.stability,
      poles: analysis.poles,
      zeros: analysis.zeros,
    },
    summary: analysis.summary,
    steps,
    tables: [],
    series: analysis.series,
    notices,
  };
}

/**
 * Circuito LRC de Ogata (3.ª ed., fig. 3-17): fuente e_i, inductor, resistencia y capacitor en
 * serie; la salida e_o es el voltaje del capacitor. Valores elegidos: L = 1 H, R = 2 Ω, C = 0.5 F.
 */
export const OGATA_FIG_3_17: CircuitDocument = {
  components: [
    {
      id: 'vi',
      kind: 'voltage-source',
      a: { x: 0, y: 0 },
      b: { x: 0, y: 4 },
      value: 1,
      label: 'V1',
    },
    { id: 'l1', kind: 'inductor', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, value: 1, label: 'L1' },
    { id: 'r1', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 8, y: 0 }, value: 2, label: 'R1' },
    { id: 'c1', kind: 'capacitor', a: { x: 8, y: 0 }, b: { x: 8, y: 4 }, value: 0.5, label: 'C1' },
  ],
  wires: [
    {
      id: 'tierra',
      points: [
        { x: 0, y: 4 },
        { x: 8, y: 4 },
      ],
    },
  ],
  ground: { x: 0, y: 4 },
};

export const funcionDeTransferencia: Calculator<TransferInput, TransferValue, TransferErrorCode> = {
  meta: {
    id: 'funcion-de-transferencia',
    title: 'Función de transferencia',
    summary: 'La obtiene de una ecuación diferencial y da polos, ceros y polinomio característico.',
    citations: [
      {
        sourceId: 'ogata-1998',
        locator: 'Sec. 3-2 (ec. 3-1 y 3-2), sec. 3-4 (ec. 3-32) y sec. 3-7 (ec. 3-59)',
      },
      { sourceId: 'kuo-1996', locator: 'Sec. 3-1 (ec. 3-3) y ejemplos 3-8 y 3-9' },
      { sourceId: 'ogata-1998', locator: '5.ª ed. en español (2010), ejemplo 2-4' },
    ],
  },
  inputSchema,
  // Kuo, ejemplos 3-8 y 3-9: y'' + 3y' + 2y = r → Y(s)/R(s) = 1/(s² + 3s + 2).
  example: {
    mode: 'ecuacion',
    outputCoefficients: '1 3 2',
    inputCoefficients: '1',
    transfer: '10(s + 3)/(s(s + 2)(s^2 + s + 2))',
    // Ogata, 5.ª ed., ejemplo 2-4.
    A: [
      [0, 1, 0],
      [0, 0, 1],
      [-5, -25, -5],
    ],
    B: [[0], [25], [-120]],
    C: [[1, 0, 0]],
    D: 0,
    circuit: OGATA_FIG_3_17,
    source: 'vi',
    output: 'c1',
    quantity: 'v',
  },
  solve: solveTransfer,
};
