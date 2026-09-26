'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { binaryRepresentation } from '@/lib/calculators/logica-formal-y-algoritmos/representacion-binaria';

export default function BinaryRepresentation() {
  return (
    <CalculatorForm calculator={binaryRepresentation}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="value"
          label={
            <>
              Entero <Formula tex="x" />
            </>
          }
          integer
          hint="Positivo o negativo."
        />
        <NumberField
          name="bits"
          label={
            <>
              Bits <Formula tex="n" />
            </>
          }
          integer
          hint="De 2 a 32."
        />
      </div>
    </CalculatorForm>
  );
}
