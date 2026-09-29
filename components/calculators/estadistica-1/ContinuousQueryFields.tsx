'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { NumberField, SelectField } from '@/components/calculators/form/fields';

/** Qué probabilidad calcular en una distribución continua: P(X < x), P(X > x) o P(a < X < b). */
export function ContinuousQueryFields() {
  const { control } = useFormContext();
  const between = useWatch({ control, name: 'query' }) === 'entre';
  return (
    <>
      <SelectField
        name="query"
        label="Probabilidad a calcular"
        options={[
          { value: 'menor', label: 'P(X < x)' },
          { value: 'mayor', label: 'P(X > x)' },
          { value: 'entre', label: 'P(a < X < b)' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="x" label={between ? 'a' : 'x'} />
        {between && <NumberField name="x2" label="b" optional />}
      </div>
    </>
  );
}
