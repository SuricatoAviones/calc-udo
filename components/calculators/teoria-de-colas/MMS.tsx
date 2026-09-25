'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { mms } from '@/lib/calculators/teoria-de-colas/mms';
import { RateFields } from './RateFields';

export default function MMS() {
  return (
    <CalculatorForm calculator={mms}>
      <RateFields />
      <NumberField name="servers" label="Número de servidores s" integer />
    </CalculatorForm>
  );
}
