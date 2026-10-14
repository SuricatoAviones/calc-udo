/**
 * Transformada Z unilateral de sucesiones y su inversa por fracciones parciales de X(z)/z.
 *
 *   Z{aᵏ} = z/(z − a)        Z{C(k, j)·a^{k−j}} = z/(z − a)^{j+1}        Z{δ(k − m)} = z^{−m}
 *   Z{x(k − m)u(k − m)} = z^{−m}X(z)                                  (traslación real)
 *
 * kⁿaᵏ se escribe en la base C(k, j)·a^{k−j} con los números de Stirling de segunda especie:
 * kⁿ = Σ_j S(n, j)·j!·C(k, j). Así toda la tabla sale de un solo par.
 *
 * Como en Kuo (sec. 2-11-4), para invertir se expande X(z)/z: cada término K/(z − p)^r da
 * K·z/(z − p)^r en X(z), cuya inversa es K·C(k, r − 1)·p^{k−r+1}; un polo en z = 0 da impulsos.
 *
 * Fuente: Kuo, *Sistemas de Control Automático*, 7.ª ed., sec. 2-11 y 2-12 y apéndice C.
 */
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import { toLatexNumber } from '@/lib/math/format';
import { mulPoly, trimPoly, type Poly } from '@/lib/math/polynomials';
import { binomial, DIGITS, groupToRational, joinTerms, type LaplaceGroup } from './laplace';
import { partialFractions, type PoleExpansion } from './partial-fractions';
import type { ExpTerm, Signal } from './signal';

const n = (v: number) => toLatexNumber(v, DIGITS);

function stirling2(nn: number, k: number): number {
  if (nn === 0 && k === 0) return 1;
  if (nn === 0 || k === 0) return 0;
  return k * stirling2(nn - 1, k) + stirling2(nn - 1, k - 1);
}

function factorial(k: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
}

/** Forma de polos de X(z)/z: Σ K/(z − p)^r. */
type PoleForm = PoleExpansion[];

function samePole(a: Complex, b: Complex): boolean {
  return C.abs(C.sub(a, b)) <= 1e-12 * Math.max(1, C.abs(a));
}

function addTo(form: PoleForm, pole: Complex, order: number, coef: Complex) {
  let entry = form.find((p) => samePole(p.pole, pole));
  if (!entry) {
    entry = { pole, multiplicity: 0, residues: [] };
    form.push(entry);
  }
  while (entry.residues.length < order) entry.residues.push(C.ZERO);
  entry.multiplicity = Math.max(entry.multiplicity, order);
  entry.residues[order - 1] = C.add(entry.residues[order - 1]!, coef);
}

function merge(form: PoleForm, other: PoleForm) {
  for (const p of other) p.residues.forEach((r, k) => addTo(form, p.pole, k + 1, r));
}

/** X(z)/z de c·kⁿ·pᵏ (sin retardo). */
function undelayedForm(term: ExpTerm): PoleForm {
  const p = C.exp(term.rate);
  const form: PoleForm = [];
  for (let j = 0; j <= term.power; j++) {
    const s = stirling2(term.power, j);
    if (s === 0) continue;
    addTo(form, p, j + 1, C.scale(C.mul(term.coef, C.powInt(p, j)), s * factorial(j)));
  }
  return form;
}

/** Racional de una forma de polos (N/D en la variable z). */
function formToRational(form: PoleForm): { num: Poly; den: Poly } {
  const group: LaplaceGroup = { delay: 0, impulse: C.ZERO, poles: form };
  return groupToRational(group);
}

/** Multiplica X(z)/z por z^{−m} y vuelve a expandir. */
function delayForm(form: PoleForm, m: number): PoleForm {
  if (m === 0) return form;
  const { num, den } = formToRational(form);
  const shifted = mulPoly(den, [1, ...Array<number>(m).fill(0)]);
  return partialFractions(num, shifted).poles;
}

/** Z{señal} en forma de polos de X(z)/z. */
export function zFormOfSignal(signal: Signal): PoleForm {
  const form: PoleForm = [];
  for (const term of signal) {
    const m = Math.round(term.shift);
    if (term.kind === 'impulse') {
      // c·δ(k − m) ↔ c·z^{−m}: en X(z)/z es c/z^{m+1}.
      addTo(form, C.ZERO, m + 1, term.coef);
      continue;
    }
    if (m === 0) {
      merge(form, undelayedForm(term));
      continue;
    }
    // c·kⁿ·pᵏ·u(k − m) = c·pᵐ·Σ_i C(n, i)·m^{n−i}·jⁱ·pʲ con j = k − m, retardado m muestras.
    const p = C.exp(term.rate);
    const inner: PoleForm = [];
    for (let i = 0; i <= term.power; i++) {
      const coef = C.scale(
        C.mul(term.coef, C.powInt(p, m)),
        binomial(term.power, i) * m ** (term.power - i),
      );
      merge(inner, undelayedForm({ ...term, coef, power: i, shift: 0 }));
    }
    merge(form, delayForm(inner, m));
  }
  return form;
}

/** X(z) = z·[X(z)/z] como N/D, sin factores z comunes. */
export function zRational(form: PoleForm): { num: Poly; den: Poly } {
  if (form.length === 0) return { num: [0], den: [1] };
  const { num, den } = formToRational(form);
  let N = trimPoly([...num, 0]);
  let D = trimPoly(den);
  while (N.length > 1 && D.length > 1 && N[N.length - 1] === 0 && D[D.length - 1] === 0) {
    N = N.slice(0, -1);
    D = D.slice(0, -1);
  }
  return { num: N, den: D };
}

// ─── Inversa ────────────────────────────────────────────────────────────────

/** Término de la sucesión: K·C(k, r − 1)·p^{k−r+1} (con su conjugado si p es complejo). */
export interface SequenceTerm {
  pole: Complex;
  order: number;
  residue: Complex;
}

export function sequenceTerms(form: PoleForm): SequenceTerm[] {
  const out: SequenceTerm[] = [];
  const size = Math.max(1e-300, ...form.flatMap((p) => p.residues.map((r) => C.abs(r))));
  for (const p of form) {
    if (p.pole.im < 0) continue;
    p.residues.forEach((residue, k) => {
      if (C.abs(residue) > 1e-10 * size) out.push({ pole: p.pole, order: k + 1, residue });
    });
  }
  return out;
}

/** Valor del término en k (entero ≥ 0). */
function termAt(term: SequenceTerm, k: number): number {
  const r = term.order;
  if (C.isZero(term.pole)) return k === r - 1 ? term.residue.re : 0;
  if (k < r - 1) return 0;
  const value = C.scale(C.mul(term.residue, C.powInt(term.pole, k - r + 1)), binomial(k, r - 1));
  return term.pole.im > 0 ? 2 * value.re : value.re;
}

export function evaluateSequence(terms: SequenceTerm[], k: number): number {
  return terms.reduce((sum, t) => sum + termAt(t, k), 0);
}

/** Base de una potencia entre paréntesis, como en Kuo: `2.07(0.447)^{k}`, `3(-1)^{k}`. */
function baseTex(p: number): string {
  return `\\left(${n(p)}\\right)`;
}

/** k − m en LaTeX. */
function shiftTex(m: number): string {
  return m === 0 ? 'k' : `k - ${m}`;
}

function binomialTex(r: number): string {
  if (r === 1) return '';
  if (r === 2) return 'k';
  return `\\binom{k}{${r - 1}}`;
}

/** LaTeX de los términos de la sucesión (para unir con `joinTerms`). */
export function sequenceTermsTex(terms: SequenceTerm[]): { coef: number; body: string }[] {
  const out: { coef: number; body: string }[] = [];
  for (const t of terms) {
    const r = t.order;
    if (C.isZero(t.pole)) {
      out.push({ coef: t.residue.re, body: `\\delta\\left(${shiftTex(r - 1)}\\right)` });
      continue;
    }
    const exponent = r === 1 ? 'k' : `k - ${r - 1}`;
    const binom = binomialTex(r);
    if (t.pole.im === 0) {
      const p = t.pole.re;
      const power = p === 1 ? '' : `${baseTex(p)}^{${exponent}}`;
      out.push({ coef: t.residue.re, body: `${binom}${power}` });
      continue;
    }
    const magnitude = C.abs(t.pole);
    const omega = C.arg(t.pole);
    // Como Kuo (ec. 2-222), la fase se deja en (−π/2, π/2]: si no cae ahí, se cambia el signo de
    // la amplitud y se resta π (cos(x + π) = −cos x).
    let theta = C.arg(t.residue);
    let amplitude = 2 * C.abs(t.residue);
    if (Math.abs(theta) > Math.PI / 2 + 1e-12) {
      theta -= Math.sign(theta) * Math.PI;
      amplitude = -amplitude;
    }
    const radius = magnitude === 1 ? '' : `${baseTex(magnitude)}^{${exponent}}`;
    const angle = r === 1 ? `${n(omega)}k` : `${n(omega)}\\left(k - ${r - 1}\\right)`;
    const phase = Math.abs(theta) < 1e-12 ? '' : ` ${theta < 0 ? '-' : '+'} ${n(Math.abs(theta))}`;
    out.push({
      coef: amplitude,
      body: `${binom}${radius}\\cos\\left(${angle}${phase}\\right)`,
    });
  }
  return out;
}

export function sequenceTex(terms: SequenceTerm[]): string {
  return joinTerms(sequenceTermsTex(terms));
}

/** Valor de una señal discreta en k (los impulsos de Kronecker sí cuentan). */
export function signalAt(signal: Signal, k: number): number {
  let sum = 0;
  for (const term of signal) {
    if (term.kind === 'impulse') {
      if (Math.round(term.shift) === k) sum += term.coef.re;
      continue;
    }
    if (k < term.shift) continue;
    const value = C.mul(
      C.scale(term.coef, term.power === 0 ? 1 : k ** term.power),
      C.exp(C.scale(term.rate, k)),
    );
    sum += value.re;
  }
  return sum;
}
