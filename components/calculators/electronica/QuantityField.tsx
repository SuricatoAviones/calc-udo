'use client';

import { useState, type ReactNode } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Field, describedBy } from '@/components/calculators/form/Field';
import { engText, parseQuantity } from '@/lib/calculators/electronica/units';

/** Nota común bajo los formularios con magnitudes. */
export function QuantityHint() {
  return (
    <p className="text-muted-foreground text-xs">
      Resistencias, capacitancias y corrientes aceptan prefijos: <code>2.2k</code>,{' '}
      <code>100µ</code> (o <code>100u</code>), <code>47n</code>, <code>1M</code>, <code>20 mA</code>
      .
    </p>
  );
}

/**
 * Campo numérico que acepta prefijos de ingeniería (`2.2k`, `100µ`, `47 nF`, `1e-6`) y muestra el
 * valor inicial con prefijo (`270 µF` en vez de `0.00027`). Lo usan Electrónica y el Laboratorio.
 */
export function QuantityField({
  name,
  label,
  unit,
  hint,
  className,
  optional = false,
}: {
  name: string;
  label: ReactNode;
  /** Unidad para mostrar el valor inicial (Ω, F, H, A, S, Hz). */
  unit: string;
  hint?: ReactNode;
  className?: string;
  /** Vacío = `undefined` en vez de error. */
  optional?: boolean;
}) {
  const { control } = useFormContext();
  return (
    <div className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <QuantityInput
            name={name}
            label={label}
            hint={hint}
            unit={unit}
            initial={field.value as unknown}
            error={fieldState.error?.message}
            onBlur={field.onBlur}
            onChange={(text) =>
              field.onChange(optional && text.trim() === '' ? undefined : parseQuantity(text))
            }
          />
        )}
      />
    </div>
  );
}

/** El texto escrito vive aquí: el formulario guarda el número ya leído. */
function QuantityInput({
  name,
  label,
  hint,
  unit,
  initial,
  error,
  onBlur,
  onChange,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  unit: string;
  initial: unknown;
  error?: string;
  onBlur: () => void;
  onChange: (text: string) => void;
}) {
  const [text, setText] = useState(() =>
    typeof initial === 'number' && Number.isFinite(initial) ? engText(initial, unit, 6) : '',
  );
  return (
    <Field id={name} label={label} hint={hint} error={error}>
      <Input
        id={name}
        name={name}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
        value={text}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(name, Boolean(error))}
        onBlur={onBlur}
        onChange={(event) => {
          setText(event.target.value);
          onChange(event.target.value);
        }}
      />
    </Field>
  );
}
