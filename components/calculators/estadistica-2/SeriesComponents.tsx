'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, TextAreaField } from '@/components/calculators/form/fields';
import { seriesComponents } from '@/lib/calculators/estadistica-2/componentes-de-series-de-tiempo';

export function SeriesDataFields() {
  return (
    <>
      <TextAreaField
        name="data"
        label="Datos de la serie, en orden"
        hint="Un valor por periodo, separados por espacios o saltos de línea."
      />
      <NumberField
        name="season"
        integer
        label="Periodos por ciclo estacional"
        hint="4 para trimestres, 12 para meses; 0 si no hay estacionalidad."
      />
    </>
  );
}

export default function SeriesComponents() {
  return (
    <CalculatorForm calculator={seriesComponents}>
      <SeriesDataFields />
    </CalculatorForm>
  );
}
