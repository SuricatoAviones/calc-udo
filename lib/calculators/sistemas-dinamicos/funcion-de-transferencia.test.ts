import { describe, expect, it } from 'vitest';
import { funcionDeTransferencia, type TransferInput } from './funcion-de-transferencia';

const base = funcionDeTransferencia.example;
const solve = (input: Partial<TransferInput>) =>
  funcionDeTransferencia.solve({ ...base, ...input });
function ok(input: Partial<TransferInput>) {
  const r = solve(input);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('función de transferencia', () => {
  it('el ejemplo cumple el schema', () => {
    expect(funcionDeTransferencia.inputSchema.safeParse(base).success).toBe(true);
  });

  // Kuo, 7.ª ed., ejemplos 3-8 y 3-9: d²y/dt² + 3 dy/dt + 2y = r(t) → Y(s)/R(s) = 1/(s² + 3s + 2).
  it('Kuo, ejemplos 3-8 y 3-9: de la ecuación diferencial', () => {
    const r = ok({ mode: 'ecuacion' });
    expect(r.value.tf).toEqual({ num: [1], den: [1, 3, 2] });
    expect(r.value.poles.map((p) => p.re).sort((a, b) => a - b)).toEqual([-2, -1]);
    expect(r.value.order).toBe(2);
    expect(r.value.stability).toBe('estable');
  });

  // Ogata, 5.ª ed. en español, ejemplo 2-4: A = [0 1 0; 0 0 1; −5 −25 −5], B = [0; 25; −120],
  // C = [1 0 0]: Y(s)/U(s) = (25s + 5)/(s³ + 5s² + 25s + 5).
  it('Ogata 5.ª ed., ejemplo 2-4: de las ecuaciones de estado', () => {
    const r = ok({ mode: 'espacio-de-estados' });
    expect(r.value.tf).toEqual({ num: [25, 5], den: [1, 5, 25, 5] });
  });

  // Ogata, 3.ª ed., sec. 3-7, ec. (3-59): E_o/E_i = 1/(LCs² + RCs + 1) para el circuito LRC. Con
  // los valores del ejemplo (L = 1 H, R = 2 Ω, C = 0.5 F, elegidos aquí) queda 1/(0.5s² + s + 1),
  // es decir, 2/(s² + 2s + 2).
  it('Ogata, ec. 3-59: circuito LRC dibujado', () => {
    const r = ok({ mode: 'circuito' });
    expect(r.value.tf.num[0]).toBeCloseTo(2, 10);
    expect(r.value.tf.den).toEqual([1, 2, 2]);
    // La corriente del lazo: I/E_i = Cs/(LCs² + RCs + 1) = s/(s² + 2s + 2) (con C = 0.5, monico).
    const current = ok({ mode: 'circuito', output: 'r1', quantity: 'i' });
    expect(current.value.tf.num[0]).toBeCloseTo(1, 10);
    expect(current.value.tf.num.length).toBe(2);
    expect(current.value.tf.den).toEqual([1, 2, 2]);
  });

  // Ogata, 3.ª ed., ejemplo 8-1: G(s) = 10(s + 3)/[s(s + 2)(s² + s + 2)]: tipo 1, cero en −3 y
  // polos en 0, −2 y el par del factor cuadrático (ω_n = √2, ζ = 0.3536).
  it('Ogata, ejemplo 8-1: escrita como cociente', () => {
    const r = ok({ mode: 'funcion' });
    expect(r.value.type).toBe(1);
    expect(r.value.order).toBe(4);
    expect(r.value.zeros).toEqual([{ re: -3, im: 0 }]);
    const complex = r.value.poles.find((p) => p.im > 0)!;
    expect(complex.re).toBeCloseTo(-0.5, 10);
    expect(Math.hypot(complex.re, complex.im)).toBeCloseTo(Math.SQRT2, 10);
    expect(r.value.stability).toBe('marginal');
  });

  // Ogata, 3.ª ed., sec. 3-6: m·y'' + b·y' + k·y = u → 1/(ms² + bs + k). Valores elegidos aquí:
  // m = 2, b = 3, k = 5 → 0.5/(s² + 1.5s + 2.5).
  it('Ogata, sec. 3-6: sistema masa-resorte-amortiguador', () => {
    const r = ok({ mode: 'ecuacion', outputCoefficients: '2 3 5', inputCoefficients: '1' });
    expect(r.value.tf).toEqual({ num: [0.5], den: [1, 1.5, 2.5] });
  });

  it('errores', () => {
    const coefs = solve({ mode: 'ecuacion', outputCoefficients: 'a b' });
    expect(!coefs.ok && coefs.error.code).toBe('coeficientes-invalidos');
    const fn = solve({ mode: 'funcion', transfer: 's^^2' });
    expect(!fn.ok && fn.error.code).toBe('funcion-invalida');
    const dims = solve({ mode: 'espacio-de-estados', B: [[1], [2]] });
    expect(!dims.ok && dims.error.code).toBe('dimensiones');
    const noStorage = solve({
      mode: 'circuito',
      circuit: {
        ...base.circuit,
        components: base.circuit.components.filter(
          (c) => c.kind === 'resistor' || c.kind === 'voltage-source',
        ),
      },
    });
    expect(!noStorage.ok && noStorage.error.code).toBe('circuito-invalido');
  });
});
