import { describe, expect, it } from 'vitest';
import { convolucion, solveConvolution } from './convolucion';

function solved(input: string, impulse: string) {
  const result = solveConvolution({ input, impulse });
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

/** y(t) a partir de los intervalos del resultado. */
function valueAt(result: ReturnType<typeof solved>, t: number) {
  const interval = result.value.intervals.find((r) => t >= r.from && t < r.to)!;
  return interval.pieces.reduce(
    (sum, p) =>
      sum +
      t ** p.power *
        Math.exp(p.sigma * t) *
        (p.a * Math.cos(p.omega * t) + p.b * Math.sin(p.omega * t)),
    0,
  );
}

describe('convolución', () => {
  it('Hayt, Kemmerly y Durbin, 8.ª ed., fig. 15.21–15.22: pulso de 1 s con h(t) = 2e^{−t}', () => {
    // El libro obtiene y(t) = 2(1 − e^{−t}) para 0 ≤ t ≤ 1 y 2(e − 1)e^{−t} para t > 1.
    const result = solved('u(t) - u(t - 1)', '2e^(-t)');
    expect(result.value.intervals.map((r) => r.from)).toEqual([0, 1]);
    expect(result.value.intervals[0]!.tex).toBe('2 - 2e^{-t}');
    expect(result.value.intervals[1]!.tex).toBe('3.43656e^{-t}');
    expect(valueAt(result, 1.7)).toBeCloseTo(2 * (Math.E - 1) * Math.exp(-1.7), 12);
    // La integral numérica coincide con la forma cerrada.
    const table = result.tables.find((t) => t.id === 'verificacion')!;
    for (const row of table.rows) {
      expect(row.numerica as number).toBeCloseTo(row.cerrada as number, 8);
    }
  });

  it('Hayt, ejemplo 15.8: u(t) * [u(t) − 2u(t − 1) + u(t − 2)] = t, 2 − t, 0', () => {
    const result = solved('u(t)', 'u(t) - 2u(t - 1) + u(t - 2)');
    expect(result.value.intervals.map((r) => r.tex)).toEqual(['t', '2 - t', '0']);
  });

  it('Hayt, problema de práctica 15.9: h(t) = 5u(t − 1), x(t) = 2[u(t) − u(t − 3)]', () => {
    // Respuestas del libro: y(−0.5) = 0, y(0.5) = 0, y(2.5) = 15 y y(3.5) = 25.
    const result = solved('2(u(t) - u(t - 3))', '5u(t - 1)');
    expect(valueAt(result, 0.5)).toBeCloseTo(0, 12);
    expect(valueAt(result, 2.5)).toBeCloseTo(15, 12);
    expect(valueAt(result, 3.5)).toBeCloseTo(25, 12);
  });

  it('Hayt, ejemplo 15.9: e^{−αt} * e^{−βt} = (e^{−αt} − e^{−βt})/(β − α), con α = 1 y β = 2', () => {
    const result = solved('e^(-t)', 'e^(-2t)');
    expect(result.value.tex).toBe('e^{-t} - e^{-2t}');
  });

  it('rechaza expresiones que no están en la tabla', () => {
    const result = solveConvolution({ input: 'ln(t)', impulse: 'e^(-t)' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('expresion-invalida');
    expect(result.error.message).toMatch(/^x\(t\)/);
  });

  it('un impulso a la entrada devuelve la respuesta al impulso', () => {
    const result = solved('delta(t)', '3e^(-2t)');
    expect(result.value.tex).toBe('3e^{-2t}');
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(convolucion.inputSchema.safeParse(convolucion.example).success).toBe(true);
    expect(convolucion.solve(convolucion.example).ok).toBe(true);
  });
});
