'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { centralLimit } from '@/lib/calculators/estadistica-1/teorema-del-limite-central';

function MeanQueryFields() {
  const { control } = useFormContext();
  const between = useWatch({ control, name: 'query' }) === 'entre';
  return (
    <>
      <SelectField
        name="query"
        label="Probabilidad a calcular"
        options={[
          { value: 'menor', label: 'P(X̄ < x̄)' },
          { value: 'mayor', label: 'P(X̄ > x̄)' },
          { value: 'entre', label: 'P(a < X̄ < b)' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="x" label={between ? 'a' : 'x̄'} />
        {between && <NumberField name="x2" label="b" optional />}
      </div>
    </>
  );
}

export default function CentralLimit() {
  return (
    <CalculatorForm calculator={centralLimit}>
      <div className="grid grid-cols-3 gap-3">
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
              Desv. <Formula tex="\sigma" />
            </>
          }
        />
        <NumberField name="n" label="Muestra n" integer />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        μ y σ son de la población; X̄ es la media de una muestra de tamaño n.
      </p>
      <MeanQueryFields />
    </CalculatorForm>
  );
}
