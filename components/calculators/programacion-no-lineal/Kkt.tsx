'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { kkt } from '@/lib/calculators/programacion-no-lineal/condiciones-kkt';
import { ConstraintsField, ObjectiveField, PointField, SenseField } from './NlpFields';

export default function Kkt() {
  return (
    <CalculatorForm calculator={kkt}>
      <SenseField />
      <ObjectiveField />
      <ConstraintsField hint="Incluye la no negatividad si el problema la tiene (x1 >= 0). Cada restricción se pasa a la forma g(X) ≤, ≥ o = 0." />
      <PointField name="point" label="Punto candidato X" />
    </CalculatorForm>
  );
}
