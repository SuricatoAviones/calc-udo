import { describe, expect, it } from 'vitest';
import { falsePosition, type FalsePositionInput } from './false-position';

function solve(input: Partial<FalsePositionInput>) {
  return falsePosition.solve({ ...falsePosition.example, ...input });
}

function column(result: ReturnType<typeof solve>, key: string): number[] {
  const table = result.tables.find((t) => t.id === 'iteraciones');
  return (table?.rows ?? []).map((row) => row[key] as number);
}

describe('Falsa posición', () => {
  // Chapra & Canale, Métodos Numéricos para Ingenieros, ejemplo 5.5 (p. 134 de la 5.ª ed. en
  // español; el pensum cita la 3.ª ed.). Paracaidista del ejemplo 5.1, xl = 12, xu = 16:
  //   1.ª iteración: f(xu) = −2.2688, xr = 14.9113 (εt = 0.89 %)
  //   2.ª iteración: f(xl)f(xr) < 0 → xu = 14.9113; f(xu) = −0.2543; xr = 14.7942
  //                  con εt = 0.09 % y εa = 0.79 %.
  describe('Chapra, ejemplo 5.5: paracaidista, [12, 16]', () => {
    const result = solve({ tolerance: 0.5 });

    it('reproduce las dos iteraciones del libro', () => {
      const xr = column(result, 'xr');
      expect(xr[0]).toBeCloseTo(14.9113, 4);
      expect(xr[1]).toBeCloseTo(14.7942, 4);
      expect(column(result, 'fxu')[0]).toBeCloseTo(-2.2688, 4);
      expect(column(result, 'fxu')[1]).toBeCloseTo(-0.2543, 4);
      expect(column(result, 'xu')[1]).toBeCloseTo(14.9113, 4);
    });

    it('los errores coinciden con el libro (εa = 0.79 % en la 2.ª iteración)', () => {
      expect(column(result, 'ea')[1]).toBeCloseTo(0.79, 2);
      const et = column(result, 'xr').map((x) => (Math.abs(14.7802 - x) / 14.7802) * 100);
      expect(et[0]).toBeCloseTo(0.89, 2);
      expect(et[1]).toBeCloseTo(0.09, 2);
    });

    it('con εs = 0.5 % ya converge en la 3.ª iteración', () => {
      // Tras la 2.ª iteración εa = 0.79 % > 0.5 %, así que hace falta una más.
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.iterations).toBe(3);
    });
  });

  // Chapra & Canale, ejemplo 6.7 (p. 156): f(x) = ln x con xl = 0.5 y xu = 5.0.
  //   Iter  xl   xu      xr
  //   1     0.5  5.0     1.8546
  //   2     0.5  1.8546  1.2163
  //   3     0.5  1.2163  1.0585
  // "los estimados convergen a la raíz verdadera, que es igual a 1".
  describe('Chapra, ejemplo 6.7: f(x) = ln x, [0.5, 5]', () => {
    const result = solve({ expression: 'ln(x)', xl: 0.5, xu: 5, tolerance: 1e-6 });

    it('reproduce la tabla del libro', () => {
      const [x1, x2, x3] = column(result, 'xr');
      expect(x1).toBeCloseTo(1.8546, 4);
      expect(x2).toBeCloseTo(1.2163, 4);
      expect(x3).toBeCloseTo(1.0585, 4);
      expect(column(result, 'xl').slice(0, 3)).toEqual([0.5, 0.5, 0.5]);
    });

    it('converge a 1', () => {
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.root).toBeCloseTo(1, 6);
    });
  });

  it('comparte la validación de los métodos cerrados', () => {
    const result = solve({ expression: 'x^2 + 1', xl: -1, xu: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('no-sign-change');
  });
});
