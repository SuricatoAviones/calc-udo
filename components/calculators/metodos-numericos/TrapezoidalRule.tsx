'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { trapezoidalRule } from '@/lib/calculators/metodos-numericos/trapezoidal-rule';
import { IntegrationFields } from './IntegrationFields';

export default function TrapezoidalRule() {
  return (
    <CalculatorForm calculator={trapezoidalRule}>
      <IntegrationFields segmentsHint="Con n = 1 es la regla simple; con n > 1, la de aplicación múltiple." />
    </CalculatorForm>
  );
}
