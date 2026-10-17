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

## ADR-028 — Métodos Numéricos completos: casos de Chapra y núcleos compartidos

- **Fecha:** 2026-09-30
- **Estado:** Aceptada
- **Decisión:** Las 16 calculadoras que faltaban de Métodos Numéricos se verifican contra Chapra &
  Canale, 5.ª ed. en español, y cada test cita el ejemplo (3.1, 3.2, 4.1, 4.2, 4.4, 6.11, 7.1,
  7.3, 9.2, 9.3, 9.5, 9.9, 10.3, 14.3, 14.4, 17.1, 17.2, 17.5, 18.1 a 18.3, 23.1, 25.2 y 26.2) o el
  cuadro (PT3.2 y 9.1). La numeración se contrastó con la copia en línea de esa edición. Cuando el
  libro no trae un ejemplo numérico (tabla de diferencias hacia adelante, métodos multipaso,
  coeficientes indeterminados), el valor esperado se verifica analíticamente y el test lo dice:
  por ejemplo, Adams-Bashforth de 4 pasos es exacto si f es un cúbico en x, así que debe reproducir
  los valores verdaderos de la tabla 25.1. Núcleos nuevos: `matrix.ts` (eliminación hacia adelante
  con la traza de cada operación de fila, sustitución hacia atrás y determinante),
  `polynomial.ts` (coeficientes, división sintética, esquema de Ruffini) y `differences.ts`
  (listas de puntos, diferencias hacia adelante y divididas). `ode.ts` acepta una fábrica de
  reglas con estado (`OdeRuleFactory`) para los métodos multipaso y el predictor-corrector, y
  campos propios (`odeShape` + `refineOde`). El predictor-corrector itera el corrector hasta la
  tolerancia (con una iteración y el predictor de Euler coincide con `euler-modificado`, ADR-013);
  los métodos multipaso aplican el corrector una sola vez por paso. El descenso más rápido obtiene
  el paso óptimo con Newton sobre g′(h) (exacto en un paso si f es cuadrática, como en el
  ejemplo 14.4) y, si no sirve, con la sección dorada. Los coeficientes indeterminados se resuelven
  con fracciones exactas (`Rational`) para mostrar 1/3 y 4/3 como en el libro.
- **Contexto:** El pensum lista 26 calculadoras de la materia y solo 10 estaban implementadas. Los
  datos de algunos ejemplos se imprimen con menos cifras de las que el libro usa para calcular
  (ln x con 6 decimales en el ejemplo 18.3; el error estándar 0.77345 redondeado a 0.7735): los
  tests usan la precisión impresa y lo explican.
- **Alternativas descartadas:** _Simular aritmética de k cifras para reproducir el 7.00003 del
  ejemplo 9.5_: el redondeo intermedio del libro no se puede reconstruir con certeza. _Citar
  números de ejemplos sin contrastarlos_: la numeración cambia entre ediciones (el ejemplo de
  Bairstow es el 7.3 en esta edición y otro número en otras).

## ADR-029 — Estadísticas II: distribuciones de muestreo calculadas y pruebas exactas

- **Fecha:** 2026-09-30
- **Estado:** Aceptada
- **Decisión:** `lib/math/distributions.ts` calcula la densidad, la función de distribución y los
  cuantiles de t, ji-cuadrada y F con las funciones gamma y beta incompletas (ADR-025); sus tests
  comparan con las tablas A.4 a A.6 de Walpole. `estadistica-2/hypothesis.ts` es el núcleo de las
  pruebas: región crítica con la notación del libro (valores críticos por el área a su derecha),
  valor P, decisión y la gráfica de la densidad con la región de rechazo sombreada. Las pruebas de
  rangos (signo, rangos con signo, Mann-Whitney) usan la distribución exacta del estadístico
  (hasta n = 50 y n₁, n₂ ≤ 30), de la que salen los valores críticos de las tablas A.16 y A.17;
  con muestras mayores, la aproximación normal. La bondad de ajuste combina las celdas con
  frecuencia esperada menor que 5, como Walpole. Las series de tiempo usan la descomposición
  multiplicativa (promedios móviles centrados, índices ajustados para sumar L, tendencia de la
  serie desestacionalizada). Los casos de prueba vienen de Walpole, Myers, Myers y Ye, 9.ª ed.
  (caps. 10, 11 y 16, identificados por sus datos) y, para series de tiempo, de Anderson, Sweeney
  y Williams (ventas de bicicletas y de televisores), contrastados con ediciones recientes como en
  los pronósticos de Modelos de Operaciones II.
- **Contexto:** La bibliografía de Estadísticas II (Canavos, Meyer) no se pudo consultar ni trae
  series de tiempo; Walpole está en la bibliografía de Estadísticas I y Anderson en la de Modelos
  de Operaciones II. El libro lee z, t, χ² y F de tablas con 2 o 3 decimales (en el capítulo 11
  usa t₀.₀₂₅ = 2.045 con 31 grados de libertad, cuyo valor exacto es 2.0395), así que los tests
  comparan con la precisión impresa y lo explican.
- **Alternativas descartadas:** _Guardar las tablas del libro_: solo cubren algunos α y grados de
  libertad. _Aproximación normal siempre en las pruebas de rangos_: con muestras pequeñas no da los
  valores críticos de las tablas (w = 8 para n = 10, u = 17 para 8 y 10).

## ADR-030 — Puntos sueltos en las gráficas

- **Fecha:** 2026-09-30
- **Estado:** Aceptada
- **Decisión:** `Series.scatter` dibuja puntos sin unir junto a la serie principal (una `Line` sin
  trazo y con marcadores, que no dibuja nada en las filas sin dato). Lo usan la regresión, la
  correlación, la interpolación y los mínimos cuadrados para mostrar los datos junto a la curva.
- **Contexto:** Con `reference` los datos quedaban unidos por una línea punteada ordenada por x,
  que sugiere una curva que no existe.
- **Alternativas descartadas:** _El componente `Scatter` de Recharts dentro de la gráfica
  compuesta_: comparte el arreglo de filas con la curva y habría que filtrar las filas sin dato.

## ADR-031 — Electivas y Modelos de Operaciones completos: ediciones consultadas y núcleos nuevos

- **Fecha:** 2026-09-30
- **Estado:** Aceptada
- **Decisión:** Las 28 calculadoras que faltaban de Teoría de Colas, Procesos Estocásticos,
  Programación No Lineal y Modelos de Operaciones I y II se verifican contra las ediciones que se
  pudieron consultar, y cada test lo dice: Taha, 10.ª ed. en inglés (2017; caps. 12 y 17 a 21);
  Hillier & Lieberman, 7.ª ed. en inglés (2001, la edición del pensum; caps. 10, 13, 16 y 17 y
  apéndice 2); Winston, 4.ª ed. (2004; cap. 20); Anderson, Sweeney, Williams, Camm y Martin,
  13.ª ed. (2012; caps. 10, 11 y 15), y Chase, Jacobs y Aquilano, 12.ª ed. en español (2009;
  caps. 17 y 18), con la numeración de la 15.ª en el `locator`. La programación geométrica usa la
  caja de grava de Duffin, Peterson y Zener porque Rao (bibliografía de la materia) no se pudo
  consultar. Núcleos nuevos: `teoria-de-colas/queueing.ts` (`mmsMeasures`) y `networks.ts`
  (estaciones M/M/s de las redes); `programacion-no-lineal/nlp.ts` (funciones de x1 … x6,
  gradiente y hessiana simbólicos, menores principales, Newton para sistemas, restricciones como
  texto) y `restricted-simplex.ts` (simplex con base restringida sobre el motor de tablas de
  ADR-020, usado por Wolfe y la programación separable). `lib/math/expression.ts` exporta
  `expressionFromNode` para usar derivadas de mathjs sin volver a pasar por el lector (que rechaza
  `log`). PERT-Costos acorta una unidad a la vez eligiendo el corte mínimo de vértices de la subred
  crítica (flujo máximo), que equivale al conjunto de actividades más barato que acorta todas las
  rutas críticas. Las colas con prioridad e interrupción con varios servidores siguen el
  procedimiento iterativo de Hillier (las clases 1 … k como un M/M/s). SUMT arma ∇P y ∇²P con las
  derivadas de f y de cada restricción calculadas una sola vez.
- **Contexto:** El pensum lista estas calculadoras desde la Tanda 5 y seguían en el roadmap. Varios
  ejemplos tienen valores impresos que no coinciden con el cálculo exacto, y los tests lo explican
  en vez de forzar el resultado: Hillier imprime 0.889 y 1.033 para la clase 3 del hospital con un
  médico (la ley de conservación del M/M/1 exige 0.909 y 1.030); Taha anota «R» en la etapa 3 del
  reemplazo de equipo con t = 5, donde conservar da el f₃(5) = 17.0 que el propio libro reporta;
  TORA y las tablas de Winston, Chase y Hillier redondean pasos intermedios (Lq = 7.47 con
  P(j ≥ 3) = .83 de la tabla; el valor exacto es 7.35).
- **Alternativas descartadas:** _Copiar los valores impresos sin revisarlos_: la calculadora
  coincidiría con una errata. _Derivar simbólicamente la función barrera completa en cada r_:
  tardaba casi 2 s con el ejemplo del libro. _Enumerar todas las rutas para elegir qué comprimir_:
  crece exponencialmente con la red; la tabla de longitudes de rutas solo se muestra si son pocas.

## ADR-032 — Teoría de Sobrevivencia: métodos publicados, sin la metodología de Bórean

- **Fecha:** 2026-09-30
- **Estado:** Aceptada
- **Decisión:** De Teoría de Sobrevivencia se implementan el estimador de Kaplan-Meier (con el
  error de Greenwood) y la tabla de sobrevivencia y fallas con los criterios de censura de Elisa
  Lee (actuarial, n′ = n − w/2) y de Kaplan-Meier (n′ = n). Sus casos de prueba vienen de ejemplos
  clásicos con resultados publicados: el grupo 6-MP de Freireich et al. (1963) y la tabla de vida
  de Lee (1992) con la salida de PROC LIFETEST de la documentación de SAS. «Nivel crítico del
  sistema» y «LED Markoviano» quedan en el roadmap, igual que el criterio de censura de Bórean.
- **Contexto:** Toda la bibliografía de la materia son trabajos de ascenso y de grado de la UDO y
  la UGMA (Bórean, Ganuza, Solórzano, Padra) que no están publicados en línea. Kaplan-Meier y la
  tabla de vida son métodos estándar de la literatura; el nivel crítico, el factor α del LED
  Markoviano y el criterio de Bórean son propios de esos trabajos.
- **Alternativas descartadas:** _Reconstruir el nivel crítico o el LED Markoviano a partir del
  nombre_: sería inventar un método (CLAUDE.md). _Citar la página de un trabajo no consultado_: se
  cita la obra del pensum sin página, y los tests nombran la fuente real de los valores.

## ADR-033 — Circuitos y Sistemas: motor MNA y constructor interactivo por tema

- **Fecha:** 2026-10-09
- **Estado:** Aceptada
- **Decisión:** El análisis de circuitos se resuelve con **Análisis de Nodos Modificado (MNA)**
  presentado como el método de inspección KCL que enseñan Hayt y Dorf. El constructor SVG emite un
  `CircuitDocument` serializable (netlist) que es la entrada `TInput` de cada calculadora. Las
  mallas se obtienen como las **caras acotadas del embebido planar** del dibujo (recorrido de
  half-edges con adyacencias ordenadas por ángulo), por lo que el análisis de mallas solo está
  disponible cuando el circuito se dibuja sin cruces. El constructor se embebe como campo
  personalizado por materia (`CircuitBuilderField`) dentro de cada página de calculadora, con un
  ejemplo precargado por tema.
- **Contexto:** Se necesita una UI interactiva para armar circuitos y calcular por tema (Unidad II
  del pensum). MNA es el método de todos los simuladores tipo SPICE, extiende fácilmente a fuentes
  dependientes y permite presentar la matriz de nodos "por inspección" que coincide con el
  procedimiento en cuaderno. La eliminación de esa matriz reutiliza el núcleo
  `metodos-numericos/matrix.ts`, que ya muestra cada operación de fila. Resolver el sistema con MNA
  mantiene `solve()` pura y total, y devuelve la traza completa (`steps`, `tables`, `series`).
- **Alternativas descartadas:** _Simulación numérica tipo Falstad_: es un simulador, no muestra el
  procedimiento paso a paso. _Análisis de mallas general sin planaridad_: requiere bases de ciclos
  del grafo, no corresponde a las "ventanas abiertas" del libro. _Una sola página de "laboratorio
  de circuitos"_: rompe la estructura de rutas generadas desde el currículum y dificulta buscar
  cada tema. _Sparse Tableau Analysis_: más general que MNA pero produce sistemas más grandes y
  una traza menos directa para el estudiante.
- **Actualización (2026-10-12):** se afinó el editor tras contrastar su interacción con el
  simulador CRF (`crf-circuit-simulator.vercel.app`, HTML + canvas + jQuery). El
  `CircuitBuilderField` ahora ofrece una paleta de herramientas con **colocación por clic** (previa
  fantasma que sigue al puntero y se **imanta** a los nodos, `R` para girar, `Esc` para cancelar),
  **arrastre** de componentes y de **extremos** (terminales y vértices de cable, con
  `orthogonalize` para mantener los cables ortogonales), **codos** que se agregan y quitan con doble
  clic, **paneo/zoom** (rueda sobre el cursor, botón central/derecho, `Espacio`+arrastrar, pinza
  táctil, botones de zoom y **ajustar al circuito**), **selección múltiple** (`Shift`+clic para
  alternar, recuadro con `Shift`+arrastrar, `Ctrl+A`) con **borrado, duplicado (`Ctrl+D`) y arrastre
  en grupo**, **voltear polaridad** (`F`), **mover con flechas**, **deshacer/rehacer**, **prevención
  de solapes** y un **modo de simulación** (`K`) que resuelve el circuito por MNA, **anima la
  corriente** por cada rama y muestra una **tabla de resultados en vivo** (corriente, potencia,
  absorbe/entrega y balance de potencias). Bajo el lienzo hay un panel de **instrucciones
  detalladas** con secciones y la lista de atajos. Los símbolos se dibujan con trazo
  `non-scaling-stroke` y las etiquetas se rotan a lo largo de los componentes verticales. La entrada
  de la calculadora es un único campo `circuit` (`z.object({ circuit: circuitDocumentSchema })`) para
  que el editor sea un campo del formulario y comparta estado con el ejemplo precargado; el ejemplo
  de Análisis de nodos es un divisor de corriente (1 mA sobre 1 kΩ ∥ 2 kΩ) verificado por balance de
  potencias.
- **Análisis de mallas (2026-10-12):** implementado sobre el mismo editor. Las mallas son las caras
  acotadas del embebido planar (recorrido de semiaristas con las aristas ordenadas por ángulo en
  cada vértice). Cada malla recibe una corriente en el sentido de su recorrido y se escribe su KVL;
  las resistencias compartidas usan la diferencia de corrientes. Las **fuentes de corriente** se
  tratan agregando su tensión como incógnita y su ecuación de corriente (equivalente a la
  supermalla), de modo que el sistema sigue siendo cuadrado. Se validan los casos no aplicables:
  circuito vacío o desconexo, sin mallas, rama colgante (puente) y malla formada solo por cables.
  Los tests contrastan las corrientes de rama con las del análisis nodal del mismo circuito.
- **Teoremas (2026-10-12):** tres calculadoras más sobre el motor MNA. **Superposición** resuelve el
  circuito una vez por fuente (las demás en 0 V/0 A, sin cambiar la topología) y suma rama por rama;
  se advierte que no aplica a la potencia. **Thévenin/Norton** elige una resistencia de carga, mide
  `V_th` en circuito abierto (quitando la carga) y `R_th` con las fuentes apagadas y una fuente de
  prueba de 1 A; de ahí `I_N = V_th/R_th`. **Máxima transferencia de potencia** reutiliza el
  equivalente y muestra `R_L = R_th`, `P_máx = V_th²/(4R_th)` y la curva `P_L(R_L)`. El selector de
  carga (`LoadSelectField`) lee el circuito del formulario y lista sus componentes.

## ADR-034 — Circuitos y Sistemas completo: núcleo de señales y transformadas, y C/L en el constructor

- **Fecha:** 2026-10-14
- **Estado:** Aceptada
- **Decisión:** Las diez calculadoras que faltaban de Circuitos y Sistemas (Unidades III a VI) se
  apoyan en núcleos nuevos, en vez de resolver cada una por su lado:
  - `lib/math/complex.ts` (complejos con la unidad `j` de los libros de circuitos, forma
    rectangular y polar) y `lib/math/polynomials.ts` (aritmética, división larga, desarrollo de
    Taylor alrededor de un punto complejo, raíces con multiplicidad y simplificación de N/D).
    Las raíces separan primero los factores repetidos con el algoritmo de Yun en aritmética
    racional exacta cuando los coeficientes son decimales limpios (la multiplicidad sale exacta)
    y resuelven cada factor con Aberth-Ehrlich; si hay ruido de coma flotante, agrupan raíces
    casi iguales y las pulen con Newton sobre la derivada correspondiente.
  - `circuitos-y-sistemas/signal.ts`: las señales de la tabla (constantes, tⁿ, exponenciales,
    senos y cosenos, senos hiperbólicos, aᵗ, escalones u(t − a) e impulsos δ(t − a)) se leen del
    árbol de mathjs como sumas de términos c·tⁿ·e^{αt}·u(t − a) con c y α complejos. La familia es
    cerrada bajo suma, producto y desplazamiento, así que Laplace (variable t) y Z (variable k)
    transforman término a término sin un motor simbólico general.
  - `laplace.ts` (transformada por grupos de retardo e^{−as}·F_a(s), lectura de F(s) con
    polinomios, cocientes, potencias y retardos), `partial-fractions.ts` (residuos por división
    de series de Taylor: polos reales, complejos y repetidos), `laplace-inverse.ts` (la traza del
    método de residuos, compartida por la inversa, las EDO, la convolución y las ecuaciones de
    estado) y `z-transform.ts` (pares Z con números de Stirling y la inversa por X(z)/z, como Kuo).
  - `state-space.ts`: árbol normal (V, C, R, L, I), cortes y lazos fundamentales, detección de
    redes impropias y formulación de A y B **sustituyendo** cada capacitor por una fuente de
    voltaje y cada inductor por una fuente de corriente sobre el motor MNA (superposición con una
    variable en 1 y las demás en 0). La solución usa Laplace con Faddeev-LeVerrier para
    adj(sI − A) y det(sI − A).
- **Constructor:** `CircuitBuilderField` recibe `kinds` (la paleta de cada calculadora); los
  capacitores e inductores solo aparecen en **Ecuaciones de estado**, con símbolo propio (+ en el
  terminal de referencia de v_C y flecha del sentido de i_L) y **valor inicial** editable
  (`CircuitComponent.initial`). Las calculadoras de cd rechazan C y L con el código
  `elementos-almacenadores`, y la simulación en vivo se oculta cuando la paleta los incluye. Las
  instrucciones bajo el lienzo pasaron a `BuilderGuide.tsx`: primeros pasos, leyenda de los
  elementos con su convención de polaridad y pestañas Ratón / Táctil / Atajos, maquetadas con
  _container queries_ porque la columna del formulario es angosta en escritorio. Se agregó el
  botón «Terminar cable» (en pantallas táctiles no hay doble clic), el encuadre automático del
  ejemplo cuando no cabe en el lienzo y la lectura de valores con su unidad («2.2 kΩ»).
- **Fuentes de los tests:** Hayt, Kemmerly y Durbin, 8.ª ed. en inglés (2012), y Dorf y Svoboda,
  9.ª ed. en inglés (2014), que son las ediciones que se pudieron consultar (la bibliografía del
  pensum lista la 3.ª en español de cada uno); los `locator` lo dicen. La transformada Z se
  verificó contra Kuo, 7.ª ed. en español (`kuo-1996`, sec. 2-11 y 2-12), porque ni Hayt ni Dorf
  la tratan. Erratas encontradas y documentadas en los tests: Dorf 14.4-4 (el numerador debe
  terminar en −30 para la división que muestra), Dorf 14.4-2 (el signo del término en seno sale
  de la «solución alterna» del libro), Hayt 10.2 (escribe 29.85 mV donde 3/√101 = 0.2985 V; no se
  usó) y Kuo 2-222 (2.072 viene de redondear |K| a 1.036; el valor exacto es 2.0684). Hayt usa en
  algunas figuras polaridades opuestas a la convención pasiva (fig. 9.2 y 9.22); los tests
  traducen los datos a la convención de la calculadora y lo explican.
- **Alternativas descartadas:** _Un CAS completo (álgebra simbólica general)_: pesado y con
  resultados difíciles de mostrar como en el cuaderno; la familia de exponenciales complejas
  cubre la tabla de pares de los libros. _Raíces solo numéricas con tolerancia fija_: confunde
  raíces dobles con dos raíces cercanas y estropea los residuos. _Fórmulas cerradas por caso
  (2 × 2, 3 × 3) para las ecuaciones de estado_: no escala; Faddeev-LeVerrier sirve para cualquier
  orden y da la adjunta que se muestra. _Persistir en `localStorage` si la guía está plegada_:
  obligaría a declararlo en la página de cookies por una comodidad menor.

## ADR-035 — Electrónica y Laboratorio de Circuitos y Electrónica: núcleos de dispositivos y campo con prefijos

- **Fecha:** 2026-10-15
- **Estado:** Aceptada
- **Decisión:** Las seis calculadoras de Electrónica y las tres propias del Laboratorio se apoyan
  en núcleos de `lib/calculators/electronica/`, sin el constructor de circuitos: los circuitos de
  los libros de electrónica son configuraciones fijas (polarización fija, divisor de voltaje,
  emisor común…) y el estudiante solo cambia sus valores.
  - `units.ts`: magnitudes con prefijo de ingeniería (`engTex`, `engText`), resistencias en
    paralelo y `parseQuantity`, que lee lo que escribe un estudiante (`2.2k`, `100µ`, `100u`,
    `47 nF`, `1e-6`).
  - `rectifier.ts` (transformador y tabla 4-1 de Malvino), `filter.ts` (filtro con condensador:
    V_r(pp) = I/(f_r·C)), `zener.ts` (los tres casos de Boylestad, la segunda aproximación,
    el rizado de salida y la R_S máxima del punto límite).
  - `bias.ts`: polarización de BJT (fija, emisor, divisor exacto y aproximado, realimentación) y
    de FET con la intersección de la recta de polarización y la curva de transferencia resuelta
    como ecuación de segundo grado (`solveFetBias`), que reemplaza el método gráfico del libro.
  - `small-signal.ts`: modelo híbrido aproximado (emisor común, R_E sin puentear, seguidor, base
    común) y completo (ecs. 5.158 a 5.161 de Boylestad), con la conversión de parámetros de
    emisor común a base común del apéndice A. El modelo r_e es el híbrido con h_ie = βr_e.
  - El Laboratorio reutiliza esos núcleos: la **fuente regulada por Zener** encadena
    transformador → rectificador → filtro → regulador (ejemplo 5-9 de Malvino) y el **amplificador
    emisor común** combina `bjtBias` y `approxAmplifier` con R_E1 sin puentear y R_E2 puenteada, y
    agrega la recta de carga de ca y el MPP de Malvino (sec. 11-2). La **resonancia RLC** es
    independiente (Hayt, cap. 16).
- **UI:** `components/calculators/electronica/QuantityField.tsx` es un campo numérico que acepta
  prefijos y muestra el valor inicial con prefijo (`270 µF` y no `0.00027`); guarda el texto
  escrito en un estado local y el formulario recibe el número ya leído. Lo usan Electrónica y el
  Laboratorio para resistencias, capacitancias, inductancias, corrientes y conductancias; los
  voltajes y las cantidades adimensionales siguen con `NumberField`.
- **Currículum:** los temas del Laboratorio apuntan con `{ ref }` a las calculadoras de Circuitos
  y Sistemas y de Electrónica que su programa comprueba (leyes y teoremas, diodos y fuentes,
  transistores), además de las tres propias.
- **Fuentes de los tests:** Boylestad y Nashelsky, 10.ª ed. en español, y Malvino, 6.ª ed. en
  español (la del pensum); la resonancia, con Hayt, Kemmerly y Durbin, 8.ª ed. en inglés. Los
  ejemplos de FET que el libro resuelve por el método gráfico se comparan con la precisión de la
  lectura de la gráfica (una cifra decimal). Erratas documentadas en los tests: Boylestad 4.11
  (imprime V_CE = 3.88 V; su sustitución da 0.39 V), 5.20 y 5.21 (dividen entre Z_i en vez de h_ie
  o h_ib), 11.2 (12.12 mV por 12.12 V) y 15.5 (enunciado con 50 µF y solución con 100 µF);
  Malvino 22-6 (escribe 40 kΩ por 48 kΩ). En el ejemplo 7.1 de Boylestad el punto Q queda en la
  región óhmica (V_DS = 4.75 V < V_GS − V_P = 6 V); la calculadora lo avisa aunque el libro no lo
  comprueba.
- **Alternativas descartadas:** _Usar el constructor de circuitos y resolver con MNA los
  transistores_: exigiría modelos no lineales y un método de Newton sobre toda la red, y el
  procedimiento dejaría de parecerse al del libro. _Aceptar prefijos en `NumberField` para todo
  el sitio_: cambiaría campos de otras materias donde `m` o `M` no tienen ese sentido.
  _Resolver los FET solo por el método gráfico_: la intersección exacta es más útil y la gráfica
  se muestra igual.

## ADR-036 — Diodos en el constructor de circuitos: método de los estados supuestos

- **Fecha:** 2026-10-16
- **Estado:** Aceptada
- **Decisión:** **Circuitos con diodos** tiene dos modos: el diodo en serie de siempre (con recta
  de carga y la característica real) y un **circuito dibujado** en el constructor de Circuitos y
  Sistemas, que ahora admite el componente `diode` (del ánodo `a` al cátodo `b`, con su umbral
  V_K como valor). La paleta `DIODE_KINDS` lo agrega solo en esta calculadora; las demás
  calculadoras de circuitos rechazan los diodos con el código `elementos-no-lineales`
  (`validateTopology` acepta `{ allowDiodes: true }`).
- **Motor** (`lib/calculators/electronica/diode-network.ts`): el método de Boylestad (sec. 2.3 a
  2.5). Se supone un estado por diodo (encendido = fuente de V_K, 0 V en el ideal, o V_K + r_B en
  la tercera aproximación; apagado = abierto), se resuelve el circuito lineal y se verifica
  (I_D ≥ 0 en los encendidos, V_AK ≤ V_K en los apagados). Se parte de todos apagados y se cambia
  el diodo que más se aleja de su suposición: primero los encendidos con corriente al revés y
  luego el apagado con más sobretensión (el que «enciende primero», como explica el ejemplo 2.12).
  Si una suposición deja un lazo de fuentes (diodos de distinto V_K en paralelo) se descarta; si
  el recorrido no converge, se prueban las combinaciones restantes (hasta 12 diodos).
  - Para verificar, un diodo apagado se modela con una conductancia despreciable (10⁻⁹ veces la
    menor de la red) y el sistema se resuelve con equilibrado de filas, así un nodo que solo une
    diodos apagados sigue teniendo voltaje.
  - Diodos iguales en paralelo (mismos nodos y V_K) se analizan juntos y se reparten la corriente
    (ejemplo 2.10).
  - Un diodo «encendido» sin corriente (en serie con uno apagado) se informa apagado con V_D = 0,
    como en el ejemplo 2.8 («cuando I_D = 0, V_D = 0»).
  - El circuito equivalente final se resuelve con `solveMna` para mostrar la traza de nodos de
    siempre; las ecuaciones de los diodos se titulan «Diodo D1 encendido: v_a − v_b = V_K».
- **UI:** símbolo propio (triángulo y barra) y entrada en la guía del tablero; el panel edita
  «V_K, umbral (V)» y admite 0; F voltea el diodo. La simulación en vivo se oculta, como con C y L.
- **Alternativas descartadas:** _Newton sobre toda la red con la ecuación de Shockley_: no es el
  procedimiento del curso y pide control de convergencia; la característica real sigue en el modo
  serie. _Probar siempre las 2ⁿ combinaciones_: da el resultado, pero no la secuencia «supón,
  verifica, corrige» que enseña el libro. _Modelar los apagados con una resistencia grande también
  en la traza final_: el libro los trata como circuitos abiertos y la traza debe coincidir.

## ADR-037 — Amplificadores operacionales en el constructor: componentes de tres terminales

- **Fecha:** 2026-10-16
- **Estado:** Aceptada
- **Decisión:** el constructor admite el componente `opamp`, el primero de tres terminales.
  `CircuitComponent` gana un tercer punto opcional `c`; en el amplificador, `a` es la entrada
  inversora (−), `b` la no inversora (+) y `c` la salida. `componentTerminals`, `opAmpPlacement`
  (entradas a dos celdas y salida a cuatro, hacia la orientación elegida) y `MappedComponent.nodeC`
  extienden el modelo sin tocar los componentes de dos terminales.
  - **Tablero:** el amplificador es una pieza rígida: arrastrar uno de sus terminales mueve las
    tres patas, R lo gira 90° alrededor de la entrada − y F intercambia − y +. Su cuerpo
    (`opAmpBody`) cuenta para los choques con cables y componentes. Solo tiene etiqueta; el
    amplificador es ideal y no tiene valor. Paleta `OPAMP_KINDS`, solo en Amplificadores
    operacionales; las demás calculadoras lo rechazan con `elementos-no-admitidos`
    (`validateTopology(…, { allow })` reemplaza la opción de los diodos).
  - **MNA** (`solveMna`): estampa del amplificador ideal (nulador): la corriente de su salida es
    una incógnita en la KCL de ese nodo y su fila es v₊ − v₋ = 0. En la tabla de ramas la salida
    aparece como rama a tierra, así el balance de potencias se cumple (la potencia sale de la
    alimentación).
  - **Calculadora** (`opamp-network.ts`): antes de resolver se verifica la realimentación de cada
    amplificador. Con las fuentes independientes anuladas se aplica 1 V a su salida y se mide
    v₊ − v₋: si es negativo hay realimentación negativa y el cortocircuito virtual vale. Si es
    cero (lazo abierto) o positivo (disparador de Schmitt), se rechaza y se remite al modo
    «configuración», que ya trata comparadores y Schmitt. Con V_sat, una salida que pida más se
    fija en ±V_sat como fuente y se vuelve a resolver. Con una sola fuente de voltaje se informa
    la ganancia v_o/V_s de cada amplificador.
- **Alternativas descartadas:** _Derivar la salida de la posición de las entradas_: obliga a una
  orientación fija y complica voltear. _Modelo de ganancia finita_: los libros del curso resuelven
  con el ideal y la traza sería menos clara. _Resolver Schmitt y comparadores en el tablero con
  estados de saturación_: posible, pero la histéresis depende de la historia de la entrada; el
  modo configuración ya lo explica como el libro.

## ADR-038 — Versión 1.0.0 y roadmap explícito

- **Fecha:** 2026-10-16
- **Estado:** Aceptada
- **Decisión:** Se publica la **1.0.0** con lo que está terminado: todas las materias con
  programa salvo Sistemas Dinámicos, más Circuitos y Sistemas, Electrónica y el Laboratorio de
  Circuitos y Electrónica completos, y el tablero interactivo con diodos y amplificadores
  operacionales. Lo que falta queda en [ROADMAP.md](ROADMAP.md): las 13 calculadoras de
  Sistemas Dinámicos (ya en el currículum con estado 🗺️), lo bloqueado por falta de fuentes
  (Matemáticas I a IV y dos calculadoras de Teoría de Sobrevivencia) y las mejoras del tablero.
- **Qué promete la 1.0.0** (complementa ADR-015): las URL `/[materia]/[tema]/[calculadora]/`
  son estables y el contrato `Calculator` no cambia de forma incompatible sin subir el _major_.
  Desde ahora, una calculadora o una funcionalidad nueva sube el _minor_ (así llegará Sistemas
  Dinámicos) y una corrección, el _patch_.
- **Contexto:** El usuario prefirió publicar lo hecho en vez de esperar a Sistemas Dinámicos. El
  sitio ya es útil para casi todo el pensum y el roadmap visible deja claro lo que no está.
- **Alternativas descartadas:** _Publicar como 0.8.0_: no refleja que el sitio está completo
  para casi todas las materias. _Esperar a Sistemas Dinámicos para la 1.0.0_: retrasa el uso de
  lo terminado sin necesidad.

## ADR-039 — Sistemas Dinámicos: núcleo de control, constructor de diagramas de bloques y plano s

- **Fecha:** 2026-10-16
- **Estado:** Aceptada
- **Decisión:** Las 13 calculadoras de Sistemas Dinámicos se apoyan en núcleos de
  `lib/calculators/sistemas-dinamicos/` y en lo que ya existía de Circuitos y Sistemas
  (`polynomials.ts`, `laplace.ts`, `laplace-inverse.ts`, `state-space.ts`):
  - `transfer-function.ts`: G(s) = N/D leída con el lector de Laplace (sin retardos), serie,
    realimentación, cancelación exacta, forma de polos y ceros, tipo y ganancia de baja
    frecuencia. `tf-analysis.ts` arma el análisis común (orden, tipo, estabilidad, polos y ceros).
  - `symbolic.ts`: polinomios en varias variables y **cocientes factorizados** (`FRat`: número,
    monomio y factores con exponente) para las ganancias simbólicas de los diagramas (G1, H2, a12,
    K, s). Guardar los factores permite cancelar los repetidos como en el cuaderno
    ([G/(1 − GH)]·(1 − GH) = G); al sumar se busca el denominador común y se intenta la división
    exacta multivariable (orden lexicográfico). `G1G2H1` se lee como producto y `s(s + 1)` o
    `K(s + 2)` como productos (mathjs los toma como llamadas a función; el lector de Laplace
    también se corrigió para `s(…)`).
  - `signal-flow.ts` (fórmula de Mason: trayectorias directas, lazos individuales y combinaciones
    de lazos que no se tocan, Δ y Δ_k), `block-diagram.ts` (documento del constructor y su
    flujograma equivalente: un nodo por señal, cada bloque una rama y cada entrada de un punto suma
    una rama ±1) y `reduction.ts` (reducción por **eliminación de nodos**, presentada como reglas de
    la tabla 3-1 de Ogata: bloques en cascada y en paralelo, lazo de realimentación G/(1 − L),
    puntos suma consecutivos y movimiento de puntos suma o de bifurcación; el resultado se compara
    con Mason).
  - `urat.ts` y `routh.ts`: el arreglo de Routh con **fracciones exactas** (`Rational`), así salen
    7/3 y 2 − 9K/7 como en Ogata. ε es la variable de una función racional (se evalúa el signo con
    ε → 0⁺); un renglón de ceros usa el polinomio auxiliar (también cuando Ogata usa ε en un
    renglón de un solo elemento: la conclusión es la misma y da las raíces sobre jω). Con un
    parámetro, la primera columna son funciones racionales de K: se prueban valores entre sus
    raíces para el intervalo de estabilidad y en los bordes se busca la frecuencia de oscilación.
  - `root-locus.ts` (eje real, asíntotas, ruptura por N D′ − N′ D = 0, ángulos de salida y llegada,
    cruces con jω por partes real e imaginaria, intersección con la recta de ζ y ramas por
    emparejamiento de raíces), `frequency.ts` (forma de Bode, fase continua factor por factor,
    asintótica, márgenes con la regla de Ogata del cruce de ganancia más alto, M_r, ω_r y ancho de
    banda), `time-response.ts` (respuesta por la inversa de Laplace y especificaciones medidas
    sobre la curva), `state-space-tf.ts` (G = C adj(sI − A)B/det + D) y `state-design.ts`
    (controlabilidad, observabilidad, rango exacto, Ackermann).
- **Constructores:** la Unidad I tiene un **constructor de diagramas de bloques**
  (`BlockDiagramField`): bloques con su G(s) (vista en KaTeX), puntos suma con tres entradas y
  signo por entrada (se cambia tocándolo), entradas y salidas con nombre, cables ortogonales,
  bifurcaciones (un extremo sobre otro cable) y cruces que **no** conectan, arrastre con los cables
  pegados, giro, deshacer, zoom y pantalla completa (por portal, porque el panel del formulario es
  `sticky` y crea su propio contexto de apilamiento). Mason y la reducción aceptan también un
  flujograma como tabla de ramas, con un dibujo automático. La función de transferencia reutiliza
  el constructor de circuitos de Circuitos y Sistemas (R, L, C y fuentes) con la nueva
  `outputEquation` de `state-space.ts`.
- **Contrato:** `Series` admite `kind: 'plane'` con `curves` y `markers` (el plano s del LGR y los
  diagramas de polos y ceros, dibujados por `PlaneChart` en SVG con la misma escala en los dos
  ejes) y `xScale: 'log'` (Bode). Son campos opcionales: no cambia nada de lo existente.
- **Fuentes de los tests:** Ogata, _Ingeniería de Control Moderna_, 3.ª ed. en español (la del
  pensum) y 5.ª ed. en español, y Kuo, _Sistemas de Control Automático_, 7.ª ed. en español, en sus
  textos de archive.org. Diferencias documentadas en los tests: Kuo, ec. 3-56, omite la
  trayectoria a12a24a45 que forma la rama a24 de la ec. 3-42; varios valores de Ogata son lecturas
  de gráficas y se comparan con esa precisión junto al valor exacto: ejemplo 6-1 con ζ = 0.5
  (−1/3 ± j/√3 y K = 28/27 frente a −0.3337 ± j0.578 y 1.0383), ejemplo 8-20 (márgenes de las
  trazas asintóticas), ejemplo 7-1 (bisectriz: −2.928 y −5.464 frente a −2.9 y −5.4), ejemplos 9-1
  y 9-2 (ω_c leída, y en el 9-2 un margen de ganancia exacto de 14.3 dB frente a «≈ 11 dB») y
  ejemplo 10-1 (12.811 por redondear T_i). El ejemplo 7-21 de la 5.ª ed. trae márgenes de MATLAB y
  se reproduce a cuatro cifras.
- **Alternativas descartadas:** _Simplificar con un CAS general (mathjs `simplify`)_: da formas
  que no son las del libro y no cancela factores de manera fiable. _Routh en coma flotante_: no
  cancela (K² − 1.5556K)/(K − 1.5556) a K. _Reducir solo por patrones (serie, paralelo,
  realimentación)_: se atasca con lazos entrelazados; la eliminación de nodos siempre termina.
  _Dibujar el LGR con Recharts_: agrupa los datos por x y no admite curvas que no son funciones de
  x. _Un constructor de flujogramas con ramas curvas_: la tabla con dibujo automático es más clara
  en el celular y el diagrama de bloques ya cubre el dibujo libre.
