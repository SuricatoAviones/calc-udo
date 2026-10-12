'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { CircuitBuilderField } from './CircuitBuilderField';
import { analisisDeMallas } from '@/lib/calculators/circuitos-y-sistemas/analisis-de-mallas';

export default function AnalisisDeMallas() {
  return (
    <CalculatorForm calculator={analisisDeMallas}>
      <CircuitBuilderField name="circuit" />
    </CalculatorForm>
  );
}
