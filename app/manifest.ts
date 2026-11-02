import type { MetadataRoute } from 'next';

// Necesario en `output: 'export'`: el manifiesto se prerenderiza como archivo estático.
export const dynamic = 'force-static';

/**
 * Manifiesto de la aplicación instalable (ADR-040).
 *
 * Los iconos se generan desde `public/Logo_UDO.svg.webp`; el maskable lleva 20 % de margen para
 * que el recorte circular de Android no corte el sello de la UDO. Next publica este archivo como
 * `/manifest.webmanifest` y agrega el `<link rel="manifest">` solo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'CalcUDO — Calculadoras con procedimiento',
    short_name: 'CalcUDO',
    description:
      'Calculadoras académicas con el procedimiento paso a paso para estudiantes de Ingeniería de Sistemas de la Universidad de Oriente.',
    lang: 'es',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f7f4ec',
    theme_color: '#f7f4ec',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
