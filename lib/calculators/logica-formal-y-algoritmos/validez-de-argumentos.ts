/**
 * Validez de un razonamiento (Tucker y Joyanes; Muñoz, Lógica simbólica elemental). Un
 * razonamiento con premisas P₁, …, Pₙ y conclusión C es válido si no hay ninguna fila de la
 * tabla de verdad en la que todas las premisas sean V y la conclusión F; es decir, si
 * (P₁ ∧ … ∧ Pₙ) → C es una tautología. Las filas con todas las premisas V son las «filas
 * críticas». Si el razonamiento tiene una forma conocida (modus ponendo ponens, modus tollendo
 * tollens, silogismo hipotético…) o es una falacia clásica, se nombra.
 */
import { z } from 'zod';
import { latexLines } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import {
  assignments,
  evaluate,
  formulaField,
  formulaLatex,
  matchSchemas,
  MAX_VARIABLES,
  parseFormula,
  schema,
  truth,
  truthTableColumns,
  truthTableRow,
  variablesOf,
  type Formula,
} from './proposition';
import { rowsStep, rulesStep } from './tablas-de-verdad';

const MAX_PREMISES = 6;

/** Premisas separadas por saltos de línea o punto y coma. */
export function splitPremises(text: string): string[] {
  return text
    .split(/[\n;]+/)
    .map((t) => t.trim())
    .filter((t) => t !== '');
}

export const argumentInputSchema = z
  .object({
    premises: z.string({ error: 'Escribe las premisas.' }),
    conclusion: formulaField('la conclusión'),
  })
  .superRefine((v, ctx) => {
    const lines = splitPremises(v.premises);
    if (lines.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['premises'],
        message: 'Escribe al menos una premisa.',
      });
      return;
    }
    if (lines.length > MAX_PREMISES) {
      ctx.addIssue({
        code: 'custom',
        path: ['premises'],
        message: `Usa a lo sumo ${MAX_PREMISES} premisas.`,
      });
      return;
    }
    const parsed: Formula[] = [];
    for (const [k, line] of lines.entries()) {
      const p = parseFormula(line);
      if (typeof p === 'string') {
        ctx.addIssue({
          code: 'custom',
          path: ['premises'],
          message: `No se pudo leer la premisa ${k + 1}: ${p}.`,
        });
        return;
      }
      parsed.push(p);
    }
    const c = parseFormula(v.conclusion);
    if (typeof c !== 'string' && variablesOf([...parsed, c]).length > MAX_VARIABLES) {
      ctx.addIssue({
        code: 'custom',
        path: ['premises'],
        message: `Entre premisas y conclusión usa a lo sumo ${MAX_VARIABLES} variables.`,
      });
    }
  });
export type ArgumentInput = z.infer<typeof argumentInputSchema>;

export interface ArgumentValue {
  valid: boolean;
  /** Filas (desde 1) con todas las premisas V. */
  criticalRows: number[];
  /** Filas críticas con la conclusión F: cada una es un contraejemplo. */
  counterexamples: number[];
  /** Forma reconocida (regla de inferencia o falacia), si la hay. */
  form: string | null;
}

export type ArgumentErrorCode = 'invalid-formula';

/** Reglas de inferencia y falacias clásicas. */
const FORMS: { name: string; premises: string[]; conclusion: string; fallacy?: boolean }[] = [
  { name: 'Modus ponendo ponens', premises: ['p → q', 'p'], conclusion: 'q' },
  { name: 'Modus tollendo tollens', premises: ['p → q', '¬q'], conclusion: '¬p' },
  { name: 'Silogismo hipotético', premises: ['p → q', 'q → r'], conclusion: 'p → r' },
  {
    name: 'Silogismo disyuntivo (modus tollendo ponens)',
    premises: ['p ∨ q', '¬p'],
    conclusion: 'q',
  },
  {
    name: 'Silogismo disyuntivo (modus tollendo ponens)',
    premises: ['p ∨ q', '¬q'],
    conclusion: 'p',
  },
  {
    name: 'Dilema constructivo',
    premises: ['p → q', 'r → s', 'p ∨ r'],
    conclusion: 'q ∨ s',
  },
  { name: 'Simplificación', premises: ['p ∧ q'], conclusion: 'p' },
  { name: 'Simplificación', premises: ['p ∧ q'], conclusion: 'q' },
  { name: 'Adición', premises: ['p'], conclusion: 'p ∨ q' },
  { name: 'Conjunción', premises: ['p', 'q'], conclusion: 'p ∧ q' },
  {
    name: 'Falacia de afirmación del consecuente',
    premises: ['p → q', 'q'],
    conclusion: 'p',
    fallacy: true,
  },
  {
    name: 'Falacia de negación del antecedente',
    premises: ['p → q', '¬p'],
    conclusion: '¬q',
    fallacy: true,
  },
];

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

export function recognizeForm(
  premises: Formula[],
  conclusion: Formula,
): { name: string; fallacy: boolean; statement: string } | null {
  for (const form of FORMS) {
    if (form.premises.length !== premises.length) continue;
    const ps = form.premises.map(schema);
    const c = schema(form.conclusion);
    if (permutations(premises).some((order) => matchSchemas([...ps, c], [...order, conclusion]))) {
      return {
        name: form.name,
        fallacy: form.fallacy ?? false,
        statement: `${ps.map((p) => formulaLatex(p)).join(',\\ ')}\\ \\therefore\\ ${formulaLatex(c)}`,
      };
    }
  }
  return null;
}

export function solveArgument(
  input: ArgumentInput,
): CalculatorResult<ArgumentValue, ArgumentErrorCode> {
  const premises: Formula[] = [];
  for (const [k, line] of splitPremises(input.premises).entries()) {
    const p = parseFormula(line);
    if (typeof p === 'string') {
      return {
        ok: false,
        error: { code: 'invalid-formula', message: `No se pudo leer la premisa ${k + 1}: ${p}.` },
        ...emptyTrace(),
      };
    }
    premises.push(p);
  }
  const conclusion = parseFormula(input.conclusion);
  if (typeof conclusion === 'string' || premises.length === 0) {
    return {
      ok: false,
      error: {
        code: 'invalid-formula',
        message:
          typeof conclusion === 'string'
            ? `No se pudo leer la conclusión: ${conclusion}.`
            : 'Escribe al menos una premisa.',
      },
      ...emptyTrace(),
    };
  }

  const variables = variablesOf([...premises, conclusion]);
  const rows = assignments(variables);
  const criticalRows: number[] = [];
  const counterexamples: number[] = [];
  rows.forEach((values, i) => {
    if (premises.every((p) => evaluate(p, values))) {
      criticalRows.push(i + 1);
      if (!evaluate(conclusion, values)) counterexamples.push(i + 1);
    }
  });
  const valid = counterexamples.length === 0;
  const form = recognizeForm(premises, conclusion);
  const conjunction = premises
    .slice(1)
    .reduce<Formula>((acc, p) => ({ type: 'bin', op: 'and', left: acc, right: p }), premises[0]!);
  const conditional: Formula = { type: 'bin', op: 'implies', left: conjunction, right: conclusion };

  const steps: Step[] = [
    {
      title: 'Premisas y conclusión',
      explanation:
        'Se leen las premisas y la conclusión aplicando la jerarquía de los conectores (¬, ∧, ∨, →, ↔).',
      result: latexLines([
        ...premises.map((p, k) => `P_{${k + 1}}:\\ ${formulaLatex(p)}`),
        `\\therefore\\ C:\\ ${formulaLatex(conclusion)}`,
      ]),
    },
    {
      title: 'Criterio de validez',
      explanation:
        'El razonamiento es válido si es imposible que todas las premisas sean verdaderas y la conclusión falsa. Equivale a que la conjunción de las premisas implique la conclusión en todas las filas.',
      formula: `(P_1 \\land \\cdots \\land P_{${premises.length}}) \\rightarrow C \\text{ es tautología}`,
      result: formulaLatex(conditional),
    },
    rowsStep(variables),
  ];
  const rules = rulesStep([conditional]);
  if (rules) steps.push(rules);
  steps.push({
    title: 'Filas críticas',
    explanation:
      criticalRows.length === 0
        ? 'Ninguna fila hace verdaderas a todas las premisas (son inconsistentes entre sí): el razonamiento es válido, pero de forma trivial.'
        : `En ${criticalRows.length === 1 ? 'la fila' : 'las filas'} ${criticalRows.join(', ')} todas las premisas son V. Se revisa la conclusión en ${criticalRows.length === 1 ? 'ella' : 'cada una'}.`,
    result:
      criticalRows.length === 0
        ? '\\text{sin filas críticas}'
        : latexLines(
            criticalRows.map(
              (r) => `\\text{fila } ${r}:\\ C = \\text{${truth(!counterexamples.includes(r))}}`,
            ),
          ),
  });
  if (form) {
    steps.push({
      title: 'Forma del razonamiento',
      explanation: form.fallacy
        ? `Tiene la forma de la ${form.name.toLowerCase()}: parece válida, pero no lo es.`
        : `Tiene la forma de una regla de inferencia válida: ${form.name}.`,
      result: form.statement,
    });
  }
  steps.push({
    title: 'Conclusión',
    explanation: valid
      ? 'Ninguna fila crítica tiene la conclusión F: el razonamiento es válido.'
      : `En ${counterexamples.length === 1 ? 'la fila' : 'las filas'} ${counterexamples.join(', ')} las premisas son V y la conclusión es F: ${counterexamples.length === 1 ? 'es un contraejemplo' : 'son contraejemplos'}, así que el razonamiento no es válido.`,
    result: valid ? '\\text{Válido}' : '\\text{No válido}',
  });

  const columns = [...premises, conclusion];
  const table = rows.map((values, i) => {
    const row: Record<string, string> = truthTableRow(variables, columns, values);
    row.critical = !criticalRows.includes(i + 1)
      ? '—'
      : counterexamples.includes(i + 1)
        ? 'sí, C = F (contraejemplo)'
        : 'sí, C = V';
    return row;
  });

  return {
    ok: true,
    value: { valid, criticalRows, counterexamples, form: form?.name ?? null },
    summary: [
      {
        label: 'Razonamiento',
        value: valid ? '\\text{Válido}' : '\\text{No válido}',
        emphasis: true,
      },
      ...(form ? [{ label: 'Forma', value: `\\text{${form.name}}` }] : []),
      valid
        ? {
            label: 'Filas críticas',
            value: criticalRows.length === 0 ? '\\text{ninguna}' : criticalRows.join(',\\ '),
          }
        : { label: 'Contraejemplos (filas)', value: counterexamples.join(',\\ ') },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'tabla-de-verdad',
        title: 'Tabla de verdad de premisas y conclusión',
        columns: [
          ...truthTableColumns(variables, columns).map((c, k) =>
            k < variables.length
              ? c
              : {
                  ...c,
                  header:
                    k - variables.length < premises.length
                      ? `P_{${k - variables.length + 1}}: ${c.header}`
                      : `C: ${c.header}`,
                },
          ),
          { key: 'critical', header: '\\text{Fila crítica}', format: 'text' },
        ],
        rows: table,
      },
    ],
  };
}

export const argumentValidity: Calculator<ArgumentInput, ArgumentValue, ArgumentErrorCode> = {
  meta: {
    id: 'validez-de-argumentos',
    title: 'Validez de un razonamiento',
    summary: 'Decide si una conclusión se sigue de las premisas (modus ponens, tollens…).',
    citations: [
      { sourceId: 'tucker-joyanes-2000' },
      { sourceId: 'munoz-1996' },
      { sourceId: 'figerman-1998' },
    ],
  },
  inputSchema: argumentInputSchema,
  // Modus tollendo tollens, uno de los principios del programa (Unidad III, 2.1.6).
  example: { premises: 'p → q\n¬q', conclusion: '¬p' },
  solve: solveArgument,
};
