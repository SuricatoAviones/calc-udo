import { describe, expect, it } from 'vitest';
import { kaplanMeier } from './kaplan-meier';
import { lifeTable } from './tabla-de-sobrevivencia';

// La bibliografía del programa (trabajos de Ezio Bórean) no está publicada en línea. Los casos
// vienen de dos ejemplos clásicos de la literatura de sobrevivencia, con resultados publicados:
// - Kaplan-Meier: grupo con 6-MP de Freireich et al. (1963), datos usados por Cox (1972); la
//   tabla de estimaciones y errores de Greenwood se contrastó con las notas de G. Rodríguez
//   (Princeton, «Kaplan-Meier Survival»): Ŝ = 0.857, 0.807, 0.753, 0.690, 0.627, 0.538, 0.448 y
//   EE = 0.0764, 0.0869, 0.0963, 0.1068, 0.1141, 0.1282, 0.1346.
// - Tabla de vida: 2418 hombres con angina de pecho de Lee (1992, p. 91), con la salida de PROC
//   LIFETEST de la documentación de SAS/STAT (ejemplo «Life-Table Estimates for Males with Angina
//   Pectoris»), que usa el método actuarial de Lee.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('Kaplan-Meier', () => {
  it('reproduce la tabla del grupo 6-MP', () => {
    const { value } = ok(kaplanMeier.solve(kaplanMeier.example));
    const table = [
      [6, 21, 3, 1, 0.857, 0.0764],
      [7, 17, 1, 1, 0.807, 0.0869],
      [10, 15, 1, 2, 0.753, 0.0963],
      [13, 12, 1, 0, 0.69, 0.1068],
      [16, 11, 1, 3, 0.627, 0.1141],
      [22, 7, 1, 0, 0.538, 0.1282],
      [23, 6, 1, 5, 0.448, 0.1346],
    ];
    expect(value.rows).toHaveLength(7);
    table.forEach(([time, atRisk, failures, censored, survival, se], j) => {
      const row = value.rows[j]!;
      expect(row.time).toBe(time);
      expect(row.atRisk).toBe(atRisk);
      expect(row.failures).toBe(failures);
      expect(row.censored).toBe(censored);
      expect(row.survival).toBeCloseTo(survival!, 3);
      expect(row.standardError).toBeCloseTo(se!, 4);
    });
    // Ŝ(22) = 0.538 > 0.5 y Ŝ(23) = 0.448: la mediana es 23 semanas.
    expect(value.median).toBe(23);
    expect(value.censoredTotal).toBe(12);
  });

  // Caso analítico: sin censura, Ŝ es la función de supervivencia empírica.
  it('sin censura coincide con la proporción de sobrevivientes', () => {
    const { value } = ok(kaplanMeier.solve({ times: '1 2 2 3 5' }));
    expect(value.rows.map((r) => r.survival)).toEqual(
      [0.8, 0.4, 0.2, 0].map((v) => expect.closeTo(v, 12)),
    );
  });

  it('validaciones', () => {
    const schema = kaplanMeier.inputSchema;
    expect(schema.safeParse({ times: '3+ 4+' }).success).toBe(false);
    expect(schema.safeParse({ times: '3 abc' }).success).toBe(false);
    expect(schema.safeParse({ times: '' }).success).toBe(false);
  });
});

describe('tabla de sobrevivencia', () => {
  // SAS/STAT, PROC LIFETEST, tabla de vida de Lee (actuarial):
  //   [0,1): n' = 2418.0, q = 0.1886, S = 1.0000, f = 0.1886, λ = 0.208219
  //   [1,2): n' = 1942.5, q = 0.1163, S = 0.8114, EE = 0.00796, f = 0.0944, λ = 0.123531
  //   [2,3): n' = 1686.0, q = 0.0902, S = 0.7170, EE = 0.00918, λ = 0.09441
  //   [5,6): n' = 1116.5, S = 0.5193, EE = 0.0103 («the five-year survival rate is 0.5193»)
  //   [15,∞): n' = 15.0, S = 0.1429
  // y la mediana de vida residual en [0, 1) es 5.3313 años, que es la mediana de sobrevivencia.
  it('reproduce la salida publicada', () => {
    const { value } = ok(lifeTable.solve(lifeTable.example));
    const rows = value.rows;
    expect(value.total).toBe(2418);
    expect(rows[0]!.effective).toBe(2418);
    expect(rows[0]!.q).toBeCloseTo(0.1886, 4);
    expect(rows[0]!.density).toBeCloseTo(0.1886, 4);
    expect(rows[0]!.hazard).toBeCloseTo(0.208219, 6);
    expect(rows[1]!.effective).toBe(1942.5);
    expect(rows[1]!.q).toBeCloseTo(0.1163, 4);
    expect(rows[1]!.survival).toBeCloseTo(0.8114, 4);
    expect(rows[1]!.standardError).toBeCloseTo(0.00796, 5);
    expect(rows[1]!.density).toBeCloseTo(0.0944, 4);
    expect(rows[1]!.hazard).toBeCloseTo(0.123531, 6);
    expect(rows[2]!.effective).toBe(1686);
    expect(rows[2]!.survival).toBeCloseTo(0.717, 4);
    expect(rows[2]!.standardError).toBeCloseTo(0.00918, 5);
    expect(rows[2]!.hazard).toBeCloseTo(0.09441, 5);
    expect(rows[5]!.effective).toBe(1116.5);
    expect(rows[5]!.survival).toBeCloseTo(0.5193, 4);
    expect(rows[5]!.standardError).toBeCloseTo(0.0103, 4);
    expect(rows[15]!.effective).toBe(15);
    expect(rows[15]!.survival).toBeCloseTo(0.1429, 4);
    expect(rows[15]!.hazard).toBeNull();
    expect(value.median).toBeCloseTo(5.3313, 4);
  });

  // Caso analítico: con el criterio de Kaplan-Meier los retiros no reducen n′.
  it('criterio de Kaplan-Meier', () => {
    const { value } = ok(lifeTable.solve({ ...lifeTable.example, criterion: 'kaplan-meier' }));
    expect(value.rows[1]!.effective).toBe(1962);
    expect(value.rows[1]!.q).toBeCloseTo(226 / 1962, 12);
  });

  it('validaciones', () => {
    const schema = lifeTable.inputSchema;
    expect(
      schema.safeParse({
        criterion: 'actuarial',
        intervals: [
          { start: 1, deaths: 1, withdrawals: 0 },
          { start: 0, deaths: 1, withdrawals: 0 },
        ],
      }).success,
    ).toBe(false);
  });
});
