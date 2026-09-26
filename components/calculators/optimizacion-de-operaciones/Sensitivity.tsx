'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { sensitivity } from '@/lib/calculators/optimizacion-de-operaciones/analisis-de-sensibilidad';
import { LpFields } from './LpFields';

export default function Sensitivity() {
  return (
    <CalculatorForm calculator={sensitivity}>
      <LpFields />
    </CalculatorForm>
  );
}
