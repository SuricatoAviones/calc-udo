import { describe, expect, it } from 'vitest';
import { multiply } from '@/lib/math/linear-algebra';
import { nStepTransition } from './n-step-transition';
import { steadyState } from './steady-state';

// Taha, Investigación de Operaciones, 7.ª ed. en español (Pearson, 2004), cap. 19.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

const TAHA_P = [
  [0.2, 0.8],
  [0.6, 0.4],
];

describe('Transición en n pasos', () => {
  // Ejemplo 19.5-1 (p. 696): P = [[0.2, 0.8], [0.6, 0.4]], a⁽⁰⁾ = (0.7, 0.3).
  //   P² = [[0.52, 0.48], [0.36, 0.64]]
  //   P⁴ = [[0.443, 0.557], [0.418, 0.582]]
  //   P⁸ = [[0.4291, 0.5709], [0.4284, 0.5716]]
  //   a⁽¹⁾ = (0.32, 0.68)   y   a⁽⁸⁾ = (0.4289, 0.5711)
  const power = (steps: number) => ok(nStepTransition.solve({ P: TAHA_P, steps })).value.power;

  it('reproduce P², P⁴ y P⁸ del libro', () => {
    expect(power(2)[0]![0]).toBeCloseTo(0.52, 12);
    expect(power(2)[1]![1]).toBeCloseTo(0.64, 12);
    const p4 = power(4);
    [
      [0.443, 0.557],
      [0.418, 0.582],
    ].forEach((row, i) => row.forEach((v, j) => expect(p4[i]![j]).toBeCloseTo(v, 3)));
    // El libro calcula P⁸ = P⁴·P⁴ con P⁴ ya redondeado a 3 decimales, así que su 4.º decimal
    // arrastra ese redondeo (el valor exacto de p₁₁⁽⁸⁾ es 0.42895). Se compara a 3 decimales…
    const bookP8 = [
      [0.4291, 0.5709],
      [0.4284, 0.5716],
    ];
    const p8 = power(8);
    bookP8.forEach((row, i) => row.forEach((v, j) => expect(p8[i]![j]).toBeCloseTo(v, 3)));
    // …y se comprueba que el P⁸ del libro sale exactamente de multiplicar su P⁴ redondeado.
    const roundedP4 = [
      [0.443, 0.557],
      [0.418, 0.582],
    ];
    const reproduced = multiply(roundedP4, roundedP4);
    bookP8.forEach((row, i) => row.forEach((v, j) => expect(reproduced[i]![j]).toBeCloseTo(v, 4)));
  });

  it('reproduce a⁽¹⁾ y a⁽⁸⁾', () => {
    const a1 = ok(nStepTransition.solve({ P: TAHA_P, steps: 1, initial: [0.7, 0.3] })).value;
    expect(a1.distribution![0]).toBeCloseTo(0.32, 12);
    expect(a1.distribution![1]).toBeCloseTo(0.68, 12);
    const a8 = ok(nStepTransition.solve(nStepTransition.example)).value;
    // a⁽⁸⁾ usa el mismo P⁸ redondeado del libro: coincide a 3 decimales.
    expect(a8.distribution![0]).toBeCloseTo(0.4289, 3);
    expect(a8.distribution![1]).toBeCloseTo(0.5711, 3);
  });

  it('sin distribución inicial solo calcula Pⁿ', () => {
    const result = ok(nStepTransition.solve({ P: TAHA_P, steps: 3 }));
    expect(result.value.distribution).toBeNull();
    expect(result.series).toHaveLength(0);
  });

  it('valida la matriz y la distribución inicial', () => {
    const schema = nStepTransition.inputSchema;
    const bad = (P: number[][]) => schema.safeParse({ P, steps: 2 }).success;
    expect(
      bad([
        [0.5, 0.4],
        [0.6, 0.4],
      ]),
    ).toBe(false); // fila 1 suma 0.9
    expect(
      bad([
        [1.2, -0.2],
        [0.6, 0.4],
      ]),
    ).toBe(false); // no son probabilidades
    expect(bad([[1]])).toBe(false); // un solo estado
    expect(schema.safeParse({ P: TAHA_P, steps: 2, initial: [0.5, 0.4] }).success).toBe(false);
    expect(schema.safeParse({ P: TAHA_P, steps: 2, initial: [0.5, 0.5] }).success).toBe(true);
  });
});

describe('Estado estable', () => {
  // Ejemplo 19.5-3 (p. 699): para la cadena del ejemplo 19.5-1, π₁ = 0.4286 y π₂ = 0.5714; los
  // tiempos medios de recurrencia son μ₁₁ = 1/0.4286 = 2.33 y μ₂₂ = 1/0.5714 = 1.75.
  it('Taha, ejemplo 19.5-3', () => {
    const { value } = ok(steadyState.solve({ P: TAHA_P }));
    expect(value.pi[0]).toBeCloseTo(0.4286, 4);
    expect(value.pi[1]).toBeCloseTo(0.5714, 4);
    expect(value.recurrenceTimes[0]).toBeCloseTo(2.33, 2);
    expect(value.recurrenceTimes[1]).toBeCloseTo(1.75, 2);
  });

  // Ejemplo 19.3-1 (pp. 683-684): problema del jardinero con la política "fertilizar siempre",
  // P = [[0.3, 0.6, 0.1], [0.1, 0.6, 0.3], [0.05, 0.4, 0.55]]; la solución de programación
  // lineal del ejemplo 19.4-1 da las mismas probabilidades: 0.1017, 0.5254 y 0.3729.
  it('Taha, ejemplo 19.3-1: jardinero, política 2', () => {
    const { value } = ok(steadyState.solve(steadyState.example));
    expect(value.pi[0]).toBeCloseTo(0.1017, 4);
    expect(value.pi[1]).toBeCloseTo(0.5254, 4);
    expect(value.pi[2]).toBeCloseTo(0.3729, 4);
  });

  // Mismo problema sin fertilizar (P¹ de la p. 676): el estado 3 ("malo") es absorbente y los
  // otros dos son transitorios, así que π = (0, 0, 1).
  it('cadena con un estado absorbente', () => {
    const result = ok(
      steadyState.solve({
        P: [
          [0.2, 0.5, 0.3],
          [0, 0.5, 0.5],
          [0, 0, 1],
        ],
      }),
    );
    expect(result.value.pi).toEqual([0, 0, 1]);
    expect(result.value.recurrenceTimes[0]).toBe(Infinity);
    expect(result.notices.some((n) => /transitorios/.test(n.message))).toBe(true);
  });

  // La identidad: cada estado es absorbente, cualquier distribución es estacionaria.
  it('dos clases cerradas → not-unique', () => {
    const result = steadyState.solve({
      P: [
        [1, 0],
        [0, 1],
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not-unique');
  });
});
