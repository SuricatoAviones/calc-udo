import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PENSUM_PATH, renderPensum } from './generate-pensum';

it('docs/PENSUM.md está sincronizado con el currículum (ejecuta `pnpm docs:pensum`)', () => {
  const current = readFileSync(PENSUM_PATH, 'utf8').replace(/\r\n/g, '\n');
  expect(current).toBe(renderPensum());
});
