'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { crashing } from '@/lib/calculators/modelos-de-operaciones-1/pert-costos';
import { ActivitiesField } from './activities';

export default function Crashing() {
  return (
    <CalculatorForm calculator={crashing}>
      <ActivitiesField
        timeColumns={[
          {
            key: 'normalTime',
            header: 'T. normal',
            ariaLabel: 'Tiempo normal',
            kind: 'number',
            minWidth: 4,
          },
          {
            key: 'crashTime',
            header: 'T. comprimido',
            ariaLabel: 'Tiempo comprimido',
            kind: 'number',
            minWidth: 4.5,
          },
          {
            key: 'normalCost',
            header: 'C. normal',
            ariaLabel: 'Costo normal',
            kind: 'number',
            minWidth: 4.5,
          },
          {
            key: 'crashCost',
            header: 'C. comprimido',
            ariaLabel: 'Costo comprimido',
            kind: 'number',
            minWidth: 4.5,
          },
        ]}
        emptyTimes={{
          normalTime: undefined,
          crashTime: undefined,
          normalCost: undefined,
          crashCost: undefined,
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="target"
          label="Duración deseada (opcional)"
          optional
          hint="Vacío = comprimir hasta donde se pueda."
        />
        <NumberField
          name="indirectCost"
          label="Costo indirecto por unidad (opcional)"
          optional
          hint="Para buscar la duración de costo total mínimo."
        />
      </div>
    </CalculatorForm>
  );
}
