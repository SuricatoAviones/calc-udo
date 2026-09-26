'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { standardForm } from '@/lib/calculators/optimizacion-de-operaciones/forma-estandar';
import { LpFields } from './LpFields';

export default function StandardForm() {
  return (
    <CalculatorForm calculator={standardForm}>
      <LpFields />
    </CalculatorForm>
  );
}
