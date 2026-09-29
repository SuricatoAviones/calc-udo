/**
 * Integración numérica adaptativa para la esperanza de variables continuas: ∫ₐᵇ f(x) dx con
 * límites finitos o infinitos.
 *
 * Usa la regla de Gauss-Kronrod de 7 y 15 puntos (la diferencia entre ambas estima el error) y
 * divide a la mitad el subintervalo con más error hasta cumplir la tolerancia, como QUADPACK
 * (Piessens et al., 1983). Los nodos no incluyen los extremos, así que admite singularidades
 * integrables en ellos (p. ej. 1/√x en 0). Un límite infinito se lleva a [0, 1) con
 * x = a + t/(1 − t). Si la integral diverge, el error no baja y `converged` es `false`.
 */

export interface Integral {
  value: number;
  /** Estimación del error absoluto. */
  error: number;
  converged: boolean;
}

// Nodos de Kronrod en [−1, 1] (los de índice impar son los de Gauss) y sus pesos.
const XGK = [
  0.991455371120812639206854697526329, 0.949107912342758524526189684047851,
  0.864864423359769072789712788640926, 0.741531185599394439863864773280788,
  0.586087235467691130294144845693013, 0.405845151377397166906606412076961,
  0.207784955007898467600689403773245, 0,
] as const;
const WGK = [
  0.02293532201052922496373200805897, 0.063092092629978553290700663189204,
  0.104790010322250183839876322541518, 0.140653259715525918745189590510238,
  0.16900472663926790282658342659855, 0.190350578064785409913256402421014,
  0.204432940075298892414161999234649, 0.209482141084727828012999174891714,
] as const;
const WG = [
  0.129484966168869693270611432679082, 0.27970539148927666790146777142378,
  0.381830050505118944950369775488975, 0.417959183673469387755102040816327,
] as const;

const MAX_INTERVALS = 2000;
const RELATIVE_TOLERANCE = 1e-11;
const ABSOLUTE_TOLERANCE = 1e-13;

interface Piece {
  a: number;
  b: number;
  value: number;
  error: number;
}

function kronrod(f: (x: number) => number, a: number, b: number): Piece {
  const center = (a + b) / 2;
  const half = (b - a) / 2;
  const fc = f(center);
  let kronrodSum = fc * WGK[7];
  let gaussSum = fc * WG[3];
  for (let j = 0; j < 7; j++) {
    const dx = half * XGK[j]!;
    const pair = f(center - dx) + f(center + dx);
    kronrodSum += WGK[j]! * pair;
    if (j % 2 === 1) gaussSum += WG[(j - 1) / 2]! * pair;
  }
  return { a, b, value: kronrodSum * half, error: Math.abs((kronrodSum - gaussSum) * half) };
}

/** ∫ₐᵇ f en un intervalo finito, subdividiendo donde el error es mayor. */
function adaptive(f: (x: number) => number, a: number, b: number): Integral {
  const pieces = [kronrod(f, a, b)];
  const total = () => pieces.reduce((s, p) => s + p.value, 0);
  const totalError = () => pieces.reduce((s, p) => s + p.error, 0);
  while (pieces.length < MAX_INTERVALS) {
    const value = total();
    const error = totalError();
    if (!Number.isFinite(value) || !Number.isFinite(error)) {
      return { value: Number.NaN, error: Number.POSITIVE_INFINITY, converged: false };
    }
    if (error <= Math.max(ABSOLUTE_TOLERANCE, RELATIVE_TOLERANCE * Math.abs(value))) {
      return { value, error, converged: true };
    }
    let worst = 0;
    for (let i = 1; i < pieces.length; i++) if (pieces[i]!.error > pieces[worst]!.error) worst = i;
    const { a: left, b: right } = pieces[worst]!;
    const middle = (left + right) / 2;
    if (middle <= left || middle >= right) break; // ya no se puede dividir en doble precisión
    pieces.splice(worst, 1, kronrod(f, left, middle), kronrod(f, middle, right));
  }
  const value = total();
  const error = totalError();
  // Sin llegar a la tolerancia pedida, se acepta si el error relativo es pequeño de todos modos.
  return {
    value,
    error,
    converged: Number.isFinite(value) && error <= 1e-7 * Math.max(1, Math.abs(value)),
  };
}

/** ∫ₐᵇ f(x) dx, con a o b posiblemente infinitos. */
export function integrate(f: (x: number) => number, a: number, b: number): Integral {
  if (a === b) return { value: 0, error: 0, converged: true };
  if (a > b) {
    const result = integrate(f, b, a);
    return { ...result, value: -result.value };
  }
  if (a === -Infinity && b === Infinity) {
    const left = integrate(f, -Infinity, 0);
    const right = integrate(f, 0, Infinity);
    return {
      value: left.value + right.value,
      error: left.error + right.error,
      converged: left.converged && right.converged,
    };
  }
  if (b === Infinity) {
    // x = a + t/(1 − t), dx = dt/(1 − t)²
    return adaptive((t) => f(a + t / (1 - t)) / (1 - t) ** 2, 0, 1);
  }
  if (a === -Infinity) {
    // x = b − t/(1 − t)
    return adaptive((t) => f(b - t / (1 - t)) / (1 - t) ** 2, 0, 1);
  }
  return adaptive(f, a, b);
}
