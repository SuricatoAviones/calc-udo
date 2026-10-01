# Changelog

Todos los cambios relevantes de CalcUDO se registran en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/) (ver ADR-015 en `docs/DECISIONES.md`).

## [Sin publicar]

### Agregado

- **Teoría de Colas** completa:
  - modelo con población finita (reparación de máquinas) con productividad de la población;
  - análisis de costos: número de servidores que minimiza el costo total de un M/M/s;
  - modelo de pérdida de Erlang con la búsqueda del número de servidores para una meta de bloqueo;
  - colas con prioridad, con y sin interrupción del servicio, para uno o varios servidores;
  - modelo M/G/1 con la fórmula de Pollaczek-Khintchine (incluye el M/D/1);
  - colas en serie y redes de Jackson (ecuaciones de flujo y cada estación como M/M/s).
- **Procesos Estocásticos** completa:
  - clasificación de estados (clases, estados absorbentes, recurrentes y transitorios, período,
    ergodicidad) y análisis de absorción con la matriz fundamental;
  - proceso de Poisson con incrementos independientes y tiempos entre llegadas;
  - caminata aleatoria con o sin barreras absorbentes (ruina del jugador);
  - proceso de nacimiento y muerte con tasas por tramos;
  - simulación manual de una cola con un servidor, con números aleatorios dados o generados por el
    método congruencial.
- **Programación No Lineal** completa: optimización de una y varias variables (derivadas de orden
  superior, hessiana y Newton-Raphson), multiplicadores de Lagrange con la hessiana orlada,
  condiciones KKT con verificación de suficiencia, funciones de penalidad (SUMT), método de Wolfe,
  programación separable con base restringida y programación geométrica por el dual.
- **Modelos de Operaciones I** completa: PERT-Costos (compresión al menor costo y duración de costo
  total mínimo), reemplazo de equipo por programación dinámica y convexidad o concavidad de una
  función.
- **Modelos de Operaciones II** completa: comparación de métodos de pronóstico, lote económico de
  producción, modelo de periodo fijo con inventario de seguridad, MRP y clasificación ABC.
- **Teoría de Sobrevivencia**: estimador de Kaplan-Meier y tabla de sobrevivencia y fallas con los
  criterios de censura de Elisa Lee y de Kaplan-Meier. El nivel crítico y el LED Markoviano siguen en
  el roadmap porque su método no está publicado (ADR-032).

### Corregido

- Una fórmula larga en el resumen del resultado ya no ensancha la página en el teléfono.

## [0.6.0] — 2026-09-30

### Agregado

- **Métodos Numéricos** completo:
  - errores de truncamiento y redondeo: error verdadero y relativo de una aproximación, corte y
    redondeo a k cifras significativas y serie de Taylor orden por orden con criterio de parada;
  - determinante (por cofactores o por eliminación de Gauss), operaciones con matrices (suma,
    resta, producto por escalar, producto, transpuesta e inversa por Gauss-Jordan) y eliminación
    gaussiana con pivoteo parcial y comprobación de la solución;
  - división sintética con el esquema de Ruffini y transformación a potencias de (x − r), y
    factores cuadráticos por el método de Bairstow (raíces reales y complejas);
  - descenso (o ascenso) más rápido con paso óptimo y método de Newton para sistemas no lineales
    de 2 o 3 ecuaciones con la matriz jacobiana;
  - tabla de diferencias hacia adelante y divididas, interpolación de Newton (diferencias
    divididas y Newton-Gregory) con grado creciente, y mínimos cuadrados con polinomios de grado
    1 a 6;
  - derivación por diferencias finitas (primera y segunda derivada, básica y de alta exactitud) y
    método de coeficientes indeterminados, que deduce fórmulas de derivación o integración con su
    error de truncamiento;
  - método de Taylor de orden 1 a 4, métodos multipaso (Adams-Bashforth de 2, 3 y 4 pasos, Adams
    de cuarto orden y Milne) y predictor-corrector con el corrector iterado.
- **Estadísticas II** completa:
  - regresión lineal simple con R², intervalos de confianza para β₀ y β₁, prueba de la
    pendiente, respuesta media e intervalo de predicción;
  - coeficiente de correlación de Pearson o de Spearman y prueba sobre ρ (t o transformación de
    Fisher);
  - pruebas de hipótesis sobre la media (z o t) y sobre la varianza (ji-cuadrada o F), con región
    crítica, valor P y la gráfica de la región de rechazo;
  - errores tipo I y II y función potencia (media normal o proporción binomial);
  - prueba de bondad de ajuste con probabilidades dadas, Poisson, binomial o normal;
  - pruebas no paramétricas: signo, rangos con signo de Wilcoxon, suma de rangos (Mann-Whitney)
    con distribuciones exactas, y Kruskal-Wallis;
  - análisis de series de tiempo (tendencia, índices estacionales, fluctuaciones cíclicas) y
    pronósticos a corto y largo plazo.
- Distribuciones t de Student, ji-cuadrada y F (densidad, función de distribución y cuantiles) en
  `lib/math/`.
- Las gráficas pueden mostrar datos como puntos sueltos junto a una curva ajustada.

### Cambiado

- El núcleo de EDO admite reglas con estado y campos propios; Euler, Heun y Runge-Kutta dan los
  mismos resultados.
- Los campos de matriz aceptan el texto del contador (filas en vez de estados).

## [0.5.0] — 2026-09-28

### Agregado

- **Buscador de calculadoras** en el inicio y en el encabezado (también con Ctrl/⌘ + K o «/»):
  busca sin tildes por título, resumen, tema y materia, y muestra las del roadmap como
  «Próximamente».
- **Optimización de Operaciones** completa:
  - método simplex algebraico, con las soluciones básicas del modelo y cada iteración escrita
    como ecuaciones en función de las no básicas;
  - análisis post-óptimo de cambios en el modelo: nuevo lado derecho, nueva función objetivo,
    coeficientes tecnológicos de una variable, nueva variable y nueva restricción, con el dual
    simplex o el simplex primal cuando hace falta.

### Cambiado

- El dual simplex pasó al motor de tablas para reutilizarlo; la calculadora da el mismo
  resultado.

## [0.4.0] — 2026-09-28

### Agregado

- **Estadísticas I** completa: tabla de frecuencias con histograma y media de datos agrupados,
  permutaciones y combinaciones (también circulares, con objetos repetidos y particiones),
  probabilidad total y teorema de Bayes, esperanza y varianza de variables discretas y continuas,
  desigualdad de Chebyshev, momentos con la función generadora, distribuciones de Bernoulli,
  geométrica, de Pascal, multinomial, hipergeométrica, uniforme, exponencial, gamma, beta y de
  Weibull, teorema del límite central y distribuciones muestrales enumerando las muestras.
- **Inferencia y Diseño de Experimentos** completa: estimación por máxima verosimilitud para
  Bernoulli, Poisson, geométrica, exponencial, normal y f(x; θ) = θ/x^(θ+1).
- Funciones especiales (Γ, ln Γ, gamma y beta incompletas) e integración numérica adaptativa con
  límites infinitos en `lib/math/`.
- Las probabilidades de las tablas (Bayes, multinomial, esperanza) aceptan fracciones como 2/9.

### Cambiado

- El núcleo de distribuciones discretas admite soportes que no empiezan en 0.
- La distribución normal comparte los campos de consulta con las demás distribuciones continuas.

## [0.3.0] — 2026-09-25

### Agregado

- Programas completos de **Optimización de Operaciones** (071-3663), **Métodos Numéricos**
  (072-3913, sinopsis ampliada) e **Introducción a la Lógica Formal y Algoritmos** (072-1162)
  en el pensum y el currículum. Las prelaciones con materias de otras ramas muestran su nombre
  (Programación Orientada a Objetos, 072-2103).
- **Optimización de Operaciones:** método gráfico con la región factible sombreada, forma
  estándar, simplex tabular, M grande (con M simbólica), dos fases, problema dual, dual simplex,
  análisis de sensibilidad (precios duales y rangos), esquina noroeste, costo mínimo,
  aproximación de Vogel, método de los multiplicadores, método húngaro y ramificación y
  acotamiento. Las tablas se calculan con fracciones exactas, como en el libro.
- **Modelos de Operaciones I:** juegos m × n resueltos con programación lineal.
- **Lógica Formal y Algoritmos:** tablas de verdad (tautología, contradicción, contingencia),
  equivalencia lógica con la ley reconocida, validez de un razonamiento (modus ponens, modus
  tollens, silogismos y falacias), conversión entre sistemas de numeración, representación
  binaria de enteros (signo y magnitud, complementos a 1 y a 2, exceso) y trazas de búsqueda
  (secuencial, binaria) y ordenamiento (burbuja, selección, inserción).
- Logo de la Universidad de Oriente como ícono del sitio, en el encabezado y en el README.
- Campos para escribir un programa lineal como texto (con vista previa), tablas de transporte y
  proposiciones con botones para los conectores.

### Cambiado

- Los campos de matriz muestran el error de la celda que falla.

### Eliminado

- `public/favicon.ico` de la plantilla de Next.

## [0.2.0] — 2026-09-25

### Agregado

- Programas completos de **Modelos de Operaciones I** (071-4633) y **Modelos de Operaciones II**
  (071-4133) en el pensum, el currículum y la bibliografía (Mc Keown – Davis; Díaz Matalobos,
  _Gestión de Inventarios_). Las unidades que repiten contenido de Teoría de Colas,
  Programación No Lineal y Estadísticas II enlazan a esas calculadoras.
- **Modelos de Operaciones I:** ruta crítica (CPM); PERT con tres estimaciones y probabilidad de
  terminar en una fecha; estrategias puras (punto de silla) y mixtas (dominancia y método
  gráfico); programación dinámica: ruta más corta en reversa y en avance, tamaño de la fuerza de
  trabajo y mochila.
- **Modelos de Operaciones II:** promedios móviles simple y ponderado y suavizamiento
  exponencial, con MAD, MSE y MAPE; EOQ con punto de reorden, EOQ con faltantes planeados,
  descuentos por cantidad, punto de reorden con stock de seguridad y modelo de un periodo
  (demanda normal, uniforme o exponencial).
- Campos de formulario para tablas de filas, matrices rectangulares y texto corto; gráficas con
  varias líneas.
- Inversa de la normal estándar (Φ⁻¹) en `lib/math/normal.ts`.

### Cambiado

- La leyenda de las gráficas aparece debajo, como lista, para no tapar las curvas en móvil.

### Corregido

- La etiqueta del eje x ya no se recorta en las gráficas que tienen leyenda.

## [0.1.0] — 2026-09-25

Primera versión etiquetada.

### Agregado

- Currículum de la rama cuantitativa de Ingeniería de Sistemas (UDO) como datos, con rutas
  estáticas `/[materia]/[tema]/[calculadora]/` y `docs/PENSUM.md` generado.
- Contrato común `Calculator` con traza obligatoria (pasos, tablas, series y avisos) y
  componentes genéricos de formulario, resultados, fórmulas KaTeX y gráficas.
- **Métodos Numéricos:** Newton-Raphson, bisección, falsa posición, secante; integración
  rectangular, trapecio y Simpson; EDO por Euler, Euler modificado (Heun) y Runge-Kutta de
  orden 4.
- **Teoría de Colas:** modelos M/M/1, M/M/s y M/M/1/K.
- **Procesos Estocásticos:** cadenas de Markov (probabilidades en n pasos y estado estable).
- **Estadística I:** medidas descriptivas y distribuciones binomial, Poisson y normal.
- Páginas legales: aviso legal, política de privacidad, política de datos y política de cookies,
  enlazadas desde el pie de página.
- Versión de la aplicación visible en el pie de página.

[Sin publicar]: https://github.com/SuricatoAviones/calc-udo/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.6.0
[0.5.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.5.0
[0.4.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.4.0
[0.3.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.3.0
[0.2.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.2.0
[0.1.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.1.0
