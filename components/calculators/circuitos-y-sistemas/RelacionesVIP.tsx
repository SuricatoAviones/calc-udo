'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { ExpressionField, NumberField, SelectField } from '@/components/calculators/form/fields';
import { relacionesVip } from '@/lib/calculators/circuitos-y-sistemas/relaciones-v-i-p';

export default function RelacionesVip() {
  return (
    <CalculatorForm calculator={relacionesVip}>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="component"
          label="Elemento"
          options={[
            { value: 'resistor', label: 'Resistencia (R)' },
            { value: 'capacitor', label: 'Capacitor (C)' },
            { value: 'inductor', label: 'Inductor (L)' },
          ]}
        />
        <SelectField
          name="known"
          label="Dato conocido"
          options={[
            { value: 'voltage', label: 'v(t)' },
            { value: 'current', label: 'i(t)' },
          ]}
        />
      </div>
      <ExpressionField
        name="expression"
        label="Expresión"
        hint="Función de t. Ej.: 10*sin(t), 5*e^(-2t), 3*t^2."
        variables={['t']}
        previewPrefix="f(t) ="
      />
      <NumberField
        name="value"
        label="Valor del elemento"
        hint="R en Ω, C en F o L en H. Usa notación de ingeniería (p. ej. 2.2µ)."
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="tEnd" label="Tiempo final (s)" />
        <NumberField name="samples" label="Muestras" integer />
      </div>
    </CalculatorForm>
  );
}
