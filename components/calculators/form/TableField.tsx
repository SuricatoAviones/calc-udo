'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFieldArray, useFormContext, type FieldErrors } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { parseDecimal } from '@/lib/math/format';
import { cn } from '@/lib/utils';

export interface TableFieldColumn {
  /** Propiedad de cada fila en el schema. */
  key: string;
  /** Encabezado visible (puede ser una fórmula). */
  header: ReactNode;
  /** Nombre de la columna para lectores de pantalla y mensajes de error. */
  ariaLabel: string;
  kind: 'text' | 'number';
  /** Solo columnas numéricas: vacío = `undefined` en vez de error. */
  optional?: boolean;
  /** Ancho mínimo de la columna, en rem. */
  minWidth?: number;
  placeholder?: string;
}

interface TableFieldProps {
  /** Campo del schema: un arreglo de objetos con las claves de `columns`. */
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  columns: TableFieldColumn[];
  /** Fila nueva al presionar «Agregar»; recibe cuántas filas hay. */
  newRow: (count: number) => Record<string, unknown>;
  /** Nombre de una fila para los botones y mensajes: «actividad», «arco». */
  rowName: string;
  min?: number;
  max?: number;
}

const cellClass =
  'border-input bg-card focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-md border px-2 font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px]';

/** Error de un nodo del árbol de errores de react-hook-form. */
function messageAt(errors: FieldErrors, path: (string | number)[]): string | undefined {
  let node: unknown = errors;
  for (const key of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string | number, unknown>)[key];
  }
  if (node === null || typeof node !== 'object') return undefined;
  const { message, root } = node as { message?: unknown; root?: { message?: unknown } };
  if (typeof message === 'string') return message;
  return typeof root?.message === 'string' ? root.message : undefined;
}

/**
 * Tabla de filas editables (actividades de un proyecto, arcos de una red, niveles de descuento…).
 * Cada fila es un objeto del arreglo `name`; se agregan y quitan filas con botones. En pantallas
 * angostas la tabla hace scroll horizontal. Los errores se listan debajo con su fila.
 */
export function TableField({
  name,
  label,
  hint,
  columns,
  newRow,
  rowName,
  min = 1,
  max = 30,
}: TableFieldProps) {
  const { control, register, formState } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });
  const { errors } = formState;

  const cellErrors = fields.flatMap((_, i) =>
    columns.flatMap((column) => {
      const message = messageAt(errors, [name, i, column.key]);
      return message ? [{ row: i, column, message }] : [];
    }),
  );
  const arrayError = messageAt(errors, [name]);

  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={`${name}-help`}>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      {/* relative: los textos sr-only (posición absoluta) quedan dentro del scroll. */}
      <div className="relative overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th scope="col" className="w-6">
                <span className="sr-only">Fila</span>
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="text-muted-foreground px-1 text-left text-xs font-normal whitespace-nowrap"
                >
                  {column.header}
                </th>
              ))}
              <th scope="col" className="w-8">
                <span className="sr-only">Quitar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, i) => (
              <tr key={field.id}>
                <th
                  scope="row"
                  className="text-muted-foreground tabular text-right text-xs font-normal"
                >
                  {i + 1}
                </th>
                {columns.map((column) => {
                  const invalid = Boolean(messageAt(errors, [name, i, column.key]));
                  return (
                    <td key={column.key} style={{ minWidth: `${column.minWidth ?? 3.5}rem` }}>
                      <input
                        type="text"
                        inputMode={column.kind === 'number' ? 'decimal' : 'text'}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder={column.placeholder}
                        aria-label={`${column.ariaLabel}, fila ${i + 1}`}
                        aria-invalid={invalid}
                        className={cn(cellClass, invalid && 'border-destructive')}
                        {...register(
                          `${name}.${i}.${column.key}`,
                          column.kind === 'number'
                            ? {
                                setValueAs: (v: unknown) => {
                                  if (typeof v === 'number') return v;
                                  const text = String(v ?? '').trim();
                                  if (text === '') return column.optional ? undefined : Number.NaN;
                                  return parseDecimal(text);
                                },
                              }
                            : undefined,
                        )}
                      />
                    </td>
                  );
                })}
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground size-8"
                    disabled={fields.length <= min}
                    onClick={() => remove(i)}
                    aria-label={`Quitar ${rowName} de la fila ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={fields.length >= max}
        onClick={() => append(newRow(fields.length))}
      >
        <Plus className="size-4" />
        Agregar {rowName}
      </Button>
      <div id={`${name}-help`} className="flex flex-col gap-1">
        {arrayError && (
          <p role="alert" className="text-destructive text-xs">
            {arrayError}
          </p>
        )}
        {cellErrors.slice(0, 4).map(({ row, column, message }) => (
          <p key={`${row}-${column.key}`} role="alert" className="text-destructive text-xs">
            Fila {row + 1}, {column.ariaLabel.toLowerCase()}: {message}
          </p>
        ))}
        {cellErrors.length > 4 && (
          <p className="text-destructive text-xs">…y {cellErrors.length - 4} errores más.</p>
        )}
        {!arrayError && cellErrors.length === 0 && hint && (
          <p className="text-muted-foreground text-xs">{hint}</p>
        )}
      </div>
    </fieldset>
  );
}
