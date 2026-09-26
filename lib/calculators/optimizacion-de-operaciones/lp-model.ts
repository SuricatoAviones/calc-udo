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
    const numberMatch = /^(\d+(?:\.\d+)?|\.\d+)(?:\/(\d+(?:\.\d+)?))?/.exec(text.slice(i));
    let coefficient: Rational | null = null;
    if (numberMatch) {
      coefficient = Rational.fromNumber(Number(numberMatch[1]));
      if (numberMatch[2] !== undefined) {
        const den = Rational.fromNumber(Number(numberMatch[2]));
        if (den.isZero()) return 'hay una división entre 0';
        coefficient = coefficient.div(den);
      }
      i += numberMatch[0].length;
    }
    const nameMatch = /^[a-zA-Z][a-zA-Z0-9_]*/.exec(text.slice(i));
    if (nameMatch) i += nameMatch[0].length;
    if (!numberMatch && !nameMatch) return `no se entiende «${text.slice(i) || text}»`;
    const value = (coefficient ?? Rational.ONE).mul(Rational.of(sign));
    if (nameMatch) {
      const name = nameMatch[0].replace(/_/g, '');
      terms.set(name, (terms.get(name) ?? Rational.ZERO).add(value));
    } else {
      constant = constant.add(value);
    }
  }
  return { terms, constant };
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true });
}

const NON_NEGATIVITY = /^[a-zA-Z][a-zA-Z0-9_]*(,[a-zA-Z][a-zA-Z0-9_]*)*>=0$/;

export function parseLinearProgram(
  sense: Sense,
  objectiveText: string,
  constraintsText: string,
): ParsedLp {
  const notices: string[] = [];
  const objectiveSource = normalize(objectiveText).replace(/^(max|min)?(z|w)?=/i, '');
  const objective = parseExpression(objectiveSource);
  if (typeof objective === 'string')
    return { ok: false, message: `Función objetivo: ${objective}.` };
  if (!objective.constant.isZero()) {
    notices.push('La constante de la función objetivo no cambia la solución; se omite.');
  }

  const rows: { lhs: Map<string, Rational>; relation: Relation; rhs: Rational }[] = [];
  const lines = constraintsText.split(/\r?\n|;/).map((l) => l.trim());
  let skipped = 0;
  for (const [index, line] of lines.entries()) {
    if (line === '') continue;
    const text = normalize(line);
    if (NON_NEGATIVITY.test(text)) {
      skipped++;
      continue;
    }
    const match = /^(.*?)(<=|>=|=)(.*)$/.exec(text);
    if (!match) {
      return {
        ok: false,
        message: `Línea ${index + 1}: falta el signo de la restricción (<=, >= o =).`,
      };
    }
    const [, left = '', rel, right = ''] = match;
    if (/[<>=]/.test(right)) {
      return { ok: false, message: `Línea ${index + 1}: usa un solo signo por restricción.` };
    }
    const l = parseExpression(left);
    const r = parseExpression(right);
    if (typeof l === 'string') return { ok: false, message: `Línea ${index + 1}: ${l}.` };
    if (typeof r === 'string') return { ok: false, message: `Línea ${index + 1}: ${r}.` };
    const lhs = new Map(l.terms);
    for (const [name, value] of r.terms) lhs.set(name, (lhs.get(name) ?? Rational.ZERO).sub(value));
    const rhs = r.constant.sub(l.constant);
    if ([...lhs.values()].every((v) => v.isZero())) {
      return {
        ok: false,
        message: `Línea ${index + 1}: la restricción no tiene variables.`,
      };
    }
    // Una restricción «x1 >= 0» es de no negatividad: ya está incluida.
    const nonZero = [...lhs.values()].filter((v) => !v.isZero());
    if (nonZero.length === 1 && nonZero[0]!.sign() > 0 && rel === '>=' && rhs.isZero()) {
      skipped++;
      continue;
    }
    rows.push({ lhs, relation: rel as Relation, rhs });
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

  const names = new Set<string>(objective.terms.keys());
  for (const row of rows) for (const name of row.lhs.keys()) names.add(name);
  const variables = [...names].sort(naturalCompare);
  if (variables.length > MAX_VARIABLES) {
    return { ok: false, message: `El máximo es ${MAX_VARIABLES} variables.` };
  }
  const reserved = variables.find((v) => RESERVED.test(v));
  if (reserved) {
    return {
      ok: false,
      message: `«${reserved}» se reserva para holguras (s), excesos (e) y artificiales (R); usa otro nombre, como x1, x2…`,
    };
  }
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

export const relationLatex: Record<Relation, string> = { '<=': '\\le', '>=': '\\ge', '=': '=' };

/** El modelo completo en LaTeX (arreglo alineado). */
export function lpLatex(lp: LinearProgram, objectiveName = 'z'): string {
  const names = lp.variables.map(variableLatex);
  const rows = lp.constraints.map(
    (c) => `${linearLatex(c.coefficients, names)} &${relationLatex[c.relation]} ${c.rhs.toLatex()}`,
  );
  return `\\begin{aligned} \\${lp.sense}\\ ${objectiveName} &= ${linearLatex(lp.objective, names)} \\\\ \\text{s.a.}\\quad ${rows.join(' \\\\ ')} \\\\ ${names.join(', ')} &\\ge 0 \\end{aligned}`;
}

/** Valor de la función objetivo en un punto. */
export function objectiveValue(lp: LinearProgram, x: Rational[]): Rational {
  return lp.objective.reduce((s, c, j) => s.add(c.mul(x[j]!)), Rational.ZERO);
}
