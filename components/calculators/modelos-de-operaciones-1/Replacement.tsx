'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { TableField } from '@/components/calculators/form/TableField';
import { replacement } from '@/lib/calculators/modelos-de-operaciones-1/reemplazo-de-equipo';

export default function Replacement() {
  return (
    <CalculatorForm calculator={replacement}>
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="years" label="Horizonte n (años)" integer />
        <NumberField name="initialAge" label="Edad actual" integer />
        <NumberField
          name="newCost"
          label={
            <>
              Máquina nueva <Formula tex="I" />
            </>
          }
        />
      </div>
      <TableField
        name="data"
        label="Datos por edad de la máquina"
        rowName="edad"
        min={2}
        max={21}
        columns={[
          { key: 'revenue', header: <Formula tex="r(t)" />, ariaLabel: 'Ingreso', kind: 'number' },
          {
            key: 'cost',
            header: <Formula tex="c(t)" />,
            ariaLabel: 'Costo de operación',
            kind: 'number',
          },
          {
            key: 'salvage',
            header: <Formula tex="s(t)" />,
            ariaLabel: 'Valor de rescate',
            kind: 'number',
            optional: true,
            placeholder: '—',
          },
        ]}
        newRow={() => ({ revenue: undefined, cost: undefined, salvage: undefined })}
        hint="La fila 1 es la edad t = 0 (máquina nueva, sin rescate), la fila 2 la edad 1, y así. La última fila es la edad máxima: una máquina de esa edad debe reemplazarse."
      />
    </CalculatorForm>
  );
}
