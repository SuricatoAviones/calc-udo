'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { gananciaDeMason } from '@/lib/calculators/sistemas-dinamicos/ganancia-de-mason';
import { GraphFields } from './GraphFields';

export default function GananciaDeMason() {
  return (
    <CalculatorForm calculator={gananciaDeMason}>
      <GraphFields />
    </CalculatorForm>
  );
}
