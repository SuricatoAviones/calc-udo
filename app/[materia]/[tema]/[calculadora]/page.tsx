import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { calculatorRegistry, implementedCalculatorIds } from '@/components/calculators/registry';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import {
  getAllCalculatorLocations,
  getCalculatorLocation,
  subjectPath,
  topicPath,
} from '@/lib/curriculum';

type Props = { params: Promise<{ materia: string; tema: string; calculadora: string }> };

export const dynamicParams = false;

/** Solo se generan páginas para calculadoras registradas, en su ubicación canónica. */
export function generateStaticParams() {
  return getAllCalculatorLocations()
    .filter((l) => implementedCalculatorIds.has(l.calculator.id))
    .map((l) => ({ materia: l.subject.slug, tema: l.topic.slug, calculadora: l.calculator.id }));
}

async function resolve(params: Props['params']) {
  const { materia, tema, calculadora } = await params;
  const location = getCalculatorLocation(calculadora);
  const load = calculatorRegistry[calculadora];
  if (!location || !load || location.subject.slug !== materia || location.topic.slug !== tema) {
    return null;
  }
  return { location, load };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { calculator, subject } = found.location;
  return {
    title: `${calculator.title} — ${subject.name}`,
    description: `${calculator.summary} Con el procedimiento paso a paso.`,
  };
}

export default async function CalculatorPage({ params }: Props) {
  const found = await resolve(params);
  if (!found) notFound();
  const { location, load } = found;
  const { subject, topic, calculator } = location;
  const { default: Calculator } = await load();

  return (
    <article className="flex flex-col gap-6">
      <header>
        <Breadcrumbs
          items={[
            { label: subject.name, href: subjectPath(subject) },
            { label: topic.name, href: topicPath(subject, topic) },
            { label: calculator.title },
          ]}
        />
        <h1 className="text-3xl font-semibold sm:text-4xl">{calculator.title}</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">{calculator.summary}</p>
      </header>
      <Calculator />
    </article>
  );
}
