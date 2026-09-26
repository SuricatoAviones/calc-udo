/**
 * Método húngaro para el modelo de asignación (Taha, sec. 5.4.1):
 *
 * 1. Si la matriz no es cuadrada se completa con filas o columnas ficticias de costo 0; si se
 *    maximiza, se trabaja con (máximo − cᵢⱼ).
 * 2. Se resta el mínimo de cada fila y luego el de cada columna.
 * 3. Si se puede asignar un cero por fila y por columna, esa es la asignación óptima. Si no, se
 *    cubren todos los ceros con el menor número de líneas, se resta el menor valor descubierto θ
 *    de las celdas descubiertas y se suma en las cubiertas dos veces. Se repite.
 *
 * El número mínimo de líneas es el tamaño del máximo emparejamiento entre ceros (teorema de
 * König), que se calcula con caminos aumentantes.
 */
import { z } from 'zod';
import { latexLines } from '@/lib/math/format';
import { Rational } from '@/lib/math/rational';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type ResultTable,
  type Step,
} from '../types';
import { MAX_SIDE } from './transport';

export const assignmentInputSchema = z.object({
  costs: z
    .array(
      z.array(
        z
          .number({ error: 'Completa todos los costos.' })
          .refine(Number.isFinite, 'Los costos deben ser números finitos.'),
      ),
    )
    .min(1, 'Agrega al menos una fila.')
    .max(MAX_SIDE, `El máximo es ${MAX_SIDE} filas.`)
    .superRefine((m, ctx) => {
      const n = m[0]?.length ?? 0;
      if (n < 1 || n > MAX_SIDE || m.some((row) => row.length !== n)) {
        ctx.addIssue({ code: 'custom', message: 'La matriz debe ser rectangular (hasta 8 × 8).' });
      }
    }),
  sense: z.enum(['min', 'max'], { error: 'Elige si se minimiza o se maximiza.' }),
});

export type AssignmentInput = z.infer<typeof assignmentInputSchema>;

export interface AssignmentValue {
  total: number;
  /** Columna asignada a cada fila original (1-indexada), o `null` si va a una ficticia. */
  assignment: (number | null)[];
  iterations: number;
}

export type AssignmentErrorCode = 'max-iterations';

const MAX_ITERATIONS = 30;

/** Máximo emparejamiento entre filas y columnas con cero (caminos aumentantes de Kuhn). */
function maxMatching(zero: (i: number, j: number) => boolean, n: number): number[] {
  const matchCol = new Array<number>(n).fill(-1);
  const tryRow = (i: number, seen: boolean[]): boolean => {
    for (let j = 0; j < n; j++) {
      if (!zero(i, j) || seen[j]) continue;
      seen[j] = true;
      if (matchCol[j] === -1 || tryRow(matchCol[j]!, seen)) {
        matchCol[j] = i;
        return true;
      }
    }
    return false;
  };
  for (let i = 0; i < n; i++) tryRow(i, new Array<boolean>(n).fill(false));
  return matchCol;
}

/** Cubierta mínima de ceros (König): filas no alcanzadas y columnas alcanzadas. */
function minimumCover(zero: (i: number, j: number) => boolean, n: number, matchCol: number[]) {
  const matchRow = new Array<number>(n).fill(-1);
  matchCol.forEach((i, j) => {
    if (i >= 0) matchRow[i] = j;
  });
  const rowSeen = new Array<boolean>(n).fill(false);
  const colSeen = new Array<boolean>(n).fill(false);
  const queue = matchRow.flatMap((j, i) => (j === -1 ? [i] : []));
  queue.forEach((i) => (rowSeen[i] = true));
  while (queue.length > 0) {
    const i = queue.shift()!;
    for (let j = 0; j < n; j++) {
      if (!zero(i, j) || colSeen[j]) continue;
      colSeen[j] = true;
      const next = matchCol[j]!;
      if (next >= 0 && !rowSeen[next]) {
        rowSeen[next] = true;
        queue.push(next);
      }
    }
  }
  return {
    rows: rowSeen.map((seen) => !seen),
    cols: colSeen,
  };
}

export function solveAssignment(
  input: AssignmentInput,
): CalculatorResult<AssignmentValue, AssignmentErrorCode> {
  const original = input.costs.map((row) => row.map(Rational.fromNumber));
  const m = original.length;
  const k = original[0]!.length;
  const n = Math.max(m, k);
  const rowName = (i: number) => (i < m ? `F${i + 1}` : `F${i + 1}*`);
  const colName = (j: number) => (j < k ? `C${j + 1}` : `C${j + 1}*`);
  const steps: Step[] = [];
  const tables: ResultTable[] = [];

  let c: Rational[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => original[i]?.[j] ?? Rational.ZERO),
  );
  const matrixTable = (id: string, title: string, mark?: (i: number, j: number) => string) => ({
    id,
    title,
    columns: [
      { key: 'row', header: '', format: 'text' as const },
      ...Array.from({ length: n }, (_, j) => ({
        key: `c${j}`,
        header: `\\text{${colName(j)}}`,
        format: 'latex' as const,
      })),
    ],
    rows: c.map((row, i) => ({
      row: rowName(i),
      ...Object.fromEntries(row.map((v, j) => [`c${j}`, mark ? mark(i, j) : v.toLatex()])),
    })),
  });

  if (m !== k) {
    steps.push({
      title: 'Completar la matriz',
      explanation: `La matriz es ${m} × ${k}: se agrega${Math.abs(m - k) > 1 ? 'n' : ''} ${Math.abs(m - k)} ${m < k ? 'fila' : 'columna'}${Math.abs(m - k) > 1 ? 's' : ''} ficticia${Math.abs(m - k) > 1 ? 's' : ''} (marcada${Math.abs(m - k) > 1 ? 's' : ''} con *) de costo 0 para que sea cuadrada.`,
    });
  }
  if (input.sense === 'max') {
    const top = c.flat().reduce((a, b) => (b.gt(a) ? b : a));
    c = c.map((row) => row.map((v) => top.sub(v)));
    steps.push({
      title: 'Convertir a minimización',
      explanation:
        'Para maximizar se resta cada valor del mayor de la matriz: la asignación que minimiza estas «pérdidas de oportunidad» maximiza el valor original.',
      formula: `c'_{ij} = ${top.toLatex()} - c_{ij}`,
    });
  }
  tables.push(matrixTable('matriz-inicial', 'Matriz inicial'));

  const rowMins = c.map((row) => row.reduce((a, b) => (b.lt(a) ? b : a)));
  c = c.map((row, i) => row.map((v) => v.sub(rowMins[i]!)));
  steps.push({
    title: 'Restar el mínimo de cada fila',
    substitution: rowMins.map((v, i) => `${rowName(i)}:\\ ${v.toLatex()}`).join(',\\quad '),
  });
  const colMins = c[0]!.map((_, j) => c.map((row) => row[j]!).reduce((a, b) => (b.lt(a) ? b : a)));
  c = c.map((row) => row.map((v, j) => v.sub(colMins[j]!)));
  steps.push({
    title: 'Restar el mínimo de cada columna',
    substitution: colMins.map((v, j) => `${colName(j)}:\\ ${v.toLatex()}`).join(',\\quad '),
  });
  tables.push(matrixTable('reducida', 'Matriz reducida'));

  let iterations = 0;
  let matchCol: number[] = [];
  for (; iterations < MAX_ITERATIONS; iterations++) {
    const zero = (i: number, j: number) => c[i]![j]!.isZero();
    matchCol = maxMatching(zero, n);
    const size = matchCol.filter((i) => i >= 0).length;
    if (size === n) {
      steps.push({
        title:
          iterations === 0 ? 'Prueba de optimalidad' : `Prueba de optimalidad (${iterations + 1})`,
        explanation: `Se necesitan ${n} líneas para cubrir todos los ceros: se puede asignar un cero en cada fila y cada columna.`,
      });
      break;
    }
    const cover = minimumCover(zero, n, matchCol);
    const uncovered: Rational[] = [];
    c.forEach((row, i) =>
      row.forEach((v, j) => {
        if (!cover.rows[i] && !cover.cols[j]) uncovered.push(v);
      }),
    );
    const theta = uncovered.reduce((a, b) => (b.lt(a) ? b : a));
    const lines = [
      ...cover.rows.flatMap((on, i) => (on ? [rowName(i)] : [])),
      ...cover.cols.flatMap((on, j) => (on ? [colName(j)] : [])),
    ];
    tables.push(
      matrixTable(
        `cubierta-${iterations}`,
        `Ceros cubiertos con ${size} líneas (${lines.join(', ')})`,
        (i, j) => {
          const v = c[i]![j]!.toLatex();
          const covered = (cover.rows[i] ? 1 : 0) + (cover.cols[j] ? 1 : 0);
          return covered === 0
            ? v
            : covered === 2
              ? `\\underline{\\overline{${v}}}`
              : `\\overline{${v}}`;
        },
      ),
    );
    c = c.map((row, i) =>
      row.map((v, j) => {
        const covered = (cover.rows[i] ? 1 : 0) + (cover.cols[j] ? 1 : 0);
        return covered === 0 ? v.sub(theta) : covered === 2 ? v.add(theta) : v;
      }),
    );
    steps.push({
      title: `Ajuste ${iterations + 1}`,
      explanation: `Bastan ${size} líneas (${lines.join(', ')}) para cubrir todos los ceros, menos que ${n}: todavía no hay asignación completa. Se resta el menor valor descubierto θ de las celdas descubiertas y se suma en las intersecciones de dos líneas.`,
      substitution: `\\theta = \\min\\{${uncovered.map((v) => v.toLatex()).join(',\\ ')}\\}`,
      result: `\\theta = ${theta.toLatex()}`,
    });
    tables.push(matrixTable(`ajuste-${iterations}`, `Matriz después del ajuste ${iterations + 1}`));
  }
  if (iterations >= MAX_ITERATIONS) {
    return {
      ok: false,
      error: { code: 'max-iterations', message: 'Se alcanzó el máximo de iteraciones.' },
      ...emptyTrace(),
      steps,
      tables,
    };
  }

  const rowOf = new Array<number>(n).fill(-1);
  matchCol.forEach((i, j) => {
    if (i >= 0) rowOf[i] = j;
  });
  tables.push(
    matrixTable('asignacion', 'Asignación óptima (ceros elegidos)', (i, j) =>
      rowOf[i] === j ? `\\boxed{${c[i]![j]!.toLatex()}}` : c[i]![j]!.toLatex(),
    ),
  );
  const pairs = rowOf.flatMap((j, i) => (i < m && j < k ? [{ i, j, cost: original[i]![j]! }] : []));
  const total = pairs.reduce((s, p) => s.add(p.cost), Rational.ZERO);
  steps.push({
    title: 'Asignación óptima',
    explanation: `Se elige un cero en cada fila y columna. El ${input.sense === 'max' ? 'valor' : 'costo'} total se calcula con la matriz original${n > Math.min(m, k) && m !== k ? '; lo asignado a una fila o columna ficticia queda sin asignar' : ''}.`,
    substitution: latexLines(
      pairs.map((p) => `${rowName(p.i)} \\to ${colName(p.j)}:\\ ${p.cost.toLatex()}`),
    ),
    result: `\\text{Total} = ${pairs.map((p) => p.cost.toLatex()).join(' + ')} = ${total.toLatex()}`,
  });

  return {
    ok: true,
    value: {
      total: total.toNumber(),
      assignment: Array.from({ length: m }, (_, i) => (rowOf[i]! < k ? rowOf[i]! + 1 : null)),
      iterations,
    },
    summary: [
      {
        label: input.sense === 'max' ? 'Valor máximo' : 'Costo mínimo',
        value: total.toLatex(),
        emphasis: true,
      },
      {
        label: 'Asignación',
        value: pairs
          .map((p) => `\\text{${rowName(p.i)}} \\to \\text{${colName(p.j)}}`)
          .join(',\\ '),
      },
      { label: 'Ajustes', value: String(iterations) },
    ],
    ...emptyTrace(),
    steps,
    tables,
  };
}

export const hungarian: Calculator<AssignmentInput, AssignmentValue, AssignmentErrorCode> = {
  meta: {
    id: 'metodo-hungaro',
    title: 'Método húngaro',
    summary: 'Resuelve problemas de asignación de costo mínimo (o de valor máximo).',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 5.4.1, Ejemplos 5.4-1 y 5.4-2 (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'winston-1994' },
    ],
  },
  inputSchema: assignmentInputSchema,
  // Taha, ejemplo 5.4-1: los tres hijos de Joe Klyne (filas) y tres tareas (columnas).
  example: {
    costs: [
      [15, 10, 9],
      [9, 15, 10],
      [10, 12, 8],
    ],
    sense: 'min',
  },
  solve: solveAssignment,
};
