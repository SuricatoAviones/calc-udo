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
  'tabla-de-frecuencias': () => import('./estadistica-1/FrequencyTable'),
  'medidas-descriptivas': () => import('./estadistica-1/DescriptiveMeasures'),
  'tecnicas-de-conteo': () => import('./estadistica-1/Counting'),
  'teorema-de-bayes': () => import('./estadistica-1/Bayes'),
  'esperanza-y-varianza': () => import('./estadistica-1/Expectation'),
  'desigualdad-de-chebyshev': () => import('./estadistica-1/Chebyshev'),
  'funcion-generadora-de-momentos': () => import('./estadistica-1/MomentGenerating'),
  'distribucion-bernoulli': () => import('./estadistica-1/Bernoulli'),
  'distribucion-binomial': () => import('./estadistica-1/Binomial'),
  'distribucion-geometrica': () => import('./estadistica-1/Geometric'),
  'distribucion-de-pascal': () => import('./estadistica-1/Pascal'),
  'distribucion-multinomial': () => import('./estadistica-1/Multinomial'),
  'distribucion-hipergeometrica': () => import('./estadistica-1/Hypergeometric'),
  'distribucion-de-poisson': () => import('./estadistica-1/Poisson'),
  'distribucion-uniforme': () => import('./estadistica-1/Uniform'),
  'distribucion-exponencial': () => import('./estadistica-1/Exponential'),
  'distribucion-gamma': () => import('./estadistica-1/Gamma'),
  'distribucion-beta': () => import('./estadistica-1/Beta'),
  'distribucion-weibull': () => import('./estadistica-1/Weibull'),
  'distribucion-normal': () => import('./estadistica-1/Normal'),
  'teorema-del-limite-central': () => import('./estadistica-1/CentralLimit'),
  'distribuciones-muestrales': () => import('./estadistica-1/SamplingDistributions'),

  // Inferencia y Diseño de Experimentos
  'maxima-verosimilitud': () => import('./inferencia-y-diseno-de-experimentos/MaximumLikelihood'),

  // Estadísticas II
  'regresion-lineal': () => import('./estadistica-2/LinearRegression'),
  'coeficiente-de-correlacion': () => import('./estadistica-2/Correlation'),
  'prueba-de-hipotesis-media': () => import('./estadistica-2/MeanTest'),
  'prueba-de-hipotesis-varianza': () => import('./estadistica-2/VarianceTest'),
  'errores-tipo-i-y-ii': () => import('./estadistica-2/ErrorTypes'),
  'bondad-de-ajuste': () => import('./estadistica-2/GoodnessOfFit'),
  'pruebas-no-parametricas': () => import('./estadistica-2/NonParametric'),
  'componentes-de-series-de-tiempo': () => import('./estadistica-2/SeriesComponents'),
  'pronostico-de-series-de-tiempo': () => import('./estadistica-2/SeriesForecast'),

  // Métodos Numéricos
  'errores-numericos': () => import('./metodos-numericos/NumericErrors'),
  determinante: () => import('./metodos-numericos/Determinant'),
  'operaciones-con-matrices': () => import('./metodos-numericos/MatrixOperations'),
  'eliminacion-gaussiana': () => import('./metodos-numericos/GaussElimination'),
  biseccion: () => import('./metodos-numericos/Bisection'),
  'falsa-posicion': () => import('./metodos-numericos/FalsePosition'),
  secante: () => import('./metodos-numericos/Secant'),
  'newton-raphson': () => import('./metodos-numericos/NewtonRaphson'),
  'division-sintetica': () => import('./metodos-numericos/SyntheticDivision'),
  'factores-cuadraticos': () => import('./metodos-numericos/Bairstow'),
  'descenso-mas-rapido': () => import('./metodos-numericos/SteepestDescent'),
  'newton-varias-variables': () => import('./metodos-numericos/NewtonSystem'),
  'tabla-de-diferencias': () => import('./metodos-numericos/DifferenceTable'),
  'interpolacion-de-newton': () => import('./metodos-numericos/NewtonInterpolation'),
  'minimos-cuadrados': () => import('./metodos-numericos/LeastSquares'),
  'regla-rectangular': () => import('./metodos-numericos/RectangleRule'),
  'regla-trapezoidal': () => import('./metodos-numericos/TrapezoidalRule'),
  'regla-de-simpson': () => import('./metodos-numericos/SimpsonRule'),
  'derivacion-numerica': () => import('./metodos-numericos/NumericalDerivative'),
  'coeficientes-indeterminados': () => import('./metodos-numericos/UndeterminedCoefficients'),
  euler: () => import('./metodos-numericos/Euler'),
  'metodo-de-taylor': () => import('./metodos-numericos/TaylorOde'),
  'metodos-multipaso': () => import('./metodos-numericos/Multistep'),
  'euler-modificado': () => import('./metodos-numericos/ModifiedEuler'),
  'predictor-corrector': () => import('./metodos-numericos/PredictorCorrector'),
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
  'simplex-algebraico': () => import('./optimizacion-de-operaciones/AlgebraicSimplex'),
  simplex: () => import('./optimizacion-de-operaciones/Simplex'),
  'metodo-m-grande': () => import('./optimizacion-de-operaciones/BigM'),
  'metodo-dos-fases': () => import('./optimizacion-de-operaciones/TwoPhase'),
  'problema-dual': () => import('./optimizacion-de-operaciones/DualProblem'),
  'dual-simplex': () => import('./optimizacion-de-operaciones/DualSimplex'),
  'analisis-de-sensibilidad': () => import('./optimizacion-de-operaciones/Sensitivity'),
  'cambios-en-el-modelo': () => import('./optimizacion-de-operaciones/ModelChange'),
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
