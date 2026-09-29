'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, TextAreaField } from '@/components/calculators/form/fields';
import { frequencyTable } from '@/lib/calculators/estadistica-1/tabla-de-frecuencias';

export default function FrequencyTable() {
  return (
    <CalculatorForm calculator={frequencyTable}>
      <TextAreaField
        name="data"
        label="Datos"
        rows={5}
        hint="Sepáralos con espacios, saltos de línea, punto y coma o coma y espacio. Escríbelos con los decimales con que se midieron: de ahí salen los límites de clase."
      />
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="classes" label="Clases k" integer optional />
        <NumberField name="start" label="Inicio" optional />
        <NumberField name="width" label="Ancho c" optional />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Opcionales. Vacíos: k por la regla de Sturges, inicio en el dato menor y c = rango/k
        redondeado hacia arriba.
      </p>
    </CalculatorForm>
  );
}
