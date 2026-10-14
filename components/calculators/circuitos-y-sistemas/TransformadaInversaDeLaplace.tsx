'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { ExpressionField } from '@/components/calculators/form/fields';
import { transformadaInversaDeLaplace } from '@/lib/calculators/circuitos-y-sistemas/transformada-inversa-de-laplace';

export default function TransformadaInversaDeLaplace() {
  return (
    <CalculatorForm calculator={transformadaInversaDeLaplace}>
      <ExpressionField
        name="expression"
        label="F(s)"
        variables={['s']}
        previewPrefix="F(s) ="
        hint={
          <>
            Cociente de polinomios en <code>s</code>, factorizado o no:{' '}
            <code>(s + 3)/(s^2 + 7s + 10)</code>, <code>4/((s+1)^2 (s+2))</code>. Los retardos se
            escriben <code>e^(-2s)</code>.
          </>
        }
      />
    </CalculatorForm>
  );
}
