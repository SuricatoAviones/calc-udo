'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { dualProblem } from '@/lib/calculators/optimizacion-de-operaciones/problema-dual';
import { LpFields } from './LpFields';

export default function DualProblem() {
  return (
    <CalculatorForm calculator={dualProblem}>
      <LpFields />
    </CalculatorForm>
  );
}
