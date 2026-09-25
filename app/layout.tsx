import type { Metadata, Viewport } from 'next';
import { Fraunces, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { themeInitScript } from '@/components/layout/ThemeToggle';
import './globals.css';

const display = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'CalcUDO — Calculadoras con procedimiento',
    template: '%s · CalcUDO',
  },
  description:
    'Calculadoras académicas con el procedimiento paso a paso para estudiantes de Ingeniería de Sistemas de la Universidad de Oriente.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f4ec' },
    { media: '(prefers-color-scheme: dark)', color: '#17201c' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica el tema antes del primer pintado para evitar el parpadeo claro→oscuro. */}
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        <a
          href="#contenido"
          className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Saltar al contenido
        </a>
        <SiteHeader />
        <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-16 sm:px-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
