import { describe, expect, it } from 'vitest';
import { chebyshev, type ChebyshevInput } from './desigualdad-de-chebyshev';
import { expectation, type ExpectationInput } from './esperanza-y-varianza';
import { mgf } from './funcion-generadora-de-momentos';

// Walpole, Myers, Myers y Ye, Probabilidad y estadística para ingeniería y ciencias, 9.ª ed. en
// español (Pearson, 2012), capítulos 4, 5, 6 y 7.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

const discrete = (values: { x: number; p: string }[]): ExpectationInput => ({
  type: 'discreta',
  values,
});
const continuous = (density: string, lower: string, upper: string): ExpectationInput => ({
  type: 'continua',
  density,
  lower,
  upper,
});

describe('Esperanza y varianza', () => {
  // Ejemplo 4.9 (p. 121): μ = 0.61, E(X²) = 0.87, σ² = 0.87 − 0.61² = 0.4979.
  it('Walpole, ejemplo 4.9', () => {
    const { value } = ok(expectation.solve(expectation.example));
    expect(value.mean).toBeCloseTo(0.61, 12);
    expect(value.secondMoment).toBeCloseTo(0.87, 12);
    expect(value.variance).toBeCloseTo(0.4979, 12);
  });

  // Ejemplo 4.1 (p. 113): componentes buenos en una muestra de 3; f(0) = 1/35, f(1) = 12/35,
  // f(2) = 18/35, f(3) = 4/35 y μ = 12/7 ≈ 1.7.
  it('Walpole, ejemplo 4.1 (con fracciones)', () => {
    const result = expectation.solve(
      discrete([
        { x: 0, p: '1/35' },
        { x: 1, p: '12/35' },
        { x: 2, p: '18/35' },
        { x: 3, p: '4/35' },
      ]),
    );
    expect(ok(result).value.mean).toBeCloseTo(12 / 7, 12);
  });

  // Ejemplo 4.8 (p. 120): empresa A (1, 2, 3 con 0.3, 0.4, 0.3) μ = 2, σ² = 0.6; empresa B
  // (0 a 4 con 0.2, 0.1, 0.3, 0.3, 0.1) μ = 2, σ² = 1.6.
  it('Walpole, ejemplo 4.8', () => {
    const a = ok(
      expectation.solve(
        discrete([
          { x: 1, p: '0.3' },
          { x: 2, p: '0.4' },
          { x: 3, p: '0.3' },
        ]),
      ),
    ).value;
    expect(a.mean).toBeCloseTo(2, 12);
    expect(a.variance).toBeCloseTo(0.6, 12);
    const b = ok(
      expectation.solve(
        discrete([
          { x: 0, p: '0.2' },
          { x: 1, p: '0.1' },
          { x: 2, p: '0.3' },
          { x: 3, p: '0.3' },
          { x: 4, p: '0.1' },
        ]),
      ),
    ).value;
    expect(b.mean).toBeCloseTo(2, 12);
    expect(b.variance).toBeCloseTo(1.6, 12);
  });

  // Ejemplo 4.10 (pp. 121-122): f(x) = 2(x − 1) en 1 < x < 2; μ = 5/3, E(X²) = 17/6, σ² = 1/18.
  it('Walpole, ejemplo 4.10 (continua)', () => {
    const { value } = ok(expectation.solve(continuous('2(x - 1)', '1', '2')));
    expect(value.mean).toBeCloseTo(5 / 3, 10);
    expect(value.secondMoment).toBeCloseTo(17 / 6, 10);
    expect(value.variance).toBeCloseTo(1 / 18, 10);
  });

  // Ejemplo 4.3 (p. 114): f(x) = 20000/x³ para x > 100; μ = 200 horas. E(X²) = ∫ 20000/x dx
  // diverge (verificado analíticamente), así que la varianza no existe.
  it('Walpole, ejemplo 4.3: soporte infinito y varianza inexistente', () => {
    const result = ok(expectation.solve(continuous('20000/x^3', '100', 'inf')));
    expect(result.value.mean).toBeCloseTo(200, 8);
    expect(result.value.variance).toBeNull();
    expect(result.notices[0]?.level).toBe('warning');
  });

  it('rechaza lo que no es una distribución', () => {
    const notDensity = expectation.solve(continuous('x', '0', '1'));
    expect(notDensity.ok).toBe(false);
    if (!notDensity.ok) expect(notDensity.error.code).toBe('not-a-density');
    const negative = expectation.solve(continuous('3x^2 - 0.5', '-1', '1'));
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.error.message).toContain('negativa');
    // Densidad de Cauchy: no tiene media (verificado analíticamente, ∫ x/(1 + x²) diverge).
    const cauchy = expectation.solve(continuous('1/(pi * (1 + x^2))', '-inf', 'inf'));
    expect(cauchy.ok).toBe(false);
    if (!cauchy.ok) expect(cauchy.error.code).toBe('divergent-mean');
    expect(
      expectation.inputSchema.safeParse(
        discrete([
          { x: 0, p: '0.5' },
          { x: 1, p: '0.4' },
        ]),
      ).success,
    ).toBe(false);
  });
});

describe('Desigualdad de Chebyshev', () => {
  const base: ChebyshevInput = {
    mean: 8,
    dispersionType: 'varianza',
    dispersion: 9,
    mode: 'intervalo',
    lower: -4,
    upper: 20,
  };

  // Ejemplo 4.27 (p. 137): μ = 8, σ² = 9. a) P(−4 < X < 20) ≥ 15/16 (k = 4).
  // b) P(|X − 8| ≥ 6) ≤ 1/4 (k = 2).
  it('Walpole, ejemplo 4.27', () => {
    const a = ok(chebyshev.solve(base)).value;
    expect(a.k).toBeCloseTo(4, 12);
    expect(a.bound).toBeCloseTo(15 / 16, 12);
    expect(a.kind).toBe('minimo');
    const b = ok(chebyshev.solve({ ...base, mode: 'fuera', distance: 6 })).value;
    expect(b.k).toBeCloseTo(2, 12);
    expect(b.bound).toBeCloseTo(1 / 4, 12);
    expect(b.kind).toBe('maximo');
  });

  // Ejemplo 5.11 (p. 155): μ = 0.375 y σ = 0.558; μ ± 2σ va de −0.741 a 1.491 con probabilidad de
  // al menos 3/4.
  it('Walpole, ejemplo 5.11', () => {
    const { value } = ok(
      chebyshev.solve({
        mean: 0.375,
        dispersionType: 'desviacion',
        dispersion: 0.558,
        mode: 'k',
        k: 2,
      }),
    );
    expect(value.bound).toBeCloseTo(0.75, 12);
    expect(value.interval[0]).toBeCloseTo(-0.741, 3);
    expect(value.interval[1]).toBeCloseTo(1.491, 3);
  });

  // Casos borde (analíticos): con un intervalo asimétrico se usa el lado más cercano a μ; con
  // k ≤ 1 la cota es 0 y se advierte.
  it('intervalo asimétrico y k ≤ 1', () => {
    const asymmetric = ok(chebyshev.solve({ ...base, lower: 2, upper: 20 }));
    expect(asymmetric.value.k).toBeCloseTo(2, 12);
    expect(asymmetric.value.bound).toBeCloseTo(0.75, 12);
    expect(asymmetric.notices.some((n) => n.message.includes('simétrico'))).toBe(true);
    const trivial = ok(chebyshev.solve({ ...base, mode: 'k', k: 0.5 }));
    expect(trivial.value.bound).toBe(0);
    expect(trivial.notices.some((n) => n.level === 'warning')).toBe(true);
  });

  it('valida los datos de cada modo', () => {
    const schema = chebyshev.inputSchema;
    expect(schema.safeParse({ ...base, lower: undefined }).success).toBe(false);
    expect(schema.safeParse({ ...base, mode: 'fuera' }).success).toBe(false);
    expect(schema.safeParse({ ...base, dispersion: 0 }).success).toBe(false);
  });
});

describe('Función generadora de momentos', () => {
  // Ejemplo 7.6 (pp. 218-219): binomial, M(t) = (pe^t + q)^n; μ'₁ = np y μ'₂ = np[(n − 1)p + 1].
  // Con los datos del ejemplo 5.2 (n = 15, p = 0.4): μ = 6, μ'₂ = 6(6.6) = 39.6 y σ² = 3.6, como en
  // el ejemplo 5.5.
  it('Walpole, ejemplo 7.6', () => {
    const { value } = ok(mgf.solve(mgf.example));
    expect(value.moments[0]).toBeCloseTo(6, 10);
    expect(value.moments[1]).toBeCloseTo(39.6, 10);
    expect(value.variance).toBeCloseTo(3.6, 10);
  });

  // Ejemplo 7.7 (p. 219): normal, M(t) = exp(μt + σ²t²/2); con μ = 50 y σ = 10 da μ = 50 y
  // σ² = 100.
  it('Walpole, ejemplo 7.7', () => {
    const { value } = ok(mgf.solve({ expression: 'e^(50 t + 100 t^2 / 2)', moments: 2 }));
    expect(value.mean).toBeCloseTo(50, 10);
    expect(value.variance).toBeCloseTo(100, 8);
  });

  // Sec. 7.3 (p. 220): Poisson, M(t) = e^{μ(e^t − 1)}; media y varianza μ (teorema 5.4, p. 162).
  // Chi cuadrada con ν grados de libertad, M(t) = (1 − 2t)^{−ν/2} (p. 221); μ = ν y σ² = 2ν
  // (teorema 6.5, p. 200).
  it('Poisson y chi cuadrada', () => {
    const poisson = ok(mgf.solve({ expression: 'e^(4 (e^t - 1))', moments: 2 })).value;
    expect(poisson.mean).toBeCloseTo(4, 10);
    expect(poisson.variance).toBeCloseTo(4, 10);
    const chi = ok(mgf.solve({ expression: '(1 - 2t)^(-6/2)', moments: 4 })).value;
    expect(chi.mean).toBeCloseTo(6, 10);
    expect(chi.variance).toBeCloseTo(12, 10);
    // μ'₃ = ν(ν + 2)(ν + 4) y μ'₄ = ν(ν + 2)(ν + 4)(ν + 6), derivando (1 − 2t)^{−3} a mano.
    expect(chi.moments[2]).toBeCloseTo(480, 8);
    expect(chi.moments[3]).toBeCloseTo(5760, 6);
  });

  it('errores: M(0) ≠ 1, 0/0 en t = 0 y expresiones inválidas', () => {
    const notMgf = mgf.solve({ expression: '2 e^t', moments: 2 });
    expect(!notMgf.ok && notMgf.error.code).toBe('not-an-mgf');
    // FGM de la uniforme en [1, 2]: (e^{2t} − e^t)/t, que en t = 0 es 0/0.
    const uniform = mgf.solve({ expression: '(e^(2t) - e^t)/t', moments: 1 });
    expect(!uniform.ok && uniform.error.code).toBe('undefined-at-zero');
    expect(mgf.inputSchema.safeParse({ expression: 'x + 1', moments: 1 }).success).toBe(false);
  });
});
