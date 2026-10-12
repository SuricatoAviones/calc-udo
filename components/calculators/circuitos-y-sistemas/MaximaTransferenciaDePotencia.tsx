'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { CircuitBuilderField } from './CircuitBuilderField';
import { LoadSelectField } from './LoadSelectField';
import { maximaTransferenciaDePotencia } from '@/lib/calculators/circuitos-y-sistemas/maxima-transferencia-de-potencia';

export default function MaximaTransferenciaDePotencia() {
  return (
    <CalculatorForm calculator={maximaTransferenciaDePotencia}>
      <CircuitBuilderField name="circuit" />
      <LoadSelectField />
    </CalculatorForm>
  );
}
