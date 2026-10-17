# Roadmap

Lo que falta después de la versión **1.1.0**, que completó Sistemas Dinámicos (ADR-039) con sus
13 calculadoras y el constructor de diagramas de bloques. Las calculadoras previstas que quedan existen en `data/curriculum.ts` sin implementación: el sitio
y [PENSUM.md](PENSUM.md) las muestran con estado 🗺️ Roadmap. Para tomar una, sigue
[NUEVA-CALCULADORA.md](NUEVA-CALCULADORA.md).

## 1. Bloqueado por falta de información

- **Matemáticas I a IV.** El pensum fuente no incluye sus programas (`content: 'pendiente'`).
  Hace falta el programa sinóptico o analítico oficial de cada una para definir temas y
  calculadoras; no se inventan.
- **Teoría de Sobrevivencia: `nivel-critico` y `led-markoviano`.** El método viene de trabajos
  de Bórean que no están publicados (ADR-032). Se implementan cuando haya una fuente citable.

## 2. Mejoras de los constructores

No son calculadoras nuevas del pensum, sino ampliaciones de los constructores interactivos:

- **Comparadores y disparador de Schmitt dibujados.** Hoy el tablero exige realimentación
  negativa y remite al modo «configuración» (ADR-037). Haría falta resolver la saturación con
  estados (como los diodos) y la histéresis según la historia de la entrada.
- **Diodo real en el tablero.** La ecuación de Shockley solo está en el modo serie; en una red
  pediría Newton sobre todo el circuito (ADR-036).
- **Ruptura inversa y Zener en el tablero.** Los diodos dibujados no modelan la ruptura (p. ej.
  el LED rojo del ejemplo 2.11 de Boylestad con un LED azul en antiparalelo).
- **Transistores en el tablero.** BJT con modelo por regiones (fuente dependiente βI_B) y FET con
  la ecuación de Shockley, para las «diversas configuraciones de polarización» de Boylestad
  (sec. 4.9).
  El constructor ya admite componentes de tres terminales.
- **Constructor de diagramas de bloques.** Le faltan la selección múltiple y el arrastre de los
  vértices de un cable (hoy se borra y se vuelve a trazar); los flujogramas se escriben como tabla
  de ramas, con un dibujo automático.
