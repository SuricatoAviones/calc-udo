import { describe, expect, it } from 'vitest';
import { withKeys } from './keys';

// Sin fuente bibliográfica: es una utilidad de la interfaz. Los casos se verifican por inspección.
describe('withKeys', () => {
  it('usa el contenido y numera los repetidos por aparición', () => {
    const keys = withKeys(['a', 'b', 'a', 'a'], (s) => s).map((k) => k.key);
    expect(keys).toEqual(['a', 'b', 'a#1', 'a#2']);
  });

  it('una clave no cambia al insertar un elemento distinto antes', () => {
    const before = withKeys(['x', 'y'], (s) => s).map((k) => k.key);
    const after = withKeys(['w', 'x', 'y'], (s) => s).map((k) => k.key);
    expect(after.slice(1)).toEqual(before);
  });

  it('conserva el elemento', () => {
    expect(withKeys([{ id: 3 }], (o) => String(o.id))[0]).toEqual({ item: { id: 3 }, key: '3' });
  });
});
