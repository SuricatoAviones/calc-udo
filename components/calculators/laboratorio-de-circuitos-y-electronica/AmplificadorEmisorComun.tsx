'use client';

import { Formula } from '@/components/calculators/Formula';
import { QuantityField, QuantityHint } from '@/components/calculators/electronica/QuantityField';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { amplificadorEmisorComun } from '@/lib/calculators/laboratorio-de-circuitos-y-electronica/amplificador-emisor-comun';

const tex = (symbol: string, unit?: string) => (
  <>
    <Formula tex={symbol} />
    {unit ? ` (${unit})` : null}
  </>
);

export default function AmplificadorEmisorComun() {
  return (
    <CalculatorForm calculator={amplificadorEmisorComun}>
      <p className="text-muted-foreground text-xs">
        Divisor de voltaje R₁–R₂ en la base, R_C en el colector y la resistencia de emisor partida:
        R_E1 sin puentear y R_E2 puenteada por C_E (escribe 0 en la que no exista).
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumberField name="vcc" label={tex('V_{CC}', 'V')} />
        <QuantityField name="r1" unit="Ω" label={tex('R_1', 'Ω')} />
        <QuantityField name="r2" unit="Ω" label={tex('R_2', 'Ω')} />
        <QuantityField name="rc" unit="Ω" label={tex('R_C', 'Ω')} />
        <QuantityField name="re1" unit="Ω" label={tex('R_{E1}', 'Ω')} hint="Sin puentear." />
        <QuantityField name="re2" unit="Ω" label={tex('R_{E2}', 'Ω')} hint="Puenteada por C_E." />
        <NumberField name="beta" label={tex('\\beta')} />
        <NumberField name="vbe" label={tex('V_{BE}', 'V')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="method"
          label="Análisis de cd"
          options={[
            { value: 'aproximado', label: 'Aproximado (βR_E ≥ 10R₂)' },
            { value: 'exacto', label: 'Exacto (Thévenin)' },
          ]}
        />
        <NumberField
          name="vt"
          label={tex('V_T', 'V')}
          hint="26 mV (Boylestad) o 25 mV (Malvino)."
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <QuantityField
          name="rl"
          unit="Ω"
          optional
          label={tex('R_L', 'Ω')}
          hint="Opcional: carga."
        />
        <QuantityField
          name="rs"
          unit="Ω"
          optional
          label={tex('R_s', 'Ω')}
          hint="Opcional: fuente."
        />
        <QuantityField
          name="ro"
          unit="Ω"
          optional
          label={tex('r_o', 'Ω')}
          hint="Opcional: 1/h_oe."
        />
        <NumberField
          name="vin"
          optional
          label={tex('v_{(pp)}', 'V')}
          hint="Opcional: señal de entrada pico a pico."
        />
      </div>
      <QuantityHint />
    </CalculatorForm>
  );
}
