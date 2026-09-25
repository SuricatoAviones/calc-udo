'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { TextAreaField } from '@/components/calculators/form/fields';
import { descriptiveMeasures } from '@/lib/calculators/estadistica-1/descriptive-measures';

export default function DescriptiveMeasures() {
  return (
    <CalculatorForm calculator={descriptiveMeasures}>
      <TextAreaField
        name="data"
        label="Datos de la muestra"
        rows={5}
        hint="Sepáralos con espacios, saltos de línea, punto y coma o coma y espacio. Puedes usar coma decimal (0,5) y pegar una columna de Excel."
      />
    </CalculatorForm>
  );
}
