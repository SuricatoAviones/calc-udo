'use client';

import { Formula } from '@/components/calculators/Formula';
import { TableField, type TableFieldColumn } from '@/components/calculators/form/TableField';

const baseColumns: TableFieldColumn[] = [
  { key: 'servers', header: 'Servidores s', ariaLabel: 'Servidores', kind: 'number', minWidth: 4 },
  {
    key: 'mu',
    header: (
      <>
        Servicio <Formula tex="\mu" />
      </>
    ),
    ariaLabel: 'Tasa de servicio',
    kind: 'number',
    minWidth: 4,
  },
];

const externalColumn: TableFieldColumn = {
  key: 'external',
  header: (
    <>
      Externas <Formula tex="a_j" />
    </>
  ),
  ariaLabel: 'Llegadas externas',
  kind: 'number',
  minWidth: 4,
};

/** Tabla de estaciones de una red de colas: servidores, μ y, si se pide, llegadas externas. */
export function StationsField({ withExternal = false }: { withExternal?: boolean }) {
  return (
    <TableField
      name="stations"
      label="Estaciones"
      rowName="estación"
      max={10}
      columns={withExternal ? [...baseColumns, externalColumn] : baseColumns}
      newRow={() =>
        withExternal ? { servers: 1, mu: undefined, external: 0 } : { servers: 1, mu: undefined }
      }
      hint={
        withExternal
          ? 'Una fila por estación, en el orden de la matriz de rutas. Tasas por unidad de tiempo.'
          : 'Una fila por estación, en el orden en que los clientes las recorren.'
      }
    />
  );
}
