'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { compensadorAdelantoRetraso } from '@/lib/calculators/sistemas-dinamicos/compensador-adelanto-retraso';
import { TransferField } from './fields';

type Mode = 'lgr-adelanto' | 'lgr-atraso' | 'bode-adelanto' | 'bode-atraso';

function ModeFields() {
  const { control } = useFormContext();
  const mode = useWatch({ control, name: 'mode' }) as Mode;
  if (mode === 'lgr-adelanto') {
    return (
      <>
        <p className="text-muted-foreground text-xs">Polos dominantes deseados en lazo cerrado:</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="zeta" label={<Formula tex="\zeta" />} />
          <NumberField
            name="omegaN"
            label={
              <>
                <Formula tex="\omega_n" /> (rad/s)
              </>
            }
          />
        </div>
      </>
    );
  }
  if (mode === 'lgr-atraso') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="lagBeta"
          label={<Formula tex="\beta" />}
          hint="Factor en que crece la constante de error."
        />
        <NumberField name="lagZero" label="Cero en s = −" hint="Cerca del origen (p. ej. 0.05)." />
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="errorConstant"
          label="Constante de error"
          hint="Kp, Kv o Ka según el tipo de G(s)."
        />
        <NumberField name="phaseMargin" label="Margen de fase (°)" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="allowance"
          label="Margen adicional (°)"
          hint={mode === 'bode-adelanto' ? 'Ogata suma unos 5°.' : 'Entre 5° y 12°.'}
        />
        <NumberField
          name="crossover"
          label={
            <>
              <Formula tex="\omega_c" /> (opcional)
            </>
          }
          optional
          hint="Fija la nueva frecuencia de cruce."
        />
      </div>
      {mode === 'bode-adelanto' ? (
        <NumberField
          name="leadPhase"
          label={
            <>
              <Formula tex="\phi_m" /> (°, opcional)
            </>
          }
          optional
          hint="Adelanto máximo elegido; si falta se calcula."
        />
      ) : (
        <NumberField
          name="zeroFrequency"
          label="Cero en ω = (opcional)"
          optional
          hint="Por defecto, una década por debajo de ωc."
        />
      )}
    </>
  );
}

export default function CompensadorAdelantoRetraso() {
  return (
    <CalculatorForm calculator={compensadorAdelantoRetraso}>
      <SelectField
        name="mode"
        label="Diseño"
        options={[
          { value: 'bode-adelanto', label: 'Adelanto por el diagrama de Bode' },
          { value: 'bode-atraso', label: 'Atraso por el diagrama de Bode' },
          { value: 'lgr-adelanto', label: 'Adelanto por el lugar de las raíces' },
          { value: 'lgr-atraso', label: 'Atraso por el lugar de las raíces' },
        ]}
      />
      <TransferField name="plant" label="Planta G(s)" prefix="G(s) =" />
      <ModeFields />
    </CalculatorForm>
  );
}
