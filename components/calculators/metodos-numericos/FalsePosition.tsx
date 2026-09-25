'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { falsePosition } from '@/lib/calculators/metodos-numericos/false-position';
import { BracketingFields } from './BracketingFields';

export default function FalsePosition() {
  return (
    <CalculatorForm calculator={falsePosition}>
      <BracketingFields />
    </CalculatorForm>
  );
}
