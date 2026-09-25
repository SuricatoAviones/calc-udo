'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { mm1 } from '@/lib/calculators/teoria-de-colas/mm1';
import { RateFields } from './RateFields';

export default function MM1() {
  return (
    <CalculatorForm calculator={mm1}>
      <RateFields />
    </CalculatorForm>
  );
}
