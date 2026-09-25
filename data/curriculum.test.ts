import { describe, expect, it } from 'vitest';
import { bibliography } from '@/data/bibliography';
import { subjects } from '@/data/curriculum';
import {
  formatSource,
  getCalculatorStatus,
  getSubjectByCode,
  getTopicCalculators,
  isRef,
} from '@/lib/curriculum';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('currículum', () => {
  it('slugs y códigos de materia son únicos y válidos', () => {
    const slugs = subjects.map((s) => s.slug);
    const codes = subjects.map((s) => s.code);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(codes).size).toBe(codes.length);
    for (const s of subjects) {
      expect(s.slug).toMatch(SLUG);
      expect(s.code).toMatch(/^\d{3}-\d{4}$/);
    }
  });

  it('slugs de tema son únicos dentro de cada materia', () => {
    for (const s of subjects) {
      const slugs = s.topics.map((t) => t.slug);
      expect(new Set(slugs).size, s.slug).toBe(slugs.length);
      for (const slug of slugs) expect(slug).toMatch(SLUG);
    }
  });

  it('cada calculadora se define una sola vez y todas las referencias resuelven', () => {
    const defined = new Set<string>();
    const refs: string[] = [];
    for (const s of subjects)
      for (const t of s.topics)
        for (const entry of t.calculators) {
          if (isRef(entry)) {
            refs.push(entry.ref);
          } else {
            expect(defined.has(entry.id), `id duplicado: ${entry.id}`).toBe(false);
            expect(entry.id).toMatch(SLUG);
            defined.add(entry.id);
          }
        }
    for (const ref of refs) expect(defined.has(ref), `referencia rota: ${ref}`).toBe(true);
  });

  it('las materias con contenido pendiente no tienen temas', () => {
    for (const s of subjects.filter((s) => s.content === 'pendiente')) {
      expect(s.topics).toHaveLength(0);
    }
  });

  it('las materias con contenido definido tienen objetivo, temas y bibliografía', () => {
    for (const s of subjects.filter((s) => s.content === 'definido')) {
      expect(s.objective, s.slug).toBeTruthy();
      expect(s.topics.length, s.slug).toBeGreaterThan(0);
      expect(s.bibliography.length, s.slug).toBeGreaterThan(0);
    }
  });

  it('creditsLabel coincide con los créditos estructurados', () => {
    for (const s of subjects) {
      const { total, theory, practice } = s.credits;
      expect(s.creditsLabel).toBe(`${total} (${theory}T-${practice}P)`);
    }
  });

  it('las prelaciones dentro de la rama apuntan a materias de semestre anterior', () => {
    for (const s of subjects) {
      for (const code of s.prerequisites) {
        const pre = getSubjectByCode(code);
        // Algunas prelaciones (p. ej. 072-2103) son de otras ramas: se permiten.
        if (!pre || pre.semester === null || s.semester === null) continue;
        expect(pre.semester, `${s.code} ← ${code}`).toBeLessThan(s.semester);
      }
    }
  });

  it('getTopicCalculators resuelve referencias a su ubicación canónica', () => {
    const inferencia = subjects.find((s) => s.slug === 'inferencia-y-diseno-de-experimentos')!;
    const distribuciones = inferencia.topics.find(
      (t) => t.slug === 'distribuciones-de-probabilidad',
    )!;
    const binomial = getTopicCalculators(distribuciones)[0]!;
    expect(binomial.calculator.id).toBe('distribucion-binomial');
    expect(binomial.subject.slug).toBe('estadistica-1');
  });

  it('el estado se deriva del registro de implementadas', () => {
    const calc = { id: 'x', title: 'X', summary: '' };
    expect(getCalculatorStatus(calc, new Set())).toBe('roadmap');
    expect(getCalculatorStatus({ ...calc, inProgress: true }, new Set())).toBe('en-progreso');
    expect(getCalculatorStatus({ ...calc, inProgress: true }, new Set(['x']))).toBe('implementada');
  });
});

describe('bibliografía', () => {
  it('ids únicos', () => {
    const ids = bibliography.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda obra está citada por al menos una materia', () => {
    const cited = new Set(subjects.flatMap((s) => s.bibliography));
    for (const b of bibliography) expect(cited.has(b.id), b.id).toBe(true);
  });

  it('formatSource produce una cita legible', () => {
    const chapra = bibliography.find((b) => b.id === 'chapra-canale-2000')!;
    expect(formatSource(chapra)).toBe(
      'Chapra, Steven – Canale, R. (2000). Métodos Numéricos para Ingenieros. 3ra Ed. Mc Graw Hill. México.',
    );
  });
});
