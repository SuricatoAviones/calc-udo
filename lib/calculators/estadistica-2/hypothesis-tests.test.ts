import { describe, expect, it } from 'vitest';
import { goodnessOfFit } from './bondad-de-ajuste';
import { errorTypes } from './errores-tipo-i-y-ii';
import { meanTest } from './prueba-de-hipotesis-media';
import { varianceTest } from './prueba-de-hipotesis-varianza';
import {
  nonParametric,
  rankSumDistribution,
  signedRankDistribution,
} from './pruebas-no-parametricas';

// Walpole, Myers, Myers y Ye, Probabilidad y estadística para ingeniería y ciencias, 9.ª ed.
// (Pearson), cap. 10 y 16. Los ejemplos se identifican por sus datos; el libro lee z, t, χ² y F
// de tablas con 2 o 3 decimales, así que los valores P se comparan con esa precisión.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fail<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

describe('Prueba sobre la media', () => {
  // Ejemplo 10.3: 100 muertes con vida media 71.8 años y σ = 8.9; H₀: μ = 70 contra μ > 70 con
  // α = 0.05. z = (71.8 − 70)/(8.9/√100) = 2.02, P = 0.0217: se rechaza H₀.
  it('Walpole, ejemplo 10.3 (z unilateral)', () => {
    const { value } = ok(meanTest.solve(meanTest.example));
    expect(value.statistic).toBeCloseTo(2.02, 2);
    expect(value.pValue).toBeCloseTo(0.0217, 3);
    expect(value.critical[0]).toBeCloseTo(1.645, 3);
    expect(value.reject).toBe(true);
  });

  // Ejemplo 10.4: sedal con resistencia media de 8 kg y σ = 0.5; 50 sedales dan x̄ = 7.8. H₀: μ = 8
  // contra μ ≠ 8 con α = 0.01: z = −2.83, P = 0.0046, se rechaza H₀.
  it('Walpole, ejemplo 10.4 (z bilateral)', () => {
    const { value } = ok(
      meanTest.solve({
        ...meanTest.example,
        mean: 7.8,
        n: 50,
        sd: 0.5,
        mu0: 8,
        alternative: 'distinto',
        alpha: 0.01,
      }),
    );
    expect(value.statistic).toBeCloseTo(-2.83, 2);
    expect(value.pValue).toBeCloseTo(0.0046, 3);
    expect(value.reject).toBe(true);
    // El intervalo de 99 % no contiene a μ₀ = 8.
    expect(value.interval![1]).toBeLessThan(8);
  });

  // Ejemplo 10.5: 12 aspiradoras con x̄ = 42 kWh y s = 11.9; H₀: μ = 46 contra μ < 46 con α = 0.05.
  // t = −1.16 con 11 grados de libertad, t₀.₀₅ = 1.796, 0.10 < P < 0.15: no se rechaza H₀.
  it('Walpole, ejemplo 10.5 (t unilateral)', () => {
    const { value } = ok(
      meanTest.solve({
        ...meanTest.example,
        mean: 42,
        n: 12,
        sd: 11.9,
        mu0: 46,
        variance: 'desconocida',
        alternative: 'menor',
      }),
    );
    expect(value.kind).toBe('t');
    expect(value.df).toBe(11);
    expect(value.statistic).toBeCloseTo(-1.16, 2);
    expect(value.critical[0]).toBeCloseTo(-1.796, 3);
    expect(value.pValue).toBeGreaterThan(0.1);
    expect(value.pValue).toBeLessThan(0.15);
    expect(value.reject).toBe(false);
  });

  // Caso analítico: con los datos 1, 2, 3, 4, 5 (x̄ = 3, s = √2.5) y μ₀ = 3, t = 0 y P = 1.
  it('desde los datos', () => {
    const { value } = ok(
      meanTest.solve({
        ...meanTest.example,
        source: 'datos',
        data: '1 2 3 4 5',
        variance: 'desconocida',
        mu0: 3,
        alternative: 'distinto',
      }),
    );
    expect(value.mean).toBe(3);
    expect(value.sd).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(value.statistic).toBe(0);
    expect(value.pValue).toBeCloseTo(1, 12);
  });

  it('el schema pide los datos del modo elegido', () => {
    const parse = (input: Record<string, unknown>) =>
      meanTest.inputSchema.safeParse({ ...meanTest.example, ...input }).success;
    expect(parse({ mean: undefined })).toBe(false);
    expect(parse({ source: 'datos', data: '1' })).toBe(false);
    expect(parse({ alpha: 0.7 })).toBe(false);
  });
});

describe('Prueba sobre la varianza', () => {
  // Sec. 10.13: baterías con σ = 0.9 años; 10 baterías dan s = 1.2. H₀: σ² = 0.81 contra
  // σ² > 0.81 con α = 0.05: χ² = 9(1.44)/0.81 = 16.0, χ²₀.₀₅ = 16.919 con 9 g. l., P ≈ 0.07; no se
  // rechaza H₀.
  it('Walpole: una varianza (baterías)', () => {
    const { value } = ok(varianceTest.solve(varianceTest.example));
    expect(value.statistic).toBeCloseTo(16, 12);
    expect(value.critical[0]).toBeCloseTo(16.919, 3);
    expect(value.pValue).toBeCloseTo(0.07, 2);
    expect(value.reject).toBe(false);
  });

  // Sec. 10.13: desgaste de dos materiales (n₁ = 12, s₁ = 4; n₂ = 10, s₂ = 5), H₀: σ₁² = σ₂² con
  // α = 0.10: f = 16/25 = 0.64; f₀.₀₅(11, 9) = 3.11 y f₀.₉₅(11, 9) = 1/f₀.₀₅(9, 11) = 0.34. No se
  // rechaza H₀.
  it('Walpole: dos varianzas (desgaste de los materiales)', () => {
    const { value } = ok(
      varianceTest.solve({
        ...varianceTest.example,
        mode: 'dos',
        n1: 12,
        s1: 4,
        n2: 10,
        s2: 5,
        alternative: 'distinto',
        alpha: 0.1,
      }),
    );
    expect(value.statistic).toBeCloseTo(0.64, 12);
    expect(value.critical[0]).toBeCloseTo(1 / 2.9, 2);
    expect(value.critical[1]).toBeCloseTo(3.11, 1);
    expect(value.reject).toBe(false);
  });

  it('desde los datos', () => {
    // Caso analítico: 2, 4, 6 tienen s² = 4; con σ₀ = 2, χ² = 2(4)/4 = 2.
    const { value } = ok(
      varianceTest.solve({ ...varianceTest.example, source: 'datos', data1: '2 4 6', sigma0: 2 }),
    );
    expect(value.statistic).toBeCloseTo(2, 12);
  });
});

describe('Errores tipo I y II', () => {
  // Sec. 10.2, la vacuna: n = 20, H₀: p = 1/4 contra p > 1/4, se rechaza si X > 8.
  // α = P(X > 8 | p = 1/4) = 0.0409; β(p = 1/2) = P(X ≤ 8 | p = 1/2) = 0.2517; β(0.7) = 0.0051.
  it('Walpole: la vacuna (binomial)', () => {
    const { value } = ok(errorTypes.solve(errorTypes.example));
    expect(value.alpha).toBeCloseTo(0.0409, 4);
    expect(value.beta!).toBeCloseTo(0.2517, 4);
    expect(value.power!).toBeCloseTo(0.7483, 4);
    const other = ok(errorTypes.solve({ ...errorTypes.example, trueValue: 0.7 }));
    expect(other.value.beta!).toBeCloseTo(0.0051, 4);
  });

  // Sec. 10.2, peso de los estudiantes: μ₀ = 68, σ = 3.6, región crítica x̄ < 67 o x̄ > 69.
  // n = 36: σ_x̄ = 0.6, z = ±1.67, α = 0.0950 (el libro redondea z; sin redondear, 0.0956).
  // n = 64: σ_x̄ = 0.45, α = 0.0264; β(μ = 70) = 0.0132 y β(μ = 68.5) = 0.8661.
  const weights = {
    model: 'normal' as const,
    alternative: 'distinto' as const,
    mu0: 68,
    sigma: 3.6,
    regionBy: 'limites' as const,
    lower: 67,
    upper: 69,
  };
  it('Walpole: el peso de los estudiantes (normal)', () => {
    expect(ok(errorTypes.solve({ ...weights, n: 36 })).value.alpha).toBeCloseTo(0.095, 2);
    const at70 = ok(errorTypes.solve({ ...weights, n: 64, trueValue: 70 })).value;
    expect(at70.alpha).toBeCloseTo(0.0264, 3);
    expect(at70.beta!).toBeCloseTo(0.0132, 3);
    const at685 = ok(errorTypes.solve({ ...weights, n: 64, trueValue: 68.5 })).value;
    expect(at685.beta!).toBeCloseTo(0.8661, 3);
  });

  // Caso analítico: con la región calculada desde α, el error tipo I es exactamente α.
  it('región crítica a partir de α', () => {
    const { value } = ok(
      errorTypes.solve({ ...weights, regionBy: 'alfa', alpha: 0.05, n: 36, trueValue: 70 }),
    );
    expect(value.alpha).toBeCloseTo(0.05, 12);
    expect(value.critical[0]).toBeCloseTo(68 - 1.959964 * 0.6, 5);
  });

  it('el schema valida la región crítica', () => {
    const parse = (input: Record<string, unknown>) =>
      errorTypes.inputSchema.safeParse({ ...errorTypes.example, ...input }).success;
    expect(parse({ upper: 8.5 })).toBe(false);
    expect(parse({ alternative: 'distinto', lower: 10, upper: 8 })).toBe(false);
    expect(parse({ p0: 1.2 })).toBe(false);
  });
});

describe('Bondad de ajuste', () => {
  // Sec. 10.14: un dado lanzado 120 veces con frecuencias 20, 22, 17, 18, 19, 24; si es honrado,
  // eᵢ = 20: χ² = 1.7 con 5 g. l. < χ²₀.₀₅ = 11.070; no se rechaza H₀.
  it('Walpole: el dado', () => {
    const { value } = ok(goodnessOfFit.solve(goodnessOfFit.example));
    expect(value.statistic).toBeCloseTo(1.7, 12);
    expect(value.df).toBe(5);
    expect(value.critical).toBeCloseTo(11.07, 3);
    expect(value.reject).toBe(false);
  });

  // Sec. 10.14: duración de 40 baterías en clases 1.45–1.95, …, 4.45–4.95 con frecuencias 2, 1, 4,
  // 15, 10, 5, 3, contra una normal con μ = 3.5 y σ = 0.7 estimadas de la muestra. Frecuencias
  // esperadas del libro: 0.5, 2.1, 5.9, 10.3, 10.7, 7.0, 3.5; se combinan las tres primeras y las
  // dos últimas, χ² = 3.05 con ν = 4 − 1 − 2 = 1 < χ²₀.₀₅ = 3.841. El libro lee Φ de la tabla con z
  // redondeados a 2 decimales; sin redondear, las esperadas difieren en menos de 0.1 y χ² = 3.15.
  it('Walpole: duración de las baterías (normal)', () => {
    const { value } = ok(
      goodnessOfFit.solve({
        distribution: 'normal',
        observed: '2 1 4 15 10 5 3',
        boundaries: '1.45 1.95 2.45 2.95 3.45 3.95 4.45 4.95',
        parameter1: 3.5,
        parameter2: 0.7,
        estimated: 'si',
        merge: 'si',
        alpha: 0.05,
      }),
    );
    [0.5, 2.1, 5.9, 10.3, 10.7, 7.0, 3.5].forEach((e, i) =>
      expect(Math.abs(value.expected[i]! - e)).toBeLessThan(0.1),
    );
    expect(value.cells).toHaveLength(4);
    expect(value.cells[0]!.observed).toBe(7);
    expect(value.cells[3]!.observed).toBe(8);
    expect(value.df).toBe(1);
    expect(Math.abs(value.statistic - 3.05)).toBeLessThan(0.15);
    expect(value.reject).toBe(false);
  });

  // Caso analítico: Poisson con λ = 1 dado y 100 datos en 0, 1, 2 y "3 o más":
  // e = 100e⁻¹ = 36.79, 36.79, 18.39 y 100 − 91.97 = 8.03.
  it('Poisson con λ dado', () => {
    const { value } = ok(
      goodnessOfFit.solve({
        distribution: 'poisson',
        observed: '35 38 19 8',
        values: '0 1 2 3',
        parameter1: 1,
        estimated: 'no',
        merge: 'si',
        alpha: 0.05,
      }),
    );
    const e1 = 100 * Math.exp(-1);
    expect(value.expected[0]).toBeCloseTo(e1, 10);
    expect(value.expected[1]).toBeCloseTo(e1, 10);
    expect(value.expected[2]).toBeCloseTo(e1 / 2, 10);
    expect(value.expected[3]).toBeCloseTo(100 - 2.5 * e1, 10);
    expect(value.df).toBe(3);
  });

  // Caso analítico: al estimar p de una binomial se pierde un grado de libertad. Con n = 2 ensayos
  // y frecuencias 25, 50, 25 (x = 0, 1, 2), p̂ = 0.5 y el ajuste es perfecto: χ² = 0.
  it('binomial con p estimado', () => {
    const { value } = ok(
      goodnessOfFit.solve({
        distribution: 'binomial',
        observed: '25 50 25',
        values: '0 1 2',
        trials: 2,
        estimated: 'si',
        merge: 'si',
        alpha: 0.05,
      }),
    );
    expect(value.statistic).toBeCloseTo(0, 12);
    expect(value.df).toBe(1);
  });

  it('sin grados de libertad', () => {
    const result = fail(
      goodnessOfFit.solve({
        distribution: 'probabilidades',
        observed: '3 4',
        estimated: 'no',
        merge: 'si',
        alpha: 0.05,
      }),
    );
    expect(result.error.code).toBe('no-degrees-of-freedom');
  });

  it('el schema valida las probabilidades', () => {
    const parse = (probabilities: string) =>
      goodnessOfFit.inputSchema.safeParse({ ...goodnessOfFit.example, probabilities }).success;
    expect(parse('1/6 1/6 1/6 1/6 1/6 1/6')).toBe(true);
    expect(parse('0.5 0.5')).toBe(false);
    expect(parse('0.2 0.2 0.2 0.2 0.1 0.2')).toBe(false);
  });
});

describe('Pruebas no paramétricas', () => {
  const TRIMMER = '1.5 2.2 0.9 1.3 2.0 1.6 1.8 1.5 2.0 1.2 1.7';

  // Ejemplo 16.1: horas de una recortadora eléctrica; H₀: μ̃ = 1.8 contra μ̃ ≠ 1.8 con α = 0.05. Se
  // descarta el 1.8; quedan 3 signos + de n = 10 y P = 2P(X ≤ 3) = 0.3438: no se rechaza H₀.
  it('Walpole, ejemplo 16.1: prueba del signo', () => {
    const { value } = ok(nonParametric.solve(nonParametric.example));
    expect(value.statistic).toBe(3);
    expect(value.details.n).toBe(10);
    expect(value.pValue).toBeCloseTo(0.3438, 4);
    expect(value.reject).toBe(false);
  });

  // Ejemplo 16.3: los mismos datos con la prueba de rangos con signo: w₊ = 13, w₋ = 42, w = 13;
  // el valor crítico para n = 10 y α = 0.05 bilateral es 8 (tabla A.16): no se rechaza H₀.
  it('Walpole, ejemplo 16.3: rangos con signo de Wilcoxon', () => {
    const { value } = ok(
      nonParametric.solve({ ...nonParametric.example, test: 'wilcoxon', sample1: TRIMMER }),
    );
    expect(value.details).toMatchObject({ n: 10, wPlus: 13, wMinus: 42 });
    expect(value.statistic).toBe(13);
    expect(value.critical).toBe(8);
    expect(value.reject).toBe(false);
  });

  // Ejemplo 16.5: nicotina de dos marcas (A: 2.1, 4.0, 6.3, 5.4, 4.8, 3.7, 6.1, 3.3; B: 4.1, 0.6,
  // 3.1, 2.5, 4.0, 6.2, 1.6, 2.2, 1.9, 5.4). w₁ = 93, u₁ = 57, u₂ = 23; con n₁ = 8, n₂ = 10 y
  // α = 0.05 bilateral el valor crítico es 17 (tabla A.17): no se rechaza H₀.
  it('Walpole, ejemplo 16.5: suma de rangos (Mann-Whitney)', () => {
    const { value } = ok(
      nonParametric.solve({
        ...nonParametric.example,
        test: 'mann-whitney',
        sample1: '2.1 4.0 6.3 5.4 4.8 3.7 6.1 3.3',
        sample2: '4.1 0.6 3.1 2.5 4.0 6.2 1.6 2.2 1.9 5.4',
      }),
    );
    expect(value.details).toMatchObject({ w1: 93, u1: 57, u2: 23 });
    expect(value.statistic).toBe(23);
    expect(value.critical).toBe(17);
    expect(value.reject).toBe(false);
  });

  // Ejemplo 16.6: tasas de combustión de tres propulsores; r₁ = 61, r₂ = 63.5, r₃ = 65.5 y
  // h = 1.66 < χ²₀.₀₅ = 5.991 con 2 g. l.: no se rechaza H₀.
  it('Walpole, ejemplo 16.6: Kruskal-Wallis', () => {
    const { value } = ok(
      nonParametric.solve({
        ...nonParametric.example,
        test: 'kruskal-wallis',
        groups:
          '24.0 16.7 22.8 19.8 18.9\n23.2 19.8 18.1 17.6 20.2 17.8\n18.4 19.1 17.3 17.3 19.7 18.9 18.8 19.3',
      }),
    );
    expect(value.details).toMatchObject({ R1: 61, R2: 63.5, R3: 65.5 });
    expect(value.statistic).toBeCloseTo(1.66, 2);
    expect(value.reject).toBe(false);
  });

  // Distribuciones exactas, verificadas contra valores conocidos: con n = 10, P(W ≤ 8) = 25/1024;
  // la distribución de U es simétrica y suma 1.
  it('distribuciones exactas', () => {
    const w = signedRankDistribution(10);
    expect(w.slice(0, 9).reduce((s, p) => s + p, 0)).toBeCloseTo(25 / 1024, 14);
    const u = rankSumDistribution(8, 10);
    expect(u.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 12);
    expect(u[10]).toBeCloseTo(u[70]!, 14);
    // Con n₁ = n₂ = 2 hay C(4, 2) = 6 ordenaciones: U = 0, 1, 2, 2, 3, 4.
    expect(rankSumDistribution(2, 2).map((p) => p * 6)).toEqual(
      [1, 1, 2, 1, 1].map((v) => expect.closeTo(v, 12)),
    );
  });

  // Caso analítico: datos pareados → diferencias. (5, 3), (7, 4), (6, 6), (9, 5): d = 2, 3, 0, 4;
  // se descarta el 0 y los tres signos son +.
  it('signo con datos pareados', () => {
    const { value } = ok(
      nonParametric.solve({
        ...nonParametric.example,
        sample1: '5 7 6 9',
        sample2: '3 4 6 5',
        median0: 0,
      }),
    );
    expect(value.details).toMatchObject({ n: 3, plus: 3 });
  });

  it('el schema valida las muestras', () => {
    const parse = (input: Record<string, unknown>) =>
      nonParametric.inputSchema.safeParse({ ...nonParametric.example, ...input }).success;
    expect(parse({ sample2: '1 2' })).toBe(false);
    expect(parse({ test: 'mann-whitney', sample2: '' })).toBe(false);
    expect(parse({ test: 'kruskal-wallis', groups: '1 2 3' })).toBe(false);
  });

  it('sin datos distintos de la mediana', () => {
    expect(
      fail(nonParametric.solve({ ...nonParametric.example, sample1: '1.8 1.8', median0: 1.8 }))
        .error.code,
    ).toBe('no-data');
  });
});
