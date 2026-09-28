'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { TableField } from '@/components/calculators/form/TableField';
import { multinomial } from '@/lib/calculators/estadistica-1/distribucion-multinomial';

export default function Multinomial() {
  return (
    <CalculatorForm calculator={multinomial}>
      <TableField
        name="outcomes"
        label="Resultados posibles de cada ensayo"
        rowName="resultado"
        min={2}
        max={10}
        columns={[
          { key: 'name', header: 'Resultado', ariaLabel: 'Resultado', kind: 'text', minWidth: 6 },
          {
            key: 'probability',
            header: <Formula tex="p_i" />,
            ariaLabel: 'Probabilidad',
            kind: 'text',
            minWidth: 4.5,
            placeholder: '2/9',
          },
          {
            key: 'count',
            header: <Formula tex="x_i" />,
            ariaLabel: 'Número de veces',
            kind: 'number',
            minWidth: 3.5,
          },
        ]}
        newRow={(count) => ({ name: `E${count + 1}`, probability: '', count: 0 })}
        hint="pᵢ acepta fracciones (2/9) o decimales y deben sumar 1. xᵢ es cuántas veces ocurre el resultado; n = Σxᵢ."
      />
    </CalculatorForm>
  );
}
