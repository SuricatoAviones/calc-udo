'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import {
  ExpressionField,
  FUNCTION_HINT,
  IterationFields,
  NumberField,
} from '@/components/calculators/form/fields';
import { newtonRaphson } from '@/lib/calculators/metodos-numericos/newton-raphson';

export default function NewtonRaphson() {
  return (
    <CalculatorForm calculator={newtonRaphson}>
      <ExpressionField
        name="expression"
        label={<Formula tex="f(x)" />}
        previewPrefix="f(x) ="
        hint={FUNCTION_HINT}
      />
      <NumberField
        name="x0"
        label={
          <>
            Valor inicial <Formula tex="x_0" />
          </>
        }
        hint="Un punto cercano a la raíz. Puedes usar coma o punto decimal."
      />
      <IterationFields />
    </CalculatorForm>
  );
}
