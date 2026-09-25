'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { euler } from '@/lib/calculators/metodos-numericos/ode-methods';
import { OdeFields } from './OdeFields';

export default function Euler() {
  return (
    <CalculatorForm calculator={euler}>
      <OdeFields />
    </CalculatorForm>
  );
}
