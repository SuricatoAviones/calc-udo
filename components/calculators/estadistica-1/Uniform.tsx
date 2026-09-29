'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { uniform } from '@/lib/calculators/estadistica-1/distribucion-uniforme';
import { ContinuousQueryFields } from './ContinuousQueryFields';

export default function Uniform() {
  return (
    <CalculatorForm calculator={uniform}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="lower" label="Límite inferior A" />
        <NumberField name="upper" label="Límite superior B" />
      </div>
      <ContinuousQueryFields />
    </CalculatorForm>
  );
}
