'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { respuestaPrimerOrden } from '@/lib/calculators/circuitos-y-sistemas/respuesta-primer-orden';

function CircuitFields() {
  const { control } = useFormContext();
  const rc = useWatch({ control, name: 'circuit' }) !== 'rl';
  const x = rc ? 'v_C' : 'i_L';
  const unit = rc ? 'V' : 'A';
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="resistance"
          label={
            <>
              <Formula tex="R_{eq}" /> (Ω)
            </>
          }
          hint={`Resistencia de Thévenin vista por el ${rc ? 'capacitor' : 'inductor'}, con las fuentes apagadas.`}
        />
        <NumberField name="storage" label={rc ? 'C (F)' : 'L (H)'} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="initial"
          label={
            <>
              <Formula tex={`${x}(0^{+})`} /> ({unit})
            </>
          }
          hint={
            rc
              ? 'Igual a v_C(0⁻): con cd, el capacitor es un abierto.'
              : 'Igual a i_L(0⁻): con cd, el inductor es un corto.'
          }
        />
        <NumberField
          name="final"
          label={
            <>
              <Formula tex={`${x}(\\infty)`} /> ({unit})
            </>
          }
          hint="Valor final con las fuentes de t > 0."
        />
      </div>
    </>
  );
}

export default function RespuestaPrimerOrden() {
  return (
    <CalculatorForm calculator={respuestaPrimerOrden}>
      <SelectField
        name="circuit"
        label="Circuito"
        options={[
          { value: 'rc', label: 'RC (variable v_C)' },
          { value: 'rl', label: 'RL (variable i_L)' },
        ]}
      />
      <CircuitFields />
      <NumberField
        name="time"
        label="Evaluar en t (s), opcional"
        hint="Tiempo medido desde la conmutación."
        optional
      />
    </CalculatorForm>
  );
}
