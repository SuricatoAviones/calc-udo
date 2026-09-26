/**
 * Genera docs/PENSUM.md a partir de data/curriculum.ts y del registro de calculadoras.
 *
 *   pnpm docs:pensum
 *
 * PENSUM.md no se edita a mano: un test (generate-pensum.test.ts) falla si quedó desactualizado.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { implementedCalculatorIds } from '@/components/calculators/registry';
import {
  calculatorPath,
  formatSemester,
  formatSource,
  getCalculatorStatus,
  getExternalSubjectName,
  getSource,
  getSubjectByCode,
  getSubjects,
  getTopicCalculators,
  isRef,
  type CalculatorStatus,
  type Subject,
} from '@/lib/curriculum';

export const PENSUM_PATH = fileURLToPath(new URL('../docs/PENSUM.md', import.meta.url));

const STATUS_LABEL: Record<CalculatorStatus, string> = {
  implementada: '✅ Implementada',
  'en-progreso': '🛠️ En progreso',
  roadmap: '🗺️ Roadmap',
};

function prerequisites(subject: Subject): string {
  if (subject.prerequisites.length === 0) return 'Ninguna';
  return subject.prerequisites
    .map((code) => {
      const pre = getSubjectByCode(code);
      if (pre) return `${pre.name} (${code})`;
      const external = getExternalSubjectName(code);
      return external
        ? `${external} (${code}, fuera de esta rama)`
        : `${code} (fuera de esta rama)`;
    })
    .join(' / ');
}

function statusCounts(subject: Subject): Record<CalculatorStatus, number> {
  const counts: Record<CalculatorStatus, number> = {
    implementada: 0,
    'en-progreso': 0,
    roadmap: 0,
  };
  for (const topic of subject.topics)
    for (const entry of topic.calculators) {
      if (isRef(entry)) continue; // se cuenta solo donde está definida
      counts[getCalculatorStatus(entry, implementedCalculatorIds)] += 1;
    }
  return counts;
}

export function renderPensum(): string {
  const subjects = getSubjects();
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  push(
    '# Pensum → temas → calculadoras',
    '',
    '<!-- ARCHIVO GENERADO por scripts/generate-pensum.ts. No lo edites a mano: cambia',
    '     data/curriculum.ts o el registro de calculadoras y ejecuta `pnpm docs:pensum`. -->',
    '',
    'Mapa completo de la rama matemática/cuantitativa de Ingeniería de Sistemas (UDO) y del',
    'estado de cada calculadora. Fuente: [`fuentes/pensum-rama-cuantitativa.md`](fuentes/pensum-rama-cuantitativa.md).',
    '',
    '**Estados**',
    '',
    '- ✅ **Implementada** — registrada en `components/calculators/registry.ts`, con tests.',
    '- 🛠️ **En progreso** — marcada con `inProgress: true` en `data/curriculum.ts`.',
    '- 🗺️ **Roadmap** — prevista, sin trabajo iniciado.',
    '- ⏳ **Contenido pendiente** — el pensum no incluye el programa de la materia.',
    '',
    '**Cómo se derivaron los temas.** Cada tema agrupa contenido programático tal como aparece',
    'en el pensum; su descripción lo cita. No se agregan temas que no estén ahí. Una calculadora',
    'se define en un solo tema y otros temas la referencian (↪︎), p. ej. las distribuciones de',
    'Estadísticas I se reutilizan en Inferencia. Los temas conceptuales (sin cálculo) se listan',
    'para que el mapa esté completo.',
    '',
    '## Resumen',
    '',
    '| Código | Materia | Ubicación | Prelación | Créditos | ✅ | 🛠️ | 🗺️ |',
    '|---|---|---|---|---|---:|---:|---:|',
  );
  for (const s of subjects) {
    const c = statusCounts(s);
    const counts =
      s.content === 'pendiente'
        ? '⏳ | ⏳ | ⏳'
        : `${c.implementada} | ${c['en-progreso']} | ${c.roadmap}`;
    push(
      `| ${s.code} | [${s.name}](#${s.slug}) | ${formatSemester(s)} | ${prerequisites(s)} | ${s.creditsLabel} | ${counts} |`,
    );
  }

  for (const s of subjects) {
    push('', '---', '', `<a id="${s.slug}"></a>`, '', `## ${s.name}`, '');
    push(
      `**Código:** ${s.code} · **Ubicación:** ${formatSemester(s)} · **Prelación:** ${prerequisites(s)} · **Créditos:** ${s.creditsLabel}`,
      '',
    );
    if (s.content === 'pendiente') {
      push(
        '⏳ **Contenido pendiente de definir.** El pensum no incluye el programa sinóptico/analítico',
        'de esta materia; solo aparece en la malla curricular.',
      );
      continue;
    }
    if (s.objective) push(`**Objetivo general:** ${s.objective}`, '');

    push('| Tema | Calculadora | Estado | Ruta |', '|---|---|---|---|');
    for (const topic of s.topics) {
      const topicLabel = topic.unit ? `${topic.unit} — ${topic.name}` : topic.name;
      const locations = getTopicCalculators(topic);
      if (locations.length === 0) {
        push(`| ${topicLabel} | _Tema conceptual, sin calculadora_ | — | — |`);
        continue;
      }
      for (const location of locations) {
        const isReference = location.subject.slug !== s.slug || location.topic.slug !== topic.slug;
        const status = getCalculatorStatus(location.calculator, implementedCalculatorIds);
        push(
          `| ${topicLabel} | ${isReference ? '↪︎ ' : ''}${location.calculator.title} | ${STATUS_LABEL[status]} | \`${calculatorPath(location)}\` |`,
        );
      }
    }

    push('', '**Bibliografía**', '');
    for (const id of s.bibliography) {
      const source = getSource(id);
      if (source) push(`- ${formatSource(source)} <sub>\`${id}\`</sub>`);
    }
  }
  push('');
  return out.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(PENSUM_PATH, renderPensum(), 'utf8');
  console.log(`✔ ${PENSUM_PATH} actualizado`);
}
