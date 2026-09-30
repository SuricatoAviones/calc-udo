'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField } from '@/components/calculators/form/fields';
import { gaussElimination } from '@/lib/calculators/metodos-numericos/eliminacion-gaussiana';
import { LinearSystemField } from './LinearSystemField';

export default function GaussElimination() {
  return (
    <CalculatorForm calculator={gaussElimination}>
      <LinearSystemField
        name="system"
        label="Sistema de ecuaciones [A | b]"
        hint="Cada fila es una ecuación: los coeficientes de x₁, x₂, … y, después de la línea, el lado derecho."
      />
      <SelectField
        name="pivoting"
        label="Pivoteo"
        options={[
          { value: 'parcial', label: 'Pivoteo parcial (recomendado)' },
          { value: 'ninguno', label: 'Sin pivoteo (Gauss simple)' },
        ]}
      />
    </CalculatorForm>
  );
}
