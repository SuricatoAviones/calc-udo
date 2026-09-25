/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { getCalculatorLocation, getSource } from '@/lib/curriculum';
import type { Calculator } from './types';

/**
 * Verifica el contrato en TODAS las calculadoras de lib/calculators/<materia>/*.ts sin tener que
 * registrarlas aquí: agregar el archivo basta para que se validen.
 */
const modules = import.meta.glob(['./*/*.ts', '!./**/*.test.ts'], {
  eager: true,
}) as Record<string, Record<string, unknown>>;

function isCalculator(value: unknown): value is Calculator<unknown, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'meta' in value &&
    'solve' in value &&
    'inputSchema' in value
  );
}

const calculators = Object.entries(modules).flatMap(([file, mod]) =>
  Object.values(mod)
    .filter(isCalculator)
    .map((calculator) => ({ file, calculator })),
);

describe('contrato de calculadoras', () => {
  it('encuentra las calculadoras (el glob no está roto)', () => {
    expect(calculators.length).toBeGreaterThan(0);
  });

  it('los ids son únicos', () => {
    const ids = calculators.map((c) => c.calculator.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada calculadora cumple el contrato', () => {
    for (const { file, calculator } of calculators) {
      const { meta } = calculator;
      const where = `${file} (${meta.id})`;

      expect(
        getCalculatorLocation(meta.id),
        `${where}: id no está en data/curriculum.ts`,
      ).toBeDefined();
      expect(
        file.startsWith(`./${getCalculatorLocation(meta.id)?.subject.slug}/`),
        `${where}: carpeta ≠ materia`,
      ).toBe(true);
      expect(meta.citations.length, `${where}: sin citas`).toBeGreaterThan(0);
      for (const citation of meta.citations) {
        expect(getSource(citation.sourceId), `${where}: cita ${citation.sourceId}`).toBeDefined();
      }

      const parsed = calculator.inputSchema.safeParse(calculator.example);
      expect(parsed.success, `${where}: example no cumple inputSchema`).toBe(true);

      const result = calculator.solve(calculator.example);
      expect(result.ok, `${where}: el ejemplo del libro debe resolverse`).toBe(true);
      expect(result.steps.length, `${where}: el resultado debe traer pasos`).toBeGreaterThan(0);
    }
  });
});
