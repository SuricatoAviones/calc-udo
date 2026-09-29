'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextField } from '@/components/calculators/form/fields';
import { samplingDistributions } from '@/lib/calculators/estadistica-1/distribuciones-muestrales';

export default function SamplingDistributions() {
  return (
    <CalculatorForm calculator={samplingDistributions}>
      <TextField
        name="population"
        label="Población (todos sus elementos)"
        placeholder="2 3 6 8 11"
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="n" label="Tamaño de la muestra n" integer />
        <SelectField
          name="replacement"
          label="Muestreo"
          options={[
            { value: 'con', label: 'Con reemplazo' },
            { value: 'sin', label: 'Sin reemplazo' },
          ]}
        />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Se enumeran todas las muestras posibles (hasta 20 000), así que la población debe ser
        pequeña.
      </p>
    </CalculatorForm>
  );
}
