'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { poisson } from '@/lib/calculators/estadistica-1/poisson';
import { DiscreteQueryFields } from './DiscreteQueryFields';

export default function Poisson() {
  return (
    <CalculatorForm calculator={poisson}>
      <NumberField
        name="lambda"
        label={
          <>
            Media <Formula tex="\lambda" /> (= λt)
          </>
        }
        hint="Promedio de eventos en el intervalo. Si te dan una tasa, multiplícala por la duración del intervalo."
      />
      <DiscreteQueryFields />
    </CalculatorForm>
  );
}
