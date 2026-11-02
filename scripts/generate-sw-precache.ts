/**
 * Genera `out/sw-precache.js` a partir del sitio exportado.
 *
 *   pnpm build        (next build + este script)
 *   pnpm sw:precache  (solo este script, con un `out/` ya construido)
 *
 * El service worker (`public/sw.js`) carga ese archivo con `importScripts` para saber qué cachear.
 * La lista sale de `out/`, no de una lista escrita a mano: así ninguna ruta nueva se queda fuera
 * (ver ADR-040). Además se comprueba que estén todas las rutas del currículum.
 */
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { implementedCalculatorIds } from '@/components/calculators/registry';
import { legalDocuments, legalPath } from '@/data/legal';
import {
  calculatorPath,
  getSubjects,
  getTopicCalculators,
  subjectPath,
  topicPath,
} from '@/lib/curriculum';
import {
  buildPrecacheManifest,
  findMissingRoutes,
  precacheScript,
  type PrecacheFile,
} from '@/lib/pwa/precache';
import pkg from '../package.json';

export const OUT_DIR = fileURLToPath(new URL('../out', import.meta.url));
export const PRECACHE_PATH = join(OUT_DIR, 'sw-precache.js');

/** Archivos de `out/` con su ruta relativa en formato POSIX. */
export function listOutputFiles(directory: string, base = directory): PrecacheFile[] {
  const files: PrecacheFile[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listOutputFiles(absolute, base));
    } else if (entry.isFile()) {
      files.push({
        path: relative(base, absolute).split(sep).join('/'),
        size: statSync(absolute).size,
      });
    }
  }
  return files;
}

/** Rutas que el sitio debe tener en su build: portada, materias, temas, calculadoras y legales. */
export function expectedRoutes(): string[] {
  const routes = new Set<string>(['/', '/404/']);

  for (const subject of getSubjects()) {
    routes.add(subjectPath(subject));
    for (const topic of subject.topics) {
      routes.add(topicPath(subject, topic));
      for (const location of getTopicCalculators(topic)) {
        if (implementedCalculatorIds.has(location.calculator.id)) {
          routes.add(calculatorPath(location));
        }
      }
    }
  }

  for (const document of legalDocuments) routes.add(legalPath(document.slug));

  return [...routes];
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function main() {
  if (!existsSync(OUT_DIR)) {
    console.error('No existe out/. Ejecuta `pnpm build` antes de generar el precache.');
    process.exit(1);
  }
  if (!existsSync(join(OUT_DIR, 'sw.js'))) {
    console.error('Falta out/sw.js: revisa que public/sw.js exista antes del build.');
    process.exit(1);
  }

  const manifest = buildPrecacheManifest(listOutputFiles(OUT_DIR), pkg.version);
  const missing = findMissingRoutes(manifest, expectedRoutes());

  if (missing.length > 0) {
    console.error('El precache no cubre estas rutas del sitio:');
    for (const route of missing) console.error(`  - ${route}`);
    process.exit(1);
  }

  writeFileSync(PRECACHE_PATH, precacheScript(manifest), 'utf8');

  console.info(
    `sw-precache.js: ${manifest.core.length} recursos (${megabytes(manifest.bytes.core)}) ` +
      `y ${manifest.pages.length} páginas (${megabytes(manifest.bytes.pages)}). ` +
      `Versión ${manifest.version}.`,
  );
}

// Solo corre al ejecutarse con `tsx`; los tests pueden importar `expectedRoutes` sin escribir nada.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
