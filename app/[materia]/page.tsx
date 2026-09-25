import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { CalculatorList } from '@/components/curriculum/CalculatorList';
import { StatusBadge } from '@/components/curriculum/StatusBadge';
import {
  formatSemester,
  formatSource,
  getSource,
  getSubject,
  getSubjectByCode,
  getSubjects,
  getTopicCalculators,
  subjectPath,
  topicPath,
} from '@/lib/curriculum';

type Props = { params: Promise<{ materia: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getSubjects().map((s) => ({ materia: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const subject = getSubject((await params).materia);
  if (!subject) return {};
  return {
    title: subject.name,
    description: subject.objective ?? `${subject.name} (${subject.code})`,
  };
}

export default async function SubjectPage({ params }: Props) {
  const subject = getSubject((await params).materia);
  if (!subject) notFound();

  return (
    <article className="flex flex-col gap-8">
      <header>
        <Breadcrumbs items={[{ label: subject.name }]} />
        <p className="text-muted-foreground font-mono text-sm">{subject.code}</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{subject.name}</h1>
        <dl className="text-muted-foreground mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt>Ubicación</dt>
          <dd className="text-foreground">{formatSemester(subject)}</dd>
          <dt>Créditos</dt>
          <dd className="text-foreground">{subject.creditsLabel}</dd>
          <dt>Prelación</dt>
          <dd className="text-foreground">
            {subject.prerequisites.length === 0
              ? 'Ninguna'
              : subject.prerequisites.map((code, i) => {
                  const pre = getSubjectByCode(code);
                  return (
                    <span key={code}>
                      {i > 0 && ' / '}
                      {pre ? (
                        <Link href={subjectPath(pre)} className="underline underline-offset-4">
                          {pre.name} ({code})
                        </Link>
                      ) : (
                        <span title="Materia fuera de la rama cuantitativa">{code}</span>
                      )}
                    </span>
                  );
                })}
          </dd>
        </dl>
        {subject.objective && (
          <div className="border-pencil/60 mt-6 max-w-3xl border-l-2 pl-4">
            <p className="text-muted-foreground text-xs tracking-wider uppercase">
              Objetivo general
            </p>
            <p>{subject.objective}</p>
          </div>
        )}
      </header>

      {subject.content === 'pendiente' ? (
        <section className="bg-card rounded-lg border border-dashed p-6">
          <StatusBadge status="contenido-pendiente" />
          <p className="mt-3 max-w-2xl">
            El pensum de la carrera no incluye el programa analítico de esta materia, solo su
            ubicación en la malla curricular. Sus temas y calculadoras se definirán cuando se cuente
            con el programa oficial.
          </p>
        </section>
      ) : (
        <section aria-labelledby="temas" className="flex flex-col gap-4">
          <h2 id="temas" className="text-2xl font-semibold">
            Temas
          </h2>
          <ol className="flex flex-col gap-4">
            {subject.topics.map((topic) => (
              <li key={topic.slug} className="bg-card rounded-lg border p-4 sm:p-5">
                <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                  {topic.unit && (
                    <span className="text-pencil font-mono text-xs uppercase">{topic.unit}</span>
                  )}
                  <h3 className="text-lg font-semibold">
                    <Link
                      href={topicPath(subject, topic)}
                      className="hover:text-primary underline-offset-4 hover:underline"
                    >
                      {topic.name}
                    </Link>
                  </h3>
                </div>
                <p className="text-muted-foreground mb-3 text-sm">{topic.description}</p>
                <CalculatorList items={getTopicCalculators(topic)} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {subject.bibliography.length > 0 && (
        <section aria-labelledby="bibliografia" className="flex flex-col gap-3">
          <h2 id="bibliografia" className="text-2xl font-semibold">
            Bibliografía del programa
          </h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
            {subject.bibliography.map((id) => {
              const source = getSource(id);
              return source ? <li key={id}>{formatSource(source)}</li> : null;
            })}
          </ul>
        </section>
      )}
    </article>
  );
}
