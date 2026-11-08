/**
 * Claves de React a partir del contenido de cada elemento. Las repetidas se distinguen por su
 * aparición (`título`, `título#1`, …), así que una clave no cambia cuando se agrega o quita un
 * elemento distinto antes que ella, como pasaría con el índice.
 */
export function withKeys<T>(
  items: readonly T[],
  base: (item: T) => string,
): { item: T; key: string }[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const b = base(item);
    const count = seen.get(b) ?? 0;
    seen.set(b, count + 1);
    return { item, key: count === 0 ? b : `${b}#${count}` };
  });
}
