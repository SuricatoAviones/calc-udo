/**
 * Juegos de suma cero resueltos con programación lineal (Taha, sec. 13.4.2; Hillier &
 * Lieberman, sec. 14.5). Sirve para cualquier matriz m × n:
 *
 *   A:  máx v  s.a.  Σᵢ aᵢⱼ xᵢ ≥ v (cada j),  Σ xᵢ = 1,  x ≥ 0
 *   B:  mín v  s.a.  Σⱼ aᵢⱼ yⱼ ≤ v (cada i),  Σ yⱼ = 1,  y ≥ 0
 *
 * El programa de B es el dual del de A. Como el simplex trabaja con variables no negativas, si
 * algún pago es ≤ 0 se suma una constante K a toda la matriz (el valor del juego sube en K y las
 * estrategias óptimas no cambian).
 */
import { z } from 'zod';
import { latexLines } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import { lpLatex, type LinearProgram } from '../optimizacion-de-operaciones/lp-model';
import { solveLpSilently } from '../optimizacion-de-operaciones/lp-solve';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import { colName, payoffMatrixField, payoffMatrixLatex, rowName } from './games';

export const gameLpInputSchema = z.object({ payoff: payoffMatrixField });
export type GameLpInput = z.infer<typeof gameLpInputSchema>;

export interface GameLpValue {
  value: number;
  strategyA: number[];
  strategyB: number[];
  /** Constante sumada a la matriz para que todos los pagos sean positivos. */
  shift: number;
}

export type GameLpErrorCode = 'lp-failed';

const vector = (xs: Rational[]) => `\\left(${xs.map((x) => x.toLatex()).join(',\\ ')}\\right)`;

export function solveGameLp(input: GameLpInput): CalculatorResult<GameLpValue, GameLpErrorCode> {
  const a = input.payoff.map((row) => row.map(Rational.fromNumber));
  const m = a.length;
  const n = a[0]!.length;
  const min = a.flat().reduce((x, y) => (y.lt(x) ? y : x));
  const K = min.sign() > 0 ? Rational.ZERO : Rational.ONE.sub(min);
  const shifted = a.map((row) => row.map((v) => v.add(K)));
  const steps: Step[] = [{ title: 'Matriz de pagos', result: payoffMatrixLatex(input.payoff) }];
  if (!K.isZero()) {
    steps.push({
      title: 'Hacer positivos los pagos',
      explanation:
        'Las variables del simplex son no negativas y el valor del juego podría ser negativo. Se suma una constante K a todos los pagos: el valor del juego aumenta en K y las estrategias óptimas no cambian.',
      formula: `a'_{ij} = a_{ij} + K`,
      result: `K = ${K.toLatex()}`,
    });
  }

  const one = Rational.ONE;
  const zero = Rational.ZERO;
  // A: variables x₁…x_m, v.
  const lpA: LinearProgram = {
    sense: 'max',
    variables: [...a.map((_, i) => `x${i + 1}`), 'v'],
    objective: [...a.map(() => zero), one],
    constraints: [
      ...Array.from({ length: n }, (_, j) => ({
        coefficients: [...shifted.map((row) => row[j]!.neg()), one],
        relation: '<=' as const,
        rhs: zero,
      })),
      { coefficients: [...a.map(() => one), zero], relation: '=' as const, rhs: one },
    ],
  };
  // B: variables y₁…y_n, v.
  const lpB: LinearProgram = {
    sense: 'min',
    variables: [...a[0]!.map((_, j) => `y${j + 1}`), 'v'],
    objective: [...a[0]!.map(() => zero), one],
    constraints: [
      ...shifted.map((row) => ({
        coefficients: [...row.map((v) => v.neg()), one],
        relation: '>=' as const,
        rhs: zero,
      })),
      { coefficients: [...a[0]!.map(() => one), zero], relation: '=' as const, rhs: one },
    ],
  };
  steps.push(
    {
      title: 'Programa lineal del jugador A',
      explanation:
        'A elige las probabilidades xᵢ que maximizan v, el pago esperado que se asegura contra cualquier estrategia pura de B (cada restricción es Σᵢ a′ᵢⱼ xᵢ ≥ v, escrita como v − Σᵢ a′ᵢⱼ xᵢ ≤ 0).',
      result: lpLatex(lpA),
    },
    {
      title: 'Programa lineal del jugador B',
      explanation:
        'B elige las probabilidades yⱼ que minimizan el pago máximo que concede. Es el dual del programa de A, así que ambos tienen el mismo valor óptimo.',
      result: lpLatex(lpB),
    },
  );

  const solA = solveLpSilently(lpA);
  const solB = solveLpSilently(lpB);
  if (solA.status !== 'optimal' || solB.status !== 'optimal') {
    return {
      ok: false,
      error: { code: 'lp-failed', message: 'No se pudo resolver el programa lineal del juego.' },
      ...emptyTrace(),
      steps,
    };
  }
  const x = solA.x.slice(0, m);
  const y = solB.x.slice(0, n);
  const value = solA.z.sub(K);
  steps.push({
    title: 'Solución',
    explanation: K.isZero()
      ? 'Los dos programas dan el mismo valor óptimo: el valor del juego.'
      : `Los dos programas dan el mismo valor óptimo v′ = ${solA.z.toText()}; se le resta K para obtener el valor del juego.`,
    result: latexLines([
      `x^* = ${vector(x)},\\qquad y^* = ${vector(y)}`,
      K.isZero()
        ? `v = ${value.toLatex()}`
        : `v = v' - K = ${solA.z.toLatex()} - ${K.toLatex()} = ${value.toLatex()}`,
    ]),
  });

  return {
    ok: true,
    value: {
      value: value.toNumber(),
      strategyA: x.map((v) => v.toNumber()),
      strategyB: y.map((v) => v.toNumber()),
      shift: K.toNumber(),
    },
    summary: [
      { label: 'Valor del juego', value: `v = ${value.toLatex()}`, emphasis: true },
      { label: 'Estrategia óptima de A', value: `x^* = ${vector(x)}` },
      { label: 'Estrategia óptima de B', value: `y^* = ${vector(y)}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'estrategias',
        title: 'Estrategias óptimas',
        columns: [
          { key: 'player', header: '\\text{Jugador}', format: 'text' },
          { key: 'strategy', header: '\\text{Estrategia}', format: 'latex' },
          { key: 'probability', header: '\\text{Probabilidad}', format: 'latex' },
        ],
        rows: [
          ...x.map((p, i) => ({ player: 'A', strategy: rowName(i), probability: p.toLatex() })),
          ...y.map((p, j) => ({ player: 'B', strategy: colName(j), probability: p.toLatex() })),
        ],
      },
    ],
  };
}

export const gameLp: Calculator<GameLpInput, GameLpValue, GameLpErrorCode> = {
  meta: {
    id: 'juegos-programacion-lineal',
    title: 'Juegos resueltos con programación lineal',
    summary: 'Estrategias mixtas óptimas de un juego m × n con el método simplex.',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Sec. 14.5, variación 3 del problema de la campaña política (7.ª ed. en inglés)',
      },
      { sourceId: 'taha', locator: 'Sec. 13.4.2, solución de juegos por programación lineal' },
      { sourceId: 'anderson-1993' },
    ],
  },
  inputSchema: gameLpInputSchema,
  // Hillier & Lieberman, tabla 14.5 (variación 3), que la sec. 14.5 resuelve por PL.
  example: {
    payoff: [
      [0, -2, 2],
      [5, 4, -3],
      [2, 3, -4],
    ],
  },
  solve: solveGameLp,
};
