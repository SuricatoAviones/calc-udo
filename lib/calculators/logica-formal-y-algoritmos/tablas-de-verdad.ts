/**
 * Tabla de verdad de una proposición compuesta (Tucker y Joyanes; Muñoz, Lógica simbólica
 * elemental). Se evalúa cada subfórmula, de adentro hacia afuera, en las 2ⁿ combinaciones de
 * valores de las n variables, y la columna final clasifica la proposición:
 *
 *   tautología     V en todas las filas
 *   contradicción  F en todas las filas
 *   contingencia   V en unas y F en otras
 */
import { z } from 'zod';
import { latexLines } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import {
  assignments,
  columnLatex,
  connectiveRules,
  evaluate,
  formulaField,
  formulaLatex,
  parseFormula,
  subformulas,
  truthTableColumns,
  truthTableRow,
  variablesOf,
  type Formula,
} from './proposition';

export const truthTableInputSchema = z.object({ formula: formulaField('una proposición') });
export type TruthTableInput = z.infer<typeof truthTableInputSchema>;

export type Classification = 'tautologia' | 'contradiccion' | 'contingencia';

export interface TruthTableValue {
  variables: string[];
  /** Valor de la proposición en cada fila, de arriba abajo. */
  column: boolean[];
  classification: Classification;
}

export type TruthTableErrorCode = 'invalid-formula';

export const CLASSIFICATION_NAMES: Record<Classification, string> = {
  tautologia: 'Tautología',
  contradiccion: 'Contradicción',
  contingencia: 'Contingencia',
};

export function classify(column: boolean[]): Classification {
  if (column.every(Boolean)) return 'tautologia';
  if (column.every((v) => !v)) return 'contradiccion';
  return 'contingencia';
}

const CONNECTIVE_NAMES = {
  and: 'la conjunción',
  or: 'la disyunción',
  xor: 'la disyunción exclusiva',
  implies: 'el condicional',
  iff: 'el bicondicional',
};

/** Paso común: cómo se leyó la proposición y cuál es su conector principal. */
export function readingStep(title: string, f: Formula): Step {
  const main =
    f.type === 'bin'
      ? ` Su conector principal es ${CONNECTIVE_NAMES[f.op]}.`
      : f.type === 'not'
        ? ' Su conector principal es la negación.'
        : '';
  return {
    title,
    explanation: `Se aplica la jerarquía de los conectores (¬, luego ∧, luego ∨ y ⊕, luego →, y al final ↔) y se agregan los paréntesis que indica.${main}`,
    result: formulaLatex(f),
  };
}

/** Paso común: variables y número de filas. */
export function rowsStep(variables: string[]): Step {
  const n = variables.length;
  return {
    title: 'Variables y número de filas',
    explanation:
      n === 0
        ? 'La proposición no tiene variables: basta una fila.'
        : `Con n variables hay 2ⁿ combinaciones de valores. Se listan de todas V a todas F: la primera variable alterna en bloques de ${2 ** (n - 1)} filas, la siguiente en bloques de la mitad, y la última alterna en cada fila.`,
    result:
      n === 0
        ? '1 \\text{ fila}'
        : `${variables.join(',\\ ')}:\\quad 2^{${n}} = ${2 ** n} \\text{ filas}`,
  };
}

/** Paso común: reglas de los conectores que aparecen. */
export function rulesStep(formulas: Formula[]): Step | null {
  const rules = connectiveRules(formulas);
  return rules.length === 0
    ? null
    : {
        title: 'Reglas de los conectores',
        explanation: 'Cada columna se llena con la regla de su conector principal.',
        result: latexLines(rules),
      };
}

export function solveTruthTable(
  input: TruthTableInput,
): CalculatorResult<TruthTableValue, TruthTableErrorCode> {
  const f = parseFormula(input.formula);
  if (typeof f === 'string') {
    return {
      ok: false,
      error: { code: 'invalid-formula', message: `No se pudo leer la proposición: ${f}.` },
      ...emptyTrace(),
    };
  }
  const variables = variablesOf([f]);
  const rows = assignments(variables);
  const subs = subformulas([f]);
  // Si la proposición es solo una constante, también lleva su columna.
  const columns = f.type === 'const' ? [f] : subs;
  const column = rows.map((values) => evaluate(f, values));
  const classification = classify(column);
  const trueRows = column.flatMap((v, i) => (v ? [i + 1] : []));

  const steps: Step[] = [readingStep('Lectura de la proposición', f), rowsStep(variables)];
  const rules = rulesStep([f]);
  if (rules) steps.push(rules);
  if (subs.length > 0) {
    steps.push({
      title: 'Columnas de la tabla',
      explanation:
        'Se evalúan las subfórmulas de adentro hacia afuera; cada una usa columnas ya calculadas. La última es la proposición completa.',
      children: subs.map((sub, k) => ({
        title: `Columna ${k + 1}`,
        result: `${formulaLatex(sub)}:\\quad ${columnLatex(rows.map((values) => evaluate(sub, values)))}`,
      })),
    });
  }
  const verdict: Record<Classification, string> = {
    tautologia: `Es una tautología: la columna final es V en las ${rows.length} filas.`,
    contradiccion: `Es una contradicción: la columna final es F en las ${rows.length} filas.`,
    contingencia: `Es una contingencia: es V en ${trueRows.length} de las ${rows.length} filas (filas ${trueRows.join(', ')}) y F en las demás.`,
  };
  steps.push({
    title: 'Clasificación',
    explanation: verdict[classification],
    result: `\\text{${CLASSIFICATION_NAMES[classification]}}`,
  });

  return {
    ok: true,
    value: { variables, column, classification },
    summary: [
      {
        label: 'Clasificación',
        value: `\\text{${CLASSIFICATION_NAMES[classification]}}`,
        emphasis: true,
      },
      { label: 'Columna final', value: columnLatex(column) },
      { label: 'Filas verdaderas', value: `${trueRows.length} \\text{ de } ${rows.length}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'tabla-de-verdad',
        title: 'Tabla de verdad',
        columns: truthTableColumns(variables, columns),
        rows: rows.map((values) => truthTableRow(variables, columns, values)),
      },
    ],
  };
}

export const truthTable: Calculator<TruthTableInput, TruthTableValue, TruthTableErrorCode> = {
  meta: {
    id: 'tablas-de-verdad',
    title: 'Tablas de verdad',
    summary: 'Construye la tabla de verdad de una proposición y la clasifica.',
    citations: [
      { sourceId: 'tucker-joyanes-2000' },
      { sourceId: 'munoz-1996' },
      { sourceId: 'figerman-1998' },
    ],
  },
  inputSchema: truthTableInputSchema,
  // El modus ponendo ponens escrito como una sola proposición: [(p → q) ∧ p] → q es tautología.
  example: { formula: '[(p → q) ∧ p] → q' },
  solve: solveTruthTable,
};
