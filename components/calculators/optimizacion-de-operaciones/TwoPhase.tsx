'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { twoPhase } from '@/lib/calculators/optimizacion-de-operaciones/metodo-dos-fases';
import { LpFields } from './LpFields';

export default function TwoPhase() {
  return (
    <CalculatorForm calculator={twoPhase}>
      <LpFields />
    </CalculatorForm>
  );
}
