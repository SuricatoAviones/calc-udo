import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export function SiteHeader() {
  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          {/* Sitio estático (output: 'export'): la imagen ya viene optimizada en public/. */}
          <Image
            src="/logo-udo.webp"
            alt=""
            width={32}
            height={32}
            unoptimized
            priority
            className="size-8 shrink-0"
          />
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-xl font-semibold tracking-tight">
              Calc<span className="text-pencil">UDO</span>
            </span>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              calculadoras con procedimiento
            </span>
          </span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
