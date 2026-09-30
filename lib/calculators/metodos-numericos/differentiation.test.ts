import { describe, expect, it } from 'vitest';
import { undeterminedCoefficients as undetermined } from './coeficientes-indeterminados';
import { numericalDerivative } from './derivacion-numerica';

// Chapra & Canale, Métodos Numéricos para Ingenieros, cap. 4, 21 y 23 (5.ª ed. en español,
// McGraw-Hill 2007; el pensum cita la 3.ª ed.).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fail<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

const byDirection = (estimates: { direction: string; value: number }[]) =>
  Object.fromEntries(estimates.map((e) => [e.direction, e.value]));

describe('Derivación numérica', () => {
  // Ejemplo 4.4: f(x) = −0.1x⁴ − 0.15x³ − 0.5x² − 0.25x + 1.2 en x = 0.5; f'(0.5) = −0.9125.
  // h = 0.5: adelante −1.45 (εt = −58.9 %), atrás −0.55 (39.7 %), centrada −1.0 (−9.6 %).
  // h = 0.25: adelante −1.155 (−26.5 %), atrás −0.714 (21.7 %), centrada −0.934 (−2.4 %).
  it('Chapra, ejemplo 4.4, h = 0.5', () => {
    const { value } = ok(numericalDerivative.solve(numericalDerivative.example));
    expect(value.trueValue).toBeCloseTo(-0.9125, 12);
    const est = byDirection(value.estimates);
    expect(est.adelante).toBeCloseTo(-1.45, 12);
    expect(est.atras).toBeCloseTo(-0.55, 12);
    expect(est.centrada).toBeCloseTo(-1.0, 12);
    const et = value.estimates.map((e) => e.trueRelativeError!);
    expect(et[0]).toBeCloseTo(-58.9, 1);
    expect(et[1]).toBeCloseTo(39.7, 1);
    expect(et[2]).toBeCloseTo(-9.6, 1);
  });

  it('Chapra, ejemplo 4.4, h = 0.25', () => {
    const { value } = ok(numericalDerivative.solve({ ...numericalDerivative.example, h: 0.25 }));
    const est = byDirection(value.estimates);
    expect(est.adelante).toBeCloseTo(-1.155, 3);
    expect(est.atras).toBeCloseTo(-0.714, 3);
    expect(est.centrada).toBeCloseTo(-0.934, 3);
    const et = value.estimates.map((e) => e.trueRelativeError!);
    expect(et[0]).toBeCloseTo(-26.5, 1);
    expect(et[1]).toBeCloseTo(21.7, 1);
    expect(et[2]).toBeCloseTo(-2.4, 1);
  });

  // Ejemplo 23.1: la misma función con h = 0.25 y las fórmulas de alta exactitud: adelante
  // O(h²) −0.859375 (εt = 5.82 %), atrás O(h²) −0.878125 (3.77 %), centrada O(h⁴) −0.9125 (0 %).
  it('Chapra, ejemplo 23.1: fórmulas de alta exactitud', () => {
    const { value } = ok(
      numericalDerivative.solve({ ...numericalDerivative.example, h: 0.25, accuracy: 'alta' }),
    );
    const est = byDirection(value.estimates);
    expect(est.adelante).toBeCloseTo(-0.859375, 12);
    expect(est.atras).toBeCloseTo(-0.878125, 12);
    expect(est.centrada).toBeCloseTo(-0.9125, 12);
    expect(value.estimates[0]!.trueRelativeError!).toBeCloseTo(5.82, 2);
    expect(value.estimates[1]!.trueRelativeError!).toBeCloseTo(3.77, 2);
  });

  // Caso analítico: para f = x³ en x = 1 (f'' = 6x = 6) la diferencia centrada de la segunda
  // derivada da [f(1 + h) − 2f(1) + f(1 − h)]/h² = 6 exacto (su error depende de f⁽⁴⁾ = 0).
  it('segunda derivada centrada exacta para un cúbico', () => {
    const { value } = ok(
      numericalDerivative.solve({
        expression: 'x^3',
        x: 1,
        h: 0.1,
        derivative: 'segunda',
        accuracy: 'basica',
      }),
    );
    expect(value.trueValue).toBe(6);
    expect(byDirection(value.estimates).centrada).toBeCloseTo(6, 10);
  });

  it('errores', () => {
    expect(
      fail(numericalDerivative.solve({ ...numericalDerivative.example, expression: 'x +' })).error
        .code,
    ).toBe('invalid-expression');
    expect(
      fail(
        numericalDerivative.solve({
          ...numericalDerivative.example,
          expression: 'sqrt(x)',
          x: 0.2,
        }),
      ).error.code,
    ).toBe('non-finite');
  });
});

describe('Coeficientes indeterminados', () => {
  const solve = (input: Partial<Parameters<typeof undetermined.solve>[0]>) =>
    ok(undetermined.solve({ ...undetermined.example, ...input })).value;

  // Ec. 21.15 y 21.16: regla de Simpson 1/3, ∫ f ≈ (h/3)[f(x₀) + 4f(x₁) + f(x₂)] con
  // E_t = −(1/90) h⁵ f⁽⁴⁾(ξ).
  it('deduce la regla de Simpson 1/3 y su error', () => {
    const value = solve({});
    expect(value.coefficients).toEqual(['1/3', '4/3', '1/3']);
    expect(value.exactDegree).toBe(3);
    expect(value.errorPower).toBe(5);
    expect(value.errorConstant).toBe('-1/90');
  });

  // Ec. 21.21: regla de Simpson 3/8, (3h/8)[f₀ + 3f₁ + 3f₂ + f₃] con E_t = −(3/80) h⁵ f⁽⁴⁾(ξ).
  it('deduce la regla de Simpson 3/8', () => {
    const value = solve({ nodes: '0 1 2 3', a: 0, b: 3 });
    expect(value.coefficients).toEqual(['3/8', '9/8', '9/8', '3/8']);
    expect(value.errorConstant).toBe('-3/80');
  });

  // Ec. 21.3 y 21.6: regla del trapecio, (h/2)[f₀ + f₁] con E_t = −(1/12) h³ f''(ξ).
  it('deduce la regla del trapecio', () => {
    const value = solve({ nodes: '0 1', a: 0, b: 1 });
    expect(value.coefficients).toEqual(['1/2', '1/2']);
    expect(value.errorPower).toBe(3);
    expect(value.errorConstant).toBe('-1/12');
  });

  // Figura 23.3: primera derivada centrada [f(x_{i+1}) − f(x_{i−1})]/2h, con error
  // −f'''(ξ)h²/6, y segunda derivada centrada [f(x_{i+1}) − 2f(x_i) + f(x_{i−1})]/h², con error
  // −f⁽⁴⁾(ξ)h²/12.
  it('deduce las diferencias centradas', () => {
    const first = solve({ target: 'derivada', order: 1, nodes: '-1 0 1' });
    expect(first.coefficients).toEqual(['-1/2', '0', '1/2']);
    expect(first.errorPower).toBe(2);
    expect(first.errorConstant).toBe('-1/6');
    const second = solve({ target: 'derivada', order: 2, nodes: '-1 0 1' });
    expect(second.coefficients).toEqual(['1', '-2', '1']);
    expect(second.errorPower).toBe(2);
    expect(second.errorConstant).toBe('-1/12');
  });

  // Figura 23.1: primera derivada hacia adelante O(h²): [−f(x_{i+2}) + 4f(x_{i+1}) − 3f(x_i)]/2h.
  it('deduce la diferencia hacia adelante de alta exactitud', () => {
    const value = solve({ target: 'derivada', order: 1, nodes: '0 1 2' });
    expect(value.coefficients).toEqual(['-3/2', '2', '-1/2']);
    expect(value.errorPower).toBe(2);
  });

  // Aplicación, ejemplo 4.4 con h = 0.25: la diferencia centrada da −0.934 (−0.934375).
  it('aplica la fórmula a una función', () => {
    const value = solve({
      target: 'derivada',
      order: 1,
      nodes: '-1 0 1',
      expression: '-0.1x^4 - 0.15x^3 - 0.5x^2 - 0.25x + 1.2',
      x0: 0.5,
      h: 0.25,
    });
    expect(value.applied).toBeCloseTo(-0.934375, 12);
  });

  it('el schema valida los nodos', () => {
    const parse = (input: Record<string, unknown>) =>
      undetermined.inputSchema.safeParse({ ...undetermined.example, ...input }).success;
    expect(parse({ target: 'derivada', order: 2, nodes: '0 1' })).toBe(false);
    expect(parse({ nodes: '0 0 1' })).toBe(false);
    expect(parse({ a: 2, b: 0 })).toBe(false);
    expect(parse({ expression: 'x^2' })).toBe(false);
  });
});
