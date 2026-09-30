import { describe, expect, it } from 'vitest';
import { correctSignificantFigures, numericErrors, toSignificant } from './errores-numericos';

// Chapra & Canale, Métodos Numéricos para Ingenieros, cap. 3 y 4 (5.ª ed. en español,
// McGraw-Hill 2007; el pensum cita la 3.ª ed.).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fail<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

describe('Error de una aproximación', () => {
  // Ejemplo 3.1: se miden un puente y un remache: 9 999 y 9 cm, con valores verdaderos 10 000 y
  // 10 cm. En ambos E_t = 1 cm, pero ε_t = 0.01 % para el puente y 10 % para el remache.
  it('Chapra, ejemplo 3.1: el puente', () => {
    const { value } = ok(
      numericErrors.solve({ mode: 'aproximacion', trueValue: 10000, approximation: 9999 }),
    );
    expect(value.trueError).toBe(1);
    expect(value.trueRelativeError).toBeCloseTo(0.01, 12);
  });

  it('Chapra, ejemplo 3.1: el remache', () => {
    const { value } = ok(
      numericErrors.solve({ mode: 'aproximacion', trueValue: 10, approximation: 9 }),
    );
    expect(value.trueError).toBe(1);
    expect(value.trueRelativeError).toBeCloseTo(10, 12);
  });

  // Criterio de Scarborough (ec. 3.7): con n = 3 cifras, εs = 0.05 %. Verificado con la fórmula:
  // 0.01 % < 0.05 %, así que la medida del puente es correcta en al menos 3 cifras
  // (0.01 % < 0.5 × 10^{2−3} y 0.01 % ≥ 0.5 × 10^{2−4} = 0.005 %).
  it('cifras significativas correctas', () => {
    expect(correctSignificantFigures(0.01)).toBe(3);
    expect(correctSignificantFigures(10)).toBe(0);
    const result = ok(
      numericErrors.solve({
        mode: 'aproximacion',
        trueValue: 10000,
        approximation: 9999,
        significantFigures: 3,
      }),
    );
    expect(result.steps.at(-1)!.result).toContain('<');
  });

  // Caso borde: con valor verdadero 0, el error relativo no está definido.
  it('valor verdadero 0', () => {
    const { value } = ok(
      numericErrors.solve({ mode: 'aproximacion', trueValue: 0, approximation: 0.001 }),
    );
    expect(value.trueError).toBe(-0.001);
    expect(value.trueRelativeError).toBeNull();
  });
});

describe('Corte y redondeo', () => {
  // Sec. 3.4.1: π = 3.14159265358 en un sistema de base 10 con 7 cifras significativas. Cortando,
  // π = 3.141592 con E_t = 0.00000065; redondeando, π = 3.141593 con E_t = −0.00000035.
  it('Chapra: π con 7 cifras', () => {
    const { value } = ok(
      numericErrors.solve({ mode: 'redondeo', value: 3.14159265358, digits: 7 }),
    );
    expect(value.chopped).toBe(3.141592);
    expect(value.rounded).toBe(3.141593);
    expect(3.14159265358 - value.chopped!).toBeCloseTo(0.00000065, 8);
    expect(value.trueError).toBeCloseTo(-0.00000035, 8);
  });

  // Casos analíticos: negativos, números pequeños y el redondeo que lleva una cifra.
  it('toSignificant', () => {
    expect(toSignificant(-2.71828, 3, 'chop')).toBe(-2.71);
    expect(toSignificant(-2.71828, 3, 'round')).toBe(-2.72);
    expect(toSignificant(0.000123456, 2, 'round')).toBe(0.00012);
    expect(toSignificant(9.996, 3, 'round')).toBe(10);
    expect(toSignificant(123456, 2, 'chop')).toBe(120000);
    expect(toSignificant(0, 4, 'round')).toBe(0);
  });
});

describe('Error de truncamiento con la serie de Taylor', () => {
  // Ejemplo 4.1: f(x) = −0.1x⁴ − 0.15x³ − 0.5x² − 0.25x + 1.2 desde xᵢ = 0 hasta x = 1 (h = 1).
  // Orden 0: 1.2 (E_t = −1.0); 1: 0.95 (−0.75); 2: 0.45 (−0.25); 3: 0.3 (−0.1); 4: 0.2 (0).
  it('Chapra, ejemplo 4.1: polinomio de cuarto grado', () => {
    const { value, tables } = ok(numericErrors.solve(numericErrors.example));
    const expected = [1.2, 0.95, 0.45, 0.3, 0.2];
    expected.forEach((v, k) => expect(value.approximations![k]).toBeCloseTo(v, 12));
    const errors = tables[0]!.rows.map((r) => r.et as number);
    [-1, -0.75, -0.25, -0.1, 0].forEach((v, k) => expect(errors[k]).toBeCloseTo(v, 12));
    expect(value.trueValue).toBeCloseTo(0.2, 12);
  });

  // Ejemplo 4.2: f(x) = cos x alrededor de xᵢ = π/4 para estimar f(π/3) = 0.5.
  //   orden  aproximación  εt (%)
  //   0      0.707106781   −41.4
  //   1      0.521986659   −4.40
  //   2      0.497754491   0.449
  //   3      0.499869147   2.62 × 10⁻²
  //   4      0.500007551   −1.51 × 10⁻³
  //   5      0.500000304   −6.08 × 10⁻⁵
  //   6      0.499999988   2.44 × 10⁻⁶
  it('Chapra, ejemplo 4.2: cos x', () => {
    const { value, tables } = ok(
      numericErrors.solve({
        mode: 'taylor',
        expression: 'cos(x)',
        xi: Math.PI / 4,
        x: Math.PI / 3,
        order: 6,
      }),
    );
    const expected = [
      0.707106781, 0.521986659, 0.497754491, 0.499869147, 0.500007551, 0.500000304, 0.499999988,
    ];
    expected.forEach((v, k) => expect(value.approximations![k]).toBeCloseTo(v, 9));
    const rel = tables[0]!.rows.map((r) => r.rel as number);
    expect(rel[0]).toBeCloseTo(-41.4, 1);
    expect(rel[1]).toBeCloseTo(-4.4, 1);
    expect(rel[2]).toBeCloseTo(0.449, 3);
    expect(rel[3]! / 1e-2).toBeCloseTo(2.62, 2);
    expect(rel[4]! / 1e-3).toBeCloseTo(-1.51, 2);
    expect(rel[5]! / 1e-5).toBeCloseTo(-6.08, 2);
    expect(rel[6]! / 1e-6).toBeCloseTo(2.44, 2);
  });

  // Ejemplo 3.2: e^0.5 con la serie de Maclaurin, agregando términos hasta que |εa| < εs para 3
  // cifras significativas (εs = 0.05 %). Resultados 1, 1.5, 1.625, 1.645833333, 1.648437500,
  // 1.648697917; εt (%) 39.3, 9.02, 1.44, 0.175, 0.0172, 0.00142; εa (%) 33.3, 7.69, 1.27, 0.158,
  // 0.0158. Se detiene con seis términos (orden 5).
  it('Chapra, ejemplo 3.2: serie de Maclaurin de e^x con criterio de parada', () => {
    const { value, tables } = ok(
      numericErrors.solve({
        mode: 'taylor',
        expression: 'e^x',
        xi: 0,
        x: 0.5,
        order: 10,
        significantFigures: 3,
      }),
    );
    expect(value.approximations).toHaveLength(6);
    [1, 1.5, 1.625, 1.645833333, 1.6484375, 1.648697917].forEach((v, k) =>
      expect(value.approximations![k]).toBeCloseTo(v, 9),
    );
    const rows = tables[0]!.rows;
    // El libro da los errores con 3 cifras significativas.
    const threeFigures = (v: unknown) => Number((v as number).toPrecision(3));
    expect(rows.map((r) => threeFigures(r.rel))).toEqual([
      39.3, 9.02, 1.44, 0.175, 0.0172, 0.00142,
    ]);
    expect(rows.slice(1).map((r) => threeFigures(r.ea))).toEqual([33.3, 7.69, 1.27, 0.158, 0.0158]);
  });

  it('errores: expresión inválida y valor no finito', () => {
    expect(
      fail(numericErrors.solve({ mode: 'taylor', expression: 'x +', xi: 0, x: 1, order: 2 })).error
        .code,
    ).toBe('invalid-expression');
    // ln x no está definido en xᵢ = 0.
    expect(
      fail(numericErrors.solve({ mode: 'taylor', expression: 'ln(x)', xi: 0, x: 1, order: 2 }))
        .error.code,
    ).toBe('non-finite');
  });

  it('el schema pide los campos del modo elegido', () => {
    expect(numericErrors.inputSchema.safeParse({ mode: 'aproximacion' }).success).toBe(false);
    expect(numericErrors.inputSchema.safeParse({ mode: 'redondeo', value: 1 }).success).toBe(false);
    expect(numericErrors.inputSchema.safeParse(numericErrors.example).success).toBe(true);
  });
});
