'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import {
  ExpressionField,
  IterationFields,
  NumberField,
  SelectField,
} from '@/components/calculators/form/fields';
import { steepestDescent } from '@/lib/calculators/metodos-numericos/descenso-mas-rapido';

export default function SteepestDescent() {
  return (
    <CalculatorForm calculator={steepestDescent}>
      <ExpressionField
        name="expression"
        variables={['x', 'y']}
        label={<Formula tex="f(x, y)" />}
        previewPrefix="f(x, y) ="
        hint={
          <>
            Usa <code>x</code> e <code>y</code>. Ej.: <code>2x*y + 2x - x^2 - 2y^2</code>,{' '}
            <code>(x - 1)^2 + 4(y + 2)^2</code>.
          </>
        }
      />
      <SelectField
        name="goal"
        label="Objetivo"
        options={[
          { value: 'minimizar', label: 'Minimizar (descenso más rápido)' },
          { value: 'maximizar', label: 'Maximizar (ascenso más rápido)' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="x0" label={<Formula tex="x_0" />} />
        <NumberField name="y0" label={<Formula tex="y_0" />} />
      </div>
      <IterationFields />
    </CalculatorForm>
  );
}
