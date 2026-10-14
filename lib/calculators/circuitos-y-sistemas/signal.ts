/**
 * Señales de la tabla de transformadas: sumas de términos c·tⁿ·e^{αt}·u(t − a) e impulsos
 * c·δ(t − a), con c y α complejos. Senos, cosenos, senos hiperbólicos y potencias aᵗ se escriben
 * con exponenciales (Euler), así que la familia es cerrada bajo suma, producto y desplazamiento,
 * y su transformada de Laplace o Z se obtiene término a término.
 *
 * Lo usan la transformada de Laplace (tiempo continuo, variable t), la convolución y la
 * transformada Z (sucesiones, variable k). Toda la señal se entiende multiplicada por u(t): las
 * transformadas son unilaterales.
 *
 * Fuentes: Hayt, Kemmerly y Durbin, 8.ª ed., sec. 14.4 a 14.6 (pares y propiedades); Dorf y
 * Svoboda, 9.ª ed., tablas 14.2-1 y 14.2-2; Kuo, 7.ª ed., sec. 2-11 y apéndice C (pares Z).
 */
import { parse, type MathNode } from 'mathjs';
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';

export interface ExpTerm {
  kind: 'exp';
  coef: Complex;
  /** Potencia n de tⁿ. */
  power: number;
  /** Exponente α de e^{αt}. */
  rate: Complex;
  /** La señal vale 0 antes de `shift`: factor u(t − shift). */
  shift: number;
}

export interface ImpulseTerm {
  kind: 'impulse';
  coef: Complex;
  /** δ(t − shift). */
  shift: number;
}

export type SignalTerm = ExpTerm | ImpulseTerm;
export type Signal = SignalTerm[];

export interface SignalOptions {
  /** `t` para señales continuas, `k` para sucesiones. */
  variable: string;
  /** Sucesiones: desplazamientos enteros, δ de Kronecker y bases negativas (−0.5)^k. */
  discrete: boolean;
}

export type SignalResult = { ok: true; signal: Signal } | { ok: false; message: string };

class SignalError extends Error {}

const MAX_LENGTH = 200;
const MAX_POWER = 12;

// ─── Álgebra de señales ─────────────────────────────────────────────────────

const constant = (c: Complex): Signal => [
  { kind: 'exp', coef: c, power: 0, rate: C.ZERO, shift: 0 },
];

function sameComplex(a: Complex, b: Complex): boolean {
  return (
    Math.abs(a.re - b.re) <= 1e-12 * Math.max(1, Math.abs(a.re)) &&
    Math.abs(a.im - b.im) <= 1e-12 * Math.max(1, Math.abs(a.im))
  );
}

/** Junta términos semejantes y quita los nulos. */
export function normalizeSignal(signal: Signal): Signal {
  const out: Signal = [];
  for (const term of signal) {
    const twin = out.find((o) =>
      o.kind === 'impulse' && term.kind === 'impulse'
        ? Math.abs(o.shift - term.shift) < 1e-12
        : o.kind === 'exp' &&
          term.kind === 'exp' &&
          o.power === term.power &&
          Math.abs(o.shift - term.shift) < 1e-12 &&
          sameComplex(o.rate, term.rate),
    );
    if (twin) twin.coef = C.add(twin.coef, term.coef);
    else out.push({ ...term, coef: { ...term.coef } });
  }
  const size = Math.max(1e-300, ...out.map((t) => C.abs(t.coef)));
  return out.filter((t) => C.abs(t.coef) > 1e-13 * size);
}

export function addSignals(a: Signal, b: Signal): Signal {
  return normalizeSignal([...a, ...b]);
}

export function scaleSignal(a: Signal, k: Complex): Signal {
  return normalizeSignal(a.map((t) => ({ ...t, coef: C.mul(t.coef, k) })));
}

/** Valor de un término exponencial en el instante t (0 antes de su desplazamiento). */
function expTermAt(term: ExpTerm, t: number): Complex {
  if (t < term.shift - 1e-12) return C.ZERO;
  return C.mul(
    C.scale(term.coef, term.power === 0 ? 1 : t ** term.power),
    C.exp(C.scale(term.rate, t)),
  );
}

export function multiplySignals(a: Signal, b: Signal): Signal {
  const out: Signal = [];
  for (const x of a) {
    for (const y of b) {
      if (x.kind === 'impulse' && y.kind === 'impulse') {
        throw new SignalError('No se puede multiplicar un impulso por otro impulso.');
      }
      if (x.kind === 'impulse' || y.kind === 'impulse') {
        // Propiedad de muestreo: f(t)·δ(t − a) = f(a)·δ(t − a).
        const impulse = (x.kind === 'impulse' ? x : y) as ImpulseTerm;
        const other = (x.kind === 'impulse' ? y : x) as ExpTerm;
        out.push({
          kind: 'impulse',
          coef: C.mul(impulse.coef, expTermAt(other, impulse.shift)),
          shift: impulse.shift,
        });
        continue;
      }
      out.push({
        kind: 'exp',
        coef: C.mul(x.coef, y.coef),
        power: x.power + y.power,
        rate: C.add(x.rate, y.rate),
        shift: Math.max(x.shift, y.shift),
      });
    }
  }
  return normalizeSignal(out);
}

/** Valor real de la señal en t (los impulsos no se pueden evaluar: se ignoran). */
export function evaluateSignal(signal: Signal, t: number): number {
  let sum = 0;
  for (const term of signal) if (term.kind === 'exp') sum += expTermAt(term, t).re;
  return sum;
}

export function hasImpulses(signal: Signal): boolean {
  return signal.some((t) => t.kind === 'impulse');
}

/** Si la señal es una constante (sin t), su valor. */
function asConstant(signal: Signal): Complex | null {
  if (signal.length === 0) return C.ZERO;
  if (signal.length !== 1) return null;
  const t = signal[0]!;
  if (t.kind !== 'exp' || t.power !== 0 || t.shift !== 0 || !C.isZero(t.rate)) return null;
  return t.coef;
}

/** Si la señal es m·t + c (real, sin escalones), devuelve m y c. */
function asLinear(signal: Signal): { m: number; c: number } | null {
  let m = 0;
  let c = 0;
  for (const t of signal) {
    if (t.kind !== 'exp' || t.shift !== 0 || !C.isZero(t.rate) || t.power > 1) return null;
    if (!C.isReal(t.coef, 1e-12)) return null;
    if (t.power === 1) m += t.coef.re;
    else c += t.coef.re;
  }
  return { m, c };
}

// ─── Lectura de la expresión ────────────────────────────────────────────────

const FUNCTION_ALIASES: Record<string, string> = {
  sen: 'sin',
  senh: 'sinh',
  delta: 'delta',
  impulso: 'delta',
  escalon: 'u',
  escalón: 'u',
  heaviside: 'u',
};

function linearArgument(node: MathNode, options: SignalOptions, what: string) {
  const lin = asLinear(toSignal(node, options));
  if (!lin) {
    throw new SignalError(
      `El argumento de ${what} debe ser de la forma a·${options.variable} + b.`,
    );
  }
  return lin;
}

function unitStep(lin: { m: number; c: number }, options: SignalOptions): Signal {
  const { m, c } = lin;
  if (m === 0) return c >= 0 ? constant(C.ONE) : [];
  const zero = -c / m;
  if (options.discrete && Math.abs(zero - Math.round(zero)) > 1e-9) {
    throw new SignalError('En una sucesión, el escalón debe desplazarse un número entero.');
  }
  const a = options.discrete ? Math.round(zero) : zero;
  if (m > 0) {
    // u(t − a): para t ≥ 0 vale 1 si a ≤ 0.
    return a <= 0
      ? constant(C.ONE)
      : [{ kind: 'exp', coef: C.ONE, power: 0, rate: C.ZERO, shift: a }];
  }
  // u(a − t) = 1 − u(t − a) para t ≥ 0 (vale 1 hasta a).
  if (a <= 0) return [];
  return normalizeSignal([
    { kind: 'exp', coef: C.ONE, power: 0, rate: C.ZERO, shift: 0 },
    { kind: 'exp', coef: C.complex(-1), power: 0, rate: C.ZERO, shift: a },
  ]);
}

function impulse(lin: { m: number; c: number }, options: SignalOptions): Signal {
  const { m, c } = lin;
  if (m === 0) throw new SignalError('El impulso debe depender de la variable.');
  const at = -c / m;
  if (options.discrete) {
    if (Math.abs(at - Math.round(at)) > 1e-9 || Math.abs(Math.abs(m) - 1) > 1e-12) {
      throw new SignalError('En una sucesión, el impulso se escribe delta(k − m) con m entero.');
    }
    const a = Math.round(at);
    return a < 0 ? [] : [{ kind: 'impulse', coef: C.ONE, shift: a }];
  }
  // δ(m(t − a)) = δ(t − a)/|m|.
  return at < 0 ? [] : [{ kind: 'impulse', coef: C.complex(1 / Math.abs(m)), shift: at }];
}

/** e^{L} con L = m·t + c (m puede ser complejo si viene de un seno). */
function exponential(rate: Complex, offset: Complex): Signal {
  return [{ kind: 'exp', coef: C.exp(offset), power: 0, rate, shift: 0 }];
}

function trig(name: string, lin: { m: number; c: number }): Signal {
  const { m, c } = lin;
  const pos = exponential(C.complex(0, m), C.complex(0, c));
  const negative = exponential(C.complex(0, -m), C.complex(0, -c));
  const hpos = exponential(C.complex(m), C.complex(c));
  const hneg = exponential(C.complex(-m), C.complex(-c));
  switch (name) {
    case 'sin': // (e^{jx} − e^{−jx}) / 2j
      return addSignals(
        scaleSignal(pos, C.div(C.ONE, C.complex(0, 2))),
        scaleSignal(negative, C.div(C.complex(-1), C.complex(0, 2))),
      );
    case 'cos':
      return addSignals(scaleSignal(pos, C.complex(0.5)), scaleSignal(negative, C.complex(0.5)));
    case 'sinh':
      return addSignals(scaleSignal(hpos, C.complex(0.5)), scaleSignal(hneg, C.complex(-0.5)));
    case 'cosh':
      return addSignals(scaleSignal(hpos, C.complex(0.5)), scaleSignal(hneg, C.complex(0.5)));
    default:
      return exponential(C.complex(m), C.complex(c));
  }
}

/** base^exponente con base constante y exponente lineal en la variable. */
function constantBasePower(base: Complex, lin: { m: number; c: number }, options: SignalOptions) {
  if (!C.isReal(base) || base.re === 0) {
    throw new SignalError(
      'La base de una potencia con exponente variable debe ser real y no nula.',
    );
  }
  if (base.re < 0 && !options.discrete) {
    throw new SignalError('Una base negativa con exponente t no es una función real.');
  }
  const ln = C.log(C.complex(base.re));
  if (base.re < 0 && Math.abs(lin.c - Math.round(lin.c)) > 1e-12) {
    throw new SignalError(
      'Con base negativa, el exponente debe tener término independiente entero.',
    );
  }
  return exponential(C.scale(ln, lin.m), C.scale(ln, lin.c));
}

function toSignal(node: MathNode, options: SignalOptions): Signal {
  switch (node.type) {
    case 'ConstantNode': {
      const value = (node as unknown as { value: unknown }).value;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new SignalError('La expresión tiene un valor que no es un número.');
      }
      return value === 0 ? [] : constant(C.complex(value));
    }
    case 'SymbolNode': {
      const name = (node as unknown as { name: string }).name;
      if (name === options.variable) {
        return [{ kind: 'exp', coef: C.ONE, power: 1, rate: C.ZERO, shift: 0 }];
      }
      if (name === 'e') return constant(C.complex(Math.E));
      if (name === 'pi') return constant(C.complex(Math.PI));
      throw new SignalError(
        `La expresión solo puede depender de ${options.variable}; «${name}» no está definido.`,
      );
    }
    case 'ParenthesisNode':
      return toSignal((node as unknown as { content: MathNode }).content, options);
    case 'OperatorNode': {
      const op = node as unknown as { fn: string; args: MathNode[] };
      const [a, b] = op.args;
      switch (op.fn) {
        case 'unaryMinus':
          return scaleSignal(toSignal(a!, options), C.complex(-1));
        case 'unaryPlus':
          return toSignal(a!, options);
        case 'add':
          return addSignals(toSignal(a!, options), toSignal(b!, options));
        case 'subtract':
          return addSignals(
            toSignal(a!, options),
            scaleSignal(toSignal(b!, options), C.complex(-1)),
          );
        case 'multiply':
          return multiplySignals(toSignal(a!, options), toSignal(b!, options));
        case 'divide': {
          const divisor = asConstant(toSignal(b!, options));
          if (!divisor || C.isZero(divisor)) {
            throw new SignalError('Solo se puede dividir entre una constante distinta de cero.');
          }
          return scaleSignal(toSignal(a!, options), C.div(C.ONE, divisor));
        }
        case 'pow': {
          const base = toSignal(a!, options);
          const exponent = toSignal(b!, options);
          const exponentConstant = asConstant(exponent);
          const baseConstant = asConstant(base);
          if (exponentConstant && C.isReal(exponentConstant)) {
            const n = exponentConstant.re;
            if (baseConstant) {
              const value = Math.pow(baseConstant.re, n);
              if (!C.isReal(baseConstant) || !Number.isFinite(value)) {
                throw new SignalError('Una potencia de constantes no da un número real.');
              }
              return value === 0 ? [] : constant(C.complex(value));
            }
            if (!Number.isInteger(n) || n < 0 || n > MAX_POWER) {
              throw new SignalError(
                `Las potencias de la variable deben tener exponente entero entre 0 y ${MAX_POWER}.`,
              );
            }
            let out = constant(C.ONE);
            for (let k = 0; k < n; k++) out = multiplySignals(out, base);
            return out;
          }
          if (baseConstant) {
            const lin = asLinear(exponent);
            if (!lin) {
              throw new SignalError(`El exponente debe ser de la forma a·${options.variable} + b.`);
            }
            return constantBasePower(baseConstant, lin, options);
          }
          throw new SignalError('Esa potencia no está en la tabla de transformadas.');
        }
        default:
          throw new SignalError(`El operador «${op.fn}» no está soportado.`);
      }
    }
    case 'FunctionNode': {
      const fn = node as unknown as { fn: { name: string }; args: MathNode[] };
      const raw = fn.fn.name;
      const name = FUNCTION_ALIASES[raw] ?? raw;
      if (fn.args.length !== 1) throw new SignalError(`«${raw}» recibe un solo argumento.`);
      const arg = fn.args[0]!;
      if (name === 'u') return unitStep(linearArgument(arg, options, 'u( )'), options);
      if (name === 'delta') return impulse(linearArgument(arg, options, 'delta( )'), options);
      if (['sin', 'cos', 'sinh', 'cosh', 'exp'].includes(name)) {
        const inner = toSignal(arg, options);
        const constantArg = asConstant(inner);
        if (constantArg && C.isReal(constantArg)) {
          const fns: Record<string, (x: number) => number> = {
            sin: Math.sin,
            cos: Math.cos,
            sinh: Math.sinh,
            cosh: Math.cosh,
            exp: Math.exp,
          };
          const value = fns[name]!(constantArg.re);
          return value === 0 ? [] : constant(C.complex(value));
        }
        const lin = asLinear(inner);
        if (!lin) {
          throw new SignalError(
            `El argumento de ${raw} debe ser de la forma a·${options.variable} + b.`,
          );
        }
        return trig(name, lin);
      }
      if (name === 'sqrt' || name === 'abs') {
        const inner = asConstant(toSignal(arg, options));
        if (!inner || !C.isReal(inner) || (name === 'sqrt' && inner.re < 0)) {
          throw new SignalError(`${raw} solo se admite sobre constantes.`);
        }
        return constant(C.complex(name === 'sqrt' ? Math.sqrt(inner.re) : Math.abs(inner.re)));
      }
      if (raw === 'log' || raw === 'ln') {
        throw new SignalError('El logaritmo no está en la tabla de transformadas.');
      }
      throw new SignalError(`La función «${raw}» no está en la tabla de transformadas.`);
    }
    default:
      throw new SignalError('La expresión no es válida.');
  }
}

function parseNode(source: string): { ok: true; node: MathNode } | { ok: false; message: string } {
  const trimmed = source.trim();
  if (trimmed === '') return { ok: false, message: 'Escribe la función.' };
  if (trimmed.length > MAX_LENGTH) {
    return {
      ok: false,
      message: `La expresión es demasiado larga (máximo ${MAX_LENGTH} caracteres).`,
    };
  }
  try {
    return { ok: true, node: parse(trimmed.replace(/δ/g, 'delta')) };
  } catch {
    return { ok: false, message: 'La expresión no es válida: revisa los paréntesis y operadores.' };
  }
}

/** Lee una señal escrita por el estudiante (p. ej. `5 + 3e^(-2t)sin(4t) - u(t-1)`). */
export function parseSignal(source: string, options: SignalOptions): SignalResult {
  const parsed = parseNode(source);
  if (!parsed.ok) return parsed;
  try {
    return { ok: true, signal: toSignal(parsed.node, options) };
  } catch (error) {
    if (error instanceof SignalError) return { ok: false, message: error.message };
    return { ok: false, message: 'La expresión no es válida.' };
  }
}

/** Separa la suma de primer nivel en sus términos (para transformar término a término). */
export function splitTerms(
  source: string,
): { ok: true; terms: { node: MathNode; sign: 1 | -1 }[] } | { ok: false; message: string } {
  const parsed = parseNode(source);
  if (!parsed.ok) return parsed;
  const terms: { node: MathNode; sign: 1 | -1 }[] = [];
  const walk = (node: MathNode, sign: 1 | -1) => {
    if (node.type === 'ParenthesisNode') {
      const inner = (node as unknown as { content: MathNode }).content;
      if (inner.type === 'OperatorNode') {
        const op = inner as unknown as { fn: string };
        if (op.fn === 'add' || op.fn === 'subtract') return walk(inner, sign);
      }
    }
    if (node.type === 'OperatorNode') {
      const op = node as unknown as { fn: string; args: MathNode[] };
      if (op.fn === 'add') {
        walk(op.args[0]!, sign);
        walk(op.args[1]!, sign);
        return;
      }
      if (op.fn === 'subtract') {
        walk(op.args[0]!, sign);
        walk(op.args[1]!, (sign * -1) as 1 | -1);
        return;
      }
    }
    terms.push({ node, sign });
  };
  walk(parsed.node, 1);
  return { ok: true, terms };
}

/** Señal de un nodo ya leído (para cada término de `splitTerms`). */
export function signalOfNode(node: MathNode, options: SignalOptions): SignalResult {
  try {
    return { ok: true, signal: toSignal(node, options) };
  } catch (error) {
    if (error instanceof SignalError) return { ok: false, message: error.message };
    return { ok: false, message: 'La expresión no es válida.' };
  }
}

const TEX_HANDLERS: Record<string, string> = {
  u: 'u',
  escalon: 'u',
  heaviside: 'u',
  delta: '\\delta',
  impulso: '\\delta',
  sen: '\\sin',
  senh: '\\sinh',
};

/** LaTeX de una expresión de señal, con u(·) y δ(·) como en los libros. */
export function signalNodeTex(node: MathNode): string {
  return node.toTex({
    implicit: 'hide',
    parenthesis: 'auto',
    handler: (child: MathNode, options: object) => {
      if (child.type !== 'FunctionNode') return undefined;
      const fn = child as unknown as { fn: { name: string }; args: MathNode[] };
      const symbol = TEX_HANDLERS[fn.fn.name];
      if (!symbol) return undefined;
      const inner = fn.args.map((a) => a.toTex(options)).join(',');
      return `${symbol}\\left(${inner}\\right)`;
    },
  });
}

/** LaTeX de la expresión escrita por el estudiante, o `null` si no se puede leer. */
export function signalTex(source: string): string | null {
  const parsed = parseNode(source);
  return parsed.ok ? signalNodeTex(parsed.node) : null;
}

/**
 * Horizonte de tiempo razonable para graficar una señal: unas cinco constantes de tiempo del
 * término más lento, tres periodos de la oscilación más lenta y más allá del último retardo.
 */
export function plotHorizon(signals: Signal[], fallback = 10): number {
  let horizon = 0;
  let any = false;
  for (const signal of signals) {
    for (const term of signal) {
      horizon = Math.max(horizon, term.shift * 1.5);
      if (term.kind !== 'exp') continue;
      any = true;
      const sigma = term.rate.re;
      const omega = Math.abs(term.rate.im);
      if (sigma < -1e-12) horizon = Math.max(horizon, term.shift + 5 / -sigma);
      if (omega > 1e-12) horizon = Math.max(horizon, term.shift + (3 * 2 * Math.PI) / omega);
      if (sigma >= -1e-12 && omega <= 1e-12) horizon = Math.max(horizon, term.shift + fallback / 2);
    }
  }
  if (!any && horizon === 0) return fallback;
  return horizon > 0 ? horizon : fallback;
}
