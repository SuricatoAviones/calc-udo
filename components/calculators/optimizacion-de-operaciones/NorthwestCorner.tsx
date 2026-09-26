'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { northwestCorner } from '@/lib/calculators/optimizacion-de-operaciones/esquina-noroeste';
import { TransportTableField } from './TransportTableField';

export default function NorthwestCorner() {
  return (
    <CalculatorForm calculator={northwestCorner}>
      <TransportTableField />
    </CalculatorForm>
  );
}
