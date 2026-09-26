'use client';

import { useController, useFormContext } from 'react-hook-form';
import {
  Stepper,
  cellClass,
  display,
  firstErrorMessage,
} from '@/components/calculators/form/MatrixField';
import { formatNumber, parseDecimal } from '@/lib/math/format';
import { cn } from '@/lib/utils';

const MAX_SIDE = 8;

function resizeVector(v: number[], size: number, fill: number): number[] {
  return Array.from({ length: size }, (_, i) => v[i] ?? fill);
}

function resizeMatrix(m: number[][], rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => m[i]?.[j] ?? 0),
  );
}

const total = (v: number[]) => v.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);

/**
 * Tabla de transporte editable: costos unitarios cᵢⱼ de cada origen a cada destino, la oferta de
 * cada origen (última columna) y la demanda de cada destino (última fila), como en Taha.
 */
export function TransportTableField() {
  const { control } = useFormContext();
  const costs = useController({ control, name: 'costs' });
  const supply = useController({ control, name: 'supply' });
  const demand = useController({ control, name: 'demand' });

  const matrix = (costs.field.value as number[][] | undefined) ?? resizeMatrix([], 2, 2);
  const s = (supply.field.value as number[] | undefined) ?? [0, 0];
  const d = (demand.field.value as number[] | undefined) ?? [0, 0];
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 2;

  const setRows = (next: number) => {
    costs.field.onChange(resizeMatrix(matrix, next, cols));
    supply.field.onChange(resizeVector(s, next, 0));
  };
  const setCols = (next: number) => {
    costs.field.onChange(resizeMatrix(matrix, rows, next));
    demand.field.onChange(resizeVector(d, next, 0));
  };
  const setCost = (i: number, j: number, text: string) => {
    const next = matrix.map((row) => [...row]);
    next[i]![j] = parseDecimal(text);
    costs.field.onChange(next);
  };
  const setAt = (vector: number[], k: number, text: string) => {
    const next = [...vector];
    next[k] = parseDecimal(text);
    return next;
  };

  const error =
    firstErrorMessage(costs.fieldState.error) ??
    firstErrorMessage(supply.fieldState.error) ??
    firstErrorMessage(demand.fieldState.error);
  const totalSupply = total(s);
  const totalDemand = total(d);
  const balanced = Math.abs(totalSupply - totalDemand) < 1e-9;
  const key = `${rows}-${cols}`;
  const headerClass = 'text-muted-foreground text-xs font-normal';

  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby="transport-help">
      <legend className="mb-2 text-sm font-medium">Tabla de transporte</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stepper
          value={rows}
          min={1}
          max={MAX_SIDE}
          unit="orígenes"
          what="un origen"
          onChange={setRows}
        />
        <Stepper
          value={cols}
          min={1}
          max={MAX_SIDE}
          unit="destinos"
          what="un destino"
          onChange={setCols}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-8" />
              {Array.from({ length: cols }, (_, j) => (
                <th key={j} scope="col" className={headerClass}>
                  D{j + 1}
                </th>
              ))}
              <th scope="col" className={cn(headerClass, 'font-medium')}>
                Oferta
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <th scope="row" className={headerClass}>
                  O{i + 1}
                </th>
                {row.map((v, j) => (
                  <td key={`${key}-${i}-${j}`} className="min-w-12">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Costo de O${i + 1} a D${j + 1}`}
                      aria-invalid={Boolean(error)}
                      defaultValue={display(v)}
                      onChange={(e) => setCost(i, j, e.target.value)}
                      onBlur={costs.field.onBlur}
                      className={cellClass}
                    />
                  </td>
                ))}
                <td key={`${key}-s-${i}`} className="min-w-12">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`Oferta de O${i + 1}`}
                    aria-invalid={Boolean(error)}
                    defaultValue={display(s[i])}
                    onChange={(e) => supply.field.onChange(setAt(s, i, e.target.value))}
                    onBlur={supply.field.onBlur}
                    className={cn(cellClass, 'bg-muted/60 font-medium')}
                  />
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row" className={cn(headerClass, 'font-medium')}>
                Dem.
              </th>
              {Array.from({ length: cols }, (_, j) => (
                <td key={`${key}-d-${j}`} className="min-w-12">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`Demanda de D${j + 1}`}
                    aria-invalid={Boolean(error)}
                    defaultValue={display(d[j])}
                    onChange={(e) => demand.field.onChange(setAt(d, j, e.target.value))}
                    onBlur={demand.field.onBlur}
                    className={cn(cellClass, 'bg-muted/60 font-medium')}
                  />
                </td>
              ))}
              <td
                className={cn(
                  'tabular px-1 text-center font-mono text-xs',
                  balanced ? 'text-muted-foreground' : 'text-pencil',
                )}
              >
                {formatNumber(totalSupply, 8)}/{formatNumber(totalDemand, 8)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div id="transport-help">
        {error ? (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Cada celda es el costo de enviar una unidad del origen al destino. La esquina muestra
            oferta total / demanda total
            {balanced
              ? ': el problema está balanceado.'
              : totalSupply > totalDemand
                ? ': sobra oferta, así que se agregará un destino ficticio de costo 0.'
                : ': falta oferta, así que se agregará un origen ficticio de costo 0.'}
          </p>
        )}
      </div>
    </fieldset>
  );
}
