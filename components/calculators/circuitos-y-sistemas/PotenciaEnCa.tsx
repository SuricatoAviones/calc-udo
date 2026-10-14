'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { potenciaEnCa } from '@/lib/calculators/circuitos-y-sistemas/potencia-en-ca';

function KnownFields() {
  const { control } = useFormContext();
  const given = useWatch({ control, name: 'given' }) as 'vi' | 'vz' | 'iz';
  const values = useWatch({ control, name: 'values' }) as 'amplitud' | 'eficaz';
  const suffix = values === 'eficaz' ? 'ef' : 'm';
  return (
    <>
      {given !== 'iz' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            name="vMag"
            label={
              <>
                <Formula tex={`|\\mathbf{V}| = V_{${suffix}}`} /> (V)
              </>
            }
          />
          <NumberField
            name="vAngle"
            label={
              <>
                <Formula tex="\theta_v" /> (°)
              </>
            }
          />
        </div>
      )}
      {given !== 'vz' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            name="iMag"
            label={
              <>
                <Formula tex={`|\\mathbf{I}| = I_{${suffix}}`} /> (A)
              </>
            }
          />
          <NumberField
            name="iAngle"
            label={
              <>
                <Formula tex="\theta_i" /> (°)
              </>
            }
          />
        </div>
      )}
      {given !== 'vi' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="resistance" label="R (Ω)" hint="Parte real de Z." />
          <NumberField
            name="reactance"
            label="X (Ω)"
            hint="Parte imaginaria: + inductiva, − capacitiva."
          />
        </div>
      )}
    </>
  );
}

export default function PotenciaEnCa() {
  return (
    <CalculatorForm calculator={potenciaEnCa}>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="given"
          label="Datos conocidos"
          options={[
            { value: 'vi', label: 'Voltaje y corriente' },
            { value: 'vz', label: 'Voltaje e impedancia' },
            { value: 'iz', label: 'Corriente e impedancia' },
          ]}
        />
        <SelectField
          name="values"
          label="Los módulos son"
          options={[
            { value: 'amplitud', label: 'Amplitudes (pico)' },
            { value: 'eficaz', label: 'Valores eficaces (rms)' },
          ]}
        />
      </div>
      <KnownFields />
      <NumberField
        name="omega"
        label={
          <>
            <Formula tex="\omega" /> (rad/s)
          </>
        }
        hint="Solo afecta las gráficas de p(t), v(t) e i(t)."
      />
    </CalculatorForm>
  );
}
