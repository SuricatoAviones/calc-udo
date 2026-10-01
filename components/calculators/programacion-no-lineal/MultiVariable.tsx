'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { multiVariable } from '@/lib/calculators/programacion-no-lineal/optimizacion-varias-variables';
import { ObjectiveField, PointField } from './NlpFields';

export default function MultiVariable() {
  return (
    <CalculatorForm calculator={multiVariable}>
      <ObjectiveField name="expression" label="Función f(x1, x2, …)" />
      <PointField
        name="start"
        label="Punto inicial (opcional)"
        hint="Para el método de Newton; vacío = origen. Si la función tiene varios puntos estacionarios, cambia el punto inicial."
      />
    </CalculatorForm>
  );
}
