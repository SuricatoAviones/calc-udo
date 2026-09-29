'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { weibull } from '@/lib/calculators/estadistica-1/distribucion-weibull';
import { ContinuousQueryFields } from './ContinuousQueryFields';

export default function Weibull() {
  return (
    <CalculatorForm calculator={weibull}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="alpha" label={<Formula tex="\alpha" />} />
        <NumberField
          name="beta"
          label={
            <>
              Forma <Formula tex="\beta" />
            </>
          }
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Densidad <Formula tex="f(x) = \alpha\beta x^{\beta-1} e^{-\alpha x^{\beta}}" />, como en
        Walpole y Meyer.
      </p>
      <ContinuousQueryFields />
    </CalculatorForm>
  );
}
