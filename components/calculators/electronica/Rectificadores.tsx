'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { rectificadores } from '@/lib/calculators/electronica/rectificadores';
import { QuantityField, QuantityHint } from './QuantityField';

function SourceFields() {
  const { control } = useFormContext();
  const fromTransformer = useWatch({ control, name: 'input' }) === 'transformador';
  if (fromTransformer) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="v1rms"
          label={
            <>
              <Formula tex="V_{1(rms)}" /> (V)
            </>
          }
          hint="Tensión eficaz del primario (la red)."
        />
        <NumberField
          name="ratio"
          label={
            <>
              <Formula tex="N_1 : N_2" />
            </>
          }
          hint="Relación de espiras; 10 significa 10:1."
        />
      </div>
    );
  }
  return (
    <NumberField
      name="vp2"
      label={
        <>
          <Formula tex="V_{p2}" /> (V)
        </>
      }
      hint="Pico del secundario completo (en la derivación central, de extremo a extremo)."
    />
  );
}

export default function Rectificadores() {
  return (
    <CalculatorForm calculator={rectificadores}>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="type"
          label="Rectificador"
          options={[
            { value: 'media-onda', label: 'Media onda' },
            { value: 'derivacion-central', label: 'Onda completa con derivación central' },
            { value: 'puente', label: 'Puente (onda completa)' },
          ]}
        />
        <SelectField
          name="input"
          label="Datos de entrada"
          options={[
            { value: 'transformador', label: 'Red y transformador' },
            { value: 'pico', label: 'Pico del secundario' },
          ]}
        />
      </div>
      <SourceFields />
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          name="vk"
          label={
            <>
              <Formula tex="V_K" /> (V)
            </>
          }
          hint="0 para diodos ideales."
        />
        <NumberField name="f" label="f (Hz)" />
        <QuantityField
          name="rl"
          unit="Ω"
          optional
          label={
            <>
              <Formula tex="R_L" /> (Ω)
            </>
          }
          hint="Opcional: corrientes."
        />
      </div>
      <QuantityHint />
    </CalculatorForm>
  );
}
