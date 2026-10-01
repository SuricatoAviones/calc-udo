'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { TableField } from '@/components/calculators/form/TableField';
import { abc } from '@/lib/calculators/modelos-de-operaciones-2/clasificacion-abc';

function CutFields() {
  const { control } = useFormContext();
  const byItems = useWatch({ control, name: 'criterion' }) === 'articulos';
  return (
    <>
      <SelectField
        name="criterion"
        label="Criterio de corte"
        options={[
          { value: 'articulos', label: 'Por porcentaje de piezas (A 20 %, B 30 %, C 50 %)' },
          { value: 'valor', label: 'Por valor acumulado (A hasta 80 %, B hasta 95 %)' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="cutA" label={byItems ? '% de piezas en A' : '% acumulado hasta A'} />
        <NumberField name="cutB" label={byItems ? '% de piezas en B' : '% acumulado hasta B'} />
      </div>
    </>
  );
}

export default function Abc() {
  return (
    <CalculatorForm calculator={abc}>
      <TableField
        name="items"
        label="Piezas"
        rowName="pieza"
        min={3}
        max={60}
        columns={[
          { key: 'name', header: 'Pieza', ariaLabel: 'Pieza', kind: 'text', minWidth: 4 },
          {
            key: 'quantity',
            header: 'Demanda anual',
            ariaLabel: 'Demanda anual',
            kind: 'number',
            minWidth: 5,
          },
          {
            key: 'unitCost',
            header: 'Costo unitario',
            ariaLabel: 'Costo unitario',
            kind: 'number',
            optional: true,
            minWidth: 5,
            placeholder: '1',
          },
        ]}
        newRow={(count) => ({ name: String(count + 1), quantity: undefined, unitCost: undefined })}
        hint="Si ya tienes el uso anual en dinero, escríbelo como demanda y deja el costo vacío."
      />
      <CutFields />
    </CalculatorForm>
  );
}
