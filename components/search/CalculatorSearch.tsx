'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Input } from '@/components/ui/input';
import { searchCalculators, type SearchEntry } from '@/lib/search';
import { cn } from '@/lib/utils';

export const SEARCH_INDEX_URL = '/indice-de-busqueda.json';

/** El índice se descarga una sola vez, la primera vez que alguien usa el buscador. */
let indexPromise: Promise<SearchEntry[]> | null = null;
function loadIndex(): Promise<SearchEntry[]> {
  indexPromise ??= fetch(SEARCH_INDEX_URL)
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<SearchEntry[]>;
    })
    .catch((error: unknown) => {
      indexPromise = null; // permite reintentar
      throw error;
    });
  return indexPromise;
}

interface CalculatorSearchProps {
  autoFocus?: boolean;
  /** Se llama al elegir un resultado (p. ej. para cerrar el diálogo). */
  onNavigate?: () => void;
  /**
   * Escape dentro del buscador. Sin él, Escape borra el texto (lo normal en un campo de búsqueda);
   * en el diálogo cierra, como se espera de una ventana.
   */
  onEscape?: () => void;
  limit?: number;
  className?: string;
}

/**
 * Caja de búsqueda con resultados en vivo. Los resultados son enlaces: con ↓ y ↑ se recorren
 * desde el cuadro de texto, y Enter abre la calculadora.
 */
export function CalculatorSearch({
  autoFocus = false,
  onNavigate,
  onEscape,
  limit = 8,
  className,
}: CalculatorSearchProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (entries) return;
    loadIndex().then(
      (index) => {
        setEntries(index);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [entries]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      load();
    }
  }, [autoFocus, load]);

  const results = useMemo(
    () => (entries ? searchCalculators(entries, query, limit) : []),
    [entries, query, limit],
  );
  const hasQuery = query.trim() !== '';

  const links = () => [...(listRef.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [])];
  const moveFocus = (event: KeyboardEvent, from: number) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const all = links();
    if (all.length === 0) return;
    event.preventDefault();
    const next = from + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) inputRef.current?.focus();
    else all[Math.min(next, all.length - 1)]?.focus();
  };

  let status = '';
  if (hasQuery) {
    if (failed) status = 'No se pudo cargar el buscador. Revisa tu conexión e inténtalo de nuevo.';
    else if (!entries) status = 'Cargando…';
    else if (results.length === 0) status = `No hay calculadoras para «${query.trim()}».`;
    else status = `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}.`;
  }

  return (
    <div role="search" className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={`${id}-input`} className="sr-only">
        Buscar calculadora
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          ref={inputRef}
          id={`${id}-input`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={load}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && onEscape) {
              event.preventDefault();
              onEscape();
              return;
            }
            moveFocus(event, -1);
          }}
          placeholder="Buscar: Poisson, simplex, EOQ, Bayes…"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-status`}
          className="h-11 pl-9 text-base"
        />
      </div>
      <p
        id={`${id}-status`}
        role="status"
        className={cn('text-xs', results.length > 0 ? 'sr-only' : 'text-muted-foreground')}
      >
        {status}
      </p>
      {hasQuery && results.length > 0 && (
        <ul ref={listRef} className="bg-card flex flex-col overflow-hidden rounded-lg border">
          {results.map(({ entry }) => {
            const body = (
              <>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{entry.title}</span>
                  {entry.path === null && (
                    <span className="text-muted-foreground shrink-0 text-xs">Próximamente</span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {entry.subject} · {entry.topic}
                </span>
              </>
            );
            return (
              <li key={entry.id} className="border-b last:border-b-0">
                {entry.path === null ? (
                  <div className="flex flex-col gap-0.5 px-3 py-2 opacity-70">{body}</div>
                ) : (
                  <Link
                    href={entry.path}
                    onClick={onNavigate}
                    onKeyDown={(event) => moveFocus(event, links().indexOf(event.currentTarget))}
                    className="hover:bg-muted focus-visible:bg-muted focus-visible:ring-ring flex flex-col gap-0.5 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset"
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
