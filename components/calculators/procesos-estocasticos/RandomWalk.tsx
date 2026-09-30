'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextField } from '@/components/calculators/form/fields';
import { randomWalk } from '@/lib/calculators/procesos-estocasticos/caminata-aleatoria';

function Fields() {
  const { control } = useFormContext();
  const absorbing = useWatch({ control, name: 'barriers' }) === 'absorbentes';
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <TextField name="p" label="Subir 1: p" placeholder="1/3" />
        <TextField name="q" label="Bajar 1: q" placeholder="2/3" />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Decimales o fracciones. Si p + q &lt; 1, el resto es la probabilidad de quedarse en el
        sitio.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="start" label="Posición inicial i" integer />
        <NumberField name="steps" label="Pasos n" integer />
      </div>
      <SelectField
        name="barriers"
        label="Barreras"
        options={[
          { value: 'absorbentes', label: 'Absorbentes en 0 y N (ruina del jugador)' },
          { value: 'ninguna', label: 'Sin barreras' },
        ]}
      />
      {absorbing && (
        <NumberField
          name="upper"
          label="Barrera superior N"
          integer
          hint="El proceso se detiene al llegar a 0 o a N; en el juego, N es el dinero de los dos jugadores."
        />
      )}
    </>
  );
}

export default function RandomWalk() {
  return (
    <CalculatorForm calculator={randomWalk}>
      <Fields />
    </CalculatorForm>
  );
}
