import { describe, expect, it } from 'vitest';
import { determinant } from './determinante';
import { gaussElimination } from './eliminacion-gaussiana';
import { matrixOperationsCalculator as operations } from './operaciones-con-matrices';

// Chapra & Canale, Métodos Numéricos para Ingenieros, cap. 9 y 10 y parte 3 (5.ª ed. en español,
// McGraw-Hill 2007; el pensum cita la 3.ª ed.).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

function fail<T extends { ok: boolean }>(result: T) {
  if (result.ok) throw new Error('se esperaba un error');
  return result as Extract<T, { ok: false }>;
}

/** Sistema del ejemplo de eliminación de Gauss simple de Chapra (sec. 9.2). */
const CHAPRA_SYSTEM = [
  [3, -0.1, -0.2, 7.85],
  [0.1, 7, -0.3, -19.3],
  [0.3, -0.2, 10, 71.4],
];
const CHAPRA_A = CHAPRA_SYSTEM.map((row) => row.slice(0, 3));

describe('Determinante', () => {
  // Sec. 9.1.2, regla de Cramer: 0.3x₁ + 0.52x₂ + x₃ = −0.01, 0.5x₁ + x₂ + 1.9x₃ = 0.67,
  // 0.1x₁ + 0.3x₂ + 0.5x₃ = −0.44. Menores A₁ = −0.07, A₂ = 0.06, A₃ = 0.05 y
  // D = 0.3(−0.07) − 0.52(0.06) + 1(0.05) = −0.0022.
  it('por cofactores reproduce D = −0.0022 y sus menores', () => {
    const result = ok(determinant.solve(determinant.example));
    expect(result.value.determinant).toBeCloseTo(-0.0022, 12);
    const expansion = result.steps[1]!;
    const minors = expansion.children!.map((c) => c.result);
    expect(minors).toEqual(['M_{11} = -0.07', 'M_{12} = 0.06', 'M_{13} = 0.05']);
  });

  it('por eliminación de Gauss da el mismo valor', () => {
    const result = ok(determinant.solve({ ...determinant.example, method: 'gauss' }));
    expect(result.value.determinant).toBeCloseTo(-0.0022, 12);
  });

  // Sec. 9.2.3: el determinante del sistema del ejemplo de eliminación de Gauss es el producto de
  // la diagonal de la matriz triangular, D = 3(7.00333)(10.0120) = 210.353.
  it('Chapra: D = 3(7.00333)(10.0120) = 210.353', () => {
    const result = ok(determinant.solve({ matrix: CHAPRA_A, method: 'gauss' }));
    expect(result.value.determinant).toBeCloseTo(210.353, 2);
    const cofactors = ok(determinant.solve({ matrix: CHAPRA_A, method: 'cofactores' }));
    expect(cofactors.value.determinant).toBeCloseTo(result.value.determinant, 10);
  });

  // Sec. 9.1.2: determinantes de los sistemas de 2 × 2 de las figuras 9.1 y 9.2:
  // 3(2) − 2(−1) = 8; rectas paralelas −½(1) − 1(−½) = 0; casi paralelas −½(1) − 1(−2.3/5) = −0.04.
  it('Chapra: sistemas de 2 × 2 (8, 0 y −0.04)', () => {
    const det = (matrix: number[][]) =>
      ok(determinant.solve({ matrix, method: 'cofactores' })).value;
    expect(
      det([
        [3, 2],
        [-1, 2],
      ]).determinant,
    ).toBe(8);
    const parallel = det([
      [-0.5, 1],
      [-0.5, 1],
    ]);
    expect(parallel.determinant).toBe(0);
    expect(parallel.singular).toBe(true);
    expect(
      det([
        [-0.5, 1],
        [-2.3 / 5, 1],
      ]).determinant,
    ).toBeCloseTo(-0.04, 12);
  });

  // Caso borde, analítico: una fila de ceros o un intercambio de filas. [[0, 1], [1, 0]] es la
  // identidad con las filas intercambiadas: det = −1. Con Gauss hace falta un intercambio.
  it('intercambio de filas cambia el signo', () => {
    const matrix = [
      [0, 1],
      [1, 0],
    ];
    expect(ok(determinant.solve({ matrix, method: 'gauss' })).value.determinant).toBe(-1);
    expect(ok(determinant.solve({ matrix, method: 'cofactores' })).value.determinant).toBe(-1);
  });

  // Caso borde, analítico: det de una matriz 4 × 4 triangular = producto de la diagonal (24), y una
  // matriz con dos filas iguales tiene det = 0.
  it('4 × 4 por cofactores y matriz singular por Gauss', () => {
    const upper = [
      [1, 5, -2, 3],
      [0, 2, 7, 1],
      [0, 0, 3, 4],
      [0, 0, 0, 4],
    ];
    expect(ok(determinant.solve({ matrix: upper, method: 'cofactores' })).value.determinant).toBe(
      24,
    );
    const singular = ok(
      determinant.solve({
        matrix: [
          [1, 2, 3],
          [2, 4, 6],
          [1, 0, 1],
        ],
        method: 'gauss',
      }),
    );
    expect(singular.value.determinant).toBe(0);
    expect(singular.value.singular).toBe(true);
  });

  it('el schema limita los cofactores a 4 × 4', () => {
    const big = Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 5 }, (_, j) => (i === j ? 1 : 0)),
    );
    expect(determinant.inputSchema.safeParse({ matrix: big, method: 'cofactores' }).success).toBe(
      false,
    );
    expect(determinant.inputSchema.safeParse({ matrix: big, method: 'gauss' }).success).toBe(true);
  });
});

describe('Eliminación gaussiana', () => {
  // Sec. 9.2, ejemplo de eliminación de Gauss simple: 3x₁ − 0.1x₂ − 0.2x₃ = 7.85,
  // 0.1x₁ + 7x₂ − 0.3x₃ = −19.3, 0.3x₁ − 0.2x₂ + 10x₃ = 71.4. El libro trabaja con 6 cifras:
  // tras la primera etapa 7.00333x₂ − 0.293333x₃ = −19.5617 y −0.190000x₂ + 10.0200x₃ = 70.6150;
  // tras la segunda 10.0120x₃ = 70.0843. Resultado x₃ = 7.00003, x₂ = −2.50000, x₁ = 3.00000
  // (la solución exacta es 3, −2.5 y 7: el 7.00003 del libro es redondeo).
  const result = ok(gaussElimination.solve(gaussElimination.example));

  it('reproduce la solución del libro', () => {
    const [x1, x2, x3] = result.value.solution;
    expect(x1).toBeCloseTo(3, 4);
    expect(x2).toBeCloseTo(-2.5, 4);
    expect(x3).toBeCloseTo(7.00003, 4);
  });

  it('reproduce las matrices intermedias', () => {
    // Sin intercambios: con pivoteo parcial los pivotes ya son los de mayor valor absoluto.
    expect(result.value.swaps).toBe(0);
    const forward = result.steps[1]!.children!;
    const rowsAfter = (stage: number) =>
      forward[stage]!.children!.filter((c) => c.title.startsWith('Eliminar')).map((c) => c.result);
    const firstStage = rowsAfter(0);
    expect(firstStage[0]).toContain('7.00333');
    expect(firstStage[0]).toContain('-0.293333');
    expect(firstStage[0]).toContain('-19.5617');
    expect(firstStage[1]).toContain('-0.19');
    expect(firstStage[1]).toContain('10.02');
    expect(firstStage[1]).toContain('70.615');
    const secondStage = rowsAfter(1);
    expect(secondStage[0]).toContain('10.012');
    expect(secondStage[0]).toContain('70.0843');
  });

  it('la comprobación da residuos despreciables', () => {
    for (const r of result.value.residuals) expect(Math.abs(r)).toBeLessThan(1e-12);
  });

  // Sec. 9.4.2, ejemplo de pivoteo parcial: 0.0003x₁ + 3.0000x₂ = 2.0001, x₁ + x₂ = 1, con
  // solución exacta x₁ = 1/3, x₂ = 2/3. Con pivoteo, la primera ecuación pasa a ser la segunda.
  it('pivoteo parcial intercambia las filas del ejemplo de Chapra', () => {
    const pivot = ok(
      gaussElimination.solve({
        system: [
          [0.0003, 3, 2.0001],
          [1, 1, 1],
        ],
        pivoting: 'parcial',
      }),
    );
    expect(pivot.value.swaps).toBe(1);
    expect(pivot.value.solution[0]).toBeCloseTo(1 / 3, 10);
    expect(pivot.value.solution[1]).toBeCloseTo(2 / 3, 10);
  });

  // Caso borde, analítico: pivote cero en la diagonal. Sin pivoteo no se puede seguir; con
  // pivoteo se intercambian las filas y la solución es x₁ = 2, x₂ = 1.
  it('pivote cero: error sin pivoteo, solución con pivoteo', () => {
    const system = [
      [0, 1, 1],
      [1, 1, 3],
    ];
    const naive = fail(gaussElimination.solve({ system, pivoting: 'ninguno' }));
    expect(naive.error.code).toBe('zero-pivot');
    expect(naive.steps.length).toBeGreaterThan(0);
    const pivot = ok(gaussElimination.solve({ system, pivoting: 'parcial' }));
    expect(pivot.value.solution).toEqual([2, 1]);
  });

  // Caso borde, analítico: la segunda ecuación es el doble de la primera (rectas coincidentes).
  it('sistema singular', () => {
    const result = fail(
      gaussElimination.solve({
        system: [
          [1, 2, 3],
          [2, 4, 6],
        ],
        pivoting: 'parcial',
      }),
    );
    expect(result.error.code).toBe('singular');
  });
});

describe('Operaciones con matrices', () => {
  // Parte 3, figura PT3.2: [3 1; 8 6; 0 4] × [5 9; 7 2] = [22 29; 82 84; 28 8]
  // (c₁₁ = 3 × 5 + 1 × 7 = 22).
  it('producto de la figura PT3.2', () => {
    const result = ok(operations.solve(operations.example));
    expect(result.value.result).toEqual([
      [22, 29],
      [82, 84],
      [28, 8],
    ]);
  });

  // Sec. 10.2, ejemplo de la matriz inversa: la inversa de la matriz del ejemplo de eliminación
  // de Gauss es
  //   [ 0.33249   0.004944  0.006798
  //    −0.00518   0.142903  0.004183
  //    −0.01008   0.00271   0.09988 ]
  it('inversa de la matriz del ejemplo de Chapra', () => {
    const result = ok(operations.solve({ operation: 'inversa', A: CHAPRA_A }));
    const expected = [
      [0.33249, 0.004944, 0.006798],
      [-0.00518, 0.142903, 0.004183],
      [-0.01008, 0.00271, 0.09988],
    ];
    expected.forEach((row, i) =>
      row.forEach((v, j) => expect(result.value.result[i]![j]).toBeCloseTo(v, 5)),
    );
  });

  // Casos analíticos (definiciones de la sec. PT3.2.2): suma, resta, escalar y transpuesta.
  it('suma, resta, escalar y transpuesta', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const B = [
      [5, 6],
      [7, 8],
    ];
    expect(ok(operations.solve({ operation: 'suma', A, B })).value.result).toEqual([
      [6, 8],
      [10, 12],
    ]);
    expect(ok(operations.solve({ operation: 'resta', A, B })).value.result).toEqual([
      [-4, -4],
      [-4, -4],
    ]);
    expect(ok(operations.solve({ operation: 'escalar', A, k: 3 })).value.result).toEqual([
      [3, 6],
      [9, 12],
    ]);
    expect(
      ok(
        operations.solve({
          operation: 'transpuesta',
          A: [
            [1, 2, 3],
            [4, 5, 6],
          ],
        }),
      ).value.result,
    ).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('matriz singular no tiene inversa', () => {
    const result = fail(
      operations.solve({
        operation: 'inversa',
        A: [
          [1, 2],
          [2, 4],
        ],
      }),
    );
    expect(result.error.code).toBe('singular');
  });

  it('el schema rechaza dimensiones incompatibles', () => {
    const A = [[1, 2]];
    const B = [[1, 2]];
    expect(operations.inputSchema.safeParse({ operation: 'producto', A, B }).success).toBe(false);
    expect(operations.inputSchema.safeParse({ operation: 'suma', A, B: [[1]] }).success).toBe(
      false,
    );
    expect(operations.inputSchema.safeParse({ operation: 'inversa', A }).success).toBe(false);
  });

  it('los ejemplos cumplen el schema', () => {
    expect(operations.inputSchema.safeParse(operations.example).success).toBe(true);
    expect(determinant.inputSchema.safeParse(determinant.example).success).toBe(true);
    expect(gaussElimination.inputSchema.safeParse(gaussElimination.example).success).toBe(true);
  });
});
