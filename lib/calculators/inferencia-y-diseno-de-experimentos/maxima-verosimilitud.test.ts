import { describe, expect, it } from 'vitest';
import { maximumLikelihood, type LikelihoodInput } from './maxima-verosimilitud';

// Walpole, Myers, Myers y Ye, Probabilidad y estadística para ingeniería y ciencias, 9.ª ed. en
// español (Pearson, 2012), sec. 9.14 "Estimación de la máxima verosimilitud" (pp. 307-312). El
// pensum de Inferencia cita la 6.ª ed. (1998).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

const estimate = (input: LikelihoodInput, index = 0) =>
  ok(maximumLikelihood.solve(input)).value.estimates[index]!.value;

describe('Estimación por máxima verosimilitud', () => {
  // Ejemplo 9.22 (pp. 310-311): supervivencia de 10 ratas, exponencial; Σx = 162 y β̂ = x̄ = 16.2.
  it('Walpole, ejemplo 9.22: exponencial', () => {
    const result = ok(maximumLikelihood.solve(maximumLikelihood.example));
    expect(result.value.estimates[0]?.value).toBeCloseTo(16.2, 12);
    // La segunda derivada en β̂ es −n/β̂² < 0 (el libro dice que es negativa).
    expect(result.steps.find((s) => s.title.includes('máximo'))?.result).toContain('< 0');
  });

  // Ejemplo 9.23 (pp. 311-312): f(x; θ) = θ/x^{θ+1}, x > 1, con 12, 11.2, 13.5, 12.3, 13.8 y
  // 11.9; θ̂ = n / Σ ln xᵢ = 0.3970.
  it('Walpole, ejemplo 9.23', () => {
    expect(estimate({ model: 'pareto', data: '12 11.2 13.5 12.3 13.8 11.9' })).toBeCloseTo(
      0.397,
      4,
    );
  });

  // Sec. 9.14 (p. 308): dos artículos no defectuosos y luego uno defectuoso; L(p) = p²q y
  // p̂ = 2/3 (p = proporción de no defectuosos, éxito = 1).
  it('Walpole, sec. 9.14: Bernoulli', () => {
    expect(estimate({ model: 'bernoulli', data: '1 1 0' })).toBeCloseTo(2 / 3, 12);
  });

  // Ejemplo 9.20 (p. 309): en Poisson, μ̂ = x̄. Los datos son de prueba; x̄ = 10/5 = 2 a mano.
  it('Walpole, ejemplo 9.20: Poisson', () => {
    expect(estimate({ model: 'poisson', data: '0 1 2 3 4' })).toBe(2);
  });

  // Ejemplo 9.21 (pp. 309-310): en la normal, μ̂ = x̄ y σ̂² = Σ(x − x̄)²/n. Con los datos del
  // ejemplo 8.3 (p. 230; 3, 4, 5, 6, 6, 7), s² = 13/6, así que σ̂² = (n − 1)s²/n = 65/36.
  it('Walpole, ejemplo 9.21: normal', () => {
    const input: LikelihoodInput = { model: 'normal', data: '3 4 5 6 6 7' };
    expect(estimate(input, 0)).toBeCloseTo(31 / 6, 12);
    expect(estimate(input, 1)).toBeCloseTo(65 / 36, 12);
  });

  // Geométrica (analítico): ln L = n ln p + (Σx − n) ln(1 − p) da p̂ = n/Σx = 1/x̄; con 1, 2, 3,
  // x̄ = 2 y p̂ = 1/2.
  it('geométrica', () => {
    expect(estimate({ model: 'geometrica', data: '1 2 3' })).toBeCloseTo(0.5, 12);
  });

  // Casos borde: si todos los ensayos son éxitos, p̂ = 1 está en el borde y se avisa; si todos los
  // datos normales son iguales, σ̂² = 0 y no hay máximo.
  it('bordes del espacio de parámetros', () => {
    const allSuccesses = ok(maximumLikelihood.solve({ model: 'bernoulli', data: '1 1 1' }));
    expect(allSuccesses.value.estimates[0]?.value).toBe(1);
    expect(allSuccesses.notices[0]?.message).toContain('borde');
    const constant = maximumLikelihood.solve({ model: 'normal', data: '5 5 5' });
    expect(!constant.ok && constant.error.code).toBe('degenerate');
  });

  it('valida los datos según el modelo', () => {
    const schema = maximumLikelihood.inputSchema;
    expect(schema.safeParse({ model: 'bernoulli', data: '0 1 2' }).success).toBe(false);
    expect(schema.safeParse({ model: 'poisson', data: '1 2.5' }).success).toBe(false);
    expect(schema.safeParse({ model: 'exponencial', data: '3 -1' }).success).toBe(false);
    expect(schema.safeParse({ model: 'pareto', data: '0.5 2' }).success).toBe(false);
    expect(schema.safeParse({ model: 'normal', data: '4' }).success).toBe(false);
  });
});
