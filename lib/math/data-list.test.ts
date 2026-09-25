import { describe, expect, it } from 'vitest';
import { parseDataList } from './data-list';

describe('parseDataList', () => {
  it('acepta espacios, saltos de línea, punto y coma y ", "', () => {
    expect(parseDataList('3 4\n5; 6, 6,  7').values).toEqual([3, 4, 5, 6, 6, 7]);
  });

  it('una coma sin espacio es coma decimal', () => {
    expect(parseDataList('0,5; 1,25 2.5').values).toEqual([0.5, 1.25, 2.5]);
  });

  it('informa los fragmentos que no son números', () => {
    const parsed = parseDataList('3 abc 1,2,3 4');
    expect(parsed.values).toEqual([3, 4]);
    expect(parsed.invalid).toEqual(['abc', '1,2,3']);
  });

  it('texto vacío → lista vacía', () => {
    expect(parseDataList('  \n ')).toEqual({ values: [], invalid: [] });
  });
});
