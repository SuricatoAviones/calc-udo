'use client';

import { useRef, type ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { Field, describedBy } from '@/components/calculators/form/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  formulaLatex,
  parseFormula,
} from '@/lib/calculators/logica-formal-y-algoritmos/proposition';
import { latexLines } from '@/lib/math/format';

/** Conectores que el teclado del teléfono no trae. */
const SYMBOLS = [
  { symbol: '¬', name: 'negación' },
  { symbol: '∧', name: 'conjunción' },
  { symbol: '∨', name: 'disyunción' },
  { symbol: '→', name: 'condicional' },
  { symbol: '↔', name: 'bicondicional' },
  { symbol: '⊕', name: 'disyunción exclusiva' },
  { symbol: '(', name: 'abrir paréntesis' },
  { symbol: ')', name: 'cerrar paréntesis' },
];

export const FORMULA_HINT =
  'Variables: una letra (p, q, r…). También puedes escribir ~ o ! (¬), & (∧), | (∨), -> (→) y <-> (↔).';

function preview(text: string, multiline: boolean): string | null {
  if (!multiline) {
    const f = parseFormula(text);
    return typeof f === 'string' ? null : formulaLatex(f);
  }
  const lines = text
    .split(/[\n;]+/)
    .map((t) => t.trim())
    .filter((t) => t !== '');
  const parsed = lines.map((line) => parseFormula(line));
  if (parsed.length === 0 || parsed.some((f) => typeof f === 'string')) return null;
  return latexLines(
    parsed.map((f, k) => `P_{${k + 1}}:\\ ${formulaLatex(f as Exclude<typeof f, string>)}`),
  );
}

/**
 * Campo para una proposición (o varias, una por línea) con botones para insertar los conectores
 * y una vista previa de cómo se leyó, con todos los paréntesis.
 */
export function FormulaField({
  name,
  label,
  hint = FORMULA_HINT,
  multiline = false,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  multiline?: boolean;
}) {
  const { register, control, setValue, getFieldState, formState } = useFormContext();
  const error = getFieldState(name, formState).error?.message;
  const source = (useWatch({ control, name }) as string | undefined) ?? '';
  const element = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const { ref, ...rest } = register(name);
  const tex = source.trim() ? preview(source, multiline) : null;

  const insert = (symbol: string) => {
    const el = element.current;
    const start = el?.selectionStart ?? source.length;
    const end = el?.selectionEnd ?? source.length;
    const next = `${source.slice(0, start)}${symbol}${source.slice(end)}`;
    setValue(name, next, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + symbol.length, start + symbol.length);
    });
  };

  const common = {
    id: name,
    autoComplete: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy(name, Boolean(error)),
    ...rest,
  };

  return (
    <div className="flex flex-col gap-2">
      <Field id={name} label={label} hint={hint} error={error}>
        {multiline ? (
          <textarea
            rows={3}
            className="border-input bg-card focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            ref={(el) => {
              ref(el);
              element.current = el;
            }}
            {...common}
          />
        ) : (
          <Input
            className="font-mono"
            ref={(el) => {
              ref(el);
              element.current = el;
            }}
            {...common}
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Insertar conector">
        {SYMBOLS.map(({ symbol, name: symbolName }) => (
          <Button
            key={symbol}
            type="button"
            variant="outline"
            size="icon-sm"
            className="font-mono"
            aria-label={`Insertar ${symbolName}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(symbol)}
          >
            {symbol}
          </Button>
        ))}
      </div>
      {tex && (
        <div className="bg-muted/60 overflow-x-auto rounded-md px-3 py-1.5 text-sm">
          <Formula tex={tex} />
        </div>
      )}
    </div>
  );
}
