'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import {
  ExpressionField,
  FUNCTION_HINT,
  NumberField,
  SelectField,
} from '@/components/calculators/form/fields';
import { numericalDerivative } from '@/lib/calculators/metodos-numericos/derivacion-numerica';

export default function NumericalDerivative() {
  return (
    <CalculatorForm calculator={numericalDerivative}>
      <ExpressionField
        name="expression"
        label={<Formula tex="f(x)" />}
        previewPrefix="f(x) ="
        hint={FUNCTION_HINT}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="x"
          label={
            <>
              Punto <Formula tex="x_i" />
            </>
          }
        />
        <NumberField name="h" label="Paso h" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          name="derivative"
          label="Derivada"
          options={[
            { value: 'primera', label: "Primera f'(x)" },
            { value: 'segunda', label: "Segunda f''(x)" },
          ]}
        />
        <SelectField
          name="accuracy"
          label="Exactitud"
          options={[
            { value: 'basica', label: 'Básica: O(h) y centrada O(h²)' },
            { value: 'alta', label: 'Alta: O(h²) y centrada O(h⁴)' },
          ]}
        />
      </div>
    </CalculatorForm>
  );
}
