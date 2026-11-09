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

/**
 * Filas o columnas de una rejilla (matriz, tabla de transporte) con una clave de posición:
 * `fila-0`, `fila-1`… En una rejilla cada celda es su posición, no su valor (dos celdas pueden
 * valer lo mismo y el valor cambia al escribir), así que la clave debe seguir a la posición. Las
 * filas y columnas solo se agregan o quitan al final, cuando cambia el tamaño.
 */
export function gridSlots<T>(
  items: readonly T[],
  prefix: string,
): { item: T; index: number; key: string }[] {
  return items.map((item, index) => ({ item, index, key: `${prefix}${index}` }));
}
