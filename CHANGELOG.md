# Changelog

Todos los cambios relevantes de CalcUDO se registran en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/) (ver ADR-015 en `docs/DECISIONES.md`).

## [Sin publicar]

### Agregado

- **Circuitos y Sistemas** (piloto): motor de análisis nodal modificado (MNA) con traza de KCL,
  sistema aumentado y eliminación con operaciones de fila; constructor interactivo de circuitos
  (`CircuitBuilderField`) con paleta, colocación por clic con imán a nodos, arrastre de componentes
  y extremos, codos, paneo/zoom, selección múltiple, volteo de polaridad, duplicado, validación de
  topología, simulación con animación de corriente y tabla de resultados en vivo, e instrucciones
  detalladas; y las calculadoras **Relaciones v-i-p** (R, C y L en el dominio del tiempo con
  potencia instantánea), **Análisis de nodos**, **Análisis de mallas** (caras del embebido planar,
  KVL por malla y supermalla con fuentes de corriente), **Superposición**, **Equivalentes de
  Thévenin y Norton** y **Máxima transferencia de potencia** (con la curva `P_L(R_L)`).
- **Circuitos y Sistemas** completa (ADR-034):
  - **Fasores e impedancia** (senoide a fasor, Z de R, L y C en serie o en paralelo, corriente y
    fasores por elemento), **Potencia en circuitos senoidales** (instantánea, promedio, reactiva,
    aparente, compleja y factor de potencia) y **Valor promedio y valor eficaz** de señales
    periódicas por tramos, con la potencia en una resistencia;
  - **Circuitos de primer orden** (RC y RL: constante de tiempo, respuesta natural, forzada y
    completa, tabla en múltiplos de τ) y **de segundo orden** (RLC serie y paralelo,
    sobreamortiguado, crítico y subamortiguado, con condiciones iniciales de los elementos o
    generales);
  - **Ecuaciones de estado** sobre el constructor, que ahora admite capacitores e inductores con
    valor inicial: árbol normal, cortes y lazos fundamentales, redes propias e impropias,
    formulación de A y B y solución con Laplace (Faddeev-LeVerrier);
  - **Transformada de Laplace** (tabla de pares por término, pulsos con retardo y solución de
    ecuaciones diferenciales), **Transformada inversa** (fracciones parciales con polos reales,
    complejos y repetidos, funciones impropias y retardos), **Integral de convolución** (teorema
    de convolución, respuesta por intervalos y verificación numérica) y **Transformada Z**
    (sucesiones, inversa por X(z)/z contrastada con la división larga y ecuaciones en diferencias
    contrastadas con la recursión).
  - Núcleos nuevos: `lib/math/complex.ts`, `lib/math/polynomials.ts` (raíces con multiplicidad
    exacta) y, en `circuitos-y-sistemas/`, `signal.ts`, `laplace.ts`, `partial-fractions.ts`,
    `laplace-inverse.ts`, `z-transform.ts` y `state-space.ts`. Casos de prueba de Hayt 8.ª ed.,
    Dorf y Svoboda 9.ª ed. y Kuo 7.ª ed.
- **Electrónica** completa (ADR-035):
  - **Circuitos con diodos** (modelo ideal, segunda y tercera aproximación y ecuación de Shockley
    por Newton, con recta de carga y punto Q), **Rectificadores** (media onda, derivación central
    y puente: valores de pico, promedio, eficaz, rizado, frecuencia y PIV) y **Filtrado y
    regulación** (filtro con condensador y regulador Zener en sus tres casos, con R_Z y el rizado
    de salida);
  - **Polarización de transistores**: BJT con polarización fija, de emisor, divisor de voltaje
    (exacto y aproximado) y realimentación del colector, con la región de trabajo y la recta de
    carga; JFET y MOSFET de empobrecimiento (fija, autopolarización, divisor) y de enriquecimiento
    (realimentación, divisor), con la curva de transferencia, la recta de polarización y la
    comprobación de la región de saturación;
  - **Análisis AC con parámetros híbridos**: modelo aproximado (emisor común, R_E sin puentear,
    seguidor de emisor, base común) y completo, con carga y resistencia de fuente;
  - **Amplificadores operacionales**: inversor, no inversor, seguidor, sumador y restador con
    recorte en ±V_sat; comparador con ciclo de trabajo y disparador de Schmitt con histéresis.
  - Núcleos en `lib/calculators/electronica/` (`units.ts`, `rectifier.ts`, `filter.ts`,
    `zener.ts`, `bias.ts`, `small-signal.ts`) y el campo `QuantityField`, que acepta prefijos
    (`2.2k`, `100µ`, `47n`). Casos de prueba de Boylestad 10.ª ed. y Malvino 6.ª ed.
- **Laboratorio de Circuitos y Electrónica** completo: **Resonancia en circuitos RLC** (serie,
  paralelo y paralelo con bobina real: ω₀, Q₀, ancho de banda, frecuencias de media potencia y
  respuesta cerca de resonancia; Hayt 8.ª ed., cap. 16), **Fuente regulada por Zener**
  (transformador, rectificador, filtro y regulador sección por sección, rizado antes y después del
  regulador y R_S máxima) y **Amplificador emisor común** (punto Q, r_e, Z_i, Z_o y A_v con R_E
  parcialmente puenteada, rectas de carga de cd y ca y máxima salida sin recorte). Sus temas
  enlazan además las calculadoras de Circuitos y Sistemas y de Electrónica que el programa
  comprueba en el laboratorio.
- **Circuitos y Sistemas** y **Electrónica** en la malla curricular: programas transcritos al
  pensum fuente, bibliografía y 22 calculadoras planificadas en el roadmap (nodos, mallas,
  superposición, Thévenin-Norton, máxima transferencia de potencia, fasores, potencia en CA,
  valor promedio y eficaz, primer y segundo orden, variables de estado, Laplace, convolución,
  transformada Z, diodos, rectificadores, filtrado y regulación, polarización y análisis AC de
  transistores, amplificadores operacionales).
- **Sistemas Dinámicos** y **Laboratorio de Circuitos y Electrónica** en la malla curricular:
  programas transcritos al pensum fuente, bibliografía y 16 calculadoras planificadas en el
  roadmap (reducción de diagramas de bloques, ganancia de Mason, función de transferencia, lazo
  abierto y cerrado, respuesta transitoria, Routh-Hurwitz, error en estado estacionario, LGR,
  Bode, sintonizado PID, compensador de adelanto/retraso, controlabilidad y observabilidad,
  realimentación de estados, resonancia RLC, fuente regulada por Zener, amplificador emisor
  común).

### Cambiado

- **Guía del tablero de circuitos** rediseñada (`BuilderGuide.tsx`): primeros pasos en tarjetas,
  leyenda de los elementos con su convención de polaridad y pestañas Ratón / Táctil / Atajos, que
  se adaptan al ancho del panel (en escritorio la columna del formulario es angosta). El
  constructor suma el botón «Terminar cable» para pantallas táctiles, encuadra solo el ejemplo
  cuando no cabe en el lienzo, avisa si un valor no es válido y acepta la unidad al escribirlo
  («2.2 kΩ», «10 µF»).

### Corregido

- La forma polar en LaTeX ya no produce un doble superíndice cuando el ángulo sale en notación
  científica (p. ej. un residuo de redondeo de 10⁻¹³ °).
- Las migas de pan ya no repiten claves de React cuando el tema y la calculadora se llaman igual
  («Amplificadores operacionales»).

## [0.7.0] — 2026-09-30

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

[Sin publicar]: https://github.com/SuricatoAviones/calc-udo/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.7.0
[0.6.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.6.0
[0.5.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.5.0
[0.4.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.4.0
[0.3.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.3.0
[0.2.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.2.0
[0.1.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.1.0
