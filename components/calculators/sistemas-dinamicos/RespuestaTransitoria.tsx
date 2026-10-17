'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { respuestaTransitoria } from '@/lib/calculators/sistemas-dinamicos/respuesta-transitoria';
import { TransferField } from './fields';

function OrderFields() {
  const { control } = useFormContext();
  const order = useWatch({ control, name: 'order' }) as
    'primer-orden' | 'segundo-orden' | 'general';
  if (order === 'general')
    return <TransferField name="transfer" label="G(s) (en lazo cerrado)" prefix="G(s) =" />;
  if (order === 'primer-orden') {
    return (
      <>
        <p className="text-muted-foreground text-xs">
          <Formula tex="G(s) = \frac{K}{Ts + 1}" />
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="gain" label={<Formula tex="K" />} />
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
      </>
    );
  }
  return (
    <>
      <p className="text-muted-foreground text-xs">
        <Formula tex="G(s) = \frac{K\omega_n^2}{s^2 + 2\zeta\omega_ns + \omega_n^2}" />
      </p>
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="zeta" label={<Formula tex="\zeta" />} hint="Amortiguamiento." />
        <NumberField
          name="omegaN"
          label={
            <>
              <Formula tex="\omega_n" /> (rad/s)
            </>
          }
        />
        <NumberField name="gain" label={<Formula tex="K" />} />
      </div>
    </>
  );
}

export default function RespuestaTransitoria() {
  return (
    <CalculatorForm calculator={respuestaTransitoria}>
      <SelectField
        name="order"
        label="Sistema"
        options={[
          { value: 'primer-orden', label: 'Primer orden K/(Ts + 1)' },
          { value: 'segundo-orden', label: 'Segundo orden (ζ, ωₙ)' },
          { value: 'general', label: 'Cualquier G(s)' },
        ]}
      />
      <OrderFields />
      <SelectField
        name="input"
        label="Entrada"
        options={[
          { value: 'escalon', label: 'Escalón unitario' },
          { value: 'impulso', label: 'Impulso unitario' },
          { value: 'rampa', label: 'Rampa unitaria' },
          { value: 'aceleracion', label: 'Parábola (aceleración) t²/2' },
        ]}
      />
    </CalculatorForm>
  );
}
