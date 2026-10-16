import { describe, expect, it } from 'vitest';
import { respuestaTransitoria, type TransientInput } from './respuesta-transitoria';
import { timeResponse } from './time-response';

const solve = (input: Partial<TransientInput>) =>
  respuestaTransitoria.solve({ ...respuestaTransitoria.example, ...input });
function ok(input: Partial<TransientInput>) {
  const r = solve(input);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('respuesta transitoria', () => {
  it('el ejemplo cumple el schema', () => {
    expect(respuestaTransitoria.inputSchema.safeParse(respuestaTransitoria.example).success).toBe(
      true,
    );
  });

  // Ogata, 3.ª ed., ejemplo 4-2 (5.ª ed., ejemplo 5-1): ζ = 0.6, ω_n = 5 rad/s. ω_d = 4, σ = 3,
  // β = 0.93 rad, t_r = 0.55 s, t_p = 0.785 s, M_p = 0.095 (9.5 %), t_s = 1.33 s (2 %) y 1 s (5 %).
  // El libro usa π ≈ 3.14; los valores exactos son t_r = 0.5536 y M_p = 0.0948.
  it('Ogata, ejemplo 4-2: especificaciones del segundo orden', () => {
    const r = ok({});
    const f = r.value.formulas!;
    expect(f.omegaD).toBeCloseTo(4, 10);
    expect(f.sigma).toBeCloseTo(3, 10);
    expect(f.beta).toBeCloseTo(0.93, 2);
    expect(f.rise).toBeCloseTo(0.55, 2);
    expect(f.peak).toBeCloseTo(0.785, 3);
    expect(f.overshoot).toBeCloseTo(0.095, 3);
    expect(f.settling2).toBeCloseTo(1.33, 2);
    expect(f.settling5).toBeCloseTo(1, 10);
    // Medidas sobre la curva: coinciden con las fórmulas exactas (t_r, t_p y M_p).
    const s = r.value.specs!;
    expect(s.rise).toBeCloseTo(f.rise, 6);
    expect(s.peak).toBeCloseTo(f.peak, 6);
    expect(s.overshoot).toBeCloseTo(f.overshoot, 6);
    expect(s.final).toBeCloseTo(1, 10);
  });

  // Ogata, 3.ª ed., sec. 4-2, ec. (4-3) a (4-6): con T = 2, c(t) = 1 − e^{−t/2} ante el escalón,
  // c(T) = 0.632; ante la rampa c(t) = t − T + Te^{−t/T} y el error tiende a T; ante el impulso,
  // c(t) = (1/T)e^{−t/T}.
  it('Ogata, ec. 4-3 a 4-6: primer orden', () => {
    const step = ok({ order: 'primer-orden', timeConstant: 2, input: 'escalon' });
    const c = timeResponse(step.value.tf, 'escalon')!;
    expect(c.evaluate(2)).toBeCloseTo(0.632, 3);
    expect(step.value.specs!.settling2).toBeCloseTo(-2 * Math.log(0.02), 6);
    const ramp = ok({ order: 'primer-orden', timeConstant: 2, input: 'rampa' });
    expect(ramp.value.steadyError).toBeCloseTo(2, 10);
    const impulse = ok({ order: 'primer-orden', timeConstant: 2, input: 'impulso' });
    const ci = timeResponse(impulse.value.tf, 'impulso')!;
    expect(ci.evaluate(1)).toBeCloseTo(0.5 * Math.exp(-0.5), 10);
  });

  // Ogata, 3.ª ed., sec. 4-3: la respuesta al impulso del segundo orden subamortiguado es
  // c(t) = [ω_n/√(1 − ζ²)] e^{−ζω_nt} sen(ω_dt). Con ζ = 0.6 y ω_n = 5, en t = 0.3 s.
  it('Ogata, sec. 4-3: impulso del segundo orden', () => {
    const r = ok({ input: 'impulso' });
    const c = timeResponse(r.value.tf, 'impulso')!;
    expect(c.evaluate(0.3)).toBeCloseTo((5 / 0.8) * Math.exp(-0.9) * Math.sin(1.2), 10);
  });

  // Ogata, 5.ª ed. en español, problema A-5-25 (fig. 5-71; en la 3.ª ed., fig. 5-63): el error del
  // sistema de segundo orden ante la rampa unitaria es e_ss = 2ζ/ω_n (con ζ = 0.6 y ω_n = 5: 0.24).
  it('Ogata: error del segundo orden ante la rampa, 2ζ/ω_n', () => {
    const r = ok({ input: 'rampa' });
    expect(r.value.steadyError).toBeCloseTo(0.24, 10);
  });

  // Kuo, 7.ª ed., ejemplo 7-5, ec. (7-56): M(s) = (s + 5)/(s⁴ + 17s³ + 60s² + 5s + 5) da
  // y(t) = 1 − 0.00056e^{−12.05t} − 0.0001381e^{−4.886t} − 0.9993e^{−0.03024t}cos 0.2898t
  //        − 0.1301e^{−0.03024t} sen 0.2898t.
  it('Kuo, ec. 7-56: respuesta al escalón de cuarto orden', () => {
    const r = ok({ order: 'general', input: 'escalon' });
    const c = timeResponse(r.value.tf, 'escalon')!;
    const kuo = (t: number) =>
      1 -
      0.00056 * Math.exp(-12.05 * t) -
      0.0001381 * Math.exp(-4.886 * t) -
      0.9993 * Math.exp(-0.03024 * t) * Math.cos(0.2898 * t) -
      0.1301 * Math.exp(-0.03024 * t) * Math.sin(0.2898 * t);
    for (const t of [1, 5, 20, 60]) expect(c.evaluate(t)).toBeCloseTo(kuo(t), 3);
    expect(r.value.specs!.final).toBeCloseTo(1, 10);
  });

  it('sistemas no amortiguados, sobreamortiguados e inestables', () => {
    // ζ = 2: sin sobrepaso; el levantamiento se mide de 10 a 90 %.
    const over = ok({ zeta: 2 });
    expect(over.value.specs!.overshoot).toBe(0);
    expect(over.value.specs!.riseCriterion).toBe('10-90');
    // ζ = 0: polos sobre el eje imaginario, sin especificaciones.
    const undamped = ok({ zeta: 0 });
    expect(undamped.value.specs).toBeNull();
    const bad = solve({ order: 'general', transfer: 's^^2' });
    expect(!bad.ok && bad.error.code).toBe('funcion-invalida');
  });
});
