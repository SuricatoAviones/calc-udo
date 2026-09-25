import { describe, expect, it } from 'vitest';
import { newtonRaphson, type NewtonRaphsonInput } from './newton-raphson';

function solve(input: Partial<NewtonRaphsonInput> & Pick<NewtonRaphsonInput, 'expression' | 'x0'>) {
  return newtonRaphson.solve({ tolerance: 0.00005, maxIterations: 50, ...input });
}

/** Valores x_{n+1} de la tabla de iteraciones, en orden. */
function approximations(result: ReturnType<typeof solve>): number[] {
  const table = result.tables.find((t) => t.id === 'iteraciones');
  return (table?.rows ?? []).map((row) => row.xNext as number);
}

describe('Newton-Raphson', () => {
  // ── Caso del libro: convergencia normal ─────────────────────────────────────
  // Chapra & Canale, Métodos Numéricos para Ingenieros, sección 6.2, Ejemplo 6.3
  // ("Método de Newton-Raphson"): raíz de f(x) = e^{-x} − x con x0 = 0.
  // Tabla del libro (i, x_i, εt %):
  //   0  0            100
  //   1  0.500000000  11.8
  //   2  0.566311003  0.147
  //   3  0.567143165  0.0000220
  //   4  0.567143290  < 10^-8
  // Raíz verdadera citada en el libro: 0.56714329.
  // ⚠ Verificar la numeración del ejemplo contra la 3ra Ed. (2000) del pensum.
  describe('Chapra, Ejemplo 6.3: f(x) = e^{-x} − x, x0 = 0', () => {
    const result = solve({ expression: 'e^(-x) - x', x0: 0 });

    it('converge a la raíz del libro', () => {
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.root).toBeCloseTo(0.56714329, 8);
      expect(result.value.converged).toBe(true);
    });

    it('reproduce cada iteración de la tabla del libro', () => {
      const [x1, x2, x3, x4] = approximations(result);
      expect(x1).toBeCloseTo(0.5, 9);
      expect(x2).toBeCloseTo(0.566311003, 8);
      expect(x3).toBeCloseTo(0.567143165, 8);
      expect(x4).toBeCloseTo(0.56714329, 8);
    });

    it('los errores verdaderos coinciden con la columna εt del libro', () => {
      const trueRoot = 0.56714329;
      const [x1, x2, x3] = approximations(result) as [number, number, number];
      const et = (x: number) => (Math.abs(trueRoot - x) / trueRoot) * 100;
      expect(et(x1)).toBeCloseTo(11.8, 1);
      expect(et(x2)).toBeCloseTo(0.147, 3);
      expect(et(x3)).toBeCloseTo(0.000022, 5);
    });

    // Con εs = 0.00005 % (criterio de Scarborough para 6 cifras significativas, Chapra
    // ec. 3.7) el método se detiene en x4, igual que la tabla del libro.
    it('se detiene en la 4.ª iteración con εs = 0.00005 %', () => {
      if (!result.ok) throw new Error('debió converger');
      expect(result.value.iterations).toBe(4);
      expect(result.value.approximateError).not.toBeNull();
      expect(result.value.approximateError!).toBeLessThan(0.00005);
    });

    it('la traza trae derivada, una tabla de iteraciones y la gráfica de error', () => {
      expect(result.steps[0]?.title).toMatch(/derivada/i);
      expect(result.steps.length).toBeGreaterThanOrEqual(5); // derivada + 4 iteraciones
      const table = result.tables.find((t) => t.id === 'iteraciones');
      expect(table?.rows).toHaveLength(4);
      expect(table?.rows[0]).toMatchObject({ n: 0, xn: 0, fxn: 1, dfxn: -2, xNext: 0.5 });
      expect(result.series.find((s) => s.id === 'error')?.points).toHaveLength(4);
    });

    it('el ejemplo precargado es este mismo caso', () => {
      expect(newtonRaphson.example).toMatchObject({ expression: 'e^(-x) - x', x0: 0 });
    });
  });

  // ── Caso del libro: no convergencia por máximo de iteraciones ───────────────
  // Chapra & Canale, sección 6.2.2, Ejemplo 6.5 ("Ejemplo de una función que converge
  // lentamente con el método de Newton-Raphson"): f(x) = x^10 − 1, x0 = 0.5.
  // Tabla del libro: x1 = 51.65, x2 = 46.485, x3 = 41.8365, x4 = 37.65285,
  // x5 = 33.887565, … (la raíz es 1).
  // ⚠ Verificar la numeración del ejemplo contra la 3ra Ed. (2000) del pensum.
  describe('Chapra, Ejemplo 6.5: f(x) = x^10 − 1, x0 = 0.5 (convergencia lenta)', () => {
    const result = solve({ expression: 'x^10 - 1', x0: 0.5, maxIterations: 5 });

    it('falla por máximo de iteraciones y conserva la traza completa', () => {
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('max-iterations');
      expect(result.error.message).toMatch(/5 iteraciones/);
    });

    it('reproduce las primeras 5 iteraciones del libro', () => {
      const [x1, x2, x3, x4, x5] = approximations(result);
      expect(x1).toBeCloseTo(51.65, 10);
      expect(x2).toBeCloseTo(46.485, 3);
      expect(x3).toBeCloseTo(41.8365, 4);
      expect(x4).toBeCloseTo(37.65285, 5);
      expect(x5).toBeCloseTo(33.887565, 6);
      expect(result.steps.length).toBeGreaterThanOrEqual(6); // derivada + 5 iteraciones
    });

    it('con suficientes iteraciones sí converge a 1', () => {
      const ok = solve({ expression: 'x^10 - 1', x0: 0.5, maxIterations: 100 });
      expect(ok.ok).toBe(true);
      if (ok.ok) expect(ok.value.root).toBeCloseTo(1, 10);
    });
  });

  // ── Casos borde (no vienen de un ejemplo resuelto; verificados analíticamente) ─
  describe('derivada cero', () => {
    // f(x) = x^2 − 4 ⇒ f'(x) = 2x, f'(0) = 0: la tangente es horizontal y la fórmula divide
    // entre cero. Chapra, sección 6.2.2 (fig. 6.6d), señala este caso como falla del método.
    it('se detecta antes de dividir y devuelve la traza hasta ese punto', () => {
      const result = solve({ expression: 'x^2 - 4', x0: 0 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('zero-derivative');
      expect(result.error.message).toMatch(/derivada/i);
      expect(result.steps.length).toBeGreaterThanOrEqual(2); // derivada + iteración fallida
    });

    // f(x) = x^2 − 2x + 5 (sin raíces reales) ⇒ f'(x) = 2x − 2. Desde x0 = 3:
    // f(3) = 8, f'(3) = 4, x1 = 3 − 8/4 = 1, y f'(1) = 0 en la segunda iteración.
    it('también cuando ocurre en una iteración posterior a la primera', () => {
      const result = solve({ expression: 'x^2 - 2x + 5', x0: 3 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('zero-derivative');
      expect(approximations(result)).toEqual([1]);
    });
  });

  describe('raíz exacta', () => {
    // f(x) = x^2 − 4, f(2) = 0: x0 ya es raíz.
    it('si x0 ya es raíz, termina sin iterar', () => {
      const result = solve({ expression: 'x^2 - 4', x0: 2 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.root).toBe(2);
      expect(result.value.iterations).toBe(0);
      expect(result.notices.some((n) => /raíz exacta/i.test(n.message))).toBe(true);
    });

    // f(x) = 2x − 4 es lineal: Newton llega a la raíz exacta en una iteración
    // (x1 = x0 − (2x0 − 4)/2 = 2 para cualquier x0).
    it('una función lineal se resuelve exactamente en la primera iteración', () => {
      const result = solve({ expression: '2x - 4', x0: 10 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.root).toBe(2);
      expect(approximations(result)[0]).toBe(2);
    });
  });

  describe('entradas inválidas', () => {
    it.each([
      ['x^^2', 'no es válida'],
      ['y - 1', '«y»'],
      ['log(x) - 1', 'ln(x)'],
      ['', 'Escribe una función'],
    ])('expresión %j → invalid-expression', (expression, fragment) => {
      const result = solve({ expression, x0: 1 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('invalid-expression');
      expect(result.error.message).toContain(fragment);
      expect(result.steps).toHaveLength(0);
    });

    // f(x) = 1/x en x0 = 0 → f(x0) = ∞. sqrt(x) en x0 = −1 → valor complejo.
    it.each([
      ['1/x', 0],
      ['sqrt(x)', -1],
    ])('%j en x0 = %d → non-finite', (expression, x0) => {
      const result = solve({ expression, x0 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('non-finite');
    });

    it('el schema rechaza tolerancia no positiva e iteraciones fuera de rango', () => {
      const base = newtonRaphson.example;
      expect(newtonRaphson.inputSchema.safeParse({ ...base, tolerance: 0 }).success).toBe(false);
      expect(newtonRaphson.inputSchema.safeParse({ ...base, maxIterations: 0 }).success).toBe(
        false,
      );
      expect(newtonRaphson.inputSchema.safeParse({ ...base, maxIterations: 2.5 }).success).toBe(
        false,
      );
      expect(newtonRaphson.inputSchema.safeParse({ ...base, x0: Number.NaN }).success).toBe(false);
      expect(newtonRaphson.inputSchema.safeParse(base).success).toBe(true);
    });
  });
});
