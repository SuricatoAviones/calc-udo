/**
 * Modelo del currículum y consultas sobre él.
 *
 * Los datos viven en data/curriculum.ts; aquí solo están los tipos y funciones puras para
 * navegarlos. La navegación y las rutas estáticas del sitio se generan a partir de esto.
 */
import { bibliography, type BibliographyId } from '@/data/bibliography';
import { externalSubjects, subjects } from '@/data/curriculum';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface BibliographySource {
  id: string;
  authors: string;
  /** Texto, porque el pensum trae años como "1998/2003". */
  year?: string;
  title: string;
  edition?: string;
  publisher?: string;
  place?: string;
  /** Aclaraciones sobre cómo aparece la obra en el pensum. */
  note?: string;
}

export interface Credits {
  total: number;
  theory: number;
  practice: number;
}

export type SubjectKind = 'obligatoria' | 'electiva-tecnica';

/** Calculadora prevista en el currículum. Su definición canónica vive en un solo tema. */
export interface PlannedCalculator {
  /** Slug estable y único en todo el sitio; coincide con `meta.id` de la implementación. */
  id: string;
  title: string;
  summary: string;
  /** Alguien la está desarrollando. Se ignora una vez que la calculadora está registrada. */
  inProgress?: boolean;
}

/** Referencia a una calculadora definida en otro tema (p. ej. la binomial en Inferencia). */
export interface CalculatorRef {
  ref: string;
}

export type TopicEntry = PlannedCalculator | CalculatorRef;

export interface Topic {
  slug: string;
  name: string;
  /** Unidad del programa analítico, cuando el pensum las numera. */
  unit?: string;
  /** Contenido del pensum que cubre este tema, en sus propias palabras. */
  description: string;
  calculators: TopicEntry[];
}

export interface Subject {
  slug: string;
  code: string;
  name: string;
  /** `null` para electivas técnicas, que no tienen semestre fijo. */
  semester: number | null;
  kind: SubjectKind;
  /** Códigos de asignatura. Pueden referirse a materias fuera de esta rama. */
  prerequisites: string[];
  credits: Credits;
  /** Créditos tal como aparecen en el pensum, p. ej. "3 (2T-2P)". */
  creditsLabel: string;
  objective?: string;
  /** `pendiente` cuando el pensum no incluye el programa de la materia. */
  content: 'definido' | 'pendiente';
  bibliography: BibliographyId[];
  topics: Topic[];
}

export type CalculatorStatus = 'implementada' | 'en-progreso' | 'roadmap';

export interface CalculatorLocation {
  calculator: PlannedCalculator;
  subject: Subject;
  topic: Topic;
}

// ─── Consultas ──────────────────────────────────────────────────────────────

export function isRef(entry: TopicEntry): entry is CalculatorRef {
  return 'ref' in entry;
}

export function getSubjects(): readonly Subject[] {
  return subjects;
}

export function getSubject(slug: string): Subject | undefined {
  return subjects.find((s) => s.slug === slug);
}

export function getSubjectByCode(code: string): Subject | undefined {
  return subjects.find((s) => s.code === code);
}

/** Nombre de una materia de otra rama que aparece como prelación, si el pensum lo da. */
export function getExternalSubjectName(code: string): string | undefined {
  return externalSubjects[code];
}

export function getTopic(subjectSlug: string, topicSlug: string): Topic | undefined {
  return getSubject(subjectSlug)?.topics.find((t) => t.slug === topicSlug);
}

/** Índice id → ubicación canónica (el tema donde la calculadora está definida, no referida). */
const calculatorIndex: ReadonlyMap<string, CalculatorLocation> = (() => {
  const index = new Map<string, CalculatorLocation>();
  for (const subject of subjects) {
    for (const topic of subject.topics) {
      for (const entry of topic.calculators) {
        if (!isRef(entry)) index.set(entry.id, { calculator: entry, subject, topic });
      }
    }
  }
  return index;
})();

export function getCalculatorLocation(id: string): CalculatorLocation | undefined {
  return calculatorIndex.get(id);
}

export function getAllCalculatorLocations(): CalculatorLocation[] {
  return [...calculatorIndex.values()];
}

/** Resuelve las referencias de un tema a sus calculadoras canónicas. */
export function getTopicCalculators(topic: Topic): CalculatorLocation[] {
  return topic.calculators.flatMap((entry) => {
    const location = getCalculatorLocation(isRef(entry) ? entry.ref : entry.id);
    return location ? [location] : [];
  });
}

export function subjectPath(subject: Subject): string {
  return `/${subject.slug}/`;
}

export function topicPath(subject: Subject, topic: Topic): string {
  return `/${subject.slug}/${topic.slug}/`;
}

/** URL canónica de una calculadora; una referida desde otro tema enlaza aquí. */
export function calculatorPath(location: CalculatorLocation): string {
  return `/${location.subject.slug}/${location.topic.slug}/${location.calculator.id}/`;
}

/**
 * El estado "implementada" no se escribe a mano: se deriva de si la calculadora está en el
 * registro de UI (components/calculators/registry.ts). Ver docs/DECISIONES.md, ADR-004.
 */
export function getCalculatorStatus(
  calculator: PlannedCalculator,
  implementedIds: ReadonlySet<string>,
): CalculatorStatus {
  if (implementedIds.has(calculator.id)) return 'implementada';
  return calculator.inProgress ? 'en-progreso' : 'roadmap';
}

const bibliographyById: ReadonlyMap<string, BibliographySource> = new Map(
  bibliography.map((source) => [source.id, source]),
);

export function getSource(id: string): BibliographySource | undefined {
  return bibliographyById.get(id);
}

/** Formato de cita en una línea: Autores (año). Título. Edición. Editorial. Lugar. */
export function formatSource(source: BibliographySource): string {
  const parts = [
    source.year ? `${source.authors} (${source.year}).` : `${source.authors}.`,
    `${source.title}.`,
    source.edition,
    source.publisher ? `${source.publisher}.` : undefined,
    source.place ? `${source.place}.` : undefined,
  ];
  return parts.filter(Boolean).join(' ');
}

export function formatSemester(subject: Subject): string {
  if (subject.semester === null) return 'Electiva técnica';
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return `Semestre ${roman[subject.semester - 1] ?? subject.semester}`;
}
