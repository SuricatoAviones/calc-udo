'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { criticalPath } from '@/lib/calculators/modelos-de-operaciones-1/ruta-critica';
import { ActivitiesField } from './activities';

export default function CriticalPath() {
  return (
    <CalculatorForm calculator={criticalPath}>
      <ActivitiesField
        timeColumns={[
          {
            key: 'duration',
            header: (
              <>
                Duración <Formula tex="t" />
              </>
            ),
            ariaLabel: 'Duración',
            kind: 'number',
            minWidth: 4.5,
          },
        ]}
        emptyTimes={{ duration: undefined }}
      />
    </CalculatorForm>
  );
}
