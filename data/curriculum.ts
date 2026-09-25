import type { Subject } from '@/lib/curriculum';

/**
 * Currículum de CalcUDO: materia → tema → calculadora.
 *
 * Fuente de verdad: docs/fuentes/pensum-rama-cuantitativa.md. Reglas:
 * - No se agregan materias ni temas que no estén en el pensum. Los temas agrupan el contenido
 *   programático tal como aparece; `description` lo cita casi literal.
 * - Cada calculadora se define UNA vez (en su tema "canónico") y otros temas la referencian con
 *   `{ ref: 'id' }`. Ej.: las distribuciones se definen en Estadísticas I y se refieren desde
 *   Inferencia; los modelos de colas se definen en Teoría de Colas y se refieren desde
 *   Procesos Estocásticos.
 * - El estado "implementada" NO se marca aquí: se deriva del registro de UI. Solo se marca
 *   `inProgress: true` mientras alguien trabaja en una calculadora.
 * - Temas sin calculadoras (p. ej. unidades de filosofía) se listan igual para que el mapa del
 *   pensum esté completo.
 *
 * Para extender a otras ramas de la carrera basta con agregar objetos `Subject` a este arreglo.
 */
export const subjects: Subject[] = [
  // ════════════════════════════════════════════════════════════════════════
  // Matemáticas I–IV: el pensum no incluye su programa analítico.
  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'matematicas-1',
    code: '008-1814',
    name: 'Matemáticas I',
    semester: 1,
    kind: 'obligatoria',
    prerequisites: [],
    credits: { total: 4, theory: 3, practice: 3 },
    creditsLabel: '4 (3T-3P)',
    content: 'pendiente',
    bibliography: [],
    topics: [],
  },
  {
    slug: 'matematicas-2',
    code: '008-1824',
    name: 'Matemáticas II',
    semester: 2,
    kind: 'obligatoria',
    prerequisites: ['008-1814'],
    credits: { total: 4, theory: 3, practice: 3 },
    creditsLabel: '4 (3T-3P)',
    content: 'pendiente',
    bibliography: [],
    topics: [],
  },
  {
    slug: 'matematicas-3',
    code: '008-2814',
    name: 'Matemáticas III',
    semester: 3,
    kind: 'obligatoria',
    prerequisites: ['008-1824'],
    credits: { total: 4, theory: 3, practice: 3 },
    creditsLabel: '4 (3T-3P)',
    content: 'pendiente',
    bibliography: [],
    topics: [],
  },
  {
    slug: 'matematicas-4',
    code: '008-2824',
    name: 'Matemáticas IV',
    semester: 4,
    kind: 'obligatoria',
    prerequisites: ['008-2814'],
    credits: { total: 4, theory: 3, practice: 3 },
    creditsLabel: '4 (3T-3P)',
    content: 'pendiente',
    bibliography: [],
    topics: [],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'logica-formal-y-algoritmos',
    code: '072-1162',
    name: 'Introducción a la Lógica Formal y Algoritmos',
    semester: 2,
    kind: 'obligatoria',
    prerequisites: [],
    credits: { total: 2, theory: 2, practice: 0 },
    creditsLabel: '2 (2T-0P)',
    objective:
      'Proporcionar una visión amplia de la Lógica Formal con la finalidad de inducir al estudiante a que comprenda lo que es el pensamiento, el juicio, la teoría del concepto, el razonamiento, el silogismo y sus variedades y la dialéctica.',
    content: 'definido',
    bibliography: [
      'fatone',
      'figerman-1998',
      'miro-quesada',
      'munoz-1996',
      'pfander',
      'romero-pucciarelli',
      'tucker-joyanes-2000',
    ],
    topics: [
      {
        slug: 'introduccion-a-la-filosofia',
        name: 'Introducción al estudio de la Filosofía',
        unit: 'Unidad I',
        description: 'Introducción al Estudio de la Filosofía.',
        calculators: [],
      },
      {
        slug: 'el-pensar-y-el-pensamiento',
        name: 'El pensar y el pensamiento',
        unit: 'Unidad II',
        description: 'El Pensar y El Pensamiento.',
        calculators: [],
      },
      {
        slug: 'principios-y-leyes-de-la-logica',
        name: 'Principios y leyes de la lógica',
        unit: 'Unidad III',
        description:
          'Principios y Leyes de la Lógica (incluye Sistemas de Numeración, Tablas de Verdad, Representación Binaria).',
        calculators: [
          {
            id: 'sistemas-de-numeracion',
            title: 'Conversión entre sistemas de numeración',
            summary: 'Convierte números entre bases (binaria, octal, decimal, hexadecimal…).',
          },
          {
            id: 'tablas-de-verdad',
            title: 'Tablas de verdad',
            summary: 'Construye la tabla de verdad de una proposición lógica.',
          },
          {
            id: 'representacion-binaria',
            title: 'Representación binaria',
            summary: 'Representa números en binario y muestra el procedimiento.',
          },
        ],
      },
      {
        slug: 'algoritmos',
        name: 'Introducción al estudio de algoritmos',
        unit: 'Unidad IV',
        description:
          'Definición, estructuras algorítmicas, diagramas de flujo, pseudocódigo, algoritmos de búsqueda y ordenamiento.',
        calculators: [
          {
            id: 'algoritmos-de-busqueda',
            title: 'Traza de algoritmos de búsqueda',
            summary: 'Ejecuta paso a paso algoritmos de búsqueda sobre una lista.',
          },
          {
            id: 'algoritmos-de-ordenamiento',
            title: 'Traza de algoritmos de ordenamiento',
            summary: 'Ejecuta paso a paso algoritmos de ordenamiento sobre una lista.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'metodos-numericos',
    code: '072-3913',
    name: 'Métodos Numéricos',
    semester: 5,
    kind: 'obligatoria',
    prerequisites: ['008-2824', '072-2103'],
    credits: { total: 3, theory: 2, practice: 2 },
    creditsLabel: '3 (2T-2P)',
    objective:
      'Aplicar soluciones numéricas aproximadas a problemas cuya solución analítica sea excesivamente laboriosa.',
    content: 'definido',
    bibliography: ['ledanois-2000', 'chapra-canale-2000', 'nakamura-1994', 'smith-1993'],
    topics: [
      {
        slug: 'modelos-y-errores',
        name: 'Modelos matemáticos y errores',
        description: 'Modelos matemáticos y errores (truncamiento, redondeo).',
        calculators: [
          {
            id: 'errores-numericos',
            title: 'Errores de truncamiento y redondeo',
            summary: 'Calcula error absoluto, relativo y porcentual de una aproximación.',
          },
        ],
      },
      {
        slug: 'determinantes-y-matrices',
        name: 'Determinantes y matrices',
        description: 'Determinantes y matrices.',
        calculators: [
          {
            id: 'determinante',
            title: 'Determinante de una matriz',
            summary: 'Calcula el determinante de una matriz cuadrada paso a paso.',
          },
          {
            id: 'operaciones-con-matrices',
            title: 'Operaciones con matrices',
            summary: 'Suma, producto y transpuesta de matrices con el procedimiento.',
          },
        ],
      },
      {
        slug: 'sistemas-de-ecuaciones-lineales',
        name: 'Eliminación gaussiana y pivoteo',
        description: 'Eliminación Gaussiana y estrategia de pivoteo.',
        calculators: [
          {
            id: 'eliminacion-gaussiana',
            title: 'Eliminación gaussiana con pivoteo',
            summary: 'Resuelve un sistema lineal mostrando cada operación de fila.',
          },
        ],
      },
      {
        slug: 'raices-de-ecuaciones',
        name: 'Raíces de ecuaciones',
        description: 'Métodos de bisección, falsa posición, secante, Newton.',
        calculators: [
          {
            id: 'biseccion',
            title: 'Método de bisección',
            summary: 'Aproxima una raíz dividiendo a la mitad un intervalo con cambio de signo.',
          },
          {
            id: 'falsa-posicion',
            title: 'Método de la falsa posición',
            summary: 'Aproxima una raíz por interpolación lineal dentro de un intervalo.',
          },
          {
            id: 'secante',
            title: 'Método de la secante',
            summary: 'Aproxima una raíz sin derivada, usando dos puntos previos.',
          },
          {
            id: 'newton-raphson',
            title: 'Método de Newton-Raphson',
            summary: 'Aproxima una raíz usando la recta tangente en cada iteración.',
          },
        ],
      },
      {
        slug: 'polinomios',
        name: 'Transformación de polinomios y división sintética',
        description: 'Transformación de polinomios y división sintética.',
        calculators: [
          {
            id: 'division-sintetica',
            title: 'División sintética',
            summary: 'Divide un polinomio entre (x − r) con el esquema de Ruffini.',
          },
        ],
      },
      {
        slug: 'descenso-mas-rapido',
        name: 'Método del descenso más rápido',
        description: 'Método del descenso más rápido.',
        calculators: [
          {
            id: 'descenso-mas-rapido',
            title: 'Método del descenso más rápido',
            summary: 'Busca un mínimo avanzando en la dirección opuesta al gradiente.',
          },
        ],
      },
      {
        slug: 'diferencias-e-interpolacion',
        name: 'Diferencias finitas, interpolación y aproximación',
        description:
          'Operadores en diferencias. Tablas de diferencia y fórmulas de Newton. Interpolación y aproximación (mínimos cuadrados).',
        calculators: [
          {
            id: 'tabla-de-diferencias',
            title: 'Tabla de diferencias',
            summary: 'Construye la tabla de diferencias finitas de un conjunto de datos.',
          },
          {
            id: 'interpolacion-de-newton',
            title: 'Interpolación con fórmulas de Newton',
            summary: 'Construye el polinomio interpolante de Newton a partir de una tabla.',
          },
          {
            id: 'minimos-cuadrados',
            title: 'Aproximación por mínimos cuadrados',
            summary: 'Ajusta un polinomio a datos minimizando la suma de cuadrados.',
          },
        ],
      },
      {
        slug: 'integracion-numerica',
        name: 'Integración numérica',
        description: 'Integración numérica (reglas rectangular, trapezoidal, Simpson).',
        calculators: [
          {
            id: 'regla-rectangular',
            title: 'Regla rectangular',
            summary: 'Aproxima una integral definida con rectángulos.',
          },
          {
            id: 'regla-trapezoidal',
            title: 'Regla trapezoidal',
            summary: 'Aproxima una integral definida con trapecios.',
          },
          {
            id: 'regla-de-simpson',
            title: 'Regla de Simpson',
            summary: 'Aproxima una integral definida con parábolas.',
          },
        ],
      },
      {
        slug: 'derivacion-numerica',
        name: 'Fórmulas en diferencias',
        description: 'Fórmulas en diferencias hacia adelante y centradas.',
        calculators: [
          {
            id: 'derivacion-numerica',
            title: 'Derivación por diferencias finitas',
            summary: 'Aproxima derivadas con diferencias hacia adelante y centradas.',
          },
        ],
      },
      {
        slug: 'ecuaciones-diferenciales',
        name: 'Ecuaciones diferenciales',
        description:
          'Método de Euler, Taylor, métodos multipaso, Euler modificado, predictor-corrector, Runge-Kutta.',
        calculators: [
          {
            id: 'euler',
            title: 'Método de Euler',
            summary: 'Resuelve un problema de valor inicial con pasos lineales.',
          },
          {
            id: 'metodo-de-taylor',
            title: 'Método de Taylor',
            summary: 'Resuelve un problema de valor inicial con series de Taylor.',
          },
          {
            id: 'metodos-multipaso',
            title: 'Métodos multipaso',
            summary: 'Resuelve un problema de valor inicial usando varios puntos previos.',
          },
          {
            id: 'euler-modificado',
            title: 'Método de Euler modificado',
            summary: 'Mejora el método de Euler promediando pendientes.',
          },
          {
            id: 'predictor-corrector',
            title: 'Método predictor-corrector',
            summary: 'Predice con una fórmula explícita y corrige con una implícita.',
          },
          {
            id: 'runge-kutta',
            title: 'Método de Runge-Kutta',
            summary: 'Resuelve un problema de valor inicial con pendientes ponderadas.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'estadistica-1',
    code: '062-3313',
    name: 'Estadísticas I',
    semester: 4,
    kind: 'obligatoria',
    prerequisites: ['008-2814'],
    credits: { total: 3, theory: 3, practice: 0 },
    creditsLabel: '3 (3T-0P)',
    objective:
      'Aplicar los conceptos básicos–esenciales de la estadística descriptiva y probabilística.',
    content: 'definido',
    bibliography: ['canavos-1995', 'meyer-1998', 'mendenhall-sincich-1997', 'walpole-1999'],
    topics: [
      {
        slug: 'descripcion-de-datos',
        name: 'Descripción de datos',
        description:
          'Descripción de datos (técnicas gráficas, medidas de tendencia central y dispersión).',
        calculators: [
          {
            id: 'tabla-de-frecuencias',
            title: 'Tabla de frecuencias e histograma',
            summary: 'Agrupa datos en clases y los representa gráficamente.',
          },
          {
            id: 'medidas-descriptivas',
            title: 'Medidas de tendencia central y dispersión',
            summary: 'Media, mediana, moda, varianza y desviación estándar con su cálculo.',
          },
        ],
      },
      {
        slug: 'probabilidades',
        name: 'Introducción a probabilidades',
        description:
          'Conjuntos, experimentos, espacios muestrales, eventos, teoremas de adición y multiplicación, permutaciones, combinaciones, probabilidad condicional, teorema de Bayes.',
        calculators: [
          {
            id: 'tecnicas-de-conteo',
            title: 'Permutaciones y combinaciones',
            summary: 'Cuenta arreglos y selecciones con y sin orden.',
          },
          {
            id: 'teorema-de-bayes',
            title: 'Probabilidad condicional y teorema de Bayes',
            summary: 'Calcula probabilidades a posteriori a partir de una partición de eventos.',
          },
        ],
      },
      {
        slug: 'variables-aleatorias',
        name: 'Variables aleatorias',
        description:
          'Variables aleatorias discretas y continuas, función de distribución, esperanza y varianza, desigualdad de Chebyshev, función generadora de momentos.',
        calculators: [
          {
            id: 'esperanza-y-varianza',
            title: 'Esperanza y varianza de una variable aleatoria',
            summary: 'Calcula E[X] y Var(X) a partir de la distribución de probabilidad.',
          },
          {
            id: 'desigualdad-de-chebyshev',
            title: 'Desigualdad de Chebyshev',
            summary: 'Acota la probabilidad de alejarse k desviaciones de la media.',
          },
          {
            id: 'funcion-generadora-de-momentos',
            title: 'Función generadora de momentos',
            summary: 'Obtiene los momentos de una distribución derivando su FGM.',
          },
        ],
      },
      {
        slug: 'distribuciones-discretas',
        name: 'Distribuciones discretas',
        description:
          'Bernoulli, binomial, geométrica, Pascal, multinomial, hipergeométrica, Poisson.',
        calculators: [
          {
            id: 'distribucion-bernoulli',
            title: 'Distribución de Bernoulli',
            summary: 'Probabilidades de un ensayo con dos resultados.',
          },
          {
            id: 'distribucion-binomial',
            title: 'Distribución binomial',
            summary: 'Probabilidad de k éxitos en n ensayos independientes.',
          },
          {
            id: 'distribucion-geometrica',
            title: 'Distribución geométrica',
            summary: 'Probabilidad de que el primer éxito ocurra en el ensayo k.',
          },
          {
            id: 'distribucion-de-pascal',
            title: 'Distribución de Pascal',
            summary: 'Probabilidad de que el r-ésimo éxito ocurra en el ensayo k.',
          },
          {
            id: 'distribucion-multinomial',
            title: 'Distribución multinomial',
            summary: 'Generalización de la binomial a más de dos resultados.',
          },
          {
            id: 'distribucion-hipergeometrica',
            title: 'Distribución hipergeométrica',
            summary: 'Probabilidad de éxitos al muestrear sin reemplazo.',
          },
          {
            id: 'distribucion-de-poisson',
            title: 'Distribución de Poisson',
            summary: 'Probabilidad de k eventos en un intervalo con tasa λ.',
          },
        ],
      },
      {
        slug: 'distribuciones-continuas',
        name: 'Distribuciones continuas',
        description:
          'Uniforme, exponencial, gamma, beta, Weibull, normal, teorema del límite central.',
        calculators: [
          {
            id: 'distribucion-uniforme',
            title: 'Distribución uniforme',
            summary: 'Probabilidades para una variable equiprobable en [a, b].',
          },
          {
            id: 'distribucion-exponencial',
            title: 'Distribución exponencial',
            summary: 'Probabilidades para tiempos entre eventos con tasa λ.',
          },
          {
            id: 'distribucion-gamma',
            title: 'Distribución gamma',
            summary: 'Probabilidades para la distribución gamma(α, β).',
          },
          {
            id: 'distribucion-beta',
            title: 'Distribución beta',
            summary: 'Probabilidades para la distribución beta(α, β) en [0, 1].',
          },
          {
            id: 'distribucion-weibull',
            title: 'Distribución de Weibull',
            summary: 'Probabilidades para la distribución de Weibull.',
          },
          {
            id: 'distribucion-normal',
            title: 'Distribución normal',
            summary: 'Probabilidades con estandarización y la tabla Z.',
          },
          {
            id: 'teorema-del-limite-central',
            title: 'Teorema del límite central',
            summary: 'Aproxima la distribución de la media muestral con la normal.',
          },
        ],
      },
      {
        slug: 'muestreo',
        name: 'Teoría elemental del muestreo',
        description: 'Teoría elemental del muestreo.',
        calculators: [
          {
            id: 'distribuciones-muestrales',
            title: 'Distribuciones muestrales',
            summary: 'Media y error estándar de estadísticos muestrales.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'inferencia-y-diseno-de-experimentos',
    code: '071-3122',
    name: 'Inferencia y Diseño de Experimentos',
    semester: 5,
    kind: 'obligatoria',
    prerequisites: ['062-3313'],
    credits: { total: 2, theory: 1, practice: 2 },
    creditsLabel: '2 (1T-2P)',
    objective:
      'Adaptar modelos probabilísticos, partiendo de la definición de variables aleatorias, mediante un diseño experimental que conduzca a inferir acerca de sistemas o fenómenos de la vida real.',
    content: 'definido',
    bibliography: [
      'bonini-2000',
      'johnson-1997',
      'mendenhall-sincich-1997',
      'meyer-1998',
      'spiegel-1991',
      'walpole-1998',
      'willey-2001',
    ],
    topics: [
      {
        slug: 'aspectos-generales',
        name: 'Aspectos generales de la inferencia',
        description:
          'Aspectos generales de la inferencia y diseño de experimentos, recolección de datos.',
        calculators: [],
      },
      {
        slug: 'probabilidad',
        name: 'Conceptos básicos de probabilidad',
        description: 'Axiomas, teoremas, teorema de Bayes.',
        calculators: [{ ref: 'teorema-de-bayes' }],
      },
      {
        slug: 'variables-aleatorias',
        name: 'Variables aleatorias',
        description: 'Variables aleatorias, funciones de densidad y distribución, media, varianza.',
        calculators: [{ ref: 'esperanza-y-varianza' }],
      },
      {
        slug: 'estimacion-de-parametros',
        name: 'Estimación de parámetros',
        description: 'Estimación de parámetros (método de máxima verosimilitud).',
        calculators: [
          {
            id: 'maxima-verosimilitud',
            title: 'Estimación por máxima verosimilitud',
            summary: 'Estima parámetros de una distribución a partir de una muestra.',
          },
        ],
      },
      {
        slug: 'distribuciones-de-probabilidad',
        name: 'Distribuciones de probabilidad',
        description:
          'Distribuciones discretas y continuas (Binomial, Geométrica, Pascal, Hipergeométrica, Poisson, Normal, Exponencial, Weibull).',
        calculators: [
          { ref: 'distribucion-binomial' },
          { ref: 'distribucion-geometrica' },
          { ref: 'distribucion-de-pascal' },
          { ref: 'distribucion-hipergeometrica' },
          { ref: 'distribucion-de-poisson' },
          { ref: 'distribucion-normal' },
          { ref: 'distribucion-exponencial' },
          { ref: 'distribucion-weibull' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'estadistica-2',
    code: '062-4622',
    name: 'Estadísticas II',
    semester: 5,
    kind: 'obligatoria',
    prerequisites: ['062-3313'],
    // El pensum dice "3 (2T-0P)"; se respeta aunque las horas no sumen los créditos.
    credits: { total: 3, theory: 2, practice: 0 },
    creditsLabel: '3 (2T-0P)',
    objective:
      'Aplicar los conceptos relacionados con los métodos de análisis de regresión y correlación, diseño de experimentos y estadística no paramétrica, para la toma de decisiones en el ámbito operativo y administrativo de los sistemas productivos.',
    content: 'definido',
    bibliography: ['canavos-1995', 'meyer-1998'],
    topics: [
      {
        slug: 'regresion-y-correlacion',
        name: 'Regresión y correlación',
        description:
          'Curvas de regresión, regresión lineal, método de mínimos cuadrados, intervalos de confianza, coeficientes de correlación.',
        calculators: [
          {
            id: 'regresion-lineal',
            title: 'Regresión lineal simple',
            summary: 'Recta de mínimos cuadrados con intervalos de confianza.',
          },
          {
            id: 'coeficiente-de-correlacion',
            title: 'Coeficiente de correlación',
            summary: 'Mide la asociación lineal entre dos variables.',
          },
        ],
      },
      {
        slug: 'pruebas-de-hipotesis',
        name: 'Pruebas de hipótesis',
        description:
          'Hipótesis simples y compuestas, errores tipo I y II, función potencial, pruebas sobre la media y varianza, bondad de ajuste, pruebas no paramétricas.',
        calculators: [
          {
            id: 'prueba-de-hipotesis-media',
            title: 'Prueba de hipótesis sobre la media',
            summary: 'Contrasta hipótesis sobre μ con estadístico Z o t.',
          },
          {
            id: 'prueba-de-hipotesis-varianza',
            title: 'Prueba de hipótesis sobre la varianza',
            summary: 'Contrasta hipótesis sobre σ² con el estadístico ji-cuadrado.',
          },
          {
            id: 'errores-tipo-i-y-ii',
            title: 'Errores tipo I y II y función potencia',
            summary: 'Calcula α, β y la potencia de una prueba.',
          },
          {
            id: 'bondad-de-ajuste',
            title: 'Prueba de bondad de ajuste',
            summary: 'Contrasta si los datos siguen una distribución dada (ji-cuadrado).',
          },
          {
            id: 'pruebas-no-parametricas',
            title: 'Pruebas no paramétricas',
            summary: 'Contrastes que no suponen una distribución para la población.',
          },
        ],
      },
      {
        slug: 'series-de-tiempo',
        name: 'Series de tiempo',
        description:
          'Representación y análisis de series de tiempo, fluctuaciones cíclicas, predicciones a corto y largo plazo.',
        calculators: [
          {
            id: 'componentes-de-series-de-tiempo',
            title: 'Análisis de series de tiempo',
            summary: 'Descompone una serie en tendencia y fluctuaciones cíclicas.',
          },
          {
            id: 'pronostico-de-series-de-tiempo',
            title: 'Predicción con series de tiempo',
            summary: 'Pronósticos a corto y largo plazo a partir de la tendencia.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'optimizacion-de-operaciones',
    code: '071-3663',
    name: 'Optimización de Operaciones',
    semester: 6,
    kind: 'obligatoria',
    prerequisites: ['072-3913'],
    credits: { total: 3, theory: 2, practice: 3 },
    creditsLabel: '3 (2T-3P)',
    objective:
      'Aplicar herramientas de la investigación de operaciones para la optimización de procesos en estado estable, mediante la planificación de la producción, rutas, distribuciones de productos, etc.',
    content: 'definido',
    bibliography: [
      'bonini-2000',
      'taha',
      'aquilano-1994',
      'anderson-1993',
      'gould-eppen-schmidt',
      'arreola-2003',
      'hillier-lieberman-2002',
      'winston-1994',
    ],
    topics: [
      {
        slug: 'introduccion-a-la-programacion-lineal',
        name: 'Introducción a la programación lineal',
        description:
          'Investigación de operaciones, tipos de modelos, estructura matemática, fases de un estudio de PL.',
        calculators: [],
      },
      {
        slug: 'resolucion-de-modelos',
        name: 'Resolución de modelos de PL',
        description:
          'Método gráfico, forma canónica/estándar, método simplex (algebraico y tabular), técnicas de penalización (Método de la M grande, Método de las Dos Fases).',
        calculators: [
          {
            id: 'metodo-grafico',
            title: 'Método gráfico',
            summary: 'Resuelve un modelo de PL de dos variables sobre el plano.',
          },
          {
            id: 'forma-estandar',
            title: 'Forma canónica y estándar',
            summary: 'Convierte un modelo de PL a forma estándar con holguras y excesos.',
          },
          {
            id: 'simplex',
            title: 'Método simplex',
            summary: 'Resuelve un modelo de PL con tablas simplex iteración por iteración.',
          },
          {
            id: 'metodo-m-grande',
            title: 'Método de la M grande',
            summary: 'Simplex con variables artificiales penalizadas con M.',
          },
          {
            id: 'metodo-dos-fases',
            title: 'Método de las dos fases',
            summary: 'Simplex que primero busca una solución básica factible.',
          },
        ],
      },
      {
        slug: 'dualidad-y-sensibilidad',
        name: 'Dualidad y análisis de sensibilidad',
        description: 'Dualidad y método dual-simplex, análisis de sensibilidad.',
        calculators: [
          {
            id: 'problema-dual',
            title: 'Construcción del problema dual',
            summary: 'Obtiene el dual de un modelo de PL.',
          },
          {
            id: 'dual-simplex',
            title: 'Método dual-simplex',
            summary: 'Simplex que parte de una solución óptima pero no factible.',
          },
          {
            id: 'analisis-de-sensibilidad',
            title: 'Análisis de sensibilidad',
            summary: 'Rangos de los coeficientes y recursos que conservan la base óptima.',
          },
        ],
      },
      {
        slug: 'transporte-y-asignacion',
        name: 'Transporte y asignación',
        description:
          'Esquina noroeste, costo mínimo, aproximación de Vogel, método de multiplicadores, método húngaro.',
        calculators: [
          {
            id: 'esquina-noroeste',
            title: 'Método de la esquina noroeste',
            summary: 'Solución inicial de un problema de transporte.',
          },
          {
            id: 'costo-minimo',
            title: 'Método del costo mínimo',
            summary: 'Solución inicial asignando primero las celdas más baratas.',
          },
          {
            id: 'aproximacion-de-vogel',
            title: 'Método de aproximación de Vogel',
            summary: 'Solución inicial basada en penalizaciones por fila y columna.',
          },
          {
            id: 'metodo-de-multiplicadores',
            title: 'Método de multiplicadores',
            summary: 'Mejora una solución de transporte hasta la óptima.',
          },
          {
            id: 'metodo-hungaro',
            title: 'Método húngaro',
            summary: 'Resuelve problemas de asignación de costo mínimo.',
          },
        ],
      },
      {
        slug: 'programacion-entera',
        name: 'Programación entera',
        description:
          'Programación entera (pura, mixta, binaria), técnicas de ramificación y acotamiento, uso de software (GPL, TORA, WSB).',
        calculators: [
          {
            id: 'ramificacion-y-acotamiento',
            title: 'Ramificación y acotamiento',
            summary: 'Resuelve modelos enteros explorando un árbol de subproblemas.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'programacion-no-lineal',
    code: '071-4303',
    name: 'Programación No Lineal',
    semester: null,
    kind: 'electiva-tecnica',
    prerequisites: ['071-3663'],
    credits: { total: 3, theory: 3, practice: 0 },
    creditsLabel: '3 (3T-0P)',
    objective:
      'Aplicar técnicas de cálculo diferencial y métodos de optimización para la búsqueda o localización de extremos óptimos en funciones no lineales.',
    content: 'definido',
    bibliography: ['bazaraa-1993', 'cooper-1998', 'hadley-2000', 'rao-1999'],
    topics: [
      {
        slug: 'optimizacion-clasica',
        name: 'Teoría de optimización clásica',
        unit: 'Unidad I',
        description:
          'Métodos analíticos, optimización no restringida (una y varias variables), método de multiplicadores de Lagrange (restricciones de igualdad, desigualdad, no negatividad), funciones de penalidad, condiciones de Karush-Kuhn-Tucker.',
        calculators: [
          {
            id: 'optimizacion-una-variable',
            title: 'Optimización no restringida de una variable',
            summary: 'Puntos críticos y criterio de la segunda derivada.',
          },
          {
            id: 'optimizacion-varias-variables',
            title: 'Optimización no restringida de varias variables',
            summary: 'Gradiente, matriz hessiana y clasificación de puntos críticos.',
          },
          {
            id: 'multiplicadores-de-lagrange',
            title: 'Multiplicadores de Lagrange',
            summary: 'Extremos con restricciones de igualdad.',
          },
          {
            id: 'funciones-de-penalidad',
            title: 'Funciones de penalidad',
            summary: 'Convierte un problema restringido en uno no restringido.',
          },
          {
            id: 'condiciones-kkt',
            title: 'Condiciones de Karush-Kuhn-Tucker',
            summary: 'Verifica las condiciones KKT en un punto candidato.',
          },
        ],
      },
      {
        slug: 'programacion-cuadratica',
        name: 'Programación cuadrática',
        unit: 'Unidad II',
        description: 'Algoritmo para problemas cuadráticos, método de Wolfe-Phillip.',
        calculators: [
          {
            id: 'metodo-de-wolfe',
            title: 'Método de Wolfe',
            summary: 'Resuelve programas cuadráticos con un simplex modificado.',
          },
        ],
      },
      {
        slug: 'programacion-geometrica',
        name: 'Programación geométrica',
        unit: 'Unidad III',
        description: 'Algoritmos sin y con restricciones.',
        calculators: [
          {
            id: 'programacion-geometrica',
            title: 'Programación geométrica',
            summary: 'Optimiza posinomios mediante el problema dual.',
          },
        ],
      },
      {
        slug: 'programacion-separable',
        name: 'Programación separable',
        unit: 'Unidad IV',
        description: 'Formulación, método simplex modificado, reglas de base restringida.',
        calculators: [
          {
            id: 'programacion-separable',
            title: 'Programación separable',
            summary: 'Aproxima funciones separables por tramos lineales.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'procesos-estocasticos',
    code: '071-4383',
    name: 'Procesos Estocásticos',
    semester: null,
    kind: 'electiva-tecnica',
    prerequisites: ['071-3122'],
    credits: { total: 3, theory: 3, practice: 0 },
    creditsLabel: '3 (3T-0P)',
    objective:
      'Reconocer los procesos estocásticos y desarrollar modelos paramétricos y/o no paramétricos que se adapten a sistemas o fenómenos que se rigen por leyes probabilísticas.',
    content: 'definido',
    bibliography: [
      'arnold-2001',
      'barndorff-nielsen-2000',
      'borovkor-1998',
      'mathur-solow-1996',
      'kaufman-1996',
      'suddehender-1995',
      'wong-2007',
    ],
    topics: [
      {
        slug: 'aspectos-generales',
        name: 'Aspectos generales',
        unit: 'Unidad I',
        description:
          'Definición y clasificación de procesos estocásticos (según espacio de estados, parámetro tiempo, relación entre variables aleatorias).',
        calculators: [],
      },
      {
        slug: 'cadenas-de-markov',
        name: 'Cadenas de Markov',
        unit: 'Unidad II',
        description:
          'Terminología, matriz de transición, clasificación de estados, propiedad ergódica, probabilidades de estado estable.',
        calculators: [
          {
            id: 'transicion-en-n-pasos',
            title: 'Probabilidades de transición en n pasos',
            summary: 'Potencias de la matriz de transición y distribución en el paso n.',
          },
          {
            id: 'clasificacion-de-estados',
            title: 'Clasificación de estados',
            summary: 'Identifica clases, estados recurrentes, transitorios y absorbentes.',
          },
          {
            id: 'estado-estable',
            title: 'Probabilidades de estado estable',
            summary: 'Resuelve π = πP para una cadena ergódica.',
          },
        ],
      },
      {
        slug: 'fenomenos-de-espera',
        name: 'Fenómenos de espera',
        unit: 'Unidad III',
        description:
          'Estructura de sistemas de colas, procesos de llegada/servicio, medidas de rendimiento, modelos de colas (población/canal finito o infinito), análisis de costos.',
        calculators: [
          { ref: 'cola-mm1' },
          { ref: 'cola-mms' },
          { ref: 'cola-mm1k' },
          { ref: 'cola-poblacion-finita' },
          { ref: 'costos-de-colas' },
        ],
      },
      {
        slug: 'otros-procesos',
        name: 'Otros procesos estocásticos',
        unit: 'Unidad IV',
        description:
          'Procesos de Poisson, semi-Markovianos, estacionarios, caminatas aleatorias, procesos de reemplazo, nacimiento y muerte; simulación; introducción a modelos no paramétricos.',
        calculators: [
          {
            id: 'proceso-de-poisson',
            title: 'Proceso de Poisson',
            summary: 'Probabilidades de conteo y tiempos entre llegadas.',
          },
          {
            id: 'caminata-aleatoria',
            title: 'Caminata aleatoria',
            summary: 'Probabilidades de posición tras n pasos.',
          },
          {
            id: 'nacimiento-y-muerte',
            title: 'Proceso de nacimiento y muerte',
            summary: 'Probabilidades de estado estable con tasas λₙ y μₙ.',
          },
          {
            id: 'simulacion',
            title: 'Simulación',
            summary: 'Genera realizaciones de un proceso a partir de números aleatorios.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'teoria-de-colas',
    code: '071-4393',
    name: 'Teoría de Colas',
    semester: null,
    kind: 'electiva-tecnica',
    prerequisites: ['071-4383'],
    credits: { total: 3, theory: 3, practice: 0 },
    creditsLabel: '3 (3T-0P)',
    objective:
      'Evaluar el comportamiento de un fenómeno de espera, a través del diseño de un modelo de colas que optimice el funcionamiento del sistema.',
    content: 'definido',
    bibliography: [
      'hillier-lieberman-2002',
      'kaufman-1996',
      'mathur-solow-1996',
      'gould-eppen-schmidt',
      'winston-1994',
    ],
    topics: [
      {
        slug: 'fundamentos',
        name: 'Fundamentos de fenómenos de espera',
        unit: 'Unidad I',
        description:
          'Fuente de entrada, proceso de colas, mecanismos de servicio, disciplina de la cola.',
        calculators: [],
      },
      {
        slug: 'modelos-exponenciales',
        name: 'Modelos con distribuciones exponenciales',
        unit: 'Unidad II',
        description:
          'Modelos de colas con distribuciones exponenciales (un servidor y servidores múltiples), análisis de costos.',
        calculators: [
          {
            id: 'cola-mm1',
            title: 'Modelo M/M/1',
            summary: 'Un servidor, llegadas Poisson y servicio exponencial.',
          },
          {
            id: 'cola-mms',
            title: 'Modelo M/M/s',
            summary: 'Varios servidores en paralelo con cola común.',
          },
          {
            id: 'cola-mm1k',
            title: 'Modelo M/M/1/K',
            summary: 'Un servidor con capacidad finita del sistema.',
          },
          {
            id: 'cola-poblacion-finita',
            title: 'Modelo con población finita',
            summary: 'Fuente de entrada con un número limitado de clientes.',
          },
          {
            id: 'costos-de-colas',
            title: 'Análisis de costos',
            summary: 'Número de servidores que minimiza el costo total.',
          },
        ],
      },
      {
        slug: 'otras-aplicaciones',
        name: 'Otras aplicaciones',
        unit: 'Unidad III',
        description:
          'Modelos de pérdida de Erlang, colas con prioridad, distribuciones no exponenciales, nacimiento y muerte, análisis computacional.',
        calculators: [
          {
            id: 'perdida-de-erlang',
            title: 'Modelo de pérdida de Erlang',
            summary: 'Probabilidad de bloqueo cuando no hay espacio de espera.',
          },
          {
            id: 'colas-con-prioridad',
            title: 'Colas con prioridad',
            summary: 'Tiempos de espera por clase de prioridad.',
          },
          {
            id: 'cola-mg1',
            title: 'Modelo M/G/1',
            summary: 'Un servidor con tiempo de servicio de distribución general.',
          },
          { ref: 'nacimiento-y-muerte' },
        ],
      },
      {
        slug: 'redes-de-colas',
        name: 'Redes de colas',
        unit: 'Unidad IV',
        description: 'Colas infinitas en serie, redes de Jackson.',
        calculators: [
          {
            id: 'colas-en-serie',
            title: 'Colas en serie',
            summary: 'Estaciones de servicio consecutivas con capacidad infinita.',
          },
          {
            id: 'redes-de-jackson',
            title: 'Redes de Jackson',
            summary: 'Tasas efectivas y medidas de rendimiento por estación.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'teoria-de-sobrevivencia',
    code: '071-4903',
    name: 'Teoría de Sobrevivencia',
    semester: null,
    kind: 'electiva-tecnica',
    prerequisites: ['071-4383'],
    credits: { total: 3, theory: 3, practice: 0 },
    creditsLabel: '3 (3T-0P)',
    objective:
      'Aplicar un análisis de sobrevivencia que permita diagnosticar la confiabilidad de sistemas en general, mediante un modelo no paramétrico que estime geométricamente las funciones de sobrevivencia, fallas y riesgo.',
    content: 'definido',
    bibliography: [
      'borean-1995',
      'borean-1999',
      'borean-ganuza-2001',
      'borean-solorzano-2001',
      'solorzano-padra-1999',
    ],
    topics: [
      {
        slug: 'modelos-no-parametricos',
        name: 'Introducción a los modelos no paramétricos',
        unit: 'Unidad I',
        description: 'Antecedentes, definiciones de sistemas.',
        calculators: [],
      },
      {
        slug: 'generalidades',
        name: 'Generalidades del análisis de sobrevivencia',
        unit: 'Unidad II',
        description: 'Variables aleatorias, evento control, datos censurados.',
        calculators: [],
      },
      {
        slug: 'producto-limite',
        name: 'El producto límite (Kaplan-Meier)',
        unit: 'Unidad III',
        description: 'El Producto Límite (Kaplan-Meier) en Sobrevivencia y Fallas.',
        calculators: [
          {
            id: 'kaplan-meier',
            title: 'Estimador de Kaplan-Meier',
            summary: 'Función de sobrevivencia con datos censurados.',
          },
        ],
      },
      {
        slug: 'tabla-de-sobrevivencia',
        name: 'Tabla de sobrevivencia y fallas',
        unit: 'Unidad IV',
        description:
          'Funciones de sobrevivencia, falla y riesgo; criterios de censura: Kaplan-Meier, Elisa Lee, Ezio Bórean.',
        calculators: [
          {
            id: 'tabla-de-sobrevivencia',
            title: 'Tabla de sobrevivencia y fallas',
            summary: 'Funciones de sobrevivencia, falla y riesgo por intervalo.',
          },
        ],
      },
      {
        slug: 'adaptacion-del-modelo',
        name: 'Adaptación y análisis del modelo',
        unit: 'Unidad V',
        description: 'Nivel crítico y de criticidad del sistema.',
        calculators: [
          {
            id: 'nivel-critico',
            title: 'Nivel crítico del sistema',
            summary: 'Nivel crítico y de criticidad a partir de la tabla de sobrevivencia.',
          },
        ],
      },
      {
        slug: 'led-markoviano',
        name: 'LED Markoviano',
        unit: 'Unidad VI',
        description:
          'Validación de proyecciones geométricas mediante cadenas de Markov (factor "α").',
        calculators: [
          {
            id: 'led-markoviano',
            title: 'LED Markoviano',
            summary: 'Valida proyecciones geométricas con una cadena de Markov (factor α).',
          },
        ],
      },
    ],
  },
];
