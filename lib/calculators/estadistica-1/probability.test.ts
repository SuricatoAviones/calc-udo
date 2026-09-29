import { describe, expect, it } from 'vitest';
import { counting, type CountingInput } from './tecnicas-de-conteo';
import { bayes } from './teorema-de-bayes';

// Walpole, Myers, Myers y Ye, Probabilidad y estadística para ingeniería y ciencias, 9.ª ed. en
// español (Pearson, 2012), capítulo 2.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

const count = (input: CountingInput) => ok(counting.solve(input)).value;

describe('Técnicas de conteo', () => {
  // Ejemplo 2.18 (p. 48): tres premios distintos entre 25 estudiantes: ₂₅P₃ = 13,800. (En la
  // copia consultada la cifra impresa no se lee; se verificó con el teorema 2.2: 25 · 24 · 23.)
  // Ejemplo 2.19 (p. 48): presidente y tesorero de un club de 50: ₅₀P₂ = 2450; sin B ni C
  // quedan 48 personas: ₄₈P₂ = 2256.
  it('permutaciones: Walpole, ejemplos 2.18 y 2.19', () => {
    expect(count(counting.example).count).toBe(13800);
    expect(count({ type: 'permutaciones', n: 50, r: 2 }).count).toBe(2450);
    expect(count({ type: 'permutaciones', n: 48, r: 2 }).count).toBe(2256);
  });

  // Ejemplo 2.22 (pp. 50-51): 3 de 10 juegos recreativos y 2 de 5 de deportes:
  // C(10, 3) = 120 y C(5, 2) = 10. Ejemplo 2.28 (p. 55): manos de póquer, C(52, 5) = 2,598,960.
  it('combinaciones: Walpole, ejemplos 2.22 y 2.28', () => {
    expect(count({ type: 'combinaciones', n: 10, r: 3 }).count).toBe(120);
    expect(count({ type: 'combinaciones', n: 5, r: 2 }).count).toBe(10);
    expect(count({ type: 'combinaciones', n: 52, r: 5 }).count).toBe(2598960);
    expect(count({ type: 'combinaciones', n: 4, r: 2 }).count).toBe(6);
  });

  // Ejemplo 2.13 (p. 45): un par de dados cae de (6)(6) = 36 formas (regla de multiplicación).
  it('con repetición: Walpole, ejemplo 2.13', () => {
    expect(count({ type: 'con-repeticion', n: 6, r: 2 }).count).toBe(36);
  });

  // Sec. 2.3 (p. 49), teorema 2.3: cuatro personas en una mesa de bridge: 3! = 6 arreglos.
  it('circulares: Walpole, teorema 2.3', () => {
    expect(count({ type: 'circulares', n: 4 }).count).toBe(6);
  });

  // Ejemplo 2.20 (p. 49): 10 jugadores (1, 2, 4 y 3 por año): 10!/(1! 2! 4! 3!) = 12,600.
  // Ejemplo 2.23 (p. 51): STATISTICS: 10!/(3! 3! 2! 1! 1!) = 50,400 (la cifra impresa no se lee
  // en la copia consultada; 3628800/72 = 50400).
  it('objetos repetidos: Walpole, ejemplos 2.20 y 2.23', () => {
    expect(count({ type: 'objetos-repetidos', groups: '1 2 4 3' }).count).toBe(12600);
    expect(count({ type: 'objetos-repetidos', groups: '3, 3, 2, 1, 1' }).count).toBe(50400);
  });

  // Ejemplo 2.21 (p. 50): 7 estudiantes en una habitación triple y dos dobles: 7!/(3! 2! 2!) = 210.
  it('particiones: Walpole, ejemplo 2.21', () => {
    expect(count({ type: 'particiones', groups: '3 2 2' }).count).toBe(210);
  });

  // Casos borde, por la definición 2.8 (0! = 1): C(n, 0) = ₙP₀ = 1. Los conteos grandes son
  // exactos: C(100, 50) tiene 30 cifras (100891344545564193334812497256).
  it('bordes y enteros grandes', () => {
    expect(count({ type: 'combinaciones', n: 7, r: 0 }).count).toBe(1);
    expect(count({ type: 'permutaciones', n: 7, r: 0 }).count).toBe(1);
    expect(count({ type: 'combinaciones', n: 100, r: 50 }).exact).toBe(
      '100891344545564193334812497256',
    );
  });

  it('valida r ≤ n y los grupos', () => {
    const schema = counting.inputSchema;
    expect(schema.safeParse({ type: 'combinaciones', n: 3, r: 5 }).success).toBe(false);
    expect(schema.safeParse({ type: 'con-repeticion', n: 3, r: 5 }).success).toBe(true);
    expect(schema.safeParse({ type: 'permutaciones', n: 3 }).success).toBe(false);
    expect(schema.safeParse({ type: 'particiones', groups: '3 x' }).success).toBe(false);
    expect(schema.safeParse({ type: 'particiones', groups: '2.5 1' }).success).toBe(false);
  });
});

describe('Teorema de Bayes', () => {
  // Ejemplo 2.41 (p. 74): P(A) = (0.3)(0.02) + (0.45)(0.03) + (0.25)(0.02)
  //   = 0.006 + 0.0135 + 0.005 = 0.0245.
  // Ejemplo 2.42 (pp. 75-76): P(B₃ | A) = 0.005/0.0245 = 10/49.
  it('Walpole, ejemplos 2.41 y 2.42', () => {
    const { value, tables } = ok(bayes.solve(bayes.example));
    expect(value.evidence).toBeCloseTo(0.0245, 12);
    expect(value.posteriors[2]).toBeCloseTo(10 / 49, 12);
    expect(tables[0]?.rows.map((r) => r.joint)).toEqual([
      expect.closeTo(0.006, 12),
      expect.closeTo(0.0135, 12),
      expect.closeTo(0.005, 12),
    ]);
  });

  // Ejemplo 2.43 (p. 76): planos usados en 30 %, 20 % y 50 % de los productos, con tasas de
  // defectos 0.01, 0.03 y 0.02: P(P₁ | D) = 0.003/0.019 = 0.158, P(P₂ | D) = 0.316 y
  // P(P₃ | D) = 0.526.
  it('Walpole, ejemplo 2.43', () => {
    const result = bayes.solve({
      events: [
        { name: 'Plano 1', prior: '0.30', likelihood: '0.01' },
        { name: 'Plano 2', prior: '0.20', likelihood: '0.03' },
        { name: 'Plano 3', prior: '0.50', likelihood: '0.02' },
      ],
    });
    const { value, summary } = ok(result);
    expect(value.evidence).toBeCloseTo(0.019, 12);
    expect(value.posteriors[0]).toBeCloseTo(0.158, 3);
    expect(value.posteriors[1]).toBeCloseTo(0.316, 3);
    expect(value.posteriors[2]).toBeCloseTo(0.526, 3);
    expect(summary.find((s) => s.emphasis)?.label).toContain('Plano 3');
  });

  // Caso borde: si A es imposible, P(Bᵢ | A) no está definida, pero la traza explica P(A) = 0.
  it('P(A) = 0 devuelve un error con la traza', () => {
    const result = bayes.solve({
      events: [
        { name: 'B1', prior: '1/2', likelihood: '0' },
        { name: 'B2', prior: '1/2', likelihood: '0' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('zero-evidence');
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('las probabilidades a priori deben sumar 1 y acepta fracciones', () => {
    const schema = bayes.inputSchema;
    const events = (a: string) => [
      { name: 'B1', prior: a, likelihood: '0.1' },
      { name: 'B2', prior: '2/3', likelihood: '0.2' },
    ];
    expect(schema.safeParse({ events: events('1/3') }).success).toBe(true);
    expect(schema.safeParse({ events: events('0.5') }).success).toBe(false);
    expect(schema.safeParse({ events: events('1.5') }).success).toBe(false);
  });
});
