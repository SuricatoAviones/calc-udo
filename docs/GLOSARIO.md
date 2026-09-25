# Glosario

Términos que aparecen en el código, en la UI o en el pensum. Está pensado para que alguien pueda
contribuir a una calculadora de un tema que no domina. **No sustituye al libro**: cada
calculadora cita su fuente.

Convención: **término (en UI)** · `nombreEnCódigo` · símbolo, cuando aplica.

## Transversales (usados por muchas calculadoras)

| Término                   | Código               | Símbolo | Significado                                                                                                                                                                |
| ------------------------- | -------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Iteración**             | `iteration`, `n`     | n       | Una repetición de la fórmula de un método iterativo. La iteración 0 es el valor inicial.                                                                                   |
| **Valor inicial**         | `x0`                 | x₀      | Punto de partida de un método iterativo.                                                                                                                                   |
| **Tolerancia**            | `tolerance`          | ε, εₛ   | Umbral de error por debajo del cual se considera que el método convergió. En CalcUDO se compara contra el **error relativo porcentual aproximado** (convención de Chapra). |
| **Máximo de iteraciones** | `maxIterations`      | —       | Límite de seguridad: si se alcanza sin cumplir la tolerancia, el método **no convergió**.                                                                                  |
| **Convergencia**          | `converged`          | —       | Que las aproximaciones se acerquen a la solución hasta cumplir la tolerancia.                                                                                              |
| **Error absoluto**        | `absoluteError`      | Eₐ      | \|valor actual − valor anterior\| (aproximado) o \|valor verdadero − aproximación\| (verdadero).                                                                           |
| **Error relativo**        | `relativeError`      | εₐ      | Error absoluto dividido entre \|valor actual\|. Multiplicado por 100 es el **error relativo porcentual**.                                                                  |
| **Error verdadero**       | `trueError`          | Eₜ, εₜ  | Error medido contra el valor exacto, cuando se conoce.                                                                                                                     |
| **Cifras significativas** | `significantFigures` | —       | Dígitos confiables de un número. Con εₛ = 0.5 × 10^(2−n) % se garantizan al menos n cifras (Scarborough, citado en Chapra).                                                |
| **Error de truncamiento** | —                    | —       | Error por aproximar un procedimiento matemático exacto (por ejemplo, cortar una serie de Taylor).                                                                          |
| **Error de redondeo**     | —                    | —       | Error por representar números con una cantidad finita de dígitos.                                                                                                          |
| **Traza**                 | `Trace`              | —       | En CalcUDO: todo lo que `solve()` devuelve para explicar el procedimiento (pasos, tablas, series y avisos).                                                                |
| **Paso**                  | `Step`               | —       | Una unidad del procedimiento: fórmula general, sustitución con números y resultado.                                                                                        |

## Métodos Numéricos

| Término                         | Código               | Símbolo                  | Significado                                                                                                                                                                                     |
| ------------------------------- | -------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Raíz**                        | `root`               | xᵣ                       | Valor de x donde f(x) = 0.                                                                                                                                                                      |
| **Método cerrado**              | —                    | —                        | Parte de un intervalo [a, b] con f(a)·f(b) < 0 (cambio de signo). Siempre converge. Ejemplos: bisección y falsa posición.                                                                       |
| **Método abierto**              | —                    | —                        | Parte de uno o dos puntos sin exigir un intervalo. Converge más rápido, pero puede divergir. Ejemplos: Newton y secante.                                                                        |
| **Newton-Raphson**              | `newtonRaphson`      | —                        | xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ). Usa la recta tangente. Converge cuadráticamente cerca de una raíz simple. Falla si f′(xₙ) = 0.                                                                        |
| **Derivada simbólica**          | `derivative`         | f′(x)                    | Derivada obtenida algebraicamente (con mathjs), no aproximada numéricamente.                                                                                                                    |
| **Pivoteo parcial**             | `partialPivoting`    | —                        | En eliminación gaussiana: intercambiar filas para usar como pivote el elemento de mayor valor absoluto de la columna. Reduce el error de redondeo y evita dividir entre cero.                   |
| **División sintética**          | `syntheticDivision`  | —                        | Esquema de Ruffini para dividir un polinomio entre (x − r).                                                                                                                                     |
| **Diferencias finitas**         | —                    | Δ, ∇, δ                  | Operadores hacia adelante (Δ), hacia atrás (∇) y centrales (δ) sobre datos equiespaciados.                                                                                                      |
| **Interpolación**               | —                    | Pₙ(x)                    | Polinomio que pasa exactamente por los datos.                                                                                                                                                   |
| **Mínimos cuadrados**           | `leastSquares`       | —                        | Ajuste que minimiza la suma de los cuadrados de los residuos. No pasa necesariamente por los datos.                                                                                             |
| **Paso** (EDO/integración)      | `h`                  | h                        | Ancho del subintervalo.                                                                                                                                                                         |
| **Problema de valor inicial**   | —                    | y′ = f(x, y), y(x₀) = y₀ | Ecuación diferencial con condición inicial. Se resuelve con Euler, Runge-Kutta, etc.                                                                                                            |
| **Método cerrado** (bracketing) | `bracketing.ts`      | [xₗ, xᵤ]                 | Método que mantiene la raíz encerrada en un intervalo con cambio de signo: bisección y falsa posición comparten ese núcleo.                                                                     |
| **Regla de Newton-Cotes**       | `integration.ts`     | —                        | Familia de fórmulas de integración que reemplazan f por un polinomio fácil de integrar: rectángulo (grado 0), trapecio (1), Simpson 1/3 (2) y 3/8 (3).                                          |
| **Nodo** (integración)          | `IntegrationNode`    | xᵢ                       | Punto donde se evalúa f. Con n segmentos hay n + 1 nodos (trapecio, Simpson) o n (rectángulos).                                                                                                 |
| **Aplicación múltiple**         | `n`                  | n                        | Dividir [a, b] en n segmentos y aplicar la regla en cada uno; el error baja al aumentar n.                                                                                                      |
| **Predictor / corrector**       | `predictor`          | y⁰ᵢ₊₁                    | En Heun: el predictor es un paso de Euler; el corrector recalcula yᵢ₊₁ con la pendiente promedio.                                                                                               |
| **Euler modificado (Heun)**     | `modifiedEuler`      | —                        | Euler con pendiente promedio entre el inicio y el final del paso. Algunos textos llaman "Euler modificado" al método del punto medio; en CalcUDO es Heun sin iterar el corrector (ver ADR-013). |
| **Runge-Kutta de 4.º orden**    | `rungeKutta`         | k₁ … k₄                  | Promedio ponderado de cuatro pendientes por paso: (k₁ + 2k₂ + 2k₃ + k₄)/6. Exacto si la solución es un polinomio de grado ≤ 4.                                                                  |
| **Error global**                | `trueRelativeErrors` | εₜ                       | En EDO, error acumulado entre la solución exacta y la aproximada en un punto, sumando todos los pasos anteriores.                                                                               |

## Estadística y probabilidad

| Término                            | Código        | Símbolo    | Significado                                                                          |
| ---------------------------------- | ------------- | ---------- | ------------------------------------------------------------------------------------ |
| **Variable aleatoria**             | —             | X          | Función que asigna un número a cada resultado de un experimento.                     |
| **Función de masa / densidad**     | `pmf` / `pdf` | p(x), f(x) | Probabilidad puntual (discreta) o densidad (continua).                               |
| **Función de distribución**        | `cdf`         | F(x)       | P(X ≤ x).                                                                            |
| **Esperanza**                      | `mean`        | E[X], μ    | Promedio ponderado por probabilidad.                                                 |
| **Varianza**                       | `variance`    | Var(X), σ² | E[(X − μ)²].                                                                         |
| **Función generadora de momentos** | `mgf`         | M(t)       | E[e^{tX}]. Sus derivadas en t = 0 dan los momentos.                                  |
| **Máxima verosimilitud**           | `mle`         | θ̂          | Estimador que maximiza la probabilidad de haber observado la muestra.                |
| **Hipótesis nula / alternativa**   | —             | H₀ / H₁    | La afirmación que se contrasta / la que se acepta si se rechaza H₀.                  |
| **Error tipo I / II**              | —             | α / β      | Rechazar H₀ siendo cierta / no rechazarla siendo falsa.                              |
| **Potencia**                       | `power`       | 1 − β      | Probabilidad de rechazar H₀ cuando es falsa. El pensum la llama "función potencial". |
| **Nivel de confianza**             | `confidence`  | 1 − α      | Probabilidad de que el intervalo contenga al parámetro.                              |
| **Coeficiente de correlación**     | `r`           | r          | Mide la asociación lineal, en [−1, 1].                                               |

## Optimización (programación lineal y no lineal)

| Término                          | Código                 | Símbolo | Significado                                                                                         |
| -------------------------------- | ---------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| **Función objetivo**             | `objective`            | Z       | Lo que se maximiza o minimiza.                                                                      |
| **Variable de holgura / exceso** | `slack` / `surplus`    | sᵢ      | Convierten desigualdades ≤ / ≥ en igualdades (forma estándar).                                      |
| **Variable artificial**          | `artificial`           | Rᵢ      | Variable temporal para obtener una solución básica inicial (métodos M grande y dos fases).          |
| **Solución básica factible**     | —                      | SBF     | Vértice de la región factible. Simplex salta entre ellas.                                           |
| **Variable que entra / sale**    | `entering` / `leaving` | —       | Columna pivote (mejora Z) / fila pivote (prueba de la razón mínima).                                |
| **Precio sombra**                | `shadowPrice`          | yᵢ      | Cuánto mejora Z por cada unidad adicional de un recurso. Es el valor de la variable dual.           |
| **Dual**                         | —                      | —       | Problema asociado cuyo óptimo coincide con el del primal.                                           |
| **Lagrangiano**                  | —                      | L, λ    | f(x) − Σλᵢgᵢ(x). Los λ son los multiplicadores de Lagrange.                                         |
| **KKT**                          | `kkt`                  | —       | Condiciones de Karush-Kuhn-Tucker: necesarias para la optimalidad con restricciones de desigualdad. |
| **Hessiana**                     | `hessian`              | H       | Matriz de segundas derivadas. Su definitud clasifica los puntos críticos.                           |

## Procesos estocásticos y colas

| Término                                          | Código                     | Símbolo            | Significado                                                                                                  |
| ------------------------------------------------ | -------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Matriz de transición**                         | `transitionMatrix`         | P                  | pᵢⱼ = P(pasar del estado i al j en un paso). Cada fila suma 1.                                               |
| **Estado absorbente / recurrente / transitorio** | —                          | —                  | Del que no se sale / al que se vuelve con certeza / al que puede no volverse.                                |
| **Cadena ergódica**                              | —                          | —                  | Irreducible, aperiódica y recurrente positiva. Tiene una distribución de estado estable única.               |
| **Estado estable**                               | `steadyState`              | π                  | Distribución que cumple π = πP y Σπᵢ = 1.                                                                    |
| **Notación de Kendall**                          | —                          | A/B/s/K/N          | Llegadas / servicio / servidores / capacidad / población. M = markoviano (exponencial/Poisson), G = general. |
| **Tasa de llegada / servicio**                   | `lambda` / `mu`            | λ / μ              | Clientes que llegan / que atiende un servidor, por unidad de tiempo.                                         |
| **Factor de utilización**                        | `rho`                      | ρ                  | λ/(sμ). Con población infinita, el sistema es estable si ρ < 1.                                              |
| **Medidas de rendimiento**                       | `L`, `Lq`, `W`, `Wq`, `P0` | L, L_q, W, W_q, P₀ | Clientes en el sistema / en la cola, tiempo en el sistema / en la cola, probabilidad de sistema vacío.       |
| **Ley de Little**                                | —                          | L = λW             | Relación entre número promedio y tiempo promedio.                                                            |
| **Pérdida de Erlang**                            | —                          | —                  | Modelo sin espacio de espera: un cliente que llega con todos los servidores ocupados se pierde.              |
| **Red de Jackson**                               | —                          | —                  | Red de colas M/M/s con enrutamiento probabilístico. Cada estación se analiza por separado.                   |

## Teoría de sobrevivencia

| Término                            | Código        | Símbolo | Significado                                                                                              |
| ---------------------------------- | ------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| **Función de sobrevivencia**       | `survival`    | S(t)    | P(T > t): probabilidad de seguir funcionando después de t.                                               |
| **Función de falla**               | `failure`     | F(t)    | 1 − S(t).                                                                                                |
| **Función de riesgo**              | `hazard`      | h(t)    | Tasa instantánea de falla dado que sobrevivió hasta t.                                                   |
| **Dato censurado**                 | `censored`    | —       | Observación de la que solo se sabe que no falló hasta cierto tiempo.                                     |
| **Producto límite (Kaplan-Meier)** | `kaplanMeier` | Ŝ(t)    | Estimador no paramétrico de S(t) con datos censurados: producto de (1 − dᵢ/nᵢ).                          |
| **Tabla de vida**                  | —             | —       | Estimación de S(t) por intervalos (criterios de Kaplan-Meier, Elisa Lee o Ezio Bórean, según el pensum). |
