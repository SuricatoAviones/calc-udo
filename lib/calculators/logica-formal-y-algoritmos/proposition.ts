/**
 * Proposiciones de la lógica proposicional: lectura, evaluación y tabla de verdad (Tucker y
 * Joyanes; Muñoz, Lógica simbólica elemental).
 *
 * Sintaxis aceptada (variables: una letra, salvo V y F; constantes: V, F, 1, 0):
 *
 *   negación      ¬p   ~p   !p
 *   conjunción    p ∧ q   p & q   p ^ q
 *   disyunción    p ∨ q   p | q   p v q   p + q
 *   disy. excl.   p ⊕ q   p ⊻ q
 *   condicional   p → q   p -> q   p => q
 *   bicondicional p ↔ q   p <-> q   p <=> q
 *
 * Jerarquía, de mayor a menor: ¬, ∧, ∨ y ⊕, →, ↔. El condicional asocia a la derecha
 * (p → q → r es p → (q → r)); los demás, a la izquierda. Los paréntesis cambian el orden.
 */
import { z } from 'zod';

export type BinaryOp = 'and' | 'or' | 'xor' | 'implies' | 'iff';

export type Formula =
  | { type: 'var'; name: string }
  | { type: 'const'; value: boolean }
  | { type: 'not'; arg: Formula }
  | { type: 'bin'; op: BinaryOp; left: Formula; right: Formula };

export const MAX_VARIABLES = 6;

type Token =
  | { kind: 'var'; name: string; pos: number }
  | { kind: 'const'; value: boolean; pos: number }
  | { kind: 'not'; pos: number }
  | { kind: 'op'; op: BinaryOp; pos: number }
  | { kind: 'open' | 'close'; pos: number }
  | { kind: 'v'; pos: number };

type WithoutPos<T> = T extends unknown ? Omit<T, 'pos'> : never;
type TokenShape = WithoutPos<Token>;

const SYMBOLS: [string, TokenShape][] = [
  ['<->', { kind: 'op', op: 'iff' }],
  ['<=>', { kind: 'op', op: 'iff' }],
  ['->', { kind: 'op', op: 'implies' }],
  ['=>', { kind: 'op', op: 'implies' }],
  ['↔', { kind: 'op', op: 'iff' }],
  ['⇔', { kind: 'op', op: 'iff' }],
  ['≡', { kind: 'op', op: 'iff' }],
  ['→', { kind: 'op', op: 'implies' }],
  ['⇒', { kind: 'op', op: 'implies' }],
  ['⊃', { kind: 'op', op: 'implies' }],
  ['∧', { kind: 'op', op: 'and' }],
  ['&', { kind: 'op', op: 'and' }],
  ['^', { kind: 'op', op: 'and' }],
  ['∨', { kind: 'op', op: 'or' }],
  ['|', { kind: 'op', op: 'or' }],
  ['+', { kind: 'op', op: 'or' }],
  ['⊕', { kind: 'op', op: 'xor' }],
  ['⊻', { kind: 'op', op: 'xor' }],
  ['¬', { kind: 'not' }],
  ['~', { kind: 'not' }],
  ['!', { kind: 'not' }],
  ['(', { kind: 'open' }],
  ['[', { kind: 'open' }],
  ['{', { kind: 'open' }],
  [')', { kind: 'close' }],
  [']', { kind: 'close' }],
  ['}', { kind: 'close' }],
];

function tokenize(text: string): Token[] | string {
  const tokens: Token[] = [];
  let i = 0;
  outer: while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    for (const [symbol, token] of SYMBOLS) {
      if (text.startsWith(symbol, i)) {
        tokens.push({ ...token, pos: i } as Token);
        i += symbol.length;
        continue outer;
      }
    }
    if (ch === 'v') tokens.push({ kind: 'v', pos: i });
    else if (ch === 'V' || ch === '1') tokens.push({ kind: 'const', value: true, pos: i });
    else if (ch === 'F' || ch === '0') tokens.push({ kind: 'const', value: false, pos: i });
    else if (/[a-zA-Z]/.test(ch)) tokens.push({ kind: 'var', name: ch, pos: i });
    else return `no se reconoce el símbolo «${ch}»`;
    i++;
  }
  return tokens;
}

const PRECEDENCE: Record<BinaryOp, number> = { iff: 1, implies: 2, or: 3, xor: 3, and: 4 };

/** Lee una proposición. Devuelve el árbol o un mensaje de error en español. */
export function parseFormula(text: string): Formula | string {
  const tokens = tokenize(text);
  if (typeof tokens === 'string') return tokens;
  if (tokens.length === 0) return 'escribe una proposición';
  let k = 0;

  // «v» es la disyunción cuando aparece donde se espera un operador, y una variable si no.
  const peekOperator = (): BinaryOp | null => {
    const t = tokens[k];
    if (!t) return null;
    if (t.kind === 'op') return t.op;
    if (t.kind === 'v') return 'or';
    return null;
  };

  const primary = (): Formula | string => {
    const t = tokens[k];
    if (!t) return 'la proposición está incompleta';
    k++;
    if (t.kind === 'not') {
      const arg = primary();
      return typeof arg === 'string' ? arg : { type: 'not', arg };
    }
    if (t.kind === 'var') return { type: 'var', name: t.name };
    if (t.kind === 'v') return { type: 'var', name: 'v' };
    if (t.kind === 'const') return { type: 'const', value: t.value };
    if (t.kind === 'open') {
      const inner = expression(0);
      if (typeof inner === 'string') return inner;
      if (tokens[k]?.kind !== 'close') return 'falta cerrar un paréntesis';
      k++;
      return inner;
    }
    return t.kind === 'close'
      ? 'hay un paréntesis de cierre de más'
      : 'falta una proposición antes de un conector';
  };

  const expression = (minPrecedence: number): Formula | string => {
    let left = primary();
    if (typeof left === 'string') return left;
    for (;;) {
      const op = peekOperator();
      if (op === null || PRECEDENCE[op] < minPrecedence) break;
      k++;
      // El condicional asocia a la derecha; los demás, a la izquierda.
      const next = op === 'implies' ? PRECEDENCE[op] : PRECEDENCE[op] + 1;
      const right = expression(next);
      if (typeof right === 'string') return right;
      left = { type: 'bin', op, left, right };
    }
    return left;
  };

  const result = expression(0);
  if (typeof result === 'string') return result;
  if (k < tokens.length) {
    const t = tokens[k]!;
    return t.kind === 'close'
      ? 'hay un paréntesis de cierre de más'
      : 'falta un conector entre dos proposiciones';
  }
  return result;
}

export function variablesOf(formulas: Formula[]): string[] {
  const names = new Set<string>();
  const walk = (f: Formula) => {
    if (f.type === 'var') names.add(f.name);
    else if (f.type === 'not') walk(f.arg);
    else if (f.type === 'bin') {
      walk(f.left);
      walk(f.right);
    }
  };
  formulas.forEach(walk);
  return [...names].sort();
}

export function evaluate(f: Formula, values: Map<string, boolean>): boolean {
  switch (f.type) {
    case 'var':
      return values.get(f.name)!;
    case 'const':
      return f.value;
    case 'not':
      return !evaluate(f.arg, values);
    case 'bin': {
      const a = evaluate(f.left, values);
      const b = evaluate(f.right, values);
      if (f.op === 'and') return a && b;
      if (f.op === 'or') return a || b;
      if (f.op === 'xor') return a !== b;
      if (f.op === 'implies') return !a || b;
      return a === b;
    }
  }
}

const OP_LATEX: Record<BinaryOp, string> = {
  and: '\\land',
  or: '\\lor',
  xor: '\\oplus',
  implies: '\\rightarrow',
  iff: '\\leftrightarrow',
};

/** LaTeX con paréntesis alrededor de cada subfórmula binaria. */
export function formulaLatex(f: Formula, top = true): string {
  switch (f.type) {
    case 'var':
      return f.name;
    case 'const':
      return f.value ? '\\mathrm{V}' : '\\mathrm{F}';
    case 'not':
      return `\\neg ${formulaLatex(f.arg, false)}`;
    case 'bin': {
      const inner = `${formulaLatex(f.left, false)} ${OP_LATEX[f.op]} ${formulaLatex(f.right, false)}`;
      return top ? inner : `(${inner})`;
    }
  }
}

/** Subfórmulas compuestas en orden de evaluación (primero las de adentro), sin repetir. */
export function subformulas(formulas: Formula[]): Formula[] {
  const seen = new Set<string>();
  const out: Formula[] = [];
  const walk = (f: Formula) => {
    if (f.type === 'var' || f.type === 'const') return;
    if (f.type === 'not') walk(f.arg);
    else {
      walk(f.left);
      walk(f.right);
    }
    const key = formulaLatex(f);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(f);
    }
  };
  formulas.forEach(walk);
  return out;
}

/** Filas de la tabla: de todas V a todas F, con la primera variable cambiando más lento. */
export function assignments(variables: string[]): Map<string, boolean>[] {
  const n = variables.length;
  return Array.from(
    { length: 2 ** n },
    (_, r) => new Map(variables.map((name, k) => [name, ((r >> (n - 1 - k)) & 1) === 0])),
  );
}

export const truth = (b: boolean) => (b ? 'V' : 'F');

/** Conectores usados, con su regla, para explicar la evaluación. */
export function connectiveRules(formulas: Formula[]): string[] {
  const used = new Set<string>();
  const walk = (f: Formula) => {
    if (f.type === 'not') {
      used.add('not');
      walk(f.arg);
    } else if (f.type === 'bin') {
      used.add(f.op);
      walk(f.left);
      walk(f.right);
    }
  };
  formulas.forEach(walk);
  const rules: Record<string, string> = {
    not: '\\neg p \\text{ tiene el valor contrario de } p',
    and: 'p \\land q \\text{ es V solo si ambas son V}',
    or: 'p \\lor q \\text{ es F solo si ambas son F}',
    xor: 'p \\oplus q \\text{ es V si tienen valores distintos}',
    implies: 'p \\rightarrow q \\text{ es F solo si } p \\text{ es V y } q \\text{ es F}',
    iff: 'p \\leftrightarrow q \\text{ es V si tienen el mismo valor}',
  };
  return ['not', 'and', 'or', 'xor', 'implies', 'iff']
    .filter((k) => used.has(k))
    .map((k) => rules[k]!);
}

/**
 * Encaja proposiciones en esquemas (p. ej. `p → q`, `p`, `q` del modus ponens). Las variables
 * del esquema representan cualquier proposición, pero la misma variable debe representar
 * siempre la misma. Devuelve la sustitución o `null`.
 */
export function matchSchemas(
  schemas: Formula[],
  formulas: Formula[],
  bindings: Map<string, string> = new Map(),
): Map<string, string> | null {
  const b = new Map(bindings);
  const match = (s: Formula, f: Formula): boolean => {
    if (s.type === 'var') {
      const key = formulaLatex(f);
      const bound = b.get(s.name);
      if (bound === undefined) {
        b.set(s.name, key);
        return true;
      }
      return bound === key;
    }
    if (s.type === 'const') return f.type === 'const' && f.value === s.value;
    if (s.type === 'not') return f.type === 'not' && match(s.arg, f.arg);
    return f.type === 'bin' && f.op === s.op && match(s.left, f.left) && match(s.right, f.right);
  };
  return schemas.length === formulas.length && schemas.every((s, i) => match(s, formulas[i]!))
    ? b
    : null;
}

/** Lee un esquema escrito a mano (siempre es válido). */
export function schema(text: string): Formula {
  const parsed = parseFormula(text);
  if (typeof parsed === 'string') throw new Error(`esquema inválido: ${text}`);
  return parsed;
}

/** Columnas V/F de una tabla de verdad: variables y luego cada fórmula. */
export function truthTableColumns(variables: string[], formulas: Formula[]) {
  return [
    ...variables.map((name) => ({ key: `var-${name}`, header: name, format: 'text' as const })),
    ...formulas.map((f, k) => ({
      key: `f-${k}`,
      header: formulaLatex(f),
      format: 'text' as const,
    })),
  ];
}

export function truthTableRow(
  variables: string[],
  formulas: Formula[],
  values: Map<string, boolean>,
): Record<string, string> {
  const row: Record<string, string> = {};
  for (const name of variables) row[`var-${name}`] = truth(values.get(name)!);
  formulas.forEach((f, k) => (row[`f-${k}`] = truth(evaluate(f, values))));
  return row;
}

/** «V, F, F, V» como texto LaTeX. */
export const columnLatex = (column: boolean[]) => `\\text{${column.map(truth).join(', ')}}`;

/** Campo de formulario para una proposición, validada con el lector. */
export const formulaField = (label: string) =>
  z
    .string({ error: `Escribe ${label}.` })
    .trim()
    .min(1, `Escribe ${label}.`)
    .max(200, 'La proposición es demasiado larga.')
    .superRefine((text, ctx) => {
      const parsed = parseFormula(text);
      if (typeof parsed === 'string') {
        ctx.addIssue({ code: 'custom', message: `No se pudo leer: ${parsed}.` });
      } else if (variablesOf([parsed]).length > MAX_VARIABLES) {
        ctx.addIssue({ code: 'custom', message: `Usa a lo sumo ${MAX_VARIABLES} variables.` });
      }
    });
