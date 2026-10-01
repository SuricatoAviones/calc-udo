'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { lagrange } from '@/lib/calculators/programacion-no-lineal/multiplicadores-de-lagrange';
import { ConstraintsField, ObjectiveField, PointField } from './NlpFields';

export default function Lagrange() {
  return (
    <CalculatorForm calculator={lagrange}>
      <ObjectiveField />
      <ConstraintsField hint="Restricciones de igualdad, p. ej. x1 + x2 + 3x3 = 2. Debe haber menos restricciones que variables." />
      <PointField
        name="start"
        label="Punto inicial (opcional)"
        hint="Para resolver el sistema con Newton; vacío = origen."
      />
    </CalculatorForm>
  );
}
