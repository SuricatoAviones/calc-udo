'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { CircuitBuilderField } from './CircuitBuilderField';
import { superposicion } from '@/lib/calculators/circuitos-y-sistemas/superposicion';

export default function Superposicion() {
  return (
    <CalculatorForm calculator={superposicion}>
      <CircuitBuilderField name="circuit" />
    </CalculatorForm>
  );
}
