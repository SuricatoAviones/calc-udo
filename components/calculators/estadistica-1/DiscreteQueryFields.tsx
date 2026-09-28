'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { NumberField, SelectField } from '@/components/calculators/form/fields';

/**
 * Qué probabilidad calcular en una distribución discreta: P(X = k), P(X ≤ k)… `symbol` nombra el
 * valor de X en las opciones; la hipergeométrica y la de Pascal usan `x` porque en Walpole `k` es
 * un parámetro.
 */
export function DiscreteQueryFields({ symbol = 'k' }: { symbol?: string }) {
  const { control } = useFormContext();
  const query = useWatch({ control, name: 'query' }) as string | undefined;
  const between = query === 'entre';
  return (
    <>
      <SelectField
        name="query"
        label="Probabilidad a calcular"
        options={[
          { value: 'igual', label: `P(X = ${symbol})` },
          { value: 'menor-igual', label: `P(X ≤ ${symbol})` },
          { value: 'menor', label: `P(X < ${symbol})` },
          { value: 'mayor-igual', label: `P(X ≥ ${symbol})` },
          { value: 'mayor', label: `P(X > ${symbol})` },
          { value: 'entre', label: 'P(a ≤ X ≤ b)' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="k" label={between ? 'a' : symbol} integer />
        {between && <NumberField name="k2" label="b" integer optional />}
      </div>
    </>
  );
}
