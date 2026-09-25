# CLAUDE.md — CalcUDO

Calculadoras académicas **con procedimiento paso a paso** para estudiantes de Ingeniería de
Sistemas de la Universidad de Oriente (UDO), Venezuela. Organizadas por materia → tema →
calculadora. El diferenciador es **la traza del procedimiento**, no el resultado.

## Fuente de verdad

- `docs/fuentes/pensum-rama-cuantitativa.md` es el pensum. **No inventes materias, temas ni
  calculadoras que no estén ahí.** Matemáticas I–IV no tienen programa: `content: 'pendiente'`.
- `data/curriculum.ts` deriva de ese archivo. `docs/PENSUM.md` se **genera**
  (`pnpm docs:pensum`) y un test falla si queda desactualizado.

## Principios de arquitectura (no negociables)

1. **`lib/` es TypeScript puro**: sin React, Next, `window`, fechas ni aleatoriedad. ESLint
   bloquea los imports de React y Next en `lib/`.
2. **Contrato común** (`lib/calculators/types.ts`): toda calculadora implementa
   `Calculator<TInput, TValue, TErrorCode>`. `solve()` es pura y total (**nunca lanza**) y
   devuelve siempre la traza (`steps`, `tables`, `series`, `notices`), también cuando
   `ok: false`.
3. **El currículum es data** (`data/curriculum.ts`). Las rutas, el home y PENSUM.md se generan
   desde ahí. Cada calculadora se define en un solo tema; otros usan `{ ref: id }`.
4. **Agregar una calculadora es mecánico**: lógica + test + formulario + una línea en
   `components/calculators/registry.ts`. Estar en el registro = implementada (el estado no se
   escribe a mano). Guía: `docs/NUEVA-CALCULADORA.md`.

## Tests

- Toda función de `lib/` tiene tests antes de darse por terminada.
- **Los valores esperados salen de ejemplos resueltos en la bibliografía** (Chapra, Taha,
  Hillier, Walpole, etc.), con un comentario que cite libro, edición y ejemplo. **No uses
  valores calculados por ti sin contraste.** Si un caso borde no viene de un libro, dilo y
  explica cómo se verificó.
- Flotantes con `toBeCloseTo`.

## Convenciones

- Código, archivos y tipos en **inglés**. UI, mensajes de error, pasos y docs en **español**.
  Slugs de URL en español.
- Rutas: `/[materia]/[tema]/[calculadora]/`, estáticas (`output: 'export'`,
  `generateStaticParams`, `dynamicParams = false`). En Next 16, `params` es una `Promise`.
- Mobile-first: revisa a ~375 px.
- Cada calculadora cita su fuente (`meta.citations` → ids de `data/bibliography.ts`).
- Commits: Conventional Commits en español (`feat(metodos-numericos): …`).
- Decisiones de arquitectura nuevas → agrega un ADR en `docs/DECISIONES.md`.

## Comandos

```bash
pnpm dev | pnpm build | pnpm test | pnpm test:watch
pnpm typecheck | pnpm lint | pnpm format
pnpm check          # todo junto; debe pasar antes de commitear
pnpm docs:pensum    # regenerar docs/PENSUM.md tras cambiar currículum o registro
```

## Stack

Next.js 16 (App Router) · TypeScript 6 strict (+`noUncheckedIndexedAccess`; no 7.x todavía,
ver ADR-009) · Tailwind v4 + shadcn/ui (`components/ui/`) · mathjs · KaTeX directo
(`components/calculators/Formula.tsx`, sin react-katex) · Recharts · React Hook Form + Zod 4
· Vitest · pnpm 11.

## Skills del proyecto

En `.agents/skills/` (no versionado) hay skills útiles: `next-best-practices`,
`react-best-practices`, `frontend-design`, `accessibility`, `composition-patterns`, `seo`.
Consúltalas al escribir UI o rutas.

## Núcleos compartidos (reutilízalos antes de escribir uno nuevo)

- `lib/calculators/metodos-numericos/`: `root-finding.ts` (campos, error aproximado, gráficas
  de convergencia), `bracketing.ts` (bisección y falsa posición), `integration.ts` (reglas de
  Newton-Cotes), `ode.ts` + `ode-methods.ts` (métodos de un paso para EDO).
- `lib/calculators/teoria-de-colas/queueing.ts` (L, Lq, W, Wq, tabla de pₙ).
- `lib/calculators/procesos-estocasticos/markov.ts` (validación de matrices de transición).
- `lib/calculators/estadistica-1/discrete.ts` (P(X = k), P(X ≤ k)… sobre una pmf).
- `lib/calculators/modelos-de-operaciones-1/`: `network.ts` (red PERT-CPM: recorridos, holguras,
  rutas críticas), `games.ts` (matriz de pagos, maximin/minimax), `dynamic-programming.ts`
  (tablas por etapa).
- `lib/calculators/modelos-de-operaciones-2/`: `forecasting.ts` (MAD, MSE, MAPE, tabla y
  gráfica de pronósticos), `inventory.ts` (EOQ, punto de reorden, curvas de costo).
- `lib/math/`: `expression.ts` (f(x) y f(x, y)), `format.ts` (números, matrices, vectores,
  texto y fracciones en LaTeX), `normal.ts` (Φ, Φ⁻¹ y densidad), `linear-algebra.ts`,
  `data-list.ts`, `error-metrics.ts`.
- UI: `components/calculators/form/` (`CalculatorForm`, `fields.tsx`, `MatrixField.tsx` con la
  matriz rectangular, `TableField.tsx` para listas de filas). `Series.others` agrega líneas a
  una gráfica (ADR-018).

**Cuidado con `*/` en comentarios.** Una fórmula como `Q*/D` dentro de un comentario `/** … */`
lo cierra antes de tiempo; escribe `Q* / D`.

**Cuidado con las barras invertidas.** En un string de JS, `"\frac"` sin doble barra contiene un
salto de página y `"\begin"` un backspace; KaTeX los muestra como □. Escribe el código con las
herramientas de edición de archivos, no con heredocs ni `node -e` desde la shell, que pueden
perder barras. Un test del contrato detecta caracteres de control (ADR-014).

## Estado del plan

- Fase 1 — Scaffolding, docs y currículum ✅
- Fase 2 — Contrato (`types.ts`) y componentes genéricos ✅
- Fase 3 — Newton-Raphson como piloto ✅ (revisado)
- Tanda 1 — Bisección, falsa posición y secante ✅
- Tanda 2 — Integración (rectangular, trapecio, Simpson) y EDO (Euler, Heun, RK4) ✅
- Tanda 3 — Colas (M/M/1, M/M/s, M/M/1/K) y Markov (n pasos, estado estable) ✅
- Tanda 4 — Estadística (medidas descriptivas, binomial, Poisson, normal) ✅
- Páginas legales (aviso legal, privacidad, datos, cookies) y versión **v0.1.0** ✅
- Tanda 5 — Programas de Modelos de Operaciones I y II; PERT-CPM, teoría de juegos,
  programación dinámica (ruta más corta, fuerza de trabajo, mochila), pronósticos (promedios
  móviles, suavizamiento exponencial) e inventarios (EOQ, faltantes, descuentos, punto de
  reorden, un periodo). Versión **v0.2.0** ✅

## Versiones

SemVer (ADR-015). Al publicar: sube `version` en `package.json`, mueve lo de "Sin publicar" en
`CHANGELOG.md` a la nueva versión y crea un tag anotado `vX.Y.Z` sobre `main`.
