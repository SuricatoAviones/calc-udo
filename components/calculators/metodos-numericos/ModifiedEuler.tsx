'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { modifiedEuler } from '@/lib/calculators/metodos-numericos/ode-methods';
import { OdeFields } from './OdeFields';

export default function ModifiedEuler() {
  return (
    <CalculatorForm calculator={modifiedEuler}>
      <OdeFields />
    </CalculatorForm>
  );
}
