import { describe, expect, it } from 'vitest';
import {
  absoluteError,
  relativeError,
  relativeErrorPercent,
  scarboroughTolerance,
} from './error-metrics';

describe('medidas de error', () => {
  // Chapra & Canale, cap. 3 — Ejemplo 3.1 (cálculo de errores): puente medido en 9 999 cm,
  // valor verdadero 10 000 cm → Et = 1 cm, εt = 0.01 %. Remache 9 cm vs 10 cm → εt = 10 %.
  it('reproduce el ejemplo del puente y el remache (Chapra, Ej. 3.1)', () => {
    expect(absoluteError(10000, 9999)).toBe(1);
    expect(relativeErrorPercent(10000, 9999)).toBeCloseTo(0.01, 10);
    expect(relativeErrorPercent(10, 9)).toBeCloseTo(10, 10);
  });

  // Chapra & Canale, Ejemplo 6.3 (Newton-Raphson, f(x) = e^{-x} − x): con raíz verdadera
  // 0.56714329, el libro reporta εt = 11.8 % para x1 = 0.5 y εt = 0.147 % para x2 = 0.566311003.
  it('error relativo porcentual verdadero (Chapra, Ej. 6.3)', () => {
    expect(relativeErrorPercent(0.56714329, 0.5)).toBeCloseTo(11.8, 1);
    expect(relativeErrorPercent(0.56714329, 0.566311003)).toBeCloseTo(0.147, 3);
  });

  it('el error relativo no está definido si el valor actual es 0', () => {
    expect(relativeError(0, 1)).toBeNull();
    expect(relativeErrorPercent(0, 1)).toBeNull();
  });

  // Chapra & Canale, Ejemplo 3.2: para 3 cifras significativas, εs = 0.05 %.
  it('tolerancia de Scarborough (Chapra, Ej. 3.2)', () => {
    expect(scarboroughTolerance(3)).toBeCloseTo(0.05, 12);
    expect(scarboroughTolerance(2)).toBeCloseTo(0.5, 12);
  });
});
