'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { bernoulli } from '@/lib/calculators/estadistica-1/distribucion-bernoulli';
import { DiscreteQueryFields } from './DiscreteQueryFields';

export default function Bernoulli() {
  return (
    <CalculatorForm calculator={bernoulli}>
      <NumberField
        name="p"
        label="Probabilidad de éxito p"
        hint="X = 1 es éxito y X = 0 fracaso."
      />
      <DiscreteQueryFields />
    </CalculatorForm>
  );
}
