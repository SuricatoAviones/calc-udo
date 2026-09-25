# Pensum → temas → calculadoras

<!-- ARCHIVO GENERADO por scripts/generate-pensum.ts. No lo edites a mano: cambia
     data/curriculum.ts o el registro de calculadoras y ejecuta `pnpm docs:pensum`. -->

Mapa completo de la rama matemática/cuantitativa de Ingeniería de Sistemas (UDO) y del
estado de cada calculadora. Fuente: [`fuentes/pensum-rama-cuantitativa.md`](fuentes/pensum-rama-cuantitativa.md).

**Estados**

- ✅ **Implementada** — registrada en `components/calculators/registry.ts`, con tests.
- 🛠️ **En progreso** — marcada con `inProgress: true` en `data/curriculum.ts`.
- 🗺️ **Roadmap** — prevista, sin trabajo iniciado.
- ⏳ **Contenido pendiente** — el pensum no incluye el programa de la materia.

**Cómo se derivaron los temas.** Cada tema agrupa contenido programático tal como aparece
en el pensum; su descripción lo cita. No se agregan temas que no estén ahí. Una calculadora
se define en un solo tema y otros temas la referencian (↪︎), p. ej. las distribuciones de
Estadísticas I se reutilizan en Inferencia. Los temas conceptuales (sin cálculo) se listan
para que el mapa esté completo.

## Resumen

| Código | Materia | Ubicación | Prelación | Créditos | ✅ | 🛠️ | 🗺️ |
|---|---|---|---|---|---:|---:|---:|
| 008-1814 | [Matemáticas I](#matematicas-1) | Semestre I | Ninguna | 4 (3T-3P) | ⏳ | ⏳ | ⏳ |
| 008-1824 | [Matemáticas II](#matematicas-2) | Semestre II | Matemáticas I (008-1814) | 4 (3T-3P) | ⏳ | ⏳ | ⏳ |
| 008-2814 | [Matemáticas III](#matematicas-3) | Semestre III | Matemáticas II (008-1824) | 4 (3T-3P) | ⏳ | ⏳ | ⏳ |
| 008-2824 | [Matemáticas IV](#matematicas-4) | Semestre IV | Matemáticas III (008-2814) | 4 (3T-3P) | ⏳ | ⏳ | ⏳ |
| 072-1162 | [Introducción a la Lógica Formal y Algoritmos](#logica-formal-y-algoritmos) | Semestre II | Ninguna | 2 (2T-0P) | 0 | 0 | 5 |
| 072-3913 | [Métodos Numéricos](#metodos-numericos) | Semestre V | Matemáticas IV (008-2824) / 072-2103 (fuera de esta rama) | 3 (2T-2P) | 10 | 0 | 13 |
| 062-3313 | [Estadísticas I](#estadistica-1) | Semestre IV | Matemáticas III (008-2814) | 3 (3T-0P) | 0 | 0 | 22 |
| 071-3122 | [Inferencia y Diseño de Experimentos](#inferencia-y-diseno-de-experimentos) | Semestre V | Estadísticas I (062-3313) | 2 (1T-2P) | 0 | 0 | 1 |
| 062-4622 | [Estadísticas II](#estadistica-2) | Semestre V | Estadísticas I (062-3313) | 3 (2T-0P) | 0 | 0 | 9 |
| 071-3663 | [Optimización de Operaciones](#optimizacion-de-operaciones) | Semestre VI | Métodos Numéricos (072-3913) | 3 (2T-3P) | 0 | 0 | 14 |
| 071-4303 | [Programación No Lineal](#programacion-no-lineal) | Electiva técnica | Optimización de Operaciones (071-3663) | 3 (3T-0P) | 0 | 0 | 8 |
| 071-4383 | [Procesos Estocásticos](#procesos-estocasticos) | Electiva técnica | Inferencia y Diseño de Experimentos (071-3122) | 3 (3T-0P) | 0 | 0 | 7 |
| 071-4393 | [Teoría de Colas](#teoria-de-colas) | Electiva técnica | Procesos Estocásticos (071-4383) | 3 (3T-0P) | 0 | 0 | 10 |
| 071-4903 | [Teoría de Sobrevivencia](#teoria-de-sobrevivencia) | Electiva técnica | Procesos Estocásticos (071-4383) | 3 (3T-0P) | 0 | 0 | 4 |

---

<a id="matematicas-1"></a>

## Matemáticas I

**Código:** 008-1814 · **Ubicación:** Semestre I · **Prelación:** Ninguna · **Créditos:** 4 (3T-3P)

⏳ **Contenido pendiente de definir.** El pensum no incluye el programa sinóptico/analítico
de esta materia; solo aparece en la malla curricular.

---

<a id="matematicas-2"></a>

## Matemáticas II

**Código:** 008-1824 · **Ubicación:** Semestre II · **Prelación:** Matemáticas I (008-1814) · **Créditos:** 4 (3T-3P)

⏳ **Contenido pendiente de definir.** El pensum no incluye el programa sinóptico/analítico
de esta materia; solo aparece en la malla curricular.

---

<a id="matematicas-3"></a>

## Matemáticas III

**Código:** 008-2814 · **Ubicación:** Semestre III · **Prelación:** Matemáticas II (008-1824) · **Créditos:** 4 (3T-3P)

⏳ **Contenido pendiente de definir.** El pensum no incluye el programa sinóptico/analítico
de esta materia; solo aparece en la malla curricular.

---

<a id="matematicas-4"></a>

## Matemáticas IV

**Código:** 008-2824 · **Ubicación:** Semestre IV · **Prelación:** Matemáticas III (008-2814) · **Créditos:** 4 (3T-3P)

⏳ **Contenido pendiente de definir.** El pensum no incluye el programa sinóptico/analítico
de esta materia; solo aparece en la malla curricular.

---

<a id="logica-formal-y-algoritmos"></a>

## Introducción a la Lógica Formal y Algoritmos

**Código:** 072-1162 · **Ubicación:** Semestre II · **Prelación:** Ninguna · **Créditos:** 2 (2T-0P)

**Objetivo general:** Proporcionar una visión amplia de la Lógica Formal con la finalidad de inducir al estudiante a que comprenda lo que es el pensamiento, el juicio, la teoría del concepto, el razonamiento, el silogismo y sus variedades y la dialéctica.

| Tema | Calculadora | Estado | Ruta |
|---|---|---|---|
| Unidad I — Introducción al estudio de la Filosofía | _Tema conceptual, sin calculadora_ | — | — |
| Unidad II — El pensar y el pensamiento | _Tema conceptual, sin calculadora_ | — | — |
| Unidad III — Principios y leyes de la lógica | Conversión entre sistemas de numeración | 🗺️ Roadmap | `/logica-formal-y-algoritmos/principios-y-leyes-de-la-logica/sistemas-de-numeracion/` |
| Unidad III — Principios y leyes de la lógica | Tablas de verdad | 🗺️ Roadmap | `/logica-formal-y-algoritmos/principios-y-leyes-de-la-logica/tablas-de-verdad/` |
| Unidad III — Principios y leyes de la lógica | Representación binaria | 🗺️ Roadmap | `/logica-formal-y-algoritmos/principios-y-leyes-de-la-logica/representacion-binaria/` |
| Unidad IV — Introducción al estudio de algoritmos | Traza de algoritmos de búsqueda | 🗺️ Roadmap | `/logica-formal-y-algoritmos/algoritmos/algoritmos-de-busqueda/` |
| Unidad IV — Introducción al estudio de algoritmos | Traza de algoritmos de ordenamiento | 🗺️ Roadmap | `/logica-formal-y-algoritmos/algoritmos/algoritmos-de-ordenamiento/` |

**Bibliografía**

- Fatone, Vicente. Lógica y Teoría del Conocimiento. Kapeluz. Buenos Aires. <sub>`fatone`</sub>
- Figerman G. (1998). Lógica y Teoría del Conocimiento. Editorial Librería Ateneo. <sub>`figerman-1998`</sub>
- Miró Quesada, Francisco. Lógica. Lima. <sub>`miro-quesada`</sub>
- Muñoz, A. (1996). Lógica Simbólica Elemental. Editorial Miró. <sub>`munoz-1996`</sub>
- Pfander, Alejandro. Lógica. Espasa Calpe. Buenos Aires. <sub>`pfander`</sub>
- Romero, Francisco y Pucciarelli, Eugenio. Lógica y Nociones de Teoría del Conocimiento. Espasa Calpe. Buenos Aires. <sub>`romero-pucciarelli`</sub>
- Tucker A. – Joyanes L. (2000). Lógica, resolución de problemas, algoritmos y programas. Mc Graw Hill. <sub>`tucker-joyanes-2000`</sub>

---

<a id="metodos-numericos"></a>

## Métodos Numéricos

**Código:** 072-3913 · **Ubicación:** Semestre V · **Prelación:** Matemáticas IV (008-2824) / 072-2103 (fuera de esta rama) · **Créditos:** 3 (2T-2P)

**Objetivo general:** Aplicar soluciones numéricas aproximadas a problemas cuya solución analítica sea excesivamente laboriosa.

| Tema | Calculadora | Estado | Ruta |
|---|---|---|---|
| Modelos matemáticos y errores | Errores de truncamiento y redondeo | 🗺️ Roadmap | `/metodos-numericos/modelos-y-errores/errores-numericos/` |
| Determinantes y matrices | Determinante de una matriz | 🗺️ Roadmap | `/metodos-numericos/determinantes-y-matrices/determinante/` |
| Determinantes y matrices | Operaciones con matrices | 🗺️ Roadmap | `/metodos-numericos/determinantes-y-matrices/operaciones-con-matrices/` |
| Eliminación gaussiana y pivoteo | Eliminación gaussiana con pivoteo | 🗺️ Roadmap | `/metodos-numericos/sistemas-de-ecuaciones-lineales/eliminacion-gaussiana/` |
| Raíces de ecuaciones | Método de bisección | ✅ Implementada | `/metodos-numericos/raices-de-ecuaciones/biseccion/` |
| Raíces de ecuaciones | Método de la falsa posición | ✅ Implementada | `/metodos-numericos/raices-de-ecuaciones/falsa-posicion/` |
| Raíces de ecuaciones | Método de la secante | ✅ Implementada | `/metodos-numericos/raices-de-ecuaciones/secante/` |
| Raíces de ecuaciones | Método de Newton-Raphson | ✅ Implementada | `/metodos-numericos/raices-de-ecuaciones/newton-raphson/` |
| Transformación de polinomios y división sintética | División sintética | 🗺️ Roadmap | `/metodos-numericos/polinomios/division-sintetica/` |
| Método del descenso más rápido | Método del descenso más rápido | 🗺️ Roadmap | `/metodos-numericos/descenso-mas-rapido/descenso-mas-rapido/` |
| Diferencias finitas, interpolación y aproximación | Tabla de diferencias | 🗺️ Roadmap | `/metodos-numericos/diferencias-e-interpolacion/tabla-de-diferencias/` |
| Diferencias finitas, interpolación y aproximación | Interpolación con fórmulas de Newton | 🗺️ Roadmap | `/metodos-numericos/diferencias-e-interpolacion/interpolacion-de-newton/` |
| Diferencias finitas, interpolación y aproximación | Aproximación por mínimos cuadrados | 🗺️ Roadmap | `/metodos-numericos/diferencias-e-interpolacion/minimos-cuadrados/` |
| Integración numérica | Regla rectangular | ✅ Implementada | `/metodos-numericos/integracion-numerica/regla-rectangular/` |
| Integración numérica | Regla trapezoidal | ✅ Implementada | `/metodos-numericos/integracion-numerica/regla-trapezoidal/` |
| Integración numérica | Regla de Simpson | ✅ Implementada | `/metodos-numericos/integracion-numerica/regla-de-simpson/` |
| Fórmulas en diferencias | Derivación por diferencias finitas | 🗺️ Roadmap | `/metodos-numericos/derivacion-numerica/derivacion-numerica/` |
| Ecuaciones diferenciales | Método de Euler | ✅ Implementada | `/metodos-numericos/ecuaciones-diferenciales/euler/` |
| Ecuaciones diferenciales | Método de Taylor | 🗺️ Roadmap | `/metodos-numericos/ecuaciones-diferenciales/metodo-de-taylor/` |
| Ecuaciones diferenciales | Métodos multipaso | 🗺️ Roadmap | `/metodos-numericos/ecuaciones-diferenciales/metodos-multipaso/` |
| Ecuaciones diferenciales | Método de Euler modificado (Heun) | ✅ Implementada | `/metodos-numericos/ecuaciones-diferenciales/euler-modificado/` |
| Ecuaciones diferenciales | Método predictor-corrector | 🗺️ Roadmap | `/metodos-numericos/ecuaciones-diferenciales/predictor-corrector/` |
| Ecuaciones diferenciales | Método de Runge-Kutta de cuarto orden | ✅ Implementada | `/metodos-numericos/ecuaciones-diferenciales/runge-kutta/` |

**Bibliografía**

- Ledanois, J. – López, A. – Pimentel, J. (2000). Métodos Numéricos Aplicados en Ingeniería. Mc Graw Hill. <sub>`ledanois-2000`</sub>
- Chapra, Steven – Canale, R. (2000). Métodos Numéricos para Ingenieros. 3ra Ed. Mc Graw Hill. México. <sub>`chapra-canale-2000`</sub>
- Nakamura, Schoichiro (1994). Métodos Numéricos Aplicados con Software. Prentice Hall Hispanoamericana. México. <sub>`nakamura-1994`</sub>
- Smith, Allen (1993). Análisis Numéricos. Prentice Hall Hispanoamericana. México. <sub>`smith-1993`</sub>

---

<a id="estadistica-1"></a>

## Estadísticas I

**Código:** 062-3313 · **Ubicación:** Semestre IV · **Prelación:** Matemáticas III (008-2814) · **Créditos:** 3 (3T-0P)

**Objetivo general:** Aplicar los conceptos básicos–esenciales de la estadística descriptiva y probabilística.

| Tema | Calculadora | Estado | Ruta |
|---|---|---|---|
| Descripción de datos | Tabla de frecuencias e histograma | 🗺️ Roadmap | `/estadistica-1/descripcion-de-datos/tabla-de-frecuencias/` |
| Descripción de datos | Medidas de tendencia central y dispersión | 🗺️ Roadmap | `/estadistica-1/descripcion-de-datos/medidas-descriptivas/` |
| Introducción a probabilidades | Permutaciones y combinaciones | 🗺️ Roadmap | `/estadistica-1/probabilidades/tecnicas-de-conteo/` |
| Introducción a probabilidades | Probabilidad condicional y teorema de Bayes | 🗺️ Roadmap | `/estadistica-1/probabilidades/teorema-de-bayes/` |
| Variables aleatorias | Esperanza y varianza de una variable aleatoria | 🗺️ Roadmap | `/estadistica-1/variables-aleatorias/esperanza-y-varianza/` |
| Variables aleatorias | Desigualdad de Chebyshev | 🗺️ Roadmap | `/estadistica-1/variables-aleatorias/desigualdad-de-chebyshev/` |
| Variables aleatorias | Función generadora de momentos | 🗺️ Roadmap | `/estadistica-1/variables-aleatorias/funcion-generadora-de-momentos/` |
| Distribuciones discretas | Distribución de Bernoulli | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-bernoulli/` |
| Distribuciones discretas | Distribución binomial | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-binomial/` |
| Distribuciones discretas | Distribución geométrica | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-geometrica/` |
| Distribuciones discretas | Distribución de Pascal | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-de-pascal/` |
| Distribuciones discretas | Distribución multinomial | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-multinomial/` |
| Distribuciones discretas | Distribución hipergeométrica | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-hipergeometrica/` |
| Distribuciones discretas | Distribución de Poisson | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-de-poisson/` |
| Distribuciones continuas | Distribución uniforme | 🗺️ Roadmap | `/estadistica-1/distribuciones-continuas/distribucion-uniforme/` |
| Distribuciones continuas | Distribución exponencial | 🗺️ Roadmap | `/estadistica-1/distribuciones-continuas/distribucion-exponencial/` |
| Distribuciones continuas | Distribución gamma | 🗺️ Roadmap | `/estadistica-1/distribuciones-continuas/distribucion-gamma/` |
| Distribuciones continuas | Distribución beta | 🗺️ Roadmap | `/estadistica-1/distribuciones-continuas/distribucion-beta/` |
| Distribuciones continuas | Distribución de Weibull | 🗺️ Roadmap | `/estadistica-1/distribuciones-continuas/distribucion-weibull/` |
| Distribuciones continuas | Distribución normal | 🗺️ Roadmap | `/estadistica-1/distribuciones-continuas/distribucion-normal/` |
| Distribuciones continuas | Teorema del límite central | 🗺️ Roadmap | `/estadistica-1/distribuciones-continuas/teorema-del-limite-central/` |
| Teoría elemental del muestreo | Distribuciones muestrales | 🗺️ Roadmap | `/estadistica-1/muestreo/distribuciones-muestrales/` |

**Bibliografía**

- Canavos, George C. (1995). Probabilidad y Estadística. Aplicaciones y Métodos. 2da Ed. Mc Graw Hill. México. <sub>`canavos-1995`</sub>
- Meyer, Paul (1998). Probabilidad y Aplicaciones Estadísticas. 2da Ed. Addison Wesley Longman. México. <sub>`meyer-1998`</sub>
- Mendenhall, William y Sincich, Ferry (1997). Probabilidad y Estadística para Ingeniería y Ciencias. 4ta Ed. Prentice-Hall Hispanoamericana. <sub>`mendenhall-sincich-1997`</sub>
- Walpole, Ronald, Myers, R., Myers, Sh. (1999). Probabilidad y Estadística para Ingenieros. 6ta Ed. Prentice-Hall Hispanoamericana. <sub>`walpole-1999`</sub>

---

<a id="inferencia-y-diseno-de-experimentos"></a>

## Inferencia y Diseño de Experimentos

**Código:** 071-3122 · **Ubicación:** Semestre V · **Prelación:** Estadísticas I (062-3313) · **Créditos:** 2 (1T-2P)

**Objetivo general:** Adaptar modelos probabilísticos, partiendo de la definición de variables aleatorias, mediante un diseño experimental que conduzca a inferir acerca de sistemas o fenómenos de la vida real.

| Tema | Calculadora | Estado | Ruta |
|---|---|---|---|
| Aspectos generales de la inferencia | _Tema conceptual, sin calculadora_ | — | — |
| Conceptos básicos de probabilidad | ↪︎ Probabilidad condicional y teorema de Bayes | 🗺️ Roadmap | `/estadistica-1/probabilidades/teorema-de-bayes/` |
| Variables aleatorias | ↪︎ Esperanza y varianza de una variable aleatoria | 🗺️ Roadmap | `/estadistica-1/variables-aleatorias/esperanza-y-varianza/` |
| Estimación de parámetros | Estimación por máxima verosimilitud | 🗺️ Roadmap | `/inferencia-y-diseno-de-experimentos/estimacion-de-parametros/maxima-verosimilitud/` |
| Distribuciones de probabilidad | ↪︎ Distribución binomial | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-binomial/` |
| Distribuciones de probabilidad | ↪︎ Distribución geométrica | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-geometrica/` |
| Distribuciones de probabilidad | ↪︎ Distribución de Pascal | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-de-pascal/` |
| Distribuciones de probabilidad | ↪︎ Distribución hipergeométrica | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-hipergeometrica/` |
| Distribuciones de probabilidad | ↪︎ Distribución de Poisson | 🗺️ Roadmap | `/estadistica-1/distribuciones-discretas/distribucion-de-poisson/` |
| Distribuciones de probabilidad | ↪︎ Distribución normal | 🗺️ Roadmap | `/estadistica-1/distribuciones-continuas/distribucion-normal/` |
| Distribuciones de probabilidad | ↪︎ Distribución exponencial | 🗺️ Roadmap | `/estadistica-1/distribuciones-continuas/distribucion-exponencial/` |
| Distribuciones de probabilidad | ↪︎ Distribución de Weibull | 🗺️ Roadmap | `/estadistica-1/distribuciones-continuas/distribucion-weibull/` |

**Bibliografía**

- Bonini – Hausman - Bierman (2000). Análisis Cuantitativo para los Negocios. 9na Ed. Mc Graw Hill - Irwin. Colombia. <sub>`bonini-2000`</sub>
- Johnson, Richard (1997). Probabilidad y Estadística para Ingenieros de Miller y Freund. 5ta Ed. Prentice Hall. México. <sub>`johnson-1997`</sub>
- Mendenhall, William y Sincich, Ferry (1997). Probabilidad y Estadística para Ingeniería y Ciencias. 4ta Ed. Prentice-Hall Hispanoamericana. <sub>`mendenhall-sincich-1997`</sub>
- Meyer, Paul (1998). Probabilidad y Aplicaciones Estadísticas. 2da Ed. Addison Wesley Longman. México. <sub>`meyer-1998`</sub>
- Murray, Spiegel (1991). Probabilidades y Estadística. Mc Graw Hill. México. <sub>`spiegel-1991`</sub>
- Walpole – Myers – Myers (1998). Probabilidad y Estadística para Ingenieros. 6ta Ed. Prentice Hall. <sub>`walpole-1998`</sub>
- Willey, J. (2001). Design of Experiments Using the Taguchi Approach: 16 Steps to Product and Process Improvement. John Wiley & Son. <sub>`willey-2001`</sub>

---

<a id="estadistica-2"></a>

## Estadísticas II

**Código:** 062-4622 · **Ubicación:** Semestre V · **Prelación:** Estadísticas I (062-3313) · **Créditos:** 3 (2T-0P)

**Objetivo general:** Aplicar los conceptos relacionados con los métodos de análisis de regresión y correlación, diseño de experimentos y estadística no paramétrica, para la toma de decisiones en el ámbito operativo y administrativo de los sistemas productivos.

| Tema | Calculadora | Estado | Ruta |
|---|---|---|---|
| Regresión y correlación | Regresión lineal simple | 🗺️ Roadmap | `/estadistica-2/regresion-y-correlacion/regresion-lineal/` |
| Regresión y correlación | Coeficiente de correlación | 🗺️ Roadmap | `/estadistica-2/regresion-y-correlacion/coeficiente-de-correlacion/` |
| Pruebas de hipótesis | Prueba de hipótesis sobre la media | 🗺️ Roadmap | `/estadistica-2/pruebas-de-hipotesis/prueba-de-hipotesis-media/` |
| Pruebas de hipótesis | Prueba de hipótesis sobre la varianza | 🗺️ Roadmap | `/estadistica-2/pruebas-de-hipotesis/prueba-de-hipotesis-varianza/` |
| Pruebas de hipótesis | Errores tipo I y II y función potencia | 🗺️ Roadmap | `/estadistica-2/pruebas-de-hipotesis/errores-tipo-i-y-ii/` |
| Pruebas de hipótesis | Prueba de bondad de ajuste | 🗺️ Roadmap | `/estadistica-2/pruebas-de-hipotesis/bondad-de-ajuste/` |
| Pruebas de hipótesis | Pruebas no paramétricas | 🗺️ Roadmap | `/estadistica-2/pruebas-de-hipotesis/pruebas-no-parametricas/` |
| Series de tiempo | Análisis de series de tiempo | 🗺️ Roadmap | `/estadistica-2/series-de-tiempo/componentes-de-series-de-tiempo/` |
| Series de tiempo | Predicción con series de tiempo | 🗺️ Roadmap | `/estadistica-2/series-de-tiempo/pronostico-de-series-de-tiempo/` |

**Bibliografía**

- Canavos, George C. (1995). Probabilidad y Estadística. Aplicaciones y Métodos. 2da Ed. Mc Graw Hill. México. <sub>`canavos-1995`</sub>
- Meyer, Paul (1998). Probabilidad y Aplicaciones Estadísticas. 2da Ed. Addison Wesley Longman. México. <sub>`meyer-1998`</sub>

---

<a id="optimizacion-de-operaciones"></a>

## Optimización de Operaciones

**Código:** 071-3663 · **Ubicación:** Semestre VI · **Prelación:** Métodos Numéricos (072-3913) · **Créditos:** 3 (2T-3P)

**Objetivo general:** Aplicar herramientas de la investigación de operaciones para la optimización de procesos en estado estable, mediante la planificación de la producción, rutas, distribuciones de productos, etc.

| Tema | Calculadora | Estado | Ruta |
|---|---|---|---|
| Introducción a la programación lineal | _Tema conceptual, sin calculadora_ | — | — |
| Resolución de modelos de PL | Método gráfico | 🗺️ Roadmap | `/optimizacion-de-operaciones/resolucion-de-modelos/metodo-grafico/` |
| Resolución de modelos de PL | Forma canónica y estándar | 🗺️ Roadmap | `/optimizacion-de-operaciones/resolucion-de-modelos/forma-estandar/` |
| Resolución de modelos de PL | Método simplex | 🗺️ Roadmap | `/optimizacion-de-operaciones/resolucion-de-modelos/simplex/` |
| Resolución de modelos de PL | Método de la M grande | 🗺️ Roadmap | `/optimizacion-de-operaciones/resolucion-de-modelos/metodo-m-grande/` |
| Resolución de modelos de PL | Método de las dos fases | 🗺️ Roadmap | `/optimizacion-de-operaciones/resolucion-de-modelos/metodo-dos-fases/` |
| Dualidad y análisis de sensibilidad | Construcción del problema dual | 🗺️ Roadmap | `/optimizacion-de-operaciones/dualidad-y-sensibilidad/problema-dual/` |
| Dualidad y análisis de sensibilidad | Método dual-simplex | 🗺️ Roadmap | `/optimizacion-de-operaciones/dualidad-y-sensibilidad/dual-simplex/` |
| Dualidad y análisis de sensibilidad | Análisis de sensibilidad | 🗺️ Roadmap | `/optimizacion-de-operaciones/dualidad-y-sensibilidad/analisis-de-sensibilidad/` |
| Transporte y asignación | Método de la esquina noroeste | 🗺️ Roadmap | `/optimizacion-de-operaciones/transporte-y-asignacion/esquina-noroeste/` |
| Transporte y asignación | Método del costo mínimo | 🗺️ Roadmap | `/optimizacion-de-operaciones/transporte-y-asignacion/costo-minimo/` |
| Transporte y asignación | Método de aproximación de Vogel | 🗺️ Roadmap | `/optimizacion-de-operaciones/transporte-y-asignacion/aproximacion-de-vogel/` |
| Transporte y asignación | Método de multiplicadores | 🗺️ Roadmap | `/optimizacion-de-operaciones/transporte-y-asignacion/metodo-de-multiplicadores/` |
| Transporte y asignación | Método húngaro | 🗺️ Roadmap | `/optimizacion-de-operaciones/transporte-y-asignacion/metodo-hungaro/` |
| Programación entera | Ramificación y acotamiento | 🗺️ Roadmap | `/optimizacion-de-operaciones/programacion-entera/ramificacion-y-acotamiento/` |

**Bibliografía**

- Bonini – Hausman - Bierman (2000). Análisis Cuantitativo para los Negocios. 9na Ed. Mc Graw Hill - Irwin. Colombia. <sub>`bonini-2000`</sub>
- Handy, Taha (1998/2003). Investigación de Operaciones. Una introducción. PH. México. <sub>`taha`</sub>
- Aquilano, CH. (1994). Dirección de la Producción y de las Operaciones. 6ta Ed. Mc Graw Hill. USA. <sub>`aquilano-1994`</sub>
- Anderson, D. – Sweeney, D. – Williams, T. (1993). Introducción a los Modelos Cuantitativos para la Administración. Grupo Editorial Iberoamericana. México. <sub>`anderson-1993`</sub>
- Gould – Eppen - Schmidt (1992/2000). Investigación de Operaciones en la Ciencia Administrativa. Prentice Hall. México. <sub>`gould-eppen-schmidt`</sub>
- Arreola J. Arreola A. (2003). Programación Lineal. International Thomson Editores. México. <sub>`arreola-2003`</sub>
- Hillier F. Lieberman G. (2002). Investigación de Operaciones. 7ma Ed. Mc Graw Hill. México. <sub>`hillier-lieberman-2002`</sub>
- Winston W. (1994). Investigación de Operaciones. Aplicaciones y algoritmos. 3ra Ed. Grupo Editorial Iberoamericana. México. <sub>`winston-1994`</sub>

---

<a id="programacion-no-lineal"></a>

## Programación No Lineal

**Código:** 071-4303 · **Ubicación:** Electiva técnica · **Prelación:** Optimización de Operaciones (071-3663) · **Créditos:** 3 (3T-0P)

**Objetivo general:** Aplicar técnicas de cálculo diferencial y métodos de optimización para la búsqueda o localización de extremos óptimos en funciones no lineales.

| Tema | Calculadora | Estado | Ruta |
|---|---|---|---|
| Unidad I — Teoría de optimización clásica | Optimización no restringida de una variable | 🗺️ Roadmap | `/programacion-no-lineal/optimizacion-clasica/optimizacion-una-variable/` |
| Unidad I — Teoría de optimización clásica | Optimización no restringida de varias variables | 🗺️ Roadmap | `/programacion-no-lineal/optimizacion-clasica/optimizacion-varias-variables/` |
| Unidad I — Teoría de optimización clásica | Multiplicadores de Lagrange | 🗺️ Roadmap | `/programacion-no-lineal/optimizacion-clasica/multiplicadores-de-lagrange/` |
| Unidad I — Teoría de optimización clásica | Funciones de penalidad | 🗺️ Roadmap | `/programacion-no-lineal/optimizacion-clasica/funciones-de-penalidad/` |
| Unidad I — Teoría de optimización clásica | Condiciones de Karush-Kuhn-Tucker | 🗺️ Roadmap | `/programacion-no-lineal/optimizacion-clasica/condiciones-kkt/` |
| Unidad II — Programación cuadrática | Método de Wolfe | 🗺️ Roadmap | `/programacion-no-lineal/programacion-cuadratica/metodo-de-wolfe/` |
| Unidad III — Programación geométrica | Programación geométrica | 🗺️ Roadmap | `/programacion-no-lineal/programacion-geometrica/programacion-geometrica/` |
| Unidad IV — Programación separable | Programación separable | 🗺️ Roadmap | `/programacion-no-lineal/programacion-separable/programacion-separable/` |

**Bibliografía**

- Bazaraa M., Sherali H., Shetty C. (1993). Nonlinear Programming, Theory and Algorithms. John Wiley & Sons Inc.. USA. <sub>`bazaraa-1993`</sub>
- Cooper, Leon (1998). Applied Nonlinear Programming for Engineer and Scientist. W.B. Saunders Co.. Philadelphia. <sub>`cooper-1998`</sub>
- Hadley, G. (2000). Linear Programming. Addison Wesley. Reading, Mass.. <sub>`hadley-2000`</sub>
- Rao, S. (1999). Optimization: Theory and Applications. Indian Institute of Technology Kanpur. John Wiley & Sons Inc.. USA. <sub>`rao-1999`</sub>

---

<a id="procesos-estocasticos"></a>

## Procesos Estocásticos

**Código:** 071-4383 · **Ubicación:** Electiva técnica · **Prelación:** Inferencia y Diseño de Experimentos (071-3122) · **Créditos:** 3 (3T-0P)

**Objetivo general:** Reconocer los procesos estocásticos y desarrollar modelos paramétricos y/o no paramétricos que se adapten a sistemas o fenómenos que se rigen por leyes probabilísticas.

| Tema | Calculadora | Estado | Ruta |
|---|---|---|---|
| Unidad I — Aspectos generales | _Tema conceptual, sin calculadora_ | — | — |
| Unidad II — Cadenas de Markov | Probabilidades de transición en n pasos | 🗺️ Roadmap | `/procesos-estocasticos/cadenas-de-markov/transicion-en-n-pasos/` |
| Unidad II — Cadenas de Markov | Clasificación de estados | 🗺️ Roadmap | `/procesos-estocasticos/cadenas-de-markov/clasificacion-de-estados/` |
| Unidad II — Cadenas de Markov | Probabilidades de estado estable | 🗺️ Roadmap | `/procesos-estocasticos/cadenas-de-markov/estado-estable/` |
| Unidad III — Fenómenos de espera | ↪︎ Modelo M/M/1 | 🗺️ Roadmap | `/teoria-de-colas/modelos-exponenciales/cola-mm1/` |
| Unidad III — Fenómenos de espera | ↪︎ Modelo M/M/s | 🗺️ Roadmap | `/teoria-de-colas/modelos-exponenciales/cola-mms/` |
| Unidad III — Fenómenos de espera | ↪︎ Modelo M/M/1/K | 🗺️ Roadmap | `/teoria-de-colas/modelos-exponenciales/cola-mm1k/` |
| Unidad III — Fenómenos de espera | ↪︎ Modelo con población finita | 🗺️ Roadmap | `/teoria-de-colas/modelos-exponenciales/cola-poblacion-finita/` |
| Unidad III — Fenómenos de espera | ↪︎ Análisis de costos | 🗺️ Roadmap | `/teoria-de-colas/modelos-exponenciales/costos-de-colas/` |
| Unidad IV — Otros procesos estocásticos | Proceso de Poisson | 🗺️ Roadmap | `/procesos-estocasticos/otros-procesos/proceso-de-poisson/` |
| Unidad IV — Otros procesos estocásticos | Caminata aleatoria | 🗺️ Roadmap | `/procesos-estocasticos/otros-procesos/caminata-aleatoria/` |
| Unidad IV — Otros procesos estocásticos | Proceso de nacimiento y muerte | 🗺️ Roadmap | `/procesos-estocasticos/otros-procesos/nacimiento-y-muerte/` |
| Unidad IV — Otros procesos estocásticos | Simulación | 🗺️ Roadmap | `/procesos-estocasticos/otros-procesos/simulacion/` |

**Bibliografía**

- Arnold, Edward (2001). Advances in Stochastic Simulation Methods. Balskrishnam. <sub>`arnold-2001`</sub>
- Barndorff – Nielsen (2000). Complex Stochastic Systems. John Wiley. <sub>`barndorff-nielsen-2000`</sub>
- Borovkor, A. (1998). Ergodicity and Stability of Stochastic Processes. John Wiley. <sub>`borovkor-1998`</sub>
- Mathur, Kamlesh – Solow, Daniel (1996). Investigación de Operaciones. Prentice Hall. <sub>`mathur-solow-1996`</sub>
- Kaufman, A. (1996). Los Fenómenos de Espera. Editorial Continental. <sub>`kaufman-1996`</sub>
- Suddehender, B. (1995). Applied Stochastic Processes. Halsted. <sub>`suddehender-1995`</sub>
- Wong H., Carolina (2007). Procesos Estocásticos. Trabajo de Ascenso, Depto. de Computación y Sistemas, UDO Anzoátegui. <sub>`wong-2007`</sub>

---

<a id="teoria-de-colas"></a>

## Teoría de Colas

**Código:** 071-4393 · **Ubicación:** Electiva técnica · **Prelación:** Procesos Estocásticos (071-4383) · **Créditos:** 3 (3T-0P)

**Objetivo general:** Evaluar el comportamiento de un fenómeno de espera, a través del diseño de un modelo de colas que optimice el funcionamiento del sistema.

| Tema | Calculadora | Estado | Ruta |
|---|---|---|---|
| Unidad I — Fundamentos de fenómenos de espera | _Tema conceptual, sin calculadora_ | — | — |
| Unidad II — Modelos con distribuciones exponenciales | Modelo M/M/1 | 🗺️ Roadmap | `/teoria-de-colas/modelos-exponenciales/cola-mm1/` |
| Unidad II — Modelos con distribuciones exponenciales | Modelo M/M/s | 🗺️ Roadmap | `/teoria-de-colas/modelos-exponenciales/cola-mms/` |
| Unidad II — Modelos con distribuciones exponenciales | Modelo M/M/1/K | 🗺️ Roadmap | `/teoria-de-colas/modelos-exponenciales/cola-mm1k/` |
| Unidad II — Modelos con distribuciones exponenciales | Modelo con población finita | 🗺️ Roadmap | `/teoria-de-colas/modelos-exponenciales/cola-poblacion-finita/` |
| Unidad II — Modelos con distribuciones exponenciales | Análisis de costos | 🗺️ Roadmap | `/teoria-de-colas/modelos-exponenciales/costos-de-colas/` |
| Unidad III — Otras aplicaciones | Modelo de pérdida de Erlang | 🗺️ Roadmap | `/teoria-de-colas/otras-aplicaciones/perdida-de-erlang/` |
| Unidad III — Otras aplicaciones | Colas con prioridad | 🗺️ Roadmap | `/teoria-de-colas/otras-aplicaciones/colas-con-prioridad/` |
| Unidad III — Otras aplicaciones | Modelo M/G/1 | 🗺️ Roadmap | `/teoria-de-colas/otras-aplicaciones/cola-mg1/` |
| Unidad III — Otras aplicaciones | ↪︎ Proceso de nacimiento y muerte | 🗺️ Roadmap | `/procesos-estocasticos/otros-procesos/nacimiento-y-muerte/` |
| Unidad IV — Redes de colas | Colas en serie | 🗺️ Roadmap | `/teoria-de-colas/redes-de-colas/colas-en-serie/` |
| Unidad IV — Redes de colas | Redes de Jackson | 🗺️ Roadmap | `/teoria-de-colas/redes-de-colas/redes-de-jackson/` |

**Bibliografía**

- Hillier F. Lieberman G. (2002). Investigación de Operaciones. 7ma Ed. Mc Graw Hill. México. <sub>`hillier-lieberman-2002`</sub>
- Kaufman, A. (1996). Los Fenómenos de Espera. Editorial Continental. <sub>`kaufman-1996`</sub>
- Mathur, Kamlesh – Solow, Daniel (1996). Investigación de Operaciones. Prentice Hall. <sub>`mathur-solow-1996`</sub>
- Gould – Eppen - Schmidt (1992/2000). Investigación de Operaciones en la Ciencia Administrativa. Prentice Hall. México. <sub>`gould-eppen-schmidt`</sub>
- Winston W. (1994). Investigación de Operaciones. Aplicaciones y algoritmos. 3ra Ed. Grupo Editorial Iberoamericana. México. <sub>`winston-1994`</sub>

---

<a id="teoria-de-sobrevivencia"></a>

## Teoría de Sobrevivencia

**Código:** 071-4903 · **Ubicación:** Electiva técnica · **Prelación:** Procesos Estocásticos (071-4383) · **Créditos:** 3 (3T-0P)

**Objetivo general:** Aplicar un análisis de sobrevivencia que permita diagnosticar la confiabilidad de sistemas en general, mediante un modelo no paramétrico que estime geométricamente las funciones de sobrevivencia, fallas y riesgo.

| Tema | Calculadora | Estado | Ruta |
|---|---|---|---|
| Unidad I — Introducción a los modelos no paramétricos | _Tema conceptual, sin calculadora_ | — | — |
| Unidad II — Generalidades del análisis de sobrevivencia | _Tema conceptual, sin calculadora_ | — | — |
| Unidad III — El producto límite (Kaplan-Meier) | Estimador de Kaplan-Meier | 🗺️ Roadmap | `/teoria-de-sobrevivencia/producto-limite/kaplan-meier/` |
| Unidad IV — Tabla de sobrevivencia y fallas | Tabla de sobrevivencia y fallas | 🗺️ Roadmap | `/teoria-de-sobrevivencia/tabla-de-sobrevivencia/tabla-de-sobrevivencia/` |
| Unidad V — Adaptación y análisis del modelo | Nivel crítico del sistema | 🗺️ Roadmap | `/teoria-de-sobrevivencia/adaptacion-del-modelo/nivel-critico/` |
| Unidad VI — LED Markoviano | LED Markoviano | 🗺️ Roadmap | `/teoria-de-sobrevivencia/led-markoviano/led-markoviano/` |

**Bibliografía**

- Bórean, Ezio (1995). Modelos no Paramétricos de Sobrevivencia y Fallas con Datos Censurados. Trabajo de Ascenso, UDO. <sub>`borean-1995`</sub>
- Bórean, E. (1999). Modelos HB — Modelos No Paramétricos para el Control del Mantenimiento de un Sistema. UGMA. Barcelona. <sub>`borean-1999`</sub>
- Bórean, Ezio – Ganuza, E. (2001). Inferencia acerca de las Curvas de Sobrevivencia a partir de las Tablas de Vida con Datos Censurados. <sub>`borean-ganuza-2001`</sub>
- Bórean, Ezio – Solórzano, L. (2001). ¿Cómo captar la información para la aplicación de un modelo no paramétrico de confiabilidad con datos censurados?. II Jornadas Nacionales de Investigación de Operaciones. Puerto La Cruz. <sub>`borean-solorzano-2001`</sub>
- Solórzano, L – Padra, D. (1999). Diseño de un Modelo Markoviano para Validar las Proyecciones del Comportamiento de un Sistema Centrado en Confiabilidad.... Trabajo de Grado, UDO Anzoátegui. <sub>`solorzano-padra-1999`</sub>
