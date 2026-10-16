import { describe, expect, it } from 'vitest';
import { compensadorAdelantoRetraso, type CompensatorInput } from './compensador-adelanto-retraso';

const solve = (input: Partial<CompensatorInput>) =>
  compensadorAdelantoRetraso.solve({ ...compensadorAdelantoRetraso.example, ...input });
function ok(input: Partial<CompensatorInput>) {
  const r = solve(input);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('compensador de adelanto o retraso', () => {
  it('el ejemplo cumple el schema', () => {
    expect(
      compensadorAdelantoRetraso.inputSchema.safeParse(compensadorAdelantoRetraso.example).success,
    ).toBe(true);
  });

  // Ogata, 3.ª ed., ejemplo 7-1: G(s) = 4/[s(s + 2)], polos deseados −2 ± j2√3 (ζ = 0.5, ω_n = 4).
  // ∠G(s_d) = −210°, φ = 30°; por la bisectriz, cero en −2.9 y polo en −5.4 (α = 0.537);
  // K = 18.7 = 4K_c, K_c = 4.68; K_v = 5.02 y el tercer polo en −3.4. El libro hace la
  // construcción en la gráfica; con la bisectriz exacta el cero queda en −2.928 y el polo en −5.464.
  it('Ogata, ejemplo 7-1: adelanto por el lugar de las raíces', () => {
    const r = ok({ mode: 'lgr-adelanto', zeta: 0.5, omegaN: 4 });
    expect(r.value.details.angleDeficiency).toBeCloseTo(30, 8);
    expect(Math.abs(r.value.zero - 2.9)).toBeLessThan(0.1);
    expect(Math.abs(r.value.pole - 5.4)).toBeLessThan(0.1);
    expect(r.value.zero).toBeCloseTo(2.928, 3);
    expect(r.value.pole).toBeCloseTo(5.464, 3);
    expect(r.value.ratio).toBeCloseTo(0.537, 2);
    // Con el cero y el polo exactos, K_c = 4.732 y K_v = 5.07 (el libro: 4.68 y 5.02).
    expect(r.value.kc / 4.68).toBeCloseTo(1, 1);
    expect(r.value.errorConstant / 5.02).toBeCloseTo(1, 1);
    expect(r.value.dominant!.re).toBeCloseTo(-2, 6);
    expect(r.value.dominant!.im).toBeCloseTo(2 * Math.sqrt(3), 6);
  });

  // Ogata, 3.ª ed., ejemplo 7-2: G(s) = 1.06/[s(s + 1)(s + 2)], polos dominantes
  // −0.3307 ± j0.5864 (ζ = 0.491), K_v = 0.53. Con β = 10, cero en −0.05 y polo en −0.005, el
  // compensador aporta unos 4°; los nuevos polos dominantes son −0.31 ± j0.55 y
  // K̂_c = 1.0235/1.06 = 0.9656 (lectura gráfica del libro), con K_v ≈ 5.12.
  it('Ogata, ejemplo 7-2: atraso por el lugar de las raíces', () => {
    const r = ok({
      mode: 'lgr-atraso',
      plant: '1.06/(s(s + 1)(s + 2))',
      lagBeta: 10,
      lagZero: 0.05,
    });
    expect(r.value.details.uncompensatedZeta).toBeCloseTo(0.491, 3);
    expect(r.value.details.uncompensatedConstant).toBeCloseTo(0.53, 10);
    expect(r.value.pole).toBeCloseTo(0.005, 10);
    expect(r.value.dominant!.re).toBeCloseTo(-0.31, 2);
    expect(r.value.dominant!.im).toBeCloseTo(0.55, 2);
    expect(r.value.kc).toBeCloseTo(0.9656, 2);
    expect(r.value.errorConstant).toBeCloseTo(5.12, 1);
  });

  // Ogata, 3.ª ed., ejemplo 9-1: G(s) = 4/[s(s + 2)], K_v = 20 → K = 10; margen sin compensar 17°
  // (lectura de la traza; exacto 17.96°). El libro toma φm = 38° → α = 0.24, ωc = 9 rad/s,
  // 1/T = 4.41, 1/(αT) = 18.4 y K_c = 41.7. Con φm = 38° exactos: α = 0.2379, ωc = 8.95,
  // 1/T = 4.36, 1/(αT) = 18.3 y K_c = 42.0 (las diferencias vienen de leer 9 rad/s en la gráfica).
  it('Ogata, ejemplo 9-1: adelanto por Bode', () => {
    const r = ok({ mode: 'bode-adelanto', leadPhase: 38 });
    expect(r.value.details.K).toBeCloseTo(10, 10);
    expect(r.value.details.uncompensatedPhaseMargin).toBeCloseTo(17.96, 1);
    expect(r.value.ratio).toBeCloseTo(0.24, 2);
    expect(r.value.details.crossover).toBeCloseTo(9, 0);
    expect(r.value.zero).toBeCloseTo(4.41, 0);
    expect(r.value.pole).toBeCloseTo(18.4, 0);
    expect(r.value.kc / 41.7).toBeCloseTo(1, 1);
    expect(r.value.errorConstant).toBeCloseTo(20, 8);
    expect(r.value.phaseMargin!).toBeGreaterThan(49);
    // Sin φm elegido, el procedimiento usa el margen exacto: φm = 50 − 17.96 + 5 = 37.04°.
    const exact = ok({ mode: 'bode-adelanto' });
    expect(exact.value.details.leadPhase).toBeCloseTo(37.04, 1);
  });

  // Ogata, 3.ª ed., ejemplo 9-2: G(s) = 1/[s(s + 1)(0.5s + 1)], K_v = 5 → K = 5. El libro toma
  // ωc = 0.5 rad/s (con 12° de tolerancia), el cero en 0.1 y lee una atenuación de 20 dB (β = 10):
  // G_c = 0.5(s + 0.1)/(s + 0.01), margen de fase ≈ 40° y de ganancia ≈ 11 dB (lecturas de la
  // traza; con ese mismo compensador los márgenes exactos son 41.6° y 14.3 dB, y el del sistema sin
  // compensar es −13° en vez de −20°). El valor exacto de |G₁(j0.5)| es 18.77 dB, así que con
  // ωc = 0.5 y el cero en 0.1 sale β = 8.68.
  it('Ogata, ejemplo 9-2: atraso por Bode', () => {
    const r = ok({
      mode: 'bode-atraso',
      plant: '1/(s(s + 1)(0.5s + 1))',
      errorConstant: 5,
      phaseMargin: 40,
      allowance: 12,
      crossover: 0.5,
      zeroFrequency: 0.1,
    });
    expect(r.value.details.K).toBeCloseTo(5, 10);
    expect(r.value.ratio).toBeCloseTo(8.68, 2);
    expect(r.value.zero).toBeCloseTo(0.1, 10);
    expect(r.value.details.uncompensatedPhaseMargin).toBeCloseTo(-13, 0);
    expect(r.value.phaseMargin!).toBeGreaterThan(37);
    expect(r.value.gainMarginDb!).toBeGreaterThan(10);
    expect(r.value.errorConstant).toBeCloseTo(5, 8);
    // El procedimiento completo, sin fijar ωc ni el cero, cumple el margen pedido.
    const auto = ok({
      mode: 'bode-atraso',
      plant: '1/(s(s + 1)(0.5s + 1))',
      errorConstant: 5,
      phaseMargin: 40,
      allowance: 12,
    });
    expect(auto.value.phaseMargin!).toBeGreaterThan(40);
    expect(auto.value.gainMarginDb!).toBeGreaterThan(10);
  });

  it('casos sin compensación y errores', () => {
    const none = solve({ mode: 'bode-adelanto', phaseMargin: 10, allowance: 0 });
    expect(!none.ok && none.error.code).toBe('sin-compensacion');
    const bad = solve({ plant: 's^^2' });
    expect(!bad.ok && bad.error.code).toBe('funcion-invalida');
  });
});
