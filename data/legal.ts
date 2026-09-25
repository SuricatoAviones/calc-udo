/**
 * Documentos legales del sitio. El pie de página, el índice de cada documento y las rutas
 * `app/(legal)/…` salen de esta lista: agregar un documento es una entrada aquí y su página.
 */
export interface LegalDocument {
  /** Slug de la URL, en español. */
  slug: string;
  title: string;
  /** Título corto para el pie de página. */
  shortTitle: string;
  description: string;
}

export const legalDocuments = [
  {
    slug: 'aviso-legal',
    title: 'Aviso legal',
    shortTitle: 'Aviso legal',
    description:
      'Quién publica CalcUDO, condiciones de uso, propiedad intelectual y límites de responsabilidad.',
  },
  {
    slug: 'privacidad',
    title: 'Política de privacidad',
    shortTitle: 'Privacidad',
    description:
      'Qué datos personales trata CalcUDO (ninguno propio), qué registra el alojamiento y cuáles son tus derechos.',
  },
  {
    slug: 'datos',
    title: 'Política de datos',
    shortTitle: 'Datos',
    description:
      'Qué pasa con los números, funciones y matrices que escribes en las calculadoras: se procesan en tu navegador y no salen de él.',
  },
  {
    slug: 'cookies',
    title: 'Política de cookies',
    shortTitle: 'Cookies',
    description:
      'CalcUDO no usa cookies. Solo guarda en tu navegador la preferencia de tema claro u oscuro.',
  },
] as const satisfies readonly LegalDocument[];

export type LegalSlug = (typeof legalDocuments)[number]['slug'];

export function getLegalDocument(slug: LegalSlug): LegalDocument {
  return legalDocuments.find((d) => d.slug === slug)!;
}

export function legalPath(slug: LegalSlug): string {
  return `/${slug}/`;
}

/** Fecha de la última revisión de los textos legales (ISO 8601). */
export const LEGAL_LAST_UPDATED = '2026-09-25';

export const AUTHOR_NAME = 'Luis Angel Gutierrez';
export const AUTHOR_URL = 'https://luisangelgutierrez.com';

export const REPOSITORY_URL = 'https://github.com/SuricatoAviones/calc-udo';

/** Canal de contacto público: los issues del repositorio. */
export const CONTACT_URL = `${REPOSITORY_URL}/issues`;
