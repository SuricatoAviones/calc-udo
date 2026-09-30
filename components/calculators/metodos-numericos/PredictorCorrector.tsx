'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { IterationFields, SelectField } from '@/components/calculators/form/fields';
import { predictorCorrector } from '@/lib/calculators/metodos-numericos/predictor-corrector';
import { OdeFields } from './OdeFields';

function Fields() {
  const { control } = useFormContext();
  const midpoint = useWatch({ control, name: 'predictor' }) === 'punto-medio';
  return (
    <>
      <OdeFields />
      <SelectField
        name="predictor"
        label="Predictor"
        options={[
          { value: 'euler', label: 'Euler (Heun con corrector iterado)' },
          { value: 'punto-medio', label: 'Punto medio (Heun sin autoinicio)' },
        ]}
      />
      {midpoint && (
        <SelectField
          name="start"
          label="Valor anterior y₋₁"
          options={[
            { value: 'exacta', label: 'De la solución exacta en x₀ − h (como en el libro)' },
            { value: 'rk4', label: 'Primer paso con Runge-Kutta de 4.º orden' },
          ]}
        />
      )}
      <IterationFields />
      <p className="text-muted-foreground -mt-2 text-xs">
        El corrector se repite en cada paso hasta que εa &lt; εs o hasta el máximo de iteraciones.
      </p>
    </>
  );
}

export default function PredictorCorrector() {
  return (
    <CalculatorForm calculator={predictorCorrector}>
      <Fields />
    </CalculatorForm>
  );
}
