'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { bigM } from '@/lib/calculators/optimizacion-de-operaciones/metodo-m-grande';
import { LpFields } from './LpFields';

export default function BigM() {
  return (
    <CalculatorForm calculator={bigM}>
      <LpFields />
    </CalculatorForm>
  );
}
