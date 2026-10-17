'use client';

import { useEffect, type ReactNode } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { ExpressionField, SelectField } from '@/components/calculators/form/fields';
import { cellClass, display, firstErrorMessage } from '@/components/calculators/form/MatrixField';
import { parseDecimal } from '@/lib/math/format';
import { gainPreviewTex } from '@/lib/calculators/sistemas-dinamicos/symbolic';
import {
  diagramToGraph,
  type BlockDiagramDocument,
} from '@/lib/calculators/sistemas-dinamicos/block-diagram';

/** Ayuda común de los campos con una función de s. */
export const TF_HINT = (
  <>
    Cociente de polinomios en <code>s</code>, factorizado o no: <code>10(s + 3)/(s(s + 2))</code>,{' '}
    <code>(s + 1)/(s^2 + 2s + 5)</code>.
  </>
);

/** Campo para una función de transferencia G(s), con vista previa en LaTeX. */
export function TransferField({
  name,
  label,
  prefix,
  hint = TF_HINT,
}: {
  name: string;
  label: ReactNode;
  /** LaTeX antes de la vista previa: `G(s) =`. */
  prefix: string;
  hint?: ReactNode;
}) {
  return (
    <ExpressionField
      name={name}
      label={label}
      variables={['s']}
      previewPrefix={prefix}
      toTex={gainPreviewTex}
      hint={hint}
    />
  );
}

function resizeRect(matrix: number[][] | undefined, rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => matrix?.[i]?.[j] ?? 0),
  );
}

/**
 * Matriz de tamaño fijo (las filas y columnas las decide la calculadora, p. ej. B con tantas filas
 * como A). Si el tamaño cambia, conserva lo escrito y completa con ceros.
 */
export function GridField({
  name,
  label,
  rows,
  cols,
  hint,
}: {
  name: string;
  label: ReactNode;
  rows: number;
  cols: number;
  hint?: ReactNode;
}) {
  const { control, getValues, setValue } = useFormContext();
  useEffect(() => {
    const current = getValues(name) as number[][] | undefined;
    if (current?.length !== rows || current[0]?.length !== cols) {
      setValue(name, resizeRect(current, rows, cols), { shouldValidate: false });
    }
  }, [rows, cols, name, getValues, setValue]);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const matrix = resizeRect(field.value as number[][] | undefined, rows, cols);
        const setCell = (i: number, j: number, text: string) => {
          const next = matrix.map((row) => [...row]);
          next[i]![j] = parseDecimal(text);
          field.onChange(next);
        };
        const error = firstErrorMessage(fieldState.error);
        return (
          <fieldset className="flex min-w-0 flex-col gap-1" aria-describedby={`${name}-help`}>
            <legend className="mb-1 text-sm font-medium">{label}</legend>
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-1">
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td key={`${rows}-${cols}-${i}-${j}`} className="w-16 min-w-14">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`${name}: fila ${i + 1}, columna ${j + 1}`}
                            aria-invalid={Boolean(error)}
                            defaultValue={display(v)}
                            onChange={(e) => setCell(i, j, e.target.value)}
                            onBlur={field.onBlur}
                            className={cellClass}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div id={`${name}-help`}>
              {error ? (
                <p role="alert" className="text-destructive text-xs">
                  {error}
                </p>
              ) : (
                hint && <p className="text-muted-foreground text-xs">{hint}</p>
              )}
            </div>
          </fieldset>
        );
      }}
    />
  );
}

/** Número de filas de la matriz A del formulario (el orden del sistema). */
export function useStateSize(name = 'A'): number {
  const { control } = useFormContext();
  const A = useWatch({ control, name }) as number[][] | undefined;
  return A?.length ?? 1;
}

/**
 * Selectores de la entrada y la salida para Mason y la reducción: con un diagrama dibujado, las
 * entradas (R, D…) y salidas (C…) marcadas; con un flujograma, sus nodos.
 */
export function GraphEndsFields() {
  const { control } = useFormContext();
  const mode = useWatch({ control, name: 'mode' }) as 'flujograma' | 'diagrama';
  const diagram = useWatch({ control, name: 'diagram' }) as BlockDiagramDocument | undefined;
  const branches = useWatch({ control, name: 'branches' }) as
    { from: string; to: string }[] | undefined;
  let inputs: string[] = [];
  let outputs: string[] = [];
  if (mode === 'diagrama') {
    const converted = diagram ? diagramToGraph(diagram) : null;
    if (converted?.ok) {
      inputs = converted.value.inputs;
      outputs = converted.value.outputs;
    } else {
      inputs = (diagram?.elements ?? [])
        .filter((e) => e.kind === 'input')
        .map((e) => e.label?.trim() || 'R');
      outputs = (diagram?.elements ?? [])
        .filter((e) => e.kind === 'output')
        .map((e) => e.label?.trim() || 'C');
    }
  } else {
    const nodes = [
      ...new Set((branches ?? []).flatMap((b) => [b.from?.trim(), b.to?.trim()]).filter(Boolean)),
    ] as string[];
    inputs = nodes;
    outputs = nodes;
  }
  // Si al cambiar de modo el nombre elegido ya no existe, se vuelve a «automática».
  const { getValues, setValue } = useFormContext();
  const inputKey = inputs.join('|');
  const outputKey = outputs.join('|');
  useEffect(() => {
    const current = { input: getValues('input') as string, output: getValues('output') as string };
    if (current.input && !inputKey.split('|').includes(current.input)) setValue('input', '');
    if (current.output && !outputKey.split('|').includes(current.output)) setValue('output', '');
  }, [inputKey, outputKey, getValues, setValue]);
  const options = (list: string[], automatic: string) => [
    { value: '', label: automatic },
    ...list.map((name) => ({ value: name, label: name })),
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField
        name="input"
        label="Entrada"
        options={options(inputs, mode === 'diagrama' ? 'La primera' : 'Automática')}
      />
      <SelectField
        name="output"
        label="Salida"
        options={options(outputs, mode === 'diagrama' ? 'La primera' : 'Automática')}
      />
    </div>
  );
}
