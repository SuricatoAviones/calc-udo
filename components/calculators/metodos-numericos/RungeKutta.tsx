'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { rungeKutta } from '@/lib/calculators/metodos-numericos/ode-methods';
import { OdeFields } from './OdeFields';

export default function RungeKutta() {
  return (
    <CalculatorForm calculator={rungeKutta}>
      <OdeFields />
    </CalculatorForm>
  );
}
