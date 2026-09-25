import Link from 'next/link';
import { legalDocuments, legalPath, REPOSITORY_URL } from '@/data/legal';
import pkg from '@/package.json';

const { version } = pkg;

export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t py-6 text-sm">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <p>
            CalcUDO es un proyecto open source (MIT) para estudiantes de la Universidad de Oriente.
            No es un sitio oficial de la UDO.
          </p>
          <p>
            Verifica siempre con tu libro de texto: cada calculadora cita la bibliografía del
            método.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Documentos legales">
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {legalDocuments.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={legalPath(d.slug)}
                    className="hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {d.shortTitle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <a
            href={`${REPOSITORY_URL}/releases/tag/v${version}`}
            rel="noopener noreferrer"
            className="hover:text-foreground font-mono text-xs underline-offset-4 hover:underline"
          >
            v{version}
          </a>
        </div>
      </div>
    </footer>
  );
}
