'use client';

import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { Input } from '@/components/ui/input';
import { parseFunction } from '@/lib/math/expression';
import { parseDecimal } from '@/lib/math/format';
import { cn } from '@/lib/utils';
import { Field, describedBy } from './Field';

/** Error del campo `name` (admite rutas anidadas como `matrix.0.1`). */
function useFieldError(name: string): string | undefined {
  const { getFieldState, formState } = useFormContext();
  return getFieldState(name, formState).error?.message;
}

interface BaseFieldProps {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
}

/**
 * Campo numérico. Usa `type="text"` + `inputMode="decimal"` en vez de `type="number"` para
 * aceptar la coma decimal ("0,5"), que muchos teclados en español imponen.
 */
export function NumberField({
  name,
  label,
  hint,
  className,
  optional = false,
  integer = false,
}: BaseFieldProps & {
  /** Vacío = `undefined` en vez de error. */
  optional?: boolean;
  integer?: boolean;
}) {
  const { register } = useFormContext();
  const error = useFieldError(name);
  return (
    <div className={className}>
      <Field id={name} label={label} hint={hint} error={error}>
        <Input
          id={name}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          className="font-mono"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(name, Boolean(error))}
          {...register(name, {
            setValueAs: (v: unknown) => {
              if (typeof v === 'number') return v;
              const text = String(v ?? '').trim();
              if (optional && text === '') return undefined;
              return parseDecimal(text);
            },
          })}
        />
      </Field>
    </div>
  );
}

/** Campo para una función escrita por el estudiante, con vista previa en LaTeX. */
export function ExpressionField({
  name,
  label,
  hint,
  className,
  variables = ['x'],
  previewPrefix,
  optional = false,
}: BaseFieldProps & {
  variables?: string[];
  /** LaTeX antes de la expresión en la vista previa, p. ej. `f(x) =`. */
  previewPrefix: string;
  optional?: boolean;
}) {
  const { register, control } = useFormContext();
  const error = useFieldError(name);
  const source = useWatch({ control, name }) as string | undefined;
  const parsed = source ? parseFunction(source, variables) : null;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Field id={name} label={label} hint={hint} error={error}>
        <Input
          id={name}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="font-mono"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(name, Boolean(error))}
          {...register(name, {
            setValueAs: (v: unknown) => (optional && String(v ?? '').trim() === '' ? undefined : v),
          })}
        />
      </Field>
      {parsed?.ok && (
        <div className="bg-muted/60 overflow-x-auto rounded-md px-3 py-1.5 text-sm">
          <Formula tex={`${previewPrefix} ${parsed.expr.tex}`} />
        </div>
      )}
    </div>
  );
}

/** Lista desplegable nativa (mejor en móvil que un popover). */
export function SelectField({
  name,
  label,
  hint,
  className,
  options,
}: BaseFieldProps & { options: { value: string; label: string }[] }) {
  const { register } = useFormContext();
  const error = useFieldError(name);
  return (
    <div className={className}>
      <Field id={name} label={label} hint={hint} error={error}>
        <select
          id={name}
          className="border-input bg-card focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(name, Boolean(error))}
          {...register(name)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

/** Ayuda estándar para campos de función de x. */
export const FUNCTION_HINT = (
  <>
    Usa <code>x</code> como variable. Ej.: <code>x^3 - 2x - 5</code>, <code>sen(x) - x/2</code>,{' '}
    <code>ln(x) + x</code>, <code>e^(-x)</code>.
  </>
);

/** Tolerancia + máximo de iteraciones, comunes a los métodos iterativos. */
export function IterationFields() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField
        name="tolerance"
        label={
          <>
            Tolerancia <Formula tex="\varepsilon_s\,(\%)" />
          </>
        }
        hint="Porcentaje."
      />
      <NumberField name="maxIterations" label="Máx. iteraciones" integer />
    </div>
  );
}
