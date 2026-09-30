'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField } from '@/components/calculators/form/fields';
import { multistep } from '@/lib/calculators/metodos-numericos/metodos-multipaso';
import { OdeFields } from './OdeFields';

export default function Multistep() {
  return (
    <CalculatorForm calculator={multistep}>
      <OdeFields />
      <SelectField
        name="method"
        label="Método"
        options={[
          { value: 'ab2', label: 'Adams-Bashforth de 2 pasos' },
          { value: 'ab3', label: 'Adams-Bashforth de 3 pasos' },
          { value: 'ab4', label: 'Adams-Bashforth de 4 pasos' },
          { value: 'adams4', label: 'Adams de 4.º orden (Bashforth + Moulton)' },
          { value: 'milne', label: 'Milne (predictor-corrector)' },
        ]}
      />
      <SelectField
        name="start"
        label="Valores de arranque"
        hint="Los métodos multipaso necesitan puntos anteriores al actual."
        options={[
          { value: 'rk4', label: 'Primeros pasos con Runge-Kutta de 4.º orden' },
          { value: 'exacta', label: 'Solución exacta antes de x₀ (como en el libro)' },
        ]}
      />
    </CalculatorForm>
  );
}
