<p align="center">
  <img src="public/logo-udo.webp" alt="Logo de la Universidad de Oriente" width="120" height="120">
</p>

# CalcUDO

**Calculadoras académicas con el procedimiento paso a paso** para estudiantes de Ingeniería de
Sistemas de la Universidad de Oriente (UDO), Venezuela.

Organizadas por materia → tema → calculadora siguiendo el pensum oficial: Newton-Raphson,
Simplex, modelos de colas M/M/1, regresión lineal, cadenas de Markov, entre otras.

El diferenciador no es el resultado, es **el procedimiento**. Cada calculadora muestra cada
paso con sus fórmulas renderizadas y cita el libro del que sale el método. Sirve para estudiar
y para verificar ejercicios hechos a mano, no como una caja negra.

> Proyecto comunitario y open source. **No es un sitio oficial de la UDO.**

## Inicio rápido

Requisitos: Node.js 22 o superior y [pnpm](https://pnpm.io) 11.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # tests de la lógica matemática
pnpm check        # typecheck + lint + formato + tests (lo mismo que se exige en un PR)
pnpm build        # sitio estático en out/
```

## Instalar como app (PWA)

CalcUDO es instalable y funciona sin conexión (ADR-040). En Android/Chrome aparece el botón
**Instalar**; en iPhone/iPad se agrega desde **Compartir → Añadir a pantalla de inicio**.

El service worker guarda al instalar el armazón del sitio (~5 MB). El botón **Guardar sin
conexión** del pie descarga además todas las calculadoras (~25 MB) con su avance; cualquier
página que visites queda disponible sin red aunque no lo uses. Cuando hay una versión nueva se
avisa con **Actualizar**, sin recargar sola.

`pnpm build` genera `out/` y `out/sw-precache.js` (la lista de archivos a cachear, calculada del
propio build). `pnpm sw:precache` la regenera sin volver a compilar. En `pnpm dev` el service
worker no se registra: para probarlo, usa `pnpm build && pnpm start`.

## Documentación

Toda la documentación está en [`docs/`](docs/README.md), en español:

- [Arquitectura](docs/ARQUITECTURA.md): cómo está construido y por qué.
- [Cómo contribuir](docs/CONTRIBUTING.md).
- [**Cómo agregar una calculadora**](docs/NUEVA-CALCULADORA.md): la guía más importante.
- [Pensum y estado de las calculadoras](docs/PENSUM.md) y [roadmap](docs/ROADMAP.md).
- [Decisiones de diseño](docs/DECISIONES.md) y [glosario](docs/GLOSARIO.md).

Los cambios de cada versión están en el [CHANGELOG](CHANGELOG.md).

## Licencia

[MIT](LICENSE).
