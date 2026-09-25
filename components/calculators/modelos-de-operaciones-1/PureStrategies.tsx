'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { pureStrategies } from '@/lib/calculators/modelos-de-operaciones-1/estrategias-puras';
import { PayoffMatrixField } from './PayoffMatrixField';

export default function PureStrategies() {
  return (
    <CalculatorForm calculator={pureStrategies}>
      <PayoffMatrixField />
    </CalculatorForm>
  );
}
