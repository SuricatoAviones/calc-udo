'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField } from '@/components/calculators/form/fields';
import { rectangleRule } from '@/lib/calculators/metodos-numericos/rectangle-rule';
import { IntegrationFields } from './IntegrationFields';

export default function RectangleRule() {
  return (
    <CalculatorForm calculator={rectangleRule}>
      <IntegrationFields />
      <SelectField
        name="variant"
        label="Altura de cada rectángulo"
        options={[
          { value: 'punto-medio', label: 'Punto medio' },
          { value: 'izquierda', label: 'Extremo izquierdo' },
          { value: 'derecha', label: 'Extremo derecho' },
        ]}
      />
    </CalculatorForm>
  );
}
