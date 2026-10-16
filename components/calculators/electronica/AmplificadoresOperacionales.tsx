'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import {
  amplificadoresOperacionales,
  type OpAmpInput,
} from '@/lib/calculators/electronica/amplificadores-operacionales';
import { QuantityField, QuantityHint } from './QuantityField';

const tex = (symbol: string, unit?: string) => (
  <>
    <Formula tex={symbol} />
    {unit ? ` (${unit})` : null}
  </>
);

const DESCRIPTION: Record<OpAmpInput['circuit'], string> = {
  inversor: 'V₁ entra por R₁ a la entrada inversora; R_f va de la salida a la entrada inversora.',
  'no-inversor':
    'V₁ entra por la entrada no inversora; R₁ va de la entrada inversora a tierra y R_f a la salida.',
  seguidor: 'La salida se une a la entrada inversora y V₁ entra por la no inversora.',
  sumador: 'Cada V_k entra por su R_k a la entrada inversora; R_f es la realimentación.',
  diferencial:
    'V₁ llega a la entrada no inversora por el divisor R₁–R₃; V₂ entra por R₂ a la inversora y R₄ es la realimentación (Boylestad, fig. 11.11).',
  comparador:
    'Sin realimentación: la salida se satura en ±V_sat según la entrada supere o no a V_ref.',
  schmitt:
    'Realimentación positiva. Inversor: v_in a la entrada inversora y el divisor R₁ (a tierra)–R₂ (a la salida) en la no inversora. No inversor: v_in entra por R₁ a la no inversora y R₂ va a la salida.',
};

function CircuitFields() {
  const { control } = useFormContext();
  const circuit = useWatch({ control, name: 'circuit' }) as OpAmpInput['circuit'];
  return (
    <>
      <p className="text-muted-foreground text-xs">{DESCRIPTION[circuit]}</p>
      {(circuit === 'inversor' || circuit === 'no-inversor') && (
        <div className="grid grid-cols-3 gap-3">
          <NumberField name="v1" label={tex('V_1', 'V')} />
          <QuantityField name="r1" unit="Ω" label={tex('R_1', 'Ω')} />
          <QuantityField name="rf" unit="Ω" label={tex('R_f', 'Ω')} />
        </div>
      )}
      {circuit === 'seguidor' && <NumberField name="v1" label={tex('V_1', 'V')} />}
      {circuit === 'sumador' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <NumberField name="v1" label={tex('V_1', 'V')} />
            <QuantityField name="r1" unit="Ω" label={tex('R_1', 'Ω')} />
            <NumberField name="v2" label={tex('V_2', 'V')} />
            <QuantityField name="r2" unit="Ω" label={tex('R_2', 'Ω')} />
            <NumberField name="v3" optional label={tex('V_3', 'V')} hint="Opcional." />
            <QuantityField name="r3" unit="Ω" optional label={tex('R_3', 'Ω')} hint="Opcional." />
          </div>
          <QuantityField name="rf" unit="Ω" label={tex('R_f', 'Ω')} />
        </>
      )}
      {circuit === 'diferencial' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="v1" label={tex('V_1', 'V')} />
          <NumberField name="v2" label={tex('V_2', 'V')} />
          <QuantityField name="r1" unit="Ω" label={tex('R_1', 'Ω')} />
          <QuantityField name="r3" unit="Ω" label={tex('R_3', 'Ω')} />
          <QuantityField name="r2" unit="Ω" label={tex('R_2', 'Ω')} />
          <QuantityField name="r4" unit="Ω" label={tex('R_4', 'Ω')} />
        </div>
      )}
      {circuit === 'comparador' && (
        <>
          <SelectField
            name="mode"
            label="Entrada de la señal"
            options={[
              { value: 'no-inversor', label: 'No inversora (V_ref en la inversora)' },
              { value: 'inversor', label: 'Inversora (V_ref en la no inversora)' },
            ]}
          />
          <div className="grid grid-cols-3 gap-3">
            <NumberField name="v1" label={tex('v_{in}', 'V')} />
            <NumberField name="vref" label={tex('V_{ref}', 'V')} />
            <NumberField
              name="vp"
              optional
              label={tex('V_p', 'V')}
              hint="Opcional: pico de una senoidal, para el ciclo de trabajo."
            />
          </div>
        </>
      )}
      {circuit === 'schmitt' && (
        <>
          <SelectField
            name="mode"
            label="Disparador"
            options={[
              { value: 'inversor', label: 'Inversor' },
              { value: 'no-inversor', label: 'No inversor' },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <QuantityField name="r1" unit="Ω" label={tex('R_1', 'Ω')} />
            <QuantityField name="r2" unit="Ω" label={tex('R_2', 'Ω')} />
          </div>
        </>
      )}
      <NumberField
        name="vsat"
        optional
        label={tex('V_{sat}', 'V')}
        hint={
          circuit === 'comparador' || circuit === 'schmitt'
            ? 'Nivel de la salida saturada (≈ 1 a 2 V menos que la alimentación).'
            : 'Opcional: la salida se recorta en ±V_sat.'
        }
      />
    </>
  );
}

export default function AmplificadoresOperacionales() {
  return (
    <CalculatorForm calculator={amplificadoresOperacionales}>
      <SelectField
        name="circuit"
        label="Circuito"
        options={[
          { value: 'inversor', label: 'Amplificador inversor' },
          { value: 'no-inversor', label: 'Amplificador no inversor' },
          { value: 'seguidor', label: 'Seguidor de voltaje' },
          { value: 'sumador', label: 'Sumador' },
          { value: 'diferencial', label: 'Restador (diferencial)' },
          { value: 'comparador', label: 'Comparador' },
          { value: 'schmitt', label: 'Disparador de Schmitt' },
        ]}
      />
      <CircuitFields />
      <QuantityHint />
    </CalculatorForm>
  );
}
