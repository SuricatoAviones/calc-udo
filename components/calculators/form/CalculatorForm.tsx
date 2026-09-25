'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { FormProvider, useForm, type DefaultValues, type FieldValues } from 'react-hook-form';
import { CalculatorLayout } from '@/components/calculators/CalculatorLayout';
import { Button } from '@/components/ui/button';
import type { Calculator, CalculatorResult } from '@/lib/calculators/types';

interface CalculatorFormProps<TInput extends FieldValues, TValue, TErrorCode extends string> {
  calculator: Calculator<TInput, TValue, TErrorCode>;
  /** Los campos del formulario (NumberField, ExpressionField, …). */
  children: ReactNode;
}

/**
 * Formulario + layout de una calculadora. Maneja el estado, la validación con el schema de la
 * calculadora (precargado con su `example`) y la llamada a `solve()`. Cada calculadora solo
 * declara sus campos como hijos; estos leen el formulario con `useFormContext`.
 */
export function CalculatorForm<TInput extends FieldValues, TValue, TErrorCode extends string>({
  calculator,
  children,
}: CalculatorFormProps<TInput, TValue, TErrorCode>) {
  const [result, setResult] = useState<CalculatorResult<TValue, TErrorCode> | null>(null);
  const form = useForm<TInput>({
    resolver: zodResolver(calculator.inputSchema),
    defaultValues: calculator.example as DefaultValues<TInput>,
    mode: 'onTouched',
  });

  return (
    <CalculatorLayout meta={calculator.meta} result={result}>
      <FormProvider {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => setResult(calculator.solve(values)))}
          className="flex flex-col gap-4"
        >
          {children}
          <Button type="submit" size="lg" className="w-full">
            Calcular
          </Button>
        </form>
      </FormProvider>
    </CalculatorLayout>
  );
}
