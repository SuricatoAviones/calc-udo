/**
 * Equivalencia lógica (Tucker y Joyanes; Muñoz, Lógica simbólica elemental). Dos proposiciones
 * A y B son equivalentes (A ≡ B) si tienen el mismo valor de verdad en todas las filas de su
 * tabla, es decir, si A ↔ B es una tautología. Si coinciden con alguna ley conocida (De Morgan,
 * implicación, distributividad…) se nombra la ley.
 */
import { z } from 'zod';
import { latexLines } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import {
  assignments,
  columnLatex,
  evaluate,
  formulaField,
  formulaLatex,
  matchSchemas,
  parseFormula,
  schema,
  subformulas,
  truthTableColumns,
  truthTableRow,
  variablesOf,
  MAX_VARIABLES,
  type Formula,
} from './proposition';
import { readingStep, rowsStep, rulesStep } from './tablas-de-verdad';

export const equivalenceInputSchema = z
  .object({
    left: formulaField('la primera proposición'),
    right: formulaField('la segunda proposición'),
  })
  .superRefine((v, ctx) => {
    const a = parseFormula(v.left);
    const b = parseFormula(v.right);
    if (
      typeof a !== 'string' &&
      typeof b !== 'string' &&
      variablesOf([a, b]).length > MAX_VARIABLES
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['right'],
        message: `Entre las dos proposiciones usa a lo sumo ${MAX_VARIABLES} variables.`,
      });
    }
  });
export type EquivalenceInput = z.infer<typeof equivalenceInputSchema>;

export interface EquivalenceValue {
  equivalent: boolean;
  /** Filas (desde 1) en las que las proposiciones difieren. */
  differentRows: number[];
  /** Ley reconocida, si la hay. */
  law: string | null;
}

export type EquivalenceErrorCode = 'invalid-formula';

/** Leyes del programa de la asignatura (Unidad III, 2.1.7), en ambos sentidos. */
const LAWS: { name: string; left: string; right: string }[] = [
  { name: 'Identidad', left: 'p ∧ V', right: 'p' },
  { name: 'Identidad', left: 'p ∨ F', right: 'p' },
  { name: 'Conmutatividad', left: 'p ∧ q', right: 'q ∧ p' },
  { name: 'Conmutatividad', left: 'p ∨ q', right: 'q ∨ p' },
  { name: 'Asociatividad', left: '(p ∧ q) ∧ r', right: 'p ∧ (q ∧ r)' },
  { name: 'Asociatividad', left: '(p ∨ q) ∨ r', right: 'p ∨ (q ∨ r)' },
  { name: 'Distributividad', left: 'p ∧ (q ∨ r)', right: '(p ∧ q) ∨ (p ∧ r)' },
  { name: 'Distributividad', left: 'p ∨ (q ∧ r)', right: '(p ∨ q) ∧ (p ∨ r)' },
  { name: 'Ley de De Morgan', left: '¬(p ∧ q)', right: '¬p ∨ ¬q' },
  { name: 'Ley de De Morgan', left: '¬(p ∨ q)', right: '¬p ∧ ¬q' },
  { name: 'Ley de la implicación', left: 'p → q', right: '¬p ∨ q' },
  { name: 'Contrarrecíproca (contraposición)', left: 'p → q', right: '¬q → ¬p' },
  { name: 'Ley de la bicondicionalidad', left: 'p ↔ q', right: '(p → q) ∧ (q → p)' },
  { name: 'Doble negación', left: '¬¬p', right: 'p' },
  { name: 'Ley del tercero excluido', left: 'p ∨ ¬p', right: 'V' },
  { name: 'Ley de la contradicción', left: 'p ∧ ¬p', right: 'F' },
  { name: 'Idempotencia', left: 'p ∧ p', right: 'p' },
  { name: 'Idempotencia', left: 'p ∨ p', right: 'p' },
  { name: 'Absorción', left: 'p ∧ (p ∨ q)', right: 'p' },
  { name: 'Absorción', left: 'p ∨ (p ∧ q)', right: 'p' },
];

export function recognizeLaw(a: Formula, b: Formula): { name: string; statement: string } | null {
  for (const law of LAWS) {
    const l = schema(law.left);
    const r = schema(law.right);
    if (matchSchemas([l, r], [a, b]) || matchSchemas([l, r], [b, a])) {
      return { name: law.name, statement: `${formulaLatex(l)} \\equiv ${formulaLatex(r)}` };
    }
  }
  return null;
}

export function solveEquivalence(
  input: EquivalenceInput,
): CalculatorResult<EquivalenceValue, EquivalenceErrorCode> {
  const a = parseFormula(input.left);
  const b = parseFormula(input.right);
  if (typeof a === 'string' || typeof b === 'string') {
    return {
      ok: false,
      error: {
        code: 'invalid-formula',
        message: `No se pudo leer la ${typeof a === 'string' ? 'primera' : 'segunda'} proposición: ${typeof a === 'string' ? a : b}.`,
      },
      ...emptyTrace(),
    };
  }
  const variables = variablesOf([a, b]);
  const rows = assignments(variables);
  const iff: Formula = { type: 'bin', op: 'iff', left: a, right: b };
  const columns = subformulas([a, b]);
  // Las constantes solas también llevan columna; luego va la comparación A ↔ B.
  for (const f of [a, b]) if (f.type === 'const') columns.push(f);
  columns.push(iff);
  const colA = rows.map((values) => evaluate(a, values));
  const colB = rows.map((values) => evaluate(b, values));
  const differentRows = colA.flatMap((v, i) => (v !== colB[i] ? [i + 1] : []));
  const equivalent = differentRows.length === 0;
  const law = equivalent ? recognizeLaw(a, b) : null;
  const A = formulaLatex(a);
  const B = formulaLatex(b);

  const steps: Step[] = [
    readingStep('Primera proposición (A)', a),
    readingStep('Segunda proposición (B)', b),
    rowsStep(variables),
  ];
  const rules = rulesStep([iff]);
  if (rules) steps.push(rules);
  steps.push(
    {
      title: 'Columnas de A y de B',
      explanation:
        'Se construye la tabla con las variables de ambas proposiciones y se evalúa cada una fila por fila.',
      result: latexLines([`A:\\quad ${columnLatex(colA)}`, `B:\\quad ${columnLatex(colB)}`]),
    },
    {
      title: 'Comparación',
      explanation: equivalent
        ? `Las columnas coinciden en las ${rows.length} filas, así que A ↔ B es una tautología.`
        : `Las columnas difieren en ${differentRows.length === 1 ? 'la fila' : 'las filas'} ${differentRows.join(', ')}: A ↔ B es F allí, así que no es una tautología.`,
      formula: 'A \\equiv B \\iff A \\leftrightarrow B \\text{ es tautología}',
      result: equivalent ? `${A} \\equiv ${B}` : `${A} \\not\\equiv ${B}`,
    },
  );
  if (law) {
    steps.push({
      title: 'Ley reconocida',
      explanation: `La equivalencia es un caso de: ${law.name}.`,
      result: law.statement,
    });
  }

  return {
    ok: true,
    value: { equivalent, differentRows, law: law?.name ?? null },
    summary: [
      {
        label: equivalent ? 'Son equivalentes' : 'No son equivalentes',
        value: equivalent ? `${A} \\equiv ${B}` : `${A} \\not\\equiv ${B}`,
        emphasis: true,
      },
      equivalent
        ? {
            label: 'Ley',
            value: law ? `\\text{${law.name}}` : '\\text{(no es una ley de la lista)}',
          }
        : { label: 'Filas en que difieren', value: differentRows.join(',\\ ') },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'tabla-de-verdad',
        title: 'Tabla de verdad de A, B y A ↔ B',
        columns: truthTableColumns(variables, columns),
        rows: rows.map((values) => truthTableRow(variables, columns, values)),
      },
    ],
  };
}

export const logicalEquivalence: Calculator<
  EquivalenceInput,
  EquivalenceValue,
  EquivalenceErrorCode
> = {
  meta: {
    id: 'equivalencia-logica',
    title: 'Equivalencia lógica',
    summary: 'Comprueba con una tabla de verdad si dos proposiciones son equivalentes.',
    citations: [
      { sourceId: 'tucker-joyanes-2000' },
      { sourceId: 'munoz-1996' },
      { sourceId: 'figerman-1998' },
    ],
  },
  inputSchema: equivalenceInputSchema,
  // Ley de De Morgan, una de las leyes de equivalencia del programa (Unidad III, 2.1.7).
  example: { left: '¬(p ∧ q)', right: '¬p ∨ ¬q' },
  solve: solveEquivalence,
};
