/**
 * Medidas de error de aproximaciones sucesivas.
 *
 * Definiciones según Chapra & Canale, Métodos Numéricos para Ingenieros, cap. 3
 * ("Aproximaciones y errores de redondeo"):
 *
 *   error absoluto aproximado     E_a = |x_nuevo − x_anterior|
 *   error relativo aproximado     ε_a = |(x_nuevo − x_anterior) / x_nuevo|
 *   error relativo porcentual     ε_a (%) = ε_a × 100
 *   tolerancia para n cifras      ε_s = (0.5 × 10^{2−n}) %      (criterio de Scarborough)
 *
 * Las funciones reciben un valor de referencia y una aproximación, así sirven para ambos casos:
 * error aproximado (referencia = x_nuevo, aproximación = x_anterior) y error verdadero
 * (referencia = valor exacto, aproximación = x_i).
 */

export function absoluteError(reference: number, approximation: number): number {
  return Math.abs(reference - approximation);
}

/**
 * Error relativo (fracción, no porcentaje): |(referencia − aproximación) / referencia|.
 * Devuelve `null` si la referencia es 0: el error relativo no está definido y el llamador debe
 * decidir cómo tratarlo (normalmente, usar el error absoluto).
 */
export function relativeError(reference: number, approximation: number): number | null {
  if (reference === 0) return null;
  return Math.abs((reference - approximation) / reference);
}

/** Error relativo en porcentaje, o `null` si la referencia es 0. */
export function relativeErrorPercent(reference: number, approximation: number): number | null {
  const e = relativeError(reference, approximation);
  return e === null ? null : e * 100;
}

/** Tolerancia porcentual que garantiza al menos `n` cifras significativas (Scarborough). */
export function scarboroughTolerance(significantFigures: number): number {
  return 0.5 * 10 ** (2 - significantFigures);
}
