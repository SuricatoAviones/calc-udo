# Roadmap

Lo que falta después de la versión **1.0.0** (ADR-038). Las calculadoras previstas ya existen en
`data/curriculum.ts` sin implementación: el sitio y [PENSUM.md](PENSUM.md) las muestran con
estado 🗺️ Roadmap. Para tomar una, sigue [NUEVA-CALCULADORA.md](NUEVA-CALCULADORA.md).

## 1. Sistemas Dinámicos (13 calculadoras)

El programa completo está en el pensum fuente y en el currículum; no hay ninguna implementada.
Buena parte se apoya en núcleos que ya existen en Circuitos y Sistemas: `lib/math/polynomials.ts`
(raíces con multiplicidad), `laplace.ts`, `partial-fractions.ts`, `laplace-inverse.ts` y
`state-space.ts`.

| Unidad | Tema                                       | Calculadora (id)                    |
| ------ | ------------------------------------------ | ----------------------------------- |
| I      | Diagramas de bloque y flujogramas          | `reduccion-de-diagramas-de-bloques` |
| I      | Diagramas de bloque y flujogramas          | `ganancia-de-mason`                 |
| II     | Funciones de transferencia                 | `funcion-de-transferencia`          |
| II     | Funciones de transferencia                 | `lazo-abierto-y-cerrado`            |
| II     | Funciones de transferencia                 | `respuesta-transitoria`             |
| III    | Estabilidad y error en estado estacionario | `routh-hurwitz`                     |
| III    | Estabilidad y error en estado estacionario | `error-en-estado-estacionario`      |
| IV     | Lugar geométrico de las raíces             | `lugar-geometrico-de-las-raices`    |
| V      | Análisis en el dominio de la frecuencia    | `diagramas-de-bode`                 |
| VI     | Diseño de controladores                    | `sintonizacion-pid`                 |
| VI     | Diseño de controladores                    | `compensador-adelanto-retraso`      |
| VII    | Realimentación de estados                  | `controlabilidad-y-observabilidad`  |
| VII    | Realimentación de estados                  | `realimentacion-de-estados`         |

Bibliografía del pensum: Ogata, Kuo, Dorf, D'Azzo, entre otros (`data/bibliography.ts`). Los
tests deben salir de sus ejemplos resueltos.

## 2. Bloqueado por falta de información

- **Matemáticas I a IV.** El pensum fuente no incluye sus programas (`content: 'pendiente'`).
  Hace falta el programa sinóptico o analítico oficial de cada una para definir temas y
  calculadoras; no se inventan.
- **Teoría de Sobrevivencia: `nivel-critico` y `led-markoviano`.** El método viene de trabajos
  de Bórean que no están publicados (ADR-032). Se implementan cuando haya una fuente citable.

## 3. Mejoras del tablero de circuitos

No son calculadoras nuevas del pensum, sino ampliaciones del constructor interactivo:

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
