'use client';

import type { ReactNode } from 'react';
import { TableField, type TableFieldColumn } from '@/components/calculators/form/TableField';

/** Nombre de la actividad número `index` (0 → A, 25 → Z, 26 → AA), como en las hojas de cálculo. */
export function activityName(index: number): string {
  let name = '';
  for (let k = index; k >= 0; k = Math.floor(k / 26) - 1) {
    name = String.fromCharCode(65 + (k % 26)) + name;
  }
  return name;
}

const baseColumns: TableFieldColumn[] = [
  { key: 'name', header: 'Actividad', ariaLabel: 'Actividad', kind: 'text', minWidth: 3.5 },
  {
    key: 'predecessors',
    header: 'Predecesoras',
    ariaLabel: 'Predecesoras',
    kind: 'text',
    minWidth: 5,
    placeholder: '—',
  },
];

/** Tabla de actividades de un proyecto: nombre, predecesoras y las columnas de tiempo. */
export function ActivitiesField({
  timeColumns,
  emptyTimes,
}: {
  timeColumns: TableFieldColumn[];
  /** Tiempos vacíos de una fila nueva, p. ej. `{ duration: undefined }`. */
  emptyTimes: Record<string, undefined>;
}) {
  return (
    <TableField
      name="activities"
      label="Actividades del proyecto"
      rowName="actividad"
      max={60}
      columns={[...baseColumns, ...timeColumns]}
      newRow={(count) => ({ name: activityName(count), predecessors: '', ...emptyTimes })}
      hint={ACTIVITIES_HINT}
    />
  );
}

const ACTIVITIES_HINT: ReactNode = (
  <>
    Escribe las predecesoras inmediatas separadas por comas o espacios (<code>E, G</code>); deja la
    celda vacía si la actividad no tiene. Usa la misma unidad de tiempo en todas las filas.
  </>
);
