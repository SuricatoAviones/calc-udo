import { describe, expect, it } from 'vitest';
import { bisection, type BisectionInput } from './bisection';

// Chapra & Canale, ejemplo 5.1: coeficiente de arrastre c de un paracaidista (m = 68.1 kg,
// v = 40 m/s en t = 10 s): f(c) = 667.38/c · (1 − e^{−0.146843c}) − 40. Raíz verdadera 14.7802.
const PARACHUTIST = '667.38/x * (1 - e^(-0.146843 x)) - 40';

function solve(input: Partial<BisectionInput>) {
  return bisection.solve({
    expression: PARACHUTIST,
    xl: 12,
    xu: 16,
    tolerance: 0.5,
    maxIterations: 50,
    ...input,
  });
}

function column(result: ReturnType<typeof solve>, key: string): (number | null)[] {
  const table = result.tables.find((t) => t.id === 'iteraciones');
  return (table?.rows ?? []).map((row) => row[key] as number | null);
}

describe('Bisección', () => {
  // Chapra & Canale, Métodos Numéricos para Ingenieros, ejemplos 5.3 y 5.4 (pp. 125-127 de la
  // 5.ª ed. en español, McGraw-Hill 2007; el pensum cita la 3.ª ed.). Tabla del ejemplo 5.4:
  //   Iter  xl     xu      xr       εa (%)  εt (%)
  //   1     12     16      14               5.279
  //   2     14     16      15       6.667   1.487
  //   3     14     15      14.5     3.448   1.896
  //   4     14.5   15      14.75    1.695   0.204
  //   5     14.75  15      14.875   0.840   0.641
  //   6     14.75  14.875  14.8125  0.422   0.219
  // "después de seis iteraciones εa finalmente está por debajo de εs = 0.5%".
  describe('Chapra, ejemplos 5.3 y 5.4: paracaidista, [12, 16], εs = 0.5 %', () => {
    const result = solve({});

    it('reproduce los intervalos y el punto medio de cada iteración', () => {
      expect(column(result, 'xl')).toEqual([12, 14, 14, 14.5, 14.75, 14.75]);
      expect(column(result, 'xu')).toEqual([16, 16, 15, 15, 15, 14.875]);
      expect(column(result, 'xr')).toEqual([14, 15, 14.5, 14.75, 14.875, 14.8125]);
    });

    it('reproduce la columna εa del libro y se detiene en la 6.ª iteración', () => {
      const ea = column(result, 'ea');
      expect(ea[0]).toBeNull();
      const expected = [6.667, 3.448, 1.695, 0.84, 0.422];
      expected.forEach((value, i) => expect(ea[i + 1]).toBeCloseTo(value, 3));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.iterations).toBe(6);
      expect(result.value.root).toBe(14.8125);
    });

    it('los errores verdaderos coinciden con la columna εt', () => {
      const et = column(result, 'xr').map((x) => (Math.abs(14.7802 - x!) / 14.7802) * 100);
      [5.279, 1.487, 1.896, 0.204, 0.641, 0.219].forEach((value, i) =>
        expect(et[i]).toBeCloseTo(value, 2),
      );
    });

    // Ejemplo 5.3: f(12)·f(14) = 6.067(1.569) = 9.517 > 0 → la raíz está en [14, 16].
    it('evalúa f como en el libro', () => {
      const fxl = column(result, 'fxl');
      const fxr = column(result, 'fxr');
      expect(fxl[0]).toBeCloseTo(6.067, 3);
      expect(fxr[0]).toBeCloseTo(1.569, 3);
    });

    it('trae la traza con el cambio de signo inicial y una gráfica de error', () => {
      expect(result.steps[0]?.title).toMatch(/cambio de signo/i);
      expect(result.steps.length).toBeGreaterThanOrEqual(7);
      expect(result.series.find((s) => s.id === 'error')?.points).toHaveLength(5);
    });

    it('el ejemplo precargado es este caso', () => {
      expect(bisection.example).toMatchObject({ xl: 12, xu: 16, tolerance: 0.5 });
      expect(bisection.solve(bisection.example).ok).toBe(true);
    });
  });

  // ── Casos borde (verificados analíticamente) ────────────────────────────────
  describe('casos borde', () => {
    // f(x) = x^2 − 4 en [3, 5]: f(3) = 5 y f(5) = 21, mismo signo.
    it('sin cambio de signo → no-sign-change, sin iterar', () => {
      const result = solve({ expression: 'x^2 - 4', xl: 3, xu: 5 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('no-sign-change');
      expect(result.tables).toHaveLength(0);
      expect(result.steps).toHaveLength(1);
    });

    // f(x) = x − 1 en [0, 4]: el primer punto medio es 2; en [0, 2] el siguiente es 1 = raíz.
    it('detecta una raíz exacta en el punto medio', () => {
      const result = solve({ expression: 'x - 1', xl: 0, xu: 4, tolerance: 1e-9 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.root).toBe(1);
      expect(result.value.iterations).toBe(2);
    });

    // f(x) = x^2 − 4 en [2, 5]: f(xl) = 0, el extremo ya es raíz.
    it('si un extremo es raíz, lo informa sin iterar', () => {
      const result = solve({ expression: 'x^2 - 4', xl: 2, xu: 5 });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.root).toBe(2);
    });

    // Con εs = 0.001 % el paracaidista no converge en 3 iteraciones.
    it('max-iterations conserva la traza', () => {
      const result = solve({ tolerance: 0.001, maxIterations: 3 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('max-iterations');
      expect(column(result, 'xr')).toEqual([14, 15, 14.5]);
    });

    it('rechaza intervalos invertidos y expresiones inválidas', () => {
      expect(
        bisection.inputSchema.safeParse({ ...bisection.example, xl: 16, xu: 12 }).success,
      ).toBe(false);
      const bad = solve({ expression: 'log(x)' });
      expect(bad.ok).toBe(false);
      if (!bad.ok) expect(bad.error.code).toBe('invalid-expression');
    });

    // 1/x en [−1, 1]: f(−1) = −1, f(1) = 1 (hay cambio de signo) pero el punto medio es 0.
    it('un valor no finito en el punto medio → non-finite', () => {
      const result = solve({ expression: '1/x', xl: -1, xu: 1 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('non-finite');
    });
  });
});
