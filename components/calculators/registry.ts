import type { ComponentType } from 'react';

/**
 * Registro de calculadoras implementadas: id → carga diferida de su componente de UI.
 *
 * Es el ÚNICO lugar donde se "enciende" una calculadora. Estar aquí es lo que la marca como
 * implementada en todo el sitio (home, materia, tema, docs/PENSUM.md). El id debe coincidir con
 * el de data/curriculum.ts y con `meta.id` de la lógica en lib/calculators/.
 *
 * Las funciones de carga solo se invocan en la página de la calculadora, así que cada ruta
 * empaqueta únicamente su propio componente.
 */
export const calculatorRegistry: Record<string, () => Promise<{ default: ComponentType }>> = {
  // Métodos Numéricos
  'newton-raphson': () => import('./metodos-numericos/NewtonRaphson'),
};

export const implementedCalculatorIds: ReadonlySet<string> = new Set(
  Object.keys(calculatorRegistry),
);
