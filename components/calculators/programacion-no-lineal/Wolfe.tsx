'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { wolfe } from '@/lib/calculators/programacion-no-lineal/metodo-de-wolfe';
import { ConstraintsField, ObjectiveField, SenseField } from './NlpFields';

export default function Wolfe() {
  return (
    <CalculatorForm calculator={wolfe}>
      <SenseField />
      <ObjectiveField label="Función objetivo cuadrática" prefix="z =" />
      <ConstraintsField hint="Restricciones lineales AX ≤ b con b ≥ 0, p. ej. x1 + 2x2 <= 2. La no negatividad X ≥ 0 se asume." />
    </CalculatorForm>
  );
}
