/* Service worker de CalcUDO (ADR-040).
 *
 * El sitio es 100 % estático, así que se cachea todo: el armazón al instalar y, si el estudiante
 * pulsa «Guardar sin conexión», también las páginas y sus payloads de navegación.
 * `sw-precache.js` lo genera `scripts/generate-sw-precache.ts` después de `next build`; aquí no se
 * escribe ninguna lista a mano.
 */

const FALLBACK_URL = '/';
const STATIC_PREFIXES = ['/_next/static/', '/icons/'];
const STATIC_FILES = new Set(['/logo-udo.webp', '/icon.png', '/apple-icon.png']);

let manifest = null;
try {
  importScripts('/sw-precache.js');
  manifest = self.__CALCUDO_PRECACHE__ || null;
} catch {
  // En `pnpm dev` no existe: el service worker solo se registra en producción. Si faltara en un
  // build real, la app sigue funcionando con la caché que se llena al navegar.
}

const CACHE_NAME = `calcudo-${manifest ? manifest.version : 'sin-manifiesto'}`;
const CORE = manifest ? manifest.core : [];
const PAGES = manifest ? manifest.pages : [];
const ALL_URLS = CORE.concat(PAGES);

/** Abre la caché de esta versión. Una versión nueva usa una caché nueva y borra la anterior. */
function openCache() {
  return caches.open(CACHE_NAME);
}

/** Busca una respuesta ignorando la query (`?_rsc=…` que agrega el router de Next). */
function match(cache, request) {
  return cache.match(request, { ignoreSearch: true });
}

/** Descarga en paralelo (6 a la vez) y avisa del avance. Un fallo no detiene al resto. */
async function precache(urls, onProgress) {
  const cache = await openCache();
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < urls.length) {
      const url = urls[next];
      next += 1;
      try {
        const cached = await cache.match(url);
        if (!cached) {
          const response = await fetch(url, { cache: 'reload' });
          if (response.ok) await cache.put(url, response);
        }
      } catch {
        // Sin conexión o 404 puntual: se reintenta en la próxima visita.
      }
      done += 1;
      if (onProgress && done % 10 === 0) onProgress(done, urls.length);
    }
  }

  const workers = Array.from({ length: Math.min(6, urls.length) }, () => worker());
  await Promise.all(workers);
  if (onProgress) onProgress(done, urls.length);
  return { done, total: urls.length };
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache(CORE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('calcudo-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticPath(pathname) {
  return (
    STATIC_FILES.has(pathname) || STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/** Sirve de la caché; si no está, descarga y guarda. */
async function cacheFirst(request) {
  const cache = await openCache();
  const cached = await match(cache, request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

/** Navegación: caché primero y, sin conexión y sin página guardada, el armazón de la portada. */
async function navigation(request) {
  try {
    return await cacheFirst(request);
  } catch {
    const cache = await openCache();
    const fallback = await cache.match(FALLBACK_URL);
    return fallback || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname === '/sw-precache.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }

  // Recursos estáticos, payloads de navegación e índice de búsqueda: son inmutables dentro de una
  // versión, así que la caché manda.
  event.respondWith(cacheFirst(request));
});

/** Cuenta cuántas URLs del manifiesto ya están guardadas, sin descargar nada. */
async function cachedCount() {
  const cache = await openCache();
  const keys = await cache.keys();
  const paths = new Set(keys.map((key) => new URL(key.url).pathname));
  return ALL_URLS.filter((url) => paths.has(url)).length;
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'CACHE_STATUS') {
    const port = event.ports && event.ports[0];
    event.waitUntil(
      cachedCount().then((done) => {
        if (port) port.postMessage({ type: 'CACHE_STATUS', done, total: ALL_URLS.length });
      }),
    );
    return;
  }

  if (data.type === 'PRECACHE_ALL') {
    const client = event.source;
    event.waitUntil(
      precache(ALL_URLS, (done, total) => {
        if (client) client.postMessage({ type: 'PRECACHE_PROGRESS', done, total });
      }).then(({ done, total }) => {
        if (client) client.postMessage({ type: 'PRECACHE_DONE', done, total });
      }),
    );
  }
});
