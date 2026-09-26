/**
 * Traza de los algoritmos de ordenamiento elementales sobre un arreglo a₁…aₙ (Tucker y Joyanes):
 *
 *   burbuja    compara pares vecinos y los intercambia si están desordenados; tras la pasada k,
 *              los k mayores ya están al final. Con bandera: se detiene si una pasada no
 *              intercambia nada.
 *   selección  en la pasada i busca el menor de aᵢ…aₙ y lo intercambia con aᵢ
 *   inserción  inserta aᵢ en su lugar dentro de a₁…aᵢ₋₁ (ya ordenado), desplazando a la
 *              derecha los mayores
 *
 * En orden descendente se invierten las comparaciones.
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import { listField, listLatex, pseudocode } from './algorithms';

export const MAX_SORT_LENGTH = 20;

export const sortInputSchema = z.object({
  list: listField(2, MAX_SORT_LENGTH),
  method: z.enum(['burbuja', 'seleccion', 'insercion'], { error: 'Elige el algoritmo.' }),
  order: z.enum(['ascendente', 'descendente'], { error: 'Elige el orden.' }),
});
export type SortInput = z.infer<typeof sortInputSchema>;
export type SortMethod = SortInput['method'];

export interface SortValue {
  sorted: number[];
  comparisons: number;
  /** Intercambios (burbuja, selección) o desplazamientos (inserción). */
  moves: number;
  passes: number;
  /** Lista tras cada pasada. */
  states: number[][];
}

export type SortErrorCode = 'invalid-list';

interface Pass {
  list: number[];
  comparisons: number;
  moves: number;
  explanation: string;
  /** Posiciones (desde 0) que se resaltan como parte ya ordenada. */
  bold: (i: number) => boolean;
}

const f = formatNumber;

function bubble(a: number[], outOfOrder: (x: number, y: number) => boolean): Pass[] {
  const passes: Pass[] = [];
  const n = a.length;
  for (let k = 1; k <= n - 1; k++) {
    const swaps: string[] = [];
    for (let j = 0; j < n - k; j++) {
      if (outOfOrder(a[j]!, a[j + 1]!)) {
        swaps.push(`${f(a[j]!)} ↔ ${f(a[j + 1]!)}`);
        [a[j], a[j + 1]] = [a[j + 1]!, a[j]!];
      }
    }
    passes.push({
      list: [...a],
      comparisons: n - k,
      moves: swaps.length,
      explanation:
        swaps.length === 0
          ? `Se compararon los ${n - k} pares vecinos de a1 a a${n - k + 1} y ninguno estaba desordenado: la lista ya está ordenada y el algoritmo termina.`
          : `Se compararon los ${n - k} pares vecinos de a1 a a${n - k + 1}. Intercambios: ${swaps.join(', ')}. Ahora a${n - k + 1} = ${f(a[n - k]!)} está en su lugar definitivo.`,
      bold: (i) => i >= n - k,
    });
    if (swaps.length === 0) break;
  }
  return passes;
}

function selection(a: number[], before: (x: number, y: number) => boolean, word: string): Pass[] {
  const passes: Pass[] = [];
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let m = i;
    for (let j = i + 1; j < n; j++) if (before(a[j]!, a[m]!)) m = j;
    const chosen = a[m]!;
    const swapped = m !== i;
    const current = a[i]!;
    if (swapped) [a[i], a[m]] = [a[m]!, a[i]!];
    passes.push({
      list: [...a],
      comparisons: n - 1 - i,
      moves: swapped ? 1 : 0,
      explanation: swapped
        ? `El ${word} de a${i + 1} … a${n} es ${f(chosen)} (posición ${m + 1}); se intercambia con a${i + 1} = ${f(current)}.`
        : `El ${word} de a${i + 1} … a${n} es ${f(chosen)}, que ya está en la posición ${i + 1}: no hay intercambio.`,
      bold: (k) => k <= i,
    });
  }
  return passes;
}

function insertion(a: number[], outOfOrder: (x: number, y: number) => boolean): Pass[] {
  const passes: Pass[] = [];
  const n = a.length;
  for (let i = 1; i < n; i++) {
    const key = a[i]!;
    let j = i - 1;
    let comparisons = 0;
    const shifted: number[] = [];
    while (j >= 0) {
      comparisons++;
      if (!outOfOrder(a[j]!, key)) break;
      shifted.push(a[j]!);
      a[j + 1] = a[j]!;
      j--;
    }
    a[j + 1] = key;
    passes.push({
      list: [...a],
      comparisons,
      moves: shifted.length,
      explanation:
        shifted.length === 0
          ? `Se inserta ${f(key)}: ya está en su lugar respecto de a1 … a${i}, no se desplaza nada.`
          : `Se inserta ${f(key)}: se ${shifted.length === 1 ? 'desplaza' : 'desplazan'} ${shifted.map((v) => f(v)).join(', ')} una posición a la derecha y ${f(key)} queda en la posición ${j + 2}.`,
      bold: (k) => k <= i,
    });
  }
  return passes;
}

function code(method: SortMethod, op: string): string {
  if (method === 'burbuja') {
    return pseudocode([
      [0, '**para** k \\leftarrow 1 **hasta** n - 1 **hacer**'],
      [1, '\\mathit{hubo} \\leftarrow \\text{falso}'],
      [1, '**para** j \\leftarrow 1 **hasta** n - k **hacer**'],
      [
        2,
        `**si** a_j ${op} a_{j+1} **entonces** \\text{intercambiar } a_j,\\ a_{j+1};\\ \\mathit{hubo} \\leftarrow \\text{verdadero}`,
      ],
      [1, '**fin para**'],
      [1, '**si no** \\mathit{hubo} **entonces** \\text{terminar}'],
      [0, '**fin para**'],
    ]);
  }
  if (method === 'seleccion') {
    const inverse = op === '>' ? '<' : '>';
    return pseudocode([
      [0, '**para** i \\leftarrow 1 **hasta** n - 1 **hacer**'],
      [1, 'm \\leftarrow i'],
      [1, '**para** j \\leftarrow i + 1 **hasta** n **hacer**'],
      [2, `**si** a_j ${inverse} a_m **entonces** m \\leftarrow j`],
      [1, '**fin para**'],
      [1, '**si** m \\ne i **entonces** \\text{intercambiar } a_i,\\ a_m'],
      [0, '**fin para**'],
    ]);
  }
  return pseudocode([
    [0, '**para** i \\leftarrow 2 **hasta** n **hacer**'],
    [1, '\\mathit{clave} \\leftarrow a_i;\\ j \\leftarrow i - 1'],
    [1, `**mientras** j \\ge 1 **y** a_j ${op} \\mathit{clave} **hacer**`],
    [2, 'a_{j+1} \\leftarrow a_j;\\ j \\leftarrow j - 1'],
    [1, '**fin mientras**'],
    [1, 'a_{j+1} \\leftarrow \\mathit{clave}'],
    [0, '**fin para**'],
  ]);
}

const INTRO: Record<SortMethod, string> = {
  burbuja:
    'En cada pasada se recorren los pares vecinos y se intercambian los que están desordenados; así el extremo de la parte sin ordenar «sube» hasta su lugar. Si una pasada no hace intercambios, la lista ya está ordenada.',
  seleccion:
    'En la pasada i se busca el extremo (menor o mayor, según el orden) de la parte sin ordenar y se intercambia con aᵢ. Siempre hace n(n − 1)/2 comparaciones.',
  insercion:
    'La parte izquierda se mantiene ordenada; en cada pasada se toma el siguiente elemento (la clave) y se inserta en su lugar, desplazando a la derecha los que deben ir después.',
};

const NAMES: Record<SortMethod, string> = {
  burbuja: 'burbuja',
  seleccion: 'selección',
  insercion: 'inserción',
};

export function solveSort(input: SortInput): CalculatorResult<SortValue, SortErrorCode> {
  const { values, invalid } = parseDataList(input.list);
  if (invalid.length > 0 || values.length < 2) {
    return {
      ok: false,
      error: { code: 'invalid-list', message: 'La lista debe tener al menos dos números.' },
      ...emptyTrace(),
    };
  }
  const ascending = input.order === 'ascendente';
  const outOfOrder = (x: number, y: number) => (ascending ? x > y : x < y);
  const before = (x: number, y: number) => (ascending ? x < y : x > y);
  const a = [...values];
  const passes =
    input.method === 'burbuja'
      ? bubble(a, outOfOrder)
      : input.method === 'seleccion'
        ? selection(a, before, ascending ? 'menor' : 'mayor')
        : insertion(a, outOfOrder);
  const comparisons = passes.reduce((s, p) => s + p.comparisons, 0);
  const moves = passes.reduce((s, p) => s + p.moves, 0);
  const moveName = input.method === 'insercion' ? 'desplazamientos' : 'intercambios';

  const steps: Step[] = [
    {
      title: `Algoritmo de ${NAMES[input.method]}`,
      explanation: INTRO[input.method],
      formula: code(input.method, ascending ? '>' : '<'),
      result: `${listLatex(values)},\\quad n = ${values.length}`,
    },
    ...passes.map((p, k) => ({
      title: `Pasada ${k + 1}`,
      explanation: p.explanation,
      result: listLatex(p.list, { bold: p.bold }),
    })),
    {
      title: 'Resultado',
      explanation: `Lista ordenada en forma ${input.order} tras ${passes.length} ${passes.length === 1 ? 'pasada' : 'pasadas'}, ${comparisons} comparaciones y ${moves} ${moveName}.`,
      result: listLatex(a),
    },
  ];

  return {
    ok: true,
    value: {
      sorted: a,
      comparisons,
      moves,
      passes: passes.length,
      states: passes.map((p) => p.list),
    },
    summary: [
      { label: 'Lista ordenada', value: listLatex(a), emphasis: true },
      { label: 'Comparaciones', value: String(comparisons) },
      {
        label: input.method === 'insercion' ? 'Desplazamientos' : 'Intercambios',
        value: String(moves),
      },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'pasadas',
        title: 'Estado de la lista tras cada pasada',
        columns: [
          { key: 'pass', header: '\\text{Pasada}', format: 'text' },
          { key: 'list', header: '\\text{Lista}', format: 'latex' },
          { key: 'comparisons', header: '\\text{Comp.}' },
          {
            key: 'moves',
            header: input.method === 'insercion' ? '\\text{Desplaz.}' : '\\text{Interc.}',
          },
        ],
        rows: [
          { pass: 'inicial', list: listLatex(values), comparisons: null, moves: null },
          ...passes.map((p, k) => ({
            pass: String(k + 1),
            list: listLatex(p.list, { bold: p.bold }),
            comparisons: p.comparisons,
            moves: p.moves,
          })),
        ],
      },
    ],
  };
}

export const sortAlgorithms: Calculator<SortInput, SortValue, SortErrorCode> = {
  meta: {
    id: 'algoritmos-de-ordenamiento',
    title: 'Traza de algoritmos de ordenamiento',
    summary: 'Ejecuta paso a paso algoritmos de ordenamiento sobre una lista.',
    citations: [{ sourceId: 'tucker-joyanes-2000' }],
  },
  inputSchema: sortInputSchema,
  // Arreglo de la figura 2.2 de Cormen et al. (Introduction to Algorithms, 3.ª ed.).
  example: { list: '5 2 4 6 1 3', method: 'burbuja', order: 'ascendente' },
  solve: solveSort,
};
