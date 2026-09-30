'use client';

import type { ReactNode } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  cellClass,
  display,
  firstErrorMessage,
  Stepper,
} from '@/components/calculators/form/MatrixField';
import { parseDecimal } from '@/lib/math/format';
import { cn } from '@/lib/utils';

/** n × (n + 1): los coeficientes de n ecuaciones y su lado derecho. */
function resize(system: number[][], size: number): number[][] {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) => {
      if (j === size) return system[i]?.[system[i]!.length - 1] ?? 0;
      return system[i]?.[j] ?? (i === j ? 1 : 0);
    }),
  );
}

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

/**
 * Sistema de ecuaciones lineales como matriz aumentada [A | b], con un solo control para el número
 * de ecuaciones (que es también el de incógnitas).
 */
export function LinearSystemField({
  name,
  label,
  hint,
  min = 2,
  max = 8,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  min?: number;
  max?: number;
}) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const system = (field.value as number[][] | undefined) ?? resize([], min);
        const size = system.length;
        const setCell = (i: number, j: number, text: string) => {
          const next = system.map((row) => [...row]);
          next[i]![j] = parseDecimal(text);
          field.onChange(next);
        };
        const error = firstErrorMessage(fieldState.error);
        return (
          <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={`${name}-help`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-sm font-medium">{label}</legend>
              <Stepper
                value={size}
                min={min}
                max={max}
                unit="ecuaciones"
                what="una ecuación"
                onChange={(next) => field.onChange(resize(system, next))}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    {system[0]?.map((_, j) => (
                      <th
                        key={j}
                        scope="col"
                        className={cn(
                          'text-muted-foreground text-xs font-normal',
                          j === size && 'border-l pl-1',
                        )}
                      >
                        {j === size ? 'b' : `x${SUBSCRIPTS[j + 1] ?? j + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {system.map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td
                          key={`${size}-${i}-${j}`}
                          className={cn('min-w-14', j === size && 'border-l pl-1')}
                        >
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={
                              j === size
                                ? `Ecuación ${i + 1}, lado derecho`
                                : `Ecuación ${i + 1}, coeficiente de x${j + 1}`
                            }
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
