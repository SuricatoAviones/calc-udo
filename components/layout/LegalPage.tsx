import Link from 'next/link';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import {
  getLegalDocument,
  LEGAL_LAST_UPDATED,
  legalDocuments,
  legalPath,
  type LegalSlug,
} from '@/data/legal';

const dateFormatter = new Intl.DateTimeFormat('es-VE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Plantilla común de los documentos legales: migas, título, fecha y enlaces a los demás. */
export function LegalPage({ slug, children }: { slug: LegalSlug; children: React.ReactNode }) {
  const doc = getLegalDocument(slug);
  const others = legalDocuments.filter((d) => d.slug !== slug);

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <header>
        <Breadcrumbs items={[{ label: doc.title }]} />
        <p className="text-pencil font-mono text-xs tracking-widest uppercase">Legal</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{doc.title}</h1>
        <p className="text-muted-foreground mt-3 text-lg">{doc.description}</p>
        <p className="text-muted-foreground mt-3 text-sm">
          Última actualización:{' '}
          <time dateTime={LEGAL_LAST_UPDATED} className="text-foreground">
            {dateFormatter.format(new Date(LEGAL_LAST_UPDATED))}
          </time>
        </p>
      </header>

      <div className="legal-prose">{children}</div>

      <nav aria-labelledby="otros-documentos" className="border-t pt-6">
        <h2 id="otros-documentos" className="text-lg font-semibold">
          Otros documentos legales
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {others.map((d) => (
            <li key={d.slug}>
              <Link
                href={legalPath(d.slug)}
                className="bg-card hover:border-primary/40 block h-full rounded-lg border p-3 text-sm shadow-xs transition-colors"
              >
                <span className="font-semibold">{d.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
