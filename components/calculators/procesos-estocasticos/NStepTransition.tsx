'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { MatrixField, OptionalVectorField } from '@/components/calculators/form/MatrixField';
import { NumberField } from '@/components/calculators/form/fields';
import { nStepTransition } from '@/lib/calculators/procesos-estocasticos/n-step-transition';

export default function NStepTransition() {
  return (
    <CalculatorForm calculator={nStepTransition}>
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
      <NumberField name="steps" label="Número de pasos n" integer />
      <OptionalVectorField
        name="initial"
        sizeFrom="P"
        toggleLabel="Calcular también la distribución después de n pasos"
        label={
          <>
            Distribución inicial <Formula tex="a^{(0)}" />
          </>
        }
        hint="Probabilidad de empezar en cada estado. Debe sumar 1."
      />
    </CalculatorForm>
  );
}
