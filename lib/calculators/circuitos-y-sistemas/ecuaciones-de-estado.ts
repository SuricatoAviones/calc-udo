/**
 * Ecuaciones de estado de una red dibujada en el constructor: formulación con árbol normal,
 * cortes y lazos fundamentales, y solución ẋ = Ax + Bu con la transformada de Laplace.
 *
 * Fuentes: Dorf y Svoboda, 9.ª ed., sec. 9.9 (tabla 9.9-1 y circuito de la fig. 9.9-1); Hayt,
 * Kemmerly y Durbin, 8.ª ed., ejemplo 9.10 (respuesta completa de un RLC). El árbol normal, los
 * cortes y lazos fundamentales y las redes propias e impropias son los contenidos 2.1 y 3.1 de la
 * Unidad V del programa.
 */
import { z } from 'zod';
import * as C from '@/lib/math/complex';
import { formatNumber, toLatexMatrix } from '@/lib/math/format';
import { polyRoots } from '@/lib/math/polynomials';
import type { Calculator, CalculatorResult, ResultTable, Series, Step } from '../types';
import { circuitDocumentSchema, type CircuitDocument } from './circuit';
import { polyTex } from './laplace';
import { inverseLaplace } from './laplace-inverse';
import {
  adjugateTex,
  faddeevLeverrier,
  formulateStateEquations,
  sIminusATex,
  stateTransforms,
  steadyState,
  type StateSpaceErrorCode,
  type StateSpaceModel,
} from './state-space';
import { horizonOf, sampleSeries } from './transformada-inversa-de-laplace';

const DIGITS = 6;

const inputSchema = z.object({ circuit: circuitDocumentSchema });

export type StateEquationsInput = z.infer<typeof inputSchema>;

export interface StateEquationsValue {
  model: StateSpaceModel;
  /** Coeficientes de det(sI − A). */
  charPoly: number[];
  /** x_k(t) en LaTeX, en el orden de `model.states`. */
  solutions: string[];
  /** x(∞) = −A⁻¹Bu, si A es invertible. */
  steady: number[] | null;
}

export type StateEquationsErrorCode = StateSpaceErrorCode;

export function solveStateEquations(
  input: StateEquationsInput,
): CalculatorResult<StateEquationsValue, StateEquationsErrorCode> {
  const formulation = formulateStateEquations(input.circuit);
  if (!formulation.ok) {
    return {
      ok: false,
      error: { code: formulation.code, message: formulation.message },
      steps: formulation.steps,
      tables: [],
      series: [],
      notices: [{ level: 'error', message: formulation.message }],
    };
  }
  const { model } = formulation;
  const steps: Step[] = [...formulation.steps];
  const { charPoly, M } = faddeevLeverrier(model.A);
  const roots = polyRoots(charPoly);
  const stable = roots.every((r) => r.value.re < 0);

  steps.push({
    title: 'Ecuación característica',
    explanation: `Sus raíces son las frecuencias naturales de la red: ${roots
      .map((r) => `${C.toTextRect(r.value, DIGITS)}${r.multiplicity > 1 ? ` (doble)` : ''}`)
      .join(', ')}. ${
      stable
        ? 'Todas tienen parte real negativa: la respuesta natural se extingue y la red es estable.'
        : 'Hay raíces con parte real no negativa: la respuesta natural no se extingue.'
    }`,
    formula: `\\det(sI - A) = \\det ${sIminusATex(model.A)} = 0`,
    result: `${polyTex(charPoly, 's')} = 0`,
  });
  steps.push({
    title: 'Solución con la transformada de Laplace',
    explanation:
      'Se transforma ẋ = Ax + Bu con las fuentes de cd como escalones: sX(s) − x(0) = AX(s) + B·u/s. La inversa de (sI − A) se calcula con el algoritmo de Faddeev-LeVerrier.',
    formula:
      '\\mathbf{X}(s) = (sI - A)^{-1}\\left[\\mathbf{x}(0) + \\frac{B\\mathbf{u}}{s}\\right],\\qquad (sI - A)^{-1} = \\frac{\\operatorname{adj}(sI - A)}{\\det(sI - A)}',
    result: `\\operatorname{adj}(sI - A) = ${adjugateTex(M)}`,
  });

  const transforms = stateTransforms(model, charPoly, M);
  const solutions: string[] = [];
  const evaluators: ((t: number) => number)[] = [];
  const groups = [];
  for (let k = 0; k < model.states.length; k++) {
    const state = model.states[k]!;
    const { num, den } = transforms[k]!;
    const name = state.tex.replace(/^v/, 'V').replace(/^i/, 'I');
    const inverse = inverseLaplace([{ delay: 0, num, den }], name, state.tex);
    if (!inverse.ok) {
      return {
        ok: false,
        error: { code: 'singular', message: inverse.message },
        steps,
        tables: [],
        series: [],
        notices: [{ level: 'error', message: inverse.message }],
      };
    }
    solutions.push(inverse.result.tex);
    evaluators.push(inverse.result.evaluate);
    groups.push(...inverse.result.groups);
    steps.push({
      title: `${state.kind === 'capacitor' ? 'Voltaje' : 'Corriente'} de ${state.label}`,
      children: inverse.result.steps,
      result: `${state.tex}(t) = ${inverse.result.tex}`,
    });
  }

  const steady = steadyState(model);
  steps.push({
    title: 'Respuesta completa',
    explanation:
      steady !== null
        ? 'Cuando t → ∞, ẋ = 0 y el estado tiende a x(∞) = −A⁻¹Bu (el circuito de cd con los capacitores abiertos y los inductores en corto).'
        : 'A es singular: hay un modo natural en s = 0 y el estado no tiene un único valor estable.',
    result: model.states.map((s, k) => `${s.tex}(t) = ${solutions[k]}`).join(',\\quad '),
    ...(steady !== null
      ? {
          formula: `\\mathbf{x}(\\infty) = -A^{-1}B\\mathbf{u} = ${toLatexMatrix(
            steady.map((v) => [v]),
            DIGITS,
          )}`,
        }
      : {}),
  });

  const horizon = Math.max(horizonOf(groups), 1e-9);
  const instants = [0, 0.1, 0.25, 0.5, 1].map((f) => f * horizon);
  const table: ResultTable = {
    id: 'estado',
    title: 'Estado en algunos instantes',
    columns: [
      { key: 't', header: 't\\ (\\text{s})' },
      ...model.states.map((s, k) => ({ key: `x${k}`, header: `${s.tex}(t)` })),
    ],
    rows: instants.map((t) => ({
      t: Number(formatNumber(t, 4)),
      ...Object.fromEntries(model.states.map((_, k) => [`x${k}`, evaluators[k]!(t)])),
    })),
  };
  const series: Series[] = model.states.map((s, k) => ({
    id: `estado-${k}`,
    title: s.kind === 'capacitor' ? `Voltaje de ${s.label}` : `Corriente de ${s.label}`,
    xLabel: 't (s)',
    yLabel: s.kind === 'capacitor' ? `v (V)` : `i (A)`,
    points: sampleSeries(evaluators[k]!, horizon),
  }));

  return {
    ok: true,
    value: { model, charPoly, solutions, steady },
    summary: [
      { label: 'A', value: `A = ${toLatexMatrix(model.A, DIGITS)}` },
      ...(model.inputs.length
        ? [{ label: 'B', value: `B = ${toLatexMatrix(model.B, DIGITS)}` }]
        : []),
      { label: 'det(sI − A)', value: polyTex(charPoly, 's') },
      ...model.states.map((s, k) => ({
        label: `${s.label}`,
        value: `${s.tex}(t) = ${solutions[k]}`,
        emphasis: k === 0,
      })),
    ],
    steps,
    tables: [table],
    series,
    notices: [
      {
        level: 'info',
        message:
          'Polaridades: v_C se mide con + en el terminal marcado del capacitor e i_L circula desde el terminal marcado del inductor. Las fuentes actúan desde t = 0 y los capacitores e inductores parten de sus valores iniciales.',
      },
    ],
  };
}

/**
 * Dorf y Svoboda, fig. 9.9-1: dos capacitores con C₁R₁ = C₁R₂ = C₂R₃ = 1 y C₂R₂ = 1/2
 * (R₁ = R₂ = 1 Ω, R₃ = 2 Ω, C₁ = 1 F, C₂ = 0.5 F), v_a = 10 V, v_b = 6 V, v₁(0) = 5 V y
 * v₂(0) = 10 V.
 */
const DORF_FIG_9_9_1: CircuitDocument = {
  components: [
    {
      id: 'va',
      kind: 'voltage-source',
      a: { x: 0, y: 0 },
      b: { x: 0, y: 4 },
      value: 10,
      label: 'V1',
    },
    { id: 'r1', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, value: 1, label: 'R1' },
    {
      id: 'c1',
      kind: 'capacitor',
      a: { x: 4, y: 0 },
      b: { x: 4, y: 4 },
      value: 1,
      label: 'C1',
      initial: 5,
    },
    { id: 'r2', kind: 'resistor', a: { x: 4, y: 0 }, b: { x: 8, y: 0 }, value: 1, label: 'R2' },
    {
      id: 'c2',
      kind: 'capacitor',
      a: { x: 8, y: 0 },
      b: { x: 8, y: 4 },
      value: 0.5,
      label: 'C2',
      initial: 10,
    },
    { id: 'r3', kind: 'resistor', a: { x: 8, y: 0 }, b: { x: 12, y: 0 }, value: 2, label: 'R3' },
    {
      id: 'vb',
      kind: 'voltage-source',
      a: { x: 12, y: 0 },
      b: { x: 12, y: 4 },
      value: 6,
      label: 'V2',
    },
  ],
  wires: [
    {
      id: 'tierra',
      points: [
        { x: 0, y: 4 },
        { x: 12, y: 4 },
      ],
    },
  ],
  ground: { x: 0, y: 4 },
};

export const ecuacionesDeEstado: Calculator<
  StateEquationsInput,
  StateEquationsValue,
  StateEquationsErrorCode
> = {
  meta: {
    id: 'ecuaciones-de-estado',
    title: 'Ecuaciones de estado',
    summary:
      'Formula ẋ = Ax + Bu de una red RLC dibujada (árbol normal, cortes y lazos) y la resuelve con Laplace.',
    citations: [
      {
        sourceId: 'dorf-svoboda-2000',
        locator: '9.ª ed. en inglés, sec. 9.9, tabla 9.9-1 y fig. 9.9-1',
      },
      { sourceId: 'hayt-kemmerly-1993', locator: '8.ª ed. en inglés, ejemplo 9.10' },
    ],
  },
  inputSchema,
  example: { circuit: DORF_FIG_9_9_1 },
  solve: solveStateEquations,
};
