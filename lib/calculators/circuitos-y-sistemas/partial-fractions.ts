/**
 * Expansión en fracciones parciales de F(x) = N(x)/D(x), con polos reales, complejos y
 * repetidos (Hayt, Kemmerly y Durbin, 8.ª ed., sec. 14.5; Dorf y Svoboda, 9.ª ed., sec. 14.4):
 *
 *   F(x) = Q(x) + Σ_p Σ_{k=1}^{m} K_{p,k} / (x − p)^k
 *
 * Q es el cociente de la división larga cuando F no es propia. Para un polo p de multiplicidad m,
 * con G(x) = (x − p)^m F(x), los residuos son K_{p,m−j} = G⁽ʲ⁾(p)/j!, que se obtienen dividiendo
 * las series de Taylor del numerador y del resto del denominador alrededor de p (sin derivar
 * simbólicamente). Para un polo simple es la regla de "tapar" (cover-up): K = N(p)/D′(p).
 *
 * Es independiente de la variable: Laplace la usa con s y la transformada Z con z (sobre X(z)/z).
 */
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import {
  deflate,
  dividePoly,
  evalPolyComplex,
  polyRoots,
  taylorCoefficients,
  trimPoly,
  type Poly,
} from '@/lib/math/polynomials';

export interface PoleExpansion {
  pole: Complex;
  multiplicity: number;
  /** residues[k − 1] es el coeficiente de 1/(x − p)^k. */
  residues: Complex[];
}

export interface PartialFractions {
  /** Cociente (parte polinomial) cuando grado(N) ≥ grado(D). */
  direct: Poly;
  /** Residuo de la división larga: F = Q + R/D. */
  remainder: Poly;
  /** Coeficiente principal del denominador. */
  lead: number;
  poles: PoleExpansion[];
}

/** Desarrollo en serie de G = A/B a partir de sus coeficientes de Taylor (B₀ ≠ 0). */
function seriesDivide(a: Complex[], b: Complex[], order: number): Complex[] {
  const g: Complex[] = [];
  for (let k = 0; k <= order; k++) {
    let acc = a[k] ?? C.ZERO;
    for (let i = 1; i <= k; i++) acc = C.sub(acc, C.mul(b[i] ?? C.ZERO, g[k - i]!));
    g.push(C.div(acc, b[0]!));
  }
  return g;
}

/**
 * Fracciones parciales de N/D. Los polos complejos se calculan en la mitad superior y sus
 * conjugados reciben los residuos conjugados (el resultado es exactamente simétrico).
 */
export function partialFractions(num: Poly, den: Poly): PartialFractions {
  const d = trimPoly(den);
  const lead = d[0]!;
  const { quotient, remainder } = dividePoly(num, d);
  const roots = polyRoots(d);
  const poles: PoleExpansion[] = [];
  for (const root of roots) {
    if (root.value.im < 0) continue;
    const m = root.multiplicity;
    const rest = deflate(d, root.value, m);
    const a = taylorCoefficients(remainder, root.value, m - 1);
    const b = taylorCoefficients(rest, root.value, m - 1);
    const g = seriesDivide(a, b, m - 1);
    // g_j es el coeficiente de (x − p)^{j − m}: K_{m − j}.
    const residues = Array.from({ length: m }, (_, k) => C.clean(g[m - 1 - k]!, 1e-11));
    poles.push({ pole: root.value, multiplicity: m, residues });
    if (root.value.im > 0) {
      poles.push({
        pole: C.conj(root.value),
        multiplicity: m,
        residues: residues.map((r) => C.conj(r)),
      });
    }
  }
  const isZeroQuotient = quotient.length === 1 && quotient[0] === 0;
  return { direct: isZeroQuotient ? [] : quotient, remainder, lead, poles };
}

/** Polo y orden que efectivamente aparecen (residuo no nulo). */
export function significantTerms(
  pf: PartialFractions,
): { pole: Complex; order: number; residue: Complex }[] {
  const out: { pole: Complex; order: number; residue: Complex }[] = [];
  const size = Math.max(1e-300, ...pf.poles.flatMap((p) => p.residues.map((r) => C.abs(r))));
  for (const p of pf.poles) {
    p.residues.forEach((residue, k) => {
      if (C.abs(residue) > 1e-10 * size) out.push({ pole: p.pole, order: k + 1, residue });
    });
  }
  return out;
}

/** Evalúa la expansión en x (para verificar contra N/D). */
export function evaluateExpansion(pf: PartialFractions, x: Complex): Complex {
  let sum = evalPolyComplex(pf.direct.length ? pf.direct : [0], x);
  for (const p of pf.poles) {
    p.residues.forEach((r, k) => {
      sum = C.add(sum, C.div(r, C.powInt(C.sub(x, p.pole), k + 1)));
    });
  }
  return sum;
}
