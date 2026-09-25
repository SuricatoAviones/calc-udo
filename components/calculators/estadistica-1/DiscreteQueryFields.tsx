'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { NumberField, SelectField } from '@/components/calculators/form/fields';

/** Qué probabilidad calcular en una distribución discreta: P(X = k), P(X ≤ k)… */
export function DiscreteQueryFields() {
  const { control } = useFormContext();
  const query = useWatch({ control, name: 'query' }) as string | undefined;
  const between = query === 'entre';
  return (
    <>
      <SelectField
        name="query"
        label="Probabilidad a calcular"
        options={[
          { value: 'igual', label: 'P(X = k)' },
          { value: 'menor-igual', label: 'P(X ≤ k)' },
          { value: 'menor', label: 'P(X < k)' },
          { value: 'mayor-igual', label: 'P(X ≥ k)' },
          { value: 'mayor', label: 'P(X > k)' },
          { value: 'entre', label: 'P(a ≤ X ≤ b)' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="k" label={between ? 'a' : 'k'} integer />
        {between && <NumberField name="k2" label="b" integer optional />}
      </div>
    </>
  );
}
