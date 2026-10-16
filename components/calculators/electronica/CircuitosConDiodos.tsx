'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { circuitosConDiodos } from '@/lib/calculators/electronica/circuitos-con-diodos';
import { QuantityField, QuantityHint } from './QuantityField';

function ModelFields() {
  const { control } = useFormContext();
  const model = useWatch({ control, name: 'model' }) as 'ideal' | 'segunda' | 'tercera' | 'real';
  if (model === 'ideal') return null;
  if (model === 'real') {
    return (
      <div className="grid grid-cols-3 gap-3">
        <QuantityField
          name="is"
          unit="A"
          label={
            <>
              <Formula tex="I_S" /> (A)
            </>
          }
          hint="Corriente de saturación inversa."
        />
        <NumberField name="n" label="n" hint="Factor de idealidad (1 a 2)." />
        <NumberField
          name="vt"
          label={
            <>
              <Formula tex="V_T" /> (V)
            </>
          }
          hint="26 mV a temperatura ambiente."
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField
        name="vk"
        label={
          <>
            <Formula tex="V_K" /> (V)
          </>
        }
        hint="0.7 V silicio, 0.3 V germanio. Para varios diodos en serie, suma sus V_K."
      />
      {model === 'tercera' && (
        <QuantityField
          name="rb"
          unit="Ω"
          label={
            <>
              <Formula tex="r_B" /> (Ω)
            </>
          }
          hint="Resistencia interna del diodo."
        />
      )}
    </div>
  );
}

export default function CircuitosConDiodos() {
  return (
    <CalculatorForm calculator={circuitosConDiodos}>
      <p className="text-muted-foreground text-xs">
        Circuito serie: fuente de cd E, resistencia R y un diodo (o varios en serie).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="source" label="E (V)" />
        <QuantityField name="resistance" unit="Ω" label="R (Ω)" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="orientation"
          label="Diodo"
          options={[
            { value: 'directa', label: 'En el sentido de E (directa)' },
            { value: 'inversa', label: 'Contra E (inversa)' },
          ]}
        />
        <SelectField
          name="model"
          label="Modelo"
          options={[
            { value: 'ideal', label: 'Ideal' },
            { value: 'segunda', label: 'Segunda aproximación (V_K)' },
            { value: 'tercera', label: 'Tercera aproximación (V_K + r_B)' },
            { value: 'real', label: 'Real (Shockley)' },
          ]}
        />
      </div>
      <ModelFields />
      <QuantityHint />
    </CalculatorForm>
  );
}
