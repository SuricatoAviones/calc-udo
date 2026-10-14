'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { fasoresEImpedancia } from '@/lib/calculators/circuitos-y-sistemas/fasores-e-impedancia';

export default function FasoresEImpedancia() {
  return (
    <CalculatorForm calculator={fasoresEImpedancia}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">
          Fuente <Formula tex="v(t) = V_m\cos(\omega t + \theta)" />
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            name="amplitude"
            label={
              <>
                Amplitud <Formula tex="V_m" /> (V)
              </>
            }
          />
          <NumberField
            name="phase"
            label={
              <>
                Fase <Formula tex="\theta" /> (°)
              </>
            }
          />
          <SelectField
            name="form"
            label="Función"
            options={[
              { value: 'cos', label: 'coseno' },
              { value: 'sin', label: 'seno' },
            ]}
          />
          <NumberField
            name="omega"
            label={
              <>
                <Formula tex="\omega" /> (rad/s)
              </>
            }
            hint="ω = 2πf."
          />
        </div>
      </fieldset>
      <SelectField
        name="connection"
        label="Conexión de los elementos"
        options={[
          { value: 'serie', label: 'En serie' },
          { value: 'paralelo', label: 'En paralelo' },
        ]}
      />
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="resistance" label="R (Ω)" />
        <NumberField name="inductance" label="L (H)" />
        <NumberField name="capacitance" label="C (F)" />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Escribe 0 en los elementos que no están en el circuito.
      </p>
    </CalculatorForm>
  );
}
