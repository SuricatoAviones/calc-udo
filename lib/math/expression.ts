/**
 * Expresiones matemáticas escritas por el estudiante: parseo, validación, evaluación y derivada
 * simbólica, sobre mathjs. Todos los mensajes de error están en español.
 *
 * Convenciones de notación (las de los libros en español, no las de mathjs):
 * - `ln(x)` es el logaritmo natural y `log10(x)` el decimal. `log(x)` a secas se RECHAZA porque
 *   en mathjs es natural pero en los libros suele ser decimal: un resultado equivocado
 *   silencioso es peor que pedir que se aclare.
 * - `sen(x)` y `tg(x)` se aceptan como `sin(x)` y `tan(x)`.
 * - `e` y `pi` son constantes; la multiplicación implícita (`2x`) está permitida.
 */
import { derivative, FunctionNode, parse, type MathNode } from 'mathjs';

export interface ParsedExpression {
  /** Texto original escrito por el estudiante. */
  source: string;
  node: MathNode;
  /** Representación LaTeX para mostrar en los pasos. */
  tex: string;
  /** Evalúa en `x`. Devuelve `NaN` si el resultado no es un número real. */
  evaluate(x: number): number;
}

export type ExpressionResult =
  { ok: true; expr: ParsedExpression } | { ok: false; message: string };

const ALIASES: Record<string, string> = { ln: 'log', sen: 'sin', tg: 'tan' };

const ALLOWED_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
  'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh',
  'exp', 'log', 'log10', 'sqrt', 'cbrt', 'abs',
  ...Object.keys(ALIASES),
]); // prettier-ignore

const ALLOWED_CONSTANTS = new Set(['e', 'pi']);

const MAX_LENGTH = 200;

function translateParseError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const position = /char (\d+)/.exec(text)?.[1];
  if (/Parenthesis \) expected/.test(text)) return 'Falta cerrar un paréntesis.';
  if (/Unexpected end of expression/.test(text)) return 'La expresión está incompleta.';
  return position
    ? `La expresión no es válida cerca del carácter ${position}.`
    : 'La expresión no es válida.';
}

/** Valida símbolos y funciones. Devuelve un mensaje de error o `null` si todo está bien. */
function validateSymbols(node: MathNode, variable: string): string | null {
  let problem: string | null = null;
  node.traverse((child, path, parent) => {
    if (problem) return;
    if (child.type !== 'SymbolNode') return;
    const name = (child as unknown as { name: string }).name;
    const isFunctionName = parent?.type === 'FunctionNode' && path === 'fn';

    if (isFunctionName) {
      if (name === 'log') {
        problem = 'Usa ln(x) para el logaritmo natural o log10(x) para el logaritmo decimal.';
      } else if (!ALLOWED_FUNCTIONS.has(name)) {
        problem = `La función «${name}» no está soportada.`;
      }
    } else if (name !== variable && !ALLOWED_CONSTANTS.has(name)) {
      problem = `La expresión solo puede depender de ${variable}; «${name}» no está definido.`;
    }
  });
  return problem;
}

/** Reemplaza alias en español (`ln`, `sen`, `tg`) por los nombres de mathjs. */
function applyAliases(node: MathNode): MathNode {
  return node.transform((child) => {
    if (child.type !== 'FunctionNode') return child;
    const fn = child as unknown as FunctionNode;
    const target = ALIASES[fn.fn.name];
    return target ? new FunctionNode(target, fn.args) : child;
  });
}

function toParsed(source: string, node: MathNode): ParsedExpression {
  const compiled = node.compile();
  return {
    source,
    node,
    tex: node.toTex({ implicit: 'show' }),
    evaluate(x: number) {
      try {
        const value: unknown = compiled.evaluate({ x });
        return typeof value === 'number' ? value : NaN; // p. ej. Complex de sqrt(-1)
      } catch {
        return NaN;
      }
    },
  };
}

/** Parsea una función de una variable escrita por el estudiante. */
export function parseFunction(source: string, variable = 'x'): ExpressionResult {
  const trimmed = source.trim();
  if (trimmed === '') return { ok: false, message: 'Escribe una función.' };
  if (trimmed.length > MAX_LENGTH) {
    return {
      ok: false,
      message: `La expresión es demasiado larga (máximo ${MAX_LENGTH} caracteres).`,
    };
  }

  let node: MathNode;
  try {
    node = parse(trimmed);
  } catch (error) {
    return { ok: false, message: translateParseError(error) };
  }

  const problem = validateSymbols(node, variable);
  if (problem) return { ok: false, message: problem };

  return { ok: true, expr: toParsed(trimmed, applyAliases(node)) };
}

/** Derivada simbólica respecto de `variable`. */
export function differentiate(expr: ParsedExpression, variable = 'x'): ExpressionResult {
  try {
    const node = derivative(expr.node, variable);
    return { ok: true, expr: toParsed(node.toString(), node) };
  } catch {
    return { ok: false, message: 'No se pudo derivar la función simbólicamente.' };
  }
}
