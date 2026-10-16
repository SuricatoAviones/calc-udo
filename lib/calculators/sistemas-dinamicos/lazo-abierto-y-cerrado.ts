/**
 * Funciones de transferencia de un sistema realimentado con controlador G₁(s), planta G₂(s),
 * realimentación H(s) y una perturbación D(s) que entra entre el controlador y la planta
 * (Ogata, 3.ª ed., sec. 3-3, figuras 3-6 y 3-7):
 *
 *   directa:           C/E = G₁G₂
 *   lazo abierto:      B/E = G₁G₂H
 *   lazo cerrado:      C/R = G₁G₂/(1 + G₁G₂H)
 *   perturbación:      C/D = G₂/(1 + G₁G₂H)
 *   salida total:      C = G₂/(1 + G₁G₂H)·[G₁R + D]
 *
 * Con realimentación positiva los denominadores son 1 − G₁G₂H.
 */
import { z } from 'zod';
import { addPoly, mulPoly, polyRoots, scalePoly } from '@/lib/math/polynomials';
import type { Calculator, CalculatorResult, Notice, Series, Step, SummaryItem } from '../types';
import { inverseLaplace } from '../circuitos-y-sistemas/laplace-inverse';
import { poleZeroSeries } from './tf-analysis';
import {
  parseTf,
  polyTex,
  rootsText,
  tfFeedback,
  tfMul,
  tfReduce,
  tfTex,
  zpk,
  type TransferFunction,
} from './transfer-function';

const tfField = (what: string) =>
  z.string().trim().min(1, `Escribe ${what}.`).max(200, `${what} es demasiado larga.`);

const inputSchema = z.object({
  controller: tfField('G₁(s)'),
  plant: tfField('G₂(s)'),
  feedback: tfField('H(s)'),
  sign: z.enum(['negativa', 'positiva']),
});

export type LoopInput = z.infer<typeof inputSchema>;

export interface LoopValue {
  forward: TransferFunction;
  openLoop: TransferFunction;
  closedLoop: TransferFunction;
  disturbance: TransferFunction;
  error: TransferFunction;
  characteristic: number[];
  stable: boolean;
}

export type LoopErrorCode = 'funcion-invalida';

function fail(message: string): CalculatorResult<LoopValue, LoopErrorCode> {
  return {
    ok: false,
    error: { code: 'funcion-invalida', message },
    steps: [],
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

const ONE: TransferFunction = { num: [1], den: [1] };

export function solveLoop(input: LoopInput): CalculatorResult<LoopValue, LoopErrorCode> {
  const G1 = parseTf(input.controller, 'G₁(s)');
  if (!G1.ok) return fail(G1.message);
  const G2 = parseTf(input.plant, 'G₂(s)');
  if (!G2.ok) return fail(G2.message);
  const H = parseTf(input.feedback, 'H(s)');
  if (!H.ok) return fail(H.message);
  const sign = input.sign === 'negativa' ? -1 : 1;
  const op = sign === -1 ? '+' : '-';
  const steps: Step[] = [];
  const notices: Notice[] = [];

  const forward = tfReduce(tfMul(G1.tf, G2.tf)).tf;
  const openLoop = tfReduce(tfMul(forward, H.tf)).tf;
  const closedLoop = tfReduce(tfFeedback(forward, H.tf, sign)).tf;
  const disturbance = tfReduce(tfFeedback(G2.tf, tfMul(G1.tf, H.tf), sign)).tf;
  const error = tfReduce(tfFeedback(ONE, openLoop, sign)).tf;
  // 1 ∓ G₁G₂H = 0 con todos los denominadores multiplicados.
  const characteristic = addPoly(
    mulPoly(mulPoly(G1.tf.den, G2.tf.den), H.tf.den),
    scalePoly(mulPoly(mulPoly(G1.tf.num, G2.tf.num), H.tf.num), -sign),
  );
  const roots = polyRoots(characteristic);
  const stable = roots.every((r) => r.value.re < -1e-9);

  steps.push({
    title: 'Datos del sistema',
    explanation: `Controlador G₁(s), planta G₂(s) y realimentación H(s) ${sign === -1 ? 'negativa' : 'positiva'}. La perturbación D(s) entra entre el controlador y la planta (Ogata, fig. 3-7).`,
    result: `G_1(s) = ${tfTex(G1.tf)},\\quad G_2(s) = ${tfTex(G2.tf)},\\quad H(s) = ${tfTex(H.tf)}`,
  });
  steps.push({
    title: 'Función de transferencia directa',
    explanation: 'Cociente entre la salida C(s) y la señal de error actuante E(s).',
    formula: '\\frac{C(s)}{E(s)} = G_1(s)G_2(s)',
    result: `\\frac{C(s)}{E(s)} = ${tfTex(forward)}`,
  });
  steps.push({
    title: 'Función de transferencia en lazo abierto',
    explanation:
      'Cociente entre la señal de realimentación B(s) y E(s). Si H(s) = 1, coincide con la directa.',
    formula: '\\frac{B(s)}{E(s)} = G_1(s)G_2(s)H(s)',
    result: `\\frac{B(s)}{E(s)} = ${tfTex(openLoop)}`,
  });
  steps.push({
    title: 'Función de transferencia en lazo cerrado',
    explanation: 'Con D(s) = 0: de C = G₁G₂E y E = R ∓ HC se elimina E.',
    formula: `\\frac{C(s)}{R(s)} = \\frac{G_1(s)G_2(s)}{1 ${op} G_1(s)G_2(s)H(s)}`,
    result: `\\frac{C(s)}{R(s)} = ${tfTex(closedLoop)}`,
  });
  steps.push({
    title: 'Respuesta a la perturbación',
    explanation:
      'Con R(s) = 0. Si |G₁G₂H| ≫ 1, C/D se acerca a 0: el lazo cerrado rechaza la perturbación (Ogata, sec. 3-3).',
    formula: `\\frac{C(s)}{D(s)} = \\frac{G_2(s)}{1 ${op} G_1(s)G_2(s)H(s)}`,
    result: `\\frac{C(s)}{D(s)} = ${tfTex(disturbance)}`,
  });
  steps.push({
    title: 'Señal de error actuante',
    formula: `\\frac{E(s)}{R(s)} = \\frac{1}{1 ${op} G_1(s)G_2(s)H(s)}`,
    result: `\\frac{E(s)}{R(s)} = ${tfTex(error)}`,
  });
  steps.push({
    title: 'Salida con las dos entradas',
    explanation: 'Por superposición se suman las respuestas a R(s) y a D(s).',
    formula: `C(s) = \\frac{G_2(s)}{1 ${op} G_1(s)G_2(s)H(s)}\\left[G_1(s)R(s) + D(s)\\right]`,
  });
  steps.push({
    title: 'Polinomio característico',
    explanation: `Es el denominador común de C/R, C/D y E/R: las tres comparten los polos de lazo cerrado. Raíces: ${rootsText(roots)}. ${
      stable
        ? 'Todas tienen parte real negativa: el lazo cerrado es estable.'
        : 'Hay raíces con parte real no negativa: el lazo cerrado no es estable.'
    }`,
    formula: `1 ${op} G_1(s)G_2(s)H(s) = 0`,
    result: `${polyTex(characteristic)} = 0`,
  });
  if (!stable)
    notices.push({
      level: 'warning',
      message: 'El lazo cerrado no es estable: sus respuestas crecen sin límite.',
    });

  const series: Series[] = [{ ...poleZeroSeries(closedLoop, 'Polos y ceros en lazo cerrado') }];
  if (stable) {
    const poles = zpk(closedLoop).poles;
    const slowest = Math.min(...poles.map((p) => Math.abs(p.value.re)));
    const horizon = Math.min(Math.max(8 / Math.max(slowest, 1e-6), 0.5), 200);
    const step = (tf: TransferFunction) => {
      const inv = inverseLaplace([{ delay: 0, num: tf.num, den: [...tf.den, 0] }], 'C', 'c');
      if (!inv.ok) return [];
      return Array.from({ length: 301 }, (_, i) => {
        const t = (horizon * i) / 300;
        return { x: t, y: inv.result.evaluate(t) };
      });
    };
    series.push({
      id: 'escalon',
      title: 'Respuesta al escalón unitario',
      xLabel: 't (s)',
      yLabel: 'c(t)',
      label: 'R(s) = 1/s',
      points: step(closedLoop),
      reference: { label: 'D(s) = 1/s', points: step(disturbance) },
    });
  }
  const summary: SummaryItem[] = [
    { label: 'Lazo cerrado', value: `\\frac{C(s)}{R(s)} = ${tfTex(closedLoop)}`, emphasis: true },
    { label: 'Lazo abierto', value: `G_1G_2H = ${tfTex(openLoop)}` },
    { label: 'Directa', value: `G_1G_2 = ${tfTex(forward)}` },
    { label: 'Perturbación', value: `\\frac{C(s)}{D(s)} = ${tfTex(disturbance)}` },
    { label: 'Estabilidad', value: `\\text{${stable ? 'estable' : 'inestable'} en lazo cerrado}` },
  ];
  return {
    ok: true,
    value: { forward, openLoop, closedLoop, disturbance, error, characteristic, stable },
    summary,
    steps,
    tables: [],
    series,
    notices,
  };
}

export const lazoAbiertoYCerrado: Calculator<LoopInput, LoopValue, LoopErrorCode> = {
  meta: {
    id: 'lazo-abierto-y-cerrado',
    title: 'Funciones de lazo abierto y lazo cerrado',
    summary:
      'Directa, de lazo abierto y de lazo cerrado de un sistema realimentado, con perturbaciones.',
    citations: [
      { sourceId: 'ogata-1998', locator: 'Sec. 3-3, figuras 3-6 y 3-7 (ec. 3-6)' },
      { sourceId: 'kuo-1996', locator: 'Sec. 3-3 y ejemplo 7-5' },
    ],
  },
  inputSchema,
  // Kuo, ejemplo 7-5: M(s) = (s + 5)/(s⁴ + 17s³ + 60s² + 5s + 5).
  example: {
    controller: '1',
    plant: '1/(s^2 (s + 12))',
    feedback: '5(s + 1)/(s + 5)',
    sign: 'negativa',
  },
  solve: solveLoop,
};
