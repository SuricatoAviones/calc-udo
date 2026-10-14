'use client';

import {
  BookOpen,
  Calculator,
  ChevronDown,
  Hand,
  Info,
  Keyboard,
  MousePointer2,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { ComponentKind } from '@/lib/calculators/circuitos-y-sistemas/circuit';
import { cn } from '@/lib/utils';
import { PaletteIcon } from './circuit-symbols';

type Tab = 'raton' | 'tactil' | 'atajos';

const ELEMENTS: Record<ComponentKind, { name: string; unit: string; convention: string }> = {
  resistor: { name: 'Resistencia', unit: 'Ω', convention: 'Sin polaridad.' },
  'voltage-source': {
    name: 'Fuente de voltaje',
    unit: 'V',
    convention: 'El + marca el terminal positivo.',
  },
  'current-source': {
    name: 'Fuente de corriente',
    unit: 'A',
    convention: 'La flecha marca el sentido de la corriente.',
  },
  capacitor: {
    name: 'Capacitor',
    unit: 'F',
    convention: 'El + es la referencia de v_C; su valor inicial es v_C(0).',
  },
  inductor: {
    name: 'Inductor',
    unit: 'H',
    convention: 'La flecha es el sentido de i_L; su valor inicial es i_L(0).',
  },
};

/** Tecla o combinación: `Ctrl + Z` se dibuja como dos teclas. */
function Keys({ combo }: { combo: string }) {
  const parts = combo.split(' + ');
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {parts.map((part, i) => (
        <span key={part} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground text-[10px]">+</span>}
          <kbd className="bg-muted text-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border border-b-2 px-1.5 font-mono text-[11px] leading-none">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  );
}

function Tip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="bg-muted/30 rounded-md border p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{children}</p>
    </li>
  );
}

function ShortcutGroup({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div className="rounded-md border">
      <p className="bg-muted/50 border-b px-3 py-1.5 text-xs font-semibold tracking-wide uppercase">
        {title}
      </p>
      <dl className="divide-y">
        {items.map(([combo, action]) => (
          <div key={combo} className="flex items-center justify-between gap-3 px-3 py-1.5">
            <dt className="text-muted-foreground text-sm">{action}</dt>
            <dd className="shrink-0">
              <Keys combo={combo} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'raton', label: 'Ratón', icon: MousePointer2 },
  { id: 'tactil', label: 'Táctil', icon: Hand },
  { id: 'atajos', label: 'Atajos', icon: Keyboard },
];

const COARSE_POINTER = '(pointer: coarse)';

function subscribePointer(callback: () => void) {
  const query = window.matchMedia?.(COARSE_POINTER);
  query?.addEventListener('change', callback);
  return () => query?.removeEventListener('change', callback);
}

/** ¿El dispositivo se usa con el dedo? En el servidor se asume ratón. */
function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribePointer,
    () => window.matchMedia?.(COARSE_POINTER).matches ?? false,
    () => false,
  );
}

/**
 * Guía del constructor de circuitos: primeros pasos, leyenda de los elementos disponibles y
 * ayuda por tipo de dispositivo (en pantallas táctiles abre en la pestaña táctil). Se pliega.
 */
export function BuilderGuide({
  kinds,
  canSimulate,
}: {
  kinds: readonly ComponentKind[];
  canSimulate: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(true);
  const [chosenTab, setTab] = useState<Tab | null>(null);
  const coarse = useCoarsePointer();
  const tab: Tab = chosenTab ?? (coarse ? 'tactil' : 'raton');
  const hasStorage = kinds.includes('capacitor') || kinds.includes('inductor');

  function toggle() {
    setOpen((current) => !current);
  }

  const steps: { title: string; text: string; icon: ReactNode }[] = [
    {
      title: 'Coloca',
      text: 'Elige un elemento en la paleta y haz clic (o toca) la cuadrícula. La vista previa se imanta a los nodos.',
      icon: <PaletteIcon kind={kinds[0] ?? 'resistor'} />,
    },
    {
      title: 'Conecta',
      text: 'Con Cable, marca cada punto del recorrido; los tramos salen ortogonales. Termina con doble clic, Esc o «Terminar cable».',
      icon: <PaletteIcon kind="wire" />,
    },
    {
      title: 'Referencia',
      text: 'Con Tierra, marca el nodo de 0 V. Si no marcas ninguno, se usa el nodo con más conexiones.',
      icon: <PaletteIcon kind="ground" />,
    },
    {
      title: 'Calcula',
      text: canSimulate
        ? 'Pulsa Calcular para ver el procedimiento paso a paso. Simular (K) anima la corriente en el lienzo.'
        : 'Pulsa Calcular para formular las ecuaciones y ver la respuesta en el tiempo.',
      icon: <Calculator className="size-5" aria-hidden />,
    },
  ];

  return (
    <section className="bg-card @container overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={id}
        className="hover:bg-accent/40 focus-visible:ring-ring/50 flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-[3px]"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
          <BookOpen className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Guía del tablero</span>
          <span className="text-muted-foreground block text-xs">
            Cómo armar el circuito, editarlo y calcular
          </span>
        </span>
        <ChevronDown
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div id={id} className="flex flex-col gap-5 border-t px-4 py-4">
          {/* Primeros pasos */}
          <div>
            <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Primeros pasos
            </h4>
            <ol className="grid gap-2 @md:grid-cols-2 @3xl:grid-cols-4">
              {steps.map((step, i) => (
                <li key={step.title} className="bg-muted/30 flex gap-3 rounded-md border p-3">
                  <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="text-primary">{step.icon}</span>
                      {step.title}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Elementos disponibles */}
          <div>
            <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Elementos
            </h4>
            <ul className="grid gap-2 @md:grid-cols-2">
              {kinds.map((kind) => (
                <li key={kind} className="flex items-start gap-3 rounded-md border px-3 py-2">
                  <span className="text-foreground mt-0.5">
                    <PaletteIcon kind={kind} />
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{ELEMENTS[kind].name}</span>{' '}
                    <span className="text-muted-foreground font-mono text-xs">
                      ({ELEMENTS[kind].unit})
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {ELEMENTS[kind].convention}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-2 flex items-start gap-2 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Los valores admiten notación de ingeniería: 2.2k, 470m, 10µ (o 10u).
                {hasStorage &&
                  ' Al seleccionar un capacitor o un inductor también puedes escribir su valor inicial.'}
              </span>
            </p>
          </div>

          {/* Ayuda por dispositivo */}
          <div>
            <div
              role="tablist"
              aria-label="Ayuda por tipo de dispositivo"
              className="bg-muted grid grid-cols-3 gap-1 rounded-md p-1"
            >
              {TABS.map(({ id: tabId, label, icon: Icon }) => (
                <button
                  key={tabId}
                  type="button"
                  role="tab"
                  id={`${id}-${tabId}`}
                  aria-selected={tab === tabId}
                  aria-controls={`${id}-${tabId}-panel`}
                  onClick={() => setTab(tabId)}
                  className={cn(
                    'focus-visible:ring-ring/50 inline-flex min-w-0 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm whitespace-nowrap outline-none focus-visible:ring-[3px]',
                    tab === tabId
                      ? 'bg-card text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id={`${id}-${tab}-panel`}
              aria-labelledby={`${id}-${tab}`}
              className="mt-3"
            >
              {tab === 'raton' && (
                <ul className="grid gap-2 @md:grid-cols-2">
                  <Tip title="Mover y ajustar">
                    Arrastra el cuerpo de un componente para moverlo, o uno de sus puntos (terminal
                    o vértice de cable) para estirarlo. Los puntos se agarran a los nodos cercanos.
                  </Tip>
                  <Tip title="Codos de los cables">
                    Doble clic sobre un tramo agrega un codo que puedes arrastrar; doble clic sobre
                    un codo lo quita.
                  </Tip>
                  <Tip title="Seleccionar varios">
                    Shift+clic agrega o quita un elemento; Shift+arrastrar en el fondo dibuja un
                    recuadro. Al arrastrar uno, se mueve todo el grupo.
                  </Tip>
                  <Tip title="Girar y voltear">
                    R gira la pieza que vas a colocar o la selección; F voltea la polaridad de
                    fuentes
                    {hasStorage ? ', capacitores e inductores' : ''}.
                  </Tip>
                  <Tip title="Valores y etiquetas">
                    Selecciona un componente y edita su valor y su etiqueta en el panel que aparece
                    bajo el lienzo.
                  </Tip>
                  <Tip title="Moverte por el lienzo">
                    Rueda: zoom sobre el puntero. Botón central o derecho, o Espacio+arrastrar:
                    desplazar. Los botones de la esquina ajustan la vista al circuito.
                  </Tip>
                </ul>
              )}
              {tab === 'tactil' && (
                <ul className="grid gap-2 @md:grid-cols-2">
                  <Tip title="Colocar">
                    Toca una herramienta de la paleta y luego el punto de la cuadrícula. Usa el
                    botón de girar antes de tocar para cambiar la orientación.
                  </Tip>
                  <Tip title="Cables">
                    Con Cable, toca cada punto del recorrido y pulsa «Terminar cable» sobre el
                    lienzo.
                  </Tip>
                  <Tip title="Mover y desplazar">
                    Arrastra con un dedo un componente o uno de sus puntos para moverlo; arrastra
                    sobre el fondo para desplazar el lienzo.
                  </Tip>
                  <Tip title="Zoom">
                    Pellizca con dos dedos, o usa los botones + y − de la esquina.
                  </Tip>
                  <Tip title="Editar y borrar">
                    Toca un componente para seleccionarlo: abajo aparecen su valor y su etiqueta. La
                    papelera de la paleta lo elimina.
                  </Tip>
                  <Tip title="Deshacer">Los botones de flecha de la paleta deshacen y rehacen.</Tip>
                </ul>
              )}
              {tab === 'atajos' && (
                <div className="grid gap-3 @md:grid-cols-2">
                  <ShortcutGroup
                    title="Herramientas"
                    items={[
                      ['S', 'Seleccionar'],
                      ['W', 'Cable'],
                      ['G', 'Tierra'],
                      ['R', 'Girar'],
                      ...(canSimulate ? ([['K', 'Simular o detener']] as [string, string][]) : []),
                    ]}
                  />
                  <ShortcutGroup
                    title="Edición"
                    items={[
                      ['Ctrl + Z', 'Deshacer'],
                      ['Ctrl + Y', 'Rehacer'],
                      ['Ctrl + D', 'Duplicar'],
                      ['Supr', 'Eliminar'],
                      ['F', 'Voltear polaridad'],
                      ['Flechas', 'Mover una celda'],
                    ]}
                  />
                  <ShortcutGroup
                    title="Selección"
                    items={[
                      ['Ctrl + A', 'Todo'],
                      ['Shift + clic', 'Agregar o quitar'],
                      ['Shift + arrastrar', 'Recuadro'],
                      ['Esc', 'Cancelar y deseleccionar'],
                    ]}
                  />
                  <ShortcutGroup
                    title="Vista"
                    items={[
                      ['Rueda', 'Zoom'],
                      ['Espacio + arrastrar', 'Desplazar'],
                      ['Doble clic', 'Codo en un cable'],
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
