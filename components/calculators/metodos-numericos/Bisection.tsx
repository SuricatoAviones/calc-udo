'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { bisection } from '@/lib/calculators/metodos-numericos/bisection';
import { BracketingFields } from './BracketingFields';

export default function Bisection() {
  return (
    <CalculatorForm calculator={bisection}>
      <BracketingFields />
    </CalculatorForm>
  );
}
