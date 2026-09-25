'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField, TextField } from '@/components/calculators/form/fields';
import { TableField } from '@/components/calculators/form/TableField';
import { shortestRoute } from '@/lib/calculators/modelos-de-operaciones-1/ruta-mas-corta-pd';

export default function ShortestRoute() {
  return (
    <CalculatorForm calculator={shortestRoute}>
      <TableField
        name="arcs"
        label="Arcos de la red"
        rowName="arco"
        max={80}
        columns={[
          { key: 'from', header: 'Desde', ariaLabel: 'Nodo de salida', kind: 'text', minWidth: 4 },
          { key: 'to', header: 'Hasta', ariaLabel: 'Nodo de llegada', kind: 'text', minWidth: 4 },
          {
            key: 'distance',
            header: 'Distancia',
            ariaLabel: 'Distancia',
            kind: 'number',
            minWidth: 4.5,
          },
        ]}
        newRow={() => ({ from: '', to: '', distance: undefined })}
        hint="Un arco por fila, en el sentido del recorrido. La distancia puede ser un costo o un tiempo."
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField name="origin" label="Origen" />
        <TextField name="destination" label="Destino" />
      </div>
      <SelectField
        name="recursion"
        label="Recursión"
        options={[
          { value: 'reversa', label: 'En reversa (desde el destino)' },
          { value: 'avance', label: 'En avance (desde el origen)' },
        ]}
      />
    </CalculatorForm>
  );
}
