'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { simpsonRule } from '@/lib/calculators/metodos-numericos/simpson-rule';
import { IntegrationFields } from './IntegrationFields';

export default function SimpsonRule() {
  return (
    <CalculatorForm calculator={simpsonRule}>
      <IntegrationFields segmentsHint="n par: Simpson 1/3. n = 3: Simpson 3/8. n impar ≥ 5: 1/3 y 3/8 combinadas." />
    </CalculatorForm>
  );
}
