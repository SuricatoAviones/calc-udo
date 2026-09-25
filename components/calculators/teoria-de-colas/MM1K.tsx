'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { mm1k } from '@/lib/calculators/teoria-de-colas/mm1k';
import { RateFields } from './RateFields';

export default function MM1K() {
  return (
    <CalculatorForm calculator={mm1k}>
      <RateFields />
      <NumberField
        name="capacity"
        label="Capacidad del sistema K"
        integer
        hint="Máximo de clientes en el sistema, contando al que se atiende. Con 4 lugares de espera y 1 servidor, K = 5."
      />
    </CalculatorForm>
  );
}
