'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { truthTable } from '@/lib/calculators/logica-formal-y-algoritmos/tablas-de-verdad';
import { FormulaField } from './FormulaField';

export default function TruthTable() {
  return (
    <CalculatorForm calculator={truthTable}>
      <FormulaField name="formula" label="Proposición" />
    </CalculatorForm>
  );
}
