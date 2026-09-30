'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { poissonProcess } from '@/lib/calculators/procesos-estocasticos/proceso-de-poisson';

export default function PoissonProcess() {
  return (
    <CalculatorForm calculator={poissonProcess}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="lambda"
          label={
            <>
              Tasa <Formula tex="\lambda" />
            </>
          }
        />
        <NumberField name="t" label="Intervalo t" />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Eventos por unidad de tiempo y longitud del intervalo, en la misma unidad: un evento cada 12
        minutos es λ = 5 por hora.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="query"
          label="Probabilidad"
          options={[
            { value: 'igual', label: 'P{N(t) = n}' },
            { value: 'a-lo-sumo', label: 'P{N(t) ≤ n}' },
            { value: 'al-menos', label: 'P{N(t) ≥ n}' },
          ]}
        />
        <NumberField name="n" label="Eventos n" integer />
      </div>
      <fieldset className="flex flex-col gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Ya observado (opcional)</legend>
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="observedTime" label="Tiempo s" optional />
          <NumberField name="observedCount" label="Eventos m" optional integer />
        </div>
        <p className="text-muted-foreground text-xs">
          Si en los primeros s ocurrieron m eventos, se calcula la probabilidad de completar n en t.
        </p>
      </fieldset>
      <NumberField
        name="waitingTime"
        label={
          <>
            Tiempo entre eventos <Formula tex="a" /> (opcional)
          </>
        }
        optional
        hint="Calcula P{T ≤ a} y P{T > a} para el tiempo hasta el siguiente evento."
      />
    </CalculatorForm>
  );
}
