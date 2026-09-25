# Arquitectura

Este documento explica cómo está construido CalcUDO y **por qué**. Si vas a cambiar algo de lo
que se describe aquí, registra la decisión en [DECISIONES.md](DECISIONES.md).

## Stack y por qué cada pieza

| Pieza                                                | Para qué                                                                        | Por qué esta y no otra                                                                                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Next.js (App Router)** + `output: 'export'`        | Rutas, layouts, generación estática                                             | Genera un sitio 100 % estático que se despliega gratis en Vercel. `generateStaticParams` convierte el currículum en páginas prerenderizadas, rápidas en teléfonos y con buen SEO. No hay backend.                                        |
| **TypeScript strict** (+ `noUncheckedIndexedAccess`) | Todo el código                                                                  | En código numérico, un `undefined` que se cuela como `NaN` es un bug silencioso. El modo estricto obliga a manejar esos casos.                                                                                                           |
| **Tailwind CSS v4 + shadcn/ui**                      | Estilos y componentes base                                                      | shadcn copia los componentes al repo (`components/ui/`), así que se pueden modificar sin pelear con una librería. Tailwind mantiene los estilos junto al marcado.                                                                        |
| **mathjs**                                           | Parsear expresiones como `x^3 - 2x - 5`, evaluarlas y derivarlas simbólicamente | Tiene parser, derivación simbólica (`derivative`) y exportación a LaTeX (`node.toTex()`), lo que permite mostrar la fórmula que escribió el usuario.                                                                                     |
| **KaTeX** (directo, sin wrapper)                     | Renderizar fórmulas                                                             | Mucho más rápido que MathJax y funciona en render estático. Se usa `katex.renderToString` desde un componente propio de unas 20 líneas en vez de `react-katex`, que está sin mantenimiento y no declara soporte para React 19 (ADR-005). |
| **Recharts**                                         | Gráficas de convergencia, curvas y distribuciones                               | Declarativo, basado en componentes React, suficiente para gráficas 2D educativas.                                                                                                                                                        |
| **React Hook Form + Zod**                            | Formularios y validación                                                        | El **mismo schema Zod** valida el formulario y la entrada de `solve()`: una sola definición de qué es una entrada válida.                                                                                                                |
| **Vitest**                                           | Tests                                                                           | Rápido, compatible con TypeScript y ESM sin configuración extra, y con la misma API que Jest.                                                                                                                                            |
| **Prettier + ESLint**                                | Formato y reglas                                                                | ESLint además **prohíbe importar React/Next dentro de `lib/`** para garantizar que la lógica sea pura.                                                                                                                                   |
| **pnpm**                                             | Paquetes                                                                        | Instalación rápida y lockfile determinista.                                                                                                                                                                                              |

## Estructura de carpetas

```
calc-udo/
├── app/                               ← SOLO rutas. Sin lógica de negocio.
│   ├── layout.tsx                     shell: fuentes, tema, header/footer
│   ├── page.tsx                       home: materias agrupadas por semestre
│   └── [materia]/
│       ├── page.tsx                   ficha de la materia + temas
│       └── [tema]/
│           ├── page.tsx               calculadoras del tema
│           └── [calculadora]/page.tsx la calculadora (Fase 3)
│
├── lib/                               ← TypeScript puro: sin React, sin efectos.
│   ├── calculators/
│   │   ├── types.ts                   el contrato común (ver abajo)
│   │   ├── contract.test.ts           valida el contrato de TODAS las calculadoras
│   │   └── <materia>/
│   │       ├── <calculadora>.ts       lógica: implementa Calculator<I, V, E>
│   │       ├── <calculadora>.test.ts  tests con casos de la bibliografía
│   │       └── <familia>.ts           núcleo compartido por métodos parecidos
│   │                                  (p. ej. root-finding.ts, bracketing.ts)
│   ├── math/                          helpers compartidos entre calculadoras
│   │   ├── expression.ts              parsear/compilar/derivar con mathjs
│   │   ├── format.ts                  redondeo y número → LaTeX
│   │   └── error-metrics.ts           error absoluto y relativo
│   ├── curriculum.ts                  tipos del currículum + consultas
│   └── utils.ts                       cn() de shadcn
│
├── components/
│   ├── ui/                            shadcn (generado, se puede editar)
│   ├── layout/                        header, footer, migas, tema
│   ├── curriculum/                    listas y badges de estado
│   └── calculators/
│       ├── registry.ts                id → componente. ÚNICO interruptor de "implementada"
│       ├── CalculatorLayout.tsx       shell genérico de toda calculadora
│       ├── StepByStep.tsx             renderiza Step[]
│       ├── ResultTable.tsx            renderiza ResultTable[]
│       ├── Formula.tsx                KaTeX
│       ├── form/                      CalculatorForm + campos reutilizables
│       └── <materia>/<Calculadora>.tsx  solo declara sus campos
│
├── data/
│   ├── curriculum.ts                  materias → temas → calculadoras previstas
│   └── bibliography.ts                bibliografía del pensum, una entrada por obra
│
├── scripts/generate-pensum.ts         genera docs/PENSUM.md desde data/
└── docs/                              esta documentación
```

### Por qué así

- **Núcleos por familia de métodos.** Cuando varios métodos solo difieren en una fórmula
  (bisección y falsa posición difieren en cómo calculan xᵣ), el procedimiento común vive en un
  archivo de la familia (`bracketing.ts`) y cada método aporta su regla. Así un arreglo en el
  procedimiento llega a todos, y cada calculadora sigue siendo un objeto `Calculator` con su
  propio id, citas y tests.

- **`app/` solo tiene rutas.** Las páginas leen `lib/curriculum.ts` y componen componentes. Si
  una página crece con lógica, esa lógica va a `lib/` o a un componente.
- **`lib/calculators/<materia>/`** agrupa por materia porque así piensa quien contribuye ("voy
  a hacer las de Métodos Numéricos"). El test vive **junto** al archivo que prueba.
- **`lib/math/`** existe para no reimplementar en cada calculadora cómo parsear una expresión o
  calcular el error relativo. Bisección, secante y Newton usan los mismos helpers, y así
  reportan errores de forma consistente.
- **`data/` separado de `lib/`**: `data/` es contenido (lo que dice el pensum) y `lib/` es
  comportamiento. Otra rama de la carrera se agrega editando `data/`, sin tocar `lib/`.
- **`components/calculators/registry.ts`** es el único punto donde una calculadora pasa a
  "implementada". El estado no se escribe a mano en ningún otro lado (ADR-004).

## Rutas

Tres niveles, todos estáticos:

```
/                                        home
/metodos-numericos/                      materia
/metodos-numericos/raices-de-ecuaciones/ tema
/metodos-numericos/raices-de-ecuaciones/newton-raphson/   calculadora
```

Cada segmento dinámico tiene `generateStaticParams()` alimentado por `lib/curriculum.ts` y
`dynamicParams = false`: una URL que no está en el currículum da 404. La ruta de calculadora
solo genera páginas para las calculadoras **registradas**; las del roadmap se ven en la página
del tema como "Próximamente", sin enlace.

Una calculadora puede aparecer en varios temas (por ejemplo la binomial en Estadísticas I y en
Inferencia), pero tiene **una sola URL canónica**: la del tema donde está definida. Los demás
temas usan `{ ref: 'distribucion-binomial' }` y enlazan a esa URL.

## El contrato común de calculadoras

Definido en `lib/calculators/types.ts`. Toda calculadora exporta un objeto que cumple
`Calculator<TInput, TValue, TErrorCode>`:

```ts
export interface Calculator<TInput, TValue, TErrorCode extends string = string> {
  meta: CalculatorMeta; // id, título, resumen, citas bibliográficas
  inputSchema: z.ZodType<TInput, TInput>; // validación compartida con el formulario
  example: TInput; // ejemplo precargado, tomado de la bibliografía
  solve(input: TInput): CalculatorResult<TValue, TErrorCode>; // pura, nunca lanza
}
```

`solve()` devuelve siempre una **traza**, tanto si tiene éxito como si falla:

```ts
interface Trace {
  steps: Step[]; // el procedimiento, con fórmulas en LaTeX
  tables: ResultTable[]; // p. ej. la tabla de iteraciones
  series: Series[]; // datos crudos para gráficas (la UI decide cómo dibujarlos)
  notices: Notice[]; // avisos: "convergencia lenta", "raíz múltiple", …
}

type CalculatorResult<V, E> =
  | ({ ok: true; value: V; summary: SummaryItem[] } & Trace)
  | ({ ok: false; error: { code: E; message: string } } & Trace);
```

Por qué está diseñado así:

- **La traza no es opcional.** Es el producto. Un `solve()` que solo devuelve un número no
  cumple el contrato.
- **Un fallo también se explica.** Si Newton encuentra f'(xₙ) = 0 en la iteración 3, el
  resultado es `ok: false`, pero trae las iteraciones 1 a 3. El estudiante ve dónde y por qué
  falló el método, que también es contenido de estudio.
- **`solve()` nunca lanza excepciones.** Los errores son datos tipados (`TErrorCode`), así que
  la UI puede tratarlos sin `try/catch` y los tests pueden afirmar el código exacto.
- **Sin React en el resultado.** Las fórmulas son strings LaTeX y las gráficas son series de
  puntos. Por eso la lógica se prueba en Node y la UI es genérica.
- **Un solo schema.** `inputSchema` valida el formulario (con `zodResolver`) y documenta qué
  acepta `solve()`.

Cada `Step` tiene la misma forma en todas las calculadoras:

| Campo          | Ejemplo (Newton, iteración 1)                                      |
| -------------- | ------------------------------------------------------------------ |
| `title`        | `Iteración 1`                                                      |
| `explanation`  | `Se evalúa la función y su derivada en x₀ y se aplica la fórmula.` |
| `formula`      | `x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}`                           |
| `substitution` | `x_1 = 0 - \frac{1}{-2}`                                           |
| `result`       | `x_1 = 0.5`                                                        |

## Flujo de datos

```
data/curriculum.ts ──► lib/curriculum.ts ──► generateStaticParams ──► app/[materia]/[tema]/[calculadora]
                                                                            │
                                     components/calculators/registry.ts ◄───┘ busca el id
                                                     │ carga diferida
                                                     ▼
                         components/calculators/<materia>/<Calc>.tsx   ('use client')
                           │  formulario (React Hook Form + calc.inputSchema)
                           │  al enviar: calc.solve(input)          ◄── lib/calculators/<materia>/<calc>.ts
                           ▼
                         <CalculatorLayout result={…} meta={…}>
                           ├─ ResultSummary   ← result.summary / result.error
                           ├─ StepByStep      ← result.steps       (KaTeX)
                           ├─ ResultTable     ← result.tables
                           ├─ SeriesChart     ← result.series      (Recharts)
                           └─ References      ← meta.citations → data/bibliography.ts
```

1. En build, `generateStaticParams` recorre el currículum y genera una página por cada
   calculadora registrada.
2. La página (Server Component) resuelve la materia, el tema y la ubicación canónica, y carga
   el componente del registro.
3. El componente de la calculadora (Client Component) solo contiene el formulario específico.
   Todo lo demás lo pone `CalculatorLayout`.
4. `solve()` corre en el navegador. No hay red ni servidor.

## Extender a otras ramas de la carrera

Agregar objetos `Subject` en `data/curriculum.ts` y sus obras en `data/bibliography.ts`. Nada
más cambia: las rutas, el home y `PENSUM.md` se generan desde ahí. Si el archivo crece mucho,
se puede partir en `data/curriculum/<rama>.ts` y concatenar los arreglos.
