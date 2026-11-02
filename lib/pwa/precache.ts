/**
 * Manifiesto de precache del service worker.
 *
 * `scripts/generate-sw-precache.ts` recorre `out/` después de `next build` y usa estas funciones
 * para decidir qué archivos entran en la caché. Son puras: reciben rutas y tamaños, no tocan el
 * sistema de archivos (ver ADR-040).
 */

/** Archivo del sitio exportado; `path` es relativo a `out/` y usa barras normales. */
export interface PrecacheFile {
  path: string;
  size: number;
}

export interface PrecacheManifest {
  /** Identificador de la caché: versión de la app + huella del contenido. */
  version: string;
  /** Se descarga al instalar la app: deja el armazón listo para abrir sin conexión. */
  core: string[];
  /** Páginas y payloads de navegación; se descargan con «Guardar sin conexión». */
  pages: string[];
  bytes: { core: number; pages: number; total: number };
}

/** Solo se precarchea lo que el navegador puede consumir como recurso web. */
const PRECACHE_EXTENSIONS = new Set([
  '.html',
  '.txt',
  '.json',
  '.js',
  '.css',
  '.woff2',
  '.woff',
  '.png',
  '.webp',
  '.svg',
  '.ico',
  '.webmanifest',
  '.xml',
  '.wasm',
]);

/**
 * Archivos que nunca se guardan: el propio service worker y su manifiesto (cachearse a sí mismos
 * deja versiones viejas pegadas), el 404 que sirve el alojamiento y la imagen fuente de los iconos
 * (332 KB que la app no usa en tiempo de ejecución).
 */
const EXCLUDED_PATHS = new Set(['sw.js', 'sw-precache.js', '404.html', 'Logo_UDO.svg.webp']);

function extensionOf(path: string): string {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  return dot > slash ? path.slice(dot).toLowerCase() : '';
}

/**
 * URL pública de un archivo de `out/`, o `null` si no debe precachearse.
 *
 * `index.html` se publica con barra final porque el sitio usa `trailingSlash`; los demás `.html`
 * sueltos (el 404 del alojamiento) quedan fuera.
 */
export function precacheUrl(path: string): string | null {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized.includes('..')) return null;
  if (EXCLUDED_PATHS.has(normalized)) return null;

  const extension = extensionOf(normalized);
  if (!PRECACHE_EXTENSIONS.has(extension)) return null;

  if (extension === '.html') {
    if (normalized === 'index.html') return '/';
    if (!normalized.endsWith('/index.html')) return null;
    return `/${normalized.slice(0, -'index.html'.length)}`;
  }

  return `/${normalized}`;
}

/** FNV-1a de 32 bits: huella corta y estable, sin dependencias. */
function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.codePointAt(i) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function compareUrls(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Clasifica y ordena los archivos del sitio.
 *
 * El armazón (`core`) son los recursos estáticos y la portada; las páginas internas y sus payloads
 * de navegación van a `pages`, porque son ~24 MB y conviene que el estudiante decida cuándo
 * descargarlos con datos móviles.
 */
export function buildPrecacheManifest(
  files: readonly PrecacheFile[],
  appVersion: string,
): PrecacheManifest {
  const entries = new Map<string, number>();

  for (const file of files) {
    const url = precacheUrl(file.path);
    if (!url) continue;
    entries.set(url, (entries.get(url) ?? 0) + file.size);
  }

  const sorted = [...entries.entries()].sort(([a], [b]) => compareUrls(a, b));
  const core: string[] = [];
  const pages: string[] = [];
  let coreBytes = 0;
  let pageBytes = 0;

  for (const [url, size] of sorted) {
    const isRootPayload = url.endsWith('.txt') && !url.includes('/', 1);
    const isHome = url === '/';
    const isPage = !isHome && !isRootPayload && (url.endsWith('/') || url.endsWith('.txt'));

    if (isPage) {
      pages.push(url);
      pageBytes += size;
    } else {
      core.push(url);
      coreBytes += size;
    }
  }

  const version = `${appVersion}-${fingerprint(
    sorted.map(([url, size]) => `${url}\t${size}`).join('\n'),
  )}`;

  return {
    version,
    core,
    pages,
    bytes: { core: coreBytes, pages: pageBytes, total: coreBytes + pageBytes },
  };
}

/** Contenido de `out/sw-precache.js`, que el service worker carga con `importScripts`. */
export function precacheScript(manifest: PrecacheManifest): string {
  return [
    '/* Generado por scripts/generate-sw-precache.ts. No editar a mano. */',
    `self.__CALCUDO_PRECACHE__ = ${JSON.stringify(manifest)};`,
    '',
  ].join('\n');
}

/** Rutas que el build debió generar y que el precache no cubre (para fallar ruidosamente). */
export function findMissingRoutes(manifest: PrecacheManifest, routes: readonly string[]): string[] {
  const known = new Set([...manifest.core, ...manifest.pages]);
  return routes.filter((route) => !known.has(route));
}
