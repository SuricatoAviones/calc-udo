'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { binomial } from '@/lib/calculators/estadistica-1/binomial';
import { DiscreteQueryFields } from './DiscreteQueryFields';

export default function Binomial() {
  return (
    <CalculatorForm calculator={binomial}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="n" label="Ensayos n" integer />
        <NumberField name="p" label="Probabilidad de éxito p" />
      </div>
      <DiscreteQueryFields />
    </CalculatorForm>
  );
}
