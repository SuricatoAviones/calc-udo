'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { queueCost } from '@/lib/calculators/teoria-de-colas/costos-de-colas';
import { RateFields } from './RateFields';

export default function QueueCost() {
  return (
    <CalculatorForm calculator={queueCost}>
      <RateFields />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="serviceCost"
          label={
            <>
              Costo por servidor <Formula tex="C_s" />
            </>
          }
        />
        <NumberField
          name="waitingCost"
          label={
            <>
              Costo de espera <Formula tex="C_w" />
            </>
          }
        />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Ambos costos por unidad de tiempo (p. ej. por hora): C_s por cada servidor y C_w por cada
        cliente que espera.
      </p>
      <SelectField
        name="basis"
        label="¿Qué tiempo de espera cuesta?"
        options={[
          { value: 'sistema', label: 'Todo el tiempo en el sistema (L)' },
          { value: 'cola', label: 'Solo el tiempo en la cola (Lq)' },
        ]}
      />
      <NumberField
        name="maxServers"
        label="Máximo de servidores a evaluar"
        integer
        hint="Se evalúa desde el menor número de servidores con estado estable hasta este."
      />
    </CalculatorForm>
  );
}
