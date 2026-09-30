'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { taylorOde } from '@/lib/calculators/metodos-numericos/metodo-de-taylor';
import { OdeFields } from './OdeFields';

export default function TaylorOde() {
  return (
    <CalculatorForm calculator={taylorOde}>
      <OdeFields />
      <NumberField
        name="order"
        label="Orden del método (1 a 4)"
        integer
        hint="Orden 1 es el método de Euler. Cada orden agrega un término de la serie de Taylor."
      />
    </CalculatorForm>
  );
}
