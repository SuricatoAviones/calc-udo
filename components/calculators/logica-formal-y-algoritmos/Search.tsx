'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextAreaField } from '@/components/calculators/form/fields';
import { searchAlgorithms } from '@/lib/calculators/logica-formal-y-algoritmos/algoritmos-de-busqueda';

export default function Search() {
  return (
    <CalculatorForm calculator={searchAlgorithms}>
      <SelectField
        name="method"
        label="Algoritmo"
        options={[
          { value: 'secuencial', label: 'Búsqueda secuencial' },
          { value: 'binaria', label: 'Búsqueda binaria' },
        ]}
      />
      <TextAreaField
        name="list"
        label="Lista"
        rows={2}
        hint="Hasta 40 números separados por espacios o punto y coma. Para la búsqueda binaria, ordenados de menor a mayor."
      />
      <NumberField
        name="target"
        label={
          <>
            Valor buscado <Formula tex="x" />
          </>
        }
      />
    </CalculatorForm>
  );
}
