'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { leastCost } from '@/lib/calculators/optimizacion-de-operaciones/costo-minimo';
import { TransportTableField } from './TransportTableField';

export default function LeastCost() {
  return (
    <CalculatorForm calculator={leastCost}>
      <TransportTableField />
    </CalculatorForm>
  );
}
