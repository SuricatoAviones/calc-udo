'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { vogel } from '@/lib/calculators/optimizacion-de-operaciones/aproximacion-de-vogel';
import { TransportTableField } from './TransportTableField';

export default function Vogel() {
  return (
    <CalculatorForm calculator={vogel}>
      <TransportTableField />
    </CalculatorForm>
  );
}
