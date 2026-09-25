import type { BibliographySource } from '@/lib/curriculum';

/**
 * Bibliografía del pensum (docs/fuentes/pensum-rama-cuantitativa.md), una entrada por obra.
 *
 * - Los datos se transcriben tal cual aparecen en el pensum, incluidas grafías dudosas
 *   ("Borovkor", "Suddehender", "Willey"): corregirlas sería inventar información.
 * - Si la misma obra aparece en varias materias con pequeñas variaciones (edición omitida,
 *   "Liberman" vs "Lieberman"), se registra una sola vez con los datos más completos.
 *   Si cambia el año o la editorial, se considera otra entrada (p. ej. Walpole 1998 y 1999).
 * - Las calculadoras citan estas entradas por `id` (ver `Citation` en lib/calculators/types.ts).
 */
export const bibliography = [
  // ── Introducción a la Lógica Formal y Algoritmos ───────────────────────────
  {
    id: 'fatone',
    authors: 'Fatone, Vicente',
    title: 'Lógica y Teoría del Conocimiento',
    publisher: 'Kapeluz',
    place: 'Buenos Aires',
  },
  {
    id: 'figerman-1998',
    authors: 'Figerman G.',
    year: '1998',
    title: 'Lógica y Teoría del Conocimiento',
    publisher: 'Editorial Librería Ateneo',
  },
  {
    id: 'miro-quesada',
    authors: 'Miró Quesada, Francisco',
    title: 'Lógica',
    place: 'Lima',
  },
  {
    id: 'munoz-1996',
    authors: 'Muñoz, A.',
    year: '1996',
    title: 'Lógica Simbólica Elemental',
    publisher: 'Editorial Miró',
  },
  {
    id: 'pfander',
    authors: 'Pfander, Alejandro',
    title: 'Lógica',
    publisher: 'Espasa Calpe',
    place: 'Buenos Aires',
  },
  {
    id: 'romero-pucciarelli',
    authors: 'Romero, Francisco y Pucciarelli, Eugenio',
    title: 'Lógica y Nociones de Teoría del Conocimiento',
    publisher: 'Espasa Calpe',
    place: 'Buenos Aires',
  },
  {
    id: 'tucker-joyanes-2000',
    authors: 'Tucker A. – Joyanes L.',
    year: '2000',
    title: 'Lógica, resolución de problemas, algoritmos y programas',
    publisher: 'Mc Graw Hill',
  },

  // ── Métodos Numéricos ──────────────────────────────────────────────────────
  {
    id: 'ledanois-2000',
    authors: 'Ledanois, J. – López, A. – Pimentel, J.',
    year: '2000',
    title: 'Métodos Numéricos Aplicados en Ingeniería',
    publisher: 'Mc Graw Hill',
  },
  {
    id: 'chapra-canale-2000',
    authors: 'Chapra, Steven – Canale, R.',
    year: '2000',
    title: 'Métodos Numéricos para Ingenieros',
    edition: '3ra Ed.',
    publisher: 'Mc Graw Hill',
    place: 'México',
  },
  {
    id: 'nakamura-1994',
    authors: 'Nakamura, Schoichiro',
    year: '1994',
    title: 'Métodos Numéricos Aplicados con Software',
    publisher: 'Prentice Hall Hispanoamericana',
    place: 'México',
  },
  {
    id: 'smith-1993',
    authors: 'Smith, Allen',
    year: '1993',
    title: 'Análisis Numéricos',
    publisher: 'Prentice Hall Hispanoamericana',
    place: 'México',
  },

  // ── Estadística, probabilidad e inferencia ─────────────────────────────────
  {
    id: 'canavos-1995',
    authors: 'Canavos, George C.',
    year: '1995',
    title: 'Probabilidad y Estadística. Aplicaciones y Métodos',
    edition: '2da Ed.',
    publisher: 'Mc Graw Hill',
    place: 'México',
  },
  {
    id: 'meyer-1998',
    authors: 'Meyer, Paul',
    year: '1998',
    title: 'Probabilidad y Aplicaciones Estadísticas',
    edition: '2da Ed.',
    publisher: 'Addison Wesley Longman',
    place: 'México',
  },
  {
    id: 'mendenhall-sincich-1997',
    authors: 'Mendenhall, William y Sincich, Ferry',
    year: '1997',
    title: 'Probabilidad y Estadística para Ingeniería y Ciencias',
    edition: '4ta Ed.',
    publisher: 'Prentice-Hall Hispanoamericana',
  },
  {
    id: 'walpole-1999',
    authors: 'Walpole, Ronald, Myers, R., Myers, Sh.',
    year: '1999',
    title: 'Probabilidad y Estadística para Ingenieros',
    edition: '6ta Ed.',
    publisher: 'Prentice-Hall Hispanoamericana',
  },
  {
    id: 'walpole-1998',
    authors: 'Walpole – Myers – Myers',
    year: '1998',
    title: 'Probabilidad y Estadística para Ingenieros',
    edition: '6ta Ed.',
    publisher: 'Prentice Hall',
  },
  {
    id: 'johnson-1997',
    authors: 'Johnson, Richard',
    year: '1997',
    title: 'Probabilidad y Estadística para Ingenieros de Miller y Freund',
    edition: '5ta Ed.',
    publisher: 'Prentice Hall',
    place: 'México',
  },
  {
    id: 'spiegel-1991',
    authors: 'Murray, Spiegel',
    year: '1991',
    title: 'Probabilidades y Estadística',
    publisher: 'Mc Graw Hill',
    place: 'México',
  },
  {
    id: 'willey-2001',
    authors: 'Willey, J.',
    year: '2001',
    title:
      'Design of Experiments Using the Taguchi Approach: 16 Steps to Product and Process Improvement',
    publisher: 'John Wiley & Son',
  },

  // ── Investigación de operaciones ───────────────────────────────────────────
  {
    id: 'bonini-2000',
    authors: 'Bonini – Hausman - Bierman',
    year: '2000',
    title: 'Análisis Cuantitativo para los Negocios',
    edition: '9na Ed.',
    publisher: 'Mc Graw Hill - Irwin',
    place: 'Colombia',
  },
  {
    id: 'taha',
    authors: 'Handy, Taha',
    year: '1998/2003',
    title: 'Investigación de Operaciones. Una introducción',
    publisher: 'PH',
    place: 'México',
  },
  {
    id: 'aquilano-1994',
    authors: 'Aquilano, CH.',
    year: '1994',
    title: 'Dirección de la Producción y de las Operaciones',
    edition: '6ta Ed.',
    publisher: 'Mc Graw Hill',
    place: 'USA',
  },
  {
    id: 'anderson-1993',
    authors: 'Anderson, D. – Sweeney, D. – Williams, T.',
    year: '1993',
    title: 'Introducción a los Modelos Cuantitativos para la Administración',
    publisher: 'Grupo Editorial Iberoamericana',
    place: 'México',
  },
  {
    id: 'gould-eppen-schmidt',
    authors: 'Gould – Eppen - Schmidt',
    year: '1992/2000',
    title: 'Investigación de Operaciones en la Ciencia Administrativa',
    publisher: 'Prentice Hall',
    place: 'México',
  },
  {
    id: 'arreola-2003',
    authors: 'Arreola J. Arreola A.',
    year: '2003',
    title: 'Programación Lineal',
    publisher: 'International Thomson Editores',
    place: 'México',
  },
  {
    id: 'hillier-lieberman-2002',
    authors: 'Hillier F. Lieberman G.',
    year: '2002',
    title: 'Investigación de Operaciones',
    edition: '7ma Ed.',
    publisher: 'Mc Graw Hill',
    place: 'México',
    note: 'En el programa de Teoría de Colas aparece como “Introducción a la Investigación de Operaciones”.',
  },
  {
    id: 'winston-1994',
    authors: 'Winston W.',
    year: '1994',
    title: 'Investigación de Operaciones. Aplicaciones y algoritmos',
    edition: '3ra Ed.',
    publisher: 'Grupo Editorial Iberoamericana',
    place: 'México',
    note: 'En el programa de Teoría de Colas aparece como “Wayne, Winston”.',
  },

  // ── Programación No Lineal ─────────────────────────────────────────────────
  {
    id: 'bazaraa-1993',
    authors: 'Bazaraa M., Sherali H., Shetty C.',
    year: '1993',
    title: 'Nonlinear Programming, Theory and Algorithms',
    publisher: 'John Wiley & Sons Inc.',
    place: 'USA',
  },
  {
    id: 'cooper-1998',
    authors: 'Cooper, Leon',
    year: '1998',
    title: 'Applied Nonlinear Programming for Engineer and Scientist',
    publisher: 'W.B. Saunders Co.',
    place: 'Philadelphia',
  },
  {
    id: 'hadley-2000',
    authors: 'Hadley, G.',
    year: '2000',
    title: 'Linear Programming',
    publisher: 'Addison Wesley',
    place: 'Reading, Mass.',
  },
  {
    id: 'rao-1999',
    authors: 'Rao, S.',
    year: '1999',
    title: 'Optimization: Theory and Applications',
    publisher: 'Indian Institute of Technology Kanpur. John Wiley & Sons Inc.',
    place: 'USA',
  },

  // ── Procesos estocásticos y colas ──────────────────────────────────────────
  {
    id: 'arnold-2001',
    authors: 'Arnold, Edward',
    year: '2001',
    title: 'Advances in Stochastic Simulation Methods',
    publisher: 'Balskrishnam',
  },
  {
    id: 'barndorff-nielsen-2000',
    authors: 'Barndorff – Nielsen',
    year: '2000',
    title: 'Complex Stochastic Systems',
    publisher: 'John Wiley',
  },
  {
    id: 'borovkor-1998',
    authors: 'Borovkor, A.',
    year: '1998',
    title: 'Ergodicity and Stability of Stochastic Processes',
    publisher: 'John Wiley',
  },
  {
    id: 'mathur-solow-1996',
    authors: 'Mathur, Kamlesh – Solow, Daniel',
    year: '1996',
    title: 'Investigación de Operaciones',
    publisher: 'Prentice Hall',
  },
  {
    id: 'kaufman-1996',
    authors: 'Kaufman, A.',
    year: '1996',
    title: 'Los Fenómenos de Espera',
    publisher: 'Editorial Continental',
  },
  {
    id: 'suddehender-1995',
    authors: 'Suddehender, B.',
    year: '1995',
    title: 'Applied Stochastic Processes',
    publisher: 'Halsted',
  },
  {
    id: 'wong-2007',
    authors: 'Wong H., Carolina',
    year: '2007',
    title: 'Procesos Estocásticos',
    publisher: 'Trabajo de Ascenso, Depto. de Computación y Sistemas, UDO Anzoátegui',
  },

  // ── Teoría de Sobrevivencia ────────────────────────────────────────────────
  {
    id: 'borean-1995',
    authors: 'Bórean, Ezio',
    year: '1995',
    title: 'Modelos no Paramétricos de Sobrevivencia y Fallas con Datos Censurados',
    publisher: 'Trabajo de Ascenso, UDO',
  },
  {
    id: 'borean-1999',
    authors: 'Bórean, E.',
    year: '1999',
    title: 'Modelos HB — Modelos No Paramétricos para el Control del Mantenimiento de un Sistema',
    publisher: 'UGMA',
    place: 'Barcelona',
  },
  {
    id: 'borean-ganuza-2001',
    authors: 'Bórean, Ezio – Ganuza, E.',
    year: '2001',
    title:
      'Inferencia acerca de las Curvas de Sobrevivencia a partir de las Tablas de Vida con Datos Censurados',
  },
  {
    id: 'borean-solorzano-2001',
    authors: 'Bórean, Ezio – Solórzano, L.',
    year: '2001',
    title:
      '¿Cómo captar la información para la aplicación de un modelo no paramétrico de confiabilidad con datos censurados?',
    publisher: 'II Jornadas Nacionales de Investigación de Operaciones',
    place: 'Puerto La Cruz',
  },
  {
    id: 'solorzano-padra-1999',
    authors: 'Solórzano, L – Padra, D.',
    year: '1999',
    title:
      'Diseño de un Modelo Markoviano para Validar las Proyecciones del Comportamiento de un Sistema Centrado en Confiabilidad...',
    publisher: 'Trabajo de Grado, UDO Anzoátegui',
  },
] as const satisfies readonly BibliographySource[];

export type BibliographyId = (typeof bibliography)[number]['id'];
