# Cómo contribuir

¡Gracias por querer ayudar! CalcUDO lo usan estudiantes para estudiar, así que la regla número
uno es **no publicar un resultado incorrecto**. Todo lo demás es negociable.

## Setup local

Requisitos: **Node.js 22+** y **pnpm 11** (`corepack enable` lo activa si tienes Node).

```bash
git clone <url-del-repo> calc-udo
cd calc-udo
pnpm install
pnpm dev            # http://localhost:3000
```

### Scripts

| Comando                        | Qué hace                                                           |
| ------------------------------ | ------------------------------------------------------------------ |
| `pnpm dev`                     | Servidor de desarrollo con recarga en caliente.                    |
| `pnpm test`                    | Corre todos los tests una vez.                                     |
| `pnpm test:watch`              | Tests en modo observador (útil mientras escribes una calculadora). |
| `pnpm test:coverage`           | Tests con reporte de cobertura de `lib/`.                          |
| `pnpm typecheck`               | `tsc --noEmit` en modo estricto.                                   |
| `pnpm lint`                    | ESLint.                                                            |
| `pnpm format` / `format:check` | Prettier (escribe / verifica).                                     |
| `pnpm check`                   | **Todo lo anterior junto.** Debe pasar antes de abrir un PR.       |
| `pnpm docs:pensum`             | Regenera `docs/PENSUM.md` a partir de `data/curriculum.ts`.        |
| `pnpm build`                   | Genera el sitio estático en `out/`.                                |

## Estándares de código

### Idioma

- **Código en inglés**: nombres de archivos, variables, funciones y tipos (`newtonRaphson`,
  `ResultTable`).
- **Contenido visible en español**: textos de UI, mensajes de error, explicaciones de pasos.
- **Slugs de URL en español** (`/metodos-numericos/raices-de-ecuaciones/`), porque los ve el
  estudiante.
- Comentarios: en español, y solo cuando explican un **porqué** que no se lee en el código.

### TypeScript

- Modo `strict` con `noUncheckedIndexedAccess`. No uses `any`. Si de verdad no sabes el tipo,
  usa `unknown` y valídalo.
- Evita `!` (non-null assertion) en `lib/`. En tests se acepta.

### Arquitectura (no negociable)

1. **`lib/` es puro.** Nada de React, Next, `window`, `Date.now()` ni `Math.random()` sin
   semilla. ESLint bloquea los imports de React y Next ahí.
2. **Toda calculadora implementa `Calculator`** de `lib/calculators/types.ts` y devuelve la
   traza completa.
3. **`solve()` nunca lanza excepciones.** Los errores esperables (expresión inválida, división
   por cero, no convergencia) se devuelven como `{ ok: false, error: { code, message } }`.
4. **El currículum es data.** Una materia, un tema o una calculadora nueva se agrega en
   `data/curriculum.ts`, nunca en código de páginas.

### Tests

- **Toda función en `lib/` tiene tests antes de considerarse terminada.**
- **Los valores esperados vienen de la bibliografía.** Cada caso cita libro, edición, sección y
  número de ejemplo en un comentario:

  ```ts
  // Chapra & Canale, Métodos Numéricos para Ingenieros, Ejemplo 6.3 (Newton-Raphson).
  // f(x) = e^{-x} - x, x0 = 0. Tabla del libro: x1 = 0.5, x2 = 0.566311003, …
  ```

  Si tu edición numera distinto, anota la que usaste. Si el caso **no** viene de un libro
  (por ejemplo, un caso borde como la derivada nula), dilo explícitamente y explica cómo
  verificaste el valor esperado.

- Cubre como mínimo: el caso normal, los casos de falla de cada `TErrorCode` y al menos un
  caso borde.
- Compara flotantes con tolerancia (`toBeCloseTo(valor, decimales)`), nunca con `toBe`.

## Convención de commits

[Conventional Commits](https://www.conventionalcommits.org/es/), en español:

```
<tipo>(<alcance>): <descripción en imperativo>

feat(metodos-numericos): agregar calculadora de bisección
fix(newton-raphson): detectar derivada nula antes de dividir
test(simplex): agregar ejemplo 3.3-1 de Taha
docs(pensum): regenerar estados
refactor(math): extraer cálculo de error relativo
chore: actualizar dependencias
```

Tipos: `feat`, `fix`, `test`, `docs`, `refactor`, `style`, `perf`, `chore`, `build`, `ci`.
El alcance suele ser el id de la calculadora o la carpeta afectada.

## Proceso de PR

1. **Abre un issue antes** si vas a trabajar en una calculadora, para que nadie duplique el
   esfuerzo. Márcala con `inProgress: true` en `data/curriculum.ts` en tu PR.
2. Crea una rama desde `main`: `feat/<id-de-calculadora>` o `fix/<descripcion-corta>`.
3. Sigue [NUEVA-CALCULADORA.md](NUEVA-CALCULADORA.md) si agregas una calculadora.
4. Ejecuta `pnpm check` y `pnpm docs:pensum`.
5. En la descripción del PR incluye:
   - Qué calculadora o cambio es.
   - **Las fuentes de los casos de prueba** (libro, edición, ejemplo).
   - Una captura en móvil (≈ 375 px de ancho) si hay cambios de UI.
6. Un PR que agrega o cambia lógica matemática necesita la revisión de alguien que verifique
   al menos un caso de prueba contra el libro.

## Reportar un resultado incorrecto

Es la contribución más valiosa. Abre un issue con:

- La calculadora y la entrada exacta que usaste.
- Lo que muestra CalcUDO y lo que esperabas.
- La fuente del valor esperado (libro, página y ejemplo, o tu profesor).
