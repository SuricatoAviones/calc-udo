'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextField } from '@/components/calculators/form/fields';
import { syntheticDivisionCalculator } from '@/lib/calculators/metodos-numericos/division-sintetica';

export default function SyntheticDivision() {
  return (
    <CalculatorForm calculator={syntheticDivisionCalculator}>
      <TextField
        name="coefficients"
        label="Coeficientes de P(x)"
        placeholder="1 2 -24"
        hint="De mayor a menor grado, separados por espacios. Escribe 0 para los términos que faltan: x³ − 1 es 1 0 0 -1."
      />
      <NumberField name="r" label="r (se divide entre x − r)" />
      <SelectField
        name="mode"
        label="¿Qué hacer?"
        options={[
          { value: 'dividir', label: 'Dividir entre (x − r)' },
          { value: 'transformar', label: 'Transformar a potencias de (x − r)' },
        ]}
      />
    </CalculatorForm>
  );
}
