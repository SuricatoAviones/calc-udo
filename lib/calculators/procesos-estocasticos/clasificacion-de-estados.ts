/**
 * Clasificación de los estados de una cadena de Markov (Taha, sec. 17.3 y 17.6; Hillier &
 * Lieberman, sec. 16.4 y 16.7):
 *
 * - j es accesible desde i si p_ij^(n) > 0 para algún n ≥ 0; i y j se comunican si cada uno es
 *   accesible desde el otro. La comunicación divide los estados en clases.
 * - Una clase es cerrada si de ella no se puede salir: sus estados son recurrentes. Si se puede
 *   salir, sus estados son transitorios. Un estado con p_jj = 1 es absorbente.
 * - El período de un estado es el máximo común divisor de los n con p_jj^(n) > 0 (todos los
 *   estados de una clase tienen el mismo período); con período 1 el estado es aperiódico.
 * - Una cadena es ergódica si todos sus estados son recurrentes, se comunican (una sola clase) y
 *   son aperiódicos.
 *
 * Si hay estados transitorios, con N = transiciones entre transitorios y A = de transitorios a
 * recurrentes: (I − N)⁻¹ da el número esperado de visitas, (I − N)⁻¹·1 el número esperado de
 * transiciones hasta la absorción y (I − N)⁻¹A las probabilidades de absorción (Taha, sec. 17.6).
 */
import { z } from 'zod';
import { toLatexMatrix, toLatexNumber } from '@/lib/math/format';
import { solveLinearSystem } from '@/lib/math/linear-algebra';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type ResultTable,
  type Step,
} from '../types';
import { clean, transitionMatrixField } from './markov';

export const classificationInputSchema = z.object({ P: transitionMatrixField });
export type ClassificationInput = z.infer<typeof classificationInputSchema>;

export type StateKind = 'absorbente' | 'recurrente' | 'transitorio';

export interface StateClassification {
  state: number;
  /** Índice (desde 1) de la clase de comunicación. */
  classIndex: number;
  kind: StateKind;
  /** Período; `null` si el estado no puede volver a sí mismo. */
  period: number | null;
}

export interface CommunicatingClass {
  states: number[];
  closed: boolean;
  period: number | null;
}

export interface AbsorptionAnalysis {
  transient: number[];
  recurrent: number[];
  /** (I − N)⁻¹: visitas esperadas a cada transitorio. */
  fundamental: number[][];
  /** Transiciones esperadas hasta salir de los transitorios, por estado inicial. */
  stepsToAbsorption: number[];
  /** Probabilidad de terminar en cada estado recurrente, por estado inicial transitorio. */
  probabilities: number[][];
  /** Probabilidad de terminar en cada clase cerrada. */
  classProbabilities: number[][];
}

export interface ClassificationValue {
  states: StateClassification[];
  classes: CommunicatingClass[];
  irreducible: boolean;
  ergodic: boolean;
  absorption: AbsorptionAnalysis | null;
}

export type ClassificationErrorCode = 'singular';

type Result = CalculatorResult<ClassificationValue, ClassificationErrorCode>;

const n = toLatexNumber;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** alcanza[i][j]: j es accesible desde i (en 0 o más transiciones). */
function reachability(P: number[][]): boolean[][] {
  const size = P.length;
  const reach = P.map((row, i) => row.map((p, j) => i === j || p > 0));
  for (let k = 0; k < size; k++) {
    for (let i = 0; i < size; i++) {
      if (!reach[i]![k]) continue;
      for (let j = 0; j < size; j++) if (reach[k]![j]) reach[i]![j] = true;
    }
  }
  return reach;
}

/** Período de una clase: mcd de (nivel(u) + 1 − nivel(v)) sobre los arcos internos (BFS). */
function classPeriod(P: number[][], members: number[]): number | null {
  const inClass = new Set(members);
  const level = new Map<number, number>([[members[0]!, 0]]);
  const queue = [members[0]!];
  let d = 0;
  while (queue.length > 0) {
    const u = queue.shift()!;
    P[u]!.forEach((p, v) => {
      if (p <= 0 || !inClass.has(v)) return;
      if (!level.has(v)) {
        level.set(v, level.get(u)! + 1);
        queue.push(v);
      } else {
        d = gcd(d, Math.abs(level.get(u)! + 1 - level.get(v)!));
      }
    });
  }
  return d === 0 ? null : d;
}

/** Inversa por columnas con `solveLinearSystem`, o `null` si es singular. */
function inverse(M: number[][]): number[][] | null {
  const size = M.length;
  const columns: number[][] = [];
  for (let j = 0; j < size; j++) {
    const e = Array.from({ length: size }, (_, i) => (i === j ? 1 : 0));
    const col = solveLinearSystem(M, e);
    if (!col) return null;
    columns.push(col);
  }
  return Array.from({ length: size }, (_, i) => columns.map((col) => clean(col[i]!)));
}

const setLatex = (states: number[]) => `\\{${states.join(', ')}\\}`;

export function solveClassification({ P }: ClassificationInput): Result {
  const size = P.length;
  const reach = reachability(P);
  const steps: Step[] = [
    {
      title: 'Estados accesibles desde cada estado',
      explanation:
        'j es accesible desde i si hay una sucesión de transiciones con probabilidad positiva que lleva de i a j. Se obtiene siguiendo las entradas p_ij > 0 de la matriz.',
      substitution: P.map(
        (_, i) => `${i + 1} \\to ${setLatex(reach[i]!.flatMap((r, j) => (r ? [j + 1] : [])))}`,
      ).join(',\\quad '),
    },
  ];

  // Clases de comunicación.
  const classOf = new Array<number>(size).fill(-1);
  const classes: CommunicatingClass[] = [];
  for (let i = 0; i < size; i++) {
    if (classOf[i]! >= 0) continue;
    const members = Array.from({ length: size }, (_, j) => j).filter(
      (j) => reach[i]![j] && reach[j]![i],
    );
    members.forEach((j) => (classOf[j] = classes.length));
    const closed = members.every((u) => P[u]!.every((p, v) => p <= 0 || members.includes(v)));
    classes.push({
      states: members.map((j) => j + 1),
      closed,
      period: classPeriod(P, members),
    });
  }
  steps.push({
    title: 'Clases de estados que se comunican',
    explanation:
      'Dos estados se comunican si cada uno es accesible desde el otro. Cada clase agrupa estados que se comunican entre sí.',
    result: classes.map((c, k) => `C_{${k + 1}} = ${setLatex(c.states)}`).join(',\\quad '),
  });

  const states: StateClassification[] = Array.from({ length: size }, (_, i) => {
    const cls = classes[classOf[i]!]!;
    const kind: StateKind = !cls.closed
      ? 'transitorio'
      : P[i]![i]! >= 1 - 1e-12
        ? 'absorbente'
        : 'recurrente';
    return { state: i + 1, classIndex: classOf[i]! + 1, kind, period: cls.period };
  });

  steps.push({
    title: 'Clases cerradas y abiertas',
    explanation:
      'Una clase es cerrada si ninguna transición sale de ella: una vez dentro, el proceso no la abandona y sus estados son recurrentes. Si alguna transición sale de la clase, sus estados son transitorios: tarde o temprano se abandonan para siempre. Un estado con p_jj = 1 es absorbente.',
    children: classes.map((c, k) => {
      const exits = c.states.flatMap((s) =>
        P[s - 1]!.flatMap((p, v) =>
          p > 0 && !c.states.includes(v + 1) ? [`p_{${s}${v + 1}} = ${n(p)}`] : [],
        ),
      );
      const absorbing = c.states.length === 1 && states[c.states[0]! - 1]!.kind === 'absorbente';
      return {
        title: `Clase C${k + 1} = {${c.states.join(', ')}}`,
        explanation: c.closed
          ? absorbing
            ? `Cerrada con un solo estado y p_{${c.states[0]}${c.states[0]}} = 1: el estado ${c.states[0]} es absorbente.`
            : 'Cerrada: ninguna transición sale de la clase. Sus estados son recurrentes.'
          : 'Abierta: hay transiciones que salen de la clase y no vuelven. Sus estados son transitorios.',
        result: c.closed
          ? '\\text{recurrente}'
          : `\\text{sale por } ${exits.slice(0, 4).join(',\\ ')}`,
      };
    }),
  });

  steps.push({
    title: 'Período de cada clase',
    explanation:
      'El período es el máximo común divisor de las longitudes de los caminos que regresan a un estado. Se calcula con un recorrido de la clase: el mcd de (nivel de u + 1 − nivel de v) sobre las transiciones u → v dentro de la clase. Período 1 = aperiódico.',
    result: classes
      .map(
        (c, k) =>
          `C_{${k + 1}}: ${c.period === null ? '\\text{sin retorno}' : c.period === 1 ? '\\text{aperiódica}' : `d = ${c.period}`}`,
      )
      .join(',\\quad '),
  });

  const irreducible = classes.length === 1;
  const ergodic = irreducible && classes[0]!.period === 1;
  steps.push({
    title: '¿La cadena es ergódica?',
    explanation: ergodic
      ? 'Todos los estados se comunican (una sola clase, cerrada), son recurrentes y aperiódicos: la cadena es ergódica y tiene probabilidades de estado estable únicas.'
      : irreducible
        ? `Todos los estados se comunican, pero tienen período ${classes[0]!.period}: la cadena es periódica, no ergódica.`
        : `Hay ${classes.length} clases: la cadena no es irreducible, así que no es ergódica.`,
    result: ergodic ? '\\text{ergódica}' : '\\text{no ergódica}',
  });

  // Análisis de absorción.
  const transient = states.filter((s) => s.kind === 'transitorio').map((s) => s.state - 1);
  const recurrent = states.filter((s) => s.kind !== 'transitorio').map((s) => s.state - 1);
  let absorption: AbsorptionAnalysis | null = null;
  const tables: ResultTable[] = [
    {
      id: 'estados',
      title: 'Clasificación de los estados',
      columns: [
        { key: 'state', header: '\\text{Estado}' },
        { key: 'classIndex', header: '\\text{Clase}' },
        { key: 'kind', header: '\\text{Tipo}', format: 'text' },
        { key: 'period', header: '\\text{Período}', format: 'text' },
      ],
      rows: states.map((s): Record<string, CellValue> => ({
        state: s.state,
        classIndex: s.classIndex,
        kind: s.kind,
        period:
          s.period === null ? 'sin retorno' : s.period === 1 ? 'aperiódico' : String(s.period),
      })),
    },
  ];

  if (transient.length > 0) {
    const N = transient.map((i) => transient.map((j) => P[i]![j]!));
    const A = transient.map((i) => recurrent.map((j) => P[i]![j]!));
    const IminusN = N.map((row, i) => row.map((v, j) => (i === j ? 1 : 0) - v));
    const fundamental = inverse(IminusN);
    if (!fundamental) {
      return {
        ok: false,
        error: {
          code: 'singular',
          message: 'La matriz I − N es singular; revisa la matriz de transición.',
        },
        ...emptyTrace(),
        steps,
        tables,
      };
    }
    const stepsToAbsorption = fundamental.map((row) => row.reduce((a, b) => a + b, 0));
    const probabilities = fundamental.map((row) =>
      recurrent.map((_, j) => clean(row.reduce((acc, v, k) => acc + v * A[k]![j]!, 0))),
    );
    const closedClasses = classes.filter((c) => c.closed);
    const classProbabilities = probabilities.map((row) =>
      closedClasses.map((c) =>
        c.states.reduce((acc, s) => acc + row[recurrent.indexOf(s - 1)]!, 0),
      ),
    );
    absorption = {
      transient: transient.map((i) => i + 1),
      recurrent: recurrent.map((i) => i + 1),
      fundamental,
      stepsToAbsorption,
      probabilities,
      classProbabilities,
    };
    const tLabels = transient.map((i) => i + 1).join(', ');
    const rLabels = recurrent.map((i) => i + 1).join(', ');
    steps.push({
      title: 'Análisis de los estados transitorios',
      explanation: `Se reordena P con los transitorios (${tLabels}) primero y los recurrentes (${rLabels}) después: N tiene las transiciones entre transitorios y A las que van de transitorios a recurrentes.`,
      children: [
        {
          title: 'Matrices N y A',
          result: `N = ${toLatexMatrix(N)}, \\qquad A = ${toLatexMatrix(A)}`,
        },
        {
          title: 'Matriz fundamental',
          explanation:
            'El elemento (i, j) es el número esperado de veces que el proceso pasa por el transitorio j si empieza en el transitorio i.',
          formula: '(I - N)^{-1}',
          result: `(I - N)^{-1} = ${toLatexMatrix(fundamental, 4)}`,
        },
        {
          title: 'Transiciones esperadas hasta la absorción',
          formula: '(I - N)^{-1}\\,\\mathbf{1}',
          result: transient
            .map((s, k) => `\\text{desde } ${s + 1}: ${n(stepsToAbsorption[k]!, 6)}`)
            .join(',\\quad '),
        },
        {
          title: 'Probabilidades de absorción',
          explanation:
            'El elemento (i, j) es la probabilidad de que el proceso, empezando en el transitorio i, termine en el estado recurrente j.',
          formula: '(I - N)^{-1} A',
          result: `(I - N)^{-1} A = ${toLatexMatrix(probabilities, 4)}`,
        },
      ],
    });
    tables.push({
      id: 'absorcion',
      title: 'Probabilidad de terminar en cada estado recurrente',
      columns: [
        { key: 'from', header: '\\text{Desde}' },
        ...recurrent.map((j) => ({ key: `r${j}`, header: `\\text{Estado } ${j + 1}` })),
        { key: 'steps', header: '\\text{Transiciones esperadas}' },
      ],
      rows: transient.map((i, k) => ({
        from: i + 1,
        ...Object.fromEntries(recurrent.map((j, c) => [`r${j}`, probabilities[k]![c]!])),
        steps: stepsToAbsorption[k]!,
      })),
    });
  }

  const summary = [
    {
      label: 'Clases',
      value: classes.map((c) => setLatex(c.states)).join(',\\ '),
      emphasis: true,
    },
    { label: 'Cadena', value: ergodic ? '\\text{ergódica}' : '\\text{no ergódica}' },
  ];
  const absorbing = states.filter((s) => s.kind === 'absorbente').map((s) => s.state);
  if (absorbing.length > 0) {
    summary.push({ label: 'Estados absorbentes', value: absorbing.join(',\\ ') });
  }
  if (transient.length > 0) {
    summary.push({
      label: 'Estados transitorios',
      value: transient.map((i) => i + 1).join(',\\ '),
    });
  }

  return {
    ok: true,
    value: { states, classes, irreducible, ergodic, absorption },
    summary,
    ...emptyTrace(),
    steps,
    tables,
  };
}

export const stateClassification: Calculator<
  ClassificationInput,
  ClassificationValue,
  ClassificationErrorCode
> = {
  meta: {
    id: 'clasificacion-de-estados',
    title: 'Clasificación de estados',
    summary: 'Clases, estados recurrentes, transitorios y absorbentes, período y ergodicidad.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Secs. 17.3 y 17.6, Ejemplos 17.3-1, 17.3-2 y 17.6-1 (10.ª ed.)',
      },
      {
        sourceId: 'hillier-lieberman-2002',
        locator: 'Secs. 16.4 y 16.7, clasificación de estados y estados absorbentes (7.ª ed.)',
      },
    ],
  },
  inputSchema: classificationInputSchema,
  // Taha, ejemplo 17.6-1: producción en dos máquinas con inspección; estados s1, i1, s2, i2,
  // desecho (J) y bueno (G).
  example: {
    P: [
      [0, 0.95, 0, 0, 0.05, 0],
      [0.07, 0, 0.9, 0, 0.03, 0],
      [0, 0, 0, 0.95, 0.05, 0],
      [0, 0, 0.07, 0, 0.03, 0.9],
      [0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 1],
    ],
  },
  solve: solveClassification,
};
