'use client';

import { useEffect, useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Phase =
  | { name: 'idle' }
  | { name: 'saving'; done: number; total: number }
  | { name: 'saved'; total: number };

/**
 * Descarga el resto del sitio (páginas y payloads de navegación) para usarlo sin conexión.
 *
 * Se deja a decisión del estudiante porque son ~24 MB: en datos móviles conviene que no ocurra
 * solo. El service worker informa el avance por `postMessage` (ADR-040).
 */
export function OfflineCacheButton() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let alive = true;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; done?: number; total?: number } | null;
      if (!data || typeof data.type !== 'string') return;
      if (data.type === 'PRECACHE_PROGRESS') {
        setPhase({ name: 'saving', done: data.done ?? 0, total: data.total ?? 0 });
      }
      if (data.type === 'PRECACHE_DONE') {
        setPhase({ name: 'saved', total: data.total ?? 0 });
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);

    navigator.serviceWorker.ready
      .then((registration) => {
        if (!alive) return;
        setVisible(true);
        const channel = new MessageChannel();
        channel.port1.onmessage = (event: MessageEvent) => {
          const data = event.data as { type?: string; done?: number; total?: number } | null;
          if (!data || data.type !== 'CACHE_STATUS') return;
          const done = data.done ?? 0;
          const total = data.total ?? 0;
          if (total > 0 && done === total) setPhase({ name: 'saved', total });
          else setPhase({ name: 'idle' });
        };
        registration.active?.postMessage({ type: 'CACHE_STATUS' }, [channel.port2]);
      })
      .catch(() => {
        // Sin service worker no hay nada que ofrecer.
      });

    return () => {
      alive = false;
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  if (!visible) return null;

  function save() {
    setPhase({ name: 'saving', done: 0, total: 0 });
    navigator.serviceWorker.ready
      .then((registration) => registration.active?.postMessage({ type: 'PRECACHE_ALL' }))
      .catch(() => setPhase({ name: 'idle' }));
  }

  const label =
    phase.name === 'saved'
      ? 'Disponible sin conexión'
      : phase.name === 'saving'
        ? phase.total > 0
          ? `Guardando… ${Math.round((phase.done / phase.total) * 100)} %`
          : 'Guardando…'
        : 'Guardar sin conexión';

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={save}
      disabled={phase.name !== 'idle'}
      title="Descarga las calculadoras para usarlas sin internet (unos 24 MB)"
    >
      {phase.name === 'saved' ? (
        <Check aria-hidden />
      ) : phase.name === 'saving' ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <Download aria-hidden />
      )}
      <span aria-live="polite">{label}</span>
    </Button>
  );
}
