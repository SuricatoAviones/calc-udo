import { describe, expect, it } from 'vitest';
import { lazoAbiertoYCerrado, type LoopInput } from './lazo-abierto-y-cerrado';

const solve = (input: Partial<LoopInput>) =>
  lazoAbiertoYCerrado.solve({ ...lazoAbiertoYCerrado.example, ...input });
function ok(input: Partial<LoopInput>) {
  const r = solve(input);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('funciones de lazo abierto y lazo cerrado', () => {
  it('el ejemplo cumple el schema', () => {
    expect(lazoAbiertoYCerrado.inputSchema.safeParse(lazoAbiertoYCerrado.example).success).toBe(
      true,
    );
  });

  // Kuo, 7.ª ed., ejemplo 7-5, ec. (7-55): G(s) = 1/[s²(s + 12)], H(s) = 5(s + 1)/(s + 5):
  // M(s) = (s + 5)/(s⁴ + 17s³ + 60s² + 5s + 5), estable.
  it('Kuo, ejemplo 7-5: función de transferencia en lazo cerrado', () => {
    const r = ok({});
    expect(r.value.closedLoop).toEqual({ num: [1, 5], den: [1, 17, 60, 5, 5] });
    expect(r.value.openLoop).toEqual({ num: [5, 5], den: [1, 17, 60, 0, 0] });
    expect(r.value.stable).toBe(true);
  });

  // Ogata, 3.ª ed., sec. 3-3, ec. (3-6) y (3-7): C/R = G₁G₂/(1 + G₁G₂H) y C/D = G₂/(1 + G₁G₂H).
  // Valores elegidos aquí: G₁ = 10, G₂ = 1/[s(s + 1)], H = 1 → C/R = 10/(s² + s + 10) y
  // C/D = 1/(s² + s + 10) (desarrollado a mano); la directa y la de lazo abierto son 10/[s(s + 1)].
  it('Ogata, ec. 3-6 y 3-7: lazo cerrado y perturbación', () => {
    const r = ok({ controller: '10', plant: '1/(s(s + 1))', feedback: '1' });
    expect(r.value.closedLoop).toEqual({ num: [10], den: [1, 1, 10] });
    expect(r.value.disturbance).toEqual({ num: [1], den: [1, 1, 10] });
    expect(r.value.forward).toEqual({ num: [10], den: [1, 1, 0] });
    expect(r.value.openLoop).toEqual(r.value.forward);
    expect(r.value.error).toEqual({ num: [1, 1, 0], den: [1, 1, 10] });
    expect(r.series.some((s) => s.id === 'escalon')).toBe(true);
  });

  it('realimentación positiva: G/(1 − GH)', () => {
    // G = 1/(s + 2), H = 1 → 1/(s + 1) (a mano).
    const r = ok({ controller: '1', plant: '1/(s + 2)', feedback: '1', sign: 'positiva' });
    expect(r.value.closedLoop).toEqual({ num: [1], den: [1, 1] });
  });

  it('lazo cerrado inestable y errores', () => {
    const unstable = ok({ controller: '1', plant: '1/(s - 3)', feedback: '1' });
    expect(unstable.value.stable).toBe(false);
    expect(unstable.notices.some((n) => n.level === 'warning')).toBe(true);
    const bad = solve({ plant: '1/(s^^2)' });
    expect(!bad.ok && bad.error.code).toBe('funcion-invalida');
  });
});
