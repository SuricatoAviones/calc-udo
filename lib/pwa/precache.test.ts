import {
  buildPrecacheManifest,
  findMissingRoutes,
  precacheScript,
  precacheUrl,
  type PrecacheFile,
} from './precache';

const FILES: PrecacheFile[] = [
  { path: 'index.html', size: 100 },
  { path: 'index.txt', size: 50 },
  { path: '__next._full.txt', size: 20 },
  { path: 'metodos-numericos/index.html', size: 200 },
  { path: 'metodos-numericos/index.txt', size: 80 },
  { path: 'metodos-numericos/__next._tree.txt', size: 10 },
  { path: '_next/static/chunks/app.js', size: 500 },
  { path: '_next/static/media/font.woff2', size: 30 },
  { path: 'icons/icon-192.png', size: 20 },
  { path: 'indice-de-busqueda.json', size: 85 },
  { path: 'apple-icon.png', size: 18 },
  { path: '404.html', size: 19 },
  { path: '404/index.html', size: 19 },
  { path: 'sw.js', size: 5 },
  { path: 'sw-precache.js', size: 5 },
  { path: 'Logo_UDO.svg.webp', size: 332 },
  { path: '_next/static/chunks/app.js.map', size: 1 },
];

describe('precacheUrl', () => {
  it('publica index.html con barra final por trailingSlash', () => {
    expect(precacheUrl('index.html')).toBe('/');
    expect(precacheUrl('metodos-numericos/index.html')).toBe('/metodos-numericos/');
    expect(precacheUrl('metodos-numericos/biseccion/index.html')).toBe(
      '/metodos-numericos/biseccion/',
    );
  });

  it('acepta rutas de Windows', () => {
    expect(precacheUrl('metodos-numericos\\index.html')).toBe('/metodos-numericos/');
  });

  it('deja fuera lo que no debe cachearse', () => {
    expect(precacheUrl('404.html')).toBeNull();
    expect(precacheUrl('sw.js')).toBeNull();
    expect(precacheUrl('sw-precache.js')).toBeNull();
    expect(precacheUrl('Logo_UDO.svg.webp')).toBeNull();
    expect(precacheUrl('_next/static/chunks/app.js.map')).toBeNull();
    expect(precacheUrl('../fuera.html')).toBeNull();
  });

  it('conserva los recursos con su ruta completa', () => {
    expect(precacheUrl('_next/static/chunks/app.js')).toBe('/_next/static/chunks/app.js');
    expect(precacheUrl('indice-de-busqueda.json')).toBe('/indice-de-busqueda.json');
    expect(precacheUrl('icons/maskable-512.png')).toBe('/icons/maskable-512.png');
  });
});

describe('buildPrecacheManifest', () => {
  const manifest = buildPrecacheManifest(FILES, '1.2.0');

  it('separa el armazón de las páginas', () => {
    expect(manifest.core).toEqual([
      '/',
      '/__next._full.txt',
      '/_next/static/chunks/app.js',
      '/_next/static/media/font.woff2',
      '/apple-icon.png',
      '/icons/icon-192.png',
      '/index.txt',
      '/indice-de-busqueda.json',
    ]);
    expect(manifest.pages).toEqual([
      '/404/',
      '/metodos-numericos/',
      '/metodos-numericos/__next._tree.txt',
      '/metodos-numericos/index.txt',
    ]);
  });

  it('suma los tamaños por bloque', () => {
    expect(manifest.bytes).toEqual({ core: 823, pages: 309, total: 1132 });
  });

  it('genera una versión con la versión de la app y una huella del contenido', () => {
    expect(manifest.version).toMatch(/^1\.2\.0-[0-9a-f]{8}$/);
  });

  it('la huella no depende del orden de los archivos', () => {
    const shuffled = [...FILES].reverse();
    expect(buildPrecacheManifest(shuffled, '1.2.0').version).toBe(manifest.version);
  });

  it('la huella cambia si cambia el contenido de un archivo', () => {
    const changed = FILES.map((file) =>
      file.path === 'index.html' ? { ...file, size: file.size + 1 } : file,
    );
    expect(buildPrecacheManifest(changed, '1.2.0').version).not.toBe(manifest.version);
  });

  it('la huella cambia al subir la versión, aunque el contenido sea igual', () => {
    expect(buildPrecacheManifest(FILES, '1.3.0').version).not.toBe(manifest.version);
  });

  it('ignora los archivos excluidos al sumar', () => {
    const total = manifest.bytes.total;
    const withExtra = buildPrecacheManifest(
      [...FILES, { path: 'sw.js', size: 999 }, { path: '404.html', size: 999 }],
      '1.2.0',
    );
    expect(withExtra.bytes.total).toBe(total);
    expect(withExtra.version).toBe(manifest.version);
  });
});

describe('precacheScript', () => {
  it('emite JavaScript con el manifiesto completo', () => {
    const manifest = buildPrecacheManifest(FILES, '1.2.0');
    const script = precacheScript(manifest);
    const json = script.slice(script.indexOf('= ') + 2, script.lastIndexOf(';'));
    expect(JSON.parse(json)).toEqual(manifest);
  });
});

describe('findMissingRoutes', () => {
  const manifest = buildPrecacheManifest(FILES, '1.2.0');

  it('no reporta rutas presentes', () => {
    expect(findMissingRoutes(manifest, ['/', '/404/', '/metodos-numericos/'])).toEqual([]);
  });

  it('reporta las rutas que el precache no cubre', () => {
    expect(findMissingRoutes(manifest, ['/', '/fisica-1/', '/quimica/'])).toEqual([
      '/fisica-1/',
      '/quimica/',
    ]);
  });
});
