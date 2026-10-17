'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { sintonizacionPid } from '@/lib/calculators/sistemas-dinamicos/sintonizacion-pid';
import { TransferField } from './fields';

function MethodFields() {
  const { control } = useFormContext();
  const method = useWatch({ control, name: 'method' }) as 'curva' | 'oscilacion' | 'planta';
  if (method === 'curva') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="delay"
          label={
            <>
              <Formula tex="L" /> (s)
            </>
          }
          hint="Tiempo de retardo."
        />
        <NumberField
          name="timeConstant"
          label={
            <>
              <Formula tex="T" /> (s)
            </>
          }
          hint="Constante de tiempo."
        />
      </div>
    );
  }
  if (method === 'oscilacion') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="criticalGain"
          label={<Formula tex="K_{cr}" />}
          hint="Ganancia crítica."
        />
        <NumberField
          name="criticalPeriod"
          label={
            <>
              <Formula tex="P_{cr}" /> (s)
            </>
          }
          hint="Periodo de la oscilación."
        />
      </div>
    );
  }
  return <TransferField name="plant" label="Planta G(s)" prefix="G(s) =" />;
}

export default function SintonizacionPid() {
  return (
    <CalculatorForm calculator={sintonizacionPid}>
      <SelectField
        name="method"
        label="Regla de Ziegler-Nichols"
        options={[
          { value: 'planta', label: 'Segundo método con la planta G(s)' },
          { value: 'oscilacion', label: 'Segundo método con Kcr y Pcr' },
          { value: 'curva', label: 'Primer método (curva en S: L y T)' },
        ]}
      />
      <MethodFields />
      <SelectField
        name="controller"
        label="Controlador"
        options={[
          { value: 'PID', label: 'PID' },
          { value: 'PI', label: 'PI' },
          { value: 'P', label: 'P' },
        ]}
      />
    </CalculatorForm>
  );
}
