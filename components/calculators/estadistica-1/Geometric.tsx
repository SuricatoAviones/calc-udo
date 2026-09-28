'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { geometric } from '@/lib/calculators/estadistica-1/distribucion-geometrica';
import { DiscreteQueryFields } from './DiscreteQueryFields';

export default function Geometric() {
  return (
    <CalculatorForm calculator={geometric}>
      <NumberField
        name="p"
        label="Probabilidad de éxito p"
        hint="En cada ensayo. X es el número del ensayo en que ocurre el primer éxito (1, 2, 3, …)."
      />
      <DiscreteQueryFields symbol="x" />
    </CalculatorForm>
  );
}
