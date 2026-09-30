import { describe, expect, it } from 'vitest';
import { syntheticDivisionCalculator as synthetic } from './division-sintetica';
import { bairstow } from './factores-cuadraticos';
import { polynomialLatex } from './polynomial';

// Chapra & Canale, Métodos Numéricos para Ingenieros, cap. 7 (5.ª ed. en español, McGraw-Hill
// 2007; el pensum cita la 3.ª ed.).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fail<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

describe('División sintética', () => {
  // Sec. 7.2.2 (deflación polinomial): f(x) = (x − 4)(x + 6) = x² + 2x − 24; al dividir entre
  // x − 4 queda el cociente x + 6 con residuo 0.
  it('Chapra: x² + 2x − 24 entre x − 4', () => {
    const { value } = ok(synthetic.solve(synthetic.example));
    expect(value.quotient).toEqual([1, 6]);
    expect(value.remainder).toBe(0);
  });

  // Caso analítico (teorema del residuo): P(x) = 2x³ − 6x² + 2x − 1 entre x − 3: cociente
  // 2x² + 0x + 2 y residuo P(3) = 54 − 54 + 6 − 1 = 5.
  it('el residuo es P(r)', () => {
    const { value } = ok(synthetic.solve({ coefficients: '2 -6 2 -1', r: 3, mode: 'dividir' }));
    expect(value.quotient).toEqual([2, 0, 2]);
    expect(value.remainder).toBe(5);
  });

  // Caso analítico: con y = x − 4, P(y + 4) = (y + 4)² + 2(y + 4) − 24 = y² + 10y, es decir
  // c₀ = 0, c₁ = 10 y c₂ = 1; además P'(4) = 1!·c₁ = 10 y P''(4) = 2!·c₂ = 2.
  it('transformación a potencias de (x − r)', () => {
    const { value, tables } = ok(synthetic.solve({ ...synthetic.example, mode: 'transformar' }));
    expect(value.shifted).toEqual([0, 10, 1]);
    const derivatives = tables[1]!.rows.map((row) => row.derivative);
    expect(derivatives).toEqual([0, 10, 2]);
  });

  // Caso analítico: x³ − 1 en potencias de (x − 1): (x − 1)³ + 3(x − 1)² + 3(x − 1).
  it('transformación de x³ − 1 alrededor de 1', () => {
    const { value } = ok(synthetic.solve({ coefficients: '1 0 0 -1', r: 1, mode: 'transformar' }));
    expect(value.shifted).toEqual([0, 3, 3, 1]);
  });

  it('LaTeX del polinomio', () => {
    expect(polynomialLatex([1, 2, -24])).toBe('x^{2} + 2x - 24');
    expect(polynomialLatex([-1, 0, 1, 0])).toBe('-x^{3} + x');
  });

  it('el schema valida los coeficientes', () => {
    const parse = (coefficients: string) =>
      synthetic.inputSchema.safeParse({ coefficients, r: 1, mode: 'dividir' }).success;
    expect(parse('1 2 -24')).toBe(true);
    expect(parse('5')).toBe(false);
    expect(parse('0 1 2')).toBe(false);
    expect(parse('1 a 2')).toBe(false);
  });
});

describe('Método de Bairstow', () => {
  // Sec. 7.5, ejemplo del método de Bairstow: f₅(x) = x⁵ − 3.5x⁴ + 2.75x³ + 2.125x² − 3.875x + 1.25
  // con r = s = −1 y εs = 1 %. Primera iteración: b₅ = 1, b₄ = −4.5, b₃ = 6.25, b₂ = 0.375,
  // b₁ = −10.5, b₀ = 11.375; c₅ = 1, c₄ = −5.5, c₃ = 10.75, c₂ = −4.875, c₁ = −16.375;
  // Δr = 0.3558, Δs = 1.1381, r = −0.6442, s = 0.1381, εa,r = 55.23 %, εa,s = 824.1 %.
  // Converge a r = −0.5, s = 0.5 (raíces 0.5 y −1). Deflactado: x³ − 4x² + 5.25x − 2.5, que con
  // r y s de partida los anteriores da r = 2, s = −1.249 (raíces 1 ± 0.499i); queda x − 2 (raíz 2).
  const result = ok(bairstow.solve(bairstow.example));

  it('primera iteración del libro', () => {
    const first = result.tables[0]!.rows[0]!;
    expect(first.dr as number).toBeCloseTo(0.3558, 4);
    expect(first.ds as number).toBeCloseTo(1.1381, 4);
    expect(first.r as number).toBeCloseTo(-0.6442, 4);
    expect(first.s as number).toBeCloseTo(0.1381, 4);
    // El libro divide los valores ya redondeados (0.3558 / 0.6442 = 55.23 %); sin redondear da
    // 55.24 %.
    expect(first.ear as number).toBeCloseTo(55.23, 1);
    expect(first.eas as number).toBeCloseTo(824.1, 1);
    const children = result.steps[1]!.children![0]!.children!;
    expect(children[0]!.result).toBe(
      'b_{5} = 1,\\ b_{4} = -4.5,\\ b_{3} = 6.25,\\ b_{2} = 0.375,\\ b_{1} = -10.5,\\ b_{0} = 11.375',
    );
    expect(children[1]!.result).toBe(
      'c_{5} = 1,\\ c_{4} = -5.5,\\ c_{3} = 10.75,\\ c_{2} = -4.875,\\ c_{1} = -16.375',
    );
  });

  it('factores y raíces del libro', () => {
    const [f1, f2] = result.value.factors;
    // "Después de cuatro iteraciones…" y "cinco iteraciones dan r = 2 y s = −1.249".
    expect(f1!.iterations).toBe(4);
    expect(f2!.iterations).toBe(5);
    // El libro muestra −1.249 (el valor sin redondear es −1.24995).
    expect(f2!.s).toBeCloseTo(-1.249, 2);
    expect(f1!.r).toBeCloseTo(-0.5, 2);
    expect(f1!.s).toBeCloseTo(0.5, 2);
    expect(f2!.r).toBeCloseTo(2, 2);
    expect(f2!.s).toBeCloseTo(-1.25, 2);
    const roots = result.value.roots;
    expect(roots).toHaveLength(5);
    const sorted = [...roots].sort((a, b) => a.re - b.re || a.im - b.im);
    const expected = [
      { re: -1, im: 0 },
      { re: 0.5, im: 0 },
      { re: 1, im: -0.5 },
      { re: 1, im: 0.5 },
      { re: 2, im: 0 },
    ];
    sorted.forEach((root, i) => {
      expect(root.re).toBeCloseTo(expected[i]!.re, 2);
      expect(root.im).toBeCloseTo(expected[i]!.im, 2);
    });
  });

  // Caso analítico: un polinomio de grado 2 no necesita iterar: x² − 5x + 6 = (x − 2)(x − 3).
  it('grado 2 se resuelve directamente', () => {
    const { value } = ok(bairstow.solve({ ...bairstow.example, coefficients: '1 -5 6' }));
    expect(value.factors).toHaveLength(0);
    expect(value.roots.map((r) => r.re).sort()).toEqual([2, 3]);
  });

  it('sin convergencia en pocas iteraciones', () => {
    const result = fail(bairstow.solve({ ...bairstow.example, maxIterations: 2 }));
    expect(result.error.code).toBe('max-iterations');
    expect(result.tables[0]!.rows).toHaveLength(2);
  });

  // Caso borde: con r = s = 0 las c de x³ + 1 dan c₂² − c₃c₁ = 0 (c₂ = c₁ = 0).
  it('sistema singular', () => {
    const result = fail(
      bairstow.solve({ ...bairstow.example, coefficients: '1 0 0 1', r0: 0, s0: 0 }),
    );
    expect(result.error.code).toBe('singular-system');
  });
});
