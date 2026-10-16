'use client';

import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { polarizacionDeTransistores } from '@/lib/calculators/electronica/polarizacion-de-transistores';
import { QuantityField, QuantityHint } from './QuantityField';

const tex = (symbol: string, unit?: string) => (
  <>
    <Formula tex={symbol} />
    {unit ? ` (${unit})` : null}
  </>
);

function BjtFields() {
  const { control } = useFormContext();
  const config = useWatch({ control, name: 'bjtConfig' }) as
    'fija' | 'emisor' | 'divisor' | 'realimentacion';
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="bjtConfig"
          label="Configuración"
          options={[
            { value: 'fija', label: 'Polarización fija' },
            { value: 'emisor', label: 'Polarización de emisor' },
            { value: 'divisor', label: 'Divisor de voltaje' },
            { value: 'realimentacion', label: 'Realimentación del colector' },
          ]}
        />
        {config === 'divisor' && (
          <SelectField
            name="method"
            label="Análisis"
            options={[
              { value: 'exacto', label: 'Exacto (Thévenin)' },
              { value: 'aproximado', label: 'Aproximado (βR_E ≥ 10R₂)' },
            ]}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumberField name="vcc" label={tex('V_{CC}', 'V')} />
        {config === 'divisor' ? (
          <>
            <QuantityField name="r1" unit="Ω" label={tex('R_1', 'Ω')} />
            <QuantityField name="r2" unit="Ω" label={tex('R_2', 'Ω')} />
          </>
        ) : (
          <QuantityField
            name="rb"
            unit="Ω"
            label={config === 'realimentacion' ? tex('R_F', 'Ω') : tex('R_B', 'Ω')}
            hint={config === 'realimentacion' ? 'Del colector a la base.' : undefined}
          />
        )}
        <QuantityField name="rc" unit="Ω" label={tex('R_C', 'Ω')} />
        {config !== 'fija' && (
          <QuantityField
            name="re"
            unit="Ω"
            label={tex('R_E', 'Ω')}
            hint={config === 'realimentacion' ? '0 si no hay.' : undefined}
          />
        )}
        <NumberField name="beta" label={tex('\\beta')} />
        <NumberField name="vbe" label={tex('V_{BE}', 'V')} hint="0.7 V en silicio." />
      </div>
    </>
  );
}

function FetFields() {
  const { control, setValue } = useFormContext();
  const device = useWatch({ control, name: 'device' }) as
    'jfet' | 'mosfet-empobrecimiento' | 'mosfet-enriquecimiento';
  const config = useWatch({ control, name: 'fetConfig' }) as
    'fija' | 'autopolarizacion' | 'divisor' | 'realimentacion';
  const enhancement = device === 'mosfet-enriquecimiento';
  // Cada familia admite configuraciones distintas: al cambiar de dispositivo se elige una válida.
  useEffect(() => {
    const allowed = enhancement
      ? ['realimentacion', 'divisor']
      : ['fija', 'autopolarizacion', 'divisor'];
    if (!allowed.includes(config))
      setValue('fetConfig', enhancement ? 'realimentacion' : 'autopolarizacion');
  }, [enhancement, config, setValue]);
  return (
    <>
      <SelectField
        name="fetConfig"
        label="Configuración"
        options={
          enhancement
            ? [
                { value: 'realimentacion', label: 'Realimentación del drenaje' },
                { value: 'divisor', label: 'Divisor de voltaje' },
              ]
            : [
                { value: 'fija', label: 'Polarización fija' },
                { value: 'autopolarizacion', label: 'Autopolarización' },
                { value: 'divisor', label: 'Divisor de voltaje' },
              ]
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumberField name="vdd" label={tex('V_{DD}', 'V')} />
        {config === 'fija' && (
          <NumberField name="vgg" label={tex('V_{GG}', 'V')} hint="V_GS = −V_GG." />
        )}
        {config === 'divisor' && (
          <>
            <QuantityField name="rg1" unit="Ω" label={tex('R_1', 'Ω')} />
            <QuantityField name="rg2" unit="Ω" label={tex('R_2', 'Ω')} />
          </>
        )}
        <QuantityField name="rd" unit="Ω" label={tex('R_D', 'Ω')} />
        {(config === 'autopolarizacion' || config === 'divisor') && (
          <QuantityField name="rs" unit="Ω" label={tex('R_S', 'Ω')} />
        )}
      </div>
      {enhancement ? (
        <div className="grid grid-cols-3 gap-3">
          <NumberField name="vt" label={tex('V_{GS(\\text{Th})}', 'V')} />
          <QuantityField name="idOn" unit="A" label={tex('I_{D(\\text{enc})}', 'A')} />
          <NumberField name="vgsOn" label={tex('V_{GS(\\text{enc})}', 'V')} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <QuantityField name="idss" unit="A" label={tex('I_{DSS}', 'A')} />
          <NumberField name="vp" label={tex('V_P', 'V')} hint="Negativo en canal n." />
        </div>
      )}
    </>
  );
}

function DeviceFields() {
  const { control } = useFormContext();
  return useWatch({ control, name: 'device' }) === 'bjt' ? <BjtFields /> : <FetFields />;
}

export default function PolarizacionDeTransistores() {
  return (
    <CalculatorForm calculator={polarizacionDeTransistores}>
      <SelectField
        name="device"
        label="Transistor (NPN o canal n)"
        options={[
          { value: 'bjt', label: 'BJT' },
          { value: 'jfet', label: 'JFET' },
          { value: 'mosfet-empobrecimiento', label: 'MOSFET de empobrecimiento' },
          { value: 'mosfet-enriquecimiento', label: 'MOSFET de enriquecimiento' },
        ]}
      />
      <DeviceFields />
      <QuantityHint />
    </CalculatorForm>
  );
}
