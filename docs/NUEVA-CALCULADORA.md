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
- [ ] Envuelve los campos en `<CalculatorForm calculator={calc}>`: valida con
      `calc.inputSchema`, precarga `calc.example`, llama a `calc.solve` y dibuja el resultado.
- [ ] **Solo** declara los campos (`NumberField`, `ExpressionField`, `SelectField`…). **No**
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

La calculadora piloto. Los fragmentos de abajo están resumidos; el código completo está en los
archivos enlazados.

### 0. Preparación

En `data/curriculum.ts` ya existía:

```ts
// Métodos Numéricos → tema 'raices-de-ecuaciones'
{ id: 'newton-raphson', title: 'Método de Newton-Raphson', summary: '…' },
```

Ejemplos del libro elegidos (Chapra & Canale, cap. 6):

- **Ejemplo 6.3**: f(x) = e⁻ˣ − x, x₀ = 0. Tabla con x₁ … x₄ y εt. Es el caso normal.
- **Ejemplo 6.5**: f(x) = x¹⁰ − 1, x₀ = 0.5. Converge muy lento (x₁ = 51.65, x₂ = 46.485, …),
  así que con 5 iteraciones sirve de caso real de **no convergencia**.

### 1. Tests: [`newton-raphson.test.ts`](../lib/calculators/metodos-numericos/newton-raphson.test.ts)

Se escribieron antes que la implementación. Observa el comentario con la fuente y que se
verifican **los valores intermedios**, no solo la raíz:

```ts
// Chapra & Canale, Métodos Numéricos para Ingenieros, sección 6.2, Ejemplo 6.3
// ("Método de Newton-Raphson"): raíz de f(x) = e^{-x} − x con x0 = 0.
// Tabla del libro (i, x_i, εt %): 1 0.500000000 11.8 / 2 0.566311003 0.147 / …
it('reproduce cada iteración de la tabla del libro', () => {
  const [x1, x2, x3, x4] = approximations(result);
  expect(x1).toBeCloseTo(0.5, 9);
  expect(x2).toBeCloseTo(0.566311003, 8);
  expect(x3).toBeCloseTo(0.567143165, 8);
  expect(x4).toBeCloseTo(0.56714329, 8);
});
```

Casos cubiertos, uno por cada código de error y los casos borde:

| Caso                             | Fuente                                    | Código esperado                       |
| -------------------------------- | ----------------------------------------- | ------------------------------------- |
| e⁻ˣ − x, x₀ = 0                  | Chapra, Ej. 6.3                           | `ok: true`, 4 iteraciones             |
| x¹⁰ − 1, x₀ = 0.5, 5 iteraciones | Chapra, Ej. 6.5                           | `max-iterations`                      |
| x² − 4, x₀ = 0 (f′(0) = 0)       | Caso borde, analítico (Chapra, fig. 6.6d) | `zero-derivative`                     |
| x² − 2x + 5, x₀ = 3 (f′(x₁) = 0) | Caso borde, analítico                     | `zero-derivative` en la 2.ª iteración |
| x² − 4, x₀ = 2                   | Caso borde: x₀ ya es raíz                 | `ok: true`, 0 iteraciones             |
| 2x − 4                           | Caso borde: lineal, exacta en 1 iteración | `ok: true`                            |
| `x^^2`, `y - 1`, `log(x)`, vacío | Validación                                | `invalid-expression`                  |
| 1/x en 0, √x en −1               | Valores no reales                         | `non-finite`                          |

### 2. Lógica: [`newton-raphson.ts`](../lib/calculators/metodos-numericos/newton-raphson.ts)

**Schema de entrada**, con mensajes en español. Lo comparten el formulario y `solve()`:

```ts
export const newtonRaphsonInputSchema = z.object({
  expression: z.string().trim().min(1, 'Escribe la función f(x).').max(200, '…'),
  x0: finiteNumber('x₀'),
  tolerance: finiteNumber('la tolerancia')
    .refine((v) => v > 0, '…')
    .refine((v) => v <= 100, '…'),
  maxIterations: z.number().int('…').min(1, '…').max(100, '…'),
});
```

**Tipos del resultado y códigos de error**, que la UI y los tests usan con autocompletado:

```ts
export interface NewtonRaphsonValue {
  root: number;
  iterations: number;
  converged: boolean;
  approximateError: number | null;
  residual: number;
}
export type NewtonRaphsonErrorCode =
  'invalid-expression' | 'zero-derivative' | 'non-finite' | 'max-iterations';
```

**Reutilizar `lib/math/`** en vez de reimplementar:

```ts
const parsed = parseFunction(input.expression); // valida, traduce ln/sen, errores en español
const derived = differentiate(parsed.expr); // derivada simbólica + LaTeX
const ea = relativeErrorPercent(xNext, x); // criterio de Chapra
n(xNext) / op(x); // toLatexNumber / toLatexOperand
```

Si el método se hace a mano con fracciones (simplex, transporte, asignación), calcula con
`Rational` de `lib/math/rational.ts`: `toLatex()` muestra enteros, decimales cortos o
`\frac{2}{3}` como en el libro, y las comparaciones con 0 no dependen de una tolerancia.

**Cada iteración es un `Step` con subpasos**: evaluar f, evaluar f′, aplicar la fórmula y
calcular el error. La fórmula general va en `formula`, la sustitución con números en
`substitution` y el resultado en `result`:

```ts
{
  title: 'Aplicar la fórmula de Newton-Raphson',
  formula: "x_{n+1} = x_n - \\frac{f(x_n)}{f'(x_n)}",
  substitution: `${xn1} = ${n(x)} - \\frac{${n(fx)}}{${n(dfx)}}`,
  result: `${xn1} = ${n(xNext)}`,
}
```

**Los fallos también devuelven la traza**: `fail()` empaqueta los pasos acumulados hasta ese
momento.

```ts
if (dfx === 0) {
  steps.push({
    title: `Iteración ${i + 1}`,
    explanation: 'La derivada vale 0: …',
    children: evaluation,
  });
  return fail('zero-derivative', `La derivada se anula en x = ${formatNumber(x)} …`);
}
```

**El objeto `Calculator`** une todo. `example` es el caso del libro:

```ts
export const newtonRaphson: Calculator<NewtonRaphsonInput, NewtonRaphsonValue, NewtonRaphsonErrorCode> = {
  meta: {
    id: 'newton-raphson',                    // = id en data/curriculum.ts
    title: 'Método de Newton-Raphson',
    summary: '…',
    citations: [{ sourceId: 'chapra-canale-2000', locator: 'Cap. 6, sección 6.2, Ejemplos 6.3 y 6.5' }, …],
  },
  inputSchema: newtonRaphsonInputSchema,
  example: { expression: 'e^(-x) - x', x0: 0, tolerance: 0.00005, maxIterations: 20 },
  solve: solveNewtonRaphson,
};
```

No hace falta registrar la lógica en ningún lado:
[`lib/calculators/contract.test.ts`](../lib/calculators/contract.test.ts) encuentra el archivo
solo y verifica que el id exista en el currículum, que las citas sean válidas y que el ejemplo
se resuelva con pasos.

### 3. UI: [`NewtonRaphson.tsx`](../components/calculators/metodos-numericos/NewtonRaphson.tsx)

Solo los campos. `CalculatorForm` se encarga del estado, de validar con `inputSchema`, de
precargar `example`, de llamar a `solve()` y de dibujar el resultado con `CalculatorLayout`:

```tsx
'use client';

export default function NewtonRaphson() {
  return (
    <CalculatorForm calculator={newtonRaphson}>
      <ExpressionField
        name="expression"
        label={<Formula tex="f(x)" />}
        previewPrefix="f(x) ="
        hint={FUNCTION_HINT}
      />
      <NumberField
        name="x0"
        label={
          <>
            Valor inicial <Formula tex="x_0" />
          </>
        }
      />
      <IterationFields /> {/* tolerancia + máx. iteraciones */}
    </CalculatorForm>
  );
}
```

Los campos disponibles están en
[`components/calculators/form/fields.tsx`](../components/calculators/form/fields.tsx):
`NumberField`, `ExpressionField` (con vista previa en LaTeX; admite varias variables, p. ej.
`f(x, y)`), `SelectField`, `TextField` (texto corto), `TextAreaField` (listas de datos) e
`IterationFields`. Para matrices y vectores de probabilidad están `MatrixField` (cuadrada),
`RectangularMatrixField` (m × n, p. ej. una matriz de pagos) y `OptionalVectorField` en
[`form/MatrixField.tsx`](../components/calculators/form/MatrixField.tsx). Para listas de filas
con varias columnas (actividades de un proyecto, arcos de una red, niveles de precio) está
[`form/TableField.tsx`](../components/calculators/form/TableField.tsx), que valida cada celda
con el schema de un arreglo de objetos. Todos leen el formulario con `useFormContext`, así que
solo necesitan el `name` del campo del schema. `NumberField` usa `type="text"` con `inputMode="decimal"` y
`parseDecimal`, no `type="number"`: en teclados configurados en español, `type="number"`
puede rechazar la coma.

Si varias calculadoras comparten campos, agrúpalos en un componente. Por ejemplo,
[`BracketingFields.tsx`](../components/calculators/metodos-numericos/BracketingFields.tsx) lo
usan bisección y falsa posición.

### 4. Registro: [`registry.ts`](../components/calculators/registry.ts)

```ts
export const calculatorRegistry = {
  // Métodos Numéricos
  'newton-raphson': () => import('./metodos-numericos/NewtonRaphson'),
};
```

Con esta línea, la calculadora aparece como ✅ en el home, en la materia y en el tema, y se
genera `/metodos-numericos/raices-de-ecuaciones/newton-raphson/`.

### 5. Cierre

```bash
pnpm docs:pensum   # PENSUM.md: Newton-Raphson → ✅ Implementada
pnpm check         # typecheck + lint + formato + tests
git commit -m "feat(metodos-numericos): agregar calculadora de Newton-Raphson"
```

**Archivos tocados en total**: `newton-raphson.ts`, `newton-raphson.test.ts`,
`NewtonRaphson.tsx`, una línea en `registry.ts` y `PENSUM.md` regenerado. Los helpers de
`lib/math/` (`expression.ts`, `parseDecimal`) se crearon con el piloto; las próximas
calculadoras de raíces (bisección, falsa posición, secante) los reutilizan sin cambios.
