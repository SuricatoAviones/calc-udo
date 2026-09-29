'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CalculatorSearch } from './CalculatorSearch';

/** ¿El foco está en un campo de texto? Entonces «/» se escribe, no abre el buscador. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Botón del encabezado que abre el buscador en un `<dialog>` nativo (atrapa el foco y se cierra
 * con Escape). También se abre con Ctrl/⌘ + K o con «/».
 */
export function SearchDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setOpen(true);
  };
  const close = () => dialogRef.current?.close();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const shortcut =
        (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) ||
        (event.key === '/' && !isTyping(event.target));
      if (!shortcut) return;
      event.preventDefault();
      const dialog = dialogRef.current;
      if (dialog && !dialog.open) {
        dialog.showModal();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={show}
        aria-haspopup="dialog"
        className="text-muted-foreground gap-2"
      >
        <Search className="size-4" aria-hidden />
        <span className="sr-only sm:not-sr-only">Buscar</span>
        <kbd className="bg-muted hidden rounded px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </Button>
      <dialog
        ref={dialogRef}
        aria-label="Buscar calculadora"
        onClose={() => setOpen(false)}
        // Un clic en el fondo (fuera del contenido) llega al propio <dialog>.
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="bg-background text-foreground backdrop:bg-foreground/30 m-0 mx-auto mt-16 w-[calc(100%-2rem)] max-w-xl rounded-lg border p-0 shadow-lg backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Buscar calculadora</h2>
            <Button variant="ghost" size="icon" onClick={close} aria-label="Cerrar el buscador">
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          {open && <CalculatorSearch autoFocus onNavigate={close} onEscape={close} />}
        </div>
      </dialog>
    </>
  );
}
