'use client';

import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { analisisAcDeTransistores } from '@/lib/calculators/electronica/analisis-ac-de-transistores';
import { QuantityField, QuantityHint } from './QuantityField';

const tex = (symbol: string, unit?: string) => (
  <>
    <Formula tex={symbol} />
    {unit ? ` (${unit})` : null}
  </>
);

function NetworkFields() {
  const { control, setValue } = useFormContext();
  const model = useWatch({ control, name: 'model' }) as 'aproximado' | 'completo';
  const config = useWatch({ control, name: 'config' }) as
    'emisor-comun' | 'emisor-sin-puentear' | 'seguidor' | 'base-comun';
  const bias = useWatch({ control, name: 'bias' }) as 'fija' | 'divisor';
  const complete = model === 'completo';
  useEffect(() => {
    if (complete && (config === 'emisor-sin-puentear' || config === 'seguidor'))
      setValue('config', 'emisor-comun');
  }, [complete, config, setValue]);
  const commonBase = config === 'base-comun';
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="config"
          label="Configuración"
          options={[
            { value: 'emisor-comun', label: 'Emisor común (R_E puenteada)' },
            ...(complete
              ? []
              : [
                  { value: 'emisor-sin-puentear', label: 'Emisor común con R_E sin puentear' },
                  { value: 'seguidor', label: 'Seguidor de emisor' },
                ]),
            { value: 'base-comun', label: 'Base común' },
          ]}
        />
        {!commonBase && (
          <SelectField
            name="bias"
            label="Polarización"
            options={[
              { value: 'fija', label: 'Fija (R_B)' },
              { value: 'divisor', label: 'Divisor de voltaje (R₁, R₂)' },
            ]}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {!commonBase &&
          (bias === 'divisor' ? (
            <>
              <QuantityField name="r1" unit="Ω" label={tex('R_1', 'Ω')} />
              <QuantityField name="r2" unit="Ω" label={tex('R_2', 'Ω')} />
            </>
          ) : (
            <QuantityField name="rb" unit="Ω" label={tex('R_B', 'Ω')} />
          ))}
        {config !== 'seguidor' && <QuantityField name="rc" unit="Ω" label={tex('R_C', 'Ω')} />}
        {(config === 'emisor-sin-puentear' || config === 'seguidor' || commonBase) && (
          <QuantityField
            name="re"
            unit="Ω"
            label={tex('R_E', 'Ω')}
            hint={commonBase ? 'Entre el emisor y la fuente −V_EE.' : 'Sin puentear.'}
          />
        )}
      </div>
    </>
  );
}

function HybridFields() {
  const { control } = useFormContext();
  const complete = useWatch({ control, name: 'model' }) === 'completo';
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <QuantityField
        name="hie"
        unit="Ω"
        label={tex('h_{ie}', 'Ω')}
        hint="Con el modelo r_e: βr_e."
      />
      <NumberField name="hfe" label={tex('h_{fe}')} hint="β" />
      {complete && <NumberField name="hre" label={tex('h_{re}')} />}
      <QuantityField name="hoe" unit="S" label={tex('h_{oe}', 'S')} hint="0 si se ignora r_o." />
    </div>
  );
}

export default function AnalisisAcDeTransistores() {
  return (
    <CalculatorForm calculator={analisisAcDeTransistores}>
      <SelectField
        name="model"
        label="Modelo híbrido"
        options={[
          { value: 'aproximado', label: 'Aproximado (h_ie, h_fe, h_oe)' },
          { value: 'completo', label: 'Completo (con h_re)' },
        ]}
      />
      <p className="text-muted-foreground text-xs">
        Parámetros en emisor común, como los da la hoja de datos; en base común se convierten.
      </p>
      <HybridFields />
      <NetworkFields />
      <div className="grid grid-cols-2 gap-3">
        <QuantityField
          name="rl"
          unit="Ω"
          optional
          label={tex('R_L', 'Ω')}
          hint="Opcional: carga externa."
        />
        <QuantityField
          name="rs"
          unit="Ω"
          optional
          label={tex('R_s', 'Ω')}
          hint="Opcional: resistencia de la fuente."
        />
      </div>
      <QuantityHint />
    </CalculatorForm>
  );
}
