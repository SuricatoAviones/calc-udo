'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField } from '@/components/calculators/form/fields';
import { differenceTable } from '@/lib/calculators/metodos-numericos/tabla-de-diferencias';
import { PointsFields } from './PointsFields';

export default function DifferenceTable() {
  return (
    <CalculatorForm calculator={differenceTable}>
      <SelectField
        name="kind"
        label="Tipo de diferencias"
        options={[
          { value: 'adelante', label: 'Hacia adelante Δ (x igualmente espaciados)' },
          { value: 'divididas', label: 'Divididas f[x₀, x₁, …]' },
        ]}
      />
      <PointsFields />
    </CalculatorForm>
  );
}
