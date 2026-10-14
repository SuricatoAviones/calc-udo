/**
 * Transformada de Laplace unilateral para la familia de `signal.ts` y su inversa por fracciones
 * parciales.
 *
 *   ℒ{tⁿ e^{αt}} = n!/(s − α)^{n+1}        ℒ{δ(t − a)} = e^{−as}
 *   ℒ{f(t − a) u(t − a)} = e^{−as} F(s)    (desplazamiento en el tiempo)
 *
 * Una transformada se guarda como grupos {retardo a, F_a(s)}: F(s) = Σ e^{−as} F_a(s), con F_a
 * racional. Así se transforman pulsos y se invierten productos con retardos (convolución).
 *
 * Fuentes: Hayt, Kemmerly y Durbin, 8.ª ed., cap. 14 (tabla 14.1 y 14.2); Dorf y Svoboda,
 * 9.ª ed., sec. 14.2 a 14.4.
 */
import { parse, type MathNode } from 'mathjs';
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import { toLatexNumber } from '@/lib/math/format';
import {
  addPoly,
  deflate,
  dividePoly,
  isZeroPoly,
  mulPoly,
  polyFromRoots,
  powPoly,
  scalePoly,
  trimPoly,
  type Poly,
  type PolyRoot,
} from '@/lib/math/polynomials';
import { polynomialLatex } from '@/lib/calculators/metodos-numericos/polynomial';
import type { PoleExpansion } from './partial-fractions';
import type { Signal } from './signal';

export const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

function factorial(k: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
}

function binomial(nn: number, k: number): number {
  if (k < 0 || k > nn) return 0;
  return factorial(nn) / (factorial(k) * factorial(nn - k));
}

// ─── Transformada directa ───────────────────────────────────────────────────

export interface LaplaceGroup {
  /** Retardo a: el grupo va multiplicado por e^{−as}. */
  delay: number;
  /** Constante que aportan los impulsos. */
  impulse: Complex;
  poles: PoleExpansion[];
}

function samePole(a: Complex, b: Complex): boolean {
  return C.abs(C.sub(a, b)) <= 1e-12 * Math.max(1, C.abs(a));
}

function addPoleTerm(group: LaplaceGroup, pole: Complex, order: number, coef: Complex) {
  let entry = group.poles.find((p) => samePole(p.pole, pole));
  if (!entry) {
    entry = { pole, multiplicity: 0, residues: [] };
    group.poles.push(entry);
  }
  while (entry.residues.length < order) entry.residues.push(C.ZERO);
  entry.multiplicity = Math.max(entry.multiplicity, order);
  entry.residues[order - 1] = C.add(entry.residues[order - 1]!, coef);
}

function groupFor(groups: LaplaceGroup[], delay: number): LaplaceGroup {
  let group = groups.find((g) => Math.abs(g.delay - delay) < 1e-12);
  if (!group) {
    group = { delay, impulse: C.ZERO, poles: [] };
    groups.push(group);
  }
  return group;
}

/** ℒ{señal} en grupos por retardo, cada uno en forma de polos y residuos. */
export function laplaceOfSignal(signal: Signal): LaplaceGroup[] {
  const groups: LaplaceGroup[] = [];
  for (const term of signal) {
    const group = groupFor(groups, term.shift);
    if (term.kind === 'impulse') {
      group.impulse = C.add(group.impulse, term.coef);
      continue;
    }
    const a = term.shift;
    if (a === 0) {
      addPoleTerm(group, term.rate, term.power + 1, C.scale(term.coef, factorial(term.power)));
      continue;
    }
    // c·tⁿ·e^{αt}·u(t − a) = c·e^{αa}·Σ_j C(n, j)·a^{n−j}·τʲ·e^{ατ}, con τ = t − a.
    const base = C.mul(term.coef, C.exp(C.scale(term.rate, a)));
    for (let j = 0; j <= term.power; j++) {
      const coef = C.scale(base, binomial(term.power, j) * a ** (term.power - j) * factorial(j));
      addPoleTerm(group, term.rate, j + 1, coef);
    }
  }
  return groups.sort((x, y) => x.delay - y.delay);
}

/** Polinomios reales N y D de un grupo: F_a(s) = N(s)/D(s). */
export function groupToRational(group: LaplaceGroup): { num: Poly; den: Poly } {
  const size = Math.max(
    1e-300,
    C.abs(group.impulse),
    ...group.poles.flatMap((p) => p.residues.map((r) => C.abs(r))),
  );
  const negligible = (z: Complex) => C.abs(z) <= 1e-12 * size;
  const poles = group.poles
    .map((p) => {
      let m = p.residues.length;
      while (m > 0 && negligible(p.residues[m - 1]!)) m--;
      return { pole: p.pole, residues: p.residues.slice(0, m), multiplicity: m };
    })
    .filter((p) => p.multiplicity > 0);
  const roots: Complex[] = poles.flatMap((p) =>
    Array.from({ length: p.multiplicity }, () => p.pole),
  );
  const den = polyFromRoots(roots);
  let num: Complex[] = den.map((c) => C.scale(group.impulse, c));
  for (const p of poles) {
    p.residues.forEach((r, k) => {
      const part = deflate(den, p.pole, k + 1).map((c) => C.mul(c, r));
      const offset = num.length - part.length;
      num = num.map((c, i) => (i >= offset ? C.add(c, part[i - offset]!) : c));
    });
  }
  const real = num.map((c) => (Math.abs(c.re) <= 1e-11 * size ? 0 : c.re));
  return { num: trimPoly(real), den: trimPoly(den) };
}

// ─── Funciones racionales con retardos: lectura de F(s) ─────────────────────

export interface DelayedRational {
  delay: number;
  num: Poly;
  den: Poly;
}

type Transform = DelayedRational[];

class TransformError extends Error {}

function sameDen(a: Poly, b: Poly): boolean {
  return (
    a.length === b.length &&
    a.every((c, i) => Math.abs(c - b[i]!) <= 1e-12 * Math.max(1, Math.abs(c)))
  );
}

function addRational(a: DelayedRational, b: DelayedRational): DelayedRational {
  if (sameDen(a.den, b.den)) return { delay: a.delay, num: addPoly(a.num, b.num), den: a.den };
  return {
    delay: a.delay,
    num: addPoly(mulPoly(a.num, b.den), mulPoly(b.num, a.den)),
    den: mulPoly(a.den, b.den),
  };
}

export function addTransforms(a: Transform, b: Transform): Transform {
  const out = a.map((r) => ({ ...r }));
  for (const r of b) {
    const i = out.findIndex((x) => Math.abs(x.delay - r.delay) < 1e-12);
    if (i === -1) out.push({ ...r });
    else out[i] = addRational(out[i]!, r);
  }
  return out.filter((r) => !isZeroPoly(r.num));
}

function scaleTransform(a: Transform, k: number): Transform {
  return a.map((r) => ({ ...r, num: scalePoly(r.num, k) })).filter((r) => !isZeroPoly(r.num));
}

export function multiplyTransforms(a: Transform, b: Transform): Transform {
  let out: Transform = [];
  for (const x of a) {
    for (const y of b) {
      out = addTransforms(out, [
        { delay: x.delay + y.delay, num: mulPoly(x.num, y.num), den: mulPoly(x.den, y.den) },
      ]);
    }
  }
  return out;
}

function single(a: Transform): DelayedRational | null {
  if (a.length === 0) return { delay: 0, num: [0], den: [1] };
  return a.length === 1 ? a[0]! : null;
}

function constantOf(a: Transform): number | null {
  const r = single(a);
  if (!r || r.delay !== 0) return null;
  const num = trimPoly(r.num);
  const den = trimPoly(r.den);
  if (num.length !== 1 || den.length !== 1) return null;
  return num[0]! / den[0]!;
}

/** Si la transformada es a·x + b (sin retardo), devuelve a y b. */
function linearOf(a: Transform): { m: number; c: number } | null {
  const r = single(a);
  if (!r || r.delay !== 0) return null;
  const den = trimPoly(r.den);
  const num = trimPoly(r.num);
  if (den.length !== 1 || num.length > 2) return null;
  const scaled = num.map((c) => c / den[0]!);
  return scaled.length === 2 ? { m: scaled[0]!, c: scaled[1]! } : { m: 0, c: scaled[0]! };
}

function toTransform(node: MathNode, variable: string): Transform {
  switch (node.type) {
    case 'ConstantNode': {
      const value = (node as unknown as { value: unknown }).value;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TransformError('La expresión tiene un valor que no es un número.');
      }
      return value === 0 ? [] : [{ delay: 0, num: [value], den: [1] }];
    }
    case 'SymbolNode': {
      const name = (node as unknown as { name: string }).name;
      if (name === variable) return [{ delay: 0, num: [1, 0], den: [1] }];
      if (name === 'e') return [{ delay: 0, num: [Math.E], den: [1] }];
      if (name === 'pi') return [{ delay: 0, num: [Math.PI], den: [1] }];
      throw new TransformError(
        `La expresión solo puede depender de ${variable}; «${name}» no está definido.`,
      );
    }
    case 'ParenthesisNode':
      return toTransform((node as unknown as { content: MathNode }).content, variable);
    case 'OperatorNode': {
      const op = node as unknown as { fn: string; args: MathNode[] };
      const [a, b] = op.args;
      switch (op.fn) {
        case 'unaryMinus':
          return scaleTransform(toTransform(a!, variable), -1);
        case 'unaryPlus':
          return toTransform(a!, variable);
        case 'add':
          return addTransforms(toTransform(a!, variable), toTransform(b!, variable));
        case 'subtract':
          return addTransforms(
            toTransform(a!, variable),
            scaleTransform(toTransform(b!, variable), -1),
          );
        case 'multiply':
          return multiplyTransforms(toTransform(a!, variable), toTransform(b!, variable));
        case 'divide': {
          const divisor = single(toTransform(b!, variable));
          if (!divisor || isZeroPoly(divisor.num)) {
            throw new TransformError(
              'No se puede dividir entre una suma de términos con distintos retardos.',
            );
          }
          if (divisor.delay > 0) {
            throw new TransformError(`Dividir entre e^{-a${variable}} no da una función causal.`);
          }
          return multiplyTransforms(toTransform(a!, variable), [
            { delay: 0, num: divisor.den, den: divisor.num },
          ]);
        }
        case 'pow': {
          const exponent = constantOf(toTransform(b!, variable));
          const baseNode = a!;
          if (
            baseNode.type === 'SymbolNode' &&
            (baseNode as unknown as { name: string }).name === 'e'
          ) {
            return exponential(toTransform(b!, variable), variable);
          }
          if (exponent === null || !Number.isInteger(exponent) || Math.abs(exponent) > 20) {
            throw new TransformError(
              `Los exponentes de ${variable} deben ser enteros (entre −20 y 20).`,
            );
          }
          const base = single(toTransform(baseNode, variable));
          if (!base) {
            throw new TransformError('No se puede elevar a una potencia una suma con retardos.');
          }
          const k = Math.abs(exponent);
          const powered = {
            delay: base.delay * k,
            num: powPoly(base.num, k),
            den: powPoly(base.den, k),
          };
          if (exponent >= 0) return [powered];
          if (powered.delay > 0) {
            throw new TransformError(`Dividir entre e^{-a${variable}} no da una función causal.`);
          }
          return [{ delay: 0, num: powered.den, den: powered.num }];
        }
        default:
          throw new TransformError(`El operador «${op.fn}» no está soportado.`);
      }
    }
    case 'FunctionNode': {
      const fn = node as unknown as { fn: { name: string }; args: MathNode[] };
      const name = fn.fn.name;
      if (fn.args.length !== 1) throw new TransformError(`«${name}» recibe un solo argumento.`);
      if (name === 'exp') return exponential(toTransform(fn.args[0]!, variable), variable);
      if (name === 'sqrt') {
        const value = constantOf(toTransform(fn.args[0]!, variable));
        if (value === null || value < 0) {
          throw new TransformError('sqrt solo se admite sobre constantes no negativas.');
        }
        return [{ delay: 0, num: [Math.sqrt(value)], den: [1] }];
      }
      throw new TransformError(
        `La función «${name}» no está soportada en el dominio de ${variable}.`,
      );
    }
    default:
      throw new TransformError('La expresión no es válida.');
  }
}

/** e^{m·x + c}: solo se admite m ≤ 0 (retardo e^{−as}). */
function exponential(exponent: Transform, variable: string): Transform {
  const lin = linearOf(exponent);
  if (!lin) {
    throw new TransformError(`El exponente de e debe ser de la forma −a·${variable} + b.`);
  }
  if (lin.m > 0)
    throw new TransformError(`e^{a${variable}} con a > 0 no corresponde a una señal causal.`);
  const factor = Math.exp(lin.c);
  return [{ delay: -lin.m, num: [factor], den: [1] }];
}

export type TransformResult =
  { ok: true; groups: DelayedRational[]; node: MathNode } | { ok: false; message: string };

/**
 * Lee F(s) (o X(z)) escrita por el estudiante: polinomios, cocientes, potencias enteras y
 * factores e^{−as}. Devuelve los grupos por retardo, cada uno como N/D.
 */
export function parseTransform(source: string, variable: string): TransformResult {
  const trimmed = source.trim();
  if (trimmed === '') return { ok: false, message: `Escribe la función de ${variable}.` };
  if (trimmed.length > 300) return { ok: false, message: 'La expresión es demasiado larga.' };
  let node: MathNode;
  try {
    node = parse(trimmed);
  } catch {
    return { ok: false, message: 'La expresión no es válida: revisa los paréntesis y operadores.' };
  }
  try {
    const groups = toTransform(node, variable)
      .map((g) => ({ ...g, num: trimPoly(g.num), den: trimPoly(g.den) }))
      .sort((x, y) => x.delay - y.delay);
    if (groups.length === 0) return { ok: false, message: 'La función es idénticamente 0.' };
    return { ok: true, groups, node };
  } catch (error) {
    if (error instanceof TransformError) return { ok: false, message: error.message };
    return { ok: false, message: 'La expresión no es válida.' };
  }
}

// ─── Respuesta en el tiempo ─────────────────────────────────────────────────

/** tⁿ e^{σt} (A cos ωt + B sin ωt), con ω ≥ 0. */
export interface TimePiece {
  power: number;
  sigma: number;
  omega: number;
  a: number;
  b: number;
}

/** Inversa término a término de una expansión: K/(s − p)^k ↔ K tᵏ⁻¹ e^{pt}/(k − 1)!. */
export function timePieces(poles: PoleExpansion[]): TimePiece[] {
  const pieces: TimePiece[] = [];
  for (const p of poles) {
    if (p.pole.im < 0) continue;
    p.residues.forEach((residue, index) => {
      const k = index + 1;
      const f = factorial(k - 1);
      const complexPole = p.pole.im > 0;
      const piece: TimePiece = {
        power: k - 1,
        sigma: p.pole.re,
        omega: complexPole ? p.pole.im : 0,
        a: (complexPole ? 2 * residue.re : residue.re) / f,
        b: complexPole ? (-2 * residue.im) / f : 0,
      };
      const twin = pieces.find(
        (x) => x.power === piece.power && x.sigma === piece.sigma && x.omega === piece.omega,
      );
      if (twin) {
        twin.a += piece.a;
        twin.b += piece.b;
      } else pieces.push(piece);
    });
  }
  const size = Math.max(1e-300, ...pieces.map((x) => Math.hypot(x.a, x.b)));
  return pieces
    .map((x) => ({
      ...x,
      a: Math.abs(x.a) <= 1e-10 * size ? 0 : x.a,
      b: Math.abs(x.b) <= 1e-10 * size ? 0 : x.b,
    }))
    .filter((x) => x.a !== 0 || x.b !== 0);
}

export function evaluatePieces(pieces: TimePiece[], t: number): number {
  let sum = 0;
  for (const p of pieces) {
    const envelope = (p.power === 0 ? 1 : t ** p.power) * Math.exp(p.sigma * t);
    sum += envelope * (p.a * Math.cos(p.omega * t) + p.b * Math.sin(p.omega * t));
  }
  return sum;
}

/** `-2t`, `-t`, `3(t - 1)`: coeficiente por variable dentro de un exponente o un coseno. */
function times(coef: number, variable: string): string {
  if (coef === 1) return variable;
  if (coef === -1) return `-${variable}`;
  return `${n(coef)}${variable}`;
}

/** LaTeX de los términos (con su signo) de una lista de piezas, en la variable dada. */
export function piecesLatexTerms(
  pieces: TimePiece[],
  variable = 't',
): { coef: number; body: string }[] {
  const terms: { coef: number; body: string }[] = [];
  const grouped = variable.length > 1 ? `\\left(${variable}\\right)` : variable;
  for (const p of pieces) {
    const power = p.power === 0 ? '' : p.power === 1 ? grouped : `${grouped}^{${p.power}}`;
    const exp = p.sigma === 0 ? '' : `e^{${times(p.sigma, grouped)}}`;
    const envelope = `${power}${exp}`;
    if (p.omega === 0) {
      terms.push({ coef: p.a, body: envelope });
      continue;
    }
    const arg = times(p.omega, grouped);
    if (p.a !== 0) terms.push({ coef: p.a, body: `${envelope}\\cos\\left(${arg}\\right)` });
    if (p.b !== 0) terms.push({ coef: p.b, body: `${envelope}\\sin\\left(${arg}\\right)` });
  }
  return terms;
}

/** Une términos {coef, cuerpo} en una suma LaTeX: `4 - 2e^{-t}\cos(t)`. */
export function joinTerms(terms: { coef: number; body: string }[]): string {
  if (terms.length === 0) return '0';
  return terms
    .map(({ coef, body }, i) => {
      const abs = Math.abs(coef);
      const magnitude = body === '' ? n(abs) : abs === 1 ? '' : n(abs);
      const text = `${magnitude}${body}`;
      if (i === 0) return coef < 0 ? `-${text}` : text;
      return coef < 0 ? ` - ${text}` : ` + ${text}`;
    })
    .join('');
}

/** Impulsos de la parte polinomial: q₀δ(t) + q₁δ′(t) + … */
export function impulseTerms(direct: Poly, variable = 't'): { coef: number; body: string }[] {
  const terms: { coef: number; body: string }[] = [];
  const degree = direct.length - 1;
  direct.forEach((q, i) => {
    if (q === 0) return;
    const order = degree - i;
    const prime = order === 0 ? '' : order === 1 ? "'" : order === 2 ? "''" : `^{(${order})}`;
    terms.push({ coef: q, body: `\\delta${prime}\\left(${variable}\\right)` });
  });
  return terms.reverse();
}

// ─── LaTeX de funciones racionales ──────────────────────────────────────────

export function polyTex(p: Poly, variable = 's'): string {
  return polynomialLatex(trimPoly(p), variable, DIGITS);
}

/** N/D en LaTeX; si D es constante, solo el polinomio. */
export function rationalTex(num: Poly, den: Poly, variable = 's'): string {
  const d = trimPoly(den);
  if (d.length === 1) return polyTex(scalePoly(num, 1 / d[0]!), variable);
  return `\\frac{${polyTex(num, variable)}}{${polyTex(d, variable)}}`;
}

/** Denominador factorizado: `(s + 2)(s^{2} + 6s + 10)`, `s^{2}(s + 1)`. */
export function factoredTex(roots: PolyRoot[], lead: number, variable = 's'): string {
  const factors: string[] = [];
  for (const r of roots) {
    if (r.value.im < 0) continue;
    let base: string;
    let simple = false;
    if (r.value.im === 0) {
      const p = r.value.re;
      if (p === 0) {
        base = variable;
        simple = true;
      } else base = `\\left(${variable} ${p < 0 ? '+' : '-'} ${n(Math.abs(p))}\\right)`;
    } else {
      const quad = polyFromRoots([r.value, C.conj(r.value)]);
      base = `\\left(${polyTex(quad, variable)}\\right)`;
    }
    if (r.multiplicity === 1) factors.push(base);
    else factors.push(simple ? `${base}^{${r.multiplicity}}` : `${base}^{${r.multiplicity}}`);
  }
  const prefix = lead === 1 ? '' : lead === -1 ? '-' : n(lead);
  return `${prefix}${factors.join('')}` || n(lead);
}

/** Factor de retardo `e^{-2s}` (vacío si a = 0). */
export function delayTex(delay: number, variable = 's'): string {
  if (delay === 0) return '';
  return `e^{-${delay === 1 ? '' : n(delay)}${variable}}`;
}

/** Suma de grupos con retardo: `\frac{1}{s} - e^{-s}\frac{1}{s}`. */
export function transformTex(
  groups: { delay: number; num: Poly; den: Poly }[],
  variable = 's',
): string {
  if (groups.length === 0) return '0';
  return groups
    .map((g, i) => {
      const body = rationalTex(g.num, g.den, variable);
      const factor = delayTex(g.delay, variable);
      const term = factor ? `${factor}\\,\\left[${body}\\right]` : body;
      return i === 0 || term.startsWith('-') ? term : `+ ${term}`;
    })
    .join(' ');
}

/** División larga N/D → cociente y residuo (reexporta con nombre del dominio). */
export function properPart(num: Poly, den: Poly): { quotient: Poly; remainder: Poly } {
  return dividePoly(num, den);
}

export { binomial, factorial };
