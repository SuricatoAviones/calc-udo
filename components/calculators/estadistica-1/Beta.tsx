'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { beta } from '@/lib/calculators/estadistica-1/distribucion-beta';
import { ContinuousQueryFields } from './ContinuousQueryFields';

export default function Beta() {
  return (
    <CalculatorForm calculator={beta}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="alpha" label={<Formula tex="\alpha" />} />
        <NumberField name="beta" label={<Formula tex="\beta" />} />
      </div>
      <p className="text-muted-foreground text-xs">
        X es una proporción: toma valores entre 0 y 1.
      </p>
      <ContinuousQueryFields />
    </CalculatorForm>
  );
}
