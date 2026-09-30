'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { mg1 } from '@/lib/calculators/teoria-de-colas/cola-mg1';
import { RateFields } from './RateFields';

export default function MG1() {
  return (
    <CalculatorForm calculator={mg1}>
      <RateFields />
      <NumberField
        name="sigma"
        label={
          <>
            Desviación estándar del servicio <Formula tex="\sigma" />
          </>
        }
        hint="En la misma unidad de tiempo que λ y μ. Usa 0 si el servicio es constante (M/D/1)."
      />
    </CalculatorForm>
  );
}
