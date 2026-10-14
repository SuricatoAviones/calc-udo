'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { respuestaSegundoOrden } from '@/lib/calculators/circuitos-y-sistemas/respuesta-segundo-orden';

function ConditionFields() {
  const { control } = useFormContext();
  const parallel = useWatch({ control, name: 'circuit' }) !== 'serie';
  const general = useWatch({ control, name: 'mode' }) === 'general';
  if (general) {
    return (
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="x0" label={<Formula tex="x(0^{+})" />} />
        <NumberField name="dx0" label={<Formula tex="x'(0^{+})" />} />
        <NumberField name="xInf" label={<Formula tex="x_f = x(\infty)" />} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      <NumberField
        name="vC0"
        label={
          <>
            <Formula tex="v_C(0)" /> (V)
          </>
        }
      />
      <NumberField
        name="iL0"
        label={
          <>
            <Formula tex="i_L(0)" /> (A)
          </>
        }
      />
      <NumberField
        name="source"
        label={
          parallel ? (
            <>
              <Formula tex="I_s" /> (A)
            </>
          ) : (
            <>
              <Formula tex="V_s" /> (V)
            </>
          )
        }
        hint="Fuente de cd desde t = 0 (0 si no hay)."
      />
    </div>
  );
}

function ConventionNote() {
  const { control } = useFormContext();
  const parallel = useWatch({ control, name: 'circuit' }) !== 'serie';
  const general = useWatch({ control, name: 'mode' }) === 'general';
  if (general) {
    return (
      <p className="text-muted-foreground text-xs">
        Para cualquier voltaje o corriente x del circuito: su valor y su derivada justo después de
        la conmutación, y su valor final (respuesta forzada).
      </p>
    );
  }
  return (
    <p className="text-muted-foreground text-xs">
      {parallel
        ? 'Paralelo: v es el voltaje común (+ arriba), i_L baja por el inductor e I_s entra al nodo superior.'
        : 'Serie: i circula en sentido horario, v_C tiene su + por donde entra i y V_s está en serie.'}
    </p>
  );
}

export default function RespuestaSegundoOrden() {
  return (
    <CalculatorForm calculator={respuestaSegundoOrden}>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="circuit"
          label="Circuito"
          options={[
            { value: 'paralelo', label: 'RLC en paralelo' },
            { value: 'serie', label: 'RLC en serie' },
          ]}
        />
        <SelectField
          name="mode"
          label="Datos iniciales"
          options={[
            { value: 'elementos', label: 'v_C(0) e i_L(0)' },
            { value: 'general', label: "x(0), x'(0) y x(∞)" },
          ]}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="resistance" label="R (Ω)" />
        <NumberField name="inductance" label="L (H)" />
        <NumberField name="capacitance" label="C (F)" />
      </div>
      <ConditionFields />
      <ConventionNote />
      <NumberField name="time" label="Evaluar en t (s), opcional" optional />
    </CalculatorForm>
  );
}
