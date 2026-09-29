'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { gamma } from '@/lib/calculators/estadistica-1/distribucion-gamma';
import { ContinuousQueryFields } from './ContinuousQueryFields';

export default function Gamma() {
  return (
    <CalculatorForm calculator={gamma}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="alpha"
          label={
            <>
              Forma <Formula tex="\alpha" />
            </>
          }
        />
        <NumberField
          name="beta"
          label={
            <>
              Escala <Formula tex="\beta" />
            </>
          }
          hint="Si te dan una tasa λ, β = 1/λ."
        />
      </div>
      <ContinuousQueryFields />
    </CalculatorForm>
  );
}
