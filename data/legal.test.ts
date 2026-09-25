import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { subjects } from '@/data/curriculum';
import { legalDocuments, LEGAL_LAST_UPDATED } from '@/data/legal';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('documentos legales', () => {
  it('slugs únicos, válidos y con su página en app/(legal)', () => {
    const slugs = legalDocuments.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(SLUG);
      const page = fileURLToPath(new URL(`../app/(legal)/${slug}/page.tsx`, import.meta.url));
      expect(existsSync(page), `falta app/(legal)/${slug}/page.tsx`).toBe(true);
    }
  });

  it('ningún slug choca con el de una materia (comparten el primer nivel de la URL)', () => {
    const subjectSlugs = new Set(subjects.map((s) => s.slug));
    for (const d of legalDocuments) expect(subjectSlugs.has(d.slug)).toBe(false);
  });

  it('la fecha de actualización es una fecha ISO válida', () => {
    expect(LEGAL_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(LEGAL_LAST_UPDATED))).toBe(false);
  });
});
