/**
 * Buscador de calculadoras: índice derivado del currículum y búsqueda sin tildes ni mayúsculas.
 *
 * Cada palabra de la consulta debe aparecer en la calculadora (título, resumen, id, tema,
 * descripción del tema o materia). El puntaje premia las coincidencias en el título; las
 * calculadoras implementadas van antes que las que aún están en el roadmap.
 */
import { calculatorPath, getAllCalculatorLocations } from './curriculum';

export interface SearchEntry {
  id: string;
  title: string;
  summary: string;
  subject: string;
  topic: string;
  /** Descripción del tema en el pensum: da términos que no están en el título. */
  context: string;
  /** URL de la calculadora; `null` si todavía no está implementada. */
  path: string | null;
}

export interface SearchResult {
  entry: SearchEntry;
  score: number;
}

/** "Distribución de Poisson" → "distribucion de poisson"; "M/M/1" → "m m 1". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // marcas diacríticas que NFD separa (tildes, diéresis)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Índice con todas las calculadoras del currículum (una vez cada una, en su tema canónico). */
export function buildSearchIndex(implementedIds: ReadonlySet<string>): SearchEntry[] {
  return getAllCalculatorLocations().map((location) => {
    const { calculator, subject, topic } = location;
    return {
      id: calculator.id,
      title: calculator.title,
      summary: calculator.summary,
      subject: subject.name,
      topic: topic.name,
      context: topic.description,
      path: implementedIds.has(calculator.id) ? calculatorPath(location) : null,
    };
  });
}

interface Fields {
  title: string;
  titleWords: string[];
  id: string;
  summary: string;
  topic: string;
  subject: string;
  context: string;
  /** Todo junto y sin espacios, para consultas como «mm1» o «eoq». */
  compact: string;
}

function fieldsOf(entry: SearchEntry): Fields {
  const title = normalizeText(entry.title);
  const id = normalizeText(entry.id);
  return {
    title,
    titleWords: title.split(' '),
    id,
    summary: normalizeText(entry.summary),
    topic: normalizeText(entry.topic),
    subject: normalizeText(entry.subject),
    context: normalizeText(entry.context),
    compact: `${title} ${id}`.replace(/ /g, ''),
  };
}

/** Puntaje de una coincidencia que solo está en la descripción del tema. */
const CONTEXT_SCORE = 1;

/** Puntaje de una palabra de la consulta, o 0 si no aparece. */
function tokenScore(f: Fields, token: string): number {
  if (f.titleWords.some((w) => w.startsWith(token))) return 10;
  if (f.title.includes(token)) return 6;
  if (f.id.includes(token) || f.compact.includes(token)) return 5;
  if (f.summary.includes(token)) return 3;
  if (f.topic.includes(token) || f.subject.includes(token)) return 2;
  if (token.length >= 3 && f.context.includes(token)) return CONTEXT_SCORE;
  return 0;
}

export function searchCalculators(
  entries: readonly SearchEntry[],
  query: string,
  limit = 8,
): SearchResult[] {
  const normalized = normalizeText(query);
  if (normalized === '') return [];
  const tokens = normalized.split(' ');
  const results: (SearchResult & { weak: boolean })[] = [];
  for (const entry of entries) {
    const f = fieldsOf(entry);
    let score = 0;
    let weak = false;
    for (const token of tokens) {
      const s = tokenScore(f, token);
      if (s === 0) {
        score = 0;
        break;
      }
      score += s;
      weak ||= s === CONTEXT_SCORE;
    }
    if (score === 0) continue;
    if (f.title.includes(normalized)) score += 20;
    if (f.title === normalized) score += 20;
    results.push({ entry, score, weak });
  }
  // La descripción del tema lista muchos términos («Bernoulli, binomial, …, Poisson»): si alguna
  // calculadora coincide sin depender de ella, las que solo coinciden ahí sobran.
  const strong = results.filter((r) => !r.weak);
  return (strong.length > 0 ? strong : results)
    .map(({ entry, score }) => ({ entry, score }))
    .sort(
      (a, b) =>
        Number(b.entry.path !== null) - Number(a.entry.path !== null) ||
        b.score - a.score ||
        a.entry.title.localeCompare(b.entry.title, 'es'),
    )
    .slice(0, limit);
}
