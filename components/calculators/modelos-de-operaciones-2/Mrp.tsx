'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { TableField, type TableFieldColumn } from '@/components/calculators/form/TableField';
import { mrp } from '@/lib/calculators/modelos-de-operaciones-2/mrp';

const eventColumns: TableFieldColumn[] = [
  { key: 'item', header: 'Pieza', ariaLabel: 'Pieza', kind: 'text', minWidth: 4 },
  { key: 'period', header: 'Periodo', ariaLabel: 'Periodo', kind: 'number', minWidth: 4 },
  { key: 'quantity', header: 'Cantidad', ariaLabel: 'Cantidad', kind: 'number', minWidth: 5 },
];

export default function Mrp() {
  return (
    <CalculatorForm calculator={mrp}>
      <NumberField name="periods" label="Periodos del horizonte" integer />
      <TableField
        name="items"
        label="Registros de inventario"
        rowName="pieza"
        max={20}
        columns={[
          { key: 'code', header: 'Pieza', ariaLabel: 'Pieza', kind: 'text', minWidth: 4 },
          {
            key: 'leadTime',
            header: 'T. entrega',
            ariaLabel: 'Tiempo de entrega',
            kind: 'number',
            minWidth: 4,
          },
          {
            key: 'onHand',
            header: 'Existencia',
            ariaLabel: 'Existencia',
            kind: 'number',
            minWidth: 4.5,
          },
          {
            key: 'safetyStock',
            header: 'Inv. seguridad',
            ariaLabel: 'Inventario de seguridad',
            kind: 'number',
            optional: true,
            minWidth: 4.5,
            placeholder: '0',
          },
          {
            key: 'lotSize',
            header: 'Lote',
            ariaLabel: 'Cantidad de pedido',
            kind: 'number',
            optional: true,
            minWidth: 4.5,
            placeholder: 'L4L',
          },
        ]}
        newRow={() => ({
          code: '',
          leadTime: 1,
          onHand: 0,
          safetyStock: undefined,
          lotSize: undefined,
        })}
        hint="Lote vacío = lote por lote (se pide exactamente la necesidad neta); con un número, se pide en múltiplos de esa cantidad."
      />
      <TableField
        name="bom"
        label="Lista de materiales"
        rowName="relación"
        min={0}
        max={60}
        columns={[
          { key: 'parent', header: 'Padre', ariaLabel: 'Pieza padre', kind: 'text', minWidth: 4 },
          {
            key: 'child',
            header: 'Componente',
            ariaLabel: 'Componente',
            kind: 'text',
            minWidth: 4,
          },
          {
            key: 'quantity',
            header: 'Por unidad',
            ariaLabel: 'Cantidad por unidad',
            kind: 'number',
            minWidth: 4,
          },
        ]}
        newRow={() => ({ parent: '', child: '', quantity: 1 })}
        hint="Ej.: «C, D, 2» si cada C lleva 2 D."
      />
      <TableField
        name="demand"
        label="Programa maestro (necesidades brutas)"
        rowName="necesidad"
        max={100}
        columns={eventColumns}
        newRow={() => ({ item: '', period: undefined, quantity: undefined })}
      />
      <TableField
        name="receipts"
        label="Entradas programadas"
        rowName="entrada"
        min={0}
        max={60}
        columns={eventColumns}
        newRow={() => ({ item: '', period: undefined, quantity: undefined })}
        hint="Pedidos ya hechos que llegan al inicio del periodo indicado."
      />
    </CalculatorForm>
  );
}
