'use client';

import type { ReactNode } from 'react';
import { Formula } from '@/components/calculators/Formula';
import { QuantityField, QuantityHint } from '@/components/calculators/electronica/QuantityField';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { fuenteReguladaPorZener } from '@/lib/calculators/laboratorio-de-circuitos-y-electronica/fuente-regulada-por-zener';

const tex = (symbol: string, unit?: string) => (
  <>
    <Formula tex={symbol} />
    {unit ? ` (${unit})` : null}
  </>
);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export default function FuenteReguladaPorZener() {
  return (
    <CalculatorForm calculator={fuenteReguladaPorZener}>
      <Section title="Transformador">
        <div className="grid grid-cols-3 gap-3">
          <NumberField name="v1rms" label={tex('V_{1(rms)}', 'V')} />
          <NumberField name="ratio" label={tex('N_1 : N_2')} hint="8 significa 8:1." />
          <NumberField name="f" label="f (Hz)" />
        </div>
      </Section>
      <Section title="Rectificador">
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            name="rectifier"
            label="Tipo"
            options={[
              { value: 'media-onda', label: 'Media onda' },
              { value: 'derivacion-central', label: 'Derivación central' },
              { value: 'puente', label: 'Puente' },
            ]}
          />
          <NumberField name="vk" label={tex('V_K', 'V')} hint="Por diodo." />
        </div>
      </Section>
      <Section title="Filtro">
        <div className="grid grid-cols-2 gap-3">
          <QuantityField name="c" unit="F" label={tex('C', 'F')} />
          <QuantityField
            name="bleeder"
            unit="Ω"
            optional
            label={tex('R_{dren}', 'Ω')}
            hint="Opcional: resistencia de drenaje en paralelo con C."
          />
        </div>
      </Section>
      <Section title="Regulador y carga">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <QuantityField name="rs" unit="Ω" label={tex('R_S', 'Ω')} />
          <NumberField name="vz" label={tex('V_Z', 'V')} />
          <QuantityField
            name="rz"
            unit="Ω"
            optional
            label={tex('R_Z', 'Ω')}
            hint="Opcional: para el rizado de salida."
          />
          <QuantityField name="pzm" unit="W" optional label={tex('P_{ZM}', 'W')} hint="Opcional." />
          <QuantityField name="rl" unit="Ω" label={tex('R_L', 'Ω')} />
        </div>
      </Section>
      <QuantityHint />
    </CalculatorForm>
  );
}
