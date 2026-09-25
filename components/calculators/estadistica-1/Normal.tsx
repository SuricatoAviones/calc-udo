'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { normal } from '@/lib/calculators/estadistica-1/normal';

function NormalQueryFields() {
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

export default function Normal() {
  return (
    <CalculatorForm calculator={normal}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="mean"
          label={
            <>
              Media <Formula tex="\mu" />
            </>
          }
        />
        <NumberField
          name="sd"
          label={
            <>
              Desv. estándar <Formula tex="\sigma" />
            </>
          }
        />
      </div>
      <NormalQueryFields />
    </CalculatorForm>
  );
}
