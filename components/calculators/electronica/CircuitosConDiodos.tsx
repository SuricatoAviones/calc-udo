'use client';

import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CircuitBuilderField } from '@/components/calculators/circuitos-y-sistemas/CircuitBuilderField';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { DIODE_KINDS } from '@/lib/calculators/circuitos-y-sistemas/circuit';
import { circuitosConDiodos } from '@/lib/calculators/electronica/circuitos-con-diodos';
import { QuantityField, QuantityHint } from './QuantityField';

type Model = 'ideal' | 'segunda' | 'tercera' | 'real';

const MODELS = [
  { value: 'ideal', label: 'Ideal' },
  { value: 'segunda', label: 'Segunda aproximación (V_K)' },
  { value: 'tercera', label: 'Tercera aproximación (V_K + r_B)' },
];

function RbField() {
  return (
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
  );
}

/** Modo serie: E, R y un diodo, con la característica real disponible. */
function SeriesFields() {
  const { control } = useFormContext();
  const model = useWatch({ control, name: 'model' }) as Model;
  return (
    <>
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
          options={[...MODELS, { value: 'real', label: 'Real (Shockley)' }]}
        />
      </div>
      {model === 'real' ? (
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
      ) : (
        model !== 'ideal' && (
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
            {model === 'tercera' && <RbField />}
          </div>
        )
      )}
    </>
  );
}

/** Modo circuito: la red se dibuja en el tablero; cada diodo lleva su V_K. */
function NetworkFields() {
  const { control, setValue } = useFormContext();
  const model = useWatch({ control, name: 'model' }) as Model;
  // La característica real es solo del modo serie: al dibujar se pasa a la segunda aproximación.
  useEffect(() => {
    if (model === 'real') setValue('model', 'segunda');
  }, [model, setValue]);
  return (
    <>
      <p className="text-muted-foreground text-xs">
        Dibuja la red con fuentes, resistencias y diodos. Cada diodo conduce del ánodo a la barra
        (cátodo) y su valor es su umbral V_K, así que puedes mezclar silicio, germanio y LED.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="model"
          label="Modelo de los diodos"
          hint="En el ideal se ignora V_K."
          options={MODELS}
          className={model === 'tercera' ? undefined : 'col-span-2'}
        />
        {model === 'tercera' && <RbField />}
      </div>
      <CircuitBuilderField name="circuit" kinds={DIODE_KINDS} />
    </>
  );
}

function ModeFields() {
  const { control } = useFormContext();
  return useWatch({ control, name: 'mode' }) === 'circuito' ? <NetworkFields /> : <SeriesFields />;
}

export default function CircuitosConDiodos() {
  return (
    <CalculatorForm calculator={circuitosConDiodos}>
      <SelectField
        name="mode"
        label="Tipo de análisis"
        options={[
          { value: 'circuito', label: 'Circuito dibujado (estados supuestos)' },
          { value: 'serie', label: 'Diodo en serie (recta de carga)' },
        ]}
      />
      <ModeFields />
      <QuantityHint />
    </CalculatorForm>
  );
}
