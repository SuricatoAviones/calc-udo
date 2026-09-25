'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { pert } from '@/lib/calculators/modelos-de-operaciones-1/pert';
import { ActivitiesField } from './activities';

export default function Pert() {
  return (
    <CalculatorForm calculator={pert}>
      <ActivitiesField
        timeColumns={[
          {
            key: 'optimistic',
            header: <Formula tex="a" />,
            ariaLabel: 'Tiempo optimista a',
            kind: 'number',
            minWidth: 3,
          },
          {
            key: 'mostLikely',
            header: <Formula tex="m" />,
            ariaLabel: 'Tiempo más probable m',
            kind: 'number',
            minWidth: 3,
          },
          {
            key: 'pessimistic',
            header: <Formula tex="b" />,
            ariaLabel: 'Tiempo pesimista b',
            kind: 'number',
            minWidth: 3,
          },
        ]}
        emptyTimes={{ optimistic: undefined, mostLikely: undefined, pessimistic: undefined }}
      />
      <p className="text-muted-foreground -mt-2 text-xs">
        <Formula tex="a" />: optimista, <Formula tex="m" />: más probable, <Formula tex="b" />:
        pesimista. Deben cumplir <Formula tex="a \le m \le b" />.
      </p>
      <NumberField
        name="deadline"
        label={
          <>
            Fecha de terminación <Formula tex="d" />
          </>
        }
        hint="Se calcula la probabilidad de terminar el proyecto en d o antes."
      />
    </CalculatorForm>
  );
}
