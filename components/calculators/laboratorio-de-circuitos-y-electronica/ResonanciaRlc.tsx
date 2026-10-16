'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { QuantityField, QuantityHint } from '@/components/calculators/electronica/QuantityField';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { resonanciaRlc } from '@/lib/calculators/laboratorio-de-circuitos-y-electronica/resonancia-rlc';

const tex = (symbol: string, unit?: string) => (
  <>
    <Formula tex={symbol} />
    {unit ? ` (${unit})` : null}
  </>
);

function CircuitFields() {
  const { control } = useFormContext();
  const type = useWatch({ control, name: 'type' }) as 'serie' | 'paralelo' | 'paralelo-practico';
  const practical = type === 'paralelo-practico';
  return (
    <>
      <p className="text-muted-foreground text-xs">
        {type === 'serie'
          ? 'R, L y C en serie con una fuente de voltaje.'
          : type === 'paralelo'
            ? 'R, L y C en paralelo con una fuente de corriente.'
            : 'Bobina real (L con su resistencia R₁ en serie) en paralelo con C y, opcionalmente, con R₂.'}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {practical ? (
          <>
            <QuantityField
              name="rl"
              unit="Ω"
              label={tex('R_1', 'Ω')}
              hint="Resistencia de la bobina."
            />
            <QuantityField name="r" unit="Ω" optional label={tex('R_2', 'Ω')} hint="Opcional." />
          </>
        ) : (
          <QuantityField name="r" unit="Ω" label={tex('R', 'Ω')} />
        )}
        <QuantityField name="l" unit="H" label={tex('L', 'H')} />
        <QuantityField name="c" unit="F" label={tex('C', 'F')} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          name="freq"
          optional
          label="Frecuencia"
          hint="Opcional: para evaluar la respuesta."
        />
        <SelectField
          name="freqUnit"
          label="Unidad"
          options={[
            { value: 'rad/s', label: 'rad/s' },
            { value: 'Hz', label: 'Hz' },
          ]}
        />
        <NumberField
          name="source"
          optional
          label={type === 'serie' ? tex('|V|', 'V') : tex('|I|', 'A')}
          hint="Opcional: amplitud de la fuente."
        />
      </div>
    </>
  );
}

export default function ResonanciaRlc() {
  return (
    <CalculatorForm calculator={resonanciaRlc}>
      <SelectField
        name="type"
        label="Circuito"
        options={[
          { value: 'serie', label: 'RLC serie' },
          { value: 'paralelo', label: 'RLC paralelo' },
          { value: 'paralelo-practico', label: 'Paralelo con bobina real' },
        ]}
      />
      <CircuitFields />
      <QuantityHint />
    </CalculatorForm>
  );
}
