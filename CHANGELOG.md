# Changelog

Todos los cambios relevantes de CalcUDO se registran en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/) (ver ADR-015 en `docs/DECISIONES.md`).

## [Sin publicar]

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

[Sin publicar]: https://github.com/SuricatoAviones/calc-udo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/SuricatoAviones/calc-udo/releases/tag/v0.1.0
