'use client';

import { Minus, Plus } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { formatNumber, parseDecimal } from '@/lib/math/format';
import { cn } from '@/lib/utils';

const cellClass =
  'border-input bg-card focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-md border px-2 text-center font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px]';

function display(v: number | undefined): string {
  return v === undefined || Number.isNaN(v) ? '' : formatNumber(v);
}

function resize(matrix: number[][], size: number): number[][] {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => matrix[i]?.[j] ?? (i === j ? 1 : 0)),
  );
}

/**
 * Matriz cuadrada editable (p. ej. la matriz de transición de una cadena de Markov). Muestra la
 * suma de cada fila para detectar errores de tipeo antes de calcular.
 */
export function MatrixField({
  name,
  label,
  hint,
  min = 2,
  max = 8,
  showRowSums = false,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  min?: number;
  max?: number;
  showRowSums?: boolean;
}) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const matrix = (field.value as number[][] | undefined) ?? resize([], min);
        const size = matrix.length;
        const setSize = (next: number) => field.onChange(resize(matrix, next));
        const setCell = (i: number, j: number, text: string) => {
          const next = matrix.map((row) => [...row]);
          next[i]![j] = parseDecimal(text);
          field.onChange(next);
        };
        const error = fieldState.error?.message;
        return (
          <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={`${name}-help`}>
            <div className="flex items-center justify-between gap-2">
              <legend className="text-sm font-medium">{label}</legend>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={size <= min}
                  onClick={() => setSize(size - 1)}
                  aria-label="Quitar un estado"
                >
                  <Minus className="size-4" />
                </Button>
                <span className="text-muted-foreground tabular w-16 text-center text-xs">
                  {size} estados
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={size >= max}
                  onClick={() => setSize(size + 1)}
                  aria-label="Agregar un estado"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="w-6" />
                    {matrix.map((_, j) => (
                      <th key={j} scope="col" className="text-muted-foreground text-xs font-normal">
                        {j + 1}
                      </th>
                    ))}
                    {showRowSums && (
                      <th scope="col" className="text-muted-foreground text-xs font-normal">
                        Σ
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => {
                    const sum = row.reduce((s, v) => s + (Number.isNaN(v) ? 0 : v), 0);
                    const sumOk = Math.abs(sum - 1) <= 1e-6;
                    return (
                      <tr key={i}>
                        <th scope="row" className="text-muted-foreground text-xs font-normal">
                          {i + 1}
                        </th>
                        {row.map((v, j) => (
                          <td key={`${size}-${i}-${j}`} className="min-w-14">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              aria-label={`Fila ${i + 1}, columna ${j + 1}`}
                              aria-invalid={Boolean(error)}
                              defaultValue={display(v)}
                              onChange={(e) => setCell(i, j, e.target.value)}
                              onBlur={field.onBlur}
                              className={cellClass}
                            />
                          </td>
                        ))}
                        {showRowSums && (
                          <td
                            className={cn(
                              'tabular px-1 text-right font-mono text-xs',
                              sumOk ? 'text-muted-foreground' : 'text-destructive',
                            )}
                          >
                            {formatNumber(sum, 4)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
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

function resizeRect(matrix: number[][], rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => matrix[i]?.[j] ?? 0),
  );
}

function Stepper({
  value,
  min,
  max,
  unit,
  onChange,
  what,
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  what: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        aria-label={`Quitar ${what}`}
      >
        <Minus className="size-4" />
      </Button>
      <span className="text-muted-foreground tabular w-20 text-center text-xs">
        {value} {unit}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        aria-label={`Agregar ${what}`}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

/**
 * Matriz m × n editable con filas y columnas nombradas (p. ej. la matriz de pagos de un juego:
 * estrategias A1…Am del jugador de las filas contra B1…Bn del de las columnas).
 */
export function RectangularMatrixField({
  name,
  label,
  hint,
  rowPrefix,
  colPrefix,
  rowUnit,
  colUnit,
  min = 1,
  max = 8,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Prefijo de los nombres de fila y columna: `A` → A1, A2… */
  rowPrefix: string;
  colPrefix: string;
  /** Texto de los contadores: «filas», «columnas». */
  rowUnit: string;
  colUnit: string;
  min?: number;
  max?: number;
}) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const matrix = (field.value as number[][] | undefined) ?? resizeRect([], min, min);
        const rows = matrix.length;
        const cols = matrix[0]?.length ?? min;
        const setCell = (i: number, j: number, text: string) => {
          const next = matrix.map((row) => [...row]);
          next[i]![j] = parseDecimal(text);
          field.onChange(next);
        };
        const error = fieldState.error?.message;
        return (
          <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={`${name}-help`}>
            <legend className="mb-2 text-sm font-medium">{label}</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Stepper
                value={rows}
                min={min}
                max={max}
                unit={rowUnit}
                what={`una estrategia de ${rowPrefix}`}
                onChange={(next) => field.onChange(resizeRect(matrix, next, cols))}
              />
              <Stepper
                value={cols}
                min={min}
                max={max}
                unit={colUnit}
                what={`una estrategia de ${colPrefix}`}
                onChange={(next) => field.onChange(resizeRect(matrix, rows, next))}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="w-8" />
                    {matrix[0]?.map((_, j) => (
                      <th key={j} scope="col" className="text-muted-foreground text-xs font-normal">
                        {colPrefix}
                        {j + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={i}>
                      <th scope="row" className="text-muted-foreground text-xs font-normal">
                        {rowPrefix}
                        {i + 1}
                      </th>
                      {row.map((v, j) => (
                        <td key={`${rows}-${cols}-${i}-${j}`} className="min-w-14">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`${rowPrefix}${i + 1} contra ${colPrefix}${j + 1}`}
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

/**
 * Vector de probabilidades opcional cuyo tamaño sigue al de una matriz del mismo formulario
 * (p. ej. la distribución inicial de una cadena de Markov).
 */
export function OptionalVectorField({
  name,
  sizeFrom,
  label,
  toggleLabel,
  hint,
}: {
  name: string;
  /** Campo matriz del que se toma el tamaño. */
  sizeFrom: string;
  label: ReactNode;
  toggleLabel: string;
  hint?: ReactNode;
}) {
  const { control, setValue } = useFormContext();
  const matrix = useWatch({ control, name: sizeFrom }) as number[][] | undefined;
  const vector = useWatch({ control, name }) as number[] | undefined;
  const size = matrix?.length ?? 0;

  // Si cambia el número de estados, la distribución se reinicia a uniforme.
  useEffect(() => {
    if (vector && vector.length !== size && size > 0) {
      setValue(
        name,
        Array.from({ length: size }, () => 1 / size),
        { shouldValidate: false },
      );
    }
  }, [vector, size, name, setValue]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = field.value as number[] | undefined;
        const enabled = value !== undefined;
        const error = fieldState.error?.message;
        return (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) =>
                  field.onChange(
                    e.target.checked ? Array.from({ length: size }, () => 1 / size) : undefined,
                  )
                }
                className="accent-primary size-4"
              />
              {toggleLabel}
            </label>
            {enabled && (
              <fieldset className="flex flex-col gap-1">
                <legend className="text-sm font-medium">{label}</legend>
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${size}, minmax(3.5rem, 1fr))` }}
                >
                  {value.map((v, j) => (
                    <input
                      key={`${size}-${j}-${value.length}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Estado ${j + 1}`}
                      aria-invalid={Boolean(error)}
                      defaultValue={display(v)}
                      onChange={(e) => {
                        const next = [...value];
                        next[j] = parseDecimal(e.target.value);
                        field.onChange(next);
                      }}
                      className={cellClass}
                    />
                  ))}
                </div>
                {error ? (
                  <p role="alert" className="text-destructive text-xs">
                    {error}
                  </p>
                ) : (
                  hint && <p className="text-muted-foreground text-xs">{hint}</p>
                )}
              </fieldset>
            )}
          </div>
        );
      }}
    />
  );
}
