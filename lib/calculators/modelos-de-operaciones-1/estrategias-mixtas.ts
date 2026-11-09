/**
 * Juegos de suma cero con estrategias mixtas (Hillier & Lieberman, sec. 14.3–14.4; Taha,
 * sec. 13.4.2):
 *
 * 1. Se eliminan las estrategias dominadas (una estrategia es dominada si otra es siempre al
 *    menos igual de buena y alguna vez mejor).
 * 2. Si la matriz reducida tiene punto de silla, la solución es en estrategias puras.
 * 3. Si a un jugador le quedan dos estrategias, se usa el método gráfico: con A en 2 × n,
 *
 *      E_j(x₁) = a_{1j} x₁ + a_{2j}(1 − x₁),   v = máx_{0≤x₁≤1} mín_j E_j(x₁)
 *
 *    y la estrategia de B combina las dos rectas que forman la envolvente en el punto maximin de
 *    modo que la combinación sea horizontal. Con B en m × 2 el razonamiento es simétrico
 *    (mínimo de la envolvente superior).
 *
 * Los juegos que tras la reducción siguen siendo mayores que 2 × n y m × 2 se resuelven con
 * programación lineal (otra calculadora del mismo tema).
 */
import { z } from 'zod';
import {
  formatNumber,
  toLatexNumber,
  toLatexOperand,
  toLatexRational,
  toRational,
  TEX,
} from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Notice,
  type Series,
  type Step,
} from '../types';
import {
  analyzeMinimax,
  colName,
  payoffMatrixField,
  payoffMatrixLatex,
  rowName,
  strategyList,
  toleranceFor,
  type PayoffMatrix,
} from './games';

export const mixedStrategiesInputSchema = z.object({ payoff: payoffMatrixField });
export type MixedStrategiesInput = z.infer<typeof mixedStrategiesInputSchema>;

export type MixedStrategiesMethod = 'punto-de-silla' | 'grafico-a' | 'grafico-b';

export interface MixedStrategiesValue {
  value: number;
  /** Probabilidades de cada estrategia de A y de B (0 para las eliminadas). */
  strategyA: number[];
  strategyB: number[];
  /** Estrategias que quedan después de eliminar las dominadas (índices originales). */
  reducedRows: number[];
  reducedCols: number[];
  method: MixedStrategiesMethod;
}

export type MixedStrategiesErrorCode = 'too-large';

type Result = CalculatorResult<MixedStrategiesValue, MixedStrategiesErrorCode>;

const n = toLatexNumber;

/** Fracción si el número es un racional sencillo (7/11); si no, decimal. */
function exact(value: number): string {
  const r = toRational(value);
  if (!r || r.denominator === 1) return n(value, 6);
  return String.raw`${r.numerator < 0 ? '-' : ''}\frac{${Math.abs(r.numerator)}}{${r.denominator}}`;
}

function vectorLatex(values: number[]): string {
  return String.raw`\left(${values.map(exact).join(TEX.listSep)}\right)`;
}

// ─── Dominancia ─────────────────────────────────────────────────────────────

interface Reduction {
  rows: number[];
  cols: number[];
  steps: Step[];
}

function eliminateDominated(a: PayoffMatrix): Reduction {
  const tol = toleranceFor(a);
  let rows = a.map((_, i) => i);
  let cols = a[0]!.map((_, j) => j);
  const steps: Step[] = [];
  const rowVector = (i: number) =>
    String.raw`\left(${cols.map((j) => n(a[i]![j]!)).join(TEX.listSep)}\right)`;
  const colVector = (j: number) =>
    String.raw`\left(${rows.map((i) => n(a[i]![j]!)).join(TEX.listSep)}\right)`;

  // `high` domina a `low` si nunca es menor y alguna vez es mayor. Para A (maximiza) la fila
  // dominante es la de pagos altos; para B (minimiza), la columna de pagos bajos. Si dos
  // estrategias son idénticas (`tie`), se elimina la segunda.
  const atLeast = (high: number[], low: number[], tie: boolean) =>
    high.every((v, k) => v >= low[k]! - tol) && (tie || high.some((v, k) => v > low[k]! + tol));

  for (;;) {
    const row =
      rows.length > 1
        ? firstDominated(rows, (r, k) =>
            atLeast(
              cols.map((j) => a[k]![j]!),
              cols.map((j) => a[r]![j]!),
              k < r,
            ),
          )
        : null;
    if (row) {
      const { dominated: r, by: k } = row;
      steps.push({
        title: `A${r + 1} está dominada por A${k + 1}`,
        explanation: `Contra cualquier estrategia de B, A${k + 1} le paga a A al menos lo mismo que A${r + 1}, así que A nunca usaría A${r + 1}.`,
        substitution: String.raw`${rowName(k)} = ${rowVector(k)} \ \ge\ ${rowName(r)} = ${rowVector(r)}`,
      });
      rows = rows.filter((i) => i !== r);
      continue;
    }
    const col =
      cols.length > 1
        ? firstDominated(cols, (c, l) =>
            atLeast(
              rows.map((i) => a[i]![c]!),
              rows.map((i) => a[i]![l]!),
              l < c,
            ),
          )
        : null;
    if (!col) break;
    const { dominated: c, by: l } = col;
    steps.push({
      title: `B${c + 1} está dominada por B${l + 1}`,
      explanation: `B quiere pagar lo menos posible: contra cualquier estrategia de A, con B${l + 1} paga a lo sumo lo mismo que con B${c + 1}, así que B nunca usaría B${c + 1}.`,
      substitution: String.raw`${colName(l)} = ${colVector(l)} \ \le\ ${colName(c)} = ${colVector(c)}`,
    });
    cols = cols.filter((j) => j !== c);
  }
  return { rows, cols, steps };
}

/** La primera estrategia de `list` dominada por otra de la lista, y la que la domina. */
function firstDominated(
  list: number[],
  dominates: (dominated: number, by: number) => boolean,
): { dominated: number; by: number } | null {
  for (const dominated of list) {
    const by = list.find((k) => k !== dominated && dominates(dominated, k));
    if (by !== undefined) return { dominated, by };
  }
  return null;
}

// ─── Método gráfico ─────────────────────────────────────────────────────────

interface Line {
  /** Índice original de la estrategia del oponente que define la recta. */
  index: number;
  slope: number;
  intercept: number;
}

const evaluate = (line: Line, x: number) => line.slope * x + line.intercept;

function lineLatex(line: Line, variable: string): string {
  const { slope, intercept } = line;
  if (slope === 0) return n(intercept, 6);
  if (intercept === 0) return slopeTerm(slope, variable);
  const magnitude = Math.abs(slope) === 1 ? variable : n(Math.abs(slope), 6) + variable;
  return `${n(intercept, 6)} ${slope < 0 ? '-' : '+'} ${magnitude}`;
}

/** `x`, `-x` o `2.5x`: el coeficiente 1 no se escribe. */
function slopeTerm(slope: number, variable: string): string {
  if (slope === 1) return variable;
  return slope === -1 ? `-${variable}` : `${n(slope, 6)}${variable}`;
}

/** Puntos candidatos: los extremos y las intersecciones de cada par de rectas en [0, 1]. */
function candidates(lines: Line[]): number[] {
  const xs = [0, 1];
  for (let i = 0; i < lines.length; i++)
    for (let k = i + 1; k < lines.length; k++) {
      const a = lines[i]!;
      const b = lines[k]!;
      if (a.slope === b.slope) continue;
      const x = (b.intercept - a.intercept) / (a.slope - b.slope);
      if (x > 0 && x < 1) xs.push(x);
    }
  return [...new Set(xs)].sort((p, q) => p - q);
}

interface GraphicalSolution {
  /** Probabilidad óptima de la primera estrategia del jugador que tiene dos. */
  p: number;
  value: number;
  /** Probabilidades del oponente, por índice original. */
  opponent: Map<number, number>;
  /** El óptimo del jugador con dos estrategias no es único (tramo horizontal). */
  flat: boolean;
  active: Line[];
  steps: Step[];
  series: Series;
}

/** Varias rectas pasan por el óptimo: el oponente tiene estrategias óptimas alternativas. */
function alternativesMessage(point: string, player: 'A' | 'B', active: Line[]): string {
  const lines = active.map((l) => player + (l.index + 1)).join(', ');
  return `Por el punto ${point} pasan ${active.length} rectas (${lines}): ${player} tiene estrategias óptimas alternativas. Se muestra la que combina las dos rectas que forman la envolvente.`;
}

interface PlayerNames {
  variable: string;
  own: [string, string];
  opponent: (k: number) => string;
  opponentPlain: (k: number) => string;
}

/**
 * Punto maximin (A) o minimax (B) y la mezcla del oponente: sobre una recta horizontal, en el
 * corte de la recta creciente con la decreciente, o en un extremo del intervalo.
 */
function optimumStep(
  lines: { horizontal?: Line; rising?: Line; falling?: Line; active: Line[] },
  { maximize, p, best }: { maximize: boolean; p: number; best: number },
  names: PlayerNames,
): { step: Step; opponent: Map<number, number> } {
  const { horizontal, rising, falling, active } = lines;
  const { variable } = names;
  const opponent = new Map<number, number>();
  const envelopeName = maximize ? 'inferior' : 'superior';
  const extreme = maximize ? 'máximo' : 'mínimo';
  const title = `Punto ${maximize ? 'maximin' : 'minimax'}`;
  const formula = maximize
    ? String.raw`v = \max_{0 \le ${variable} \le 1} \min_j E_j(${variable})`
    : String.raw`v = \min_{0 \le ${variable} \le 1} \max_i E_i(${variable})`;
  const result = String.raw`${variable}^* = ${exact(p)}, \qquad v = ${exact(best)}`;
  if (horizontal) {
    opponent.set(horizontal.index, 1);
    return {
      opponent,
      step: {
        title,
        explanation: `La envolvente ${envelopeName} alcanza su ${extreme} sobre la recta horizontal de ${names.opponentPlain(horizontal.index)}.`,
        formula,
        result,
      },
    };
  }
  if (!rising || !falling) {
    // Óptimo en un extremo: una sola recta activa basta (el juego tenía punto de silla).
    const line = rising ?? falling ?? active[0]!;
    opponent.set(line.index, 1);
    return {
      opponent,
      step: {
        title,
        explanation: `La envolvente ${envelopeName} alcanza su ${extreme} en un extremo del intervalo.`,
        result,
      },
    };
  }
  const x = (falling.intercept - rising.intercept) / (rising.slope - falling.slope);
  const [left, right] = maximize ? [rising, falling] : [falling, rising];
  const worst = maximize
    ? 'máximo de la envolvente inferior (el peor caso de A)'
    : 'mínimo de la envolvente superior (el peor caso de B)';
  const atOptimum = `(${exact(p)})`;
  const wRising = -falling.slope / (rising.slope - falling.slope);
  opponent.set(rising.index, wRising);
  opponent.set(falling.index, 1 - wRising);
  return {
    opponent,
    step: {
      title,
      explanation: `El ${worst} está donde se cortan las rectas de ${names.opponentPlain(left.index)} y ${names.opponentPlain(right.index)}.`,
      formula,
      substitution: String.raw`${lineLatex(left, variable)} = ${lineLatex(right, variable)} \ \Rightarrow\ ${variable} = ${exact(x)}`,
      result: String.raw`${variable}^* = ${exact(p)}, \qquad v = ${lineLatex(left, atOptimum)} = ${exact(best)}`,
    },
  };
}

/**
 * Método gráfico para el jugador que tiene dos estrategias. `maximize`: A (envolvente inferior,
 * se maximiza); si no, B (envolvente superior, se minimiza).
 */
function graphical(
  lines: Line[],
  maximize: boolean,
  tol: number,
  names: PlayerNames,
): GraphicalSolution {
  const envelope = (x: number) =>
    maximize
      ? Math.min(...lines.map((l) => evaluate(l, x)))
      : Math.max(...lines.map((l) => evaluate(l, x)));
  const xs = candidates(lines);
  const values = xs.map(envelope);
  const best = maximize ? Math.max(...values) : Math.min(...values);
  const optimal = xs.filter((_, k) => Math.abs(values[k]! - best) <= tol);
  const p = optimal[0]!;
  const flat = optimal.at(-1)! - p > tol;
  const active = lines.filter((l) => Math.abs(evaluate(l, p) - best) <= tol);
  const { variable } = names;

  const steps: Step[] = [
    {
      title: 'Rectas de pago esperado',
      explanation: `Si ${names.own[0]} se juega con probabilidad ${variable} y ${names.own[1]} con 1 − ${variable}, cada estrategia pura del oponente da una recta de pago esperado para A.`,
      children: lines.map((l) => ({
        title: names.opponentPlain(l.index),
        substitution: String.raw`E_{${names.opponent(l.index)}}(${variable}) = ${n(l.slope + l.intercept)}\,${variable} + ${toLatexOperand(l.intercept)}\,(1 - ${variable})`,
        result: `E_{${names.opponent(l.index)}}(${variable}) = ${lineLatex(l, variable)}`,
      })),
    },
  ];

  // Las dos rectas que forman la envolvente a cada lado del óptimo: la de mayor y la de menor
  // pendiente entre las activas.
  const horizontal = active.find((l) => Math.abs(l.slope) <= tol);
  const rising = active.filter((l) => l.slope > tol).sort((a, b) => b.slope - a.slope)[0];
  const falling = active.filter((l) => l.slope < -tol).sort((a, b) => a.slope - b.slope)[0];
  const envelopeName = maximize ? 'inferior' : 'superior';
  const optimum = optimumStep(
    { horizontal, rising, falling, active },
    { maximize, p, best },
    names,
  );
  const opponent = optimum.opponent;
  steps.push(optimum.step);

  const xsForChart = [...new Set([...xs, 0, 1])].sort((a, b) => a - b);
  const chartVariable = variable === 'x_1' ? 'x₁' : 'y₁';
  const series: Series = {
    id: 'metodo-grafico',
    title: `Método gráfico: pago esperado de A según ${chartVariable}`,
    xLabel: chartVariable,
    yLabel: 'pago esperado',
    label: `Envolvente ${envelopeName}`,
    points: xsForChart.map((x) => ({ x, y: envelope(x) })),
    others: lines.map((l) => ({
      label: names.opponentPlain(l.index),
      points: [
        { x: 0, y: evaluate(l, 0) },
        { x: 1, y: evaluate(l, 1) },
      ],
    })),
  };

  return { p, value: best, opponent, flat, active, steps, series };
}

// ─── Solución ───────────────────────────────────────────────────────────────

export function solveMixedStrategies({ payoff }: MixedStrategiesInput): Result {
  const m = payoff.length;
  const cols = payoff[0]!.length;
  const tol = toleranceFor(payoff);
  const steps: Step[] = [
    {
      title: 'Matriz de pagos',
      explanation:
        'Cada entrada es lo que gana A (filas) y pierde B (columnas). Se busca la probabilidad con que cada jugador debe usar sus estrategias para asegurar el mejor pago esperado ante un oponente racional.',
      result: payoffMatrixLatex(payoff),
    },
  ];

  const reduction = eliminateDominated(payoff);
  const { rows: rr, cols: rc } = reduction;
  steps.push(
    reduction.steps.length > 0
      ? {
          title: 'Eliminar estrategias dominadas',
          explanation:
            'Una estrategia dominada nunca conviene, así que se elimina. Al quitar estrategias de un jugador pueden aparecer nuevas dominancias para el otro, por eso se repite hasta que no quede ninguna.',
          children: reduction.steps,
          result: String.raw`\text{Matriz reducida: } ${payoffMatrixLatex(payoff, rr, rc)}`,
        }
      : {
          title: 'Eliminar estrategias dominadas',
          explanation:
            'Ninguna estrategia está dominada por otra: se trabaja con la matriz completa.',
        },
  );

  const full = (size: number, entries: Map<number, number>) =>
    Array.from({ length: size }, (_, k) => entries.get(k) ?? 0);

  const minimax = analyzeMinimax(payoff, rr, rc);
  const notices: Notice[] = [];

  if (minimax.saddlePoints.length > 0) {
    const [i, j] = minimax.saddlePoints[0]!;
    const v = payoff[i]![j]!;
    steps.push({
      title: 'Punto de silla',
      explanation:
        rr.length === 1 && rc.length === 1
          ? 'La eliminación de estrategias dominadas dejó una sola estrategia a cada jugador: esa es la solución.'
          : 'En la matriz reducida el maximin coincide con el minimax: la solución es en estrategias puras (cada jugador usa una estrategia con probabilidad 1).',
      formula: String.raw`\underline{v} = \max_i \min_j a_{ij} = \min_j \max_i a_{ij} = \overline{v}`,
      result: String.raw`(${rowName(i)}, ${colName(j)}), \qquad v = ${n(v)}`,
    });
    notices.push({
      level: 'info',
      message: 'El juego tiene punto de silla: no hace falta mezclar estrategias.',
    });
    return success(
      {
        value: v,
        strategyA: full(m, new Map([[i, 1]])),
        strategyB: full(cols, new Map([[j, 1]])),
        reducedRows: rr,
        reducedCols: rc,
        method: 'punto-de-silla',
      },
      steps,
      notices,
      [],
    );
  }

  steps.push({
    title: 'Sin punto de silla',
    explanation:
      'En la matriz reducida el maximin es menor que el minimax: hacen falta estrategias mixtas.',
    result: String.raw`\underline{v} = ${n(minimax.maximin)} < v < \overline{v} = ${n(minimax.minimax)}`,
  });

  if (rr.length === 2) {
    const [r1, r2] = rr as [number, number];
    const lines: Line[] = rc.map((j) => ({
      index: j,
      slope: payoff[r1]![j]! - payoff[r2]![j]!,
      intercept: payoff[r2]![j]!,
    }));
    const g = graphical(lines, true, tol, {
      variable: 'x_1',
      own: [`A${r1 + 1}`, `A${r2 + 1}`],
      opponent: colName,
      opponentPlain: (j) => `B${j + 1}`,
    });
    steps.push(...g.steps, opponentStep(g, 'B', colName, lines));
    if (g.flat) {
      notices.push({
        level: 'info',
        message: `El máximo de la envolvente es un tramo horizontal: A tiene infinitas estrategias óptimas (cualquier x₁ del tramo). Se muestra x₁ = ${formatNumber(g.p, 6)}.`,
      });
    }
    if (g.active.length > 2) {
      notices.push({
        level: 'info',
        message: alternativesMessage('maximin', 'B', g.active),
      });
    }
    const strategyA = full(
      m,
      new Map([
        [r1, g.p],
        [r2, 1 - g.p],
      ]),
    );
    const strategyB = full(cols, g.opponent);
    steps.push(solutionStep(strategyA, strategyB, g.value));
    return success(
      {
        value: g.value,
        strategyA,
        strategyB,
        reducedRows: rr,
        reducedCols: rc,
        method: 'grafico-a',
      },
      steps,
      notices,
      [g.series],
    );
  }

  if (rc.length === 2) {
    const [c1, c2] = rc as [number, number];
    const lines: Line[] = rr.map((i) => ({
      index: i,
      slope: payoff[i]![c1]! - payoff[i]![c2]!,
      intercept: payoff[i]![c2]!,
    }));
    const g = graphical(lines, false, tol, {
      variable: 'y_1',
      own: [`B${c1 + 1}`, `B${c2 + 1}`],
      opponent: rowName,
      opponentPlain: (i) => `A${i + 1}`,
    });
    steps.push(...g.steps, opponentStep(g, 'A', rowName, lines));
    if (g.flat) {
      notices.push({
        level: 'info',
        message: `El mínimo de la envolvente es un tramo horizontal: B tiene infinitas estrategias óptimas (cualquier y₁ del tramo). Se muestra y₁ = ${formatNumber(g.p, 6)}.`,
      });
    }
    if (g.active.length > 2) {
      notices.push({
        level: 'info',
        message: alternativesMessage('minimax', 'A', g.active),
      });
    }
    const strategyB = full(
      cols,
      new Map([
        [c1, g.p],
        [c2, 1 - g.p],
      ]),
    );
    const strategyA = full(m, g.opponent);
    steps.push(solutionStep(strategyA, strategyB, g.value));
    return success(
      {
        value: g.value,
        strategyA,
        strategyB,
        reducedRows: rr,
        reducedCols: rc,
        method: 'grafico-b',
      },
      steps,
      notices,
      [g.series],
    );
  }

  return {
    ok: false,
    error: {
      code: 'too-large',
      message: `Después de eliminar las estrategias dominadas quedan ${rr.length} × ${rc.length} estrategias. El método gráfico necesita que un jugador tenga solo dos; este juego se resuelve con programación lineal.`,
    },
    ...emptyTrace(),
    steps,
  };
}

/** Paso con la estrategia del oponente: combinar las rectas activas para que sea horizontal. */
function opponentStep(
  g: GraphicalSolution,
  player: 'A' | 'B',
  name: (k: number) => string,
  lines: Line[],
): Step {
  const used = [...g.opponent.entries()].filter(([, w]) => w > 0);
  if (used.length === 1) {
    const [k] = used[0]!;
    return {
      title: `Estrategia óptima de ${player}`,
      explanation: `${player} usa siempre ${player}${k + 1}: su recta pasa por el punto óptimo sin superarlo${player === 'B' ? ' por encima' : ' por debajo'}, así que asegura el valor v.`,
      result: String.raw`${name(k)} \text{ con probabilidad } 1`,
    };
  }
  const [[k1, w1], [k2, w2]] = used as [[number, number], [number, number]];
  const l1 = lines.find((l) => l.index === k1)!;
  const l2 = lines.find((l) => l.index === k2)!;
  const p1 = `p_{${name(k1)}}`;
  return {
    title: `Estrategia óptima de ${player}`,
    explanation: `Solo las rectas que pasan por el punto óptimo reciben probabilidad positiva. ${player} las combina de modo que la recta resultante sea horizontal (pendiente 0): así el pago esperado es v sin importar lo que haga el otro jugador.`,
    formula: String.raw`${p1}\,(${n(l1.slope, 6)}) + (1 - ${p1})\,(${n(l2.slope, 6)}) = 0`,
    result: String.raw`${p1} = ${exact(w1)}, \qquad p_{${name(k2)}} = ${exact(w2)}`,
  };
}

function solutionStep(strategyA: number[], strategyB: number[], value: number): Step {
  return {
    title: 'Solución del juego',
    explanation: 'Probabilidades para todas las estrategias originales (0 para las eliminadas).',
    result: String.raw`x^* = ${vectorLatex(strategyA)}, \qquad y^* = ${vectorLatex(strategyB)}, \qquad v = ${exact(value)}`,
  };
}

function success(
  value: MixedStrategiesValue,
  steps: Step[],
  notices: Notice[],
  series: Series[],
): Result {
  return {
    ok: true,
    value,
    summary: [
      { label: 'Valor del juego', value: `v = ${toLatexRational(value.value)}`, emphasis: true },
      { label: 'Estrategia óptima de A', value: `x^* = ${vectorLatex(value.strategyA)}` },
      { label: 'Estrategia óptima de B', value: `y^* = ${vectorLatex(value.strategyB)}` },
      {
        label: 'Estrategias que se usan',
        value: String.raw`${strategyList(
          value.strategyA.flatMap((p, i) => (p > 0 ? [i] : [])),
          rowName,
        )} \ \text{contra}\ ${strategyList(
          value.strategyB.flatMap((p, j) => (p > 0 ? [j] : [])),
          colName,
        )}`,
      },
    ],
    ...emptyTrace(),
    steps,
    notices,
    tables: [
      {
        id: 'estrategias',
        title: 'Estrategias óptimas',
        columns: [
          { key: 'player', header: String.raw`\text{Jugador}`, format: 'text' },
          { key: 'strategy', header: String.raw`\text{Estrategia}`, format: 'text' },
          { key: 'probability', header: String.raw`\text{Probabilidad}` },
          { key: 'exact', header: String.raw`\text{Fracción}`, format: 'latex' },
        ],
        rows: [
          ...value.strategyA.map((p, i) => ({
            player: 'A',
            strategy: `A${i + 1}`,
            probability: p,
            exact: exact(p),
          })),
          ...value.strategyB.map((p, j) => ({
            player: 'B',
            strategy: `B${j + 1}`,
            probability: p,
            exact: exact(p),
          })),
        ],
      },
    ],
    series,
  };
}

export const mixedStrategies: Calculator<
  MixedStrategiesInput,
  MixedStrategiesValue,
  MixedStrategiesErrorCode
> = {
  meta: {
    id: 'estrategias-mixtas',
    title: 'Estrategias mixtas (método gráfico)',
    summary: 'Dominancia y método gráfico para juegos de suma cero de 2 × n y m × 2.',
    citations: [
      {
        sourceId: 'hillier-lieberman-2002',
        locator:
          'Sec. 14.2–14.4, variaciones 1 y 3 del problema de la campaña política, figura 14.1 (7.ª ed. en inglés)',
      },
      { sourceId: 'taha', locator: 'Sec. 13.4.2, Ejemplo 13.4-3 (9.ª ed. en inglés)' },
      { sourceId: 'anderson-1993' },
    ],
  },
  inputSchema: mixedStrategiesInputSchema,
  // Hillier & Lieberman, tabla 14.5: variación 3 del problema de la campaña política (miles de
  // votos netos que gana el político 1).
  example: {
    payoff: [
      [0, -2, 2],
      [5, 4, -3],
      [2, 3, -4],
    ],
  },
  solve: solveMixedStrategies,
};
