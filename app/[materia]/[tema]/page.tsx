import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { CalculatorList } from '@/components/curriculum/CalculatorList';
import {
  getSubject,
  getSubjects,
  getTopic,
  getTopicCalculators,
  subjectPath,
} from '@/lib/curriculum';

type Props = { params: Promise<{ materia: string; tema: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getSubjects().flatMap((s) => s.topics.map((t) => ({ materia: s.slug, tema: t.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { materia, tema } = await params;
  const subject = getSubject(materia);
  const topic = getTopic(materia, tema);
  if (!subject || !topic) return {};
  return { title: `${topic.name} — ${subject.name}`, description: topic.description };
}

export default async function TopicPage({ params }: Props) {
  const { materia, tema } = await params;
  const subject = getSubject(materia);
  const topic = getTopic(materia, tema);
  if (!subject || !topic) notFound();

  return (
    <article className="flex flex-col gap-6">
      <header>
        <Breadcrumbs
          items={[{ label: subject.name, href: subjectPath(subject) }, { label: topic.name }]}
        />
        {topic.unit && <p className="text-pencil font-mono text-xs uppercase">{topic.unit}</p>}
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{topic.name}</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl">{topic.description}</p>
      </header>
      <section aria-labelledby="calculadoras" className="bg-card rounded-lg border p-4 sm:p-5">
        <h2 id="calculadoras" className="mb-2 text-xl font-semibold">
          Calculadoras
        </h2>
        <CalculatorList items={getTopicCalculators(topic)} />
      </section>
    </article>
  );
}
