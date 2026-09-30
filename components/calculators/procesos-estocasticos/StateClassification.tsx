'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { MatrixField } from '@/components/calculators/form/MatrixField';
import { stateClassification } from '@/lib/calculators/procesos-estocasticos/clasificacion-de-estados';

export default function StateClassification() {
  return (
    <CalculatorForm calculator={stateClassification}>
      <MatrixField
        name="P"
        label={
          <>
            Matriz de transición <Formula tex="P" />
          </>
        }
        hint="Fila i, columna j: probabilidad de pasar del estado i al j. Cada fila suma 1."
        showRowSums
      />
    </CalculatorForm>
  );
}
