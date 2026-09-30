'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextField } from '@/components/calculators/form/fields';
import { priorityQueue } from '@/lib/calculators/teoria-de-colas/colas-con-prioridad';

export default function PriorityQueue() {
  return (
    <CalculatorForm calculator={priorityQueue}>
      <TextField
        name="rates"
        label={
          <>
            Llegadas por clase <Formula tex="\lambda_1, \lambda_2, \ldots" />
          </>
        }
        placeholder="0.2, 0.6, 1.2"
      />
      <p className="text-muted-foreground -mt-2 text-xs">
        De la clase de mayor prioridad a la de menor, separadas por coma y espacio.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="mu"
          label={
            <>
              Servicio <Formula tex="\mu" />
            </>
          }
        />
        <NumberField name="servers" label="Servidores s" integer />
      </div>
      <SelectField
        name="discipline"
        label="Tipo de prioridad"
        options={[
          { value: 'apropiativa', label: 'Con interrupción (apropiativa)' },
          { value: 'no-apropiativa', label: 'Sin interrupción (no apropiativa)' },
        ]}
      />
    </CalculatorForm>
  );
}
