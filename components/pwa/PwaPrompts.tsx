'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'calcudo-install-dismissed';

/** Evento propio de Chrome/Edge para abrir el diálogo de instalación. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // Safari en iOS no soporta display-mode; expone `standalone` en navigator.
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS 13+ se presenta como Macintosh, pero con pantalla táctil.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/** Suscripción vacía: estos valores se leen del navegador y no cambian durante la visita. */
const noSubscription = () => () => {};

/** Lee el «no volver a mostrar» sin romper la hidratación: en el servidor siempre es `false`. */
function useStoredDismissed(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => {
      try {
        return localStorage.getItem(DISMISS_KEY) === '1';
      } catch {
        return false;
      }
    },
    () => false,
  );
}

/** Safari en iOS no tiene `beforeinstallprompt`: hay que explicar los pasos a mano. */
function useIosHint(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => isIos() && !isStandalone(),
    () => false,
  );
}

/**
 * Avisos de la aplicación instalable (ADR-040): actualización del service worker e invitación a
 * instalar. La descarga para uso sin conexión vive en el pie (`OfflineCacheButton`).
 */
export function PwaPrompts() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [dismissedNow, setDismissedNow] = useState(false);
  const [installing, setInstalling] = useState(false);

  const storedDismissed = useStoredDismissed();
  const dismissed = dismissedNow || storedDismissed;
  const iosHint = useIosHint();

  // Registro del service worker y detección de una versión nueva esperando.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      // En desarrollo el service worker solo estorba (sirve HTML viejo de `out/`).
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => {});
      return;
    }

    let active = true;
    let reloading = false;

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        if (!active) return;
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaiting(registration.waiting);
        }
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;
          installingWorker.addEventListener('statechange', () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller &&
              registration.waiting
            ) {
              setWaiting(registration.waiting);
            }
          });
        });
      })
      .catch(() => {
        // Sin service worker la app sigue siendo un sitio normal.
      });

    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  // Invitación a instalar: Chrome/Edge la anuncian con beforeinstallprompt; iOS no.
  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setDismissedNow(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Sin almacenamiento, el aviso vuelve en la próxima visita.
    }
  }

  async function install() {
    if (!installEvent) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') setInstallEvent(null);
      else dismiss();
    } finally {
      setInstalling(false);
      setInstallEvent(null);
    }
  }

  const showUpdate = waiting !== null;
  const showInstall = !showUpdate && !dismissed && installEvent !== null;
  const showIos = !showUpdate && !dismissed && installEvent === null && iosHint;

  if (!showUpdate && !showInstall && !showIos) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] print:hidden">
      <div className="bg-card text-card-foreground w-full max-w-md rounded-lg border p-3 shadow-lg">
        {showUpdate ? (
          <div className="flex items-center justify-between gap-3">
            <output className="text-sm">Hay una versión nueva de CalcUDO.</output>
            <Button
              size="sm"
              onClick={() => {
                waiting.postMessage({ type: 'SKIP_WAITING' });
                setWaiting(null);
              }}
            >
              <RefreshCw aria-hidden />
              Actualizar
            </Button>
          </div>
        ) : null}

        {showInstall ? (
          <div className="flex items-center justify-between gap-3">
            <output className="text-sm">
              Instala CalcUDO y úsala sin conexión desde tu pantalla de inicio.
            </output>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" onClick={install} disabled={installing}>
                Instalar
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Ahora no
              </Button>
            </div>
          </div>
        ) : null}

        {showIos ? (
          <div className="flex flex-col gap-2">
            <output className="text-sm">
              Para instalar CalcUDO, toca <strong>Compartir</strong> y luego{' '}
              <strong>Añadir a pantalla de inicio</strong>.
            </output>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Entendido
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
