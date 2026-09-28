'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { pascal } from '@/lib/calculators/estadistica-1/distribucion-de-pascal';
import { DiscreteQueryFields } from './DiscreteQueryFields';

export default function Pascal() {
  return (
    <CalculatorForm calculator={pascal}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="successes" label="Éxitos buscados k" integer />
        <NumberField name="p" label="Probabilidad de éxito p" />
      </div>
      <p className="text-muted-foreground text-xs">
        X es el número del ensayo en el que ocurre el éxito número k (k, k + 1, k + 2, …).
      </p>
      <DiscreteQueryFields symbol="x" />
    </CalculatorForm>
  );
}
