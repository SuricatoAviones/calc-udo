import { describe, expect, it } from 'vitest';
import {
  solveInverseLaplace,
  transformadaInversaDeLaplace,
} from './transformada-inversa-de-laplace';

function solved(expression: string) {
  const result = solveInverseLaplace({ expression });
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

/** f(t) a partir de las piezas del resultado (sin los impulsos). */
function valueAt(expression: string, t: number) {
  let sum = 0;
  for (const g of solved(expression).value.groups) {
    if (t < g.delay) continue;
    const tau = t - g.delay;
    for (const p of g.pieces) {
      sum +=
        tau ** p.power *
        Math.exp(p.sigma * tau) *
        (p.a * Math.cos(p.omega * tau) + p.b * Math.sin(p.omega * tau));
    }
  }
  return sum;
}

describe('transformada inversa de Laplace', () => {
  it('Dorf y Svoboda, 9.ª ed., ejemplo 14.4-1: (s + 3)/(s² + 7s + 10) → (1/3)e^{−2t} + (2/3)e^{−5t}', () => {
    const result = solved('(s + 3)/(s^2 + 7s + 10)');
    // Residuos del libro: R1 = 1/3 en s = −2 y R2 = 2/3 en s = −5.
    expect(result.tables[0]!.rows.map((r) => r.residuo)).toEqual(['0.333333', '0.666667']);
    for (const t of [0, 0.4, 1.5]) {
      expect(valueAt('(s + 3)/(s^2 + 7s + 10)', t)).toBeCloseTo(
        Math.exp(-2 * t) / 3 + (2 / 3) * Math.exp(-5 * t),
        10,
      );
    }
  });

  it('Dorf, ejemplo 14.4-2: par complejo −3 ± j y polo −2', () => {
    // Solución alterna del libro (p. 684): f(t) = −5e^{−3t}cos t − 5e^{−3t}sen t + 5e^{−2t}.
    const result = solved('10/((s^2 + 6s + 10)(s + 2))');
    expect(result.value.tex).toBe(
      '5e^{-2t} - 5e^{-3t}\\cos\\left(t\\right) - 5e^{-3t}\\sin\\left(t\\right)',
    );
    // Residuo del polo −3 + j: R1 = −5/2 + j5/2.
    expect(result.tables[0]!.rows.find((r) => r.polo === '-3 + j')!.residuo).toBe('-2.5 + j2.5');
  });

  it('Dorf, ejemplo 14.4-3: polo doble 4/[(s + 1)²(s + 2)] → −4e^{−t} + 4te^{−t} + 4e^{−2t}', () => {
    expect(solved('4/((s + 1)^2 (s + 2))').value.tex).toBe('-4e^{-t} + 4te^{-t} + 4e^{-2t}');
  });

  it('Dorf, ejemplo 14.4-4: función impropia → 4δ′(t) − 5δ(t) + 6e^{−3t} − 4e^{−2t}', () => {
    // Errata del libro: el enunciado dice 4s³ + 15s² + s + 30, pero la división que muestra
    // (cociente 4s − 5 y residuo 2s) corresponde a 4s³ + 15s² + s − 30, que es el que se usa.
    const result = solved('(4s^3 + 15s^2 + s - 30)/(s^2 + 5s + 6)');
    expect(result.value.tex).toBe(
      "-5\\delta\\left(t\\right) + 4\\delta'\\left(t\\right) - 4e^{-2t} + 6e^{-3t}",
    );
    expect(result.notices.some((n) => n.message.includes('impulsos'))).toBe(true);
  });

  it('Hayt, Kemmerly y Durbin, 8.ª ed., ejemplo 14.4: 2(s + 2)/s → 2δ(t) + 4u(t)', () => {
    expect(solved('2(s + 2)/s').value.tex).toBe('2\\delta\\left(t\\right) + 4');
  });

  it('Hayt, ejemplo 14.5: (7s + 5)/(s² + s) → 5 + 2e^{−t}', () => {
    expect(solved('(7s + 5)/(s^2 + s)').value.tex).toBe('5 + 2e^{-t}');
  });

  it('Hayt, problema de práctica 14.9: (11s + 30)/(s² + 3s) → 10 + e^{−3t}', () => {
    expect(solved('(11s + 30)/(s^2 + 3s)').value.tex).toBe('10 + e^{-3t}');
  });

  it('Hayt, problema de práctica 14.8: (3s² − 4)/s² → 3δ(t) − 4t', () => {
    expect(solved('(3s^2 - 4)/s^2').value.tex).toBe('3\\delta\\left(t\\right) - 4t');
  });

  it('retardo: (1 − e^{−s})/s → u(t) − u(t − 1)', () => {
    // Pulso rectangular de 1 s (Hayt, sec. 14.6, ejemplo 14.10 con otros instantes).
    expect(solved('(1 - e^(-s))/s').value.tex).toBe('1 - u\\left(t - 1\\right)');
    expect(valueAt('(1 - e^(-s))/s', 0.5)).toBeCloseTo(1, 12);
    expect(valueAt('(1 - e^(-s))/s', 1.5)).toBeCloseTo(0, 12);
  });

  it('cancela factores comunes: (s + 1)/[(s + 1)(s + 2)] → e^{−2t}', () => {
    // Verificación analítica: la función es 1/(s + 2).
    const result = solved('(s + 1)/((s + 1)(s + 2))');
    expect(result.value.tex).toBe('e^{-2t}');
    expect(result.steps.some((s) => s.explanation?.includes('factores comunes'))).toBe(true);
  });

  it('rechaza expresiones inválidas', () => {
    const result = solveInverseLaplace({ expression: 's +* 2' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('expresion-invalida');
    expect(solveInverseLaplace({ expression: 'x/(s+1)' }).ok).toBe(false);
    expect(solveInverseLaplace({ expression: 'e^(2s)/s' }).ok).toBe(false);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    const calc = transformadaInversaDeLaplace;
    expect(calc.inputSchema.safeParse(calc.example).success).toBe(true);
    expect(calc.solve(calc.example).ok).toBe(true);
  });
});
