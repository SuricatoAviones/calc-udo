'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { exponential } from '@/lib/calculators/estadistica-1/distribucion-exponencial';
import { ContinuousQueryFields } from './ContinuousQueryFields';

function ParameterFields() {
  const { control } = useFormContext();
  const byRate = useWatch({ control, name: 'parameter' }) === 'tasa';
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField
        name="parameter"
        label="Parámetro"
        options={[
          { value: 'media', label: 'Media β' },
          { value: 'tasa', label: 'Tasa λ' },
        ]}
      />
      <NumberField
        name="value"
        label={byRate ? <Formula tex="\lambda" /> : <Formula tex="\beta" />}
        hint={byRate ? 'Eventos por unidad de tiempo.' : 'Tiempo medio hasta el evento.'}
      />
    </div>
  );
}

export default function Exponential() {
  return (
    <CalculatorForm calculator={exponential}>
      <ParameterFields />
      <ContinuousQueryFields />
    </CalculatorForm>
  );
}
