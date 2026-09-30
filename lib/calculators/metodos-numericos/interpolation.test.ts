import { describe, expect, it } from 'vitest';
import { newtonInterpolation } from './interpolacion-de-newton';
import { leastSquares } from './minimos-cuadrados';
import { differenceTable } from './tabla-de-diferencias';

// Chapra & Canale, Métodos Numéricos para Ingenieros, cap. 17 y 18 (5.ª ed. en español,
// McGraw-Hill 2007; el pensum cita la 3.ª ed.).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('Tabla de diferencias', () => {
  // Ejemplo 18.3: ln x en x₀ = 1, x₁ = 4, x₂ = 6, x₃ = 5 (f = 0, 1.386294, 1.791759, 1.609438).
  // Primeras diferencias divididas f[x₁, x₀] = 0.4620981, f[x₂, x₁] = 0.2027326,
  // f[x₃, x₂] = 0.1823216; segundas −0.05187311 y −0.02041100; tercera 0.007865529.
  // El libro imprime ln x con 6 decimales pero sus diferencias salen de valores más precisos
  // (1.386294/3 = 0.4620980, no 0.4620981). Por eso los datos usan ln x con 7 decimales
  // (1.3862944, 1.7917595, 1.6094379) y se compara con 6.
  it('Chapra, ejemplo 18.3: diferencias divididas de ln x', () => {
    const { value } = ok(differenceTable.solve(differenceTable.example));
    const [, first, second, third] = value.levels;
    [0.4620981, 0.2027326, 0.1823216].forEach((v, i) => expect(first![i]).toBeCloseTo(v, 6));
    [-0.05187311, -0.020411].forEach((v, i) => expect(second![i]).toBeCloseTo(v, 6));
    expect(third![0]).toBeCloseTo(0.007865529, 7);
  });

  // Caso analítico: y = x³ en x = 0, …, 5 (0, 1, 8, 27, 64, 125). Δy = 1, 7, 19, 37, 61;
  // Δ²y = 6, 12, 18, 24; Δ³y = 6, 6, 6 (= 3! h³ con h = 1) y Δ⁴y = 0.
  it('diferencias hacia adelante de un cúbico', () => {
    const { value } = ok(
      differenceTable.solve({ kind: 'adelante', x: '0 1 2 3 4 5', y: '0 1 8 27 64 125' }),
    );
    expect(value.levels[1]).toEqual([1, 7, 19, 37, 61]);
    expect(value.levels[2]).toEqual([6, 12, 18, 24]);
    expect(value.levels[3]).toEqual([6, 6, 6]);
    expect(value.levels[4]).toEqual([0, 0]);
    expect(value.constantOrder).toBe(3);
  });

  it('el schema exige x igualmente espaciados para diferencias hacia adelante', () => {
    const parse = (kind: string, x: string) =>
      differenceTable.inputSchema.safeParse({ kind, x, y: '1 2 3' }).success;
    expect(parse('adelante', '0 1 3')).toBe(false);
    expect(parse('divididas', '0 1 3')).toBe(true);
    expect(parse('divididas', '0 1 1')).toBe(false);
    expect(
      differenceTable.inputSchema.safeParse({ kind: 'divididas', x: '1 2', y: '1' }).success,
    ).toBe(false);
  });
});

describe('Interpolación de Newton', () => {
  // Ejemplos 18.1, 18.2 y 18.3: estimar ln 2 = 0.6931472.
  // - 18.1, lineal entre x = 1 y x = 4: f₁(2) = 0.4620981 (εt = 33.3 %).
  // - 18.2, cuadrática con 1, 4 y 6: b₀ = 0, b₁ = 0.4620981, b₂ = −0.0518731, f₂(2) = 0.5658444
  //   (εt = 18.4 %).
  // - 18.3, cúbica agregando x₃ = 5: f₃(2) = 0.6287686 (εt = 9.3 %).
  // Las sumas parciales del polinomio con los puntos en ese orden son exactamente esos tres casos.
  const result = ok(newtonInterpolation.solve(newtonInterpolation.example));

  it('reproduce los tres ejemplos del libro', () => {
    const [f0, f1, f2, f3] = result.value.approximations;
    expect(f0).toBe(0);
    // Datos con ln x de 7 decimales; se compara con 6 (ver la tabla de diferencias).
    expect(f1).toBeCloseTo(0.4620981, 6);
    expect(f2).toBeCloseTo(0.5658444, 6);
    expect(f3).toBeCloseTo(0.6287686, 6);
    expect(result.value.coefficients[2]).toBeCloseTo(-0.0518731, 6);
  });

  it('errores relativos verdaderos', () => {
    const et = result.tables[0]!.rows.map((r) => r.et as number);
    expect(et[1]).toBeCloseTo(33.3, 1);
    expect(et[2]).toBeCloseTo(18.4, 1);
    expect(et[3]).toBeCloseTo(9.3, 1);
  });

  // Ejemplo 18.1, primer caso: interpolación lineal entre ln 1 = 0 y ln 6 = 1.791759:
  // f₁(2) = 0.3583519 (εt = 48.3 %).
  it('Chapra, ejemplo 18.1: interpolación lineal entre 1 y 6', () => {
    const { value } = ok(
      newtonInterpolation.solve({ ...newtonInterpolation.example, x: '1 6', y: '0 1.7917595' }),
    );
    expect(value.value).toBeCloseTo(0.3583519, 6);
  });

  // Caso analítico: con x igualmente espaciados, la fórmula hacia adelante y la de diferencias
  // divididas dan el mismo polinomio (es único). Con y = x³ en 0, 1, 2, 3 el polinomio es x³:
  // f(1.5) = 3.375 exacto.
  it('diferencias hacia adelante reproducen un cúbico', () => {
    const input = { method: 'adelante' as const, x: '0 1 2 3', y: '0 1 8 27', point: 1.5 };
    const forward = ok(newtonInterpolation.solve(input));
    const divided = ok(newtonInterpolation.solve({ ...input, method: 'divididas' }));
    expect(forward.value.value).toBeCloseTo(3.375, 12);
    expect(divided.value.value).toBeCloseTo(3.375, 12);
    expect(forward.value.coefficients).toEqual([0, 1, 6, 6]);
  });

  it('avisa si es extrapolación', () => {
    const result = ok(newtonInterpolation.solve({ ...newtonInterpolation.example, point: 10 }));
    expect(result.notices.some((n) => n.level === 'warning')).toBe(true);
  });
});

describe('Mínimos cuadrados', () => {
  // Ejemplos 17.1 y 17.2: x = 1, …, 7; y = 0.5, 2.5, 2.0, 4.0, 3.5, 6.0, 5.5. a₁ = 0.8392857,
  // a₀ = 0.07142857; S_t = 22.7143, S_r = 2.9911, s_y = 1.9457, s_{y/x} = 0.7735, r² = 0.868,
  // r = 0.932.
  it('Chapra, ejemplos 17.1 y 17.2: regresión lineal', () => {
    const { value } = ok(leastSquares.solve(leastSquares.example));
    expect(value.coefficients[1]).toBeCloseTo(0.8392857, 7);
    expect(value.coefficients[0]).toBeCloseTo(0.07142857, 7);
    expect(value.st).toBeCloseTo(22.7143, 4);
    expect(value.sr).toBeCloseTo(2.9911, 4);
    // El libro redondea √(2.9911/5) = 0.77345 a 0.7735.
    expect(value.standardError!).toBeCloseTo(0.7735, 3);
    expect(value.r2!).toBeCloseTo(0.868, 3);
    expect(value.r!).toBeCloseTo(0.932, 3);
  });

  // Sec. 17.2, ejemplo de regresión polinomial: x = 0, …, 5; y = 2.1, 7.7, 13.6, 27.2, 40.9, 61.1.
  // Σx = 15, Σx² = 55, Σx³ = 225, Σx⁴ = 979, Σy = 152.6, Σxy = 585.6, Σx²y = 2 488.8;
  // y = 2.47857 + 2.35929x + 1.86071x², s_{y/x} = 1.12, r² = 0.99851.
  it('Chapra: regresión polinomial de segundo grado', () => {
    const { value, steps } = ok(
      leastSquares.solve({ x: '0 1 2 3 4 5', y: '2.1 7.7 13.6 27.2 40.9 61.1', degree: 2 }),
    );
    expect(value.coefficients[0]).toBeCloseTo(2.47857, 5);
    expect(value.coefficients[1]).toBeCloseTo(2.35929, 5);
    expect(value.coefficients[2]).toBeCloseTo(1.86071, 5);
    expect(value.standardError!).toBeCloseTo(1.12, 2);
    expect(value.r2!).toBeCloseTo(0.99851, 5);
    const sums = steps[1]!.result!;
    for (const text of ['= 15', '= 55', '= 225', '= 979', '= 152.6', '= 585.6', '= 2488.8']) {
      expect(sums).toContain(text);
    }
  });

  // Caso borde: tantos puntos como coeficientes → el polinomio interpola (Sr = 0).
  it('interpolación exacta con n = m + 1', () => {
    const { value, notices } = ok(leastSquares.solve({ x: '0 1 2', y: '1 3 7', degree: 2 }));
    expect(value.sr).toBeCloseTo(0, 12);
    expect(value.standardError).toBeNull();
    expect(notices).toHaveLength(1);
  });

  it('el schema exige suficientes x distintos', () => {
    expect(leastSquares.inputSchema.safeParse({ x: '1 1 1', y: '1 2 3', degree: 1 }).success).toBe(
      false,
    );
    expect(leastSquares.inputSchema.safeParse({ x: '1 1 2', y: '1 2 3', degree: 1 }).success).toBe(
      true,
    );
  });
});
