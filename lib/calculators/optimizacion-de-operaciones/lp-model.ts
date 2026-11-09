/**
 * Modelo de programación lineal escrito como en el cuaderno:
 *
 *   max z = 5x1 + 4x2
 *   6x1 + 4x2 <= 24
 *   x1 + 2x2 <= 6
 *
 * Todas las variables son no negativas (x ≥ 0); las líneas como «x1, x2 >= 0» se aceptan y se
 * omiten. Cada restricción puede tener variables en ambos lados (0.21x1 <= 0.3x2): se pasan a la
 * izquierda y las constantes a la derecha. Los coeficientes se guardan como racionales exactos.
 */
import { z } from 'zod';
import { Rational } from '@/lib/math/rational';
import { TEX } from '@/lib/math/format';

export type Sense = 'max' | 'min';
export type Relation = '<=' | '>=' | '=';

export interface LpConstraint {
  coefficients: Rational[];
  relation: Relation;
  rhs: Rational;
}

export interface LinearProgram {
  sense: Sense;
  /** Nombres de las variables de decisión en orden natural (x1, x2, …, x10). */
  variables: string[];
  objective: Rational[];
  constraints: LpConstraint[];
}

export type ParsedLp =
  { ok: true; lp: LinearProgram; notices: string[] } | { ok: false; message: string };

export const MAX_VARIABLES = 10;
export const MAX_CONSTRAINTS = 12;

const RESERVED = /^[seR]\d+$/;

interface LinearExpression {
  terms: Map<string, Rational>;
  constant: Rational;
}

/** Normaliza símbolos: −, ≤, ≥, =<, =>, coma decimal, espacios. */
function normalize(text: string): string {
  return text
    .replace(/[−–—]/g, '-')
    .replace(/[≤⩽]|=<|<=/g, '<=')
    .replace(/[≥⩾]|=>|>=/g, '>=')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[·×*]/g, '')
    .replace(/\s+/g, '');
}

/** Expresión lineal «3x1 - x2 + 4» → coeficientes por variable y constante. */
function parseExpression(source: string): LinearExpression | string {
  const text = source;
  if (text === '') return 'falta una expresión';
  const terms = new Map<string, Rational>();
  let constant = Rational.ZERO;
  let i = 0;
  while (i < text.length) {
    let sign = 1;
    if (text[i] === '+' || text[i] === '-') {
      sign = text[i] === '-' ? -1 : 1;
      i++;
    } else if (i > 0) {
      return `falta un signo antes de «${text.slice(i)}»`;
    }
    const term = readTerm(text, i);
    if (typeof term === 'string') return term;
    i = term.end;
    const value = (term.coefficient ?? Rational.ONE).mul(Rational.of(sign));
    if (term.name) terms.set(term.name, (terms.get(term.name) ?? Rational.ZERO).add(value));
    else constant = constant.add(value);
  }
  return { terms, constant };
}

/**
 * Un término sin signo que empieza en `i`: coeficiente (entero, decimal o fracción) y variable,
 * cualquiera de los dos opcional pero no ambos. `end` es la posición siguiente.
 */
function readTerm(
  text: string,
  i: number,
): { coefficient: Rational | null; name: string | null; end: number } | string {
  const numberMatch = /^(\d+(?:\.\d+)?|\.\d+)(?:\/(\d+(?:\.\d+)?))?/.exec(text.slice(i));
  let coefficient: Rational | null = null;
  let end = i;
  if (numberMatch) {
    coefficient = Rational.fromNumber(Number(numberMatch[1]));
    if (numberMatch[2] !== undefined) {
      const den = Rational.fromNumber(Number(numberMatch[2]));
      if (den.isZero()) return 'hay una división entre 0';
      coefficient = coefficient.div(den);
    }
    end += numberMatch[0].length;
  }
  const nameMatch = /^[a-zA-Z]\w*/.exec(text.slice(end));
  if (nameMatch) end += nameMatch[0].length;
  if (!numberMatch && !nameMatch) return `no se entiende «${text.slice(end) || text}»`;
  return { coefficient, name: nameMatch ? nameMatch[0].replaceAll('_', '') : null, end };
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true });
}

const NON_NEGATIVITY = /^[a-zA-Z]\w*(,[a-zA-Z]\w*)*>=0$/;
/** «max z =», «min w =», «z =» o «=» al inicio de la función objetivo. */
const OBJECTIVE_PREFIX = /^(max|min)?[zw]?=/i;

type ConstraintRow = { lhs: Map<string, Rational>; relation: Relation; rhs: Rational };

/**
 * Una línea de restricción: sus coeficientes con todo pasado a la izquierda, `'omitir'` si es de
 * no negatividad, o el mensaje de error.
 */
function readConstraintRow(line: string): ConstraintRow | 'omitir' | { error: string } {
  const text = normalize(line);
  if (NON_NEGATIVITY.test(text)) return 'omitir';
  const split = splitRelation(text);
  if (!split) return { error: 'falta el signo de la restricción (<=, >= o =)' };
  const { left, relation, right } = split;
  if (/[<>=]/.test(right)) return { error: 'usa un solo signo por restricción' };
  const l = parseExpression(left);
  const r = parseExpression(right);
  if (typeof l === 'string') return { error: l };
  if (typeof r === 'string') return { error: r };
  const lhs = new Map(l.terms);
  for (const [name, value] of r.terms) lhs.set(name, (lhs.get(name) ?? Rational.ZERO).sub(value));
  const rhs = r.constant.sub(l.constant);
  const nonZero = [...lhs.values()].filter((v) => !v.isZero());
  if (nonZero.length === 0) return { error: 'la restricción no tiene variables' };
  // Una restricción «x1 >= 0» es de no negatividad: ya está incluida.
  if (nonZero.length === 1 && nonZero[0]!.sign() > 0 && relation === '>=' && rhs.isZero()) {
    return 'omitir';
  }
  return { lhs, relation, rhs };
}

/** Variables del modelo en orden natural, o el error si son muchas o usan un nombre reservado. */
function programVariables(
  objective: Map<string, Rational>,
  rows: ConstraintRow[],
): string[] | string {
  const names = new Set<string>(objective.keys());
  for (const row of rows) for (const name of row.lhs.keys()) names.add(name);
  const variables = [...names].sort(naturalCompare);
  if (variables.length > MAX_VARIABLES) return `El máximo es ${MAX_VARIABLES} variables.`;
  const reserved = variables.find((v) => RESERVED.test(v));
  if (reserved) {
    return `«${reserved}» se reserva para holguras (s), excesos (e) y artificiales (R); usa otro nombre, como x1, x2…`;
  }
  return variables;
}

export function parseLinearProgram(
  sense: Sense,
  objectiveText: string,
  constraintsText: string,
): ParsedLp {
  const notices: string[] = [];
  const objectiveSource = normalize(objectiveText).replace(OBJECTIVE_PREFIX, '');
  const objective = parseExpression(objectiveSource);
  if (typeof objective === 'string')
    return { ok: false, message: `Función objetivo: ${objective}.` };
  if (!objective.constant.isZero()) {
    notices.push('La constante de la función objetivo no cambia la solución; se omite.');
  }

  const rows: ConstraintRow[] = [];
  const lines = constraintsText.split(/\r?\n|;/).map((l) => l.trim());
  let skipped = 0;
  for (const [index, line] of lines.entries()) {
    if (line === '') continue;
    const row = readConstraintRow(line);
    if (row === 'omitir') skipped++;
    else if ('error' in row) return { ok: false, message: `Línea ${index + 1}: ${row.error}.` };
    else rows.push(row);
  }
  if (skipped > 0) {
    notices.push(
      'Las condiciones de no negatividad (x ≥ 0) se asumen siempre, así que esas líneas se omiten.',
    );
  }
  if (rows.length === 0) return { ok: false, message: 'Escribe al menos una restricción.' };
  if (rows.length > MAX_CONSTRAINTS) {
    return { ok: false, message: `El máximo es ${MAX_CONSTRAINTS} restricciones.` };
  }

  const variables = programVariables(objective.terms, rows);
  if (typeof variables === 'string') return { ok: false, message: variables };
  const coefficientsOf = (map: Map<string, Rational>) =>
    variables.map((v) => map.get(v) ?? Rational.ZERO);

  return {
    ok: true,
    lp: {
      sense,
      variables,
      objective: coefficientsOf(objective.terms),
      constraints: rows.map((row) => ({
        coefficients: coefficientsOf(row.lhs),
        relation: row.relation,
        rhs: row.rhs,
      })),
    },
    notices,
  };
}

/** Coeficientes en el orden de `variables`, o un error si aparece una variable que no está. */
function coefficientsOver(terms: Map<string, Rational>, variables: string[]): Rational[] | string {
  const unknown = [...terms.keys()].find((name) => !variables.includes(name));
  if (unknown) return `«${unknown}» no es una variable del modelo (${variables.join(', ')})`;
  return variables.map((v) => terms.get(v) ?? Rational.ZERO);
}

/**
 * Expresión lineal sobre las variables de un modelo ya leído («2x1 + 3x2 + 4x3», con o sin
 * «z =»), p. ej. una función objetivo nueva. Devuelve los coeficientes o un mensaje de error.
 */
export function parseLinearCoefficients(text: string, variables: string[]): Rational[] | string {
  const source = normalize(text).replace(OBJECTIVE_PREFIX, '');
  const parsed = parseExpression(source);
  if (typeof parsed === 'string') return parsed;
  if (!parsed.constant.isZero()) return 'la expresión no debe tener un término constante';
  return coefficientsOver(parsed.terms, variables);
}

/**
 * Separa «izquierda relación derecha» en la primera relación (<=, >= o =), como lo hacía
 * `/^(.*?)(<=|>=|=)(.*)$/`, pero sin retroceso.
 */
export function splitRelation(
  text: string,
): { left: string; relation: '<=' | '>=' | '='; right: string } | null {
  const match = /<=|>=|=/.exec(text);
  if (!match) return null;
  return {
    left: text.slice(0, match.index),
    relation: match[0] as '<=' | '>=' | '=',
    right: text.slice(match.index + match[0].length),
  };
}

/** Una restricción escrita como texto («3x1 + 3x2 + x3 <= 500») sobre las variables del modelo. */
export function parseConstraintLine(line: string, variables: string[]): LpConstraint | string {
  const text = normalize(line);
  const split = splitRelation(text);
  if (!split) return 'falta el signo de la restricción (<=, >= o =)';
  const { left, relation: rel, right } = split;
  if (/[<>=]/.test(right)) return 'usa un solo signo en la restricción';
  const l = parseExpression(left);
  const r = parseExpression(right);
  if (typeof l === 'string') return l;
  if (typeof r === 'string') return r;
  const lhs = new Map(l.terms);
  for (const [name, value] of r.terms) lhs.set(name, (lhs.get(name) ?? Rational.ZERO).sub(value));
  if ([...lhs.values()].every((v) => v.isZero())) return 'la restricción no tiene variables';
  const coefficients = coefficientsOver(lhs, variables);
  if (typeof coefficients === 'string') return coefficients;
  return { coefficients, relation: rel as Relation, rhs: r.constant.sub(l.constant) };
}

/** Campos del formulario comunes a todas las calculadoras de PL. */
export const lpInputShape = {
  sense: z.enum(['max', 'min'], { error: 'Elige si se maximiza o se minimiza.' }),
  objective: z
    .string({ error: 'Escribe la función objetivo.' })
    .trim()
    .min(1, 'Escribe la función objetivo.')
    .max(300, 'La función objetivo es demasiado larga.'),
  constraints: z
    .string({ error: 'Escribe las restricciones.' })
    .trim()
    .min(1, 'Escribe al menos una restricción.')
    .max(2000, 'Las restricciones son demasiado largas.'),
};

/** Valida el modelo en el formulario, con el mensaje del parser. */
export function refineLp(
  v: { sense: Sense; objective: string; constraints: string },
  ctx: z.RefinementCtx,
) {
  const parsed = parseLinearProgram(v.sense, v.objective, v.constraints);
  if (!parsed.ok) {
    const path = parsed.message.startsWith('Función objetivo') ? 'objective' : 'constraints';
    ctx.addIssue({ code: 'custom', path: [path], message: parsed.message });
  }
}

// ─── Presentación ───────────────────────────────────────────────────────────

/** Nombre de variable → LaTeX: x1 → x_{1}, y → y. */
export function variableLatex(name: string): string {
  const match = /^([a-zA-Z]+)(\d+)$/.exec(name);
  return match ? `${match[1]}_{${match[2]}}` : name;
}

/** Combinación lineal en LaTeX: 5x_1 + 4x_2 − x_3 (omite coeficientes 0 y los 1). */
export function linearLatex(coefficients: Rational[], names: string[]): string {
  const parts: string[] = [];
  coefficients.forEach((c, j) => {
    if (c.isZero()) return;
    const abs = c.abs();
    const coef = abs.eq(Rational.ONE) ? '' : abs.toLatex();
    const term = `${coef}${names[j]}`;
    if (parts.length === 0) parts.push(c.sign() < 0 ? `-${term}` : term);
    else parts.push(`${c.sign() < 0 ? '-' : '+'} ${term}`);
  });
  return parts.length > 0 ? parts.join(' ') : '0';
}

export const relationLatex: Record<Relation, string> = {
  '<=': String.raw`\le`,
  '>=': String.raw`\ge`,
  '=': '=',
};

/** La relación en texto: ≤, ≥ o =. */
export const RELATION_TEXT: Record<Relation, string> = { '<=': '≤', '>=': '≥', '=': '=' };

/** La relación contraria (la que tiene una restricción que no se cumple): > o <. */
export const VIOLATED_LATEX: Record<Relation, string> = {
  '<=': '>',
  '>=': '<',
  '=': String.raw`\ne`,
};

/** La relación al multiplicar ambos lados por −1. */
export const FLIPPED: Record<Relation, Relation> = { '<=': '>=', '>=': '<=', '=': '=' };

/** El modelo completo en LaTeX (arreglo alineado). */
export function lpLatex(lp: LinearProgram, objectiveName = 'z'): string {
  const names = lp.variables.map(variableLatex);
  const rows = lp.constraints.map(
    (c) => `${linearLatex(c.coefficients, names)} &${relationLatex[c.relation]} ${c.rhs.toLatex()}`,
  );
  return String.raw`\begin{aligned} ${TEX[lp.sense]}\ ${objectiveName} &= ${linearLatex(lp.objective, names)} \\ \text{s.a.}\quad ${rows.join(TEX.newline)} \\ ${names.join(', ')} &\ge 0 \end{aligned}`;
}

/** Valor de la función objetivo en un punto. */
export function objectiveValue(lp: LinearProgram, x: Rational[]): Rational {
  return lp.objective.reduce((s, c, j) => s.add(c.mul(x[j]!)), Rational.ZERO);
}
