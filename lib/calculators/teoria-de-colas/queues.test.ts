import { describe, expect, it } from 'vitest';
import { mm1 } from './mm1';
import { mm1k } from './mm1k';
import { mms } from './mms';

// Taha, Investigación de Operaciones, 7.ª ed. en español (Pearson, 2004), sec. 17.6. Taha
// escribe L_s y W_s para lo que aquí es L y W. Los resultados del libro son salidas de TORA con
// 5 decimales (3 en la figura 17.8).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('M/M/1', () => {
  // Ejemplo 17.6-2 (p. 604), figura 17.6: λ = 4, μ = 6 → ρ = 0.66667, L_s = 2, L_q = 1.33333,
  // W_s = 0.5, W_q = 0.33333; p₀ … p₅ = 0.33333, 0.22222, 0.14815, 0.09877, 0.06584, 0.04390;
  // acumuladas 0.86831 (n = 4) y 0.91221 (n = 5).
  const { value, tables } = ok(mm1.solve(mm1.example));

  it('reproduce las medidas de desempeño de la figura 17.6', () => {
    expect(value.rho).toBeCloseTo(0.66667, 5);
    expect(value.L).toBeCloseTo(2, 10);
    expect(value.Lq).toBeCloseTo(1.33333, 5);
    expect(value.W).toBeCloseTo(0.5, 10);
    expect(value.Wq).toBeCloseTo(0.33333, 5);
  });

  it('reproduce las probabilidades p_n y acumuladas', () => {
    [0.33333, 0.22222, 0.14815, 0.09877, 0.06584, 0.0439].forEach((p, k) =>
      expect(value.probabilities[k]).toBeCloseTo(p, 5),
    );
    const rows = tables[0]!.rows;
    expect(rows[4]!.cumulative).toBeCloseTo(0.86831, 5);
    expect(rows[5]!.cumulative).toBeCloseTo(0.91221, 5);
  });

  // λ = μ: ρ = 1, la cola crece sin límite (caso borde por definición del modelo).
  it('ρ ≥ 1 → unstable, con el paso de ρ en la traza', () => {
    const result = mm1.solve({ lambda: 6, mu: 6 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unstable');
    expect(result.steps).toHaveLength(1);
  });

  it('las tasas deben ser positivas', () => {
    expect(mm1.inputSchema.safeParse({ lambda: 0, mu: 6 }).success).toBe(false);
  });
});

describe('M/M/s', () => {
  // Ejemplo 17.6-5 (pp. 613-614), figura 17.8 (TORA, 3 decimales):
  //   c  λ   μ  p0     Ls     Ws     Lq     Wq
  //   2  8   5  0.110  4.444  0.556  2.844  0.356
  //   4  16  5  0.027  5.586  0.349  2.386  0.149
  it('Taha, ejemplo 17.6-5: dos empresas separadas (c = 2)', () => {
    const { value } = ok(mms.solve({ lambda: 8, mu: 5, servers: 2 }));
    // El valor exacto es p0 = 1/9 = 0.1111; el "0.110" de la copia digitalizada puede ser un
    // error de reconocimiento, así que se compara a 2 decimales.
    expect(value.p0).toBeCloseTo(0.11, 2);
    expect(value.L).toBeCloseTo(4.444, 3);
    expect(value.W).toBeCloseTo(0.556, 3);
    expect(value.Lq).toBeCloseTo(2.844, 3);
    expect(value.Wq).toBeCloseTo(0.356, 3);
  });

  it('Taha, ejemplo 17.6-5: empresa consolidada (c = 4)', () => {
    const { value } = ok(mms.solve(mms.example));
    expect(value.p0).toBeCloseTo(0.027, 3);
    expect(value.L).toBeCloseTo(5.586, 3);
    expect(value.W).toBeCloseTo(0.349, 3);
    expect(value.Lq).toBeCloseTo(2.386, 3);
    expect(value.Wq).toBeCloseTo(0.149, 3);
  });

  it('con s = 1 coincide con M/M/1', () => {
    const single = ok(mms.solve({ lambda: 4, mu: 6, servers: 1 })).value;
    const reference = ok(mm1.solve({ lambda: 4, mu: 6 })).value;
    expect(single.L).toBeCloseTo(reference.L, 12);
    expect(single.Wq).toBeCloseTo(reference.Wq, 12);
  });

  it('la tabla de p_n cubre al menos el 99.9 % de la probabilidad', () => {
    const { value } = ok(mms.solve(mms.example));
    expect(value.probabilities.reduce((s, p) => s + p, 0)).toBeGreaterThan(0.999);
  });

  // ρ = 0.99: harían falta cientos de filas; se corta en 100 y se avisa.
  it('con tráfico muy alto avisa que la tabla está truncada', () => {
    const result = ok(mms.solve({ lambda: 9.9, mu: 10, servers: 1 }));
    expect(result.value.probabilities).toHaveLength(100);
    expect(
      result.notices.some((n) => /la probabilidad de tener más clientes/.test(n.message)),
    ).toBe(true);
  });

  it('ρ ≥ 1 → unstable', () => {
    const result = mms.solve({ lambda: 20, mu: 5, servers: 4 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unstable');
  });
});

describe('M/M/1/K', () => {
  // Ejemplo 17.6-4 (p. 610), figura 17.7: λ = 4, μ = 6, N = 5 →
  // λ_ef = 3.80752, Ls = 1.42256, Lq = 0.78797, Ws = 0.37362, Wq = 0.20695;
  // p₀ … p₅ = 0.36541, 0.24361, 0.16241, 0.10827, 0.07218, 0.04812.
  const { value } = ok(mm1k.solve(mm1k.example));

  it('reproduce la figura 17.7', () => {
    expect(value.lambdaEff).toBeCloseTo(3.80752, 5);
    expect(value.L).toBeCloseTo(1.42256, 5);
    expect(value.Lq).toBeCloseTo(0.78797, 5);
    expect(value.W).toBeCloseTo(0.37362, 5);
    expect(value.Wq).toBeCloseTo(0.20695, 5);
    [0.36541, 0.24361, 0.16241, 0.10827, 0.07218, 0.04812].forEach((p, k) =>
      expect(value.probabilities[k]).toBeCloseTo(p, 5),
    );
  });

  // "perder (λp₅) × 24 = 4 × 0.04812 × 24 = 4.62 automóviles por día".
  it('los clientes perdidos coinciden con el texto', () => {
    expect(4 * value.probabilities[5]! * 24).toBeCloseTo(4.62, 2);
  });

  // ρ = 1: los K + 1 estados son equiprobables y L = K/2 (límite de la fórmula general).
  it('ρ = 1 usa las fórmulas del caso balanceado', () => {
    const balanced = ok(mm1k.solve({ lambda: 5, mu: 5, capacity: 4 })).value;
    expect(balanced.p0).toBeCloseTo(0.2, 12);
    expect(balanced.L).toBeCloseTo(2, 12);
  });

  it('admite ρ > 1 porque la capacidad limita la cola', () => {
    expect(mm1k.solve({ lambda: 10, mu: 5, capacity: 3 }).ok).toBe(true);
  });
});
