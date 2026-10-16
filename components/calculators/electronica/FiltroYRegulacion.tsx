'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { filtroYRegulacion } from '@/lib/calculators/electronica/filtro-y-regulacion';
import { QuantityField, QuantityHint } from './QuantityField';

const tex = (symbol: string, unit: string) => (
  <>
    <Formula tex={symbol} /> ({unit})
  </>
);

function FilterFields() {
  const { control } = useFormContext();
  const byCurrent = useWatch({ control, name: 'load' }) === 'corriente';
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="rectifier"
          label="Rectificador"
          options={[
            { value: 'media-onda', label: 'Media onda' },
            { value: 'onda-completa', label: 'Onda completa' },
          ]}
        />
        <SelectField
          name="load"
          label="La carga se da como"
          options={[
            { value: 'corriente', label: 'Corriente de cd' },
            { value: 'resistencia', label: 'Resistencia' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumberField name="vm" label={tex('V_m', 'V')} hint="Pico a la salida del rectificador." />
        <NumberField name="f" label="f (Hz)" hint="De la red." />
        <QuantityField name="c" unit="F" label="C (F)" />
        {byCurrent ? (
          <QuantityField name="idc" unit="A" label={tex('I_{cd}', 'A')} />
        ) : (
          <QuantityField name="rl" unit="Ω" label={tex('R_L', 'Ω')} />
        )}
      </div>
    </>
  );
}

function ZenerFields() {
  const { control } = useFormContext();
  const zenerCase = useWatch({ control, name: 'zenerCase' }) as
    'fijo' | 'rl-variable' | 'vi-variable';
  return (
    <>
      <SelectField
        name="zenerCase"
        label="Caso"
        options={[
          { value: 'fijo', label: 'V_i y R_L fijos' },
          { value: 'rl-variable', label: 'R_L variable: intervalo de carga' },
          { value: 'vi-variable', label: 'V_i variable: intervalo de entrada' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {zenerCase !== 'vi-variable' && <NumberField name="vi" label={tex('V_i', 'V')} />}
        <QuantityField name="rs" unit="Ω" label={tex('R_S', 'Ω')} hint="Resistencia en serie." />
        <NumberField name="vz" label={tex('V_Z', 'V')} />
        {zenerCase !== 'rl-variable' && (
          <QuantityField name="rl" unit="Ω" label={tex('R_L', 'Ω')} />
        )}
        {zenerCase !== 'fijo' && (
          <QuantityField
            name="izm"
            unit="A"
            label={tex('I_{ZM}', 'A')}
            hint="Corriente máxima del Zener."
          />
        )}
      </div>
      {zenerCase === 'fijo' && (
        <div className="grid grid-cols-3 gap-3">
          <QuantityField name="pzm" unit="W" optional label={tex('P_{ZM}', 'W')} hint="Opcional." />
          <QuantityField
            name="rz"
            unit="Ω"
            optional
            label={tex('R_Z', 'Ω')}
            hint="Opcional: segunda aproximación."
          />
          <NumberField
            name="vrin"
            optional
            label={tex('V_{r(in)}', 'V')}
            hint="Opcional: rizado pp a la entrada (requiere R_Z)."
          />
        </div>
      )}
    </>
  );
}

function PartFields() {
  const { control } = useFormContext();
  return useWatch({ control, name: 'part' }) === 'filtro' ? <FilterFields /> : <ZenerFields />;
}

export default function FiltroYRegulacion() {
  return (
    <CalculatorForm calculator={filtroYRegulacion}>
      <SelectField
        name="part"
        label="Sección de la fuente"
        options={[
          { value: 'filtro', label: 'Filtro con condensador' },
          { value: 'zener', label: 'Regulador Zener' },
        ]}
      />
      <PartFields />
      <QuantityHint />
    </CalculatorForm>
  );
}
