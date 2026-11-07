/**
 * Traza de los algoritmos de búsqueda en un arreglo a₁…aₙ (Tucker y Joyanes):
 *
 *   secuencial  recorre el arreglo desde a₁ hasta encontrar x o agotarlo (hasta n comparaciones)
 *   binaria     en un arreglo ordenado, compara x con el elemento central y descarta la mitad
 *               que no puede contenerlo (a lo sumo ⌊log₂ n⌋ + 1 comparaciones)
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import { listField, listLatex, num, pseudocode } from './algorithms';

export const MAX_SEARCH_LENGTH = 40;

export const searchInputSchema = z.object({
  list: listField(1, MAX_SEARCH_LENGTH),
  target: z.number({ error: 'Escribe el valor que se busca.' }),
  method: z.enum(['secuencial', 'binaria'], { error: 'Elige el algoritmo.' }),
});
export type SearchInput = z.infer<typeof searchInputSchema>;

export interface SearchValue {
  found: boolean;
  /** Posición (desde 1) donde se encontró, o `null`. */
  position: number | null;
  comparisons: number;
}

export type SearchErrorCode = 'invalid-list' | 'not-sorted';

const SEQUENTIAL_CODE = pseudocode([
  [0, String.raw`i \leftarrow 1`],
  [0, String.raw`**mientras** i \le n **y** a_i \ne x **hacer**`],
  [1, String.raw`i \leftarrow i + 1`],
  [0, '**fin mientras**'],
  [0, String.raw`**si** i \le n **entonces** \text{encontrado en la posición } i`],
  [0, String.raw`**si no** \text{no encontrado}`],
]);

const BINARY_CODE = pseudocode([
  [0, String.raw`\mathit{bajo} \leftarrow 1;\ \mathit{alto} \leftarrow n`],
  [0, String.raw`**mientras** \mathit{bajo} \le \mathit{alto} **hacer**`],
  [1, String.raw`\mathit{c} \leftarrow \lfloor (\mathit{bajo} + \mathit{alto}) / 2 \rfloor`],
  [1, String.raw`**si** x = a_c **entonces** \text{encontrado en la posición } c`],
  [1, String.raw`**si no, si** x < a_c **entonces** \mathit{alto} \leftarrow c - 1`],
  [1, String.raw`**si no** \mathit{bajo} \leftarrow c + 1`],
  [0, '**fin mientras**'],
  [0, String.raw`\text{no encontrado}`],
]);

function sequential(a: number[], x: number) {
  const rows: { i: number; value: number; equal: string }[] = [];
  let position: number | null = null;
  for (let i = 0; i < a.length; i++) {
    const equal = a[i] === x;
    rows.push({ i: i + 1, value: a[i]!, equal: equal ? 'sí' : 'no' });
    if (equal) {
      position = i + 1;
      break;
    }
  }
  return { rows, position };
}

function binary(a: number[], x: number) {
  const rows: {
    iteration: number;
    low: number;
    high: number;
    center: number;
    value: number;
    decision: string;
  }[] = [];
  const children: Step[] = [];
  let low = 1;
  let high = a.length;
  let position: number | null = null;
  while (low <= high) {
    const c = Math.floor((low + high) / 2);
    const ac = a[c - 1]!;
    let decision: string;
    let explanation: string;
    if (x === ac) {
      decision = String.raw`${num(x)} = ${num(ac)} \Rightarrow \text{encontrado}`;
      explanation = `x es igual a a${c}: se encontró.`;
      position = c;
    } else if (x < ac) {
      decision = String.raw`${num(x)} < ${num(ac)} \Rightarrow \mathit{alto} = ${c - 1}`;
      explanation = `x es menor que a${c}: solo puede estar a la izquierda, así que alto = c − 1.`;
    } else {
      decision = String.raw`${num(x)} > ${num(ac)} \Rightarrow \mathit{bajo} = ${c + 1}`;
      explanation = `x es mayor que a${c}: solo puede estar a la derecha, así que bajo = c + 1.`;
    }
    rows.push({ iteration: rows.length + 1, low, high, center: c, value: ac, decision });
    children.push({
      title: `Iteración ${rows.length}`,
      explanation,
      substitution: String.raw`c = \left\lfloor \frac{${low} + ${high}}{2} \right\rfloor = ${c},\quad a_{${c}} = ${num(ac)}`,
      result: `${listLatex(a, { bold: (i) => i >= low - 1 && i <= high - 1, boxed: [c - 1] })}`,
    });
    if (position !== null) break;
    if (x < ac) high = c - 1;
    else low = c + 1;
  }
  return { rows, children, position };
}

export function solveSearch(input: SearchInput): CalculatorResult<SearchValue, SearchErrorCode> {
  const { values: a, invalid } = parseDataList(input.list);
  const x = input.target;
  if (invalid.length > 0 || a.length === 0) {
    return {
      ok: false,
      error: { code: 'invalid-list', message: 'La lista debe tener al menos un número.' },
      ...emptyTrace(),
    };
  }
  const steps: Step[] = [];
  if (input.method === 'secuencial') {
    steps.push({
      title: 'Algoritmo',
      explanation:
        'Se compara x con cada elemento, de izquierda a derecha, hasta encontrarlo o llegar al final. No necesita que la lista esté ordenada.',
      formula: SEQUENTIAL_CODE,
      result: String.raw`n = ${a.length},\quad x = ${num(x)}`,
    });
    const { rows, position } = sequential(a, x);
    steps.push({
      title: 'Recorrido',
      explanation:
        position === null
          ? `Se comparó x con los ${a.length} elementos y ninguno es igual.`
          : `Se comparó x con a1, a2, … hasta a${position}, que es igual a x.`,
      result: listLatex(a, {
        boxed: position === null ? [] : [position - 1],
        bold: (i) => i < rows.length,
      }),
    });
    steps.push(resultStep(position, rows.length));
    return success({ found: position !== null, position, comparisons: rows.length }, steps, {
      id: 'recorrido',
      title: 'Comparaciones',
      columns: [
        { key: 'i', header: 'i' },
        { key: 'value', header: 'a_i' },
        { key: 'equal', header: String.raw`a_i = ${num(x)}\,?`, format: 'text' },
      ],
      rows,
    });
  }

  steps.push({
    title: 'Algoritmo',
    explanation:
      'Solo sirve con la lista ordenada de menor a mayor. En cada iteración se compara x con el elemento central del tramo [bajo, alto] y se descarta la mitad donde no puede estar.',
    formula: BINARY_CODE,
    result: String.raw`n = ${a.length},\quad x = ${num(x)}`,
  });
  const unsorted = a.findIndex((v, i) => i > 0 && v < a[i - 1]!);
  if (unsorted > 0) {
    return {
      ok: false,
      error: {
        code: 'not-sorted',
        message: `La búsqueda binaria necesita la lista ordenada de menor a mayor, pero a${unsorted + 1} = ${a[unsorted]} es menor que a${unsorted} = ${a[unsorted - 1]}. Ordénala primero o usa la búsqueda secuencial.`,
      },
      ...emptyTrace(),
      steps,
    };
  }
  const { rows, children, position } = binary(a, x);
  steps.push({
    title: 'Iteraciones',
    explanation:
      'En negrita, el tramo donde todavía puede estar x; en el recuadro, el elemento central.',
    children,
  });
  steps.push(resultStep(position, rows.length));
  return success({ found: position !== null, position, comparisons: rows.length }, steps, {
    id: 'iteraciones',
    title: 'Iteraciones de la búsqueda binaria',
    columns: [
      { key: 'iteration', header: String.raw`\text{Iter.}` },
      { key: 'low', header: String.raw`\mathit{bajo}` },
      { key: 'high', header: String.raw`\mathit{alto}` },
      { key: 'center', header: 'c' },
      { key: 'value', header: 'a_c' },
      { key: 'decision', header: String.raw`\text{Decisión}`, format: 'latex' },
    ],
    rows,
  });
}

function resultStep(position: number | null, comparisons: number): Step {
  return {
    title: 'Resultado',
    explanation:
      position === null
        ? `x no está en la lista. Se hicieron ${comparisons} ${comparisons === 1 ? 'comparación' : 'comparaciones'}.`
        : `x está en la posición ${position}. Se hicieron ${comparisons} ${comparisons === 1 ? 'comparación' : 'comparaciones'}.`,
    result:
      position === null
        ? String.raw`\text{no encontrado}`
        : String.raw`\text{posición } ${position}`,
  };
}

function success(
  value: SearchValue,
  steps: Step[],
  table: CalculatorResult<SearchValue>['tables'][number],
): CalculatorResult<SearchValue, SearchErrorCode> {
  return {
    ok: true,
    value,
    summary: [
      {
        label: value.found ? 'Encontrado' : 'Resultado',
        value: value.found
          ? String.raw`\text{posición } ${value.position}`
          : String.raw`\text{no está en la lista}`,
        emphasis: true,
      },
      { label: 'Comparaciones', value: String(value.comparisons) },
    ],
    ...emptyTrace(),
    steps,
    tables: [table],
  };
}

export const searchAlgorithms: Calculator<SearchInput, SearchValue, SearchErrorCode> = {
  meta: {
    id: 'algoritmos-de-busqueda',
    title: 'Traza de algoritmos de búsqueda',
    summary: 'Ejecuta paso a paso algoritmos de búsqueda sobre una lista.',
    citations: [{ sourceId: 'tucker-joyanes-2000' }],
  },
  inputSchema: searchInputSchema,
  // Lista ordenada de 10 elementos; 23 se encuentra en la 3.ª iteración (verificado a mano).
  example: { list: '2 5 8 12 16 23 38 56 72 91', target: 23, method: 'binaria' },
  solve: solveSearch,
};
