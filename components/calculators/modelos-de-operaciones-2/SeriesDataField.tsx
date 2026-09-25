'use client';

import { Formula } from '@/components/calculators/Formula';
import { TextAreaField } from '@/components/calculators/form/fields';

/** Datos de una serie de tiempo, del periodo 1 en adelante. */
export function SeriesDataField() {
  return (
    <TextAreaField
      name="data"
      label={
        <>
          Datos de la serie <Formula tex="Y_1, Y_2, \ldots" />
        </>
      }
      rows={3}
      hint="En orden, del periodo 1 al último. Sepáralos con espacios, saltos de línea o punto y coma; puedes pegar una columna de Excel."
    />
  );
}
