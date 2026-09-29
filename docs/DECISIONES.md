# Registro de decisiones (ADRs)

Decisiones de arquitectura en formato breve. Una decisión nueva se **agrega al final** con el
siguiente número. Si una decisión reemplaza a otra, la vieja se marca como
`Reemplazada por ADR-NNN` y no se borra.

Plantilla:

```md
## ADR-NNN — Título

- **Fecha:** AAAA-MM-DD
- **Estado:** Aceptada | Reemplazada por ADR-NNN
- **Decisión:** qué se decidió, en una o dos frases.
- **Contexto:** qué problema había.
- **Alternativas descartadas:** qué más se consideró y por qué no.
```

---

## ADR-001 — Next.js App Router con TypeScript estricto

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** Next.js 16 con App Router y TypeScript en modo `strict` más
  `noUncheckedIndexedAccess`. El scaffold inicial de Create Next App (Pages Router en
  JavaScript) se convirtió en el mismo repositorio.
- **Contexto:** Hacen falta rutas anidadas materia → tema → calculadora generadas desde datos,
  layouts compartidos y Server Components para no enviar el currículum completo al cliente. En
  código numérico, los `undefined` que se convierten en `NaN` son bugs silenciosos.
- **Alternativas descartadas:** _Vite + React Router_: no prerenderiza páginas estáticas sin
  configuración adicional y pierde SEO. _Astro_: buena opción para contenido, pero las
  calculadoras son muy interactivas y el equipo conoce mejor React/Next. _Pages Router_: modelo
  heredado y sin Server Components.

## ADR-002 — Sitio 100 % estático, sin backend

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `output: 'export'`. Todo el cálculo ocurre en el navegador. No hay base de
  datos, API ni autenticación.
- **Contexto:** Los cálculos son baratos y deterministas. Un sitio estático es gratis de
  hospedar, no se cae por carga, funciona con mala conexión una vez cargado y no maneja datos
  personales.
- **Alternativas descartadas:** _Servidor con API de cálculo_: agrega costo, latencia y un punto
  de falla sin ningún beneficio. _ISR/SSR_: no hay datos que cambien en tiempo de ejecución.

## ADR-003 — Contrato común con traza obligatoria; `solve()` nunca lanza

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** Toda calculadora implementa `Calculator<TInput, TValue, TErrorCode>`
  (`lib/calculators/types.ts`). `solve()` es una función pura y total. Devuelve un resultado
  discriminado `ok: true | false` que **siempre** incluye la traza (`steps`, `tables`,
  `series`, `notices`). Los errores son datos con un código tipado.
- **Contexto:** El producto es el procedimiento, no el número. Si cada calculadora devolviera
  su propia forma, habría que escribir UI a mano para cada una. Un fallo a mitad de camino (por
  ejemplo, derivada nula en la iteración 3) también debe mostrar los pasos previos.
- **Alternativas descartadas:** _Lanzar excepciones_: se pierde la traza parcial y obliga a
  usar `try/catch` en la UI. _Devolver JSX_: acopla la lógica a React y hace imposible
  probarla en Node. _Trazas opcionales_: en la práctica se omitirían.

## ADR-004 — El estado "implementada" se deriva del registro de UI

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `data/curriculum.ts` lista las calculadoras previstas y, opcionalmente,
  `inProgress: true`. Una calculadora está **implementada** si y solo si su id está en
  `components/calculators/registry.ts`. Ese registro también decide qué páginas de calculadora
  se generan.
- **Contexto:** Si el estado se escribiera a mano en el currículum, tarde o temprano diría
  "implementada" para algo que no existe, o al revés. Además, agregar una calculadora debía
  tocar el menor número de lugares posible.
- **Alternativas descartadas:** _Campo `status` manual_: se desincroniza. _Descubrimiento por
  convención de nombres de archivo_ (importación dinámica por plantilla de ruta): es frágil
  con el bundler y difícil de seguir.

## ADR-005 — KaTeX directo en lugar de `react-katex`

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `components/calculators/Formula.tsx` llama a `katex.renderToString` y no se
  usa ningún wrapper.
- **Contexto:** `react-katex` lleva años sin mantenimiento y no declara compatibilidad con
  React 19. El wrapper que hace falta es de unas 20 líneas.
- **Alternativas descartadas:** _react-katex_: dependencia abandonada. _MathJax_: más pesado y
  lento; el soporte extra de LaTeX que ofrece no se necesita. _better-react-mathjax_: mismo
  problema de peso.

## ADR-006 — Rutas de tres niveles y URL canónica única por calculadora

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `/[materia]/[tema]/[calculadora]/`. Cada calculadora se define en un solo tema;
  otros temas la referencian con `{ ref: id }` y enlazan a la URL canónica.
- **Contexto:** Un tema del pensum ("raíces de ecuaciones") agrupa varios métodos, así que tema
  y calculadora no pueden ser el mismo nivel. Además, varias materias comparten contenido: las
  distribuciones aparecen en Estadísticas I y en Inferencia, y las colas en Procesos
  Estocásticos y en Teoría de Colas.
- **Alternativas descartadas:** _Dos niveles (tema = calculadora)_: no refleja el pensum.
  _Duplicar calculadoras por materia_: dos URLs y dos implementaciones del mismo método.

## ADR-007 — Bibliografía normalizada con id y transcripción literal

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `data/bibliography.ts` tiene una entrada por obra, con un id estable
  (`chapra-canale-2000`). Los datos se transcriben **tal cual** del pensum, incluidas grafías
  dudosas ("Borovkor", "Willey"). Si la misma obra aparece con variaciones menores en dos
  materias, se registra una vez; si cambia el año, es otra entrada.
- **Contexto:** Las calculadoras deben citar el libro y varias materias comparten
  bibliografía. "Corregir" nombres sin tener el documento oficial sería inventar datos.
- **Alternativas descartadas:** _Texto libre por materia_: no permite citar desde las
  calculadoras. _Corregir grafías_: riesgo de corregir mal.

## ADR-008 — `docs/PENSUM.md` se genera desde el currículum

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `scripts/generate-pensum.ts` genera `PENSUM.md` (`pnpm docs:pensum`), y un test
  falla si el archivo commiteado no coincide con lo generado.
- **Contexto:** Un documento de estado mantenido a mano queda desactualizado en semanas.
- **Alternativas descartadas:** _Edición manual_: se desincroniza. _Generarlo solo en CI_: el
  documento en GitHub quedaría desactualizado.

## ADR-009 — TypeScript 6.0 (no 7.x) por ahora

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** Fijar `typescript@~6.0`.
- **Contexto:** `typescript-eslint` 8.x declara compatibilidad con TypeScript `<6.1`. Con 7.x,
  ESLint no puede analizar tipos de forma confiable.
- **Alternativas descartadas:** _TypeScript 7 ignorando el warning de peer_: riesgo de lint
  roto de forma silenciosa. Revisar cuando `typescript-eslint` soporte 7.x.

## ADR-010 — Los casos de prueba vienen de la bibliografía

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** Los valores esperados de los tests de cada calculadora provienen de ejemplos
  resueltos en la bibliografía del pensum (Chapra, Taha, Hillier, Walpole, etc.), citando libro,
  edición y ejemplo en un comentario. Los casos que no vienen de un libro (casos borde) se
  marcan como tales y explican cómo se verificó el valor.
- **Contexto:** Un resultado incorrecto le hace daño real a un estudiante. Un test cuyo valor
  esperado calculó la misma persona que escribió el código solo prueba que el código es
  consistente consigo mismo.
- **Alternativas descartadas:** _Valores calculados con el propio código o sin contraste_: no
  detectan errores conceptuales. _Solo comparar contra otro software_: útil como apoyo, pero el
  estudiante estudia con el libro.

## ADR-011 — Ediciones contra las que se verifican los tests

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** Los casos de prueba se verifican contra las ediciones que se pudieron consultar,
  y cada test indica la edición y la página: Chapra & Canale, 5.ª ed. en español (2007); Taha,
  7.ª ed. en español (2004); Walpole, Myers y Myers, 8.ª ed. en español (2007). Las citas de las
  calculadoras (`meta.citations`) usan el id de la obra del pensum y el `locator` aclara la
  edición.
- **Contexto:** El pensum cita otras ediciones (Chapra 3.ª ed., Walpole 6.ª ed.), que no están
  disponibles en línea. La numeración de los ejemplos de Chapra en la 5.ª ed. coincide con la
  que se usaba antes de verificar (ejemplos 5.3–5.5, 6.3, 6.5–6.7).
- **Alternativas descartadas:** _No citar la página_: el estudiante no encuentra el ejemplo.
  _Calcular los valores esperados sin fuente_: lo prohíbe ADR-010.

## ADR-012 — Formularios declarativos con `CalculatorForm`

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** Cada calculadora declara sus campos dentro de `<CalculatorForm calculator={…}>`.
  El componente maneja el estado, la validación con `inputSchema`, el ejemplo precargado y la
  llamada a `solve()`. Los campos (`NumberField`, `ExpressionField`, …) leen el formulario con
  `useFormContext`.
- **Contexto:** Con el piloto, cada calculadora repetía unas 60 líneas de `useForm`, registro de
  campos y conexión con el layout. Con cuatro métodos de raíces la repetición ya era evidente.
- **Alternativas descartadas:** _Generar el formulario desde el schema Zod_: los schemas no
  tienen etiquetas en LaTeX ni ayudas, y algunas entradas (matrices, listas de datos) necesitan
  controles propios. _Mantener el formulario a mano en cada calculadora_: repetición.

## ADR-013 — "Euler modificado" es el método de Heun sin iterar

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** La calculadora `euler-modificado` implementa el método de Heun con una sola
  aplicación del corrector (Chapra & Canale, sec. 25.2.1, columna "1 iteración" de la tabla 25.2).
- **Contexto:** El pensum de Métodos Numéricos lista "Euler modificado" y, por separado,
  "predictor-corrector". En la bibliografía el nombre es ambiguo: algunos textos llaman así al
  método de Heun y otros al del punto medio (polígono mejorado, Chapra 25.2.2). Heun es el que
  más se enseña con ese nombre en cursos en español, y el título de la calculadora lo aclara
  ("Método de Euler modificado (Heun)").
- **Alternativas descartadas:** _Punto medio_: menos usado con ese nombre. _Heun iterado_:
  corresponde mejor a la calculadora `predictor-corrector`, que sigue en el roadmap.

## ADR-014 — Test global contra caracteres de control en el LaTeX

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `lib/calculators/contract.test.ts` resuelve el ejemplo de cada calculadora y falla
  si algún texto del resultado contiene caracteres de control (U+0000 a U+001F).
- **Contexto:** En un string de JavaScript, `"egin"` o `"rac"` sin doble barra se
  convierten en backspace o salto de página, y KaTeX los muestra como □. Pasó con
  `toLatexMatrix`, y su test unitario no lo detectó porque el valor esperado tenía el mismo
  error. Un chequeo independiente del valor esperado cubre todas las calculadoras, las actuales
  y las futuras.
- **Alternativas descartadas:** _Confiar en los tests unitarios_: comparten el error con el
  código. _Revisar a ojo_: el carácter es invisible en el editor.

## ADR-015 — Versionado semántico con tags de git y CHANGELOG

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** Las versiones siguen SemVer. `package.json` es la fuente de verdad del número;
  cada versión publicada lleva un tag anotado `vX.Y.Z` sobre `main` y una entrada en
  `CHANGELOG.md` (formato Keep a Changelog). El pie de página muestra la versión leyendo
  `package.json` en tiempo de build. Mientras la versión sea `0.y.z`: una tanda de calculadoras
  o una funcionalidad nueva sube el _minor_; las correcciones suben el _patch_.
- **Contexto:** Con cuatro tandas de calculadoras y las páginas legales, el sitio ya es usable y
  hace falta poder decir qué versión tiene un estudiante cuando reporta un resultado incorrecto.
- **Alternativas descartadas:** _Versionado por fecha (CalVer)_: no comunica si un cambio rompe
  algo. _Herramientas de release automáticas (changesets, semantic-release)_: demasiado para un
  proyecto de este tamaño; se puede reconsiderar si crecen los colaboradores.

## ADR-016 — Páginas legales como rutas estáticas en un grupo `(legal)`

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** Aviso legal, privacidad, datos y cookies viven en `app/(legal)/<slug>/page.tsx`
  y comparten la plantilla `components/layout/LegalPage.tsx`. La lista de documentos está en
  `data/legal.ts` y de ahí salen el pie de página y los enlaces cruzados.
- **Contexto:** Las URL legales (`/privacidad/`, `/cookies/`…) comparten el primer nivel con
  `/[materia]/`. Next prioriza las rutas estáticas, pero una materia con el mismo slug quedaría
  inaccesible; `data/legal.test.ts` lo impide. Como el sitio no usa cookies ni analítica
  (ADR-002), no hay banner de consentimiento.
- **Alternativas descartadas:** _Prefijo `/legal/…`_: URL más largas que las convencionales para
  estas páginas. _Textos en Markdown_: añadiría un pipeline de MDX para cuatro páginas.

## ADR-017 — Modelos de Operaciones I y II: temas por unidad y ediciones verificadas

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** Las dos materias se agregan con un tema por unidad del programa. Como el modelo
  no tiene bibliografía por tema, la de cada materia es la unión de la general y la de sus
  unidades. Lo que ya estaba definido en otra materia se refiere con `{ ref }`: los modelos de
  colas (Teoría de Colas), la optimización clásica y Lagrange (Programación No Lineal) y la
  tendencia y la regresión (Estadísticas II). Los casos de prueba se verificaron contra las
  ediciones que se pudieron consultar, y cada test lo indica: Hillier & Lieberman 7.ª ed. en
  inglés (2001; juegos e inventarios), 8.ª (2005; cap. 22, PERT/CPM) y 9.ª (2010; cap. 10,
  programación dinámica); Taha 8.ª ed. en inglés (2007; cap. 10) y los datos de la 9.ª (2011)
  según su «R Textbook Companion» (FOSSEE); Anderson, Sweeney y Williams, ejemplo de las ventas
  de gasolina en ediciones recientes (la de 1993 que cita el pensum no está disponible).
- **Contexto:** El mantenedor entregó los programas completos (objetivos, contenidos y
  bibliografía por unidad). Varias unidades repiten contenido de electivas ya modeladas.
- **Alternativas descartadas:** _Duplicar las calculadoras de colas y de programación no lineal
  en las nuevas materias_: dos URLs y dos implementaciones del mismo método (ADR-006).
  _Agregar bibliografía por tema al modelo_: cambio de tipos sin uso en la UI todavía.

## ADR-018 — Tablas de filas, matrices rectangulares y gráficas con varias líneas

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `components/calculators/form/TableField.tsx` (con `useFieldArray`) edita listas
  de filas con varias columnas: actividades de un proyecto, arcos de una red, artículos o niveles
  de precio. `RectangularMatrixField` edita matrices m × n (matrices de pagos). `Series.others`
  agrega líneas delgadas a una gráfica, y la leyenda pasa a ser una lista HTML debajo de la
  gráfica.
- **Contexto:** PERT-CPM, programación dinámica e inventarios necesitan filas con columnas de
  distinto tipo; los juegos, matrices que no son cuadradas; el método gráfico y el comportamiento
  de los costos de inventario, varias rectas o curvas en la misma gráfica. La leyenda de Recharts
  dentro del SVG tapaba las curvas cuando ocupaba dos renglones en móvil.
- **Alternativas descartadas:** _Un área de texto con un formato por línea (`H; E, G; 9`)_: fácil
  de escribir mal y difícil de corregir en el teléfono. _Una gráfica por recta_: se pierde la
  comparación, que es el punto del método gráfico. _Reutilizar `reference`_: admite una sola
  serie.

## ADR-019 — Estrategias mixtas por el método gráfico; PERT con la ruta de mayor varianza

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `estrategias-mixtas` elimina estrategias dominadas (si dos son idénticas, la
  segunda), busca un punto de silla y, si a un jugador le quedan dos estrategias, usa el método
  gráfico. La estrategia del oponente combina las dos rectas que forman la envolvente a cada lado
  del óptimo (la de mayor pendiente positiva y la de menor pendiente negativa), como en Hillier y
  en el ejemplo 13.4-3 de Taha; si pasan más rectas por el óptimo se avisa que hay óptimos
  alternativos. Los juegos que siguen siendo mayores que 2 × n y m × 2 devuelven `too-large` y
  quedan para la calculadora de juegos por programación lineal. En PERT, si hay varias rutas
  críticas medias, la varianza del proyecto se toma de la de mayor varianza y se avisa.
- **Contexto:** Todavía no hay un simplex en `lib/`, y el método gráfico es el que se enseña
  primero. Con rutas críticas empatadas los libros no fijan un criterio; la de mayor varianza da
  la probabilidad más conservadora.
- **Alternativas descartadas:** _Resolver todo juego con un simplex propio en esta tanda_: es el
  mismo trabajo que las calculadoras de Optimización de Operaciones, que siguen en el roadmap.
  _Promediar las varianzas de las rutas empatadas_: no tiene respaldo en la bibliografía.

## ADR-020 — Programación lineal con fracciones exactas y M simbólica

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** Las calculadoras de Optimización de Operaciones (simplex, M grande, dos fases,
  dual, dual simplex, sensibilidad, transporte, asignación y ramificación y acotamiento) y la de
  juegos por programación lineal calculan con `Rational` (`lib/math/rational.ts`, numerador y
  denominador `bigint`). La M grande es simbólica: cada coeficiente es `a + bM` (`MValue`) y se
  compara primero el coeficiente de M. Las tablas siguen la convención de Taha: el renglón z
  guarda −c, en maximización entra la más negativa y en minimización la más positiva, sale la de
  menor razón y los empates se rompen por el menor índice. El modelo se escribe como texto
  (`5x1 + 4x2`, una restricción por línea con `<=`, `>=` o `=`) y el formulario muestra cómo se
  leyó.
- **Contexto:** Con coma flotante, 1/3 aparece como 0.333333 y las pruebas de optimalidad («¿es
  cero?») dependen de una tolerancia. Los libros muestran fracciones exactas, y con un valor
  numérico grande para M los renglones z de Taha (−4 + 7M) se vuelven ilegibles. Las tablas
  simplex tienen un número variable de variables y restricciones, que en el teléfono se escribe
  mejor como texto que como una grilla.
- **Alternativas descartadas:** _mathjs con `fraction`_: no maneja la M simbólica y agrega
  conversiones en cada operación. _M = 10⁶ numérica_: los pasos no coinciden con el libro y
  puede elegir mal la variable que entra. _Una grilla de coeficientes_: más difícil de editar en
  móvil y no muestra el modelo tal como se escribe en clase.

## ADR-021 — Región sombreada en las gráficas y tabla de transporte editable

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `Series.region` dibuja un área entre una curva inferior y una superior (la
  región factible del método gráfico) debajo de las demás líneas. `TransportTableField` edita en
  una sola tabla los costos, la oferta (última columna) y la demanda (última fila), y avisa si el
  problema no está balanceado. `firstErrorMessage` muestra el primer error de una celda en los
  campos de matriz.
- **Contexto:** El método gráfico necesita ver la región y las rectas a la vez. La tabla de
  transporte de Taha junta las tres cosas; en tres campos separados es fácil que no coincidan
  los tamaños.
- **Alternativas descartadas:** _Polígono SVG propio_: duplicaría ejes y escalas de Recharts.
  _Tres campos (matriz y dos vectores)_: el estudiante copia la tabla del libro tal como la ve.

## ADR-022 — Lógica proposicional con lector propio y leyes reconocidas por esquemas

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** `lib/calculators/logica-formal-y-algoritmos/proposition.ts` lee proposiciones
  con un analizador de precedencia (¬, ∧, ∨ y ⊕, →, ↔; el condicional asocia a la derecha), con
  símbolos Unicode y alternativas de teclado (`~`, `&`, `|`, `v`, `->`, `<->`). Las tablas listan
  las filas de todas V a todas F. Las leyes de equivalencia y las reglas de inferencia del
  programa (De Morgan, implicación, modus ponens, modus tollens, silogismos, falacias clásicas) se
  reconocen encajando la entrada en esquemas escritos como texto; las premisas se prueban en
  cualquier orden. Los algoritmos de búsqueda y ordenamiento usan arreglos desde 1 y
  pseudocódigo en español, como Tucker y Joyanes.
- **Contexto:** mathjs no tiene conectores lógicos con esta notación. La tabla de verdad decide
  la equivalencia y la validez, pero nombrar la ley es lo que conecta el resultado con la clase.
- **Alternativas descartadas:** _Evaluar con `eval` o mathjs usando `and`/`or`_: no admite `→`
  ni `↔` y mostraría otra notación. _Reconocer leyes comparando tablas_: dos leyes distintas
  tienen la misma tabla; el esquema identifica la forma.

## ADR-023 — Logo de la UDO como ícono y en el encabezado

- **Fecha:** 2026-09-25
- **Estado:** Aceptada
- **Decisión:** El logo de la Universidad de Oriente (`public/Logo_UDO.svg.webp`, original) se
  usa como ícono del sitio (`app/icon.png` de 192 px y `app/apple-icon.png` de 180 px, generados
  desde el original), junto al nombre en el encabezado y en el README (`public/logo-udo.webp`,
  256 px). Se eliminó `public/favicon.ico`. Las prelaciones con materias de otras ramas muestran
  el nombre de la materia (`externalSubjects` en `data/curriculum.ts`).
- **Contexto:** El mantenedor pidió usar el logo de la universidad en la app y en el README.
  El aviso legal aclara que el proyecto no es un sitio oficial de la UDO.
- **Alternativas descartadas:** _Servir el original de 332 KB en cada página_: pesa dieciséis veces
  más que la versión de 256 px. _Mantener el `favicon.ico` de Next_: no identifica el sitio.

## ADR-024 — Estadísticas I e Inferencia verificadas contra Walpole, 9.ª ed. en español

- **Fecha:** 2026-09-28
- **Estado:** Aceptada
- **Decisión:** Los casos de prueba de las calculadoras nuevas de Estadísticas I e Inferencia se
  verificaron contra Walpole, Myers, Myers y Ye, 9.ª ed. en español (Pearson, 2012), la edición
  que se pudo consultar para los capítulos 1, 2 y 4 a 9. Cada test cita el ejemplo y la página de
  esa edición, y los `locator` de las calculadoras dicen "9.ª ed. en español". Los tests
  anteriores (binomial, Poisson, normal y medidas descriptivas) conservan la numeración de la 8.ª
  (ADR-011). La distribución muestral usa el problema de Spiegel (Schaum) de la población 2, 3,
  6, 8, 11. Si el resultado impreso no se lee en la copia consultada (ejemplos 2.18, 2.23 y 5.7) o
  el libro no trae un ejemplo numérico (beta, geométrica, Poisson en máxima verosimilitud), el
  valor se verifica con la fórmula del libro o analíticamente, y el test lo dice.
- **Contexto:** La numeración cambia entre ediciones: el ejemplo de los 15 pacientes es el 5.5
  en la 8.ª (según los tests existentes) y el 5.2 en la 9.ª. Citar un número sin verificarlo
  manda al estudiante a otro ejemplo.
- **Alternativas descartadas:** _Citar la numeración de la 8.ª sin haberla consultado_: podría
  ser falsa. _Renumerar los tests anteriores_: ya estaban verificados contra la 8.ª y no hay
  motivo para cambiarlos.

## ADR-025 — Distribuciones continuas con funciones especiales e integración adaptativa

- **Fecha:** 2026-09-28
- **Estado:** Aceptada
- **Decisión:** `lib/calculators/estadistica-1/continuous.ts` es el núcleo de las distribuciones
  continuas, como `discrete.ts` para las discretas: cada modelo da f, F, sus fórmulas y su
  sustitución, y el núcleo arma los pasos, P(X < x), P(X > x) o P(a < X < b) y la gráfica. F se
  calcula con funciones especiales (`lib/math/special.ts`: ln Γ de Lanczos y las funciones gamma
  y beta incompletas regularizadas de Numerical Recipes), no interpolando tablas. La esperanza de
  una densidad escrita por el estudiante se integra con Gauss-Kronrod 7-15 adaptativo
  (`lib/math/quadrature.ts`), que admite límites infinitos y detecta integrales divergentes (una
  media o una varianza que no existen). Las probabilidades que se escriben en tablas (Bayes,
  multinomial, esperanza discreta) son texto y aceptan fracciones (`parseFraction`).
- **Contexto:** Walpole lee la gamma incompleta de la tabla A.23, que solo tiene α enteros y
  pocas cifras. mathjs no trae las funciones incompletas y su `lgamma` tiene errores de ~10⁻¹²,
  que se notan en la beta. Los libros dan probabilidades como 2/9 o 12/35, y 1/3 escrito en
  decimales no suma exactamente 1.
- **Alternativas descartadas:** _Integrar la densidad para obtener F_: más lento y menos preciso
  en las colas. _Simpson compuesto para la esperanza_: no admite límites infinitos ni
  singularidades en los extremos. _Agregar jStat u otra dependencia_: mucho peso por cuatro
  funciones. _Campos numéricos con decimales para las probabilidades_: obligan a redondear.

## ADR-026 — Simplex algebraico y análisis post-óptimo sobre el motor de tablas

- **Fecha:** 2026-09-28
- **Estado:** Aceptada
- **Decisión:** El simplex algebraico usa el mismo motor que el tabular (`runSimplex`) y solo
  cambia la presentación: las básicas y z se escriben en función de las no básicas, la razón
  mínima se expresa como desigualdades y se enumeran las soluciones básicas cuando son pocas
  (C(n, m) ≤ 84). El análisis post-óptimo (`cambios-en-el-modelo`) parte de la tabla óptima con
  holguras, de la que lee B⁻¹ y los precios duales, y continúa con el simplex primal o con el dual
  simplex, que pasó a `tableau.ts` (`runDualSimplex`). Si cambia la columna de una variable
  básica, el modelo se resuelve de nuevo, como indica Taha. Los casos de prueba se verificaron
  contra Taha, 10.ª ed. en inglés (2017), sec. 3.2, 3.3.1 y 4.5; los ejemplos 4.5-1 a 4.5-4 son
  los mismos en la 9.ª ed. (R Textbook Companion de FOSSEE).
- **Contexto:** Faltaban las dos calculadoras de Optimización de Operaciones del programa (simplex
  algebraico; cambios en coeficientes tecnológicos, variables y restricciones). Duplicar las
  reglas del simplex permitiría que el algebraico y el tabular dieran resultados distintos.
- **Alternativas descartadas:** _Un simplex algebraico con su propio pivoteo_: dos
  implementaciones de las mismas reglas. _Actualizar B⁻¹ cuando cambia una columna básica_ (forma
  producto de la inversa): fuera del alcance del curso y del libro.

## ADR-027 — Buscador con índice estático cargado bajo demanda

- **Fecha:** 2026-09-28
- **Estado:** Aceptada
- **Decisión:** `lib/search.ts` arma el índice desde el currículum (una entrada por calculadora,
  con URL solo si está implementada) y busca sin tildes ni mayúsculas: cada palabra debe
  aparecer en el título, el resumen, el id, el tema, la materia o la descripción del tema, con
  más peso en el título. Si hay coincidencias directas, se descartan las que solo aparecen en la
  descripción del tema. El índice se genera en el build como `/indice-de-busqueda.json` (ruta con
  `dynamic = 'force-static'`) y el navegador lo descarga la primera vez que se usa el buscador.
  La interfaz es una caja en el inicio y un `<dialog>` nativo en el encabezado (Ctrl/⌘ + K o
  «/»), con resultados que son enlaces.
- **Contexto:** Con 76 calculadoras implementadas (133 en el currículum), buscar por materia y
  tema es lento, sobre todo si el estudiante no sabe en qué materia está un método. El sitio es estático (ADR-002), así que la
  búsqueda ocurre en el navegador.
- **Alternativas descartadas:** _Pasar el índice como prop en cada página_: agrega ~60 KB al HTML
  de todas las páginas aunque nadie busque. _Una librería de búsqueda difusa_: más peso por un
  índice pequeño. _Un combobox ARIA con `aria-activedescendant`_: los enlaces enfocables son más
  simples, funcionan con lectores de pantalla y permiten abrir en otra pestaña.
