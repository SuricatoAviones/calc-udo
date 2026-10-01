import { describe, expect, it } from 'vitest';
import { kkt } from './condiciones-kkt';
import { penalty } from './funciones-de-penalidad';
import { wolfe } from './metodo-de-wolfe';
import { lagrange } from './multiplicadores-de-lagrange';
import { classifyMatrix, leadingMinors, parseNlpConstraint } from './nlp';
import { oneVariable } from './optimizacion-una-variable';
import { multiVariable } from './optimizacion-varias-variables';
import { geometric } from './programacion-geometrica';
import { separable } from './programacion-separable';

// Fuentes consultadas: Taha, Investigación de Operaciones, 10.ª ed. en inglés (Pearson, 2017),
// caps. 20 y 21; Hillier & Lieberman, Introduction to Operations Research, 7.ª ed. (2001),
// cap. 13 y apéndice 2.

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('núcleo', () => {
  // Taha, ejemplo 20.1-1: los menores principales de H = [[−2,0,0],[0,−2,1],[0,1,−2]] son −2, 4 y
  // −6, así que H es definida negativa.
  it('menores principales y clasificación de la hessiana', () => {
    const H = [
      [-2, 0, 0],
      [0, -2, 1],
      [0, 1, -2],
    ];
    expect(leadingMinors(H).map((d) => Math.round(d * 1e9) / 1e9)).toEqual([-2, 4, -6]);
    expect(classifyMatrix(H)).toBe('definida negativa');
    // Hillier, apéndice 2: (x1 − x2)² tiene H = [[2, −2], [−2, 2]], semidefinida positiva.
    expect(
      classifyMatrix([
        [2, -2],
        [-2, 2],
      ]),
    ).toBe('semidefinida positiva');
    expect(
      classifyMatrix([
        [1, 0],
        [0, -1],
      ]),
    ).toBe('indefinida');
  });

  it('lee restricciones con ≤, ≥ e =', () => {
    const c = parseNlpConstraint('2x1 + x2 ≤ 5');
    expect(typeof c).not.toBe('string');
    if (typeof c !== 'string') {
      expect(c.relation).toBe('<=');
      expect(c.g.evaluateAt({ x1: 1, x2: 2 })).toBeCloseTo(-1, 12);
    }
    expect(typeof parseNlpConstraint('x1 + x2')).toBe('string');
  });
});

describe('optimización de una variable', () => {
  // Hillier, sec. 13.4, tabla 13.1: f(x) = 12x − 3x⁴ − 2x⁶; la búsqueda de Bolzano con ε = 0.01
  // termina con 0.828125 < x* < 0.84375 y toma el punto medio, «x* ≈ 0.836». El máximo exacto es la
  // raíz de f′ = 12(1 − x³ − x⁵), x* = 0.83762, que está en ese intervalo y a menos de ε de 0.836.
  it('Hillier 13.4: máximo de 12x − 3x⁴ − 2x⁶', () => {
    const { value } = ok(oneVariable.solve(oneVariable.example));
    expect(value.stationary).toHaveLength(1);
    const [p] = value.stationary;
    expect(p!.x).toBeGreaterThan(0.828125);
    expect(p!.x).toBeLessThan(0.84375);
    expect(Math.abs(p!.x - 0.836)).toBeLessThan(0.01);
    expect(1 - p!.x ** 3 - p!.x ** 5).toBeCloseTo(0, 10);
    expect(p!.kind).toBe('máximo local');
    expect(value.globalMax.x).toBeCloseTo(p!.x, 12);
  });

  // Taha, ejemplo 20.1-2: y⁴ tiene un mínimo en 0 (f⁽⁴⁾(0) = 24 > 0) y y³ un punto de inflexión
  // (g⁽³⁾(0) = 6 ≠ 0).
  it('Taha 20.1-2: derivadas de orden superior', () => {
    const quartic = ok(oneVariable.solve({ expression: 'x^4', a: -1, b: 1 })).value.stationary;
    expect(quartic).toHaveLength(1);
    expect(quartic[0]!.x).toBeCloseTo(0, 6);
    expect(quartic[0]!.order).toBe(4);
    expect(quartic[0]!.derivative).toBeCloseTo(24, 6);
    expect(quartic[0]!.kind).toBe('mínimo local');
    const cubic = ok(oneVariable.solve({ expression: 'x^3', a: -1, b: 1 })).value.stationary;
    expect(cubic).toHaveLength(1);
    expect(cubic[0]!.order).toBe(3);
    expect(cubic[0]!.kind).toBe('punto de inflexión');
  });

  // Caso analítico: x³ − 3x tiene un máximo en −1 y un mínimo en 1; en [−3, 3] el máximo absoluto
  // está en x = 3 (f = 18).
  it('varios puntos estacionarios y extremos absolutos', () => {
    const { value } = ok(oneVariable.solve({ expression: 'x^3 - 3x', a: -3, b: 3 }));
    expect(value.stationary.map((p) => p.kind)).toEqual(['máximo local', 'mínimo local']);
    expect(value.stationary[0]!.x).toBeCloseTo(-1, 10);
    expect(value.globalMax.x).toBe(3);
    expect(value.globalMax.f).toBeCloseTo(18, 10);
  });

  it('validaciones', () => {
    expect(oneVariable.inputSchema.safeParse({ expression: 'x^2', a: 1, b: 0 }).success).toBe(
      false,
    );
    expect(oneVariable.inputSchema.safeParse({ expression: 'y^2', a: 0, b: 1 }).success).toBe(
      false,
    );
  });
});

describe('optimización de varias variables', () => {
  // Taha, ejemplo 20.1-1: X0 = (1/2, 2/3, 4/3); menores −2, 4, −6 → máximo.
  it('Taha 20.1-1', () => {
    const { value } = ok(multiVariable.solve(multiVariable.example));
    expect(value.point[0]).toBeCloseTo(0.5, 10);
    expect(value.point[1]).toBeCloseTo(2 / 3, 10);
    expect(value.point[2]).toBeCloseTo(4 / 3, 10);
    expect(value.minors[0]).toBeCloseTo(-2, 10);
    expect(value.minors[1]).toBeCloseTo(4, 10);
    expect(value.minors[2]).toBeCloseTo(-6, 10);
    expect(value.kind).toBe('máximo local');
    // Cuadrática: Newton llega en una iteración.
    expect(value.iterations).toBe(1);
  });

  // Hillier, sec. 13.5: f = 2x1x2 + 2x2 − x1² − 2x2² tiene su máximo en (1, 1).
  it('Hillier 13.5: máximo en (1, 1)', () => {
    const { value } = ok(
      multiVariable.solve({ expression: '2x1*x2 + 2x2 - x1^2 - 2x2^2', start: '0, 0' }),
    );
    expect(value.point[0]).toBeCloseTo(1, 10);
    expect(value.point[1]).toBeCloseTo(1, 10);
    expect(value.kind).toBe('máximo local');
  });

  // Caso analítico: x1² − x2² tiene un punto de silla en el origen.
  it('punto de silla', () => {
    const { value } = ok(multiVariable.solve({ expression: 'x1^2 - x2^2', start: '1, 1' }));
    expect(value.kind).toBe('punto de silla');
  });

  it('validaciones', () => {
    const schema = multiVariable.inputSchema;
    expect(schema.safeParse({ expression: 'x1^2' }).success).toBe(false);
    expect(schema.safeParse({ expression: 'x1^2 + x2^2', start: '1' }).success).toBe(false);
  });
});

describe('multiplicadores de Lagrange', () => {
  // Taha, ejemplo 20.2-4: X0 = (.8043, .3478, .2826), λ = (.0870, .3043); el ejemplo 20.2-2
  // muestra con la condición suficiente que es un mínimo.
  it('Taha 20.2-4', () => {
    const { value } = ok(lagrange.solve(lagrange.example));
    [0.8043, 0.3478, 0.2826].forEach((v, j) => expect(value.point[j]).toBeCloseTo(v, 4));
    expect(value.multipliers[0]).toBeCloseTo(0.087, 4);
    expect(value.multipliers[1]).toBeCloseTo(0.3043, 4);
    expect(value.kind).toBe('mínimo local');
  });

  // Caso analítico: max x1 x2 con x1 + x2 = 10 → (5, 5), λ = 5; la hessiana orlada tiene
  // determinante 2 > 0 = signo de (−1)^{m+1}: máximo.
  it('máximo con una restricción', () => {
    const { value } = ok(
      lagrange.solve({ objective: 'x1*x2', constraints: 'x1 + x2 = 10', start: '1, 1' }),
    );
    expect(value.point[0]).toBeCloseTo(5, 10);
    expect(value.multipliers[0]).toBeCloseTo(5, 10);
    expect(value.borderedMinors[0]).toBeCloseTo(2, 10);
    expect(value.kind).toBe('máximo local');
  });

  it('validaciones', () => {
    const schema = lagrange.inputSchema;
    expect(
      schema.safeParse({ objective: 'x1^2 + x2^2', constraints: 'x1 + x2 <= 1' }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ objective: 'x1^2 + x2^2', constraints: 'x1 = 1\nx2 = 1' }).success,
    ).toBe(false);
  });
});

describe('condiciones KKT', () => {
  // Taha, ejemplo 20.2-5: en (1, 2, 0), λ1 = λ2 = λ5 = 0, λ3 = −2, λ4 = −4; como f y la región
  // son convexas, es el mínimo global.
  it('Taha 20.2-5', () => {
    const { value } = ok(kkt.solve(kkt.example));
    expect(value.isKkt).toBe(true);
    expect(value.constraints.map((c) => c.lambda)).toEqual([0, 0, -2, -4, 0]);
    expect(value.sufficient).toBe(true);
  });

  // Hillier, sec. 13.6: max ln(x1 + 1) + x2 con 2x1 + x2 ≤ 3, x ≥ 0 tiene su óptimo en (0, 3)
  // con u1 = 1. Aquí x1 ≥ 0 se escribe como restricción (λ ≤ 0 al maximizar).
  it('Hillier 13.6', () => {
    const input = {
      sense: 'max' as const,
      objective: 'ln(x1 + 1) + x2',
      constraints: '2x1 + x2 <= 3\nx1 >= 0\nx2 >= 0',
      point: '0, 3',
    };
    const { value } = ok(kkt.solve(input));
    expect(value.isKkt).toBe(true);
    expect(value.constraints[0]!.lambda).toBeCloseTo(1, 10);
    expect(value.constraints[1]!.lambda).toBeCloseTo(-1, 10);
    // En (1, 1) el gradiente (1/2, 1) no se anula con ninguna restricción activa.
    const other = ok(kkt.solve({ ...input, point: '1, 1' })).value;
    expect(other.isKkt).toBe(false);
    expect(other.stationary).toBe(false);
  });

  // Caso borde: punto infactible y multiplicador con el signo equivocado.
  it('punto infactible o signo equivocado', () => {
    const infeasible = ok(kkt.solve({ ...kkt.example, point: '3, 2, 0' })).value;
    expect(infeasible.feasible).toBe(false);
    const wrongSign = ok(
      kkt.solve({ sense: 'max', objective: 'x1', constraints: 'x1 >= 0', point: '0' }),
    ).value;
    expect(wrongSign.stationary).toBe(true);
    expect(wrongSign.signsOk).toBe(false);
  });
});

describe('funciones de penalidad (SUMT)', () => {
  // Hillier, sec. 13.9, tabla 13.6: max x1x2 con x1² + x2 ≤ 3, x ≥ 0 desde (1, 1): r = 1 →
  // (0.90, 1.36); r = 0.01 → (0.983, 1.933); r = 0.0001 → (0.998, 1.994), que converge a (1, 2).
  // El libro anota el punto donde se detuvo su búsqueda por gradiente; aquí se calcula el máximo
  // exacto de P(x; r) (gradiente nulo), que difiere en el tercer decimal: (0.98393, 1.93120) y
  // (0.99834, 1.99331). Por eso se compara a 2 decimales y se verifica que ∇P = 0.
  it('reproduce la tabla 13.6', () => {
    const { value } = ok(penalty.solve(penalty.example));
    const [a, b, c] = value.rounds;
    expect(a!.point[0]).toBeCloseTo(0.9, 2);
    expect(a!.point[1]).toBeCloseTo(1.36, 2);
    expect(b!.point[0]).toBeCloseTo(0.983, 2);
    expect(b!.point[1]).toBeCloseTo(1.933, 2);
    expect(c!.point[0]).toBeCloseTo(0.998, 2);
    expect(c!.point[1]).toBeCloseTo(1.994, 2);
    // ∂P/∂x2 = x1 − r[1/(3 − x1² − x2)² − 1/x2²] = 0 en el punto de r = 0.01.
    const [x1, x2] = b!.point as [number, number];
    const s = 3 - x1 ** 2 - x2;
    expect(x1 - 0.01 * (1 / s ** 2 - 1 / x2 ** 2)).toBeCloseTo(0, 8);
  });

  it('el punto inicial debe ser interior', () => {
    const result = penalty.solve({ ...penalty.example, start: '2, 2' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not-interior');
  });

  // Caso analítico: min x con x ≥ 1 (sin no negatividad): el mínimo de x + r/(x − 1) es
  // 1 + √r, que tiende a 1.
  it('minimización con restricción ≥', () => {
    const { value } = ok(
      penalty.solve({
        sense: 'min',
        objective: 'x1',
        constraints: 'x1 >= 1',
        nonNegative: 'no',
        start: '3',
        r0: 1,
        theta: 0.01,
        rounds: 3,
      }),
    );
    expect(value.rounds[0]!.point[0]).toBeCloseTo(2, 8);
    expect(value.rounds[2]!.point[0]).toBeCloseTo(1.01, 8);
  });
});

describe('método de Wolfe', () => {
  // Taha, ejemplo 21.2-3: x1* = 1/3, x2* = 5/6, z = 4.16 (4.1667); λ1 = 1. Tres iteraciones:
  // entra x1 (sale R1), entra x2 (sale s1) y entra λ1 (sale R2).
  it('Taha 21.2-3', () => {
    const result = ok(wolfe.solve(wolfe.example));
    expect(result.value.x[0]).toBeCloseTo(1 / 3, 12);
    expect(result.value.x[1]).toBeCloseTo(5 / 6, 12);
    expect(result.value.lambda[0]).toBeCloseTo(1, 12);
    expect(result.value.z).toBeCloseTo(4.1667, 4);
    expect(result.value.iterations).toBe(3);
    // Tabla inicial de la fase I: r = 6x1 + 6x2 + 3λ1 − μ1 − μ2 = 10.
    const initial = result.tables[0]!.rows[0]!;
    expect([initial.c0, initial.c1, initial.c2, initial.c3, initial.c4, initial.rhs]).toEqual([
      '6',
      '6',
      '3',
      '-1',
      '-1',
      '10',
    ]);
  });

  // Caso analítico: min (x1 − 1)² + (x2 − 2)² con x1 + x2 ≤ 2 → proyección de (1, 2) sobre la
  // recta: (0.5, 1.5).
  it('minimización', () => {
    const { value } = ok(
      wolfe.solve({
        sense: 'min',
        objective: 'x1^2 - 2x1 + x2^2 - 4x2',
        constraints: 'x1 + x2 <= 2',
      }),
    );
    expect(value.x[0]).toBeCloseTo(0.5, 12);
    expect(value.x[1]).toBeCloseTo(1.5, 12);
  });

  it('valida la forma del modelo', () => {
    const schema = wolfe.inputSchema;
    expect(schema.safeParse({ ...wolfe.example, objective: 'x1^3 + x2' }).success).toBe(false);
    expect(schema.safeParse({ ...wolfe.example, objective: 'x1^2 + x2^2' }).success).toBe(false);
    expect(schema.safeParse({ ...wolfe.example, constraints: 'x1 + x2 >= 2' }).success).toBe(false);
  });
});

describe('programación separable', () => {
  // Taha, ejemplo 21.2-1: con los puntos 0, 1, 2, 3 para x2, la base restringida termina con
  // w23 = 9/10 y w24 = 1/10: x1 = 0, x2 ≈ 2(9/10) + 3(1/10) = 2.1 y z ≈ 2.1⁴ = 19.45 (el objetivo
  // aproximado de la última tabla es 22½). Primero entra w23 (w24 no puede: w21 seguiría
  // positiva) y después w24.
  it('Taha 21.2-1', () => {
    const result = ok(separable.solve(separable.example));
    const { value } = result;
    expect(value.x[0]).toBeCloseTo(0, 12);
    expect(value.x[1]).toBeCloseTo(2.1, 12);
    expect(value.approximateObjective).toBeCloseTo(22.5, 12);
    expect(value.trueObjective).toBeCloseTo(19.45, 2);
    const weights = value.weights.map((w) => w.weight);
    expect(weights).toEqual([0, 0, 0.9, 0.1]);
  });

  it('rechaza funciones no separables y variables sin puntos de quiebre', () => {
    const schema = separable.inputSchema;
    expect(schema.safeParse({ ...separable.example, objective: 'x1*x2' }).success).toBe(false);
    expect(schema.safeParse({ ...separable.example, breakpoints: 'x1: 0, 1' }).success).toBe(false);
  });
});

describe('programación geométrica', () => {
  // Duffin, Peterson y Zener (1967), la caja de grava: costo mínimo $100 con x = (2, 1, ½) y
  // pesos δ = (2/5, 1/5, 1/5, 1/5) (grado de dificultad 0). Se verificó que g₀(2, 1, ½) = 40 +
  // 20 + 20 + 20 = 100 y que el dual da el mismo valor.
  it('caja de grava sin restricciones', () => {
    const { value } = ok(geometric.solve(geometric.example));
    expect(value.degreeOfDifficulty).toBe(0);
    [0.4, 0.2, 0.2, 0.2].forEach((d, i) => expect(value.delta[i]).toBeCloseTo(d, 12));
    expect(value.dualValue).toBeCloseTo(100, 10);
    expect(value.x[0]).toBeCloseTo(2, 10);
    expect(value.x[1]).toBeCloseTo(1, 10);
    expect(value.x[2]).toBeCloseTo(0.5, 10);
  });

  // Caso verificado analíticamente (D = 0 con restricción): min 40/(x1x2x3) + 40x2x3 con
  // ½x1x3 + ¼x1x2 ≤ 1. El dual da δ = (2/3, 1/3, 1/3, 1/3), λ = 2/3 y v = 60; el punto primal
  // (2, 1, ½) cumple la restricción con igualdad y da g₀ = 40 + 20 = 60, así que es óptimo.
  it('con restricción', () => {
    const { value } = ok(
      geometric.solve({
        terms: [
          { fn: 0, c: 40, a1: -1, a2: -1, a3: -1 },
          { fn: 0, c: 40, a2: 1, a3: 1 },
          { fn: 1, c: 0.5, a1: 1, a3: 1 },
          { fn: 1, c: 0.25, a1: 1, a2: 1 },
        ],
      }),
    );
    expect(value.lambda[0]).toBeCloseTo(2 / 3, 12);
    expect(value.dualValue).toBeCloseTo(60, 10);
    expect(value.x[0]).toBeCloseTo(2, 8);
    expect(value.x[1]).toBeCloseTo(1, 8);
    expect(value.x[2]).toBeCloseTo(0.5, 8);
  });

  // Caso verificado resolviendo el primal (D = 1): g₀ = 2x + 1/x + x². El mínimo cumple
  // g₀′ = 2 − 1/x² + 2x = 0, es decir 2x³ + 2x² − 1 = 0, con raíz x ≈ 0.56519.
  it('grado de dificultad 1', () => {
    const { value } = ok(
      geometric.solve({
        terms: [
          { fn: 0, c: 2, a1: 1 },
          { fn: 0, c: 1, a1: -1 },
          { fn: 0, c: 1, a1: 2 },
        ],
      }),
    );
    expect(value.degreeOfDifficulty).toBe(1);
    const x = value.x[0]!;
    expect(2 * x ** 3 + 2 * x ** 2 - 1).toBeCloseTo(0, 8);
    expect(value.dualValue).toBeCloseTo(2 * x + 1 / x + x * x, 8);
  });

  it('sin solución dual positiva', () => {
    // g₀ = x: no tiene mínimo con x > 0 (se acerca a 0).
    const result = geometric.solve({
      terms: [
        { fn: 0, c: 1, a1: 1 },
        { fn: 0, c: 1, a1: 2 },
      ],
    });
    expect(result.ok).toBe(false);
  });
});
