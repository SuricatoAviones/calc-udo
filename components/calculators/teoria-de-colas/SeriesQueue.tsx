'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { seriesQueue } from '@/lib/calculators/teoria-de-colas/colas-en-serie';
import { StationsField } from './StationsField';

export default function SeriesQueue() {
  return (
    <CalculatorForm calculator={seriesQueue}>
      <NumberField
        name="lambda"
        label={
          <>
            Llegadas a la primera estación <Formula tex="\lambda" />
          </>
        }
      />
      <StationsField />
    </CalculatorForm>
  );
}
