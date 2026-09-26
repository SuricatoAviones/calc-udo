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
  // Introducción a la Lógica Formal y Algoritmos
  'tablas-de-verdad': () => import('./logica-formal-y-algoritmos/TruthTable'),
  'equivalencia-logica': () => import('./logica-formal-y-algoritmos/Equivalence'),
  'validez-de-argumentos': () => import('./logica-formal-y-algoritmos/ArgumentValidity'),
  'sistemas-de-numeracion': () => import('./logica-formal-y-algoritmos/NumeralSystems'),
  'representacion-binaria': () => import('./logica-formal-y-algoritmos/BinaryRepresentation'),
  'algoritmos-de-busqueda': () => import('./logica-formal-y-algoritmos/Search'),
  'algoritmos-de-ordenamiento': () => import('./logica-formal-y-algoritmos/Sort'),

  // Estadísticas I
  'medidas-descriptivas': () => import('./estadistica-1/DescriptiveMeasures'),
  'distribucion-binomial': () => import('./estadistica-1/Binomial'),
  'distribucion-de-poisson': () => import('./estadistica-1/Poisson'),
  'distribucion-normal': () => import('./estadistica-1/Normal'),

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

  // Modelos de Operaciones I
  'ruta-critica': () => import('./modelos-de-operaciones-1/CriticalPath'),
  pert: () => import('./modelos-de-operaciones-1/Pert'),
  'estrategias-puras': () => import('./modelos-de-operaciones-1/PureStrategies'),
  'estrategias-mixtas': () => import('./modelos-de-operaciones-1/MixedStrategies'),
  'ruta-mas-corta-pd': () => import('./modelos-de-operaciones-1/ShortestRoute'),
  'fuerza-de-trabajo': () => import('./modelos-de-operaciones-1/Workforce'),
  mochila: () => import('./modelos-de-operaciones-1/Knapsack'),
  'juegos-programacion-lineal': () => import('./modelos-de-operaciones-1/GameLp'),

  // Modelos de Operaciones II
  'promedio-movil': () => import('./modelos-de-operaciones-2/MovingAverage'),
  'suavizamiento-exponencial': () => import('./modelos-de-operaciones-2/ExponentialSmoothing'),
  eoq: () => import('./modelos-de-operaciones-2/Eoq'),
  'eoq-con-faltantes': () => import('./modelos-de-operaciones-2/EoqShortages'),
  'descuentos-por-cantidad': () => import('./modelos-de-operaciones-2/Discounts'),
  'punto-de-reorden': () => import('./modelos-de-operaciones-2/Reorder'),
  'modelo-de-un-periodo': () => import('./modelos-de-operaciones-2/SinglePeriod'),

  // Optimización de Operaciones
  'metodo-grafico': () => import('./optimizacion-de-operaciones/Graphical'),
  'forma-estandar': () => import('./optimizacion-de-operaciones/StandardForm'),
  simplex: () => import('./optimizacion-de-operaciones/Simplex'),
  'metodo-m-grande': () => import('./optimizacion-de-operaciones/BigM'),
  'metodo-dos-fases': () => import('./optimizacion-de-operaciones/TwoPhase'),
  'problema-dual': () => import('./optimizacion-de-operaciones/DualProblem'),
  'dual-simplex': () => import('./optimizacion-de-operaciones/DualSimplex'),
  'analisis-de-sensibilidad': () => import('./optimizacion-de-operaciones/Sensitivity'),
  'esquina-noroeste': () => import('./optimizacion-de-operaciones/NorthwestCorner'),
  'costo-minimo': () => import('./optimizacion-de-operaciones/LeastCost'),
  'aproximacion-de-vogel': () => import('./optimizacion-de-operaciones/Vogel'),
  'metodo-de-multiplicadores': () => import('./optimizacion-de-operaciones/Modi'),
  'metodo-hungaro': () => import('./optimizacion-de-operaciones/Hungarian'),
  'ramificacion-y-acotamiento': () => import('./optimizacion-de-operaciones/BranchAndBound'),

  // Procesos Estocásticos
  'transicion-en-n-pasos': () => import('./procesos-estocasticos/NStepTransition'),
  'estado-estable': () => import('./procesos-estocasticos/SteadyState'),

  // Teoría de Colas
  'cola-mm1': () => import('./teoria-de-colas/MM1'),
  'cola-mms': () => import('./teoria-de-colas/MMS'),
  'cola-mm1k': () => import('./teoria-de-colas/MM1K'),
};

export const implementedCalculatorIds: ReadonlySet<string> = new Set(
  Object.keys(calculatorRegistry),
);
