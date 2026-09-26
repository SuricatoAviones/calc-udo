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
 *   Procesos Estocásticos y Modelos de Operaciones II.
 * - El estado "implementada" NO se marca aquí: se deriva del registro de UI. Solo se marca
 *   `inProgress: true` mientras alguien trabaja en una calculadora.
 * - Temas sin calculadoras (p. ej. unidades de filosofía) se listan igual para que el mapa del
 *   pensum esté completo.
 *
 * Para extender a otras ramas de la carrera basta con agregar objetos `Subject` a este arreglo.
 */
/**
 * Materias de otras ramas que aparecen como prelación, con el nombre que da el pensum. No tienen
 * temas ni página propia en CalcUDO.
 */
export const externalSubjects: Record<string, string> = {
  '072-2103': 'Programación Orientada a Objetos',
};

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
      'Proporcionar una visión amplia de la Lógica Formal con la finalidad de inducir al estudiante a que comprenda lo que es el pensamiento, el juicio, la teoría del concepto, el razonamiento, el silogismo y sus variedades, y la dialéctica.',
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
        description:
          'Definición, evolución y problemas de la filosofía. Clasificación de las disciplinas filosóficas: ética, estética, lógica, teoría del conocimiento, metafísica de la naturaleza y metafísica del espíritu.',
        calculators: [],
      },
      {
        slug: 'el-pensar-y-el-pensamiento',
        name: 'El pensar y el pensamiento',
        unit: 'Unidad II',
        description:
          'Definición del pensar y del pensamiento. Contenido y formas de los pensamientos: el concepto, las proposiciones, el juicio y el razonamiento.',
        calculators: [],
      },
      {
        slug: 'principios-y-leyes-de-la-logica',
        name: 'Principios y leyes de la lógica',
        unit: 'Unidad III',
        description:
          'Definición de la lógica; el silogismo y sus tipos. Principios de identidad, no contradicción, tercero excluido y razón suficiente; modus ponendo ponens y modus tollendo tollens; leyes y propiedades de la equivalencia (conmutatividad, asociatividad, distributividad, leyes de De Morgan, implicación, bicondicionalidad…). Tablas de la verdad, representación binaria y sistemas de numeración.',
        calculators: [
          {
            id: 'tablas-de-verdad',
            title: 'Tablas de verdad',
            summary: 'Construye la tabla de verdad de una proposición y la clasifica.',
          },
          {
            id: 'equivalencia-logica',
            title: 'Equivalencia lógica',
            summary: 'Comprueba con una tabla de verdad si dos proposiciones son equivalentes.',
          },
          {
            id: 'validez-de-argumentos',
            title: 'Validez de un razonamiento',
            summary: 'Decide si una conclusión se sigue de las premisas (modus ponens, tollens…).',
          },
          {
            id: 'sistemas-de-numeracion',
            title: 'Conversión entre sistemas de numeración',
            summary: 'Convierte números entre bases (binaria, octal, decimal, hexadecimal…).',
          },
          {
            id: 'representacion-binaria',
            title: 'Representación binaria de enteros',
            summary: 'Signo y magnitud, complemento a 1, complemento a 2 y exceso con n bits.',
          },
        ],
      },
      {
        slug: 'algoritmos',
        name: 'Introducción al estudio de algoritmos',
        unit: 'Unidad IV',
        description:
          'Definición y características de los algoritmos. Estructuras secuencial, selectiva y repetitiva. Diagramas de flujo y pseudocódigo: simbología y estructura. Formulación de algoritmos de búsqueda y ordenamiento.',
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
        description: 'Modelos matemáticos. Pifias. Error de truncamiento y de redondeo.',
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
        description: 'Eliminación Gaussiana. Estrategia de pivoteo.',
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
        description:
          'Métodos preliminares y bisección. Falsa posición y método de secante. Convergencia y razón de convergencia. Método de Newton.',
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
        description: 'Transformación de polinomio. División sintética. Factores cuadráticos.',
        calculators: [
          {
            id: 'division-sintetica',
            title: 'División sintética',
            summary: 'Divide un polinomio entre (x − r) con el esquema de Ruffini.',
          },
          {
            id: 'factores-cuadraticos',
            title: 'Factores cuadráticos (método de Bairstow)',
            summary: 'Extrae factores cuadráticos de un polinomio para hallar sus raíces.',
          },
        ],
      },
      {
        slug: 'descenso-mas-rapido',
        name: 'Descenso más rápido y método de Newton',
        description: 'El método del descenso más rápido. Método de Newton.',
        calculators: [
          {
            id: 'descenso-mas-rapido',
            title: 'Método del descenso más rápido',
            summary: 'Busca un mínimo avanzando en la dirección opuesta al gradiente.',
          },
          {
            id: 'newton-varias-variables',
            title: 'Método de Newton para varias variables',
            summary: 'Resuelve sistemas no lineales con el jacobiano en cada iteración.',
          },
        ],
      },
      {
        slug: 'diferencias-e-interpolacion',
        name: 'Diferencias finitas, interpolación y aproximación',
        description:
          'Operadores en diferencia de potencias factoriales. Tablas de diferencia. Fórmulas en diferencias hacia adelante de Newton. Interpolación y aproximación. Mínimos cuadrados para datos discretos.',
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
        description: 'Las reglas rectangular, trapezoidal y de Simpson. Integrales definidas.',
        calculators: [
          {
            id: 'regla-rectangular',
            title: 'Regla rectangular',
            summary: 'Aproxima una integral con rectángulos (izquierda, derecha o punto medio).',
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
        description:
          'Fórmulas de diferencias hacia adelante. Fórmulas en diferencias centradas. Métodos de coeficientes indeterminados.',
        calculators: [
          {
            id: 'derivacion-numerica',
            title: 'Derivación por diferencias finitas',
            summary: 'Aproxima derivadas con diferencias hacia adelante y centradas.',
          },
          {
            id: 'coeficientes-indeterminados',
            title: 'Método de coeficientes indeterminados',
            summary:
              'Deduce una fórmula de derivación o integración numérica con un sistema lineal.',
          },
        ],
      },
      {
        slug: 'ecuaciones-diferenciales',
        name: 'Ecuaciones diferenciales',
        description:
          'Ecuaciones diferenciales y ecuaciones en diferencias. Método de Euler. Método de Taylor y error de truncamiento. Métodos multipaso. El método de Euler modificado. Método predictor-corrector. Método de Runge-Kutta.',
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
            title: 'Método de Euler modificado (Heun)',
            summary: 'Predice con Euler y corrige con el promedio de las pendientes.',
          },
          {
            id: 'predictor-corrector',
            title: 'Método predictor-corrector',
            summary: 'Predice con una fórmula explícita y corrige con una implícita.',
          },
          {
            id: 'runge-kutta',
            title: 'Método de Runge-Kutta de cuarto orden',
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
      'Al finalizar el curso el estudiante estará en capacidad de aplicar herramientas de la investigación de operaciones para la optimización de procesos en estado estable, mediante la planificación de la producción, rutas, distribuciones de productos, etc.',
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
        unit: 'Unidad I',
        description:
          'Investigación de operaciones: orígenes y definición. Programación lineal. Clasificación de los modelos (simbólicos o matemáticos, de simulación, heurísticos). Estructura matemática: variables de decisión, parámetros, función objetivo y restricciones. Fases de un estudio de programación lineal. Formulación de modelos.',
        calculators: [],
      },
      {
        slug: 'resolucion-de-modelos',
        name: 'Resolución de modelos de programación lineal',
        unit: 'Unidad II',
        description:
          'Método gráfico y tipos de soluciones. Forma canónica y forma estándar. Teoremas básicos del método simplex. Método simplex algebraico y tabular. Técnicas de penalización: método de la M grande y método de las dos fases.',
        calculators: [
          {
            id: 'metodo-grafico',
            title: 'Método gráfico',
            summary: 'Resuelve un modelo de dos variables sobre el plano y clasifica la solución.',
          },
          {
            id: 'forma-estandar',
            title: 'Forma canónica y forma estándar',
            summary: 'Reescribe un modelo con restricciones ≤ o con igualdades y holguras.',
          },
          {
            id: 'simplex-algebraico',
            title: 'Método simplex algebraico',
            summary: 'Itera con las ecuaciones del sistema en lugar de la tabla.',
          },
          {
            id: 'simplex',
            title: 'Método simplex tabular',
            summary: 'Resuelve un modelo con tablas simplex iteración por iteración.',
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
        name: 'Método dual simplex y análisis de sensibilidad',
        unit: 'Unidad III',
        description:
          'Dualidad: definición y usos. Forma primal y forma dual y relación entre sus soluciones. Método dual simplex. Análisis de sensibilidad: cambios en la rigidez de las restricciones, en los coeficientes de la función objetivo y en los coeficientes tecnológicos; adición de una variable o de una restricción.',
        calculators: [
          {
            id: 'problema-dual',
            title: 'Problema dual',
            summary: 'Construye el dual de un modelo y compara las soluciones de ambos.',
          },
          {
            id: 'dual-simplex',
            title: 'Método dual simplex',
            summary: 'Simplex que parte de una solución óptima pero no factible.',
          },
          {
            id: 'analisis-de-sensibilidad',
            title: 'Análisis de sensibilidad',
            summary: 'Precios duales y rangos de los recursos y de los coeficientes del objetivo.',
          },
          {
            id: 'cambios-en-el-modelo',
            title: 'Cambios en coeficientes tecnológicos, variables y restricciones',
            summary: 'Revisa si la solución óptima resiste un cambio en el modelo.',
          },
        ],
      },
      {
        slug: 'transporte-y-asignacion',
        name: 'Transporte y asignación',
        unit: 'Unidad IV',
        description:
          'Modelo de transporte y condiciones para resolverlo. Solución básica inicial por los métodos de la esquina noroeste, del costo mínimo y de aproximación de Vogel. Solución óptima con el método de los multiplicadores. Modelo de asignación y método húngaro.',
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
            title: 'Método de los multiplicadores',
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
        name: 'Programación entera y uso del computador',
        unit: 'Unidad V',
        description:
          'Programación entera pura, mixta y binaria: definición, aplicaciones y resolución. Técnicas de ramificación y acotamiento. Software para programación lineal (GPL, TORA, WSB).',
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
  // Modelos de Operaciones I y II: el pensum trae objetivos, contenidos y bibliografía por
  // unidad. Aquí la bibliografía de la materia es la unión de la general y la de cada unidad.
  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'modelos-de-operaciones-1',
    code: '071-4633',
    name: 'Modelos de Operaciones I',
    semester: 7,
    kind: 'obligatoria',
    prerequisites: ['071-3663'],
    credits: { total: 3, theory: 2, practice: 2 },
    creditsLabel: '3 (2T-2P)',
    objective:
      'Al finalizar, el estudiante estará en la capacidad de optimizar sistemas a través de métodos de programación matemática.',
    content: 'definido',
    bibliography: [
      'bonini-2000',
      'taha',
      'aquilano-1994',
      'anderson-1993',
      'gould-eppen-schmidt',
      'hillier-lieberman-2002',
      'mckeown-davis',
      'winston-1994',
      'bazaraa-1993',
      'cooper-1998',
      'hadley-2000',
      'rao-1999',
    ],
    topics: [
      {
        slug: 'pert-cpm',
        name: 'Análisis de redes: PERT-CPM',
        unit: 'Unidad I',
        description:
          'Importancia del análisis de redes y fases de planeación de un proyecto con PERT-CPM. Actividades y relaciones de precedencia; representación de la red y actividades ficticias. Revisión hacia adelante y hacia atrás, ruta crítica. Redes con incertidumbre: variabilidad de los tiempos y probabilidad de terminar el proyecto en una fecha. PERT-Costos.',
        calculators: [
          {
            id: 'ruta-critica',
            title: 'Ruta crítica (CPM)',
            summary: 'Tiempos de inicio y terminación, holguras y ruta crítica de un proyecto.',
          },
          {
            id: 'pert',
            title: 'PERT con tres estimaciones de tiempo',
            summary: 'Tiempo esperado, varianza y probabilidad de terminar en una fecha.',
          },
          {
            id: 'pert-costos',
            title: 'PERT-Costos (compresión del proyecto)',
            summary: 'Acorta la duración del proyecto al menor costo de aceleración.',
          },
        ],
      },
      {
        slug: 'teoria-de-juegos',
        name: 'Teoría de juegos',
        unit: 'Unidad II',
        description:
          'Aspectos básicos. Juegos de dos personas con suma cero: características del juego, matriz de pagos o de recompensa. Solución de juegos con estrategia mixta.',
        calculators: [
          {
            id: 'estrategias-puras',
            title: 'Estrategias puras y punto de silla',
            summary: 'Maximin, minimax y punto de silla de una matriz de pagos.',
          },
          {
            id: 'estrategias-mixtas',
            title: 'Estrategias mixtas (método gráfico)',
            summary: 'Dominancia y método gráfico para juegos de 2 × n y m × 2.',
          },
          {
            id: 'juegos-programacion-lineal',
            title: 'Juegos resueltos con programación lineal',
            summary: 'Estrategias mixtas óptimas de un juego m × n con el método simplex.',
          },
        ],
      },
      {
        slug: 'programacion-dinamica',
        name: 'Programación dinámica',
        unit: 'Unidad III',
        description:
          'Principio de optimalidad de Bellman. Naturaleza recursiva de los cálculos. Etapas, alternativas y estados. Recursión en reversa y en avance. Modelo de la ruta más corta. Modelo del tamaño de la fuerza de trabajo. Aplicaciones de la programación dinámica.',
        calculators: [
          {
            id: 'ruta-mas-corta-pd',
            title: 'Ruta más corta por programación dinámica',
            summary: 'Recursión en reversa o en avance sobre una red por etapas.',
          },
          {
            id: 'fuerza-de-trabajo',
            title: 'Modelo del tamaño de la fuerza de trabajo',
            summary: 'Cuántos trabajadores mantener en cada periodo al menor costo.',
          },
          {
            id: 'mochila',
            title: 'Modelo de la mochila (carga)',
            summary: 'Reparte una capacidad limitada entre artículos para maximizar el beneficio.',
          },
          {
            id: 'reemplazo-de-equipo',
            title: 'Modelo de reemplazo de equipo',
            summary: 'Cuándo conservar o reemplazar una máquina a lo largo de un horizonte.',
          },
        ],
      },
      {
        slug: 'programacion-no-lineal',
        name: 'Programación no lineal',
        unit: 'Unidad IV',
        description:
          'Teoría de optimización clásica. Funciones convexas y cóncavas. Optimización no restringida: condiciones necesarias y suficientes para extremos. Optimización restringida: multiplicadores de Lagrange con restricciones de igualdad, de no negatividad y de desigualdad.',
        calculators: [
          {
            id: 'convexidad',
            title: 'Convexidad y concavidad de una función',
            summary: 'Clasifica una función a partir de su matriz hessiana.',
          },
          { ref: 'optimizacion-una-variable' },
          { ref: 'optimizacion-varias-variables' },
          { ref: 'multiplicadores-de-lagrange' },
          { ref: 'condiciones-kkt' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  {
    slug: 'modelos-de-operaciones-2',
    code: '071-4133',
    name: 'Modelos de Operaciones II',
    semester: 8,
    kind: 'obligatoria',
    prerequisites: ['071-4633'],
    credits: { total: 3, theory: 2, practice: 2 },
    creditsLabel: '3 (2T-2P)',
    objective: 'Optimizar sistemas a través de la aplicación de los modelos probabilísticos.',
    content: 'definido',
    bibliography: [
      'bonini-2000',
      'taha',
      'aquilano-1994',
      'anderson-1993',
      'gould-eppen-schmidt',
      'hillier-lieberman-2002',
      'diaz-matalobos-1998',
    ],
    topics: [
      {
        slug: 'pronosticos',
        name: 'Pronósticos',
        unit: 'Unidad I',
        description:
          'Definición de pronósticos. La demanda como objeto de pronóstico: componentes y tipos de demanda. Técnicas cuantitativas de proyección: análisis de series de tiempo y proyección de la relación causal. Selección del método de proyección.',
        calculators: [
          {
            id: 'promedio-movil',
            title: 'Promedios móviles (simple y ponderado)',
            summary: 'Pronostica con el promedio de los últimos n periodos y mide el error.',
          },
          {
            id: 'suavizamiento-exponencial',
            title: 'Suavizamiento exponencial simple',
            summary: 'Corrige el pronóstico anterior con una fracción α del error.',
          },
          { ref: 'pronostico-de-series-de-tiempo' },
          { ref: 'regresion-lineal' },
          {
            id: 'seleccion-de-metodo-de-pronostico',
            title: 'Comparación de métodos de pronóstico',
            summary: 'Compara varios métodos sobre los mismos datos con MAD, MSE y MAPE.',
          },
        ],
      },
      {
        slug: 'teoria-de-colas',
        name: 'Teoría de colas',
        unit: 'Unidad II',
        description:
          'Sistemas de colas, redes de colas y sistemas de pérdida. Estructura del sistema: llegadas, servicio, número de servidores, disciplina, medidas de desempeño y notación. Modelos de un servidor, modelos generales de canal único, servidores múltiples, sistemas de pérdida y redes de colas. Programación y prioridades.',
        calculators: [
          { ref: 'cola-mm1' },
          { ref: 'cola-mg1' },
          { ref: 'cola-mms' },
          { ref: 'cola-mm1k' },
          { ref: 'perdida-de-erlang' },
          { ref: 'colas-en-serie' },
          { ref: 'redes-de-jackson' },
          { ref: 'colas-con-prioridad' },
        ],
      },
      {
        slug: 'inventarios',
        name: 'Modelos de inventarios',
        unit: 'Unidad III',
        description:
          'Definición, propósito, clasificación y costos de los inventarios y su comportamiento gráfico. Demanda dependiente e independiente, determinística y probabilística. Modelos de cantidad fija y de periodo fijo con demanda independiente, modelos con demanda dependiente y técnicas de inventario.',
        calculators: [
          {
            id: 'eoq',
            title: 'Cantidad económica de pedido (EOQ)',
            summary: 'Tamaño de lote que equilibra los costos de pedir y de mantener.',
          },
          {
            id: 'eoq-con-faltantes',
            title: 'EOQ con faltantes planeados',
            summary: 'Tamaño de lote y faltante máximo cuando se permiten pedidos pendientes.',
          },
          {
            id: 'lote-economico-de-produccion',
            title: 'Lote económico de producción',
            summary: 'Tamaño de lote cuando el reabastecimiento es gradual.',
          },
          {
            id: 'descuentos-por-cantidad',
            title: 'EOQ con descuentos por cantidad',
            summary: 'Elige el tamaño de lote cuando el precio unitario baja con la cantidad.',
          },
          {
            id: 'punto-de-reorden',
            title: 'Punto de reorden y stock de seguridad',
            summary: 'Cuándo pedir si la demanda durante el tiempo de entrega es aleatoria.',
          },
          {
            id: 'modelo-de-un-periodo',
            title: 'Modelo de un periodo (vendedor de periódicos)',
            summary: 'Cuánto pedir de un producto perecedero con demanda aleatoria.',
          },
          {
            id: 'revision-periodica',
            title: 'Modelo de periodo fijo (revisión periódica)',
            summary: 'Nivel meta de inventario cuando se revisa cada T periodos.',
          },
          {
            id: 'mrp',
            title: 'Planeación de requerimientos de materiales (MRP)',
            summary: 'Necesidades netas de componentes a partir del plan maestro.',
          },
          {
            id: 'clasificacion-abc',
            title: 'Clasificación ABC',
            summary: 'Ordena los artículos según su valor de uso anual.',
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
