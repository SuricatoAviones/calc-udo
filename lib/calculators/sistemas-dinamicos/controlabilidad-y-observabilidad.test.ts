import { describe, expect, it } from 'vitest';
import {
  controlabilidadYObservabilidad,
  type ControllabilityInput,
} from './controlabilidad-y-observabilidad';

const solve = (input: Partial<ControllabilityInput>) =>
  controlabilidadYObservabilidad.solve({ ...controlabilidadYObservabilidad.example, ...input });
function ok(input: Partial<ControllabilityInput>) {
  const r = solve(input);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('controlabilidad y observabilidad', () => {
  it('el ejemplo cumple el schema', () => {
    expect(
      controlabilidadYObservabilidad.inputSchema.safeParse(controlabilidadYObservabilidad.example)
        .success,
    ).toBe(true);
  });

  // Ogata, 3.ª ed., ejemplo 11-14: A = [1 1; −2 −1], B = [0; 1], C = [1 0]. [B AB] = [0 1; 1 −1]
  // tiene rango 2 (controlable); [CB CAB] = [0 1] tiene rango 1 (salida controlable);
  // [C* A*C*] = [1 1; 0 1] tiene rango 2 (observable).
  it('Ogata, ejemplo 11-14: controlable, con salida controlable y observable', () => {
    const r = ok({});
    expect(r.value.controllable).toBe(true);
    expect(r.value.outputControllable).toBe(true);
    expect(r.value.observable).toBe(true);
    expect(r.value.cancellation).toBe(false);
  });

  // Ogata, 3.ª ed., ejemplo 11-11 (5.ª ed., ejemplos 9-10 y 9-11): con A = [1 1; 0 −1] y
  // B = [1; 0], [B AB] = [1 1; 0 0] es singular; con A = [1 1; 2 −1] y B = [0; 1],
  // [B AB] = [0 1; 1 −1] no es singular.
  it('Ogata, ejemplo 11-11: matriz de controlabilidad singular y no singular', () => {
    const no = ok({
      A: [
        [1, 1],
        [0, -1],
      ],
      B: [[1], [0]],
    });
    expect(no.value.controllabilityRank).toBe(1);
    expect(no.value.controllable).toBe(false);
    const yes = ok({
      A: [
        [1, 1],
        [2, -1],
      ],
      B: [[0], [1]],
    });
    expect(yes.value.controllable).toBe(true);
  });

  // Ogata, 3.ª ed., ejemplo 11-15: A = [0 1 0; 0 0 1; −6 −11 −6], B = [0; 0; 1], C = [4 5 1].
  // [C* A*C* (A*)²C*] = [4 −6 6; 5 −7 5; 1 −1 −1] tiene determinante 0: no es completamente
  // observable. En la función de transferencia se cancela (s + 1):
  // Y/U = (s + 1)(s + 4)/[(s + 1)(s + 2)(s + 3)].
  it('Ogata, ejemplo 11-15: no observable y cancelación de (s + 1)', () => {
    const r = ok({
      A: [
        [0, 1, 0],
        [0, 0, 1],
        [-6, -11, -6],
      ],
      B: [[0], [0], [1]],
      C: [[4, 5, 1]],
    });
    expect(r.value.observabilityRank).toBe(2);
    expect(r.value.observable).toBe(false);
    expect(r.value.controllable).toBe(true);
    expect(r.value.cancellation).toBe(true);
  });

  // Ogata, 3.ª ed., ejemplo 11-13: X(s)/U(s) = (s + 2.5)/[(s + 2.5)(s − 1)] tiene una
  // cancelación y el rango de [B AB] es 1. Una realización (verificada a mano) es
  // A = [0 1; 2.5 −1.5], B = [1; −2.5]: AB = [−2.5; 6.25] = −2.5B.
  it('Ogata, ejemplo 11-13: cancelación y rango 1', () => {
    const r = ok({
      A: [
        [0, 1],
        [2.5, -1.5],
      ],
      B: [[1], [-2.5]],
      C: [[1, 0]],
    });
    expect(r.value.controllabilityRank).toBe(1);
    expect(r.value.cancellation).toBe(true);
  });

  it('errores de dimensiones', () => {
    const r = solve({ B: [[1], [2], [3]] });
    expect(!r.ok && r.error.code).toBe('dimensiones');
    const d = solve({ D: [[0, 0]] });
    expect(!d.ok && d.error.code).toBe('dimensiones');
  });
});
