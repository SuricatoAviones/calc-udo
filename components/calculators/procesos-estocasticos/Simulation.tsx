'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextAreaField } from '@/components/calculators/form/fields';
import { simulation } from '@/lib/calculators/procesos-estocasticos/simulacion';

const DISTRIBUTIONS = [
  { value: 'exponencial', label: 'Exponencial (media β)' },
  { value: 'uniforme', label: 'Uniforme entre a y b' },
  { value: 'constante', label: 'Constante' },
];

/** Distribución de un tiempo (llegadas o servicio) y sus parámetros. */
function TimeFields({ prefix, title }: { prefix: 'arrival' | 'service'; title: string }) {
  const { control } = useFormContext();
  const distribution = useWatch({ control, name: `${prefix}Distribution` }) as string | undefined;
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <SelectField name={`${prefix}Distribution`} label="Distribución" options={DISTRIBUTIONS} />
      {distribution === 'uniforme' ? (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name={`${prefix}A`} label={<Formula tex="a" />} />
          <NumberField name={`${prefix}B`} label={<Formula tex="b" />} optional />
        </div>
      ) : (
        <NumberField
          name={`${prefix}A`}
          label={
            distribution === 'exponencial' ? (
              <>
                Media <Formula tex="\beta" />
              </>
            ) : (
              'Valor constante'
            )
          }
        />
      )}
    </fieldset>
  );
}

function RandomSourceFields() {
  const { control } = useFormContext();
  const source = useWatch({ control, name: 'source' }) as string | undefined;
  return (
    <>
      <SelectField
        name="source"
        label="Números aleatorios"
        options={[
          { value: 'lista', label: 'Los escribo (tabla de números aleatorios)' },
          { value: 'congruencial', label: 'Generarlos con el método congruencial' },
        ]}
      />
      {source === 'congruencial' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField name="seed" label={<Formula tex="u_0" />} integer optional />
          <NumberField name="multiplier" label={<Formula tex="b" />} integer optional />
          <NumberField name="increment" label={<Formula tex="c" />} integer optional />
          <NumberField name="modulus" label={<Formula tex="m" />} integer optional />
        </div>
      ) : (
        <TextAreaField
          name="numbers"
          label="Lista de números entre 0 y 1"
          rows={3}
          hint="Se usan en orden, a medida que la simulación los necesita: al llegar un cliente, uno para la llegada del siguiente y otro para su servicio si el servidor está libre; al salir uno, otro para el servicio del que sigue en la cola."
        />
      )}
    </>
  );
}

export default function Simulation() {
  return (
    <CalculatorForm calculator={simulation}>
      <NumberField
        name="customers"
        label="Clientes a simular"
        integer
        hint="El primero llega en T = 0 con el sistema vacío; un solo servidor y cola FIFO."
      />
      <TimeFields prefix="arrival" title="Tiempo entre llegadas" />
      <TimeFields prefix="service" title="Tiempo de servicio" />
      <RandomSourceFields />
    </CalculatorForm>
  );
}
