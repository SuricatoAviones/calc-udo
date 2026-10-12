'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { CircuitBuilderField } from './CircuitBuilderField';
import { LoadSelectField } from './LoadSelectField';
import { theveninNorton } from '@/lib/calculators/circuitos-y-sistemas/thevenin-norton';

export default function TheveninNorton() {
  return (
    <CalculatorForm calculator={theveninNorton}>
      <CircuitBuilderField name="circuit" />
      <LoadSelectField />
    </CalculatorForm>
  );
}
