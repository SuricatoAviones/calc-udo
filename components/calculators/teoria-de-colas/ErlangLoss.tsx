'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { erlangLoss } from '@/lib/calculators/teoria-de-colas/perdida-de-erlang';
import { RateFields } from './RateFields';

export default function ErlangLoss() {
  return (
    <CalculatorForm calculator={erlangLoss}>
      <RateFields />
      <NumberField
        name="servers"
        label="Servidores (líneas, canales) s"
        integer
        hint="No hay sala de espera: quien llega con los s servidores ocupados se pierde."
      />
      <NumberField
        name="maxBlocking"
        label="Meta de bloqueo (opcional)"
        optional
        hint="Fracción máxima de clientes perdidos, p. ej. 0.10 para atender al menos el 90 %. Se busca el menor número de servidores que la cumple."
      />
    </CalculatorForm>
  );
}
