# Documentación de CalcUDO

## ¿Qué es CalcUDO?

Una aplicación web open source de **calculadoras académicas** para estudiantes de Ingeniería de
Sistemas de la Universidad de Oriente (UDO). Está organizada igual que el pensum:
**materia → tema → calculadora**.

Lo que la distingue de otras calculadoras en línea es que **muestra el procedimiento**. Cada
calculadora devuelve la traza completa del método: iteraciones, sustituciones y fórmulas
renderizadas con KaTeX. También cita el libro y la sección de donde sale el método. La idea es
que un estudiante pueda:

1. **Estudiar**: ver cómo avanza el método paso a paso.
2. **Verificar**: comparar su ejercicio hecho a mano contra cada paso, no solo contra el
   resultado final.
3. **Ir a la fuente**: saber en qué libro de la bibliografía oficial consultar el método.

Hoy cubre la rama matemática/cuantitativa del pensum. La estructura está pensada para agregar
otras ramas sin refactorizar.

### Principios

- **Correctitud ante todo.** Un resultado incorrecto le hace daño real a un estudiante. Toda
  función matemática tiene tests, y los valores esperados salen de ejemplos resueltos en la
  bibliografía citada, no de cálculos propios sin contraste.
- **El currículum es data.** Lo que existe y lo que falta se describe en `data/curriculum.ts`.
- **Lógica pura separada de la UI.** El cálculo no sabe nada de React.
- **Agregar una calculadora es mecánico.** Si no lo es, la abstracción está mal.

## Índice

| Documento                                                                  | Para qué sirve                                                                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [ARQUITECTURA.md](ARQUITECTURA.md)                                         | Stack y por qué cada pieza, estructura de carpetas, el contrato común de calculadoras y el flujo de datos. |
| [CONTRIBUTING.md](CONTRIBUTING.md)                                         | Setup local, estándares de código, tests, convención de commits y proceso de PR.                           |
| [NUEVA-CALCULADORA.md](NUEVA-CALCULADORA.md)                               | **Checklist paso a paso para implementar una calculadora**, con Newton-Raphson como ejemplo completo.      |
| [PENSUM.md](PENSUM.md)                                                     | Mapa materia → tema → calculadora con el estado de cada una. Se genera automáticamente.                    |
| [DECISIONES.md](DECISIONES.md)                                             | Registro de decisiones de arquitectura (ADRs): qué se decidió, por qué y qué se descartó.                  |
| [GLOSARIO.md](GLOSARIO.md)                                                 | Términos matemáticos que aparecen en el código y en la UI, para contribuir a un tema que no dominas.       |
| [fuentes/pensum-rama-cuantitativa.md](fuentes/pensum-rama-cuantitativa.md) | Copia literal del pensum. **Fuente de verdad** del currículum.                                             |

## ¿Por dónde empiezo?

- **Quiero usar la app**: no necesitas nada de esto; entra al sitio.
- **Quiero agregar una calculadora**: lee [CONTRIBUTING.md](CONTRIBUTING.md) y luego
  [NUEVA-CALCULADORA.md](NUEVA-CALCULADORA.md). Elige una en estado 🗺️ Roadmap en
  [PENSUM.md](PENSUM.md).
- **Quiero entender o cambiar la arquitectura**: [ARQUITECTURA.md](ARQUITECTURA.md) y
  [DECISIONES.md](DECISIONES.md).
- **Encontré un resultado incorrecto**: abre un issue con la entrada, el resultado de CalcUDO,
  el resultado esperado y la fuente (libro, página y ejemplo). Es la contribución más valiosa.
