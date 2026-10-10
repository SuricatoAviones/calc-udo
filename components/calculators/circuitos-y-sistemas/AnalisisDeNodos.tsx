'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { CircuitBuilderField } from './CircuitBuilderField';
import { analisisDeNodos } from '@/lib/calculators/circuitos-y-sistemas/analisis-de-nodos';

export default function AnalisisDeNodos() {
  return (
    <CalculatorForm calculator={analisisDeNodos}>
      <CircuitBuilderField name="circuit" />
    </CalculatorForm>
  );
}
