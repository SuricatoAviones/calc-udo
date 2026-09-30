'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { MatrixField } from '@/components/calculators/form/MatrixField';
import { SelectField } from '@/components/calculators/form/fields';
import { determinant } from '@/lib/calculators/metodos-numericos/determinante';

export default function Determinant() {
  return (
    <CalculatorForm calculator={determinant}>
      <MatrixField
        name="matrix"
        label={
          <>
            Matriz <Formula tex="A" />
          </>
        }
        min={1}
        max={8}
        unit="filas"
        item="una fila y una columna"
        hint="Matriz cuadrada. Acepta decimales con punto o coma."
      />
      <SelectField
        name="method"
        label="Método"
        hint="Por cofactores hasta 4 × 4. La eliminación de Gauss sirve para cualquier tamaño."
        options={[
          { value: 'cofactores', label: 'Expansión por cofactores' },
          { value: 'gauss', label: 'Eliminación de Gauss (producto de la diagonal)' },
        ]}
      />
    </CalculatorForm>
  );
}
