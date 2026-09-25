'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { CalculatorLayout } from '@/components/calculators/CalculatorLayout';
import { Formula } from '@/components/calculators/Formula';
import { Field, describedBy } from '@/components/calculators/form/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  newtonRaphson,
  type NewtonRaphsonInput,
} from '@/lib/calculators/metodos-numericos/newton-raphson';
import { parseFunction } from '@/lib/math/expression';
import { parseDecimal } from '@/lib/math/format';

type Result = ReturnType<typeof newtonRaphson.solve>;

const example = newtonRaphson.example;

/** Vista previa de f(x) en LaTeX mientras se escribe, para detectar errores de tipeo. */
function ExpressionPreview({ source }: { source: string }) {
  const parsed = parseFunction(source);
  if (!parsed.ok) return null;
  return (
    <div className="bg-muted/60 overflow-x-auto rounded-md px-3 py-1.5 text-sm">
      <Formula tex={`f(x) = ${parsed.expr.tex}`} />
    </div>
  );
}

export default function NewtonRaphson() {
  const [result, setResult] = useState<Result | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<NewtonRaphsonInput>({
    resolver: zodResolver(newtonRaphson.inputSchema),
    defaultValues: example,
    mode: 'onTouched',
  });
  const expression = useWatch({ control, name: 'expression' });

  const numberInput = (name: 'x0' | 'tolerance' | 'maxIterations') => ({
    ...register(name, {
      setValueAs: (v: unknown) => (typeof v === 'number' ? v : parseDecimal(String(v))),
    }),
    id: name,
    type: 'text' as const,
    inputMode: 'decimal' as const,
    autoComplete: 'off',
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': describedBy(name, Boolean(errors[name])),
    className: 'font-mono',
  });

  return (
    <CalculatorLayout meta={newtonRaphson.meta} result={result}>
      <form
        noValidate
        onSubmit={handleSubmit((values) => setResult(newtonRaphson.solve(values)))}
        className="flex flex-col gap-4"
      >
        <Field
          id="expression"
          label={<Formula tex="f(x)" />}
          error={errors.expression?.message}
          hint={
            <>
              Usa <code>x</code> como variable. Ej.: <code>x^3 - 2x - 5</code>,{' '}
              <code>sen(x) - x/2</code>, <code>ln(x) + x</code>, <code>e^(-x)</code>.
            </>
          }
        >
          <Input
            id="expression"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="font-mono"
            aria-invalid={Boolean(errors.expression)}
            aria-describedby={describedBy('expression', Boolean(errors.expression))}
            {...register('expression')}
          />
        </Field>
        <ExpressionPreview source={expression ?? ''} />

        <Field
          id="x0"
          label={
            <>
              Valor inicial <Formula tex="x_0" />
            </>
          }
          error={errors.x0?.message}
          hint="Un punto cercano a la raíz. Puedes usar coma o punto decimal."
        >
          <Input {...numberInput('x0')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="tolerance"
            label={
              <>
                Tolerancia <Formula tex="\varepsilon_s\,(\%)" />
              </>
            }
            error={errors.tolerance?.message}
            hint="Porcentaje."
          >
            <Input {...numberInput('tolerance')} />
          </Field>
          <Field id="maxIterations" label="Máx. iteraciones" error={errors.maxIterations?.message}>
            <Input {...numberInput('maxIterations')} inputMode="numeric" />
          </Field>
        </div>

        <Button type="submit" size="lg" className="w-full">
          Calcular
        </Button>
      </form>
    </CalculatorLayout>
  );
}
