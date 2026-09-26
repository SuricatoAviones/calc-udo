'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField } from '@/components/calculators/form/fields';
import { RectangularMatrixField } from '@/components/calculators/form/MatrixField';
import { hungarian } from '@/lib/calculators/optimizacion-de-operaciones/metodo-hungaro';

export default function Hungarian() {
  return (
    <CalculatorForm calculator={hungarian}>
      <SelectField
        name="sense"
        label="Objetivo"
        options={[
          { value: 'min', label: 'Minimizar el costo total' },
          { value: 'max', label: 'Maximizar el valor total' },
        ]}
      />
      <RectangularMatrixField
        name="costs"
        label={
          <>
            Matriz de costos <Formula tex="c_{ij}" />
          </>
        }
        hint="Filas: los que se asignan (trabajadores, máquinas); columnas: las tareas. Si no es cuadrada se completa con filas o columnas ficticias de costo 0."
        rowPrefix="F"
        colPrefix="C"
        rowUnit="filas"
        colUnit="columnas"
        rowItem="una fila"
        colItem="una columna"
        min={1}
        max={8}
      />
    </CalculatorForm>
  );
}
