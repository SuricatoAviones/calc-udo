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
