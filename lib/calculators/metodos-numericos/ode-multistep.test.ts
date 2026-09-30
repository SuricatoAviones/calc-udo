import { describe, expect, it } from 'vitest';
import { taylorOde } from './metodo-de-taylor';
import { multistep } from './metodos-multipaso';
import { rungeKutta } from './ode-methods';
import { predictorCorrector } from './predictor-corrector';

// Chapra & Canale, Métodos Numéricos para Ingenieros, cap. 25 y 26 (5.ª ed. en español,
// McGraw-Hill 2007; el pensum cita la 3.ª ed.).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fail<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

/** Ejemplo 25.1: dy/dx = −2x³ + 12x² − 20x + 8.5, y(0) = 1, h = 0.5 hasta x = 4. */
const POLYNOMIAL = {
  expression: '-2x^3 + 12x^2 - 20x + 8.5',
  x0: 0,
  y0: 1,
  h: 0.5,
  xf: 4,
  exact: '-0.5x^4 + 4x^3 - 10x^2 + 8.5x + 1',
};
/** Valores verdaderos de la tabla 25.1. */
const POLYNOMIAL_TRUE = [1, 3.21875, 3, 2.21875, 2, 2.71875, 4, 4.71875, 3];

describe('Método de Taylor', () => {
  // Ejemplo 25.2: el error del primer paso de Euler se estima con los términos de Taylor que
  // faltan: f'(0, 1) = −20 da −20(0.5)²/2 = −2.5; f''(0, 1) = 24 da 24(0.5)³/6 = 0.5 y
  // f'''(0, 1) = −12 da −12(0.5)⁴/24 = −0.03125. Euler da 5.25, así que el método de Taylor de
  // orden 2 da 5.25 − 2.5 = 2.75 y el de orden 4 da el valor verdadero 3.21875.
  it('Chapra, ejemplo 25.2: órdenes 2 y 4 en el primer paso', () => {
    const second = ok(taylorOde.solve({ ...POLYNOMIAL, xf: 0.5, order: 2 }));
    expect(second.value.ys[1]).toBeCloseTo(2.75, 12);
    const row = second.tables[0]!.rows[0]!;
    expect(row.d1).toBe(8.5);
    expect(row.d2).toBe(-20);
    const fourth = ok(taylorOde.solve({ ...POLYNOMIAL, xf: 0.5, order: 4 }));
    expect(fourth.value.ys[1]).toBeCloseTo(3.21875, 12);
  });

  // La solución es un polinomio de grado 4: la serie de Taylor de orden 4 es exacta en todos los
  // pasos y reproduce la columna de valores verdaderos de la tabla 25.1.
  it('orden 4 reproduce los valores verdaderos de la tabla 25.1', () => {
    const { value } = ok(taylorOde.solve({ ...POLYNOMIAL, order: 4 }));
    POLYNOMIAL_TRUE.forEach((v, i) => expect(value.ys[i]).toBeCloseTo(v, 10));
  });

  // Orden 1 = Euler: la columna "y Euler" de la tabla 25.1.
  it('orden 1 es el método de Euler', () => {
    const { value } = ok(taylorOde.solve({ ...POLYNOMIAL, order: 1 }));
    expect(value.ys).toEqual([1, 5.25, 5.875, 5.125, 4.5, 4.75, 5.875, 7.125, 7]);
  });

  // Caso analítico con f que depende de y: y' = y, y(0) = 1 → y = eˣ. Todas las derivadas son y,
  // así que con orden 2 cada paso multiplica por 1 + h + h²/2 = 1.625 (h = 0.5).
  it('derivadas totales cuando f depende de y', () => {
    const { value } = ok(
      taylorOde.solve({ expression: 'y', x0: 0, y0: 1, h: 0.5, xf: 1, exact: 'e^x', order: 2 }),
    );
    expect(value.ys[1]).toBeCloseTo(1.625, 12);
    expect(value.ys[2]).toBeCloseTo(1.625 ** 2, 12);
  });
});

describe('Métodos multipaso', () => {
  // Casos analíticos. En el problema del ejemplo 25.1, f depende solo de x y es un cúbico: RK4
  // (que ahí equivale a Simpson 1/3) da los valores de arranque exactos, y las fórmulas de
  // Adams-Bashforth de 4 pasos, Adams-Moulton y Milne-Simpson integran exactamente un cúbico.
  // Por eso reproducen los valores verdaderos de la tabla 25.1.
  it.each(['ab4', 'adams4', 'milne'] as const)('%s es exacto en el ejemplo 25.1', (method) => {
    const { value } = ok(multistep.solve({ ...POLYNOMIAL, method, start: 'rk4' }));
    POLYNOMIAL_TRUE.forEach((v, i) => expect(value.ys[i]).toBeCloseTo(v, 10));
  });

  // Caso analítico: Adams-Bashforth de 2 pasos integra exactamente un f lineal en x.
  // y' = 2x, y(0) = 0 → y = x² (y(1) = 1).
  it('Adams-Bashforth de 2 pasos es exacto para f lineal', () => {
    const { value } = ok(
      multistep.solve({
        expression: '2x',
        x0: 0,
        y0: 0,
        h: 0.25,
        xf: 1,
        method: 'ab2',
        start: 'rk4',
      }),
    );
    [0, 0.0625, 0.25, 0.5625, 1].forEach((v, i) => expect(value.ys[i]).toBeCloseTo(v, 12));
  });

  // Caso analítico: y' = 4e^{0.8x} − 0.5y (ejemplo 25.5) con arranque exacto en x = −1, −2, −3.
  // El predictor de Adams-Bashforth del primer paso es
  // y⁰₁ = 2 + (1/24)(55·3 − 59f₋₁ + 37f₋₂ − 9f₋₃), con f₋ₖ = 4e^{−0.8k} − 0.5y(−k); el valor se
  // verificó evaluando esa expresión por separado. Los métodos de 4.º orden quedan a menos de
  // 1.1 % del valor verdadero en cada paso.
  it('arranque con la solución exacta (ejemplo 25.5)', () => {
    const result = ok(multistep.solve(multistep.example));
    const exact = (x: number) =>
      (4 / 1.3) * (Math.exp(0.8 * x) - Math.exp(-0.5 * x)) + 2 * Math.exp(-0.5 * x);
    const f = (x: number) => 4 * Math.exp(0.8 * x) - 0.5 * exact(x);
    const predictor = 2 + (55 * 3 - 59 * f(-1) + 37 * f(-2) - 9 * f(-3)) / 24;
    expect(result.tables[0]!.rows[0]!.predictor as number).toBeCloseTo(predictor, 12);
    for (const row of result.tables[0]!.rows.slice(1)) {
      expect(Math.abs(row.et as number)).toBeLessThan(1.1);
    }
  });

  it('el schema pide la solución exacta para arrancar con ella', () => {
    const rest = { ...multistep.example, exact: undefined };
    expect(multistep.inputSchema.safeParse({ ...rest, start: 'exacta' }).success).toBe(false);
    expect(multistep.inputSchema.safeParse({ ...rest, start: 'rk4' }).success).toBe(true);
  });

  it('solución exacta no definida antes de x₀', () => {
    const result = fail(
      multistep.solve({ ...POLYNOMIAL, exact: 'sqrt(x)', method: 'ab4', start: 'exacta' }),
    );
    expect(result.error.code).toBe('invalid-expression');
  });
});

describe('Predictor-corrector', () => {
  // Sec. 26.2.1, método de Heun sin autoinicio: y' = 4e^{0.8x} − 0.5y, y(0) = 2, h = 1, con
  // y₋₁ = −0.3929953 de la solución exacta. Primer paso: predictor y⁰₁ = −0.3929953 + 3(2) =
  // 5.607005; el corrector da 6.549331, 6.313749, … y converge a 6.360865 (εt = −2.68 %).
  // Segundo paso: predictor y⁰₂ = 2 + 2·f(1, 6.360865) = 13.44346; converge a 15.30224
  // (εt = −3.09 %).
  const result = ok(predictorCorrector.solve(predictorCorrector.example));
  const rows = result.tables[0]!.rows;

  it('primer paso del libro', () => {
    expect(rows[0]!.predictor as number).toBeCloseTo(5.607005, 6);
    const iterations = result.steps[2]!.children![2]!.children!;
    expect(iterations[0]!.result).toContain('6.549330688');
    expect(iterations[1]!.result).toContain('6.313749185');
    expect(result.value.ys[1]).toBeCloseTo(6.360865, 6);
  });

  it('segundo paso del libro', () => {
    expect(rows[1]!.predictor as number).toBeCloseTo(13.44346, 5);
    expect(result.value.ys[2]).toBeCloseTo(15.30224, 5);
  });

  // Tabla 25.2, columna de Heun con el corrector iterado (εs = 0.00001 %): 6.360865 (−2.68 %),
  // 15.30224 (−3.09 %), 34.74328 (−3.17 %), 77.73510 (−3.18 %). El corrector converge al mismo
  // valor con cualquiera de los dos predictores.
  it.each(['euler', 'punto-medio'] as const)('tabla 25.2 con predictor %s', (predictor) => {
    const { value } = ok(predictorCorrector.solve({ ...predictorCorrector.example, predictor }));
    [2, 6.360865, 15.30224, 34.74328, 77.7351].forEach((v, i) =>
      expect(value.ys[i]).toBeCloseTo(v, 4),
    );
    [-2.68, -3.09, -3.17].forEach((v, i) =>
      expect(value.trueRelativeErrors![i + 1]!).toBeCloseTo(v, 2),
    );
  });

  // Con una sola iteración y el predictor de Euler es el Euler modificado (tabla 25.2, columna
  // "1 iteración"): 6.7010819, 16.3197819, 37.1992489, 83.3377674.
  it('una iteración con el predictor de Euler es Heun sin iterar', () => {
    const { value } = ok(
      predictorCorrector.solve({
        ...predictorCorrector.example,
        predictor: 'euler',
        maxIterations: 1,
      }),
    );
    [2, 6.7010819, 16.3197819, 37.1992489, 83.3377674].forEach((v, i) =>
      expect(value.ys[i]).toBeCloseTo(v, 6),
    );
  });

  // Con arranque RK4, el primer paso es exactamente el de la calculadora de Runge-Kutta.
  it('arranque con Runge-Kutta', () => {
    const { value, steps } = ok(
      predictorCorrector.solve({ ...predictorCorrector.example, start: 'rk4' }),
    );
    const rk = ok(rungeKutta.solve({ ...rungeKutta.example, h: 1, xf: 1 }));
    expect(steps.some((s) => s.title.includes('Runge-Kutta'))).toBe(true);
    expect(value.ys[1]).toBe(rk.value.ys[1]);
  });
});
