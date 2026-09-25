'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { TableField } from '@/components/calculators/form/TableField';
import { knapsack } from '@/lib/calculators/modelos-de-operaciones-1/mochila';

export default function Knapsack() {
  return (
    <CalculatorForm calculator={knapsack}>
      <NumberField
        name="capacity"
        integer
        label={
          <>
            Capacidad <Formula tex="W" />
          </>
        }
        hint="Número entero (toneladas, kilos, horas…), hasta 40."
      />
      <TableField
        name="items"
        label="Artículos"
        rowName="artículo"
        max={8}
        columns={[
          { key: 'name', header: 'Artículo', ariaLabel: 'Artículo', kind: 'text', minWidth: 5 },
          { key: 'weight', header: <Formula tex="w_i" />, ariaLabel: 'Peso', kind: 'number' },
          { key: 'value', header: <Formula tex="r_i" />, ariaLabel: 'Beneficio', kind: 'number' },
          {
            key: 'maxUnits',
            header: 'Máx.',
            ariaLabel: 'Máximo de unidades',
            kind: 'number',
            optional: true,
            placeholder: '∞',
          },
        ]}
        newRow={(count) => ({
          name: `Artículo ${count + 1}`,
          weight: undefined,
          value: undefined,
          maxUnits: undefined,
        })}
        hint="w: peso de una unidad (entero); r: beneficio de una unidad. Deja «Máx.» vacío si no hay límite de unidades; escribe 1 para una mochila 0-1."
      />
    </CalculatorForm>
  );
}
