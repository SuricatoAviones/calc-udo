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
  biseccion: () => import('./metodos-numericos/Bisection'),
  'falsa-posicion': () => import('./metodos-numericos/FalsePosition'),
  secante: () => import('./metodos-numericos/Secant'),
  'newton-raphson': () => import('./metodos-numericos/NewtonRaphson'),
  'regla-rectangular': () => import('./metodos-numericos/RectangleRule'),
  'regla-trapezoidal': () => import('./metodos-numericos/TrapezoidalRule'),
  'regla-de-simpson': () => import('./metodos-numericos/SimpsonRule'),
  euler: () => import('./metodos-numericos/Euler'),
  'euler-modificado': () => import('./metodos-numericos/ModifiedEuler'),
  'runge-kutta': () => import('./metodos-numericos/RungeKutta'),
};

export const implementedCalculatorIds: ReadonlySet<string> = new Set(
  Object.keys(calculatorRegistry),
);
