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

## Estado del plan

- Fase 1 — Scaffolding, docs y currículum ✅
- Fase 2 — Contrato (`types.ts`) y componentes genéricos ✅
- Fase 3 — Newton-Raphson como piloto ✅. **No implementar más calculadoras hasta que el
  mantenedor revise el piloto.**
