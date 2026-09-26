'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { logicalEquivalence } from '@/lib/calculators/logica-formal-y-algoritmos/equivalencia-logica';
import { FormulaField } from './FormulaField';

export default function Equivalence() {
  return (
    <CalculatorForm calculator={logicalEquivalence}>
      <FormulaField name="left" label="Proposición A" />
      <FormulaField
        name="right"
        label="Proposición B"
        hint="Se comparan las dos columnas fila por fila."
      />
    </CalculatorForm>
  );
}
