# Changelog

Todos los cambios relevantes de CalcUDO se registran en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/) (ver ADR-015 en `docs/DECISIONES.md`).

## [Sin publicar]

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

[Sin publicar]: https://github.com/SuricatoAviones/calc-udo/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.3.0
[0.2.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.2.0
[0.1.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.1.0
