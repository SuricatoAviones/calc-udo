# Cómo agregar una calculadora

Esta es la guía más importante del repositorio. Agregar una calculadora debe ser **mecánico**:
cuatro archivos y una línea de registro. Si en el camino tienes que tocar algo que no está en
esta lista, avísanos en el PR: probablemente la abstracción está mal.

> Antes de empezar lee [ARQUITECTURA.md § El contrato común](ARQUITECTURA.md#el-contrato-común-de-calculadoras).

## Checklist

Usa `<materia>` para la carpeta (p. ej. `metodos-numericos`) y `<id>` para el id de la
calculadora (p. ej. `newton-raphson`), tal como aparecen en `data/curriculum.ts`.

### 0. Preparación

- [ ] La calculadora existe en `data/curriculum.ts` con estado 🗺️ Roadmap
      (ver [PENSUM.md](PENSUM.md)). **Si no existe, no la inventes**: primero verifica que el
      tema esté en el pensum ([fuentes/](fuentes/pensum-rama-cuantitativa.md)).
- [ ] Abriste un issue y marcaste `inProgress: true` en su entrada del currículum.
- [ ] Tienes a mano **un ejemplo resuelto del libro** citado en la bibliografía de la materia,
      con los valores intermedios. Sin esto no se puede empezar.

### 1. Tests primero: `lib/calculators/<materia>/<id>.test.ts`

- [ ] Caso del libro: compara el resultado final **y** los valores intermedios de la traza
      (por ejemplo cada xₙ de la tabla del libro), con `toBeCloseTo`.
- [ ] Un test por cada código de error (`TErrorCode`) que la calculadora pueda devolver.
- [ ] Al menos un caso borde (entrada que ya es solución, intervalo degenerado, etc.).
- [ ] Cada caso tiene un comentario con **la fuente**: libro, edición, sección y ejemplo. Si un
      caso no viene de un libro, dilo y explica cómo verificaste el valor esperado.
- [ ] Hay un test que valida `example` contra `inputSchema`.

### 2. Lógica: `lib/calculators/<materia>/<id>.ts`

- [ ] Exporta un objeto que implementa `Calculator<Input, Value, ErrorCode>`.
- [ ] `meta.id` es **idéntico** al id del currículum.
- [ ] `meta.citations` apunta a ids de `data/bibliography.ts`, con `locator` preciso
      (sección y ejemplo).
- [ ] `inputSchema` (Zod) con mensajes de error **en español**.
- [ ] `example` es el ejemplo del libro que usaste en los tests.
- [ ] `solve()`:
  - [ ] es pura: no usa `Date`, `Math.random`, `window` ni estado global;
  - [ ] **nunca lanza**: todo error esperable se devuelve como `{ ok: false, error }`;
  - [ ] devuelve **la traza completa** también cuando falla a mitad de camino;
  - [ ] cada `Step` tiene la fórmula general (`formula`) **y** la sustitución con números
        (`substitution`), para que el estudiante pueda compararla con su cuaderno;
  - [ ] reutiliza `lib/math/` (parseo, formato, errores) en vez de reimplementarlo.
- [ ] `pnpm test` pasa.

### 3. UI: `components/calculators/<materia>/<Nombre>.tsx`

- [ ] `'use client'`.
- [ ] **Solo** el formulario específico: los campos de entrada con React Hook Form y
      `zodResolver(calc.inputSchema)`, precargados con `calc.example`.
- [ ] Al enviar, llama a `calc.solve(input)` y pasa el resultado a `<CalculatorLayout>`. **No**
      reimplementes la tabla de pasos, el resumen, la gráfica ni las referencias: el layout
      genérico ya lo hace.
- [ ] Revisa la página en un ancho de ~375 px (móvil).

### 4. Registro: `components/calculators/registry.ts`

- [ ] Agrega una línea al objeto `calculatorRegistry` (ver el bloque de abajo). Esto la marca
      como ✅ implementada en todo el sitio y genera su página.
- [ ] Quita `inProgress: true` de su entrada en `data/curriculum.ts`.

```ts
'<id>': () => import('./<materia>/<Nombre>'),
```

### 5. Cierre

- [ ] `pnpm docs:pensum`: regenera [PENSUM.md](PENSUM.md) con el nuevo estado.
- [ ] Si introdujiste términos nuevos, agrégalos a [GLOSARIO.md](GLOSARIO.md).
- [ ] `pnpm check` pasa.
- [ ] Commit: `feat(<materia>): agregar calculadora de <nombre>`.
- [ ] PR con las fuentes de los casos de prueba (ver [CONTRIBUTING.md](CONTRIBUTING.md)).

**Resumen de archivos tocados**: `<id>.ts`, `<id>.test.ts`, `<Nombre>.tsx`, una línea en
`registry.ts`, y los archivos que se regeneran o ajustan (`curriculum.ts` sin `inProgress` y
`PENSUM.md`).

---

## Ejemplo completo: Newton-Raphson

> 🚧 Esta sección se completa en la **Fase 3** con el código real de la calculadora piloto
> (`lib/calculators/metodos-numericos/newton-raphson.ts`), para no documentar código que todavía
> no existe.
