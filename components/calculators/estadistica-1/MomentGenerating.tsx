'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { ExpressionField, NumberField } from '@/components/calculators/form/fields';
import { mgf } from '@/lib/calculators/estadistica-1/funcion-generadora-de-momentos';

export default function MomentGenerating() {
  return (
    <CalculatorForm calculator={mgf}>
      <ExpressionField
        name="expression"
        label={
          <>
            Función generadora <Formula tex="M_X(t)" />
          </>
        }
        variables={['t']}
        previewPrefix="M_X(t) ="
        hint={
          <>
            Usa <code>t</code> como variable. Ej.: binomial <code>(0.4 e^t + 0.6)^15</code>, Poisson{' '}
            <code>e^(4 (e^t - 1))</code>, gamma <code>(1 - 10t)^(-5)</code>.
          </>
        }
      />
      <NumberField name="moments" label="Momentos a calcular (1 a 4)" integer />
    </CalculatorForm>
  );
}
