'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField, TextAreaField } from '@/components/calculators/form/fields';
import { sortAlgorithms } from '@/lib/calculators/logica-formal-y-algoritmos/algoritmos-de-ordenamiento';

export default function Sort() {
  return (
    <CalculatorForm calculator={sortAlgorithms}>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="method"
          label="Algoritmo"
          options={[
            { value: 'burbuja', label: 'Burbuja' },
            { value: 'seleccion', label: 'Selección' },
            { value: 'insercion', label: 'Inserción' },
          ]}
        />
        <SelectField
          name="order"
          label="Orden"
          options={[
            { value: 'ascendente', label: 'Ascendente' },
            { value: 'descendente', label: 'Descendente' },
          ]}
        />
      </div>
      <TextAreaField
        name="list"
        label="Lista"
        rows={2}
        hint="Entre 2 y 20 números separados por espacios o punto y coma."
      />
    </CalculatorForm>
  );
}
