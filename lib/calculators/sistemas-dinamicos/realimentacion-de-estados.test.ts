import { describe, expect, it } from 'vitest';
import { realimentacionDeEstados, type StateFeedbackInput } from './realimentacion-de-estados';
import { controllabilityMatrix, inverse, polyOfMatrix } from './state-design';

const solve = (input: Partial<StateFeedbackInput>) =>
  realimentacionDeEstados.solve({ ...realimentacionDeEstados.example, ...input });
function ok(input: Partial<StateFeedbackInput>) {
  const r = solve(input);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('control por realimentación de estados', () => {
  it('el ejemplo cumple el schema', () => {
    expect(
      realimentacionDeEstados.inputSchema.safeParse(realimentacionDeEstados.example).success,
    ).toBe(true);
  });

  // Ogata, 3.ª ed., ejemplo 12-1: A = [0 1 0; 0 0 1; −1 −5 −6], B = [0; 0; 1], polos deseados
  // −2 ± j4 y −10. M = [0 0 1; 0 1 −6; 1 −6 31] con |M| = −1; |sI − A| = s³ + 6s² + 5s + 1;
  // deseado s³ + 14s² + 60s + 200; K = [199 55 8] por los tres métodos. En Ackermann,
  // φ(A) = [199 55 8; −8 159 7; −7 −43 117] y M⁻¹ = [5 6 1; 6 1 0; 1 0 0].
  it('Ogata, ejemplo 12-1: K = [199 55 8]', () => {
    const r = ok({});
    expect(r.value.K).toEqual([199, 55, 8]);
    expect(r.value.characteristic).toEqual([1, 6, 5, 1]);
    expect(r.value.desired).toEqual([1, 14, 60, 200]);
    const { A, B } = realimentacionDeEstados.example;
    const M = controllabilityMatrix(A, B).matrix;
    expect(M).toEqual([
      [0, 0, 1],
      [0, 1, -6],
      [1, -6, 31],
    ]);
    expect(polyOfMatrix([1, 14, 60, 200], A)).toEqual([
      [199, 55, 8],
      [-8, 159, 7],
      [-7, -43, 117],
    ]);
    expect(inverse(M)).toEqual([
      [5, 6, 1],
      [6, 1, 0],
      [1, 0, 0],
    ]);
  });

  it('respuesta a una condición inicial', () => {
    const r = ok({ initial: '1, 0, 0' });
    expect(r.series).toHaveLength(3);
    // x1(0) = 1: la curva arranca en la condición inicial.
    expect(r.series[0]!.points[0]!.y).toBeCloseTo(1, 8);
  });

  it('errores', () => {
    // Ogata, ejemplo 11-11: con A = [1 1; 0 −1] y B = [1; 0] no es controlable.
    const notCtrl = solve({
      A: [
        [1, 1],
        [0, -1],
      ],
      B: [[1], [0]],
      poles: '-1, -2',
    });
    expect(!notCtrl.ok && notCtrl.error.code).toBe('no-controlable');
    const count = solve({ poles: '-1, -2' });
    expect(!count.ok && count.error.code).toBe('polos-invalidos');
    const conj = solve({ poles: '-2 + 4j, -2 - 3j, -10' });
    expect(!conj.ok && conj.error.code).toBe('polos-invalidos');
    const bad = solve({ poles: 'a, b, c' });
    expect(!bad.ok && bad.error.code).toBe('polos-invalidos');
    const x0 = solve({ initial: '1, 2' });
    expect(!x0.ok && x0.error.code).toBe('estado-inicial-invalido');
  });
});
