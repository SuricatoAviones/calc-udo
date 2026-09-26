/**
 * Método de los multiplicadores (u–v) para la solución óptima del transporte (Taha,
 * sec. 5.3.2). En cada iteración:
 *
 * 1. Con u₁ = 0, se resuelve uᵢ + vⱼ = cᵢⱼ en las celdas básicas.
 * 2. En cada celda no básica se evalúa uᵢ + vⱼ − cᵢⱼ. Si ninguna es positiva, la solución es
 *    óptima; si no, entra la de mayor valor.
 * 3. Se forma el ciclo cerrado de la celda que entra con celdas básicas (alternando fila y
 *    columna) y se marcan sus esquinas +, −, +, −…
 * 4. θ es la menor asignación de las esquinas −; se suma en las + y se resta en las −, y sale la
 *    básica que queda en 0.
 */
import { z } from 'zod';
import { latexLines } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Notice,
  type ResultTable,
  type Step,
} from '../types';
import {
  allocationTable,
  balance,
  balanceStep,
  cellKey,
  costLatex,
  initialSolution,
  parseKey,
  refineTransport,
  totalCost,
  transportShape,
  type Allocation,
  type Balanced,
} from './transport';
import { sunRay, type TransportValue } from './transport-initial';

export const initialMethods = ['esquina-noroeste', 'costo-minimo', 'vogel'] as const;

export const modiInputSchema = z
  .object({
    ...transportShape,
    initial: z.enum(initialMethods, { error: 'Elige el método de la solución inicial.' }),
  })
  .superRefine(refineTransport);

export type ModiInput = z.infer<typeof modiInputSchema>;

export interface ModiValue extends TransportValue {
  iterations: number;
  initialCost: number;
}

export type ModiErrorCode = 'max-iterations';

const MAX_ITERATIONS = 30;

/** u y v a partir de las celdas básicas (árbol generador), con u₁ = 0. */
function multipliers(b: Balanced, allocation: Allocation) {
  const m = b.supply.length;
  const n = b.demand.length;
  const u: (Rational | null)[] = new Array<Rational | null>(m).fill(null);
  const v: (Rational | null)[] = new Array<Rational | null>(n).fill(null);
  u[0] = Rational.ZERO;
  const cells = [...allocation.keys()].map(parseKey);
  const equations: string[] = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const [i, j] of cells) {
      const c = b.costs[i]![j]!;
      if (u[i] !== null && v[j] === null) {
        v[j] = c.sub(u[i]!);
        equations.push(
          `u_{${i + 1}} + v_{${j + 1}} = ${c.toLatex()} \\Rightarrow v_{${j + 1}} = ${v[j]!.toLatex()}`,
        );
        changed = true;
      } else if (v[j] !== null && u[i] === null) {
        u[i] = c.sub(v[j]!);
        equations.push(
          `u_{${i + 1}} + v_{${j + 1}} = ${c.toLatex()} \\Rightarrow u_{${i + 1}} = ${u[i]!.toLatex()}`,
        );
        changed = true;
      }
    }
  }
  return {
    u: u.map((x) => x ?? Rational.ZERO),
    v: v.map((x) => x ?? Rational.ZERO),
    equations,
  };
}

/** Ciclo cerrado que empieza en la celda que entra y alterna fila y columna. */
function findLoop(allocation: Allocation, entering: [number, number]): [number, number][] {
  let cells: [number, number][] = [...[...allocation.keys()].map(parseKey), entering];
  const isEntering = (c: [number, number]) => c[0] === entering[0] && c[1] === entering[1];
  for (let changed = true; changed;) {
    changed = false;
    cells = cells.filter((c) => {
      if (isEntering(c)) return true;
      const inRow = cells.filter((d) => d[0] === c[0]).length;
      const inCol = cells.filter((d) => d[1] === c[1]).length;
      const keep = inRow >= 2 && inCol >= 2;
      if (!keep) changed = true;
      return keep;
    });
  }
  const path: [number, number][] = [entering];
  let horizontal = true;
  for (let guard = 0; guard < cells.length + 1; guard++) {
    const current = path.at(-1)!;
    const next = cells.find(
      (c) =>
        !path.some((p) => p[0] === c[0] && p[1] === c[1]) &&
        (horizontal ? c[0] === current[0] : c[1] === current[1]),
    );
    if (!next) break;
    path.push(next);
    horizontal = !horizontal;
  }
  return path;
}

export function solveModi(input: ModiInput): CalculatorResult<ModiValue, ModiErrorCode> {
  const b = balance(input);
  const initial = initialSolution(b, input.initial);
  let allocation = initial.allocation;
  const initialCost = totalCost(b, allocation);
  const steps: Step[] = [
    balanceStep(b),
    {
      title: 'Solución inicial',
      explanation: `Se parte de la solución por el método ${input.initial === 'esquina-noroeste' ? 'de la esquina noroeste' : input.initial === 'costo-minimo' ? 'del costo mínimo' : 'de aproximación de Vogel'}.`,
      substitution: costLatex(b, allocation),
      result: `Z_0 = ${initialCost.toLatex()}`,
      children: initial.steps,
    },
  ];
  const tables: ResultTable[] = [];
  const notices: Notice[] = [];

  for (let k = 0; k < MAX_ITERATIONS; k++) {
    const { u, v, equations } = multipliers(b, allocation);
    const evaluations: { i: number; j: number; value: Rational }[] = [];
    b.costs.forEach((row, i) =>
      row.forEach((c, j) => {
        if (!allocation.has(cellKey(i, j)))
          evaluations.push({ i, j, value: u[i]!.add(v[j]!).sub(c) });
      }),
    );
    const best = evaluations.reduce<(typeof evaluations)[number] | null>(
      (acc, e) => (e.value.sign() > 0 && (acc === null || e.value.gt(acc.value)) ? e : acc),
      null,
    );
    const children: Step[] = [
      {
        title: 'Multiplicadores',
        explanation: 'En cada celda básica uᵢ + vⱼ = cᵢⱼ; se fija u₁ = 0 y se despejan los demás.',
        substitution: latexLines(equations),
        result: `${u.map((x, i) => `u_{${i + 1}} = ${x.toLatex()}`).join(',\\ ')};\\quad ${v.map((x, j) => `v_{${j + 1}} = ${x.toLatex()}`).join(',\\ ')}`,
      },
      {
        title: 'Evaluar las celdas no básicas',
        explanation:
          'Para cada celda no básica se calcula uᵢ + vⱼ − cᵢⱼ: cuánto bajaría el costo por cada unidad que se enviara por ella. Si ninguna es positiva, la solución es óptima.',
        substitution: latexLines(
          evaluations.map(
            (e) =>
              `(${e.i + 1},${e.j + 1}):\\ ${u[e.i]!.toLatex()} + ${v[e.j]!.toLatex()} - ${b.costs[e.i]![e.j]!.toLatex()} = ${e.value.toLatex()}`,
          ),
        ),
        result: best
          ? `x_{${best.i + 1}${best.j + 1}} \\ \\text{entra } (${best.value.toLatex()})`
          : '\\text{Ninguna es positiva: la solución es óptima}',
      },
    ];

    if (!best) {
      tables.push(
        allocationTable(b, allocation, `iteracion-${k}`, `Tabla ${k} (óptima)`, { u, v }),
      );
      steps.push({ title: `Iteración ${k + 1}: prueba de optimalidad`, children });
      if (evaluations.some((e) => e.value.isZero())) {
        notices.push({
          level: 'info',
          message:
            'Hay celdas no básicas con uᵢ + vⱼ − cᵢⱼ = 0: existen soluciones óptimas alternativas con el mismo costo.',
        });
      }
      const cost = totalCost(b, allocation);
      steps.push({
        title: 'Solución óptima',
        substitution: costLatex(b, allocation),
        result: `Z^* = ${cost.toLatex()}`,
      });
      return {
        ok: true,
        value: {
          cost: cost.toNumber(),
          initialCost: initialCost.toNumber(),
          iterations: k,
          allocation: [...allocation.entries()].map(([key, q]) => {
            const [i, j] = parseKey(key);
            return { from: i + 1, to: j + 1, quantity: q.toNumber() };
          }),
          balanced: b.dummy === null,
        },
        summary: [
          { label: 'Costo mínimo', value: `Z^* = ${cost.toLatex()}`, emphasis: true },
          {
            label: 'Envíos óptimos',
            value: [...allocation.entries()]
              .filter(([, q]) => !q.isZero())
              .map(([key, q]) => {
                const [i, j] = parseKey(key);
                return `x_{${i + 1}${j + 1}} = ${q.toLatex()}`;
              })
              .join(',\\ '),
          },
          { label: 'Costo inicial', value: `Z_0 = ${initialCost.toLatex()}` },
          { label: 'Iteraciones', value: String(k) },
        ],
        ...emptyTrace(),
        steps,
        tables,
        notices,
      };
    }

    const loop = findLoop(allocation, [best.i, best.j]);
    const signs = new Map(
      loop.map((c, idx) => [cellKey(c[0], c[1]), idx % 2 === 0 ? ('+' as const) : ('-' as const)]),
    );
    const minus = loop.filter((_, idx) => idx % 2 === 1);
    const theta = minus.reduce(
      (t, c) => {
        const q = allocation.get(cellKey(c[0], c[1]))!;
        return t === null || q.lt(t) ? q : t;
      },
      null as Rational | null,
    )!;
    const leaving = minus.find((c) => allocation.get(cellKey(c[0], c[1]))!.eq(theta))!;
    tables.push(
      allocationTable(b, allocation, `iteracion-${k}`, `Tabla ${k}`, {
        u,
        v,
        entering: [best.i, best.j],
        loop: signs,
      }),
    );
    children.push(
      {
        title: 'Ciclo de la celda que entra',
        explanation:
          'Desde la celda que entra se recorre un ciclo cerrado por celdas básicas, cambiando de fila y de columna en cada esquina. Las esquinas alternan los signos +, −, +, −…',
        result:
          loop
            .map((c, idx) => `(${c[0] + 1},${c[1] + 1})^{${idx % 2 === 0 ? '+' : '-'}}`)
            .join(' \\to ') + ` \\to (${best.i + 1},${best.j + 1})`,
      },
      {
        title: 'Cantidad que se mueve (θ)',
        explanation:
          'θ es la menor asignación de las esquinas con signo −. Se suma en las esquinas + y se resta en las −; la básica que queda en 0 sale de la base.',
        substitution: `\\theta = \\min\\{${minus.map((c) => allocation.get(cellKey(c[0], c[1]))!.toLatex()).join(',\\ ')}\\}`,
        result: `\\theta = ${theta.toLatex()},\\quad x_{${leaving[0] + 1}${leaving[1] + 1}} \\ \\text{sale}`,
      },
    );
    const next: Allocation = new Map(allocation);
    loop.forEach((c, idx) => {
      const keyC = cellKey(c[0], c[1]);
      const current = next.get(keyC) ?? Rational.ZERO;
      next.set(keyC, idx % 2 === 0 ? current.add(theta) : current.sub(theta));
    });
    next.delete(cellKey(leaving[0], leaving[1]));
    const before = totalCost(b, allocation);
    allocation = next;
    children.push({
      title: 'Nuevo costo',
      explanation: 'El costo baja en θ veces el valor de la celda que entró.',
      substitution: `${before.toLatex()} - ${theta.toLatex()} \\times ${best.value.toLatex()}`,
      result: `Z = ${totalCost(b, allocation).toLatex()}`,
    });
    steps.push({ title: `Iteración ${k + 1}`, children });
  }
  return {
    ok: false,
    error: { code: 'max-iterations', message: 'Se alcanzó el máximo de iteraciones.' },
    ...emptyTrace(),
    steps,
    tables,
  };
}

export const modi: Calculator<ModiInput, ModiValue, ModiErrorCode> = {
  meta: {
    id: 'metodo-de-multiplicadores',
    title: 'Método de los multiplicadores',
    summary: 'Mejora una solución de transporte hasta la de costo mínimo.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 5.3.2, Ejemplo 5.3-5 (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'winston-1994' },
    ],
  },
  inputSchema: modiInputSchema,
  // Taha, ejemplo 5.3-5: SunRay Transport desde la esquina noroeste.
  example: { ...sunRay, initial: 'esquina-noroeste' },
  solve: solveModi,
};
