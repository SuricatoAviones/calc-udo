'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { newtonInterpolation } from '@/lib/calculators/metodos-numericos/interpolacion-de-newton';
import { PointsFields } from './PointsFields';

export default function NewtonInterpolation() {
  return (
    <CalculatorForm calculator={newtonInterpolation}>
      <SelectField
        name="method"
        label="Fórmula"
        options={[
          { value: 'divididas', label: 'Diferencias divididas (cualquier espaciado)' },
          { value: 'adelante', label: 'Diferencias hacia adelante (x igualmente espaciados)' },
        ]}
      />
      <PointsFields hint="El orden importa: el polinomio de grado k usa los primeros k + 1 puntos. Separa los valores con espacios o saltos de línea." />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="point" label="Interpolar en x =" />
        <NumberField
          name="trueValue"
          label="Valor verdadero (opcional)"
          optional
          hint="Para calcular εt."
        />
      </div>
    </CalculatorForm>
  );
}
