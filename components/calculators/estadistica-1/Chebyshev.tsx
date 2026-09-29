'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { chebyshev } from '@/lib/calculators/estadistica-1/desigualdad-de-chebyshev';

function ChebyshevFields() {
  const { control } = useFormContext();
  const variance = useWatch({ control, name: 'dispersionType' }) === 'varianza';
  const mode = useWatch({ control, name: 'mode' }) as string | undefined;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="mean"
          label={
            <>
              Media <Formula tex="\mu" />
            </>
          }
        />
        <SelectField
          name="dispersionType"
          label="Dispersión dada"
          options={[
            { value: 'desviacion', label: 'Desviación σ' },
            { value: 'varianza', label: 'Varianza σ²' },
          ]}
        />
      </div>
      <NumberField
        name="dispersion"
        label={variance ? <Formula tex="\sigma^2" /> : <Formula tex="\sigma" />}
      />
      <SelectField
        name="mode"
        label="Qué acotar"
        options={[
          { value: 'intervalo', label: 'P(a < X < b), al menos…' },
          { value: 'fuera', label: 'P(|X − μ| ≥ c), a lo sumo…' },
          { value: 'k', label: 'P(μ − kσ < X < μ + kσ), dado k' },
        ]}
      />
      {mode === 'intervalo' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="lower" label="a" optional />
          <NumberField name="upper" label="b" optional />
        </div>
      )}
      {mode === 'fuera' && <NumberField name="distance" label="Distancia c a la media" optional />}
      {mode === 'k' && <NumberField name="k" label="Desviaciones estándar k" optional />}
    </>
  );
}

export default function Chebyshev() {
  return (
    <CalculatorForm calculator={chebyshev}>
      <ChebyshevFields />
    </CalculatorForm>
  );
}
