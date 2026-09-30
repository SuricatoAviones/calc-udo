'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { leastSquares } from '@/lib/calculators/metodos-numericos/minimos-cuadrados';
import { PointsFields } from './PointsFields';

export default function LeastSquares() {
  return (
    <CalculatorForm calculator={leastSquares}>
      <PointsFields />
      <NumberField
        name="degree"
        label="Grado del polinomio m"
        integer
        hint="1 para una recta, 2 para una parábola…"
      />
    </CalculatorForm>
  );
}
