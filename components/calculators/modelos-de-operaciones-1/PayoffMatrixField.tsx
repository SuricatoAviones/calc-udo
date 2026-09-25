'use client';

import { Formula } from '@/components/calculators/Formula';
import { RectangularMatrixField } from '@/components/calculators/form/MatrixField';

/** Matriz de pagos del jugador A (filas) contra B (columnas). */
export function PayoffMatrixField() {
  return (
    <RectangularMatrixField
      name="payoff"
      label={
        <>
          Matriz de pagos <Formula tex="a_{ij}" />
        </>
      }
      hint="Cada entrada es lo que gana A (filas) si B (columnas) usa esa estrategia; un número negativo es lo que A pierde."
      rowPrefix="A"
      colPrefix="B"
      rowUnit="filas (A)"
      colUnit="col. (B)"
      min={1}
      max={8}
    />
  );
}
