'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import {
  ExpressionField,
  FUNCTION_HINT,
  IterationFields,
  NumberField,
} from '@/components/calculators/form/fields';
import { secant } from '@/lib/calculators/metodos-numericos/secant';

export default function Secant() {
  return (
    <CalculatorForm calculator={secant}>
      <ExpressionField
        name="expression"
        label={<Formula tex="f(x)" />}
        previewPrefix="f(x) ="
        hint={FUNCTION_HINT}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="xPrev"
          label={
            <>
              Valor inicial <Formula tex="x_{-1}" />
            </>
          }
        />
        <NumberField
          name="x0"
          label={
            <>
              Valor inicial <Formula tex="x_0" />
            </>
          }
        />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        No hace falta que f cambie de signo entre ellos, pero el método puede diverger.
      </p>
      <IterationFields />
    </CalculatorForm>
  );
}
