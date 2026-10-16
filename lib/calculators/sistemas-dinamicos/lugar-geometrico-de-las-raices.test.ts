import { describe, expect, it } from 'vitest';
import { lugarGeometricoDeLasRaices, type RootLocusInput } from './lugar-geometrico-de-las-raices';

const solve = (input: RootLocusInput) => lugarGeometricoDeLasRaices.solve(input);
function ok(input: RootLocusInput) {
  const r = solve(input);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('lugar geométrico de las raíces', () => {
  it('el ejemplo cumple el schema', () => {
    expect(
      lugarGeometricoDeLasRaices.inputSchema.safeParse(lugarGeometricoDeLasRaices.example).success,
    ).toBe(true);
  });

  // Ogata, 3.ª ed., ejemplo 6-1: G(s) = K/[s(s + 1)(s + 2)], H = 1.
  //   - lugar en el eje real: entre 0 y −1 y de −2 a −∞;
  //   - asíntotas a 60°, −60° y 180° con centroide en −1;
  //   - ruptura en s = −0.4226 (K = 0.3849); s = −1.5774 no está en el lugar (K = −0.3849);
  //   - cruce con el eje imaginario en ω = ±√2 con K = 6;
  //   - para ζ = 0.5: s = −0.3337 ± j0.5780, K = 1.0383 y el tercer polo en −2.3326.
  it('Ogata, ejemplo 6-1', () => {
    const r = ok({ openLoop: 'K/(s(s + 1)(s + 2))', zeta: 0.5 });
    const v = r.value;
    expect(v.realAxis).toEqual([
      [-Infinity, -2],
      [-1, 0],
    ]);
    expect(v.asymptotes!.count).toBe(3);
    expect([...v.asymptotes!.angles].sort((a, b) => a - b)).toEqual([-60, 60, 180]);
    expect(v.asymptotes!.centroid).toBeCloseTo(-1, 10);
    expect(v.breakaway).toHaveLength(1);
    expect(v.breakaway[0]!.s.re).toBeCloseTo(-0.4226, 4);
    expect(v.breakaway[0]!.K).toBeCloseTo(0.3849, 4);
    expect(v.crossings).toHaveLength(1);
    expect(v.crossings[0]!.omega).toBeCloseTo(Math.SQRT2, 8);
    expect(v.crossings[0]!.K).toBeCloseTo(6, 8);
    // El libro lee el punto en la gráfica: el corte exacto es s = −1/3 ± j/√3 (los ángulos suman
    // 120° + 40.89° + 19.11° = 180°), con K = 28/27 = 1.0370 y el tercer polo en −7/3.
    expect(v.dampingPoints).toHaveLength(1);
    expect(v.dampingPoints[0]!.s.re).toBeCloseTo(-0.3337, 3);
    expect(v.dampingPoints[0]!.s.im).toBeCloseTo(0.578, 2);
    expect(v.dampingPoints[0]!.K).toBeCloseTo(1.0383, 2);
    expect(v.dampingPoints[0]!.s.re).toBeCloseTo(-1 / 3, 8);
    expect(v.dampingPoints[0]!.K).toBeCloseTo(28 / 27, 8);
    const third = ok({ openLoop: 'K/(s(s + 1)(s + 2))', gain: 28 / 27 }).value.closedLoop!.find(
      (p) => p.im === 0,
    )!;
    expect(third.re).toBeCloseTo(-2.3326, 2);
  });

  // Ogata, 3.ª ed., ejemplo 6-2: G(s) = K(s + 2)/(s² + 2s + 3). Polos −1 ± j√2.
  //   - el eje real a la izquierda de −2 está en el lugar;
  //   - ángulo de salida θ₁ = 180° − 90° + 55° = 145° (54.7° exactos: 144.7°);
  //   - punto de ingreso s = −3.7320 (K = 5.4641); s = −0.2680 no está en el lugar;
  //   - el lugar complejo es un círculo de centro −2 y radio √3;
  //   - para ζ = 0.7: s = −1.67 + j1.70 y K = 1.34 (lectura gráfica del libro).
  it('Ogata, ejemplo 6-2', () => {
    const r = ok({ openLoop: 'K(s + 2)/(s^2 + 2s + 3)', zeta: 0.7 });
    const v = r.value;
    expect(v.realAxis).toEqual([[-Infinity, -2]]);
    expect(v.asymptotes!.angles).toEqual([180]);
    const departure = v.departures.find((d) => d.kind === 'polo')!;
    expect(departure.angle).toBeCloseTo(144.7356, 3);
    expect(v.breakaway).toHaveLength(1);
    expect(v.breakaway[0]!.s.re).toBeCloseTo(-3.732, 3);
    expect(v.breakaway[0]!.K).toBeCloseTo(5.4641, 4);
    expect(v.crossings).toHaveLength(0);
    const p = v.dampingPoints[0]!;
    expect(p.s.re).toBeCloseTo(-1.67, 1);
    expect(p.s.im).toBeCloseTo(1.7, 1);
    expect(p.K).toBeCloseTo(1.34, 1);
    // Sobre el círculo (σ + 2)² + ω² = 3.
    expect((p.s.re + 2) ** 2 + p.s.im ** 2).toBeCloseTo(3, 8);
  });

  it('la gráfica trae las ramas, las asíntotas y los polos', () => {
    const r = ok({ openLoop: '1/(s(s + 1)(s + 2))' });
    const plane = r.series.find((s) => s.kind === 'plane')!;
    expect(plane.curves!.filter((c) => !c.dashed)).toHaveLength(3);
    expect(plane.curves!.filter((c) => c.dashed)).toHaveLength(3);
    expect(plane.markers!.find((m) => m.shape === 'cross')!.points).toHaveLength(3);
  });

  it('errores', () => {
    const bad = solve({ openLoop: 's^^2' });
    expect(!bad.ok && bad.error.code).toBe('funcion-invalida');
    const noPoles = solve({ openLoop: 's + 1' });
    expect(!noPoles.ok && noPoles.error.code).toBe('sin-polos');
  });
});
