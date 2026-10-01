'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField } from '@/components/calculators/form/fields';
import { TableField } from '@/components/calculators/form/TableField';
import { lifeTable } from '@/lib/calculators/teoria-de-sobrevivencia/tabla-de-sobrevivencia';

export default function LifeTable() {
  return (
    <CalculatorForm calculator={lifeTable}>
      <TableField
        name="intervals"
        label="Intervalos"
        rowName="intervalo"
        min={2}
        max={60}
        columns={[
          {
            key: 'start',
            header: (
              <>
                Inicio <Formula tex="t_i" />
              </>
            ),
            ariaLabel: 'Inicio del intervalo',
            kind: 'number',
          },
          {
            key: 'deaths',
            header: (
              <>
                Fallas <Formula tex="d_i" />
              </>
            ),
            ariaLabel: 'Fallas',
            kind: 'number',
          },
          {
            key: 'withdrawals',
            header: (
              <>
                Retiros <Formula tex="w_i" />
              </>
            ),
            ariaLabel: 'Retiros (censurados)',
            kind: 'number',
          },
        ]}
        newRow={(count) => ({ start: count, deaths: undefined, withdrawals: 0 })}
        hint="Cada intervalo va desde su inicio hasta el inicio del siguiente; el último queda abierto. El total de unidades es la suma de fallas y retiros."
      />
      <SelectField
        name="criterion"
        label="Criterio de censura"
        options={[
          { value: 'actuarial', label: 'Elisa Lee (actuarial): n′ = n − w/2' },
          { value: 'kaplan-meier', label: 'Kaplan-Meier: n′ = n' },
        ]}
      />
    </CalculatorForm>
  );
}
